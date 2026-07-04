<script>
	import { getBadgeStatusText } from '../content.js';

	let { status = 'idle', label = true } = $props();

	const statusConfig = {
		idle:        { dot: 'dot-idle',      text: 'Idle',        badge: 'badge-dim' },
		scanning:    { dot: 'dot-scanning',  text: 'Scanning',    badge: 'badge-cyan' },
		running:     { dot: 'dot-running',   text: 'Running',     badge: 'badge-blue' },
		done:        { dot: 'dot-done',      text: 'Done',        badge: 'badge-green' },
		failed:      { dot: 'dot-failed',    text: 'Failed',      badge: 'badge-red' },
		retrying:    { dot: 'dot-retrying',  text: 'Retrying',    badge: 'badge-amber' },
		validating:  { dot: 'dot-validating','text': 'Validating','badge': 'badge-purple' },
		decomposing: { dot: 'dot-running',   text: 'Decomposing', badge: 'badge-blue' },
		pending:     { dot: 'dot-idle',      text: 'Pending',     badge: 'badge-dim' },
		completed:   { dot: 'dot-done',      text: 'Completed',   badge: 'badge-green' },
		ready:            { dot: 'dot-done',     text: getBadgeStatusText('ready'),            badge: 'badge-green' },
		'partly-ready':   { dot: 'dot-retrying', text: getBadgeStatusText('partly-ready'),     badge: 'badge-amber' },
		'needs-attention':{ dot: 'dot-retrying', text: getBadgeStatusText('needs-attention'),  badge: 'badge-amber' },
		'at-risk':        { dot: 'dot-failed',   text: getBadgeStatusText('at-risk'),          badge: 'badge-red' }
	};

	const config = $derived(statusConfig[status] || statusConfig.idle);
</script>

{#if label}
	<span class="badge {config.badge} badge-dot">
		{config.text}
	</span>
{:else}
	<span class="dot {config.dot}"></span>
{/if}
