<script>
	import { onMount, onDestroy, tick } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { getApi } from '$lib/api';
	import { userToken, playingSettings } from '$lib/stores';
	import Icon from '$lib/components/Icon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	$: releaseId = Number($page.params.id);

	let release = null;
	let loading = true;
	let error = '';

	let dubbers = [];
	let sources = [];
	let episodes = [];
	let selectedDubber = null;
	let selectedSource = null;
	let selectedEpisode = null;

	let videoUrl = '';
	let mode = 'video'; // 'native' (m3u8 из Kodik) | 'video' (прямой mp4/m3u8) | 'iframe' (фолбэк)
	let qualities = {};
	let currentQuality = '';
	let extractError = false;
	let loadingEpisodes = false;
	let loadingVideo = false;
	let panelOpen = true;

	let videoEl;
	let hls = null;

	function epPos(ep) {
		const n = parseInt(ep?.name ?? ep?.position, 10);
		return Number.isFinite(n) ? n : ep?.position ?? null;
	}
	function isDirect(u) {
		if (!u) return false;
		return /\.(mp4|m3u8)(\?|$)/i.test(u);
	}
	function isKodik(u) {
		return /kodik|aniqit|anivod/i.test(u || '');
	}
	$: qualityKeys = Object.keys(qualities).sort((a, b) => Number(b) - Number(a));
	$: curIndex = selectedEpisode
		? episodes.findIndex((e) => e === selectedEpisode || e.url === selectedEpisode.url)
		: -1;
	$: canPrev = curIndex > 0;
	$: canNext = curIndex >= 0 && curIndex < episodes.length - 1;

	async function loadRelease() {
		loading = true;
		const api = getApi();
		if (!api) return;
		try {
			const data = await api.release.info(releaseId, true);
			release = data?.release;
			await loadDubbers();
		} catch (e) {
			console.error(e);
			error = 'Не удалось загрузить релиз';
		}
		loading = false;
	}

	async function loadDubbers() {
		try {
			const d = await getApi().release.getDubbers(releaseId);
			dubbers = d?.types || d?.dubbers || [];
			if (dubbers.length) await selectDubber(dubbers[0]);
		} catch (e) {
			console.error('dubbers', e);
		}
	}

	async function selectDubber(dub) {
		selectedDubber = dub;
		sources = [];
		episodes = [];
		videoUrl = '';
		try {
			const s = await getApi().release.getDubberSources(releaseId, dub.id);
			sources = s?.sources || [];
			const pref = $playingSettings.defaultSource;
			const chosen = sources.find((x) => x.id === pref) || sources[0];
			if (chosen) await selectSource(chosen);
		} catch (e) {
			console.error('sources', e);
		}
	}

	async function selectSource(src) {
		selectedSource = src;
		episodes = [];
		videoUrl = '';
		loadingEpisodes = true;
		try {
			const data = await getApi().release.getEpisodes(releaseId, selectedDubber.id, src.id);
			const list = data?.episodes || [];
			list.sort((a, b) => {
				const ap = epPos(a),
					bp = epPos(b);
				if (ap == null) return 1;
				if (bp == null) return -1;
				return ap - bp;
			});
			episodes = list;
			if (episodes.length) await selectEpisode(episodes[0]);
		} catch (e) {
			console.error('episodes', e);
		}
		loadingEpisodes = false;
	}

	async function selectEpisode(ep) {
		selectedEpisode = ep;
		await loadVideo();
		const pos = epPos(ep);
		if ($userToken && selectedSource && pos != null && !$playingSettings.disableHistory) {
			try {
				await getApi().release.addToHistory(releaseId, selectedSource.id, pos);
				await getApi().release.markEpisodeAsWatched(releaseId, selectedSource.id, pos);
			} catch {}
		}
	}

	async function loadVideo() {
		if (!selectedEpisode) return;
		loadingVideo = true;
		videoUrl = '';
		qualities = {};
		currentQuality = '';
		extractError = false;
		destroyHls();
		try {
			let u = selectedEpisode.url || '';
			if (u.startsWith('//')) u = `https:${u}`;
			else if (u && !u.startsWith('http')) u = `https://${u}`;

			if (isKodik(u)) {
				// Достаём прямой m3u8 через серверный эндпоинт → играем без рекламы.
				try {
					const r = await fetch(`/api/kodik?url=${encodeURIComponent(u)}`);
					if (!r.ok) throw new Error('extract ' + r.status);
					const d = await r.json();
					if (!d.qualities || !Object.keys(d.qualities).length) throw new Error('empty');
					qualities = d.qualities;
					currentQuality = pickQuality(d.default);
					mode = 'native';
					videoUrl = qualities[currentQuality];
					await tick();
					await attachDirect(videoUrl);
				} catch (e) {
					console.warn('kodik extract failed → iframe', e);
					extractError = true;
					mode = 'iframe';
					videoUrl = u;
				}
			} else if (isDirect(u)) {
				mode = 'video';
				videoUrl = u;
				await tick();
				await attachDirect(u);
			} else {
				mode = 'iframe';
				videoUrl = u;
			}
		} catch (e) {
			console.error('video', e);
		}
		loadingVideo = false;
	}

	function pickQuality(def) {
		const keys = Object.keys(qualities);
		const pref = String($playingSettings?.defaultQuality ?? def ?? '');
		if (qualities[pref]) return pref;
		if (def && qualities[String(def)]) return String(def);
		// иначе максимальное доступное
		return keys.map(Number).filter(Boolean).sort((a, b) => b - a).map(String)[0] || keys[0];
	}

	async function changeQuality(q) {
		if (q === currentQuality || !qualities[q]) return;
		const t = videoEl?.currentTime || 0;
		const wasPlaying = videoEl && !videoEl.paused;
		currentQuality = q;
		videoUrl = qualities[q];
		destroyHls();
		await tick();
		await attachDirect(videoUrl);
		if (videoEl) {
			const restore = () => {
				try {
					videoEl.currentTime = t;
					if (wasPlaying) videoEl.play();
				} catch {}
				videoEl.removeEventListener('loadedmetadata', restore);
			};
			videoEl.addEventListener('loadedmetadata', restore);
		}
	}

	async function attachDirect(url) {
		if (!videoEl) return;
		if (/\.m3u8/i.test(url)) {
			if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
				videoEl.src = url;
			} else {
				const { default: Hls } = await import('hls.js');
				if (Hls.isSupported()) {
					hls = new Hls();
					hls.loadSource(url);
					hls.attachMedia(videoEl);
				} else {
					videoEl.src = url;
				}
			}
		} else {
			videoEl.src = url;
		}
	}

	function destroyHls() {
		if (hls) {
			hls.destroy();
			hls = null;
		}
	}

	function nextEp() {
		if (canNext) selectEpisode(episodes[curIndex + 1]);
	}
	function prevEp() {
		if (canPrev) selectEpisode(episodes[curIndex - 1]);
	}

	function onKey(e) {
		if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
		if (e.code === 'KeyN') nextEp();
		else if (e.code === 'KeyB') prevEp();
		else if (e.code === 'KeyF') toggleFs();
	}
	function toggleFs() {
		const el = document.querySelector('.stage');
		if (!document.fullscreenElement) el?.requestFullscreen?.();
		else document.exitFullscreen?.();
	}

	onMount(() => {
		loadRelease();
		window.addEventListener('keydown', onKey);
	});
	onDestroy(() => {
		destroyHls();
		if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey);
	});
</script>

<svelte:head>
	<title>{release?.title_ru || 'Плеер'} — AniShiki</title>
</svelte:head>

<div class="player">
	<header class="topbar glass">
		<button class="back" on:click={() => goto(`/release/${releaseId}`)}><Icon name="back" size={20} /></button>
		<div class="titles">
			<span class="t">{release?.title_ru || 'Загрузка…'}</span>
			{#if selectedEpisode}<span class="sub">Эпизод {epPos(selectedEpisode) ?? ''} · {selectedDubber?.name} · {selectedSource?.name}</span>{/if}
		</div>
		<button class="panel-toggle" on:click={() => (panelOpen = !panelOpen)} aria-label="Эпизоды">
			<Icon name="collection" size={20} />
		</button>
	</header>

	<div class="layout" class:panel-open={panelOpen}>
		<div class="stage">
			{#if loading}
				<Spinner center label="Загрузка плеера…" />
			{:else if error}
				<div class="ph"><h2>{error}</h2><a href={`/release/${releaseId}`}>К релизу</a></div>
			{:else if loadingVideo}
				<Spinner center label="Загрузка видео…" />
			{:else if videoUrl}
				{#if mode === 'iframe'}
					<iframe
						src={videoUrl}
						class="vid"
						title="Player"
						allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
						allowfullscreen
						referrerpolicy="origin"
					></iframe>
				{:else}
					<!-- svelte-ignore a11y-media-has-caption -->
					<video bind:this={videoEl} class="vid" controls autoplay playsinline></video>
				{/if}
			{:else}
				<div class="ph"><h2>Нет доступного видео</h2><p>Выберите озвучку и источник</p></div>
			{/if}

			<div class="stage-controls">
				<button on:click={prevEp} disabled={!canPrev}><Icon name="back" size={18} /> Пред.</button>
				<button on:click={nextEp} disabled={!canNext}>След. <Icon name="chevronRight" size={18} /></button>

				{#if mode === 'native'}
					<span class="adfree" title="Прямой поток без рекламы">⚡ Без рекламы</span>
				{:else if mode === 'iframe' && extractError}
					<span class="adwarn" title="Не удалось извлечь прямой поток, открыт встроенный плеер">Встроенный плеер</span>
				{/if}

				{#if qualityKeys.length > 1}
					<div class="quality">
						{#each qualityKeys as q}
							<button class:active={q === currentQuality} on:click={() => changeQuality(q)}>{q}p</button>
						{/each}
					</div>
				{/if}

				<button on:click={toggleFs} class="fs"><Icon name="fullscreen" size={18} /></button>
			</div>
		</div>

		<aside class="panel" class:open={panelOpen}>
			<div class="group">
				<h3>Озвучка</h3>
				<div class="chips">
					{#each dubbers as d}
						<button class="chip" class:active={selectedDubber?.id === d.id} on:click={() => selectDubber(d)}>
							{d.name}{#if d.episodes_count}<span class="cnt">{d.episodes_count}</span>{/if}
						</button>
					{/each}
				</div>
			</div>

			<div class="group">
				<h3>Источник</h3>
				<div class="chips">
					{#each sources as s}
						<button class="chip" class:active={selectedSource?.id === s.id} on:click={() => selectSource(s)}>
							{s.name}
						</button>
					{/each}
				</div>
			</div>

			<div class="group eps">
				<h3>Эпизоды {#if episodes.length}<span class="cnt">{episodes.length}</span>{/if}</h3>
				{#if loadingEpisodes}
					<Spinner size={28} />
				{:else}
					<div class="ep-grid">
						{#each episodes as ep}
							<button
								class="ep"
								class:active={selectedEpisode === ep || selectedEpisode?.url === ep.url}
								on:click={() => selectEpisode(ep)}
							>
								{epPos(ep) ?? ep.name ?? '?'}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</aside>
	</div>
</div>

<style>
	.player {
		display: flex;
		flex-direction: column;
		height: 100vh;
		height: 100dvh;
		background: #000;
		color: var(--text-color);
	}
	.topbar {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 0 16px;
		height: 56px;
		z-index: 10;
		border-bottom: 1px solid var(--glass-border);
	}
	.back,
	.panel-toggle {
		width: 40px;
		height: 40px;
		display: grid;
		place-items: center;
		border: none;
		background: transparent;
		color: var(--text-color);
		border-radius: 10px;
		cursor: pointer;
	}
	.back:hover,
	.panel-toggle:hover {
		background: rgba(255, 255, 255, 0.08);
	}
	.titles {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.titles .t {
		font-weight: 700;
		font-size: 15px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.titles .sub {
		font-size: 12px;
		color: var(--secondary-text-color);
	}

	.layout {
		flex: 1;
		min-height: 0;
		display: flex;
	}
	.stage {
		flex: 1;
		min-width: 0;
		position: relative;
		display: flex;
		flex-direction: column;
		background: #000;
	}
	.vid {
		flex: 1;
		width: 100%;
		height: 100%;
		border: none;
		background: #000;
	}
	.ph {
		flex: 1;
		display: grid;
		place-content: center;
		text-align: center;
		gap: 8px;
		color: var(--secondary-text-color);
	}
	.ph a {
		color: var(--primary-color);
	}
	.stage-controls {
		display: flex;
		gap: 10px;
		padding: 12px 16px;
		background: var(--alt-background-color);
		border-top: 1px solid var(--glass-border);
	}
	.stage-controls button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 9px 16px;
		border: 1px solid var(--glass-border);
		background: var(--elevated-color);
		color: var(--text-color);
		border-radius: 10px;
		cursor: pointer;
		font-size: 13px;
		font-weight: 600;
	}
	.stage-controls button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.stage-controls .fs {
		margin-left: auto;
	}
	.adfree,
	.adwarn {
		display: inline-flex;
		align-items: center;
		padding: 7px 12px;
		border-radius: 9px;
		font-size: 12px;
		font-weight: 700;
	}
	.adfree {
		color: #4ade80;
		background: rgba(74, 222, 128, 0.12);
		border: 1px solid rgba(74, 222, 128, 0.3);
	}
	.adwarn {
		color: var(--secondary-text-color);
		background: var(--elevated-color);
		border: 1px solid var(--glass-border);
	}
	.quality {
		display: inline-flex;
		gap: 4px;
		padding: 3px;
		background: var(--elevated-color);
		border: 1px solid var(--glass-border);
		border-radius: 10px;
	}
	.quality button {
		padding: 5px 11px;
		border: none;
		background: transparent;
		color: var(--secondary-text-color);
		border-radius: 7px;
		cursor: pointer;
		font-size: 12px;
		font-weight: 700;
	}
	.quality button.active {
		background: var(--primary-color);
		color: #fff;
	}

	.panel {
		width: 340px;
		min-width: 340px;
		background: var(--background-color);
		border-left: 1px solid var(--glass-border);
		overflow-y: auto;
		padding: 18px;
		display: none;
	}
	.panel.open {
		display: block;
	}
	.group {
		margin-bottom: 24px;
	}
	.group h3 {
		font-size: 13px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--third-text-color);
		margin-bottom: 12px;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.cnt {
		display: inline-grid;
		place-items: center;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		font-size: 10px;
		border-radius: 9px;
		background: var(--primary-color);
		color: #fff;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
		color: var(--text-color);
		border-radius: 10px;
		cursor: pointer;
		font-size: 13px;
		font-weight: 500;
	}
	.chip.active {
		background: var(--primary-color);
		color: #fff;
		border-color: transparent;
	}
	.chip .cnt {
		background: rgba(0, 0, 0, 0.25);
	}
	.ep-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
		gap: 8px;
	}
	.ep {
		aspect-ratio: 1;
		display: grid;
		place-items: center;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
		color: var(--text-color);
		border-radius: 10px;
		cursor: pointer;
		font-weight: 600;
		font-size: 14px;
		transition: transform 0.12s ease;
	}
	.ep:hover {
		transform: translateY(-2px);
	}
	.ep.active {
		background: var(--primary-color);
		color: #fff;
		border-color: transparent;
	}

	@media (max-width: 900px) {
		.layout {
			flex-direction: column;
		}
		.panel {
			width: 100%;
			min-width: 0;
			border-left: none;
			border-top: 1px solid var(--glass-border);
			max-height: 45vh;
		}
		.stage {
			min-height: 240px;
		}
	}
</style>
