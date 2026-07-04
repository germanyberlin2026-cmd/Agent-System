<script>
	import { onMount } from 'svelte';
	import {
		agents, apiKeys, assignments, skills, agentSkills, projects, activeProject, activeRun,
		knowledgeCache, runs, tasks, addToast
	} from '../lib/stores.js';
	import {
		fetchAgents, fetchApiKeys, refreshGoogleModelsIfStale, normalizeApiKeyProvider,
		fetchAssignments, fetchSkills, fetchAgentSkills, fetchProjects, fetchKnowledge,
		fetchRuns, seedDefaultAgents
	} from '../lib/api.js';
	import { selectedTaskId } from '../lib/stores.js';

	import Toasts from '../lib/components/Toasts.svelte';
	import Sidebar from '../lib/components/Sidebar.svelte';
	import ProjectInput from '../lib/components/ProjectInput.svelte';
	import ScannerSection from '../lib/components/ScannerSection.svelte';
	import OrchestratorSection from '../lib/components/OrchestratorSection.svelte';
	import AgentTree from '../lib/components/AgentTree.svelte';
	import TasksSection from '../lib/components/TasksSection.svelte';
	import ApiKeysPanel from '../lib/components/ApiKeysPanel.svelte';
	import AgentManagement from '../lib/components/AgentManagement.svelte';
	import SkillsPanel from '../lib/components/SkillsPanel.svelte';

	let activeTab = $state('workflow');
	let initialized = $state(false);
	let skillRegistryError = $state('');

	async function handleSelectTask(taskId) {
		selectedTaskId.set(taskId);
	}

	const pipelineSteps = $derived([
		{ icon: '01', label: 'Project', active: !!$activeProject, done: !!$activeProject },
		{ icon: '02', label: 'Scanner', active: $activeProject?.scan_status === 'scanning', done: $activeProject?.scan_status === 'done' },
		{ icon: '03', label: 'Orchestrate', active: $activeRun?.status === 'decomposing', done: $activeRun?.status && $activeRun.status !== 'decomposing' && $activeRun.status !== 'pending' },
		{ icon: '04', label: 'Execute', active: $activeRun?.status === 'running', done: $activeRun?.status === 'validating' || $activeRun?.status === 'completed' },
		{ icon: '05', label: 'Validate', active: $activeRun?.status === 'validating', done: $activeRun?.status === 'completed' },
	]);

	onMount(async () => {
		try {
			const seededAgents = await seedDefaultAgents();
			agents.set(seededAgents);

			let keys = await fetchApiKeys();
			for (const key of keys) {
				if (key.provider) await normalizeApiKeyProvider(key.id, key.provider);
			}
			try {
				keys = await refreshGoogleModelsIfStale(keys);
			} catch (modelError) {
				addToast(`Google model refresh skipped: ${modelError.message}`, 'error');
			}
			apiKeys.set(keys);

			const a = await fetchAssignments();
			assignments.set(a);
			try {
				skills.set(await fetchSkills());
				agentSkills.set(await fetchAgentSkills());
			} catch (skillError) {
				skillRegistryError = skillError.message;
				skills.set([]);
				agentSkills.set([]);
			}

			const p = await fetchProjects();
			projects.set(p);

			if (p.length > 0) {
				activeProject.set(p[0]);
				const knowledge = await fetchKnowledge(p[0].id);
				knowledgeCache.set(knowledge);
				const r = await fetchRuns(p[0].id);
				runs.set(r);
			}
		} catch (err) {
			addToast(`Initialization error: ${err.message}`, 'error');
		} finally {
			initialized = true;
		}
	});
</script>

<Toasts />

<div class="app-layout">
	<!-- Sidebar -->
	<Sidebar
		bind:activeTab
		agentCount={$agents.length}
		keyCount={$apiKeys.length}
		projectCount={$projects.length}
		hasActiveRun={!!$activeRun && ['running', 'decomposing', 'validating'].includes($activeRun?.status)}
	/>

	<!-- Main content -->
	<div class="main-area">
		{#if !initialized}
			<div class="loading-screen">
				<div class="loading-content">
					<div class="loading-logo">
						<svg viewBox="0 0 24 24" fill="none" width="32" height="32">
							<path d="M12 2L2 7l10 5 10-5-10-5z" style="fill: color-mix(in srgb, var(--color-role-architect) 80%, transparent);"/>
							<path d="M2 17l10 5 10-5" stroke="var(--color-role-orchestrator)" stroke-width="1.5" stroke-linecap="round"/>
							<path d="M2 12l10 5 10-5" stroke="var(--color-role-coder)" stroke-width="1.5" stroke-linecap="round"/>
						</svg>
					</div>
					<div class="loading-title">Initializing Kceva</div>
					<div class="loading-dots">
						<span></span><span></span><span></span>
					</div>
				</div>
			</div>
		{:else if activeTab === 'workflow'}
			<div class="workflow-layout fade-in">
				<!-- Left panel -->
				<div class="left-panel">
					<!-- Pipeline visualization bar -->
					<div class="pipeline-bar">
						<div class="pipeline-steps">
							{#each pipelineSteps as step, i}
								<div class="pipe-step {step.active ? 'active' : ''} {step.done ? 'done' : ''}">
									<div class="pipe-icon">{step.icon}</div>
									<div class="pipe-label">{step.label}</div>
								</div>
								{#if i < pipelineSteps.length - 1}
									<div class="pipe-arrow {step.done ? 'done' : ''} {step.active ? 'active' : ''}">
										<svg viewBox="0 0 20 4" fill="none" width="20" height="4">
											<path d="M0 2h16M14 0l2 2-2 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
										</svg>
									</div>
								{/if}
							{/each}
						</div>
					</div>

					<ProjectInput />
					<ScannerSection />
					<OrchestratorSection />
				</div>

				<!-- Right panel -->
				<div class="right-panel">
					<AgentTree
						agents={$agents}
						tasks={$tasks}
						activeRun={$activeRun}
						activeProject={$activeProject}
						selectedTaskId={$selectedTaskId}
						onSelectTask={handleSelectTask}
					/>
					<TasksSection />
				</div>
			</div>

		{:else if activeTab === 'agents'}
			<div class="panel-page fade-in">
				<div class="panel-header">
					<h1 class="panel-title">
						Agent Studio
					</h1>
					<p class="panel-subtitle">Configure, manage and monitor your AI agents</p>
				</div>
				<AgentManagement />
			</div>

		{:else if activeTab === 'keys'}
			<div class="panel-page fade-in">
				<div class="panel-header">
					<h1 class="panel-title">
						Model Hub
					</h1>
					<p class="panel-subtitle">Connect AI providers and assign models to your agents</p>
				</div>
				<ApiKeysPanel />
			</div>

		{:else if activeTab === 'skills'}
			<div class="panel-page fade-in">
				<div class="panel-header">
					<h1 class="panel-title">
						Skill Registry
					</h1>
					<p class="panel-subtitle">Database-driven capabilities and agent tool policies</p>
				</div>
				<SkillsPanel loadError={skillRegistryError} />
			</div>
		{/if}
	</div>
</div>

<style>
	.app-layout {
		display: flex;
		height: 100vh;
		overflow: hidden;
	}

	.main-area {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		background: var(--color-background-default);
		position: relative;
	}

	/* Loading screen */
	.loading-screen {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		min-height: 100vh;
	}
	.loading-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}
	.loading-logo {
		width: 64px;
		height: 64px;
		border-radius: 18px;
		background: linear-gradient(135deg, color-mix(in srgb, var(--color-action-primary) 10%, transparent), color-mix(in srgb, var(--color-role-orchestrator) 8%, transparent));
		border: 1px solid color-mix(in srgb, var(--color-action-primary) 20%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
		animation: float 2s ease-in-out infinite;
	}
	.loading-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-secondary);
		letter-spacing: -0.01em;
	}
	.loading-dots {
		display: flex;
		gap: 0.375rem;
	}
	.loading-dots span {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-action-primary);
		opacity: 0.3;
		animation: dot-pulse 1.2s ease-in-out infinite;
	}
	.loading-dots span:nth-child(2) { animation-delay: 0.2s; }
	.loading-dots span:nth-child(3) { animation-delay: 0.4s; }

	/* Workflow layout */
	.workflow-layout {
		display: grid;
		grid-template-columns: 380px 1fr;
		gap: 0;
		height: 100%;
		min-height: 100vh;
	}

	.left-panel {
		border-right: 1px solid var(--color-border-default);
		display: flex;
		flex-direction: column;
		gap: 0;
		overflow-y: auto;
		height: 100vh;
		position: sticky;
		top: 0;
	}

	.right-panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.25rem;
		overflow-y: auto;
		min-height: 100vh;
	}

	/* Pipeline bar */
	.pipeline-bar {
		padding: 0.875rem 1.125rem;
		border-bottom: 1px solid var(--color-border-default);
		background: var(--color-surface-subtle);
	}
	.pipeline-steps {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.pipe-step {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		opacity: 0.35;
		transition: opacity 0.3s ease;
	}
	.pipe-step.done { opacity: 0.7; }
	.pipe-step.active { opacity: 1; }
	.pipe-icon {
		font-size: 0.875rem;
		line-height: 1;
	}
	.pipe-label {
		font-size: 0.575rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--color-text-muted);
		white-space: nowrap;
	}
	.pipe-step.active .pipe-label { color: var(--color-action-primary-hover); }
	.pipe-step.done .pipe-label { color: var(--color-status-success-default); }
	.pipe-arrow {
		color: var(--color-border-strong);
		flex-shrink: 0;
		transition: color 0.3s ease;
		margin-top: -0.75rem;
		flex: 1;
	}
	.pipe-arrow.done { color: color-mix(in srgb, var(--color-status-success-default) 20%, transparent); }
	.pipe-arrow.active { color: color-mix(in srgb, var(--color-action-primary) 20%, transparent); }

	/* Panel pages */
	.panel-page {
		max-width: 900px;
		margin: 0 auto;
		padding: 2rem 1.5rem;
	}
	.panel-header {
		margin-bottom: 1.75rem;
	}
	.panel-title {
		font-size: 1.375rem;
		font-weight: 700;
		color: var(--color-text-primary);
		letter-spacing: -0.04em;
		display: flex;
		align-items: center;
		gap: 0.625rem;
		margin: 0 0 0.375rem;
	}
	.title-icon {
		font-size: 1.25rem;
	}
	.panel-subtitle {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	@media (max-width: 1024px) {
		.workflow-layout {
			grid-template-columns: 1fr;
			height: auto;
		}
		.left-panel {
			position: static;
			height: auto;
			border-right: none;
			border-bottom: 1px solid var(--color-border-default);
		}
	}
</style>
