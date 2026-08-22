<script>
	/**
	 * Ряд, который грузится только когда до него доскроллили.
	 *
	 * Главная раньше стартовала шестью запросами разом и рисовала все ряды
	 * сразу — отсюда и рывки при открытии. Теперь ниже первого экрана данные
	 * запрашиваются по мере приближения, а сам ряд выключен из отрисовки,
	 * пока не виден (content-visibility).
	 */
	import { onDestroy } from 'svelte';
	import { whenNear } from '$lib/lazyload';
	import ReleaseRow from './ReleaseRow.svelte';

	export let title = '';
	export let href = null;
	export let numbered = false;
	export let subtitle = null;
	/** @type {() => Promise<any[]>} */
	export let load;
	/** Спрятать ряд целиком, если данных не оказалось. */
	export let hideWhenEmpty = true;

	let items = [];
	let loading = true;
	let started = false;
	let done = false;
	let holder;
	let stop;

	$: watch(holder);

	function watch(node) {
		stop?.();
		stop = null;
		if (!node) return;
		stop = whenNear(node, start, { margin: 400, once: true });
	}

	async function start() {
		if (started) return;
		started = true;
		try {
			items = (await load()) || [];
		} catch (e) {
			console.error('lazy row', title, e);
			items = [];
		}
		loading = false;
		done = true;
	}

	onDestroy(() => stop?.());
</script>

<div class="holder" class:gone={done && hideWhenEmpty && !items.length} bind:this={holder}>
	<ReleaseRow {title} {subtitle} {items} {loading} {href} {numbered} />
</div>

<style>
	.holder {
		/* Пока ряд за пределами экрана, браузер не тратит на него верстку. */
		content-visibility: auto;
		contain-intrinsic-size: auto 320px;
	}
	.gone {
		display: none;
	}
</style>
