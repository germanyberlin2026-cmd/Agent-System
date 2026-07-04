<script>
	let { children, className = '' } = $props();
</script>

<div class="bg-white rounded-xl border border-gray-200 shadow-sm p-6 {className}">
	{@render children?.()}
</div>