<script>
	import { onMount } from 'svelte';
	import { FolderOpen, RefreshCw, Play, ChevronDown, Clock3, FileCode2, AlertTriangle, CheckCircle2, Circle, Trash2 } from '@lucide/svelte';
	import { activeProject, projects, knowledgeCache, runs, activeRun, tasks, runLogs, agents, assignments, apiKeys, agentSkills, skills, addToast } from '../stores.js';
	import { createProject, deleteProject, fetchProjects, fetchKnowledge, fetchRuns, fetchTasks, fetchRunLogs } from '../api.js';
	import { runScanner, runFullPipeline } from '../orchestrator.js';

	let showConnect = $state(false);
	let showAdvanced = $state(false);
	let showHistory = $state(false);
	let projectName = $state('');
	let projectPath = $state('');
	let command = $state('');
	let routing = $state('rule_based');
	let validations = $state({ schema: true, tests: true, review: false });
	let concurrency = $state(3);
	let busy = $state(false);
	let selectingFolder = $state(false);
	let commandTemplates = $state([]);

	onMount(() => {
		try { commandTemplates = JSON.parse(localStorage.getItem('kceva-command-templates') || '[]'); } catch { commandTemplates = []; }
	});

	function saveTemplate() {
		if (!command.trim()) return addToast('Enter a command before saving a template', 'error');
		if (!commandTemplates.includes(command.trim())) commandTemplates = [command.trim(), ...commandTemplates].slice(0, 12);
		localStorage.setItem('kceva-command-templates', JSON.stringify(commandTemplates));
		addToast('Command template saved', 'success');
	}

	const scan = $derived($activeProject?.scan_summary || {});
	const stack = $derived($knowledgeCache?.tech_stack || scan.tech_stack || []);
	const scanDetails = $derived($knowledgeCache?.dependency_graph?.scan_details || scan.dependency_graph?.scan_details || {});
	const indexed = $derived(scan.files_scanned || scan.file_count || Object.keys($knowledgeCache?.file_tree || {}).length || 0);

	function statusFor(agent) {
		const task = $tasks.find((item) => item.agent_id === agent.id);
		if (task?.status === 'done') return 'completed';
		return task?.status || (agent.is_active ? 'idle' : 'disabled');
	}

	function modelFor(agent) {
		const assignment = $assignments.find((item) => item.agent_id === agent.id);
		return assignment?.model_id || 'Not assigned';
	}

	function skillCount(agent) {
		return $agentSkills.filter((item) => item.agent_id === agent.id).length;
	}

	async function selectNativeFolder() {
		selectingFolder = true;
		try {
			const response = await fetch('/api/select-folder', {
				method: 'POST',
				headers: { 'x-kceva-local-action': 'select-folder' }
			});
			const result = await response.json();
			if (result.cancelled) return;
			if (!response.ok || !result.path) {
				showConnect = true;
				addToast(result.error || 'Native folder selection is unavailable. Enter the absolute path.', 'error');
				return;
			}
			projectName = result.name;
			projectPath = result.path;
			await connectProject();
		} catch (error) {
			showConnect = true;
			addToast(`Folder selection failed: ${error.message}`, 'error');
		} finally { selectingFolder = false; }
	}

	async function connectProject() {
		if (!projectName.trim() || !projectPath.trim()) {
			addToast('Project name and absolute local path are required', 'error');
			return;
		}
		busy = true;
		try {
			const project = await createProject({ name: projectName.trim(), source_path: projectPath.trim(), source_type: 'local' });
			projects.set(await fetchProjects());
			activeProject.set(project);
			knowledgeCache.set(null);
			runs.set([]);
			showConnect = false;
			projectName = '';
			projectPath = '';
			addToast('Project connected', 'success');
		} catch (error) { addToast(error.message, 'error'); }
		finally { busy = false; }
	}

	async function selectProject(project) {
		activeProject.set(project);
		knowledgeCache.set(await fetchKnowledge(project.id));
		runs.set(await fetchRuns(project.id));
		activeRun.set(null);
		tasks.set([]);
	}

	async function scanProject() {
		if (!$activeProject) return;
		busy = true;
		try {
			const knowledge = await runScanner($activeProject);
			knowledgeCache.set(knowledge);
			projects.set(await fetchProjects());
			activeProject.set($projects.find((item) => item.id === $activeProject.id) || $activeProject);
			addToast('Project scan complete', 'success');
		} catch (error) { addToast(`Scan failed: ${error.message}`, 'error'); }
		finally { busy = false; }
	}

	async function removeProject(project) {
		if (!confirm(`Remove ${project.name}?`)) return;
		await deleteProject(project.id);
		projects.set(await fetchProjects());
		if ($activeProject?.id === project.id) {
			activeProject.set(null); knowledgeCache.set(null); runs.set([]); activeRun.set(null); tasks.set([]);
		}
	}

	async function runPipeline() {
		if (!$activeProject) return addToast('Select a project first', 'error');
		if (!$knowledgeCache) return addToast('Scan the project first', 'error');
		if (!command.trim()) return addToast('Enter a command', 'error');
		busy = true; tasks.set([]); runLogs.set([]);
		try {
			const validationStrategies = [validations.schema && 'schema_validation', validations.tests && 'test_execution', validations.review && 'adversarial_review'].filter(Boolean);
			const { run } = await runFullPipeline($activeProject, command.trim(), { routing_strategy: routing, validation_strategies: validationStrategies, concurrency });
			activeRun.set(run);
			runs.set(await fetchRuns($activeProject.id));
			tasks.set(await fetchTasks(run.id));
			runLogs.set(await fetchRunLogs(run.id));
			addToast('Pipeline completed', 'success');
		} catch (error) { addToast(`Pipeline failed: ${error.message}`, 'error'); }
		finally { busy = false; }
	}

	async function loadRun(run) {
		activeRun.set(run);
		tasks.set(await fetchTasks(run.id));
		runLogs.set(await fetchRunLogs(run.id));
	}
</script>

<div class="workflow-command-grid">
	<section class="workspace-panel project-context">
		<header class="workspace-panel-header">
			<div><span class="eyebrow">Project context</span><h2>Connected project</h2></div>
			<button class="btn btn-secondary btn-sm" disabled={selectingFolder} onclick={selectNativeFolder}><FolderOpen size={15} /> {selectingFolder ? 'Opening…' : 'Select folder'}</button>
		</header>

		{#if showConnect}
			<div class="inline-form">
				<label class="field"><span>Project name</span><input class="input" bind:value={projectName} placeholder="agent-system" /></label>
				<label class="field"><span>Absolute local path</span><input class="input mono" bind:value={projectPath} placeholder="C:\work\agent-system" /></label>
				<p class="field-help">Browsers do not expose the absolute folder path. It is required so the local scanner and file tools can access the project.</p>
				<div class="button-row"><button class="btn btn-primary" disabled={busy} onclick={connectProject}>Connect project</button><button class="btn btn-ghost" onclick={() => showConnect = false}>Cancel</button></div>
			</div>
		{/if}

		{#if $activeProject}
			<div class="selected-project">
				<div class="project-mark"><FolderOpen size={18} /></div>
				<div class="min-w-0"><strong>{$activeProject.name}</strong><span class="path-text">{$activeProject.source_path}</span></div>
				<span class="status-badge status-{$activeProject.scan_status}">{$activeProject.scan_status === 'done' ? 'Scan complete' : $activeProject.scan_status}</span>
			</div>
			<div class="project-actions"><button class="btn btn-primary" disabled={busy} onclick={scanProject}><span class:spin={busy}><RefreshCw size={14} /></span> {$knowledgeCache ? 'Rescan project' : 'Scan project'}</button></div>
			<div class="metric-grid">
				<div class="metric"><span>Indexed files</span><strong>{indexed || '—'}</strong></div>
				<div class="metric"><span>Stack signals</span><strong>{stack.length || '—'}</strong></div>
				<div class="metric"><span>Last scan</span><strong>{$knowledgeCache?.updated_at ? new Date($knowledgeCache.updated_at).toLocaleDateString() : 'Not scanned'}</strong></div>
			</div>
			<div class="context-block"><span class="eyebrow">Detected stack</span>{#if stack.length}<div class="tag-list">{#each stack.slice(0, 8) as item}<span class="tag">{typeof item === 'string' ? item : item.name || item.language || 'Detected'}</span>{/each}</div>{:else}<p class="muted-copy">Scan the project to identify frameworks, languages and package tooling.</p>{/if}</div>
			{#if Object.keys(scanDetails).length}<div class="scan-details"><div><span class="eyebrow">Languages</span><div class="tag-list">{#each Object.entries(scanDetails.languages || {}) as [language, count]}<span class="tag">{language} · {count}</span>{/each}</div></div><div><span class="eyebrow">Tooling</span><p>{scanDetails.package_manager || 'Unknown package manager'}{scanDetails.database_clients?.length ? ` · ${scanDetails.database_clients.join(', ')}` : ''}</p></div><div><span class="eyebrow">Frameworks</span><p>{scanDetails.frameworks?.map((item) => `${item.name} ${item.version}`).join(' · ') || 'No framework metadata'}</p></div>{#if scanDetails.warnings?.length}<div class="scan-warnings"><span class="eyebrow">Warnings</span>{#each scanDetails.warnings as warning}<p>{warning}</p>{/each}</div>{/if}</div>{/if}
		{:else}
			<div class="empty-state compact"><FolderOpen size={28} /><strong>No project selected</strong><p>Select a local project folder. Kceva will connect its absolute path for scanning and execution.</p><button class="btn btn-primary" disabled={selectingFolder} onclick={selectNativeFolder}>Select project folder</button><button class="btn btn-ghost btn-sm" onclick={() => { showConnect = true; projectName = ''; projectPath = ''; }}>Enter path manually</button></div>
		{/if}

		{#if $projects.length > 0}
			<div class="recent-projects"><span class="eyebrow">Recent projects</span>{#each $projects.slice(0, 5) as project}<div class="recent-row"><button class:active={$activeProject?.id === project.id} onclick={() => selectProject(project)}><span>{project.name}</span><small>{project.scan_status === 'done' ? 'Scanned' : 'Scan required'}</small></button><button class="icon-button danger" aria-label="Remove project" onclick={() => removeProject(project)}><Trash2 size={14} /></button></div>{/each}</div>
		{/if}
	</section>

	<section class="workspace-panel command-center">
		<header class="workspace-panel-header"><div><span class="eyebrow">Command center</span><h2>Describe the change</h2></div><span class="readiness">{$knowledgeCache ? 'Pipeline ready' : 'Scan required'}</span></header>
		<div class="command-compose">
			<textarea bind:value={command} rows="8" placeholder="Add an About page that follows the existing design system. Update navigation and verify the build." disabled={busy} onkeydown={(event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); runPipeline(); } }}></textarea>
			<div class="compose-meta"><span>≈ {Math.ceil(command.length / 4)} tokens</span><span>Ctrl/⌘ + Enter to run</span></div>
		</div>
		<div class="option-section"><span class="option-label">Routing mode</span><div class="segmented">{#each [['rule_based','Rule-based'],['classifier','Classifier'],['llm_decision','LLM']] as option}<button class:active={routing === option[0]} onclick={() => routing = option[0]}>{option[1]}</button>{/each}</div></div>
		<div class="option-section"><span class="option-label">Validation gates</span><div class="check-grid"><label><input type="checkbox" bind:checked={validations.schema} /> Schema</label><label><input type="checkbox" bind:checked={validations.tests} /> Tests</label><label><input type="checkbox" bind:checked={validations.review} /> Adversarial review</label></div></div>
		<button class="advanced-toggle" onclick={() => showAdvanced = !showAdvanced}><span class:rotated={showAdvanced}><ChevronDown size={14} /></span> Advanced options</button>
		{#if showAdvanced}<div class="advanced-options"><label class="field"><span>Concurrent agents: {concurrency}</span><input type="range" min="1" max="8" bind:value={concurrency} /></label></div>{/if}
		<div class="command-actions"><button class="btn btn-primary btn-run" disabled={busy || !$knowledgeCache || !command.trim()} onclick={runPipeline}><Play size={15} /> {busy ? 'Pipeline running…' : 'Run pipeline'}</button><button class="btn btn-secondary" onclick={saveTemplate}>Save template</button><button class="btn btn-ghost" onclick={() => command = ''}>Clear</button></div>
		{#if commandTemplates.length}<div class="template-list"><span class="eyebrow">Command templates</span>{#each commandTemplates.slice(0, 4) as template}<button onclick={() => command = template}>{template}</button>{/each}</div>{/if}
		{#if $runs.length}<div class="run-history"><button class="history-heading" onclick={() => showHistory = !showHistory}><span>Previous runs ({$runs.length})</span><span class:rotated={showHistory}><ChevronDown size={14} /></span></button>{#if showHistory}{#each $runs.slice(0, 6) as run}<button class="run-row" onclick={() => loadRun(run)}><Clock3 size={13} /><span>{run.command}</span><small>{run.status}</small></button>{/each}{/if}</div>{/if}
	</section>

	<section class="workspace-panel agent-pipeline">
		<header class="workspace-panel-header"><div><span class="eyebrow">Execution pipeline</span><h2>Agent activity</h2></div>{#if $activeRun}<span class="status-badge status-{$activeRun.status}">{$activeRun.status}</span>{/if}</header>
		{#if !$activeRun}<div class="pipeline-empty"><Circle size={22} /><strong>No pipeline has run yet</strong><p>Select a project, scan it, then run a command.</p></div>{/if}
		<div class="pipeline-list">
			{#each $agents as agent, index (agent.id)}
				{@const status = statusFor(agent)}
				<details class="pipeline-step" open={status === 'running' || status === 'failed'}>
					<summary><span class="step-index">{agent.icon || '·'}</span><span class="step-main"><strong>{agent.name}</strong><small>{agent.role} · {modelFor(agent)}</small></span><span class="status-badge status-{status}">{status}</span></summary>
					<div class="step-detail"><div><span>Assigned skills</span><strong>{skillCount(agent)}</strong></div><div><span>Current task</span><strong>{$tasks.find((item) => item.agent_id === agent.id)?.title || 'Waiting for work'}</strong></div></div>
				</details>
			{/each}
		</div>
		{#if $activeRun?.final_output}<div class="result-summary"><CheckCircle2 size={17} /><div><strong>Final result available</strong><p>Open the selected run to inspect validation output and changed-file evidence.</p></div></div>{/if}
	</section>
</div>
