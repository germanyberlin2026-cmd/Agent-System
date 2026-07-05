<script>
	import { Search, Network, PenTool, Code2, TestTube, Microscope, FileText, Bug, Bot } from '@lucide/svelte';
	import Icon from './UI/Icon.svelte';
	import StatusBadge from './StatusBadge.svelte';
	import { ROLE_ICONS } from '../constants.js';

	let { agents = [], tasks = [], activeRun = null, activeProject = null, selectedTaskId = null, onSelectTask = null } = $props();

	const tasksByAgent = $derived.by(() => {
		const map = {};
		for (const task of tasks) {
			if (!map[task.agent_id]) map[task.agent_id] = [];
			map[task.agent_id].push(task);
		}
		return map;
	});

	function agentStatus(agentId) {
		const agent = agents.find(a => a.id === agentId);
		if (agent?.role === 'scanner') {
			if (activeProject?.scan_status === 'scanning') return 'running';
			if (activeProject?.scan_status === 'done') return 'done';
			if (activeProject?.scan_status === 'failed') return 'failed';
		}
		if (agent?.role === 'orchestrator' && activeRun) {
			if (activeRun.status === 'pending' || activeRun.status === 'decomposing') return 'running';
			return activeRun.status === 'failed' ? 'failed' : 'done';
		}
		const agentTasks = tasks.filter(t => t.agent_id === agentId);
		if (agentTasks.length === 0) return 'idle';
		if (agentTasks.some(t => t.status === 'running' || t.status === 'retrying')) return 'running';
		if (agentTasks.some(t => t.status === 'failed')) return 'failed';
		if (agentTasks.every(t => t.status === 'done')) return 'done';
		return 'idle';
	}

	function isAgentActive(agentId) {
		return tasks.some(t => t.agent_id === agentId && (t.status === 'running' || t.status === 'retrying'));
	}

	function getTaskProgress(agentId) {
		const agentTasks = tasks.filter(t => t.agent_id === agentId);
		if (agentTasks.length === 0) return null;
		const done = agentTasks.filter(t => t.status === 'done').length;
		return { done, total: agentTasks.length, pct: Math.round((done / agentTasks.length) * 100) };
	}

	const roleConfig = {
		scanner:      { icon: Search,     color: 'var(--color-role-scanner)',      label: 'Scanner' },
		orchestrator: { icon: Network,    color: 'var(--color-role-orchestrator)', label: 'Orchestrator' },
		architect:    { icon: PenTool,    color: 'var(--color-role-architect)',    label: 'Architect' },
		coder:        { icon: Code2,      color: 'var(--color-role-coder)',        label: 'Coder' },
		tester:       { icon: TestTube,   color: 'var(--color-role-tester)',       label: 'Tester' },
		reviewer:     { icon: Microscope, color: 'var(--color-role-reviewer)',     label: 'Reviewer' },
		documenter:   { icon: FileText,   color: 'var(--color-role-documenter)',   label: 'Documenter' },
		debugger:     { icon: Bug,        color: 'var(--color-role-debugger)',     label: 'Debugger' }
	};

	function getRoleCfg(role) {
		return roleConfig[role] || { icon: Code2, color: 'var(--color-role-architect)', label: role };
	}
</script>

<div class="agent-network">
	<div class="network-header">
		<div class="header-left">
			<span class="net-icon"><Network size={16} strokeWidth={2} /></span>
			<span class="net-title">Agent Network</span>
		</div>
		<div class="header-right">
			<span class="agent-count">{agents.length} agents</span>
			{#if tasks.length > 0}
				<span class="task-count">{tasks.filter(t => t.status === 'done').length}/{tasks.length} tasks</span>
			{/if}
		</div>
	</div>

	{#if agents.length === 0}
		<div class="empty-state">
			<div class="empty-state-icon"><Bot size={40} strokeWidth={1.5} /></div>
			<div class="empty-state-title">No agents configured</div>
			<div class="empty-state-desc">Go to the Agents tab to create and configure your AI agents</div>
		</div>
	{:else}
		<div class="agent-grid">
			{#each agents as agent (agent.id)}
				{@const status = agentStatus(agent.id)}
				{@const active = isAgentActive(agent.id)}
				{@const agentTasks = tasks.filter(t => t.agent_id === agent.id)}
				{@const progress = getTaskProgress(agent.id)}
				{@const roleCfg = getRoleCfg(agent.role)}

				<div class="agent-card {active ? 'active' : ''} {status === 'done' ? 'done' : ''} {status === 'failed' ? 'failed' : ''}">
					{#if active}
						<div class="active-ring-outer"></div>
					{/if}

					<div class="agent-top">
						<div class="agent-avatar" style="background: color-mix(in srgb, {roleCfg.color} 12%, transparent); border-color: color-mix(in srgb, {roleCfg.color} 25%, transparent)">
						<span class="avatar-icon" style="color: {roleCfg.color}">
							{#if agent.icon && agent.icon !== ROLE_ICONS[agent.role]}
								<Icon name={agent.icon} size={15} strokeWidth={1.75} />
							{:else}
								<svelte:component this={roleCfg.icon} size={15} strokeWidth={1.75} />
							{/if}
						</span>
						{#if active}
							<span class="avatar-pulse" style="background: {roleCfg.color}"></span>
						{/if}
					</div>
						<div class="agent-info">
							<div class="agent-name">{agent.name}</div>
							<div class="agent-role">{agent.role}</div>
						</div>
						<div class="agent-status">
							<StatusBadge {status} label={true} />
						</div>
					</div>

					{#if progress}
						<div class="agent-progress">
							<div class="progress-bar">
								<div class="progress-fill {status === 'done' ? 'green' : ''}" style="width: {progress.pct}%"></div>
							</div>
							<span class="progress-text">{progress.done}/{progress.total}</span>
						</div>
					{/if}

					{#if agentTasks.length > 0}
						<div class="task-list">
							{#each agentTasks as task (task.id)}
								<button
									class="task-chip {selectedTaskId === task.id ? 'selected' : ''} status-{task.status}"
									onclick={() => onSelectTask?.(task.id)}
								>
									<span class="dot dot-{task.status}"></span>
									<span class="task-chip-title">{task.title}</span>
									{#if task.tokens_used > 0}
										<span class="task-tokens">{task.tokens_used}t</span>
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.agent-network {
		background: var(--color-surface-elevated);
		border: 1px solid var(--color-border-default);
		border-radius: 14px;
		overflow: hidden;
	}

	.network-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.875rem 1rem;
		border-bottom: 1px solid var(--color-border-default);
		background: color-mix(in srgb, var(--color-surface-elevated) 1.5%, transparent);
	}
	.header-left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.net-icon { font-size: 1rem; }
	.net-title {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--color-text-primary);
		letter-spacing: -0.02em;
	}
	.header-right {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.agent-count, .task-count {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
	}
	.task-count { color: var(--color-action-primary-hover); }

	.agent-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 0.625rem;
		padding: 0.875rem;
	}

	.agent-card {
		position: relative;
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border-default);
		border-radius: 12px;
		padding: 0.875rem;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		transition: all 0.2s ease;
		overflow: hidden;
	}
	.agent-card:hover {
		border-color: var(--color-border-inverse);
		background: var(--color-surface-elevated);
	}
	.agent-card.active {
		border-color: color-mix(in srgb, var(--color-action-primary) 40%, transparent);
		background: color-mix(in srgb, var(--color-action-primary) 4%, transparent);
	}
	.agent-card.done {
		border-color: color-mix(in srgb, var(--color-status-success-default) 20%, transparent);
	}
	.agent-card.failed {
		border-color: color-mix(in srgb, var(--color-status-danger-default) 25%, transparent);
	}

	/* Animated active ring */
	.active-ring-outer {
		position: absolute;
		inset: -1px;
		border-radius: inherit;
		background: conic-gradient(
			from var(--angle, 0deg),
			transparent 0%,
			transparent 65%,
			color-mix(in srgb, var(--color-action-primary) 80%, transparent) 82%,
			var(--color-action-primary-hover) 90%,
			transparent 100%
		);
		-webkit-mask:
			linear-gradient(#fff 0 0) content-box,
			linear-gradient(#fff 0 0);
		-webkit-mask-composite: xor;
		mask-composite: exclude;
		padding: 1px;
		animation: spin-border 2.5s linear infinite;
		pointer-events: none;
	}

	/* Agent top row */
	.agent-top {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}
	.agent-avatar {
		width: 36px;
		height: 36px;
		border-radius: 10px;
		border: 1px solid;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		flex-shrink: 0;
	}
	.avatar-icon {
		display: flex;
		align-items: center;
		justify-content: center;
	}.avatar-pulse {
		position: absolute;
		top: -2px;
		right: -2px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: 1.5px solid var(--color-surface-subtle);
		animation: dot-pulse 1.2s ease-in-out infinite;
	}
	.agent-info {
		flex: 1;
		min-width: 0;
	}
	.agent-name {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.agent-role {
		font-size: 0.675rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-top: 0.1rem;
	}
	.agent-status { flex-shrink: 0; }

	/* Progress */
	.agent-progress {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.agent-progress .progress-bar { flex: 1; }
	.progress-text {
		font-size: 0.65rem;
		font-family: var(--font-mono);
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	/* Task chips */
	.task-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.task-chip {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.3rem 0.5rem;
		border-radius: 7px;
		background: transparent;
		border: 1px solid transparent;
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: left;
		width: 100%;
	}
	.task-chip:hover {
		background: color-mix(in srgb, var(--color-surface-elevated) 4%, transparent);
		border-color: var(--color-border-default);
	}
	.task-chip.selected {
		background: color-mix(in srgb, var(--color-action-primary) 8%, transparent);
		border-color: color-mix(in srgb, var(--color-action-primary) 25%, transparent);
	}
	.task-chip-title {
		flex: 1;
		font-size: 0.72rem;
		color: var(--color-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 1.3;
	}
	.task-tokens {
		font-size: 0.625rem;
		font-family: var(--font-mono);
		color: var(--color-text-muted);
		flex-shrink: 0;
	}
</style>
