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
    const { agent, task, knowledge, api_key, model, provider } = await req.json();

    if (!agent || !task) {
      return new Response(
        JSON.stringify({ error: "agent and task are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!agent.system_prompt) throw new Error(`Agent ${agent.name} has no database system prompt`);
    const systemPrompt = agent.system_prompt;

    const userMessage = `Task: ${task.title}\nDescription: ${task.description}\n` +
      `Input: ${JSON.stringify(task.input_payload || {})}\n` +
      `Project knowledge: ${JSON.stringify(knowledge || {})}\n\n` +
      `Return ONLY valid JSON matching your output schema. No markdown.\n` +
      `Use only the supplied project knowledge. Never invent files, frameworks, test runs, database changes, or completed actions. ` +
      `If you cannot actually apply a change, label it as proposed and include applied: false.`;

    let output: any = null;
    let tokensUsed = 0;
    let cost = 0;

    try {
      const llmResponse = await callLLM(provider, api_key, model, systemPrompt, userMessage);
      
      // Try to parse as JSON
      let jsonStr = llmResponse.trim();
      jsonStr = jsonStr.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      
      try {
        output = JSON.parse(jsonStr);
      } catch {
        output = { raw_response: llmResponse };
      }

      // Estimate tokens (rough approximation)
      tokensUsed = Math.ceil((systemPrompt.length + userMessage.length + llmResponse.length) / 4);
      
      // Rough cost estimation based on model
      cost = estimateCost(model, tokensUsed);
    } catch (llmError) {
      // LLM failures must propagate as failures; returning HTTP 200 marks tasks as done.
      throw llmError;
    }

    return new Response(JSON.stringify({
      output,
      tokens_used: tokensUsed,
      cost,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

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
        temperature: 0.3,
        max_tokens: 2000,
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
        max_tokens: 2000,
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
        generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
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

function estimateCost(model: string, tokens: number): number {
  const costPer1k: Record<string, number> = {
    "gpt-4o": 0.005,
    "gpt-4o-mini": 0.00015,
    "gpt-4-turbo": 0.01,
    "gpt-4": 0.03,
    "gpt-3.5-turbo": 0.0005,
    "o1-preview": 0.015,
    "o1-mini": 0.003,
    "o3-mini": 0.001,
    "claude-3-5-sonnet-20241022": 0.003,
    "claude-3-5-haiku-20241022": 0.0008,
    "claude-3-opus-20240229": 0.015,
    "claude-3-sonnet-20240229": 0.003,
    "claude-3-haiku-20240307": 0.00025,
    "gemini-2.0-flash": 0.0001,
    "gemini-1.5-pro": 0.00125,
    "gemini-1.5-flash": 0.000075,
    "gemini-1.0-pro": 0.0005,
    "mistral-large-latest": 0.002,
    "mistral-medium-latest": 0.0009,
    "mistral-small-latest": 0.0001,
    "codestral-latest": 0.0003,
  };
  const rate = costPer1k[model] || 0.001;
  return (tokens / 1000) * rate;
}
