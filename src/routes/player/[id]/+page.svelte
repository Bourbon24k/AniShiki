<script>
	import { onMount, onDestroy } from 'svelte';
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
	let stageEl;
	let hls = null;

	// Состояние кастомного плеера
	let paused = true;
	let currentTime = 0;
	let duration = 0;
	let buffered;
	let volume = 1;
	let muted = false;
	let rate = 1;
	let buffering = false;
	let controlsVisible = true;
	let settingsOpen = false;
	let isFs = false;
	let hideTimer;
	let lastAttached = '';
	let pendingSeek = 0;

	// Привязываем источник реактивно: как только <video> в DOM и есть URL.
	$: if (videoEl && videoUrl && mode !== 'iframe' && videoUrl !== lastAttached) {
		lastAttached = videoUrl;
		attachDirect(videoUrl);
	}

	$: bufPct = (() => {
		if (!buffered || !buffered.length || !duration) return 0;
		try {
			return Math.min(100, (buffered.end(buffered.length - 1) / duration) * 100);
		} catch {
			return 0;
		}
	})();
	$: progPct = duration ? (currentTime / duration) * 100 : 0;
	$: if (paused || settingsOpen) controlsVisible = true;

	function fmt(s) {
		if (!s || !isFinite(s)) return '0:00';
		s = Math.floor(s);
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const sec = s % 60;
		const mm = h ? String(m).padStart(2, '0') : String(m);
		return `${h ? h + ':' : ''}${mm}:${String(sec).padStart(2, '0')}`;
	}

	function togglePlay() {
		if (!videoEl) return;
		if (videoEl.paused) videoEl.play();
		else videoEl.pause();
		showControlsTemp();
	}
	function seekTo(t) {
		if (videoEl) videoEl.currentTime = t;
		showControlsTemp();
	}
	function skip(sec) {
		if (videoEl) videoEl.currentTime = Math.max(0, Math.min(duration, videoEl.currentTime + sec));
		showControlsTemp();
	}
	function setVol(v) {
		if (!videoEl) return;
		videoEl.volume = v;
		videoEl.muted = v === 0;
		showControlsTemp();
	}
	function toggleMute() {
		if (videoEl) videoEl.muted = !videoEl.muted;
		showControlsTemp();
	}
	function setRate(r) {
		rate = r;
		if (videoEl) videoEl.playbackRate = r;
		settingsOpen = false;
	}
	async function togglePip() {
		try {
			if (document.pictureInPictureElement) await document.exitPictureInPicture();
			else await videoEl?.requestPictureInPicture?.();
		} catch {}
	}
	function showControlsTemp() {
		controlsVisible = true;
		clearTimeout(hideTimer);
		if (!paused && !settingsOpen) hideTimer = setTimeout(() => (controlsVisible = false), 2800);
	}
	function onEnded() {
		if (canNext) nextEp();
	}

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
		lastAttached = '';
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
					currentQuality = pickQuality();
					mode = 'native';
					videoUrl = qualities[currentQuality];
				} catch (e) {
					console.warn('kodik extract failed → iframe', e);
					extractError = true;
					mode = 'iframe';
					videoUrl = u;
				}
			} else if (isDirect(u)) {
				mode = 'video';
				videoUrl = u;
			} else {
				mode = 'iframe';
				videoUrl = u;
			}
		} catch (e) {
			console.error('video', e);
		}
		loadingVideo = false;
	}

	function pickQuality() {
		const keys = Object.keys(qualities);
		const pref = String($playingSettings?.defaultQuality ?? '');
		if (qualities[pref]) return pref;
		// по умолчанию — максимальное доступное качество
		return keys.map(Number).filter(Boolean).sort((a, b) => b - a).map(String)[0] || keys[0];
	}

	function changeQuality(q) {
		if (q === currentQuality || !qualities[q]) return;
		pendingSeek = videoEl?.currentTime || 0;
		currentQuality = q;
		destroyHls();
		lastAttached = '';
		videoUrl = qualities[q]; // реактивная привязка переподключит источник
	}

	async function attachDirect(url) {
		if (!videoEl) return;
		videoEl.playbackRate = rate;
		// восстановление позиции после смены качества
		if (pendingSeek > 0) {
			const t = pendingSeek;
			pendingSeek = 0;
			const onmeta = () => {
				try {
					videoEl.currentTime = t;
					videoEl.play();
				} catch {}
				videoEl.removeEventListener('loadedmetadata', onmeta);
			};
			videoEl.addEventListener('loadedmetadata', onmeta);
		}
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
		showControlsTemp();
		switch (e.code) {
			case 'Space':
			case 'KeyK':
				e.preventDefault();
				togglePlay();
				break;
			case 'ArrowRight':
				skip(5);
				break;
			case 'ArrowLeft':
				skip(-5);
				break;
			case 'ArrowUp':
				e.preventDefault();
				setVol(Math.min(1, (videoEl?.volume ?? 1) + 0.1));
				break;
			case 'ArrowDown':
				e.preventDefault();
				setVol(Math.max(0, (videoEl?.volume ?? 1) - 0.1));
				break;
			case 'KeyM':
				toggleMute();
				break;
			case 'KeyF':
				toggleFs();
				break;
			case 'KeyN':
				nextEp();
				break;
			case 'KeyB':
				prevEp();
				break;
		}
	}
	function toggleFs() {
		if (!document.fullscreenElement) stageEl?.requestFullscreen?.();
		else document.exitFullscreen?.();
	}
	function onFsChange() {
		isFs = !!document.fullscreenElement;
	}

	onMount(() => {
		loadRelease();
		window.addEventListener('keydown', onKey);
		document.addEventListener('fullscreenchange', onFsChange);
	});
	onDestroy(() => {
		destroyHls();
		clearTimeout(hideTimer);
		if (typeof window !== 'undefined') {
			window.removeEventListener('keydown', onKey);
			document.removeEventListener('fullscreenchange', onFsChange);
		}
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
		<div
			class="stage"
			class:idle={!controlsVisible && !paused}
			bind:this={stageEl}
			on:pointermove={showControlsTemp}
			on:pointerleave={() => !paused && !settingsOpen && (controlsVisible = false)}
		>
			{#if loading}
				<Spinner center label="Загрузка плеера…" />
			{:else if error}
				<div class="ph"><h2>{error}</h2><a href={`/release/${releaseId}`}>К релизу</a></div>
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
					<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
					<div class="video-wrap" on:click={togglePlay} on:dblclick={toggleFs}>
						<video
							bind:this={videoEl}
							class="vid"
							autoplay
							playsinline
							bind:paused
							bind:currentTime
							bind:duration
							bind:volume
							bind:muted
							bind:buffered
							on:waiting={() => (buffering = true)}
							on:playing={() => (buffering = false)}
							on:canplay={() => (buffering = false)}
							on:ended={onEnded}
						></video>

						{#if buffering}
							<div class="buf"><Spinner size={56} /></div>
						{:else if paused}
							<button class="big-play" on:click|stopPropagation={togglePlay} aria-label="Воспроизвести">
								<Icon name="play" size={38} />
							</button>
						{/if}

						<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
						<div class="controls" class:hidden={!controlsVisible} on:click|stopPropagation>
							<div class="ctop">
								<span class="ct-title">{release?.title_ru || ''}</span>
								{#if selectedEpisode}
									<span class="ct-sub">Эпизод {epPos(selectedEpisode) ?? ''} · {selectedDubber?.name}</span>
								{/if}
							</div>

							<div class="cbar">
								<div
									class="seek"
									style="--p:{progPct}%;--b:{bufPct}%"
									role="slider"
									tabindex="0"
									aria-label="Перемотка"
									aria-valuenow={Math.round(currentTime)}
								>
									<input
										type="range"
										min="0"
										max={duration || 0}
										step="0.1"
										value={currentTime}
										on:input={(e) => seekTo(+e.target.value)}
									/>
								</div>

								<div class="crow">
									<button class="cbtn" on:click={togglePlay} aria-label="Пауза/Старт">
										<Icon name={paused ? 'play' : 'pause'} size={24} />
									</button>
									<button class="cbtn" on:click={prevEp} disabled={!canPrev} title="Предыдущая (B)">
										<Icon name="back" size={20} />
									</button>
									<button class="cbtn" on:click={nextEp} disabled={!canNext} title="Следующая (N)">
										<Icon name="chevronRight" size={22} />
									</button>

									<div class="vol">
										<button class="cbtn" on:click={toggleMute} aria-label="Звук">
											<Icon name={muted || volume === 0 ? 'mute' : 'volume'} size={20} />
										</button>
										<input
											class="vrange"
											type="range"
											min="0"
											max="1"
											step="0.05"
											style="--p:{(muted ? 0 : volume) * 100}%"
											value={muted ? 0 : volume}
											on:input={(e) => setVol(+e.target.value)}
										/>
									</div>

									<span class="time">{fmt(currentTime)} <span class="sep">/</span> {fmt(duration)}</span>

									<span class="spacer"></span>

									<div class="menu-wrap">
										<button class="cbtn" class:on={settingsOpen} on:click={() => (settingsOpen = !settingsOpen)} aria-label="Настройки">
											<Icon name="settings" size={20} />
										</button>
										{#if settingsOpen}
											<div class="menu">
												{#if qualityKeys.length > 1}
													<div class="msec">
														<span class="mlabel">Качество</span>
														<div class="mopts">
															{#each qualityKeys as q}
																<button class:active={q === currentQuality} on:click={() => { changeQuality(q); settingsOpen = false; }}>{q}p</button>
															{/each}
														</div>
													</div>
												{/if}
												<div class="msec">
													<span class="mlabel">Скорость</span>
													<div class="mopts">
														{#each [0.5, 0.75, 1, 1.25, 1.5, 2] as r}
															<button class:active={r === rate} on:click={() => setRate(r)}>{r}×</button>
														{/each}
													</div>
												</div>
											</div>
										{/if}
									</div>

									<button class="cbtn pip" on:click={togglePip} title="Картинка в картинке" aria-label="PiP">
										<Icon name="collection" size={18} />
									</button>
									<button class="cbtn" on:click={toggleFs} aria-label="Полный экран">
										<Icon name="fullscreen" size={20} />
									</button>
								</div>
							</div>
						</div>
					</div>
				{/if}
			{:else if loadingVideo}
				<Spinner center label="Загрузка видео…" />
			{:else}
				<div class="ph"><h2>Нет доступного видео</h2><p>Выберите озвучку и источник</p></div>
			{/if}
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
	.stage.idle {
		cursor: none;
	}
	.video-wrap {
		position: absolute;
		inset: 0;
		display: flex;
	}
	.vid {
		width: 100%;
		height: 100%;
		border: none;
		background: #000;
		display: block;
	}
	iframe.vid {
		position: absolute;
		inset: 0;
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

	/* буферизация / большая кнопка */
	.buf {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		pointer-events: none;
	}
	.big-play {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 84px;
		height: 84px;
		border-radius: 50%;
		border: none;
		display: grid;
		place-items: center;
		padding-left: 5px;
		color: #fff;
		background: rgba(20, 20, 24, 0.55);
		backdrop-filter: blur(8px);
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
		cursor: pointer;
		transition: transform 0.15s ease, background 0.15s ease;
	}
	.big-play:hover {
		transform: translate(-50%, -50%) scale(1.07);
		background: var(--primary-color);
	}

	/* оверлей контролов */
	.controls {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		opacity: 1;
		transition: opacity 0.25s ease;
		pointer-events: none;
	}
	.controls > * {
		pointer-events: auto;
	}
	.controls.hidden {
		opacity: 0;
		pointer-events: none;
	}
	.ctop {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 16px 20px;
		background: linear-gradient(to bottom, rgba(0, 0, 0, 0.6), transparent);
	}
	.ct-title {
		font-size: 16px;
		font-weight: 700;
		text-shadow: 0 1px 6px rgba(0, 0, 0, 0.7);
	}
	.ct-sub {
		font-size: 12.5px;
		color: rgba(255, 255, 255, 0.75);
	}
	.cbar {
		padding: 10px 16px 14px;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.78) 10%, transparent);
	}

	/* шкала перемотки */
	.seek {
		position: relative;
		height: 18px;
		display: flex;
		align-items: center;
		margin-bottom: 4px;
		cursor: pointer;
	}
	.seek::before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		height: 4px;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.22);
	}
	.seek::after {
		content: '';
		position: absolute;
		left: 0;
		width: var(--b, 0%);
		height: 4px;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.4);
	}
	.seek input {
		position: relative;
		z-index: 2;
		width: 100%;
		height: 18px;
		margin: 0;
		background: transparent;
		-webkit-appearance: none;
		appearance: none;
		cursor: pointer;
	}
	.seek input::-webkit-slider-runnable-track {
		height: 4px;
		border-radius: 4px;
		background: linear-gradient(
			to right,
			var(--primary-color) var(--p, 0%),
			transparent var(--p, 0%)
		);
	}
	.seek input::-moz-range-progress {
		height: 4px;
		border-radius: 4px;
		background: var(--primary-color);
	}
	.seek input::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 14px;
		height: 14px;
		margin-top: -5px;
		border-radius: 50%;
		background: var(--primary-color);
		box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.12);
		transition: transform 0.12s ease;
	}
	.seek input::-moz-range-thumb {
		width: 14px;
		height: 14px;
		border: none;
		border-radius: 50%;
		background: var(--primary-color);
	}
	.seek:hover input::-webkit-slider-thumb {
		transform: scale(1.25);
	}

	.crow {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.cbtn {
		width: 38px;
		height: 38px;
		display: grid;
		place-items: center;
		border: none;
		background: transparent;
		color: #fff;
		border-radius: 10px;
		cursor: pointer;
		transition: background 0.15s ease, opacity 0.15s ease;
	}
	.cbtn:hover {
		background: rgba(255, 255, 255, 0.14);
	}
	.cbtn.on {
		color: var(--primary-color);
	}
	.cbtn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.spacer {
		flex: 1;
	}
	.time {
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		color: #fff;
		white-space: nowrap;
		margin: 0 4px;
	}
	.time .sep {
		opacity: 0.5;
		margin: 0 2px;
	}

	/* громкость */
	.vol {
		display: flex;
		align-items: center;
	}
	.vol .vrange {
		width: 0;
		opacity: 0;
		transition: width 0.2s ease, opacity 0.2s ease;
		-webkit-appearance: none;
		appearance: none;
		height: 4px;
		border-radius: 4px;
		background: linear-gradient(
			to right,
			#fff var(--p, 100%),
			rgba(255, 255, 255, 0.3) var(--p, 100%)
		);
	}
	.vol:hover .vrange {
		width: 70px;
		opacity: 1;
		margin: 0 8px 0 2px;
	}
	.vrange::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #fff;
	}
	.vrange::-moz-range-thumb {
		width: 12px;
		height: 12px;
		border: none;
		border-radius: 50%;
		background: #fff;
	}

	/* меню настроек */
	.menu-wrap {
		position: relative;
	}
	.menu {
		position: absolute;
		bottom: 48px;
		right: 0;
		width: 230px;
		padding: 12px;
		background: rgba(18, 18, 22, 0.96);
		backdrop-filter: blur(14px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 14px;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
	}
	.msec + .msec {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}
	.mlabel {
		display: block;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: rgba(255, 255, 255, 0.5);
		margin-bottom: 8px;
	}
	.mopts {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.mopts button {
		padding: 6px 12px;
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: rgba(255, 255, 255, 0.05);
		color: #fff;
		border-radius: 9px;
		cursor: pointer;
		font-size: 12.5px;
		font-weight: 600;
	}
	.mopts button.active {
		background: var(--primary-color);
		border-color: transparent;
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
