<script>
	export let w = '100%';
	export let h = '1rem';
	export let radius = '8px';
	export let aspect = null;
</script>

<div
	class="skeleton"
	style="width:{w};{aspect ? `aspect-ratio:${aspect};` : `height:${h};`}border-radius:{radius}"
></div>
