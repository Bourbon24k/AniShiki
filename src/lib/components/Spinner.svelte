<script>
	export let size = 40;
	export let center = false;
	export let label = '';
</script>

<div class="wrap" class:center>
	<div class="spinner" style="width:{size}px;height:{size}px"></div>
	{#if label}<p>{label}</p>{/if}
</div>

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}
	.center {
		padding: 60px 20px;
		justify-content: center;
	}
	.spinner {
		border: 3px solid var(--glass-border);
		border-top-color: var(--primary-color);
		border-radius: 50%;
		animation: spin 0.9s linear infinite;
	}
	p {
		color: var(--secondary-text-color);
		font-size: 14px;
	}
</style>
