<script>
	import { toast } from '$lib/stores';
	import { fly } from 'svelte/transition';
	$: t = $toast;
</script>

{#if t}
	{#key t.id}
		<div class="toast {t.type}" transition:fly={{ y: 30, duration: 250 }}>
			{t.message}
		</div>
	{/key}
{/if}

<style>
	.toast {
		position: fixed;
		left: 50%;
		bottom: 24px;
		transform: translateX(-50%);
		z-index: 5000;
		max-width: 90vw;
		padding: 12px 18px;
		border-radius: 12px;
		font-size: 14px;
		font-weight: 500;
		color: #fff;
		background: var(--elevated-color);
		border: 1px solid var(--glass-border);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
	}
	.toast.success {
		background: var(--watching-color);
	}
	.toast.error {
		background: var(--danger-color);
	}
	.toast.info {
		background: var(--info-color);
	}
	@media (max-width: 768px) {
		.toast {
			bottom: calc(74px + env(safe-area-inset-bottom, 0));
		}
	}
</style>
