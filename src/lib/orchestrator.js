import { supabase } from './supabase.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env.js';
import {
	fetchKnowledge,
	saveKnowledge,
	updateProject,
	createRun,
	updateRun,
	createTask,
	updateTask,
	addTaskLog,
	addRunLog,
	fetchAgents,
	updateAgent,
	fetchAssignments,
	fetchApiKeys,
	fetchSkills,
	fetchAgentSkills
} from './api.js';
import { ROUTING_STRATEGIES, VALIDATION_STRATEGIES } from './constants.js';

const LOCAL_EXECUTION_BASE = '/api/execution';

function getAuthHeaders() {
	return {
		Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
		'Content-Type': 'application/json',
		apikey: SUPABASE_ANON_KEY
	};
}

async function callEdgeFunction(name, body) {
	// Prefer the application backend so execution uses the exact version shipped
	// with this UI (including versioned prompt/skill composition). Edge Functions
	// remain a deployment fallback when the app backend is unavailable.
	const targets = [`${LOCAL_EXECUTION_BASE}/${name}`, `${SUPABASE_URL}/functions/v1/${name}`];
	let lastError;
	for (const target of targets) {
		try {
			const response = await fetch(target, {
			method: 'POST',
			headers: target.startsWith('http') ? getAuthHeaders() : { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
			});
			if (response.ok) {
				const data = await response.json();
				if (data.error) throw new Error(data.error);
				return data;
			}
			lastError = new Error(`Execution backend ${name} failed (${response.status}): ${await response.text()}`);
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError || new Error(`Execution backend ${name} is unavailable`);
}

function normalizeOrchestratorTasks(rawTasks, agents, command) {
	const values = Array.isArray(rawTasks) ? rawTasks : [];
	return values.map((value, index) => {
		const task = typeof value === 'string' ? { title: value } : (value || {});
		const requestedRole = String(task.agent_role || task.role || task.assigned_role || '').toLowerCase();
		const explicitAgent = agents.find((agent) => agent.id === task.agent_id || agent.name?.toLowerCase() === String(task.agent || task.agent_name || '').toLowerCase());
		const agent = explicitAgent || agents.find((candidate) => candidate.role === requestedRole);
		if (!agent) return null;
		const title = String(task.title || task.name || task.objective || task.summary || `${agent.role} project analysis`).trim();
		const description = String(task.description || task.instructions || task.objective || task.prompt || `Execute the ${agent.role} responsibility for: ${command}`).trim();
		return {
			...task,
			title: title || `Task ${index + 1}`,
			description,
			agent_id: agent.id,
			agent_role: agent.role,
			input_payload: typeof task.input_payload === 'object' && task.input_payload ? task.input_payload : { command },
			success_criteria: Array.isArray(task.success_criteria) && task.success_criteria.length ? task.success_criteria : ['Return grounded output based only on supplied project evidence'],
			max_retries: Number.isInteger(task.max_retries) ? task.max_retries : 2
		};
	}).filter(Boolean);
}

// ============================================================
// SCANNER — Section 2
// ============================================================

export async function runScanner(project) {
	await updateProject(project.id, { scan_status: 'scanning' });

	try {
		let result;
		if (project.source_type === 'local') {
			const response = await fetch('/api/scan-local', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ project_path: project.source_path })
			});
			result = await response.json();
			if (!response.ok) throw new Error(result.error || 'Local scan failed');
		} else {
			result = await callEdgeFunction('kceva-scanner', {
				project_path: project.source_path, source_type: project.source_type, project_id: project.id
			});
		}

		const knowledge = {
			tech_stack: result.tech_stack || [],
			entry_points: result.entry_points || [],
			dependency_graph: { ...(result.dependency_graph || {}), scan_details: result.scan_details || {} },
			file_tree: result.file_tree || {},
			documentation: result.documentation || [],
			raw_summary: result.raw_summary || ''
		};

		await saveKnowledge(project.id, knowledge);
		await updateProject(project.id, {
			scan_status: 'done',
			scan_summary: knowledge
		});

		return knowledge;
	} catch (err) {
		await updateProject(project.id, { scan_status: 'failed' });
		throw err;
	}
}

// ============================================================
// ORCHESTRATOR — Section 4: Task Decomposition & Routing
// ============================================================

export async function decomposeTasks(run, knowledge, routingStrategy) {
	await updateRun(run.id, { status: 'decomposing' });
	await addRunLog(run.id, 'info', `Orchestrator decomposing command: "${run.command}"`);

	const agents = await fetchAgents();
	const assignments = await fetchAssignments();
	const apiKeys = await fetchApiKeys();
	const skills = await fetchSkills();
	const agentSkillLinks = await fetchAgentSkills();

	const orchestratorAgent = agents.find((a) => a.role === 'orchestrator');
	const orchestratorAssignment = assignments.find((a) => a.agent_id === orchestratorAgent?.id);
	const orchestratorApiKey = apiKeys.find((k) => k.id === orchestratorAssignment?.api_key_id);

	if (!orchestratorApiKey) {
		throw new Error('Orchestrator agent has no API key assigned. Please assign a model in the Agents panel.');
	}

	const runtimeKnowledge = {
		...knowledge,
		orchestration_rules: [
			'Use only supplied project knowledge and agent_configuration.',
			'Never invent files, frameworks, tests, or applied changes.',
			'Create only tasks necessary for the user command.',
			'Agent prompt requests target database agent_configuration records.'
		],
		agent_configuration: agents.map((agent) => ({
			id: agent.id, name: agent.name, role: agent.role, description: agent.description,
			scope: agent.scope, system_prompt: agent.system_prompt,
			input_schema: agent.input_schema, output_schema: agent.output_schema
		})),
		skill_registry: skills.filter((skill) => skill.is_active).map((skill) => ({
			name: skill.name, description: skill.description, input_schema: skill.input_schema,
			output_schema: skill.output_schema, allowed_tools: skill.allowed_tools, success_criteria: skill.success_criteria
		}))
	};

	const result = await callEdgeFunction('kceva-orchestrator', {
		command: run.command,
		knowledge: runtimeKnowledge,
		routing_strategy: routingStrategy,
		available_agents: agents.map((a) => ({
			id: a.id,
			name: a.name,
			role: a.role,
			scope: a.scope,
			description: a.description,
			system_prompt: a.system_prompt,
			input_schema: a.input_schema,
			output_schema: a.output_schema,
			skills: agentSkillLinks.filter((link) => link.agent_id === a.id).map((link) => skills.find((skill) => skill.id === link.skill_id)?.name).filter(Boolean)
		})),
		api_key: orchestratorApiKey.api_key_encrypted,
		api_key_id: orchestratorApiKey.id,
		model: orchestratorAssignment.model_id,
		provider: orchestratorApiKey.provider
	});

	let tasks = normalizeOrchestratorTasks(result.tasks, agents.filter((agent) => agent.is_active), run.command);
	if (!tasks.length) {
		const fallbackAgent = agents.find((agent) => agent.is_active && agent.role === 'reviewer') || agents.find((agent) => agent.is_active && agent.role === 'architect') || agents.find((agent) => agent.is_active);
		if (!fallbackAgent) throw new Error('No active agent is available for this command');
		tasks = [{ title: 'Analyze project request', description: `Produce a grounded response for: ${run.command}`, agent_id: fallbackAgent.id, agent_role: fallbackAgent.role, input_payload: { command: run.command }, success_criteria: ['Uses only verified project context', 'Directly answers every part of the request'], max_retries: 2 }];
		await addRunLog(run.id, 'warn', 'Orchestrator returned no valid tasks; a safe analysis fallback was created');
	}
	const mutationRequested = /change|update|fix|implement|create|remove|redesign|შეცვალ|გაასწორ|შექმენ|წაშალ|დიზაინ/i.test(run.command);
	if (!/documentation|document|docs|readme|დოკუმენტ/i.test(run.command)) {
		tasks = tasks.filter((task) => task.agent_role !== 'documenter');
	}
	if (!/debug|diagnos|error|exception|bug|fix issue|შეცდომ|დაბაგ/i.test(run.command)) {
		tasks = tasks.filter((task) => task.agent_role !== 'debugger');
	}
	const designRequested = /design|style|ui|ux|layout|apple|დიზაინ|სტილ|ინტერფეის/i.test(run.command);
	if (mutationRequested && designRequested && !tasks.some((task) => task.agent_role === 'architect')) {
		tasks.unshift({
			title: 'Design implementation plan',
			description: `Inspect the real project context and define a concrete, minimal implementation plan for: ${run.command}`,
			agent_role: 'architect', input_payload: { command: run.command }, max_retries: 1,
			success_criteria: ['Names real project files', 'Defines implementable design decisions and constraints']
		});
	}
	if (!mutationRequested) {
		const analysisTask = tasks.find((task) => ['architect', 'reviewer', 'debugger'].includes(task.agent_role)) || tasks[0];
		tasks = analysisTask ? [analysisTask] : [];
	}
	const createdTasks = [];
	const roleTasks = new Map();

	for (const task of tasks) {
		const agent = agents.find((a) => a.id === task.agent_id || a.role === task.agent_role);
		const dependencyRoles = task.depends_on_roles || ({
			coder: ['architect'], tester: ['coder'], reviewer: ['coder', 'tester'], documenter: ['reviewer']
		}[agent?.role] || []);
		const dependencyIds = dependencyRoles.map((role) => roleTasks.get(role)?.id).filter(Boolean);
		const assignedSkillIds = agentSkillLinks.filter((link) => link.agent_id === agent?.id).map((link) => link.skill_id);
		const selectedSkills = skills.filter((skill) => skill.is_active && assignedSkillIds.includes(skill.id) && (!task.skills?.length || task.skills.includes(skill.name)));
		const created = await createTask({
			run_id: run.id,
			agent_id: agent?.id || null,
			title: task.title,
			description: task.description || '',
			input_payload: {
				...(task.input_payload || {}),
				depends_on: dependencyIds,
				success_criteria: task.success_criteria || ['Output matches the requested task and contains no invented claims'],
				skills: selectedSkills.map((skill) => skill.name),
				skill_versions: selectedSkills.map((skill) => ({ id: skill.id, name: skill.name, version: skill.version }))
			},
			max_retries: task.max_retries || 3
		});
		createdTasks.push(created);
		if (agent?.role) roleTasks.set(agent.role, created);
		await addTaskLog(created.id, 'info', `Task created: ${task.title}`);
		await addRunLog(run.id, 'info', `Task routed: "${task.title}" → ${agent?.name || 'unassigned'}`);
	}

	await updateRun(run.id, { status: 'running' });
	return createdTasks;
}

// ============================================================
// WORKER AGENTS — Section 5: Parallel Execution with Retry
// ============================================================

export async function executeTask(task, run, knowledge) {
	const agents = await fetchAgents();
	const agent = agents.find((a) => a.id === task.agent_id);

	if (!agent) {
		await updateTask(task.id, { status: 'failed', error_message: 'No agent assigned' });
		await addTaskLog(task.id, 'error', 'No agent assigned to this task');
		return null;
	}

	const assignments = await fetchAssignments();
	const assignment = assignments.find((a) => a.agent_id === agent.id);
	const apiKeys = await fetchApiKeys();
	const allSkills = await fetchSkills();
	const selectedSkills = allSkills.filter((skill) => skill.is_active && (task.input_payload?.skills || []).includes(skill.name));
	const apiKey = apiKeys.find((k) => k.id === assignment?.api_key_id);

	if (!apiKey) {
		await updateTask(task.id, { status: 'failed', error_message: 'No API key assigned to agent' });
		await addTaskLog(task.id, 'error', `Agent "${agent.name}" has no API key assigned`);
		return null;
	}

	await updateTask(task.id, { status: 'running', started_at: new Date().toISOString() });
	await addTaskLog(task.id, 'info', `Agent "${agent.name}" starting execution`);
	await addTaskLog(task.id, 'info', `Execution context locked: agent prompt + ${selectedSkills.length} active skill(s)`, {
		agent_id: agent.id, agent_prompt_present: Boolean(agent.system_prompt),
		skills: selectedSkills.map((skill) => ({ id: skill.id, name: skill.name, version: skill.version }))
	});

	if (agent.role === 'tester' && knowledge?.file_tree?.root) {
		const response = await fetch('/api/tool-execute', {
			method: 'POST', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'verify', project_root: knowledge.file_tree.root }),
			signal: AbortSignal.timeout(100000)
		});
		const verification = await response.json();
		await updateTask(task.id, {
			status: verification.success ? 'done' : 'failed', output_payload: verification,
			error_message: verification.success ? null : verification.output || verification.error,
			completed_at: new Date().toISOString()
		});
		await addTaskLog(task.id, verification.success ? 'info' : 'error', verification.success ? 'Deterministic verification passed' : 'Deterministic verification failed', verification);
		if (!verification.success) throw new Error('Deterministic verification failed');
		return { output: verification, tokens_used: 0, cost: 0 };
	}

	let attempt = 0;
	const maxRetries = task.max_retries || 3;
	let repairContext = null;
	let verifiedFiles = [];
	if (['coder', 'reviewer'].includes(agent.role) && knowledge?.file_tree?.root) {
		const evidenceText = JSON.stringify(task.input_payload?.upstream_results || []);
		const candidatePaths = [...new Set(evidenceText.match(/(?:src|supabase|static)\/[A-Za-z0-9_./+\[\]-]+\.(?:svelte|css|js|ts|json|md|sql)/g) || [])].slice(0, 12);
		if (candidatePaths.length) {
			const inspectionResponse = await fetch('/api/tool-execute', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'read_files', project_root: knowledge.file_tree.root, paths: candidatePaths }),
				signal: AbortSignal.timeout(15000)
			});
			const inspection = await inspectionResponse.json();
			if (inspectionResponse.ok && inspection.success) {
				verifiedFiles = inspection.files;
				await addTaskLog(task.id, 'info', `Preflight inspected ${verifiedFiles.filter((file) => file.exists).length}/${candidatePaths.length} referenced file(s)`, { files: verifiedFiles.map(({ path, exists }) => ({ path, exists })) });
			}
		}
	}

	while (attempt <= maxRetries) {
		try {
			const result = await callEdgeFunction('kceva-worker', {
				agent: {
					name: agent.name,
					role: agent.role,
					system_prompt: agent.system_prompt,
					input_schema: agent.input_schema,
					output_schema: agent.output_schema
				},
				task: {
					title: task.title,
					description: task.description,
					input_payload: { ...task.input_payload, repair_context: repairContext }
				},
				knowledge: {
					...knowledge,
					verified_files: verifiedFiles,
					selected_skills: selectedSkills.map((skill) => ({
						id: skill.id, name: skill.name, version: skill.version, purpose: skill.purpose, when_to_use: skill.when_to_use, when_not_to_use: skill.when_not_to_use,
						instructions: skill.instructions, allowed_tools: skill.allowed_tools,
						input_schema: skill.input_schema, output_schema: skill.output_schema, success_criteria: skill.success_criteria
					})),
					execution_rules: [
						'Use only supplied project knowledge.',
						'Never invent files, tests, database writes, or completed actions.',
						'If a mutation cannot actually be applied, return applied=false.',
						'Repair attempts must inspect structured tool feedback and must not repeat a failed exact search.'
					]
				},
				api_key: apiKey.api_key_encrypted,
				api_key_id: apiKey.id,
				model: assignment.model_id,
				provider: apiKey.provider
			});

			// Older worker deployments returned LLM failures as HTTP 200 fallback payloads.
			// Never mark those responses as successful tasks.
			if (result?.output?.error || result?.output?.fallback) {
				throw new Error(result.output.error || 'Worker returned a fallback response');
			}

			if (agent.role === 'coder' && Array.isArray(result?.output?.files) && knowledge?.file_tree?.root) {
				const files = result.output.files.map((file) => ({
					path: file?.path || file?.file || file?.filename,
					content: file?.content ?? file?.code ?? file?.source,
					search: file?.search,
					replace: file?.replace
				}));
				const response = await fetch('/api/tool-execute', {
					method: 'POST', headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'apply_files', project_root: knowledge.file_tree.root, files })
				});
				const execution = await response.json();
				if (!response.ok || !execution.success) {
					repairContext = {
						attempt: attempt + 1,
						failed_output: result.output,
						tool_feedback: execution
					};
					throw new Error(`${execution.error || 'File application failed'}${execution.code ? ` [${execution.code}]` : ''}`);
				}
				result.output.execution = execution;
				result.output.applied = true;
				const changedPaths = execution.evidence.map((item) => item.path);
				const postResponse = await fetch('/api/tool-execute', {
					method: 'POST', headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'read_files', project_root: knowledge.file_tree.root, paths: changedPaths }),
					signal: AbortSignal.timeout(15000)
				});
				const postInspection = await postResponse.json();
				if (postResponse.ok && postInspection.success) result.output.execution.verified_after = postInspection.files;
				await addTaskLog(task.id, 'info', `Applied ${execution.evidence.length} file change(s)`, execution);
			}
			if (agent.role === 'coder' && Array.isArray(result?.output?.agent_updates)) {
				const allAgents = await fetchAgents();
				const evidence = [];
				for (const change of result.output.agent_updates) {
					const target = allAgents.find((item) => item.id === change.agent_id || item.role === change.role);
					if (!target || !change.system_prompt) continue;
					await updateAgent(target.id, { system_prompt: change.system_prompt });
					evidence.push({ agent_id: target.id, role: target.role, updated: true });
				}
				result.output.execution = { success: true, action: 'update_agents', evidence };
				result.output.applied = evidence.length > 0;
				await addTaskLog(task.id, 'info', `Updated ${evidence.length} agent prompt(s)`, result.output.execution);
			}

			await updateTask(task.id, {
				status: 'done',
				output_payload: result.output || {},
				tokens_used: result.tokens_used || 0,
				cost: result.cost || 0,
				completed_at: new Date().toISOString()
			});

			await addTaskLog(task.id, 'info', `Task completed successfully (${result.tokens_used || 0} tokens)`);
			return result;
		} catch (err) {
			attempt++;
			const quotaExhausted = /RESOURCE_EXHAUSTED|quota exceeded/i.test(err.message);
			const nonRetriable = /Each file change needs|Path escapes project|Protected path|Unsupported tool action/i.test(err.message);
			const zeroQuota = /limit:\s*0/i.test(err.message);
			const retryMatch = err.message.match(/retry(?:Delay| in)?["':\s]+(\d+(?:\.\d+)?)s/i);
			if (quotaExhausted && !zeroQuota && retryMatch && attempt <= maxRetries) {
				const waitMs = Math.min(Math.ceil(Number(retryMatch[1]) * 1000) + 500, 60000);
				await updateTask(task.id, { status: 'retrying', retry_count: attempt });
				await addTaskLog(task.id, 'warn', `Rate limited; queued for retry in ${Math.ceil(waitMs / 1000)}s`);
				await new Promise((resolve) => setTimeout(resolve, waitMs));
				continue;
			}
			if (zeroQuota) attempt = maxRetries + 1;
			if (nonRetriable) attempt = maxRetries + 1;
			if (attempt > maxRetries) {
				await updateTask(task.id, {
					status: 'failed',
					error_message: err.message,
					retry_count: attempt - 1,
					completed_at: new Date().toISOString()
				});
				await addTaskLog(task.id, 'error', `Task failed after ${attempt} attempts: ${err.message}`);
				throw err;
			} else {
				await updateTask(task.id, { status: 'retrying', retry_count: attempt });
				await addTaskLog(task.id, 'warn', `Attempt ${attempt} failed, retrying... (${err.message})`);
			}
		}
	}
}

export async function executeAllTasks(tasks, run, knowledge, concurrency = 3) {
	concurrency = Math.min(concurrency, 2);
	await addRunLog(run.id, 'info', `Executing dependency graph (${tasks.length} tasks, max concurrency: ${concurrency})`);

	const pending = new Map(tasks.map((task) => [task.id, task]));
	const outcomes = new Map();
	const results = [];

	while (pending.size) {
		const ready = [];
		for (const task of pending.values()) {
			const deps = task.input_payload?.depends_on || [];
			if (deps.some((id) => outcomes.get(id) === false)) {
				await updateTask(task.id, { status: 'failed', error_message: 'Blocked by failed dependency', completed_at: new Date().toISOString() });
				outcomes.set(task.id, false); pending.delete(task.id); continue;
			}
			if (deps.every((id) => outcomes.get(id) === true)) ready.push(task);
		}
		if (pending.size === 0) break;
		if (!ready.length) throw new Error('Workflow dependency cycle or missing dependency');
		for (let index = 0; index < ready.length; index += concurrency) {
			const batch = ready.slice(index, index + concurrency);
			await Promise.all(batch.map(async (task) => {
				pending.delete(task.id);
				const deps = task.input_payload?.depends_on || [];
				task.input_payload.upstream_results = results.filter((item) => deps.includes(item.task.id)).map((item) => item.result?.output);
				try {
					const result = await executeTask(task, run, knowledge);
					results.push({ task, result, success: true }); outcomes.set(task.id, true);
				} catch (error) {
					results.push({ task, error, success: false }); outcomes.set(task.id, false);
				}
			}));
		}
	}

	return results;
}

// ============================================================
// VALIDATION GATE — Section 6
// ============================================================

export async function validateRun(run, tasks, knowledge, validationStrategy) {
	await updateRun(run.id, { status: 'validating' });
	await addRunLog(run.id, 'info', `Validation gate: ${validationStrategy}`);
	const failedTasks = tasks.filter((task) => task.status === 'failed');
	if (failedTasks.length > 0) {
		const result = {
			passed: false,
			summary: `${failedTasks.length} task(s) failed or were blocked before validation`,
			details: failedTasks.map((task) => ({ title: task.title, valid: false, error: task.error_message })),
			deterministic: true
		};
		await addRunLog(run.id, 'error', `Validation failed: ${result.summary}`);
		return result;
	}

	const testerTask = tasks.find((task) => /test|verify/i.test(task.title));
	const reviewerTask = tasks.find((task) => /review/i.test(task.title));
	const testerFailed = testerTask?.output_payload?.success === false;
	const reviewerApproved = reviewerTask?.output_payload?.approved === true || reviewerTask?.output_payload?.review?.approved === true;
	const reviewerRejected = reviewerTask?.output_payload?.approved === false || reviewerTask?.output_payload?.review?.status === 'defective';
	if (testerFailed || reviewerRejected) {
		const result = {
			passed: false,
			summary: testerFailed ? 'Deterministic test execution failed' : 'Adversarial review rejected the implementation',
			details: [], deterministic: true
		};
		await addRunLog(run.id, 'error', `Validation failed: ${result.summary}`);
		return result;
	}
	if ((!testerTask || testerTask.status === 'done') && reviewerApproved) {
		const result = {
			passed: true,
			summary: 'All required tasks completed; deterministic verification passed and reviewer approved the implementation',
			details: [], deterministic: true
		};
		await addRunLog(run.id, 'info', `Validation passed: ${result.summary}`);
		return result;
	}

	const agents = await fetchAgents();
	const testerAgent = agents.find((a) => a.role === 'tester' || a.role === 'reviewer');
	const assignments = await fetchAssignments();
	const testerAssignment = assignments.find((a) => a.agent_id === testerAgent?.id);
	const apiKeys = await fetchApiKeys();
	const testerApiKey = apiKeys.find((k) => k.id === testerAssignment?.api_key_id);

	if (!testerApiKey) {
		await addRunLog(run.id, 'warn', 'No tester/reviewer agent with API key — skipping validation');
		return { passed: true, results: { skipped: true } };
	}

	const completedTasks = tasks.filter((t) => t.status === 'done');
	const result = await callEdgeFunction('kceva-validator', {
		tasks: completedTasks.map((t) => ({
			title: t.title,
			output: t.output_payload
		})),
		validation_strategy: validationStrategy,
		knowledge,
		api_key: testerApiKey.api_key_encrypted,
		api_key_id: testerApiKey.id,
		model: testerAssignment.model_id,
		provider: testerApiKey.provider
	});

	await addRunLog(run.id, result.passed ? 'info' : 'error',
		`Validation ${result.passed ? 'passed' : 'failed'}: ${result.summary || ''}`);

	return result;
}

// ============================================================
// AGGREGATION & DELIVERY — Section 7
// ============================================================

export async function aggregateAndDeliver(run, tasks, validationResult) {
	await addRunLog(run.id, 'info', 'Aggregating outputs from all agents');

	const completedTasks = tasks.filter((t) => t.status === 'done');
	const failedTasks = tasks.filter((t) => t.status === 'failed');

	const finalOutput = {
		command: run.command,
		summary: validationResult.summary || '',
		validation_passed: validationResult.passed,
		tasks: completedTasks.map((t) => ({
			title: t.title,
			agent_id: t.agent_id,
			output: t.output_payload,
			tokens: t.tokens_used,
			cost: t.cost
		})),
		failed_tasks: failedTasks.map((t) => ({
			title: t.title,
			error: t.error_message
		})),
		total_tasks: tasks.length,
		completed: completedTasks.length,
		failed: failedTasks.length
	};

	const totalTokens = tasks.reduce((sum, t) => sum + (t.tokens_used || 0), 0);
	const totalCost = tasks.reduce((sum, t) => sum + (parseFloat(t.cost) || 0), 0);
	const runSucceeded = validationResult.passed && failedTasks.length === 0;

	await updateRun(run.id, {
		status: runSucceeded ? 'completed' : 'failed',
		final_output: finalOutput,
		total_tokens: totalTokens,
		total_cost: totalCost,
		completed_at: new Date().toISOString()
	});

	await addRunLog(run.id, runSucceeded ? 'info' : 'error',
		`Run ${runSucceeded ? 'completed' : 'failed'}: ${completedTasks.length}/${tasks.length} tasks done, ${failedTasks.length} failed, ${totalTokens} tokens, $${totalCost.toFixed(4)}`);

	return finalOutput;
}

// ============================================================
// FULL PIPELINE
// ============================================================

export async function runFullPipeline(project, command, options = {}) {
	const routingStrategy = options.routing_strategy || ROUTING_STRATEGIES.RULE_BASED;
	const validationStrategies = options.validation_strategies?.length ? options.validation_strategies : [options.validation_strategy || VALIDATION_STRATEGIES.SCHEMA_VALIDATION];
	const validationStrategy = validationStrategies.join(',');
	const concurrency = options.concurrency || 3;

	const knowledge = await fetchKnowledge(project.id);
	if (!knowledge) {
		throw new Error('No knowledge cache found. Please scan the project first.');
	}

	const run = await createRun({
		project_id: project.id,
		command,
		routing_strategy: routingStrategy,
		validation_strategy: validationStrategy
	});

	await addRunLog(run.id, 'info', `Run started: "${command}"`);

	try {
		const tasks = await decomposeTasks(run, knowledge, routingStrategy);
		await executeAllTasks(tasks, run, knowledge, concurrency);

		const refreshedTasks = await fetchTasks(run.id);
		const validationResults = [];
		for (const strategy of validationStrategies) validationResults.push(await validateRun(run, refreshedTasks, knowledge, strategy));
		const validationResult = {
			passed: validationResults.every((result) => result.passed),
			summary: validationResults.map((result, index) => `${validationStrategies[index]}: ${result.summary}`).join(' · '),
			details: validationResults.flatMap((result, index) => (result.details || []).map((detail) => ({ strategy: validationStrategies[index], ...detail })))
		};
		const finalOutput = await aggregateAndDeliver(run, refreshedTasks, validationResult);

		return { run, finalOutput };
	} catch (err) {
		await updateRun(run.id, { status: 'failed', completed_at: new Date().toISOString() });
		await addRunLog(run.id, 'error', `Pipeline failed: ${err.message}`);
		throw err;
	}
}

async function fetchTasks(runId) {
	const { data, error } = await supabase
		.from('tasks')
		.select('*')
		.eq('run_id', runId)
		.order('created_at', { ascending: true });
	if (error) throw error;
	return data;
}
