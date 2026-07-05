<script>
	import * as Lucide from '@lucide/svelte';

	let { name, size = 16, strokeWidth = 1.75, class: className = '' } = $props();

	const iconComponent = $derived(Lucide[toPascalCase(name)] || Lucide.Bot);
	function toPascalCase(str) {
		return (str || '').split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
	}
</script>

<svelte:component this={iconComponent} {size} {strokeWidth} class={className} />
