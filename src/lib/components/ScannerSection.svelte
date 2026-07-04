<script>
	import { activeProject, knowledgeCache, addToast } from '../stores.js';
	import { runScanner } from '../orchestrator.js';
	import StatusBadge from './StatusBadge.svelte';
	import { Search, Link, Folder, Loader2, Play } from '@lucide/svelte';

	let scanning = $state(false);
	let showKnowledge = $state(false);

	async function handleScan() {
		if (!$activeProject) return;
		scanning = true;
		try {
			const knowledge = await runScanner($activeProject);
			knowledgeCache.set(knowledge);
			addToast('Scan complete', 'success');
		} catch (err) {
			addToast(`Scan failed: ${err.message}`, 'error');
		} finally {
			scanning = false;
		}
	}

	const scanSteps = [
		'Reading file tree...',
		'Parsing manifests...',
		'Extracting entry points...',
		'Building dependency graph...'
	];
</script>

<div class="section-block">
	<div class="section-header">
		<div class="section-icon"><Search size={16} strokeWidth={2} /></div>
		<div class="section-title">Scanner</div>
		{#if $activeProject}
			<div class="ml-auto flex items-center gap-2">
				<StatusBadge status={$activeProject.scan_status} />
				{#if $knowledgeCache}
					<button class="toggle-btn {showKnowledge ? 'on' : ''}" onclick={() => showKnowledge = !showKnowledge}>
						{showKnowledge ? 'Hide' : 'Knowledge'}
					</button>
				{/if}
			</div>
		{/if}
	</div>

	{#if !$activeProject}
		<div class="hint-text">Select a project above to run the scanner.</div>
	{:else}
		<div class="scanner-info">
			<div class="path-chip">
				<span class="path-type-icon">{#if $activeProject.source_type === 'git'}<Link size={13} strokeWidth={2} />{:else}<Folder size={13} strokeWidth={2} />{/if}</span>
				<span class="path-text">{$activeProject.source_path}</span>
			</div>
			<button
				class="btn btn-primary btn-sm"
				onclick={handleScan}
				disabled={scanning || $activeProject.scan_status === 'scanning'}
			>
				{#if scanning || $activeProject.scan_status === 'scanning'}<Loader2 size={13} strokeWidth={2} class="spin" /> Scanning...{:else}<Play size={13} strokeWidth={2} fill="currentColor" /> Run Scanner{/if}
			</button>
		</div>

		{#if scanning || $activeProject.scan_status === 'scanning'}
			<div class="scan-progress fade-in-up">
				{#each scanSteps as step, i}
					<div class="scan-step" style="animation-delay: {i * 0.4}s">
						<span class="dot dot-running" style="animation-delay: {i * 0.3}s"></span>
						<span class="step-text">{step}</span>
					</div>
				{/each}
			</div>
		{/if}

		{#if $knowledgeCache && showKnowledge}
			<div class="knowledge-panel fade-in-up">
				{#if $knowledgeCache.tech_stack?.length > 0}
					<div class="k-section">
						<div class="label">Tech Stack</div>
						<div class="tags">
							{#each $knowledgeCache.tech_stack as tech}
								<span class="badge badge-green">{tech}</span>
							{/each}
						</div>
					</div>
				{/if}
				{#if $knowledgeCache.entry_points?.length > 0}
					<div class="k-section">
						<div class="label">Entry Points</div>
						<div class="tags">
							{#each $knowledgeCache.entry_points as ep}
								<span class="badge badge-dim" style="font-family: var(--font-mono);">{ep}</span>
							{/each}
						</div>
					</div>
				{/if}
				{#if $knowledgeCache.raw_summary}
					<div class="k-section">
						<div class="label">Summary</div>
						<p class="summary-text">{$knowledgeCache.raw_summary}</p>
					</div>
				{/if}
			</div>
		{/if}

		{#if !$knowledgeCache && $activeProject.scan_status !== 'scanning' && !scanning}
			<div class="hint-text">Click "Run Scanner" to analyze the project and build the knowledge cache for the orchestrator.</div>
		{/if}
	{/if}
</div>

<style>
	.section-block {
		padding: 1.125rem;
		border-bottom: 1px solid var(--color-border-default);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.ml-auto { margin-left: auto; }
	.flex { display: flex; }
	.items-center { align-items: center; }
	.gap-2 { gap: 0.5rem; }

	.hint-text {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		line-height: 1.5;
	}

	.scanner-info {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}

	.path-chip {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.375rem;
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border-default);
		border-radius: 7px;
		padding: 0.375rem 0.625rem;
		min-width: 0;
	}
	.path-type-icon { font-size: 0.875rem; flex-shrink: 0; }
	.path-text {
		font-size: 0.7rem;
		font-family: var(--font-mono);
		color: var(--color-text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.scan-progress {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border-default);
		border-radius: 8px;
		padding: 0.75rem;
	}
	.scan-step {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		animation: fade-in-up 0.4s ease both;
	}
	.step-text {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		font-family: var(--font-mono);
	}

	.knowledge-panel {
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border-default);
		border-radius: 8px;
		padding: 0.875rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.k-section { display: flex; flex-direction: column; gap: 0.375rem; }
	.tags { display: flex; flex-wrap: wrap; gap: 0.375rem; }
	.summary-text {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
		line-height: 1.6;
		margin: 0;
	}

	.toggle-btn {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--color-text-muted);
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border-default);
		border-radius: 6px;
		padding: 0.2rem 0.5rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.toggle-btn:hover, .toggle-btn.on {
		color: var(--color-action-primary-hover);
		border-color: color-mix(in srgb, var(--color-action-primary) 30%, transparent);
		background: color-mix(in srgb, var(--color-action-primary) 8%, transparent);
	}
</style>
