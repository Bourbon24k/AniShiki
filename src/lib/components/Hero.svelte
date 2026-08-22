<script>
	import { onMount, onDestroy } from 'svelte';
	import { returnEpisodeString, getStatusInfo, parseGenres, thumb } from '$lib/utils';
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
				src={thumb(it.image || it.poster, { w: 1280 })}
				alt=""
				referrerpolicy="no-referrer"
				decoding="async"
				loading={i === 0 ? 'eager' : 'lazy'}
				fetchpriority={i === 0 ? 'high' : 'auto'}
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
		/* Контент кладём в поток и прижимаем вниз: при абсолютном
		   позиционировании длинный заголовок вылезал за верх и обрезался. */
		display: flex;
		align-items: flex-end;
		min-height: clamp(380px, 56vh, 560px);
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
	/* Картинка растворяется у нижнего края. Раньше она обрывалась ровной
	   горизонтальной линией — ниже начинался чистый фон страницы, и стык
	   читался как шов. */
	.bg {
		-webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 82%, transparent 100%);
		mask-image: linear-gradient(to bottom, #000 0%, #000 82%, transparent 100%);
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
		position: relative;
		width: 100%;
		max-width: 660px;
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
		font-size: clamp(26px, 3.4vw, 46px);
		font-weight: 800;
		line-height: 1.08;
		letter-spacing: -1px;
		text-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);
		/* Три строки — предел: дальше заголовок съедает весь блок. */
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.orig {
		font-size: 15px;
		color: var(--secondary-text-color);
		margin-top: 8px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
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
	/* Невысокие окна: описание уходит первым — кнопки важнее. */
	@media (max-height: 720px) and (min-width: 769px) {
		.desc {
			-webkit-line-clamp: 2;
			line-clamp: 2;
		}
		.content {
			padding: 32px;
		}
	}
	/* В широком окне гасим и боковые края: карточка перестаёт быть резким
	   прямоугольником и мягко уходит в страницу со всех сторон. */
	@media (min-width: 769px) {
		.bg {
			-webkit-mask-image: radial-gradient(
				145% 165% at 58% 42%,
				#000 66%,
				rgba(0, 0, 0, 0.72) 86%,
				transparent 100%
			);
			mask-image: radial-gradient(
				145% 165% at 58% 42%,
				#000 66%,
				rgba(0, 0, 0, 0.72) 86%,
				transparent 100%
			);
		}
	}

	@media (max-width: 768px) {
		.hero {
			min-height: 440px;
			border-radius: 0;
			margin: 0 -12px 24px;
		}
		.content {
			padding: 24px 18px 28px;
		}
		h1 {
			-webkit-line-clamp: 2;
			line-clamp: 2;
		}
		.desc {
			-webkit-line-clamp: 2;
			line-clamp: 2;
		}
		.genres {
			margin: 12px 0 16px;
		}
		.dots {
			right: 18px;
			bottom: 16px;
		}
	}
</style>
