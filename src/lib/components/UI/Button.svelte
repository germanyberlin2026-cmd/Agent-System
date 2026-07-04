<script>
  let { children, onclick, variant = 'primary' } = $props();
  const base = "px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 active:scale-95";
  const styles = variant === 'primary' 
    ? "bg-black text-white hover:bg-gray-800 shadow-sm" 
    : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm";
</script>

<button class="{base} {styles}" {onclick}>
  {@render children()}
</button>