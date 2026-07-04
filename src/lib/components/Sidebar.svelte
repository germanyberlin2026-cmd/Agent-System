<script>
	import { Layers, Users, KeyRound, Wrench, Bot } from '@lucide/svelte';

	let { activeTab = $bindable('workflow'), agentCount = 0, keyCount = 0, projectCount = 0, hasActiveRun = false } = $props();

	const navItems = [
		{
			id: 'workflow',
			icon: Layers,
			label: 'Workflow',
			color: 'var(--color-role-architect)'
		},
		{
			id: 'agents',
			icon: Users,
			label: 'Agents',
			badge: agentCount > 0 ? agentCount : null,
			color: 'var(--color-role-orchestrator)'
		},
		{
			id: 'keys',
			icon: KeyRound,
			label: 'API Keys',
			badge: keyCount > 0 ? keyCount : null,
			color: 'var(--color-role-coder)'
		},
		{
			id: 'skills',
			icon: Wrench,
			label: 'Skills',
			color: 'var(--color-role-tester)'
		}
	];
</script>

<aside class="sidebar">
	<!-- Logo -->
	<div class="sidebar-logo">
		<div class="logo-icon">
			<Bot size={17} strokeWidth={1.6} />
		</div>
		<div class="logo-text">
			<span class="logo-name">Kceva</span>
			<span class="logo-tagline">Agent OS</span>
		</div>
	</div>

	<!-- Status pill -->
	{#if hasActiveRun}
		<div class="sidebar-status">
			<span class="dot dot-running"></span>
			<span>Running</span>
		</div>
	{:else}
		<div class="sidebar-status idle">
			<span class="dot dot-live"></span>
			<span>Ready</span>
		</div>
	{/if}

	<!-- Nav -->
	<nav class="sidebar-nav">
		{#each navItems as item}
			<button
				class="nav-item {activeTab === item.id ? 'active' : ''}"
				onclick={() => activeTab = item.id}
				title={item.label}
			>
				<span class="nav-icon">
					<svelte:component this={item.icon} size={15} strokeWidth={1.75} />
				</span>
				<span class="nav-label">{item.label}</span>
				{#if item.badge}
					<span class="nav-badge">{item.badge}</span>
				{/if}
			</button>
		{/each}
	</nav>

	<!-- Bottom stats -->
	<div class="sidebar-footer">
		<div class="stat-row">
			<div class="stat">
				<div class="stat-val">{agentCount}</div>
				<div class="stat-key">agents</div>
			</div>
			<div class="stat">
				<div class="stat-val">{projectCount}</div>
				<div class="stat-key">projects</div>
			</div>
			<div class="stat">
				<div class="stat-val">{keyCount}</div>
				<div class="stat-key">keys</div>
			</div>
		</div>
	</div>
</aside>

<style>
	.sidebar {
		width: 196px;
		min-width: 196px;
		height: 100vh;
		position: sticky;
		top: 0;
		background: color-mix(in srgb, var(--color-surface-elevated) 94%, transparent);
		border-right: 1px solid var(--color-border-default);
		display: flex;
		flex-direction: column;
		padding: 1.125rem 0;
		gap: 0;
		z-index: 30;
		backdrop-filter: blur(24px);
		-webkit-backdrop-filter: blur(24px);
	}

	.sidebar-logo {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0 1rem 1.125rem;
		border-bottom: 1px solid var(--color-border-default);
		margin-bottom: 0.75rem;
	}
	.logo-icon {
		width: 30px;
		height: 30px;
		border-radius: 9px;
		background: color-mix(in srgb, var(--color-border-strong) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-border-strong) 18%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.logo-text {
		display: flex;
		flex-direction: column;
		line-height: 1.1;
	}
	.logo-name {
		font-size: 0.9375rem;
		font-weight: 700;
		color: var(--color-text-primary);
		letter-spacing: -0.03em;
		font-family: var(--font-heading);
	}
	.logo-tagline {
		font-size: 0.6rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--color-text-muted);
		margin-top: 0.1rem;
	}

	.sidebar-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-status-success-default);
		padding: 0.3rem 0.75rem;
		margin: 0 0.625rem 0.75rem;
		border-radius: 100px;
		background: color-mix(in srgb, var(--color-status-success-default) 7%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-status-success-default) 13%, transparent);
		transition: all 0.2s ease;
	}
	.sidebar-status.idle {
		color: var(--color-text-muted);
		background: color-mix(in srgb, var(--color-surface-elevated) 2%, transparent);
		border-color: var(--color-border-default);
	}

	.sidebar-nav {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		padding: 0 0.5rem;
		overflow-y: auto;
		scrollbar-width: none;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 0.5625rem;
		padding: 0.5625rem 0.75rem;
		border-radius: 10px;
		border: 1px solid transparent;
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: all 0.18s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		font-size: 0.8125rem;
		font-weight: 500;
		text-align: left;
		width: 100%;
		position: relative;
		letter-spacing: -0.01em;
	}
	.nav-item:hover {
		color: var(--color-text-secondary);
		background: color-mix(in srgb, var(--color-surface-elevated) 4%, transparent);
		border-color: var(--color-border-default);
	}
	.nav-item.active {
		color: var(--color-text-primary);
		background: color-mix(in srgb, var(--color-action-primary) 9%, transparent);
		border-color: color-mix(in srgb, var(--color-action-primary) 18%, transparent);
	}
	.nav-icon {
		width: 16px;
		height: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: color 0.18s ease;
		color: currentColor;
	}
	.nav-label {
		flex: 1;
	}
	.nav-badge {
		background: color-mix(in srgb, var(--color-action-primary) 18%, transparent);
		color: var(--color-action-primary-hover);
		font-size: 0.625rem;
		font-weight: 700;
		padding: 0.1rem 0.375rem;
		border-radius: 100px;
		min-width: 18px;
		text-align: center;
	}

	.sidebar-footer {
		padding: 0.75rem 0.75rem 0;
		border-top: 1px solid var(--color-border-default);
		margin-top: 0.5rem;
	}
	.stat-row {
		display: flex;
		gap: 0;
	}
	.stat {
		flex: 1;
		text-align: center;
		padding: 0.5rem 0.25rem;
	}
	.stat-val {
		font-size: 0.875rem;
		font-weight: 700;
		font-family: var(--font-mono);
		color: var(--color-text-primary);
	}
	.stat-key {
		font-size: 0.6rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-disabled);
		margin-top: 0.1rem;
	}
</style>
