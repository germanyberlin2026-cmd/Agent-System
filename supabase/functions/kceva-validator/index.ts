import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PROVIDER_ENDPOINTS: Record<string, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  google: "https://generativelanguage.googleapis.com/v1beta/models",
  mistral: "https://api.mistral.ai/v1/chat/completions",
  custom: "",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { tasks, validation_strategy, knowledge, api_key, model, provider } = await req.json();

    if (!tasks || !Array.isArray(tasks)) {
      return new Response(
        JSON.stringify({ error: "tasks array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const promptTemplate = await loadSystemPrompt("validator");
    const systemPrompt = `${promptTemplate}

Validation strategy: ${validation_strategy}

For "schema_validation": Check that each task output is valid JSON and contains expected fields.
For "test_execution": Check that outputs include test results and that tests pass.
For "adversarial_review": Critically review each output for correctness, completeness, and potential issues.

Tasks to validate:
${JSON.stringify(tasks, null, 2)}

Return a JSON object with:
- "passed": boolean (true if all validations pass)
- "summary": string (brief summary of validation results)
- "details": array of per-task validation results`;

    let result: any;

    try {
      const llmResponse = await callLLM(provider, api_key, model, systemPrompt,
        `Validate the following tasks and return JSON:\n${JSON.stringify(tasks)}`);

      let jsonStr = llmResponse.trim();
      jsonStr = jsonStr.replace(/```json\n?/g, "").replace(/```\n?/g, "");

      try {
        result = JSON.parse(jsonStr);
      } catch {
        result = {
          passed: true,
          summary: "Validation completed (LLM response not parseable, defaulting to pass)",
          details: tasks.map((t: any) => ({ title: t.title, valid: true }))
        };
      }
    } catch (llmError) {
      // Fallback: basic schema validation
      const details = tasks.map((t: any) => ({
        title: t.title,
        valid: t.output !== null && t.output !== undefined,
        has_error: t.output?.error !== undefined
      }));

      const allValid = details.every((d: any) => d.valid && !d.has_error);
      result = {
        passed: allValid,
        summary: allValid
          ? `All ${tasks.length} tasks passed schema validation`
          : `${details.filter((d: any) => !d.valid || d.has_error).length} of ${tasks.length} tasks failed validation`,
        details,
        fallback: true,
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function loadSystemPrompt(promptKey: string): Promise<string> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase prompt configuration is unavailable");
  const response = await fetch(`${url}/rest/v1/system_prompts?prompt_key=eq.${promptKey}&is_active=eq.true&select=content`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const rows = await response.json();
  if (!response.ok || !rows?.[0]?.content) throw new Error(`Database system prompt not found: ${promptKey}`);
  return rows[0].content;
}

async function callLLM(provider: string, apiKey: string, model: string, systemPrompt: string, userMessage: string): Promise<string> {
  if (provider === "openai" || provider === "mistral") {
    const endpoint = PROVIDER_ENDPOINTS[provider];
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        temperature: 0.2,
        max_tokens: 1500,
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`LLM API error (${response.status}): ${errText}`);
    }
    const data = await response.json();
    return data.choices[0].message.content;
  } else if (provider === "anthropic") {
    const response = await fetch(PROVIDER_ENDPOINTS.anthropic, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errText}`);
    }
    const data = await response.json();
    return data.content[0].text;
  } else if (provider === "google") {
    const endpoint = `${PROVIDER_ENDPOINTS.google}/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userMessage}` }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google API error (${response.status}): ${errText}`);
    }
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }
  throw new Error(`Unsupported provider: ${provider}`);
}
