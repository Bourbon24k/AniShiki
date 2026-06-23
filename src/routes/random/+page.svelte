<script>
	import { onMount } from 'svelte';
	import { getApi } from '$lib/api';
	import { returnEpisodeString, getStatusInfo, parseGenres } from '$lib/utils';
	import Icon from '$lib/components/Icon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	let release = null;
	let loading = true;

	async function roll() {
		loading = true;
		try {
			const data = await getApi().release.getRandomRelease(true);
			release = data?.release;
		} catch (e) {
			console.error('random', e);
		}
		loading = false;
	}
	onMount(roll);
</script>

<svelte:head><title>Случайное — AniShiki</title></svelte:head>

<div class="page">
	<div class="head">
		<h1>Случайный релиз</h1>
		<button class="roll" on:click={roll} disabled={loading}>
			<Icon name="random" size={18} /> Ещё раз
		</button>
	</div>

	{#if loading}
		<Spinner center label="Подбираем…" />
	{:else if release}
		<a class="card glass" href={`/release/${release.id}`}>
			<div class="poster">
				<img src={release.image} alt="" referrerpolicy="no-referrer" />
			</div>
			<div class="info">
				<h2>{release.title_ru}</h2>
				<p class="orig">{release.title_original || ''}</p>
				<div class="meta">
					{#if release.grade}<span class="g"><Icon name="star" size={14} fill="#ffc107" />{release.grade.toFixed(1)}</span>{/if}
					{#if release.year}<span>{release.year}</span>{/if}
					<span>{returnEpisodeString(release)} эп.</span>
					{#if release.status}<span class="st" style="--c:{getStatusInfo(release.status).color}">{getStatusInfo(release.status).text}</span>{/if}
				</div>
				<div class="genres">{#each parseGenres(release.genres, 5) as g}<span>{g}</span>{/each}</div>
				<p class="desc">{(release.description || '').slice(0, 300)}</p>
			</div>
		</a>
	{/if}
</div>

<style>
	.page {
		max-width: 1000px;
		margin: 0 auto;
		padding: 24px;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 24px;
	}
	h1 {
		font-size: 30px;
		font-weight: 800;
	}
	.roll {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 12px 20px;
		border: none;
		border-radius: 14px;
		background: var(--primary-color);
		color: #fff;
		font-weight: 700;
		cursor: pointer;
	}
	.roll:disabled {
		opacity: 0.5;
	}
	.card {
		display: flex;
		gap: 24px;
		padding: 20px;
		border-radius: 20px;
		animation: fadeInUp 0.4s ease;
	}
	.poster {
		width: 220px;
		min-width: 220px;
		aspect-ratio: 2/3;
		border-radius: 14px;
		overflow: hidden;
	}
	.poster img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.info h2 {
		font-size: 26px;
		font-weight: 800;
	}
	.orig {
		color: var(--secondary-text-color);
		margin: 6px 0 14px;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
		font-weight: 600;
		font-size: 14px;
		margin-bottom: 14px;
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
	.genres {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 14px;
	}
	.genres span {
		padding: 5px 12px;
		font-size: 12px;
		border-radius: 20px;
		background: var(--background-color);
		color: var(--secondary-text-color);
	}
	.desc {
		font-size: 14px;
		line-height: 1.6;
		color: var(--secondary-text-color);
	}
	@media (max-width: 768px) {
		.page {
			padding: 16px 12px;
		}
		.card {
			flex-direction: column;
			align-items: center;
			text-align: center;
		}
		.poster {
			width: 170px;
			min-width: 170px;
		}
		.meta,
		.genres {
			justify-content: center;
		}
		h1 {
			font-size: 22px;
		}
	}
</style>
