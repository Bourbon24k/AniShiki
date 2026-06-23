<script>
	import { fade } from 'svelte/transition';
	import Icon from './Icon.svelte';

	export let images = [];
	export let index = 0;
	export let open = false;

	function close() {
		open = false;
	}
	function prev() {
		index = (index - 1 + images.length) % images.length;
	}
	function next() {
		index = (index + 1) % images.length;
	}
	function onKey(e) {
		if (!open) return;
		if (e.key === 'Escape') close();
		else if (e.key === 'ArrowLeft') prev();
		else if (e.key === 'ArrowRight') next();
	}
</script>

<svelte:window on:keydown={onKey} />

{#if open && images.length}
	<div class="lb" transition:fade={{ duration: 180 }} on:click={close}>
		<button class="close" on:click|stopPropagation={close} aria-label="Закрыть"><Icon name="close" size={24} /></button>
		{#if images.length > 1}
			<button class="nav left" on:click|stopPropagation={prev} aria-label="Назад"><Icon name="back" size={26} /></button>
			<button class="nav right" on:click|stopPropagation={next} aria-label="Вперёд"><Icon name="chevronRight" size={26} /></button>
		{/if}
		<img src={images[index]} alt="" referrerpolicy="no-referrer" on:click|stopPropagation />
		{#if images.length > 1}<span class="counter">{index + 1} / {images.length}</span>{/if}
	</div>
{/if}

<style>
	.lb {
		position: fixed;
		inset: 0;
		z-index: 5000;
		background: rgba(0, 0, 0, 0.9);
		backdrop-filter: blur(8px);
		display: grid;
		place-items: center;
		padding: 40px;
	}
	.lb img {
		max-width: 92vw;
		max-height: 88vh;
		border-radius: 12px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
	}
	.close {
		position: absolute;
		top: 20px;
		right: 20px;
		width: 46px;
		height: 46px;
		border: none;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
		cursor: pointer;
		display: grid;
		place-items: center;
	}
	.nav {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		width: 52px;
		height: 52px;
		border: none;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
		cursor: pointer;
		display: grid;
		place-items: center;
	}
	.nav:hover,
	.close:hover {
		background: rgba(255, 255, 255, 0.2);
	}
	.left {
		left: 20px;
	}
	.right {
		right: 20px;
	}
	.counter {
		position: absolute;
		bottom: 24px;
		left: 50%;
		transform: translateX(-50%);
		color: #fff;
		font-size: 14px;
		font-weight: 600;
		background: rgba(0, 0, 0, 0.5);
		padding: 6px 14px;
		border-radius: 20px;
	}
	@media (max-width: 768px) {
		.lb {
			padding: 12px;
		}
		.nav {
			width: 42px;
			height: 42px;
		}
	}
</style>
