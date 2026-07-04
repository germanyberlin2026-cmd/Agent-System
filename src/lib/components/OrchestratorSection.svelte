<script>
	import { Zap, Puzzle, BrainCircuit, SearchCode, TestTube, ShieldAlert, CheckCircle2, Circle, Play, ChevronDown, Command } from '@lucide/svelte';
	import { activeProject, knowledgeCache, activeRun, runs, tasks, runLogs, addToast } from '../stores.js';
	import { runFullPipeline } from '../orchestrator.js';
	import { fetchRuns, fetchTasks, fetchRunLogs } from '../api.js';
	import { ROUTING_STRATEGIES, VALIDATION_STRATEGIES } from '../constants.js';
	import StatusBadge from './StatusBadge.svelte';

	let command = $state('');
	let routingStrategy = $state(ROUTING_STRATEGIES.RULE_BASED);
	let validationStrategy = $state(VALIDATION_STRATEGIES.SCHEMA_VALIDATION);
	let concurrency = $state(3);
	let running = $state(false);
	let showAdvanced = $state(false);
	let showHistory = $state(false);

	const strategyIcons = {
		[ROUTING_STRATEGIES.RULE_BASED]:     { icon: Zap, color: 'var(--color-role-coder)', short: 'Rule-Based' },
		[ROUTING_STRATEGIES.CLASSIFIER]:      { icon: Puzzle, color: 'var(--color-role-architect)', short: 'Classifier' },
		[ROUTING_STRATEGIES.LLM_DECISION]:    { icon: BrainCircuit, color: 'var(--color-role-orchestrator)', short: 'LLM' }
	};
	const validationIcons = {
		[VALIDATION_STRATEGIES.SCHEMA_VALIDATION]: { icon: SearchCode, color: 'var(--color-status-success-default)', short: 'Schema' },
		[VALIDATION_STRATEGIES.TEST_EXECUTION]:    { icon: TestTube, color: 'var(--color-status-warning-default)', short: 'Tests' },
		[VALIDATION_STRATEGIES.ADVERSARIAL_REVIEW]:{ icon: ShieldAlert, color: 'var(--color-status-danger-default)', short: 'Adversarial' }
	};

	async function handleRun() {
		if (!command.trim()) { addToast('Command is required', 'error'); return; }
		if (!$activeProject) { addToast('Select a project first', 'error'); return; }
		if (!$knowledgeCache) { addToast('Scan the project first', 'error'); return; }

		running = true;
		tasks.set([]);
		runLogs.set([]);
		try {
			const { run, finalOutput } = await runFullPipeline($activeProject, command.trim(), {
				routing_strategy: routingStrategy,
				validation_strategy: validationStrategy,
				concurrency
			});
			activeRun.set(run);
			const allRuns = await fetchRuns($activeProject.id);
			runs.set(allRuns);
			const allTasks = await fetchTasks(run.id);
			tasks.set(allTasks);
			const logs = await fetchRunLogs(run.id);
			runLogs.set(logs);
			addToast('Pipeline completed', 'success');
		} catch (err) {
			addToast(`Run failed: ${err.message}`, 'error');
		} finally {
			running = false;
		}
	}

	async function loadRun(run) {
		activeRun.set(run);
		const allTasks = await fetchTasks(run.id);
		tasks.set(allTasks);
		const logs = await fetchRunLogs(run.id);
		runLogs.set(logs);
	}

	function formatTime(ts) {
		if (!ts) return '';
		return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
	}

	const canRun = $derived(!!$activeProject && !!$knowledgeCache && !running);
	const notReady = $derived(!$activeProject || !$knowledgeCache);
</script>

<div class="section-block orchestrator-block">
	<div class="section-header">
		<div class="section-icon"><BrainCircuit size={16} strokeWidth={2} /></div>
		<div class="section-title">Command Center</div>
		{#if $activeRun}
			<div class="ml-auto">
				<StatusBadge status={$activeRun.status} />
			</div>
		{/if}
	</div>

	{#if notReady}
		<div class="prereq-steps">
			<div class="prereq-item {$activeProject ? 'done' : ''}">
				<span class="prereq-check">
					{#if $activeProject}
								<CheckCircle2 size={16} strokeWidth={2.5} />
					{:else}
								<Circle size={16} strokeWidth={2.5} />
					{/if}
				</span>
				<span>Select a project</span>
			</div>
			<div class="prereq-item {$knowledgeCache ? 'done' : ''}">
				<span class="prereq-check">
					{#if $knowledgeCache}
						<CheckCircle2 size={16} strokeWidth={2.5} color="var(--color-status-success-default)" />
					{:else}
						<Circle size={16} strokeWidth={2.5} color="var(--color-text-disabled)" />
					{/if}
				</span>
				<span>Scan to build knowledge cache</span>
			</div>
		</div>
	{:else}
		<!-- Command input -->
		<div class="command-area">
			<div class="command-label">
				<span class="label">Command</span>
				<span class="char-count">{command.length} chars</span>
			</div>
			<div class="command-input-wrapper">
				<textarea
					class="command-input"
					bind:value={command}
					placeholder="e.g. Build a REST API endpoint for user authentication with JWT tokens"
					rows="3"
					disabled={running}
					onkeydown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleRun(); }}
				></textarea>
				<div class="command-hint"><Command size={10} strokeWidth={2.5} style="display:inline; vertical-align:middle; margin-bottom:1px;" /> + Enter to run</div>
			</div>
		</div>

		<!-- Strategy pills -->
		<div class="strategy-row">
			<div class="strategy-group">
				<div class="strategy-group-label">Routing</div>
				<div class="strategy-pills">
					{#each Object.entries(strategyIcons) as [value, cfg]}
						<button
							class="strategy-pill {routingStrategy === value ? 'active' : ''}"
							style="--pill-color: {cfg.color}"
							onclick={() => routingStrategy = value}
						>
							<svelte:component this={cfg.icon} size={14} strokeWidth={2.5} />
							<span>{cfg.short}</span>
						</button>
					{/each}
				</div>
			</div>
			<div class="strategy-group">
				<div class="strategy-group-label">Validation</div>
				<div class="strategy-pills">
					{#each Object.entries(validationIcons) as [value, cfg]}
						<button
							class="strategy-pill {validationStrategy === value ? 'active' : ''}"
							style="--pill-color: {cfg.color}"
							onclick={() => validationStrategy = value}
						>
							<svelte:component this={cfg.icon} size={14} strokeWidth={2.5} />
							<span>{cfg.short}</span>
						</button>
					{/each}
				</div>
			</div>
		</div>

		<!-- Advanced toggle -->
		<button class="adv-toggle" onclick={() => showAdvanced = !showAdvanced}>
			<ChevronDown size={14} strokeWidth={2} style="transform: rotate({showAdvanced ? 180 : 0}deg); transition: transform 0.2s ease" />
			Advanced options
		</button>

		{#if showAdvanced}
			<div class="advanced-panel fade-in-up">
				<label class="concurrency-label">
					<span class="label">Concurrency: {concurrency} agents</span>
					<input type="range" min="1" max="8" bind:value={concurrency} class="concurrency-slider" />
				</label>
			</div>
		{/if}

		<!-- Run button -->
		<button
			class="run-btn {running ? 'running' : ''}"
			onclick={handleRun}
			disabled={!canRun}
		>
			{#if running}
				<span class="run-spinner"></span>
				<span>Running Pipeline...</span>
				<span class="run-hint">This may take a while</span>
			{:else}
				<Play size={16} strokeWidth={2.5} fill="currentColor" />
				<span>Execute Pipeline</span>
			{/if}
		</button>
	{/if}

	<!-- Run History -->
	{#if $runs.length > 0}
		<div class="history-section">
			<button class="history-toggle" onclick={() => showHistory = !showHistory}>
				<span class="label">Run History ({$runs.length})</span>
				<ChevronDown size={13} strokeWidth={2.5} style="transform: rotate({showHistory ? 180 : 0}deg); transition: transform 0.2s ease; color: var(--color-text-muted)" />
			</button>
			{#if showHistory}
				<div class="history-list fade-in">
					{#each $runs as run (run.id)}
						<button
							class="history-item {$activeRun?.id === run.id ? 'active' : ''}"
							onclick={() => loadRun(run)}
						>
							<StatusBadge status={run.status} label={false} />
							<span class="history-cmd">{run.command}</span>
							<div class="history-meta">
								<span>{formatTime(run.created_at)}</span>
								{#if run.total_tokens}
									<span class="mono">{run.total_tokens}t</span>
								{/if}
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.section-block {
		padding: 1.125rem;
		border-bottom: 1px solid var(--color-border-default);
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}
	.ml-auto { margin-left: auto; }

	/* Prereqs */
	.prereq-steps {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	.prereq-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		padding: 0.25rem 0;
	}
	.prereq-item.done { color: var(--color-text-secondary); }
	.prereq-check { display: flex; align-items: center; justify-content: center; }

	/* Command */
	.command-area { display: flex; flex-direction: column; gap: 0.375rem; }
	.command-label {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.char-count {
		font-size: 0.625rem;
		color: var(--color-text-disabled);
		font-family: var(--font-mono);
	}
	.command-input-wrapper { position: relative; }
	.command-input {
		width: 100%;
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border-default);
		border-radius: 10px;
		color: var(--color-text-primary);
		padding: 0.75rem 0.875rem;
		font-size: 0.875rem;
		font-family: var(--font-sans);
		resize: vertical;
		min-height: 80px;
		outline: none;
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
		line-height: 1.6;
	}
	.command-input:focus {
		border-color: var(--color-action-primary);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-border-fokus) 10%, transparent);
	}
	.command-input::placeholder { color: var(--color-text-disabled); }
	.command-hint {
		position: absolute;
		bottom: 0.5rem;
		right: 0.625rem;
		font-size: 0.6rem;
		font-family: var(--font-mono);
		color: var(--color-text-disabled);
		pointer-events: none;
	}

	/* Strategy pills */
	.strategy-row {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}
	.strategy-group {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.strategy-group-label {
		font-size: 0.625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-text-disabled);
	}
	.strategy-pills {
		display: flex;
		gap: 0.375rem;
	}
	.strategy-pill {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.3rem 0.625rem;
		border-radius: 7px;
		font-size: 0.7rem;
		font-weight: 500;
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border-default);
		color: var(--color-text-muted);
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.strategy-pill:hover {
		color: var(--color-text-secondary);
		border-color: var(--color-border-strong);
	}
	.strategy-pill.active {
		background: color-mix(in srgb, var(--pill-color) 12%, transparent);
		border-color: color-mix(in srgb, var(--pill-color) 35%, transparent);
		color: var(--pill-color);
	}

	/* Advanced */
	.adv-toggle {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.75rem;
		color: var(--color-text-muted);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		transition: color 0.15s ease;
	}
	.adv-toggle:hover { color: var(--color-text-secondary); }
	.advanced-panel {
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border-default);
		border-radius: 8px;
		padding: 0.75rem;
	}
	.concurrency-label {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	.concurrency-slider {
		width: 100%;
		accent-color: var(--color-action-primary);
	}

	/* Run button */
	.run-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.625rem;
		padding: 0.875rem 1.25rem;
		border-radius: 12px;
		font-size: 0.9375rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		background: linear-gradient(135deg, var(--color-action-primary) 0%, var(--color-action-primary-hover) 90%);
		color: var(--color-action-primary-text);
		border: none;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 10px 22px color-mix(in srgb, var(--color-action-primary) 20%, transparent);
		position: relative;
		overflow: hidden;
		width: 100%;
	}
	.run-btn::before {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(135deg, color-mix(in srgb, var(--color-surface-elevated) 0%, transparent) 0%, color-mix(in srgb, var(--color-surface-elevated) 6%, transparent) 50%, color-mix(in srgb, var(--color-surface-elevated) 0%, transparent) 100%);
		pointer-events: none;
	}
	.run-btn:hover:not(:disabled) {
		box-shadow: 0 10px 24px color-mix(in srgb, var(--color-action-primary) 18%, transparent);
		transform: translateY(-1px);
	}
	.run-btn:active:not(:disabled) {
		transform: translateY(0);
	}
	.run-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.run-btn.running {
		background: linear-gradient(135deg, color-mix(in srgb, var(--p-color-neutral-950) 95%, transparent) 0%, color-mix(in srgb, var(--p-color-neutral-800) 95%, transparent) 100%);
		border: 1px solid color-mix(in srgb, var(--color-border-strong) 25%, transparent);
		box-shadow: 0 0 24px color-mix(in srgb, var(--p-color-neutral-950) 14%, transparent);
		animation: none;
	}
	.run-icon { font-size: 1rem; }
	.run-hint {
		font-size: 0.7rem;
		font-weight: 400;
		opacity: 0.7;
		margin-left: auto;
	}
	.run-spinner {
		width: 16px;
		height: 16px;
		border: 2px solid color-mix(in srgb, var(--color-action-primary-text) 35%, transparent);
		border-top-color: color-mix(in srgb, var(--color-action-primary-text) 95%, transparent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		flex-shrink: 0;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	/* History */
	.history-section {
		border-top: 1px solid var(--color-border-default);
		padding-top: 0.75rem;
	}
	.history-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
	}
	.history-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-top: 0.5rem;
		max-height: 220px;
		overflow-y: auto;
	}
	.history-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.625rem;
		border-radius: 8px;
		background: transparent;
		border: 1px solid transparent;
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: left;
		width: 100%;
	}
	.history-item:hover {
		background: var(--color-surface-subtle);
		border-color: var(--color-border-default);
	}
	.history-item.active {
		background: color-mix(in srgb, var(--color-action-primary) 6%, transparent);
		border-color: color-mix(in srgb, var(--color-action-primary) 20%, transparent);
	}
	.history-cmd {
		flex: 1;
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.history-meta {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-shrink: 0;
		font-size: 0.7rem;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
	}
	.mono { font-family: var(--font-mono); }
</style>
