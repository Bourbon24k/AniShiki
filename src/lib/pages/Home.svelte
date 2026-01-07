<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { Anixart } from 'anixartjs';

	export let args = { typeReleases: 0 };

	let releases = [];
	let loading = true;
	let anixApi = null;
	let isMobile = false;

	if (browser) {
		const endpointUrl = localStorage.getItem('endpointUrl') || 'api-s.anixsekai.com';
		const token = localStorage.getItem('user_token');
		const userToken = token ? JSON.parse(token) : null;

		anixApi = new Anixart({
			token: userToken?.token,
			baseUrl: `https://${endpointUrl}`
		}).endpoints;

		isMobile = window.innerWidth <= 768;
	}

	onMount(async () => {
		if (anixApi) {
			try {
				const data = await anixApi.discover.getWatching(0);
				releases = data.content || [];
			} catch (error) {
				console.error('Error loading releases:', error);
			} finally {
				loading = false;
			}
		}
	});
</script>

<div class="home-page" class:mobile={isMobile}>
	<div class="page-header">
		<h1>Последние релизы</h1>
	</div>

	{#if loading}
		<div class="loading">
			<div class="spinner"></div>
			<p>Загрузка...</p>
		</div>
	{:else if releases.length > 0}
		<div class="releases-grid">
			{#each releases as release}
				<div class="release-card">
					<div class="release-poster">
						{#if release.poster}
							<img src={release.poster} alt={release.title?.main || 'Anime'} loading="lazy" />
						{:else}
							<div class="poster-placeholder">📺</div>
						{/if}
					</div>
					<div class="release-info">
						<h3 class="release-title">{release.title?.main || 'Без названия'}</h3>
						{#if release.title?.english}
							<p class="release-subtitle">{release.title.english}</p>
						{/if}
						<div class="release-meta">
							{#if release.type}
								<span class="meta-badge">{release.type}</span>
							{/if}
							{#if release.year}
								<span class="meta-text">{release.year}</span>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="empty-state">
			<p>Нет доступных релизов</p>
		</div>
	{/if}
</div>

<style>
	.home-page {
		padding: 20px;
		max-width: 1400px;
		margin: 0 auto;
	}

	.home-page.mobile {
		padding: 10px;
	}

	.page-header {
		margin-bottom: 30px;
	}

	.page-header h1 {
		font-size: 28px;
		font-weight: 600;
		color: var(--text-color);
	}

	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 60px 20px;
		gap: 16px;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(255, 255, 255, 0.1);
		border-top-color: var(--primary-color);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.releases-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 20px;
	}

	.mobile .releases-grid {
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 12px;
	}

	.release-card {
		background: var(--alt-background-color);
		border-radius: 12px;
		overflow: hidden;
		cursor: pointer;
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.release-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
	}

	.mobile .release-card:active {
		transform: scale(0.98);
	}

	.release-poster {
		width: 100%;
		aspect-ratio: 2/3;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		position: relative;
		overflow: hidden;
	}

	.release-poster img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.poster-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 48px;
	}

	.release-info {
		padding: 12px;
	}

	.mobile .release-info {
		padding: 8px;
	}

	.release-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-color);
		margin-bottom: 4px;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.release-subtitle {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.6);
		margin-bottom: 8px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.release-meta {
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
	}

	.meta-badge {
		background: var(--primary-color);
		color: white;
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 500;
	}

	.meta-text {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.5);
	}

	.empty-state {
		text-align: center;
		padding: 60px 20px;
		color: rgba(255, 255, 255, 0.5);
	}
</style>
