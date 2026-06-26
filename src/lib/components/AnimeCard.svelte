<script>
	import { returnEpisodeString, getAgeRate, getStatusInfo, parseGenres, thumb } from '$lib/utils';
	import Icon from './Icon.svelte';

	export let anime;
	export let type = 'grid'; // 'grid' | 'full-row' | 'poster'
	export let index = null;

	$: status = getStatusInfo(anime?.status);
	$: poster = thumb(anime?.image || anime?.poster, { w: type === 'full-row' ? 280 : 320 });
</script>

<a href={`/release/${anime.id}`} class="card {type}" style="--idx:{index}">
	<div class="poster">
		{#if poster}
			<img src={poster} alt={anime.title_ru} loading="lazy" decoding="async" referrerpolicy="no-referrer" />
		{:else}
			<div class="ph"><Icon name="discover" size={40} /></div>
		{/if}
		<div class="shade"></div>
		{#if index != null}
			<span class="num">{String(index + 1).padStart(2, '0')}</span>
		{/if}
		{#if anime?.status}
			<span class="status" style="--c:{status.color}">{status.text}</span>
		{/if}
		<span class="age">{getAgeRate(anime?.age_rating)}</span>
		{#if anime?.grade}
			<span class="grade"><Icon name="star" size={12} fill="#ffc107" />{anime.grade.toFixed(1)}</span>
		{/if}
		{#if type === 'poster'}
			<div class="poster-info">
				<h3>{anime.title_ru}</h3>
				<span class="meta">{returnEpisodeString(anime)} эп. · {anime.year || ''}</span>
			</div>
		{/if}
	</div>

	{#if type !== 'poster'}
		<div class="info">
			<h3 class="title">{anime.title_ru}</h3>
			{#if type === 'full-row'}
				<p class="alt">{anime.title_original || ''}</p>
				<p class="desc">{(anime.description || '').slice(0, 220)}</p>
			{/if}
			<div class="meta">
				<span>{returnEpisodeString(anime)} эп.</span>
				{#if anime.year}<span>· {anime.year}</span>{/if}
			</div>
			{#if type === 'full-row'}
				<div class="genres">
					{#each parseGenres(anime.genres, 4) as g}
						<span class="genre">{g}</span>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</a>

<style>
	.card {
		display: flex;
		color: inherit;
		border-radius: 16px;
		overflow: hidden;
		transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.25s ease;
		animation: fadeInUp 0.4s ease both;
	}
	.card:hover {
		transform: translateY(-6px);
	}

	.poster {
		position: relative;
		width: 100%;
		aspect-ratio: 2 / 3;
		overflow: hidden;
		background: linear-gradient(135deg, #2a2540, #3a2030);
		border-radius: 16px;
	}
	.poster img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 0.5s ease;
	}
	.card:hover .poster img {
		transform: scale(1.07);
	}
	.ph {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		color: var(--third-text-color);
	}
	.shade {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.75) 0%, transparent 45%);
		opacity: 0;
		transition: opacity 0.3s ease;
	}
	.card:hover .shade {
		opacity: 1;
	}

	.num {
		position: absolute;
		bottom: 6px;
		left: 10px;
		font-size: 40px;
		font-weight: 800;
		line-height: 1;
		color: rgba(255, 255, 255, 0.92);
		text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
		font-family: var(--font-mono, 'JetBrains Mono', monospace);
		pointer-events: none;
	}

	.status,
	.age,
	.grade {
		position: absolute;
		padding: 3px 7px;
		border-radius: 7px;
		font-size: 10.5px;
		font-weight: 700;
		backdrop-filter: blur(6px);
	}
	.status {
		top: 8px;
		left: 8px;
		color: #fff;
		background: var(--c);
	}
	.age {
		top: 8px;
		right: 8px;
		color: #fff;
		background: rgba(0, 0, 0, 0.6);
	}
	.grade {
		bottom: 8px;
		right: 8px;
		display: flex;
		align-items: center;
		gap: 3px;
		color: #fff;
		background: rgba(0, 0, 0, 0.62);
	}

	/* grid */
	.card.grid {
		flex-direction: column;
		gap: 8px;
	}
	.grid .info {
		padding: 0 2px;
	}
	.grid .title {
		font-size: 13.5px;
		font-weight: 600;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		line-height: 1.3;
	}
	.grid .meta {
		margin-top: 3px;
		font-size: 12px;
		color: var(--secondary-text-color);
	}

	/* poster (text over image) */
	.card.poster {
		flex-direction: column;
	}
	.poster-info {
		position: absolute;
		left: 10px;
		right: 10px;
		bottom: 10px;
		z-index: 2;
	}
	.poster-info h3 {
		font-size: 13px;
		font-weight: 700;
		color: #fff;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		text-shadow: 0 1px 6px rgba(0, 0, 0, 0.8);
	}
	.poster-info .meta {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.8);
	}
	.card.poster .shade {
		opacity: 1;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, transparent 55%);
	}

	/* full-row */
	.card.full-row {
		flex-direction: row;
		gap: 16px;
		padding: 14px;
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
	}
	.full-row .poster {
		width: 130px;
		min-width: 130px;
		border-radius: 12px;
	}
	.full-row .info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.full-row .title {
		font-size: 18px;
		font-weight: 700;
	}
	.full-row .alt {
		font-size: 13px;
		color: var(--secondary-text-color);
		margin: 2px 0 8px;
	}
	.full-row .desc {
		font-size: 13px;
		color: var(--secondary-text-color);
		line-height: 1.5;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.full-row .meta {
		margin-top: 8px;
		font-size: 13px;
		color: var(--secondary-text-color);
		display: flex;
		gap: 6px;
	}
	.genres {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 10px;
	}
	.genre {
		padding: 4px 10px;
		font-size: 11.5px;
		border-radius: 20px;
		background: var(--background-color);
		color: var(--secondary-text-color);
	}
	@media (max-width: 768px) {
		.full-row .poster {
			width: 96px;
			min-width: 96px;
		}
		.full-row .desc,
		.full-row .alt {
			display: none;
		}
		.full-row .title {
			font-size: 15px;
		}
		.num {
			font-size: 30px;
		}
	}
</style>
