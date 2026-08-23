<script>
	/**
	 * Оболочка подстраницы профиля: ссылка назад, заголовок, полоса вкладок
	 * и прокручиваемый список. Одна на все разделы профиля сайта — закладки,
	 * оценки, историю и коллекции.
	 */
	import Icon from './Icon.svelte';

	export let backHref;
	export let title;
</script>

<svelte:head><title>{title} — AniShiki</title></svelte:head>
<div class="page">
	<a class="back" href={backHref}><Icon name="back" size={18} /> Профиль</a>
	<h1>{title}</h1>
	<slot name="tabs" />
	<div class="list"><slot /></div>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		height: 100%;
		max-width: 1500px;
		margin: 0 auto;
		padding: 20px 24px 0;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--secondary-text-color);
		font-size: 14px;
		margin-bottom: 12px;
	}
	h1 {
		font-size: 28px;
		font-weight: 800;
		margin-bottom: 16px;
	}
	.list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding-bottom: 24px;
	}
	/* Вкладки размечает страница, поэтому до них нужен :global. */
	.page :global(.tabs) {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		margin-bottom: 18px;
	}
	.page :global(.tab) {
		white-space: nowrap;
		padding: 9px 16px;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
		color: var(--secondary-text-color);
		border-radius: 11px;
		cursor: pointer;
		font-weight: 600;
		font-size: 13px;
	}
	.page :global(.tab.active) {
		background: var(--primary-color);
		color: #fff;
		border-color: transparent;
	}
	@media (max-width: 768px) {
		.page {
			padding: 14px 12px 0;
		}
		h1 {
			font-size: 22px;
		}
	}
</style>
