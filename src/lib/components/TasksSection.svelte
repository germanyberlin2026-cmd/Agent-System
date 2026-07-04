<script>
	import { Zap, Activity, RotateCw, Check, ShieldCheck, Package, ClipboardList, FileText } from '@lucide/svelte';
	import { tasks, taskLogs, runLogs, activeRun, knowledgeCache, selectedTaskId, activeTask, addToast } from '../stores.js';
	import { fetchTaskLogs, fetchTasks, addTaskLog, updateTask } from '../api.js';
	import { executeTask } from '../orchestrator.js';
	import StatusBadge from './StatusBadge.svelte';

	$effect(() => {
		if ($selectedTaskId) loadTaskLogs($selectedTaskId);
	});

	async function loadTaskLogs(taskId) {
		const logs = await fetchTaskLogs(taskId);
		taskLogs.set({ ...$taskLogs, [taskId]: logs });
	}

	async function handleRetry(task) {
		try {
			await updateTask(task.id, { status: 'idle', error_message: null, retry_count: 0 });
			await addTaskLog(task.id, 'info', 'Manual retry triggered');
			await executeTask({ ...task, status: 'idle', retry_count: 0, error_message: null }, $activeRun, $knowledgeCache);
			tasks.set(await fetchTasks($activeRun.id));
			addToast('Task retry completed', 'success');
		} catch (err) {
			addToast(`Failed to retry: ${err.message}`, 'error');
		}
	}

	function formatTime(ts) {
		if (!ts) return '';
		return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}

	function formatCost(cost) {
		return parseFloat(cost || 0).toFixed(4);
	}

	const totalTokens = $derived($tasks.reduce((sum, t) => sum + (t.tokens_used || 0), 0));
	const totalCost   = $derived($tasks.reduce((sum, t) => sum + (parseFloat(t.cost) || 0), 0));
	const doneCount   = $derived($tasks.filter(t => t.status === 'done').length);
	const failedCount = $derived($tasks.filter(t => t.status === 'failed').length);
	const runningCount = $derived($tasks.filter(t => t.status === 'running' || t.status === 'retrying').length);

	const statusOrder = { running: 0, retrying: 1, idle: 2, done: 3, failed: 4 };
	const sortedTasks = $derived([...$tasks].sort((a, b) => (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5)));
</script>

{#if $tasks.length === 0}
	<div class="card empty-state">
		<div class="empty-state-icon"><Zap size={40} strokeWidth={1.5} /></div>
		<div class="empty-state-title">Pipeline ready</div>
		<div class="empty-state-desc">Execute a pipeline from the Command Center. Tasks will appear here in real-time.</div>
	</div>
{:else}
	<!-- Pipeline Monitor -->
	<div class="pipeline-monitor card">
		<div class="monitor-header">
			<div class="monitor-title">
				<Activity size={16} strokeWidth={2} />
				<span>Pipeline Monitor</span>
			</div>
			<div class="monitor-stats">
				{#if runningCount > 0}
					<span class="stat-chip running">
						<span class="dot dot-running"></span>
						{runningCount} running
					</span>
				{/if}
				<span class="stat-chip done">{doneCount}/{$tasks.length} done</span>
				{#if failedCount > 0}
					<span class="stat-chip failed">{failedCount} failed</span>
				{/if}
				{#if totalTokens > 0}
					<span class="stat-chip mono">{totalTokens.toLocaleString()}t</span>
				{/if}
				{#if totalCost > 0}
					<span class="stat-chip mono green">${totalCost.toFixed(4)}</span>
				{/if}
			</div>
		</div>

		<!-- Task list -->
		<div class="task-list">
			{#each sortedTasks as task (task.id)}
				<div
					class="task-row {$selectedTaskId === task.id ? 'selected' : ''} status-{task.status}"
					role="button"
					tabindex="0"
					onclick={() => selectedTaskId.set(task.id)}
					onkeydown={(e) => { if (e.key === 'Enter') selectedTaskId.set(task.id); }}
				>
					<div class="task-left">
						<span class="dot dot-{task.status}"></span>
						<div class="task-text">
							<div class="task-title">{task.title}</div>
							{#if task.error_message}
								<div class="task-error">{task.error_message}</div>
							{/if}
							{#if task.retry_count > 0}
								<div class="task-meta-text amber"><RotateCw size={11} strokeWidth={2.5} class="inline-icon" /> Retried {task.retry_count}×</div>
							{/if}
							{#if task.output_payload?.execution?.evidence?.length > 0}
								<div class="task-meta-text green"><Check size={11} strokeWidth={2.5} class="inline-icon" /> {task.output_payload.execution.evidence.length} file(s) changed</div>
							{/if}
						</div>
					</div>
					<div class="task-right">
						{#if task.tokens_used > 0}
							<span class="task-tokens">{task.tokens_used.toLocaleString()}t</span>
						{/if}
						{#if task.cost > 0}
							<span class="task-cost">${formatCost(task.cost)}</span>
						{/if}
						{#if task.status === 'failed'}
							<button
								class="btn btn-ghost btn-sm"
								style="padding: 0.2rem 0.5rem; font-size: 0.7rem; gap: 0.25rem"
								onclick={(e) => { e.stopPropagation(); handleRetry(task); }}
							>
								<RotateCw size={11} strokeWidth={2} /> Retry
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Validation Gate -->
	{#if $activeRun?.status === 'validating' || $activeRun?.final_output}
		<div class="card validation-card fade-in-up">
			<div class="monitor-title">
				<ShieldCheck size={16} strokeWidth={2} />
				<span>Validation Gate</span>
			</div>
			<div class="val-content">
				{#if $activeRun.status === 'validating'}
					<div class="validating-state">
						<span class="dot dot-validating"></span>
						<span>Running validation checks...</span>
					</div>
				{:else if $activeRun.final_output}
					<div class="val-result">
						{#if $activeRun.final_output.validation_passed}
							<span class="badge badge-green badge-dot">Passed</span>
						{:else}
							<span class="badge badge-red badge-dot">Failed</span>
						{/if}
						<span class="val-summary">{$activeRun.final_output.summary || ''}</span>
						<span class="badge badge-dim">{$activeRun.validation_strategy}</span>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Output summary -->
	{#if $activeRun?.final_output}
		<div class="card output-card fade-in-up">
			<div class="monitor-header">
				<div class="monitor-title">
					<Package size={16} strokeWidth={2} />
					<span>Run Output</span>
				</div>
				<StatusBadge status={$activeRun.status} />
			</div>

			<div class="metrics-grid">
				<div class="metric-card">
					<div class="metric-label">Total Tasks</div>
					<div class="metric-value">{$activeRun.final_output.total_tasks}</div>
				</div>
				<div class="metric-card">
					<div class="metric-label">Completed</div>
					<div class="metric-value" style="color: var(--color-status-success-default)">{$activeRun.final_output.completed}</div>
				</div>
				<div class="metric-card">
					<div class="metric-label">Tokens</div>
					<div class="metric-value">{$activeRun.total_tokens?.toLocaleString() || 0}</div>
				</div>
				<div class="metric-card">
					<div class="metric-label">Cost</div>
					<div class="metric-value" style="color: var(--color-status-success-default)">${parseFloat($activeRun.total_cost || 0).toFixed(4)}</div>
				</div>
			</div>

			{#if $activeRun.final_output.failed_tasks?.length > 0}
				<div class="failed-section">
					<div class="label">Failed Tasks</div>
					{#each $activeRun.final_output.failed_tasks as ft}
						<div class="failed-item">
							<span class="badge badge-red">{ft.title}</span>
							<span class="failed-error">{ft.error}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Task Detail -->
	{#if $activeTask}
		<div class="card task-detail-card fade-in-up">
			<div class="monitor-header">
				<div class="monitor-title">
					<ClipboardList size={16} strokeWidth={2} />
					<span>Task Detail</span>
				</div>
				<StatusBadge status={$activeTask.status} />
			</div>

			<div class="detail-body">
				<div class="detail-field">
					<div class="label">Title</div>
					<div class="detail-value">{$activeTask.title}</div>
				</div>

				{#if $activeTask.description}
					<div class="detail-field">
						<div class="label">Description</div>
						<div class="detail-value dim">{$activeTask.description}</div>
					</div>
				{/if}

				{#if $activeTask.output_payload}
					<div class="detail-field">
						<div class="label">Output</div>
						<pre class="code-block">{JSON.stringify($activeTask.output_payload, null, 2)}</pre>
					</div>
				{/if}

				<!-- Task Logs -->
				<div class="detail-field">
					<div class="label">Task Logs</div>
					<div class="terminal" style="max-height: 200px;">
						{#each $taskLogs[$activeTask.id] || [] as log (log.id)}
							<div class="log-line">
								<span class="log-time">{formatTime(log.created_at)}</span>
								<span class="log-{log.level}">{log.message}</span>
							</div>
						{:else}
							<div class="log-line"><span class="log-info">No logs yet</span></div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Run Logs -->
	{#if $runLogs.length > 0}
		<div class="card run-logs-card">
			<div class="monitor-title">
				<FileText size={16} strokeWidth={2} />
				<span>Run Logs</span>
				<span class="log-count">{$runLogs.length}</span>
			</div>
			<div class="terminal" style="max-height: 240px; margin-top: 0.75rem;">
				{#each $runLogs as log (log.id)}
					<div class="log-line">
						<span class="log-time">{formatTime(log.created_at)}</span>
						<span class="log-{log.level}">{log.message}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
{/if}

<style>
	.card {
		background: var(--color-surface-elevated);
		border: 1px solid var(--color-border-default);
		border-radius: 14px;
		overflow: hidden;
	}

	/* Monitor header */
	.monitor-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.875rem 1rem;
		border-bottom: 1px solid var(--color-border-default);
		background: color-mix(in srgb, var(--color-surface-elevated) 1.5%, transparent);
	}
	.monitor-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--color-text-primary);
		letter-spacing: -0.02em;
	}
	.log-count {
		font-size: 0.65rem;
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border-default);
		padding: 0.1rem 0.4rem;
		border-radius: 100px;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		margin-left: 0.25rem;
	}

	/* Monitor stats */
	.monitor-stats {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-wrap: wrap;
	}
	.stat-chip {
		font-size: 0.675rem;
		font-weight: 600;
		padding: 0.2rem 0.5rem;
		border-radius: 100px;
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border-default);
		color: var(--color-text-secondary);
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.stat-chip.running { color: var(--color-action-primary-hover); border-color: color-mix(in srgb, var(--color-action-primary) 20%, transparent); background: color-mix(in srgb, var(--color-action-primary) 8%, transparent); }
	.stat-chip.done    { color: var(--color-status-success-default); border-color: color-mix(in srgb, var(--color-status-success-default) 20%, transparent); background: color-mix(in srgb, var(--color-status-success-default) 8%, transparent); }
	.stat-chip.failed  { color: var(--color-status-danger-default);  border-color: color-mix(in srgb, var(--color-status-danger-default) 20%, transparent);  background: color-mix(in srgb, var(--color-status-danger-default) 8%, transparent); }
	.stat-chip.mono    { font-family: var(--font-mono); }
	.stat-chip.green   { color: var(--color-status-success-default); }

	/* Task list */
	.task-list {
		display: flex;
		flex-direction: column;
		gap: 0;
	}
	.task-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-border-default);
		cursor: pointer;
		transition: background 0.15s ease;
	}
	.task-row:last-child { border-bottom: none; }
	.task-row:hover { background: color-mix(in srgb, var(--color-surface-elevated) 2%, transparent); }
	.task-row.selected { background: color-mix(in srgb, var(--color-action-primary) 5%, transparent); }
	.task-row.status-running { background: color-mix(in srgb, var(--color-action-primary) 3%, transparent); }
	.task-row.status-failed  { background: color-mix(in srgb, var(--color-status-danger-default) 2%, transparent); }

	.task-left {
		display: flex;
		align-items: flex-start;
		gap: 0.625rem;
		flex: 1;
		min-width: 0;
	}
	.task-left .dot { margin-top: 0.3rem; flex-shrink: 0; }
	.task-text { flex: 1; min-width: 0; }
	.task-title {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text-primary);
		line-height: 1.4;
	}
	.task-error {
		font-size: 0.72rem;
		color: var(--color-status-danger-default);
		font-family: var(--font-mono);
		margin-top: 0.25rem;
		background: color-mix(in srgb, var(--color-status-danger-default) 7%, transparent);
		padding: 0.2rem 0.4rem;
		border-radius: 4px;
	}
	.task-meta-text {
		font-size: 0.7rem;
		margin-top: 0.2rem;
		display: flex;
		align-items: center;
		gap: 0.2rem;
	}
	.task-meta-text.amber { color: var(--color-status-warning-default); }
	.task-meta-text.green { color: var(--color-status-success-default); }

	.task-right {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-shrink: 0;
	}
	.task-tokens {
		font-size: 0.7rem;
		font-family: var(--font-mono);
		color: var(--color-text-muted);
	}
	.task-cost {
		font-size: 0.7rem;
		font-family: var(--font-mono);
		color: var(--color-status-success-default);
	}

	/* Validation */
	.validation-card, .output-card, .task-detail-card, .run-logs-card {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}
	.validating-state {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}
	.val-result {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		flex-wrap: wrap;
	}
	.val-summary {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
		flex: 1;
	}

	/* Metrics grid */
	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
	}

	/* Failed section */
	.failed-section {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	.failed-item {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		font-size: 0.8125rem;
	}
	.failed-error {
		color: var(--color-status-danger-default);
		font-size: 0.75rem;
	}

	/* Detail */
	.detail-body {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}
	.detail-field { display: flex; flex-direction: column; gap: 0.25rem; }
	.detail-value {
		font-size: 0.8125rem;
		color: var(--color-text-primary);
		line-height: 1.5;
	}
	.detail-value.dim { color: var(--color-text-secondary); }
</style>
