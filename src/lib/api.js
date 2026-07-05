import { supabase } from './supabase.js';

// ============================================================
// AGENTS
// ============================================================

export async function fetchAgents() {
	const { data, error } = await supabase
		.from('agents')
		.select('*')
		.order('created_at', { ascending: true });
	if (error) throw error;
	return data;
}

export async function createAgent(agent) {
	const { data, error } = await supabase
		.from('agents')
		.insert({
			name: agent.name,
			role: agent.role,
			description: agent.description || '',
			scope: agent.scope || '',
			system_prompt: agent.system_prompt || '',
			input_schema: agent.input_schema || {},
			output_schema: agent.output_schema || {},
			is_active: true
		})
		.select()
		.single();
	if (error) throw error;
	let { error: versionError } = await supabase.from('prompt_versions').insert({
		agent_id: data.id, version: 1, system_prompt: data.system_prompt,
		input_schema: data.input_schema || {}, output_schema: data.output_schema || {},
		change_reason: 'Initial agent contract', is_active: true
	});
	if (versionError && /column|schema cache/i.test(versionError.message || '')) {
		({ error: versionError } = await supabase.from('prompt_versions').insert({ agent_id: data.id, version: 1, system_prompt: data.system_prompt, change_reason: 'Initial agent contract', is_active: true }));
	}
	if (versionError) throw versionError;
	return data;
}

export async function updateAgent(id, updates) {
	if (updates.system_prompt !== undefined) {
		const { data: current } = await supabase.from('agents').select('system_prompt,input_schema,output_schema').eq('id', id).maybeSingle();
		const { data: versions, error: versionReadError } = await supabase
			.from('prompt_versions').select('version').eq('agent_id', id).order('version', { ascending: false }).limit(1);
		if (!versionReadError) {
			const nextVersion = (versions?.[0]?.version || 0) + 1;
			await supabase.from('prompt_versions').update({ is_active: false }).eq('agent_id', id);
			let { error: promptVersionError } = await supabase.from('prompt_versions').insert({
				agent_id: id, version: nextVersion, system_prompt: updates.system_prompt,
				input_schema: updates.input_schema || current?.input_schema || {},
				output_schema: updates.output_schema || current?.output_schema || {},
				change_reason: updates.change_reason || (current?.system_prompt ? 'Agent prompt updated' : 'Initial prompt'), is_active: true
			});
			if (promptVersionError && /column|schema cache/i.test(promptVersionError.message || '')) {
				({ error: promptVersionError } = await supabase.from('prompt_versions').insert({ agent_id: id, version: nextVersion, system_prompt: updates.system_prompt, change_reason: updates.change_reason || 'Agent prompt updated', is_active: true }));
			}
			if (promptVersionError) throw promptVersionError;
		}
	}
	const cleanUpdates = { ...updates };
	delete cleanUpdates.change_reason;
	const { data, error } = await supabase
		.from('agents')
		.update({ ...cleanUpdates, updated_at: new Date().toISOString() })
		.eq('id', id)
		.select()
		.single();
	if (error) throw error;
	return data;
}

export async function fetchPromptVersions(agentId) {
	const { data, error } = await supabase.from('prompt_versions').select('*').eq('agent_id', agentId).order('version', { ascending: false });
	if (error) return [];
	return data || [];
}

export async function rollbackPromptVersion(agentId, version) {
	const { data: target, error } = await supabase.from('prompt_versions').select('*').eq('agent_id', agentId).eq('version', version).single();
	if (error) throw error;
	return updateAgent(agentId, { system_prompt: target.system_prompt, input_schema: target.input_schema || {}, output_schema: target.output_schema || {}, change_reason: `Rollback to v${version}` });
}

export async function deleteAgent(id) {
	const { error } = await supabase.from('agents').delete().eq('id', id);
	if (error) throw error;
}

export async function seedDefaultAgents() {
	const existing = await fetchAgents();
	if (existing.length === 0) throw new Error('Default agents are missing. Apply the database seed migration.');
	return existing;
}

// ============================================================
// API KEYS
// ============================================================

export async function fetchApiKeys() {
	const { data, error } = await supabase
		.from('api_keys')
		.select('*')
		.order('created_at', { ascending: true });
	if (error) throw error;
	return (data || []).map((key) => ({
		...key,
		provider: String(key.provider || '').toLowerCase()
	}));
}

export async function createApiKey({ provider, label, api_key, available_models, base_url }) {
	const hasKey = !!api_key;
	const hint = hasKey && api_key.length > 8 ? `${api_key.slice(0, 4)}...${api_key.slice(-4)}` : (hasKey ? '****' : '');
	const { data, error } = await supabase
		.from('api_keys')
		.insert({
			provider: provider.toLowerCase(),
			label,
			api_key_encrypted: hasKey ? api_key : '',
			api_key_hint: hint,
			available_models: available_models || [],
			base_url: base_url || ''
		})
		.select()
		.single();
	if (error) throw error;
	return data;
}

export async function discoverOllamaModels(baseUrl) {
	const url = (baseUrl || 'http://localhost:11434').replace(/\/$/, '');
	const response = await fetch(`${url}/api/tags`);
	if (!response.ok) throw new Error(`Ollama responded with ${response.status}. Is Ollama running at ${url}?`);
	const payload = await response.json();
	return (payload.models || []).map((m) => m.name || m.model).filter(Boolean);
}

export async function discoverGoogleModels(apiKey) {
	const response = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=1000`
	);
	const payload = await response.json();
	if (!response.ok) throw new Error(payload?.error?.message || 'Google model discovery failed');
	return (payload.models || [])
		.filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
		.map((model) => ({
			model_id: (model.baseModelId || model.name || '').replace(/^models\//, ''),
			display_name: model.displayName || model.baseModelId || model.name,
			description: model.description || '',
			category: 'Text-out models',
			input_token_limit: model.inputTokenLimit ?? null,
			output_token_limit: model.outputTokenLimit ?? null,
			capabilities: model.supportedGenerationMethods || []
		}))
		.filter((model) => model.model_id);
}

export async function updateApiKeyModels(id, models) {
	const { data, error } = await supabase
		.from('api_keys')
		.update({ available_models: models, updated_at: new Date().toISOString() })
		.eq('id', id)
		.select()
		.single();
	if (error) throw error;
	return data;
}

export async function refreshGoogleModelsIfStale(keys, maxAgeMs = 24 * 60 * 60 * 1000) {
	let changed = false;
	for (const key of keys.filter((item) => item.provider === 'google')) {
		const updatedAt = new Date(key.updated_at || 0).getTime();
		const isStale = !key.available_models?.length || Date.now() - updatedAt >= maxAgeMs;
		if (!isStale) continue;
		const models = await discoverGoogleModels(key.api_key_encrypted);
		await updateApiKeyModels(key.id, models);
		changed = true;
	}
	return changed ? fetchApiKeys() : keys;
}

export async function normalizeApiKeyProvider(id, provider) {
	const { error } = await supabase
		.from('api_keys')
		.update({ provider: provider.toLowerCase() })
		.eq('id', id);
	if (error) throw error;
}

export async function deleteApiKey(id) {
	const { error } = await supabase.from('api_keys').delete().eq('id', id);
	if (error) throw error;
}

// ============================================================
// AGENT MODEL ASSIGNMENTS
// ============================================================

export async function fetchAssignments() {
	const { data, error } = await supabase.from('agent_model_assignments').select('*');
	if (error) throw error;
	return data;
}

export async function assignModelToAgent(agentId, apiKeyId, modelId) {
	const { data: existing } = await supabase
		.from('agent_model_assignments')
		.select('id')
		.eq('agent_id', agentId)
		.maybeSingle();

	if (existing) {
		const { data, error } = await supabase
			.from('agent_model_assignments')
			.update({ api_key_id: apiKeyId, model_id: modelId })
			.eq('id', existing.id)
			.select()
			.single();
		if (error) throw error;
		return data;
	} else {
		const { data, error } = await supabase
			.from('agent_model_assignments')
			.insert({ agent_id: agentId, api_key_id: apiKeyId, model_id: modelId })
			.select()
			.single();
		if (error) throw error;
		return data;
	}
}

export async function removeAssignment(agentId) {
	const { error } = await supabase
		.from('agent_model_assignments')
		.delete()
		.eq('agent_id', agentId);
	if (error) throw error;
}

// ============================================================
// SKILL REGISTRY
// ============================================================

export async function fetchSkills() {
	const { data, error } = await supabase.from('skills').select('*').order('name');
	if (error) throw new Error(`Skill registry could not be loaded: ${error.message}`);
	return (data || []).map((skill) => {
		const registry = skill.input_schema?._registry || {};
		return { ...registry, ...skill, input_schema: skill.input_schema?._contract || skill.input_schema || {} };
	});
}

export async function fetchAgentSkills() {
	const { data, error } = await supabase.from('agent_skills').select('*').order('priority');
	if (error) throw new Error(`Agent skill assignments could not be loaded: ${error.message}`);
	return data || [];
}

export async function createSkill(skill) {
	const payload = {
		name: skill.name,
		description: skill.description || '',
		category: skill.category || 'general',
		purpose: skill.purpose || '',
		when_to_use: skill.when_to_use || '',
		when_not_to_use: skill.when_not_to_use || '',
		instructions: skill.instructions,
		allowed_tools: skill.allowed_tools || [],
		success_criteria: skill.success_criteria || [],
		input_schema: skill.input_schema || {},
		output_schema: skill.output_schema || {},
		examples: skill.examples || [],
		changelog: skill.changelog || 'Initial version',
		status: skill.status || 'active',
		source_format: skill.source_format || 'manual',
		is_active: (skill.status || 'active') === 'active'
	};
	let { data, error } = await supabase.from('skills').insert(payload).select().single();
	if (error && /column|schema cache/i.test(error.message || '')) {
		const legacyPayload = {
			name: payload.name, description: payload.description, instructions: payload.instructions,
			allowed_tools: payload.allowed_tools, success_criteria: payload.success_criteria,
			input_schema: { _contract: payload.input_schema, _registry: { category: payload.category, purpose: payload.purpose, when_to_use: payload.when_to_use, when_not_to_use: payload.when_not_to_use, examples: payload.examples, changelog: payload.changelog, status: payload.status, source_format: payload.source_format } },
			output_schema: payload.output_schema, is_active: payload.is_active
		};
		({ data, error } = await supabase.from('skills').insert(legacyPayload).select().single());
	}
	if (error) throw error;
	await supabase.from('skill_versions').insert({ skill_id: data.id, version: data.version || 1, snapshot: data, change_reason: 'Initial version' }).then(() => {}, () => {});
	return data;
}

export async function updateSkill(id, updates) {
	const changeReason = updates.change_reason || 'Skill updated';
	const payload = { ...updates };
	delete payload.change_reason;
	if (payload.status) payload.is_active = payload.status === 'active';
	let { data, error } = await supabase.rpc('update_skill_versioned', { p_skill_id: id, p_updates: payload, p_change_reason: changeReason });
	if (error && /function|schema cache|could not find/i.test(error.message || '')) {
		const legacyUpdates = {
			name: payload.name, description: payload.description, instructions: payload.instructions,
			allowed_tools: payload.allowed_tools, success_criteria: payload.success_criteria,
			input_schema: { _contract: payload.input_schema || {}, _registry: { category: payload.category, purpose: payload.purpose, when_to_use: payload.when_to_use, when_not_to_use: payload.when_not_to_use, examples: payload.examples, changelog: payload.changelog, status: payload.status, source_format: payload.source_format } },
			output_schema: payload.output_schema, is_active: payload.is_active, updated_at: new Date().toISOString()
		};
		({ data, error } = await supabase.from('skills').update(legacyUpdates).eq('id', id).select().single());
	}
	if (error) throw error;
	return Array.isArray(data) ? data[0] : data;
}

export async function deleteSkill(id) {
	const { error } = await supabase.from('skills').delete().eq('id', id);
	if (error) throw error;
}

export async function fetchSkillVersions(skillId) {
	const { data, error } = await supabase.from('skill_versions').select('*').eq('skill_id', skillId).order('version', { ascending: false });
	if (error && /relation|schema cache|could not find/i.test(error.message || '')) return [];
	if (error) throw error;
	return data || [];
}

export async function rollbackSkillVersion(skillId, versionId) {
	const { data: version, error } = await supabase.from('skill_versions').select('*').eq('id', versionId).single();
	if (error) throw error;
	const snapshot = { ...version.snapshot, change_reason: `Rollback to v${version.version}` };
	delete snapshot.id; delete snapshot.created_at; delete snapshot.updated_at; delete snapshot.version;
	return updateSkill(skillId, snapshot);
}

export async function duplicateSkill(skill) {
	const copy = { ...skill, name: `${skill.name}-copy`, status: 'draft', source_format: 'duplicate' };
	delete copy.id; delete copy.created_at; delete copy.updated_at; delete copy.version;
	return createSkill(copy);
}

export async function setAgentSkill(agentId, skillId, enabled, priority = 100) {
	if (enabled) {
		const { error } = await supabase.from('agent_skills').upsert({ agent_id: agentId, skill_id: skillId, priority }, { onConflict: 'agent_id,skill_id' });
		if (error) throw error;
	} else {
		const { error } = await supabase.from('agent_skills').delete().eq('agent_id', agentId).eq('skill_id', skillId);
		if (error) throw error;
	}
}

// ============================================================
// PROJECTS
// ============================================================

export async function fetchProjects() {
	const { data, error } = await supabase
		.from('projects')
		.select('*')
		.order('created_at', { ascending: false });
	if (error) throw error;
	return data;
}

export async function createProject({ name, source_path, source_type }) {
	const { data, error } = await supabase
		.from('projects')
		.insert({
			name,
			source_path,
			source_type: source_type || 'local',
			scan_status: 'idle'
		})
		.select()
		.single();
	if (error) throw error;
	return data;
}

export async function updateProject(id, updates) {
	const { data, error } = await supabase
		.from('projects')
		.update({ ...updates, updated_at: new Date().toISOString() })
		.eq('id', id)
		.select()
		.single();
	if (error) throw error;
	return data;
}

export async function deleteProject(id) {
	const { error } = await supabase.from('projects').delete().eq('id', id);
	if (error) throw error;
}

// ============================================================
// KNOWLEDGE CACHE
// ============================================================

export async function fetchKnowledge(projectId) {
	const { data, error } = await supabase
		.from('knowledge_cache')
		.select('*')
		.eq('project_id', projectId)
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();
	if (error) throw error;
	return data;
}

export async function saveKnowledge(projectId, knowledge) {
	const existing = await fetchKnowledge(projectId);
	if (existing) {
		const { data, error } = await supabase
			.from('knowledge_cache')
			.update({
				tech_stack: knowledge.tech_stack || [],
				entry_points: knowledge.entry_points || [],
				dependency_graph: knowledge.dependency_graph || {},
				file_tree: knowledge.file_tree || {},
				documentation: knowledge.documentation || [],
				raw_summary: knowledge.raw_summary || '',
				updated_at: new Date().toISOString()
			})
			.eq('id', existing.id)
			.select()
			.single();
		if (error) throw error;
		return data;
	} else {
		const { data, error } = await supabase
			.from('knowledge_cache')
			.insert({
				project_id: projectId,
				storage_type: 'structured_json',
				tech_stack: knowledge.tech_stack || [],
				entry_points: knowledge.entry_points || [],
				dependency_graph: knowledge.dependency_graph || {},
				file_tree: knowledge.file_tree || {},
				documentation: knowledge.documentation || [],
				raw_summary: knowledge.raw_summary || ''
			})
			.select()
			.single();
		if (error) throw error;
		return data;
	}
}

// ============================================================
// RUNS
// ============================================================

export async function fetchRuns(projectId) {
	const { data, error } = await supabase
		.from('runs')
		.select('*')
		.eq('project_id', projectId)
		.order('created_at', { ascending: false });
	if (error) throw error;
	return data;
}

export async function createRun({ project_id, command, routing_strategy, validation_strategy }) {
	const { data, error } = await supabase
		.from('runs')
		.insert({
			project_id,
			command,
			routing_strategy: routing_strategy || 'rule_based',
			validation_strategy: validation_strategy || 'schema_validation',
			status: 'pending'
		})
		.select()
		.single();
	if (error) throw error;
	return data;
}

export async function updateRun(id, updates) {
	const { data, error } = await supabase
		.from('runs')
		.update(updates)
		.eq('id', id)
		.select()
		.single();
	if (error) throw error;
	return data;
}

export async function deleteRun(id) {
	const { error } = await supabase.from('runs').delete().eq('id', id);
	if (error) throw error;
}

// ============================================================
// TASKS
// ============================================================

export async function fetchTasks(runId) {
	const { data, error } = await supabase
		.from('tasks')
		.select('*')
		.eq('run_id', runId)
		.order('created_at', { ascending: true });
	if (error) throw error;
	return data;
}

export async function createTask(task) {
	if (!task?.title?.trim()) throw new Error('Task title is required before database insertion');
	const { data, error } = await supabase
		.from('tasks')
		.insert({
			run_id: task.run_id,
			agent_id: task.agent_id || null,
			title: task.title,
			description: task.description || '',
			input_payload: task.input_payload || {},
			status: 'idle',
			max_retries: task.max_retries || 3
		})
		.select()
		.single();
	if (error) throw error;
	return data;
}

export async function updateTask(id, updates) {
	const { data, error } = await supabase
		.from('tasks')
		.update(updates)
		.eq('id', id)
		.select()
		.single();
	if (error) throw error;
	return data;
}

export async function deleteTask(id) {
	const { error } = await supabase.from('tasks').delete().eq('id', id);
	if (error) throw error;
}

// ============================================================
// LOGS
// ============================================================

export async function fetchTaskLogs(taskId) {
	const { data, error } = await supabase
		.from('task_logs')
		.select('*')
		.eq('task_id', taskId)
		.order('created_at', { ascending: true });
	if (error) throw error;
	return data;
}

export async function addTaskLog(taskId, level, message, metadata = {}) {
	const { data, error } = await supabase
		.from('task_logs')
		.insert({ task_id: taskId, level, message, metadata })
		.select()
		.single();
	if (error) throw error;
	return data;
}

export async function fetchRunLogs(runId) {
	const { data, error } = await supabase
		.from('run_logs')
		.select('*')
		.eq('run_id', runId)
		.order('created_at', { ascending: true });
	if (error) throw error;
	return data;
}

export async function addRunLog(runId, level, message, metadata = {}) {
	const { data, error } = await supabase
		.from('run_logs')
		.insert({ run_id: runId, level, message, metadata })
		.select()
		.single();
	if (error) throw error;
	return data;
}

// ============================================================
// REALTIME SUBSCRIPTIONS
// ============================================================

export function subscribeToTasks(runId, callback) {
	const channel = supabase
		.channel(`tasks:${runId}`)
		.on('postgres_changes',
			{ event: '*', schema: 'public', table: 'tasks', filter: `run_id=eq.${runId}` },
			callback
		)
		.subscribe();
	return channel;
}

export function subscribeToTaskLogs(taskId, callback) {
	const channel = supabase
		.channel(`task_logs:${taskId}`)
		.on('postgres_changes',
			{ event: 'INSERT', schema: 'public', table: 'task_logs', filter: `task_id=eq.${taskId}` },
			callback
		)
		.subscribe();
	return channel;
}

export function subscribeToRunLogs(runId, callback) {
	const channel = supabase
		.channel(`run_logs:${runId}`)
		.on('postgres_changes',
			{ event: 'INSERT', schema: 'public', table: 'run_logs', filter: `run_id=eq.${runId}` },
			callback
		)
		.subscribe();
	return channel;
}

export function subscribeToRuns(projectId, callback) {
	const channel = supabase
		.channel(`runs:${projectId}`)
		.on('postgres_changes',
			{ event: '*', schema: 'public', table: 'runs', filter: `project_id=eq.${projectId}` },
			callback
		)
		.subscribe();
	return channel;
}
