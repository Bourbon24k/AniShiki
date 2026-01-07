<script>
    export let src = '';
    export let size = { width: 24, height: 24 };
    export let color = 'currentColor';
    export let className = '';
</script>

<span 
    class="icon {className}"
    style="width: {size.width}px; height: {size.height}px; color: {color};"
>
    {@html src}
</span>

<style>
    .icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }
    
    .icon :global(svg) {
        width: 100%;
        height: 100%;
        fill: currentColor;
    }
</style>
