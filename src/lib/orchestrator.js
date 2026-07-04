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
	fetchAssignments,
	fetchApiKeys
} from './api.js';
import { ROUTING_STRATEGIES, VALIDATION_STRATEGIES } from './constants.js';

const EDGE_FUNCTION_BASE = `${SUPABASE_URL}/functions/v1`;

function getAuthHeaders() {
	return {
		Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
		'Content-Type': 'application/json',
		apikey: SUPABASE_ANON_KEY
	};
}

async function callEdgeFunction(name, body) {
	const response = await fetch(`${EDGE_FUNCTION_BASE}/${name}`, {
		method: 'POST',
		headers: getAuthHeaders(),
		body: JSON.stringify(body)
	});
	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Edge function ${name} failed (${response.status}): ${errorText}`);
	}
	const data = await response.json();
	if (data.error) throw new Error(data.error);
	return data;
}

// ============================================================
// SCANNER — Section 2
// ============================================================

export async function runScanner(project) {
	await updateProject(project.id, { scan_status: 'scanning' });
	await addRunLog(project.id, 'info', `Scanner started for project: ${project.name}`);

	try {
		const result = await callEdgeFunction('kceva-scanner', {
			project_path: project.source_path,
			source_type: project.source_type,
			project_id: project.id
		});

		const knowledge = {
			tech_stack: result.tech_stack || [],
			entry_points: result.entry_points || [],
			dependency_graph: result.dependency_graph || {},
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
		await addRunLog(project.id, 'error', `Scanner failed: ${err.message}`);
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

	const orchestratorAgent = agents.find((a) => a.role === 'orchestrator');
	const orchestratorAssignment = assignments.find((a) => a.agent_id === orchestratorAgent?.id);
	const orchestratorApiKey = apiKeys.find((k) => k.id === orchestratorAssignment?.api_key_id);

	if (!orchestratorApiKey) {
		throw new Error('Orchestrator agent has no API key assigned. Please assign a model in the Agents panel.');
	}

	const result = await callEdgeFunction('kceva-orchestrator', {
		command: run.command,
		knowledge,
		routing_strategy: routingStrategy,
		available_agents: agents.map((a) => ({
			id: a.id,
			name: a.name,
			role: a.role,
			scope: a.scope,
			description: a.description
		})),
		api_key: orchestratorApiKey.api_key_encrypted,
		api_key_id: orchestratorApiKey.id,
		model: orchestratorAssignment.model_id,
		provider: orchestratorApiKey.provider
	});

	const tasks = result.tasks || [];
	const createdTasks = [];

	for (const task of tasks) {
		const agent = agents.find((a) => a.id === task.agent_id || a.role === task.agent_role);
		const created = await createTask({
			run_id: run.id,
			agent_id: agent?.id || null,
			title: task.title,
			description: task.description || '',
			input_payload: task.input_payload || {},
			max_retries: task.max_retries || 3
		});
		createdTasks.push(created);
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
	const apiKey = apiKeys.find((k) => k.id === assignment?.api_key_id);

	if (!apiKey) {
		await updateTask(task.id, { status: 'failed', error_message: 'No API key assigned to agent' });
		await addTaskLog(task.id, 'error', `Agent "${agent.name}" has no API key assigned`);
		return null;
	}

	await updateTask(task.id, { status: 'running', started_at: new Date().toISOString() });
	await addTaskLog(task.id, 'info', `Agent "${agent.name}" starting execution`);

	let attempt = 0;
	const maxRetries = task.max_retries || 3;

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
					input_payload: task.input_payload
				},
				knowledge,
				api_key: apiKey.api_key_encrypted,
				api_key_id: apiKey.id,
				model: assignment.model_id,
				provider: apiKey.provider
			});

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
	await addRunLog(run.id, 'info', `Executing ${tasks.length} tasks (concurrency: ${concurrency})`);

	const queue = [...tasks];
	const running = [];
	const results = [];

	while (queue.length > 0 || running.length > 0) {
		while (running.length < concurrency && queue.length > 0) {
			const task = queue.shift();
			const promise = executeTask(task, run, knowledge)
				.then((result) => {
					results.push({ task, result, success: true });
					return result;
				})
				.catch((err) => {
					results.push({ task, error: err, success: false });
					return null;
				})
				.finally(() => {
					const idx = running.indexOf(promise);
					if (idx >= 0) running.splice(idx, 1);
				});
			running.push(promise);
		}
		if (running.length > 0) {
			await Promise.race(running);
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

	await updateRun(run.id, {
		status: validationResult.passed ? 'completed' : 'failed',
		final_output: finalOutput,
		total_tokens: totalTokens,
		total_cost: totalCost,
		completed_at: new Date().toISOString()
	});

	await addRunLog(run.id, 'info',
		`Run completed: ${completedTasks.length}/${tasks.length} tasks done, ${totalTokens} tokens, $${totalCost.toFixed(4)}`);

	return finalOutput;
}

// ============================================================
// FULL PIPELINE
// ============================================================

export async function runFullPipeline(project, command, options = {}) {
	const routingStrategy = options.routing_strategy || ROUTING_STRATEGIES.RULE_BASED;
	const validationStrategy = options.validation_strategy || VALIDATION_STRATEGIES.SCHEMA_VALIDATION;
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
		const validationResult = await validateRun(run, refreshedTasks, knowledge, validationStrategy);
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
