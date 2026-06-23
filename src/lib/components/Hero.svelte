<script>
	import { onMount, onDestroy } from 'svelte';
	import { returnEpisodeString, getStatusInfo, parseGenres } from '$lib/utils';
	import Icon from './Icon.svelte';

	export let items = [];
	export let interval = 7000;

	let active = 0;
	let timer;

	$: featured = items[active];

	function go(i) {
		active = (i + items.length) % items.length;
		restart();
	}
	function restart() {
		clearInterval(timer);
		if (items.length > 1) timer = setInterval(() => (active = (active + 1) % items.length), interval);
	}
	onMount(restart);
	onDestroy(() => clearInterval(timer));
</script>

{#if featured}
	<section class="hero">
		{#each items as it, i}
			<img
				class="bg"
				class:show={i === active}
				src={it.image || it.poster}
				alt=""
				referrerpolicy="no-referrer"
				loading={i === 0 ? 'eager' : 'lazy'}
			/>
		{/each}
		<div class="grad"></div>

		<div class="content">
			<span class="eyebrow">★ В центре внимания</span>
			<h1>{featured.title_ru}</h1>
			{#if featured.title_original}<p class="orig">{featured.title_original}</p>{/if}
			<div class="meta">
				{#if featured.grade}<span class="g"><Icon name="star" size={14} fill="#ffc107" />{featured.grade.toFixed(1)}</span>{/if}
				{#if featured.year}<span>{featured.year}</span>{/if}
				<span>{returnEpisodeString(featured)} эпизодов</span>
				{#if featured.status}<span class="st" style="--c:{getStatusInfo(featured.status).color}">{getStatusInfo(featured.status).text}</span>{/if}
			</div>
			{#if featured.description}
				<p class="desc">{featured.description.slice(0, 240)}</p>
			{/if}
			<div class="genres">
				{#each parseGenres(featured.genres, 4) as g}<span>{g}</span>{/each}
			</div>
			<div class="cta">
				<a class="btn primary" href={`/player/${featured.id}`}><Icon name="play" size={20} />Смотреть</a>
				<a class="btn ghost" href={`/release/${featured.id}`}><Icon name="discover" size={18} />Подробнее</a>
			</div>
		</div>

		{#if items.length > 1}
			<div class="dots">
				{#each items as _, i}
					<button class:on={i === active} on:click={() => go(i)} aria-label={`Слайд ${i + 1}`}></button>
				{/each}
			</div>
		{/if}
	</section>
{/if}

<style>
	.hero {
		position: relative;
		height: clamp(380px, 56vh, 560px);
		border-radius: 24px;
		overflow: hidden;
		margin-bottom: 34px;
		isolation: isolate;
	}
	.bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center 20%;
		opacity: 0;
		transform: scale(1.08);
		transition: opacity 1.1s ease, transform 7s ease;
		z-index: -2;
	}
	.bg.show {
		opacity: 1;
		transform: scale(1);
	}
	.grad {
		position: absolute;
		inset: 0;
		z-index: -1;
		background:
			linear-gradient(to right, var(--background-color) 0%, rgba(10, 10, 10, 0.5) 45%, transparent 75%),
			linear-gradient(to top, var(--background-color) 2%, transparent 55%);
	}
	.content {
		position: absolute;
		left: 0;
		bottom: 0;
		max-width: 640px;
		padding: 40px;
		animation: fadeInUp 0.6s ease both;
	}
	.eyebrow {
		display: inline-block;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 1.5px;
		color: var(--primary-color);
		margin-bottom: 12px;
	}
	h1 {
		font-size: clamp(30px, 4vw, 52px);
		font-weight: 800;
		line-height: 1.05;
		letter-spacing: -1px;
		text-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);
	}
	.orig {
		font-size: 15px;
		color: var(--secondary-text-color);
		margin-top: 8px;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 14px;
		margin: 14px 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-color);
	}
	.meta .g {
		display: flex;
		align-items: center;
		gap: 4px;
		color: #ffc107;
	}
	.meta .st {
		padding: 3px 10px;
		border-radius: 8px;
		color: #fff;
		background: var(--c);
		font-size: 12px;
	}
	.desc {
		font-size: 14.5px;
		line-height: 1.6;
		color: var(--secondary-text-color);
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		max-width: 560px;
	}
	.genres {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 14px 0 20px;
	}
	.genres span {
		padding: 5px 12px;
		font-size: 12px;
		border-radius: 20px;
		background: var(--glass-bg);
		backdrop-filter: blur(10px);
		border: 1px solid var(--glass-border);
	}
	.cta {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}
	.btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 13px 26px;
		border-radius: 14px;
		font-weight: 700;
		font-size: 15px;
		transition: transform 0.18s ease, box-shadow 0.2s ease, background 0.2s ease;
	}
	.btn:hover {
		transform: translateY(-2px);
	}
	.btn.primary {
		color: #fff;
		background: var(--primary-color);
		box-shadow: 0 8px 24px var(--primary-glow);
	}
	.btn.ghost {
		color: var(--text-color);
		background: var(--glass-bg);
		backdrop-filter: blur(12px);
		border: 1px solid var(--glass-border);
	}
	.dots {
		position: absolute;
		right: 28px;
		bottom: 28px;
		display: flex;
		gap: 8px;
	}
	.dots button {
		width: 28px;
		height: 5px;
		border: none;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.3);
		cursor: pointer;
		transition: background 0.3s ease, width 0.3s ease;
	}
	.dots button.on {
		width: 40px;
		background: var(--primary-color);
	}
	@media (max-width: 768px) {
		.hero {
			height: 460px;
			border-radius: 0;
			margin: -10px -12px 24px;
		}
		.content {
			padding: 24px 18px 28px;
		}
		.desc {
			-webkit-line-clamp: 2;
		}
		.dots {
			right: 18px;
			bottom: 16px;
		}
	}
</style>
