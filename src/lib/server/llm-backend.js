import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../env.js';
import { composeExecutionSystemPrompt } from './prompt-composer.js';

const endpoints = {
	openai: 'https://api.openai.com/v1/chat/completions',
	mistral: 'https://api.mistral.ai/v1/chat/completions',
	anthropic: 'https://api.anthropic.com/v1/messages',
	google: 'https://generativelanguage.googleapis.com/v1beta/models'
};

function cleanJson(text) {
	return text.trim().replace(/```json\s*/g, '').replace(/```\s*/g, '');
}

function fallbackTasks(command, agents) {
	const find = (role) => agents.find((agent) => agent.role === role);
	const specifications = [
		['architect', 'Design implementation plan', `Inspect real project evidence and define an implementable design plan for: ${command}`],
		['coder', 'Implement code changes', `Apply the requested changes using exact verified project files: ${command}`],
		['tester', 'Write and run tests', `Run deterministic verification for the applied implementation: ${command}`],
		['reviewer', 'Adversarial code review', `Review only applied changes and real verification evidence for: ${command}`]
	];
	return specifications.filter(([role]) => find(role)).map(([role, title, description]) => ({
		title, description, agent_role: role, agent_id: find(role).id,
		input_payload: { command }, max_retries: 3
	}));
}

async function systemPrompt(key) {
	const response = await fetch(`${SUPABASE_URL}/rest/v1/system_prompts?prompt_key=eq.${key}&is_active=eq.true&select=content`, {
		headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
	});
	const rows = await response.json();
	if (!response.ok || !rows?.[0]?.content) throw new Error(`Database system prompt not found: ${key}`);
	return rows[0].content;
}

async function callProvider(provider, apiKey, model, system, user, maxTokens = 2000) {
	let response;
	if (provider === 'google') {
		response = await fetch(`${endpoints.google}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
			method: 'POST', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ contents: [{ parts: [{ text: `${system}\n\n${user}` }] }], generationConfig: { temperature: 0.25, maxOutputTokens: maxTokens } })
		});
	} else if (provider === 'anthropic') {
		response = await fetch(endpoints.anthropic, {
			method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
			body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] })
		});
	} else if (provider === 'openai' || provider === 'mistral') {
		response = await fetch(endpoints[provider], {
			method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
			body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.25, max_tokens: maxTokens })
		});
	} else throw new Error(`Unsupported provider: ${provider}`);
	const payload = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error(`${provider} API error (${response.status}): ${payload?.error?.message || JSON.stringify(payload)}`);
	return provider === 'google' ? payload.candidates?.[0]?.content?.parts?.[0]?.text
		: provider === 'anthropic' ? payload.content?.[0]?.text : payload.choices?.[0]?.message?.content;
}

export async function executeBackend(name, body) {
	if (!body.api_key || !body.model || !body.provider) throw new Error('Provider, model and API key are required');
	if (name === 'kceva-orchestrator') {
		const prompt = `${await systemPrompt('orchestrator')}\nAvailable agents:\n${JSON.stringify(body.available_agents)}\nProject knowledge:\n${JSON.stringify(body.knowledge)}\nRouting strategy: ${body.routing_strategy}\nReturn only valid JSON with a tasks array.`;
		const text = await callProvider(body.provider, body.api_key, body.model, prompt, `Command: ${body.command}`, 2000);
		try {
			const parsed = JSON.parse(cleanJson(text));
			const tasks = Array.isArray(parsed) ? parsed : parsed.tasks || [];
			return { tasks: tasks.length ? tasks : fallbackTasks(body.command, body.available_agents || []) };
		} catch {
			return { tasks: fallbackTasks(body.command, body.available_agents || []), fallback: true };
		}
	}
	if (name === 'kceva-worker') {
		if (!body.agent?.system_prompt || !body.task) throw new Error('Agent prompt and task are required');
		const repair = body.task.input_payload?.repair_context;
		const repairDirective = repair ? `\n\nCRITICAL REPAIR ATTEMPT:\nThe previous file edit was rejected by the deterministic tool. Treat tool_feedback.actual_content as the only source of truth for that file. Return a corrected edit for the failed path only. The new search string must be copied verbatim from actual_content, must occur exactly once, and must not repeat the rejected search.\nRepair context: ${JSON.stringify(repair)}` : '';
		const user = `Task: ${body.task.title}\nDescription: ${body.task.description}\nInput: ${JSON.stringify(body.task.input_payload || {})}${repairDirective}\nProject knowledge: ${JSON.stringify(body.knowledge || {})}\nReturn ONLY valid JSON matching the configured output schema. Never invent files or completed actions.`;
		const composedSystem = composeExecutionSystemPrompt(body.agent, body.knowledge?.selected_skills || []);
		const text = await callProvider(body.provider, body.api_key, body.model, `${composedSystem}${repairDirective}`, user, 2400);
		let output; try { output = JSON.parse(cleanJson(text)); } catch { output = { raw_response: text }; }
		return { output, tokens_used: Math.ceil((composedSystem.length + user.length + text.length) / 4), cost: 0, execution_context: { agent_prompt: true, skills: (body.knowledge?.selected_skills || []).map((skill) => ({ name: skill.name, version: skill.version })) } };
	}
	if (name === 'kceva-validator') {
		if (!Array.isArray(body.tasks)) throw new Error('Tasks array is required');
		const prompt = `${await systemPrompt('validator')}\nValidation strategy: ${body.validation_strategy}\nTasks: ${JSON.stringify(body.tasks)}\nReturn only JSON with passed, summary and details.`;
		try {
			return JSON.parse(cleanJson(await callProvider(body.provider, body.api_key, body.model, prompt, 'Validate these task results.', 1500)));
		} catch (error) {
			const details = body.tasks.map((task) => ({ title: task.title, valid: task.status === 'done' && task.output != null }));
			return { passed: details.every((item) => item.valid), summary: details.every((item) => item.valid) ? 'All tasks passed deterministic validation' : 'One or more tasks failed deterministic validation', details, fallback: true };
		}
	}
	throw new Error(`Unknown execution backend: ${name}`);
}
