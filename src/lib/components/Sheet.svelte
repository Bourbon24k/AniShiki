<script>
	/**
	 * Нижняя «шторка» в духе iOS: выезжает снизу, тянется пальцем, закрывается
	 * свайпом вниз или тапом по фону. Используется для фильтров и настроек —
	 * на телефоне это привычнее модального окна по центру.
	 */
	import { createEventDispatcher, onDestroy } from 'svelte';
	import { haptic } from '$lib/ios';
	import Icon from './Icon.svelte';

	export let open = false;
	export let title = '';
	/** Занимать ли почти весь экран (для длинных списков). */
	export let tall = false;

	const dispatch = createEventDispatcher();

	let panel;
	let dragging = false;
	let startY = 0;
	let offset = 0;

	function close() {
		dispatch('close');
	}

	function onStart(event) {
		// Тянем только за шапку: иначе не прокрутить содержимое.
		dragging = true;
		startY = event.touches[0].clientY;
		offset = 0;
		if (panel) panel.style.transition = 'none';
	}

	function onMove(event) {
		if (!dragging) return;
		offset = Math.max(0, event.touches[0].clientY - startY);
		if (panel) panel.style.transform = `translate3d(0,${offset}px,0)`;
	}

	function onEnd() {
		if (!dragging) return;
		dragging = false;
		if (panel) {
			panel.style.transition = '';
			panel.style.transform = '';
		}
		if (offset > 110) {
			haptic('light');
			close();
		}
		offset = 0;
	}

	function onKey(event) {
		if (event.key === 'Escape' && open) close();
	}

	// Пока шторка открыта, страница под ней не должна прокручиваться.
	$: if (typeof document !== 'undefined') {
		document.body.classList.toggle('sheet-open', open);
	}
	onDestroy(() => {
		if (typeof document !== 'undefined') document.body.classList.remove('sheet-open');
	});
</script>

<svelte:window on:keydown={onKey} />

{#if open}
	<div class="scrim" on:click={close} role="presentation"></div>
	<div class="sheet" class:tall bind:this={panel} role="dialog" aria-modal="true" aria-label={title}>
		<div
			class="grip-area"
			on:touchstart|passive={onStart}
			on:touchmove|passive={onMove}
			on:touchend={onEnd}
			on:touchcancel={onEnd}
			role="presentation"
		>
			<span class="grip"></span>
			<div class="head">
				<h2>{title}</h2>
				<button class="x" on:click={close} aria-label="Закрыть"><Icon name="close" size={18} /></button>
			</div>
		</div>
		<div class="body">
			<slot />
		</div>
		{#if $$slots.footer}
			<div class="foot"><slot name="footer" /></div>
		{/if}
	</div>
{/if}

<style>
	.scrim {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		z-index: 300;
		animation: fade 0.2s ease both;
		-webkit-backdrop-filter: blur(2px);
		backdrop-filter: blur(2px);
	}
	.sheet {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 301;
		display: flex;
		flex-direction: column;
		max-height: 86vh;
		max-height: 86dvh;
		background: var(--elevated-color);
		border-radius: 22px 22px 0 0;
		border-top: 1px solid var(--glass-border);
		box-shadow: 0 -18px 50px rgba(0, 0, 0, 0.45);
		padding-bottom: env(safe-area-inset-bottom, 0px);
		transition: transform 0.3s cubic-bezier(0.2, 0.9, 0.2, 1);
		animation: rise 0.3s cubic-bezier(0.2, 0.9, 0.2, 1) both;
		will-change: transform;
	}
	.sheet.tall {
		height: 86vh;
		height: 86dvh;
	}
	/* На широком экране шторка превращается в обычное окно по центру снизу. */
	@media (min-width: 769px) {
		.sheet {
			/* без transform: его перетирает перетаскивание пальцем */
			width: min(560px, 92vw);
			margin: 0 auto;
			border-radius: 22px;
			bottom: 24px;
			border: 1px solid var(--glass-border);
		}
	}
	.grip-area {
		padding: 8px 18px 0;
		flex-shrink: 0;
		touch-action: none;
	}
	.grip {
		display: block;
		width: 38px;
		height: 5px;
		margin: 0 auto 10px;
		border-radius: 3px;
		background: var(--gray-btn);
		opacity: 0.6;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding-bottom: 12px;
	}
	.head h2 {
		font-size: 17px;
		font-weight: 700;
	}
	.x {
		width: 32px;
		height: 32px;
		display: grid;
		place-items: center;
		border: none;
		border-radius: 50%;
		background: var(--alt-background-color);
		color: var(--secondary-text-color);
		cursor: pointer;
	}
	.body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
		padding: 0 18px 18px;
	}
	.foot {
		flex-shrink: 0;
		padding: 12px 18px calc(12px + env(safe-area-inset-bottom, 0px));
		border-top: 1px solid var(--glass-border);
		background: var(--elevated-color);
	}
	@keyframes rise {
		from {
			transform: translate3d(0, 100%, 0);
		}
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
</style>
