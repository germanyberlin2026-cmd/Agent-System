<script>
	let { children, onclick, variant = 'primary', disabled = false } = $props();
</script>

<button
	class="px-4 py-2 rounded-lg font-medium text-sm transition-all active:scale-95 shadow-sm border border-transparent flex items-center justify-center gap-2"
	class:bg-black={variant === 'primary'}
	class:text-white={variant === 'primary'}
	class:bg-white={variant === 'secondary'}
	class:text-black={variant === 'secondary'}
	class:border-gray-200={variant === 'secondary'}
	class:opacity-50={disabled}
	{onclick}
	{disabled}
>
	{@render children?.()}
</button>