<script>
	import { toasts } from '../stores.js';
	import { Check, X, Info, AlertTriangle } from '@lucide/svelte';

	const icons = {
		success: Check,
		error: X,
		info: Info,
		warn: AlertTriangle
	};
</script>

<div class="toast-container">
	{#each $toasts as toast (toast.id)}
		<div class="toast toast-{toast.type}">
			<span class="toast-icon toast-icon-{toast.type}"><svelte:component this={icons[toast.type] || icons.info} size={11} strokeWidth={2.5} /></span>
			<span class="toast-msg">{toast.message}</span>
		</div>
	{/each}
</div>

<style>
	.toast-container {
		position: fixed;
		bottom: 1.5rem;
		right: 1.5rem;
		z-index: 200;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		pointer-events: none;
	}

	.toast {
		display: flex;
		align-items: flex-start;
		gap: 0.625rem;
		padding: 0.75rem 1rem;
		border-radius: 12px;
		min-width: 260px;
		max-width: 380px;
		font-size: 0.8125rem;
		font-weight: 500;
		border: 1px solid;
		animation: slide-in-right 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		box-shadow: 0 8px 32px color-mix(in srgb, var(--p-color-neutral-1000) 50%, transparent);
		pointer-events: auto;
		line-height: 1.4;
	}

	.toast-info {
		background: color-mix(in srgb, var(--p-color-neutral-900) 95%, transparent);
		border-color: color-mix(in srgb, var(--color-border-strong) 25%, transparent);
		color: var(--color-text-inverse);
	}
	.toast-success {
		background: color-mix(in srgb, var(--color-status-success-background) 90%, var(--p-color-neutral-950));
		border-color: color-mix(in srgb, var(--color-status-success-default) 50%, transparent);
		color: var(--p-color-success-200);
	}
	.toast-error {
		background: color-mix(in srgb, var(--color-status-danger-background) 90%, var(--p-color-neutral-950));
		border-color: color-mix(in srgb, var(--color-status-danger-default) 50%, transparent);
		color: var(--p-color-danger-200);
	}
	.toast-warn {
		background: color-mix(in srgb, var(--color-status-warning-background) 90%, var(--p-color-neutral-950));
		border-color: color-mix(in srgb, var(--color-status-warning-default) 50%, transparent);
		color: var(--p-color-warning-200);
	}

	.toast-icon {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.625rem;
		font-weight: 900;
		flex-shrink: 0;
		margin-top: 0.05rem;
	}
	.toast-icon-success { background: color-mix(in srgb, var(--color-status-success-default) 25%, transparent); color: var(--p-color-success-400); }
	.toast-icon-error   { background: color-mix(in srgb, var(--color-status-danger-default) 25%, transparent); color: var(--p-color-danger-400); }
	.toast-icon-info    { background: color-mix(in srgb, var(--color-action-primary) 25%, transparent); color: var(--p-color-blue-400); }
	.toast-icon-warn    { background: color-mix(in srgb, var(--color-status-warning-default) 25%, transparent); color: var(--p-color-warning-400); }

	.toast-msg {
		flex: 1;
	}
</style>
