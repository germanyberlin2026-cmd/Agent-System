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
    const {
      command,
      knowledge,
      routing_strategy,
      available_agents,
      api_key,
      model,
      provider
    } = await req.json();

    if (!command) {
      return new Response(
        JSON.stringify({ error: "command is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const promptTemplate = await loadSystemPrompt("orchestrator");
    const systemPrompt = `${promptTemplate}

Available agents:
${JSON.stringify(available_agents, null, 2)}

Project knowledge:
${JSON.stringify(knowledge, null, 2)}

Routing strategy: ${routing_strategy}

Ground rules:
- Use only facts present in Project knowledge and Available agents. Never invent files, frameworks, changes, tests, or capabilities.
- A request to inspect or update agent prompts concerns the agent_configuration records supplied in Project knowledge, not a fictional agents/ directory.
- Create only tasks necessary for the command. Do not automatically add coding, testing, review, and documentation tasks.
- Read-only questions should produce an analysis task, not implementation tasks.
- A task may claim a change was completed only when its output includes the exact target record/file and concrete proposed mutation.
- If the available context cannot perform a requested mutation, clearly return a proposed change and mark it as not applied.

Return a JSON object with a "tasks" array. Each task must have:
- "title": short task title
- "description": detailed description of what the agent should do
- "agent_role": the role of the agent that should handle this (e.g. "coder", "tester", "reviewer", "architect", "documenter", "debugger")
- "input_payload": object with task-specific input data
- "max_retries": number (default 3)

Return ONLY valid JSON, no markdown.`;

    let tasks: any[] = [];

    try {
      const llmResponse = await callLLM(provider, api_key, model, systemPrompt, 
        `Command: ${command}\n\nDecompose this into tasks and return JSON.`);
      tasks = parseTasksFromLLM(llmResponse, available_agents, command, knowledge, routing_strategy);
    } catch (llmError) {
      // Fallback to rule-based decomposition if LLM call fails
      tasks = ruleBasedDecompose(command, available_agents, knowledge, routing_strategy);
    }

    return new Response(JSON.stringify({ tasks }), {
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

function parseTasksFromLLM(response: string, agents: any[], command: string, knowledge: any, routing: string): any[] {
  try {
    // Try to extract JSON from the response
    let jsonStr = response.trim();
    // Remove markdown code fences if present
    jsonStr = jsonStr.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    
    const parsed = JSON.parse(jsonStr);
    let tasks = parsed.tasks || parsed;

    if (!Array.isArray(tasks)) {
      tasks = [tasks];
    }

    // Map agent_role to agent_id
    return tasks.map((t: any) => {
      const agent = agents.find((a: any) => a.role === t.agent_role);
      return {
        ...t,
        agent_id: agent?.id || null,
        agent_role: t.agent_role || "coder",
      };
    });
  } catch {
    return ruleBasedDecompose(command, agents, knowledge, routing);
  }
}

function ruleBasedDecompose(command: string, agents: any[], knowledge: any, routing: string): any[] {
  const cmd = command.toLowerCase();
  const tasks: any[] = [];

  const findAgent = (role: string) => agents.find((a) => a.role === role);

  // Always start with architecture if building something new
  if (cmd.includes("build") || cmd.includes("create") || cmd.includes("implement") || cmd.includes("add")) {
    const architect = findAgent("architect");
    if (architect) {
      tasks.push({
        title: "Design architecture",
        description: `Analyze the command "${command}" and design the architecture for the requested feature.`,
        agent_role: "architect",
        agent_id: architect.id,
        input_payload: { command, knowledge },
        max_retries: 3,
      });
    }
  }

  // Code implementation
  const coder = findAgent("coder");
  if (coder) {
    tasks.push({
      title: "Implement code changes",
      description: `Implement the code for: ${command}`,
      agent_role: "coder",
      agent_id: coder.id,
      input_payload: { command, knowledge },
      max_retries: 3,
    });
  }

  // Testing
  const tester = findAgent("tester");
  if (tester) {
    tasks.push({
      title: "Write and run tests",
      description: `Write tests for the implementation of: ${command}`,
      agent_role: "tester",
      agent_id: tester.id,
      input_payload: { command, knowledge },
      max_retries: 3,
    });
  }

  // Review
  const reviewer = findAgent("reviewer");
  if (reviewer) {
    tasks.push({
      title: "Adversarial code review",
      description: `Review the implementation of: ${command} for bugs and security issues.`,
      agent_role: "reviewer",
      agent_id: reviewer.id,
      input_payload: { command, knowledge },
      max_retries: 3,
    });
  }

  // Documentation
  const documenter = findAgent("documenter");
  if (documenter) {
    tasks.push({
      title: "Generate documentation",
      description: `Document the changes made for: ${command}`,
      agent_role: "documenter",
      agent_id: documenter.id,
      input_payload: { command, knowledge },
      max_retries: 3,
    });
  }

  // Debug if the command mentions fixing
  if (cmd.includes("fix") || cmd.includes("debug") || cmd.includes("error") || cmd.includes("bug")) {
    const debuggerAgent = findAgent("debugger");
    if (debuggerAgent) {
      tasks.push({
        title: "Diagnose and fix issue",
        description: `Debug and fix: ${command}`,
        agent_role: "debugger",
        agent_id: debuggerAgent.id,
        input_payload: { command, knowledge },
        max_retries: 3,
      });
    }
  }

  return tasks.length > 0 ? tasks : [{
    title: "Execute command",
    description: `Execute: ${command}`,
    agent_role: "coder",
    agent_id: findAgent("coder")?.id || null,
    input_payload: { command, knowledge },
    max_retries: 3,
  }];
}
