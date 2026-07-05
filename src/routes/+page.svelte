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
	import WorkflowWorkspace from '../lib/components/WorkflowWorkspace.svelte';
	import ApiKeysPanel from '../lib/components/ApiKeysPanel.svelte';
	import AgentManagement from '../lib/components/AgentManagement.svelte';
	import SkillsPanel from '../lib/components/SkillsPanel.svelte';

	let activeTab = $state('workflow');
	let initialized = $state(false);
	let skillRegistryError = $state('');


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
			<div class="page-shell wide fade-in">
				<div class="page-heading"><div><span class="eyebrow">Developer workspace</span><h1>Workflow</h1><p>Connect project context, issue a command, and inspect every execution step.</p></div></div>
				<WorkflowWorkspace />
			</div>

		{:else if activeTab === 'agents'}
			<div class="panel-page fade-in">
				<div class="panel-header">
					<span class="eyebrow">Configuration</span><h1 class="panel-title">Agents</h1>
					<p class="panel-subtitle">Manage roles, prompts, contracts and execution responsibility.</p>
				</div>
				<AgentManagement />
			</div>

		{:else if activeTab === 'keys'}
			<div class="panel-page fade-in">
				<div class="panel-header">
					<span class="eyebrow">Infrastructure</span><h1 class="panel-title">API Keys & Models</h1>
					<p class="panel-subtitle">Connect providers and assign the right model to each agent.</p>
				</div>
				<ApiKeysPanel />
			</div>

		{:else if activeTab === 'skills'}
			<div class="panel-page fade-in">
				<div class="panel-header">
					<span class="eyebrow">Capabilities</span><h1 class="panel-title">Skill Registry</h1>
					<p class="panel-subtitle">Create reusable policies, tool access and execution contracts.</p>
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
	.panel-subtitle {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin: 0;
	}
</style>
