<script>
	import { onMount, onDestroy, tick } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { getApi } from '$lib/api';
	import { userToken, playingSettings, showToast } from '$lib/stores';
	import { supabaseEnabled } from '$lib/supabase';
	import { siteProfile, siteSession, currentSiteName } from '$lib/stores/auth';
	import { saveHistory, getHistoryEntry, logActivity } from '$lib/sitedata';
	import {
		coActive,
		coRoomId,
		participants,
		chat,
		isHost,
		hostOnly,
		joinRoom,
		leaveRoom,
		setHostOnly,
		sendSync,
		sendChat,
		genRoomId
	} from '$lib/cowatch';
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
	let forceIframe = false; // принудительно встроенный плеер (если extract ломается)

	function setIframe(val) {
		if (forceIframe === val) return;
		forceIframe = val;
		try {
			localStorage.setItem('force_iframe', val ? '1' : '0');
		} catch {}
		settingsOpen = false;
		loadVideo();
	}

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
	// «Продолжить с секунды» — одноразовая цель на старте: { ep, sec } | null.
	// Потребляется при первом выборе источника, чтобы ручной переход по сериям не сикал.
	let pendingResume = null;
	let lastProgressSave = 0;

	const progressKey = () => `progress:${releaseId}`;
	function readLocalProgress() {
		try {
			return JSON.parse(localStorage.getItem(progressKey()) || 'null');
		} catch {
			return null;
		}
	}

	function saveProgress(force = false) {
		if ($playingSettings.disableHistory) return;
		if (!videoEl || !release || !selectedEpisode || !videoEl.currentTime) return;
		const now = Date.now();
		if (!force && now - lastProgressSave < 10000) return;
		lastProgressSave = now;
		const pos = epPos(selectedEpisode);
		// локально — для всех (в т.ч. гостей и Anixart), быстрый resume на этом устройстве
		try {
			localStorage.setItem(
				progressKey(),
				JSON.stringify({ ep: pos, sec: Math.floor(videoEl.currentTime), dur: Math.floor(videoEl.duration || 0) })
			);
		} catch {}
		// кросс-девайс — только аккаунт сайта (Supabase)
		if (!$userToken && $siteSession) {
			saveHistory(release, {
				episodePosition: pos,
				sourceId: selectedSource?.id,
				dubberId: selectedDubber?.id,
				seconds: videoEl.currentTime,
				duration: videoEl.duration
			}).catch(() => {});
			// событие в ленту друзей — один раз за серию, после 60с просмотра
			const wkey = `${releaseId}:${pos}`;
			if (videoEl.currentTime > 60 && !loggedWatch.has(wkey)) {
				loggedWatch.add(wkey);
				logActivity('watch', release, pos != null ? `серия ${pos}` : '');
			}
		}
	}
	const loggedWatch = new Set();

	// Совместный просмотр
	let coName = '';
	let coPanel = false;
	let chatText = '';
	let applyingRemote = false;
	$: coOn = $coActive;

	function coIdentity() {
		return { name: coName || currentSiteName() || 'Гость', avatar: $siteProfile?.avatar_url || null };
	}
	function emitSync(action) {
		if (!coOn || applyingRemote || !videoEl) return;
		if ($hostOnly && !$isHost) return; // в режиме «только хост» гости не управляют
		sendSync({
			action,
			time: videoEl.currentTime || 0,
			paused: videoEl.paused,
			epPos: epPos(selectedEpisode),
			dubberId: selectedDubber?.id,
			sourceId: selectedSource?.id
		});
	}
	function sendCurrentState() {
		if (!videoEl) return;
		sendSync({
			action: 'state',
			time: videoEl.currentTime || 0,
			paused: videoEl.paused,
			epPos: epPos(selectedEpisode),
			dubberId: selectedDubber?.id,
			sourceId: selectedSource?.id
		});
	}
	async function applySync(p) {
		applyingRemote = true;
		try {
			if (p.dubberId && p.dubberId !== selectedDubber?.id) {
				const d = dubbers.find((x) => x.id === p.dubberId);
				if (d) await selectDubber(d);
			}
			if (p.sourceId && p.sourceId !== selectedSource?.id) {
				const s = sources.find((x) => x.id === p.sourceId);
				if (s) await selectSource(s);
			}
			if (p.epPos != null && p.epPos !== epPos(selectedEpisode)) {
				const e = episodes.find((x) => epPos(x) === p.epPos);
				if (e) await selectEpisode(e);
			}
			await tick();
			if (videoEl) {
				if (p.time != null && Math.abs((videoEl.currentTime || 0) - p.time) > 1.5) videoEl.currentTime = p.time;
				if (p.paused === true) videoEl.pause();
				else if (p.paused === false) videoEl.play().catch(() => {});
			}
		} catch (e) {
			console.warn('applySync', e);
		} finally {
			setTimeout(() => (applyingRemote = false), 400);
		}
	}

	function startRoom() {
		if (!coName.trim() && !currentSiteName()) {
			showToast('Введите имя для комнаты', 'error');
			return;
		}
		if (coName.trim()) try { localStorage.setItem('cowatch_name', coName.trim()); } catch {}
		const id = $coRoomId || genRoomId();
		joinRoom(id, coIdentity(), { onSync: applySync, onRequestState: sendCurrentState }, true);
		const url = new URL(location.href);
		url.searchParams.set('room', id);
		history.replaceState(null, '', url);
		coPanel = true;
	}
	function leaveCo() {
		leaveRoom();
		const url = new URL(location.href);
		url.searchParams.delete('room');
		history.replaceState(null, '', url);
	}
	function copyRoomLink() {
		navigator.clipboard?.writeText(location.href).then(() => showToast('Ссылка скопирована', 'success'));
	}
	function submitChat() {
		const t = chatText.trim();
		if (!t) return;
		sendChat(t, coIdentity());
		chatText = '';
	}

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
	function seekLocal(t) {
		if (videoEl) videoEl.currentTime = t;
		showControlsTemp();
	}
	function skip(sec) {
		if (videoEl) videoEl.currentTime = Math.max(0, Math.min(duration, videoEl.currentTime + sec));
		emitSync('seek');
		showControlsTemp();
	}
	function skipIntro() {
		skip(85);
	}
	function skipEnding() {
		nextEp();
	}
	// Кнопки пропуска (нет тайм-кодов от Kodik → эвристика по времени)
	$: showSkipIntro = mode !== 'iframe' && duration > 120 && currentTime > 4 && currentTime < 110 && !buffering && !paused;
	$: showSkipEnding = mode !== 'iframe' && duration > 0 && currentTime > duration - 150 && currentTime < duration - 2 && canNext && !buffering;
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
	// Автопереход к следующей серии с отсчётом
	let autoNextLeft = 0;
	let autoNextTimer = null;
	function onEnded() {
		if (!canNext) return;
		saveProgress(true);
		autoNextLeft = 5;
		clearInterval(autoNextTimer);
		autoNextTimer = setInterval(() => {
			autoNextLeft -= 1;
			if (autoNextLeft <= 0) {
				cancelAutoNext();
				nextEp();
			}
		}, 1000);
	}
	function cancelAutoNext() {
		clearInterval(autoNextTimer);
		autoNextTimer = null;
		autoNextLeft = 0;
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
			// «Продолжить с секунды»: локально для всех, кросс-девайс для site-аккаунта
			// (?fresh=1 со страницы релиза — смотреть с начала)
			if (!$playingSettings.disableHistory && !$page.url.searchParams.get('fresh')) {
				const local = readLocalProgress();
				if (local?.sec > 5) pendingResume = { ep: local.ep, sec: local.sec };
				if (!$userToken && $siteSession) {
					try {
						const h = await getHistoryEntry(releaseId);
						if (h?.seconds > 5) pendingResume = { ep: h.episode_position, sec: h.seconds };
					} catch {}
				}
			}
			await loadDubbers();
		} catch (e) {
			console.error(e);
			error = 'Не удалось загрузить релиз';
		}
		loading = false;
	}

	// Память выбранной озвучки/источника по релизу
	const prefKey = () => `pref:${releaseId}`;
	function savePref() {
		if (!selectedDubber || !selectedSource) return;
		try {
			localStorage.setItem(prefKey(), JSON.stringify({ dubberId: selectedDubber.id, sourceId: selectedSource.id }));
		} catch {}
	}

	async function loadDubbers() {
		try {
			const d = await getApi().release.getDubbers(releaseId);
			dubbers = d?.types || d?.dubbers || [];
			if (!dubbers.length) return;
			let pref = null;
			try {
				pref = JSON.parse(localStorage.getItem(prefKey()) || 'null');
			} catch {}
			const dub = (pref && dubbers.find((x) => x.id === pref.dubberId)) || dubbers[0];
			await selectDubber(dub, pref?.sourceId);
		} catch (e) {
			console.error('dubbers', e);
		}
	}

	async function selectDubber(dub, prefSourceId = null) {
		// сохраняем текущую серию и секунду при смене озвучки
		const keepPos = epPos(selectedEpisode);
		const keepTime = videoEl?.currentTime || 0;
		selectedDubber = dub;
		sources = [];
		episodes = [];
		videoUrl = '';
		try {
			const s = await getApi().release.getDubberSources(releaseId, dub.id);
			sources = s?.sources || [];
			const pref = prefSourceId ?? $playingSettings.defaultSource;
			const chosen = sources.find((x) => x.id === pref) || sources[0];
			if (chosen) await selectSource(chosen, keepPos, keepTime);
		} catch (e) {
			console.error('sources', e);
		}
	}

	async function selectSource(src, keepPos = epPos(selectedEpisode), keepTime = videoEl?.currentTime || 0) {
		selectedSource = src;
		savePref();
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
			// приоритет: та же серия при смене озвучки → сохранённая (resume) → первая
			let target = keepPos != null ? episodes.find((e) => epPos(e) === keepPos) : null;
			if (!target && pendingResume) {
				const re = episodes.find((e) => epPos(e) === pendingResume.ep);
				if (re) {
					target = re;
					pendingSeek = pendingResume.sec;
				}
			}
			pendingResume = null; // одноразово: дальше ручная навигация стартует с 0
			if (!target) target = episodes[0];
			if (keepTime > 0) pendingSeek = keepTime;
			if (target) await selectEpisode(target);
		} catch (e) {
			console.error('episodes', e);
		}
		loadingEpisodes = false;
	}

	async function selectEpisode(ep) {
		cancelAutoNext();
		selectedEpisode = ep;
		await loadVideo();
		emitSync('episode');
		const pos = epPos(ep);
		if ($playingSettings.disableHistory) return;
		if ($userToken && selectedSource && pos != null) {
			try {
				await getApi().release.addToHistory(releaseId, selectedSource.id, pos);
				await getApi().release.markEpisodeAsWatched(releaseId, selectedSource.id, pos);
			} catch {}
		} else if (!$userToken && $siteSession && release) {
			// аккаунт сайта → история в Supabase
			saveHistory(release, { episodePosition: pos, sourceId: selectedSource?.id, dubberId: selectedDubber?.id }).catch(() => {});
		}
	}

	async function loadVideo() {
		if (!selectedEpisode) return;
		loadingVideo = true;
		// сброс позиции: иначе bind:currentTime пушит старую секунду в новый источник
		currentTime = 0;
		duration = 0;
		if (videoEl) {
			try {
				videoEl.removeAttribute('src');
				videoEl.load();
			} catch {}
		}
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

			if (forceIframe) {
				mode = 'iframe';
				videoUrl = u;
			} else if (isKodik(u)) {
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
		// позиция: смена качества/озвучки или одноразовый resume (pendingSeek уже выставлен)
		const seekTarget = pendingSeek;
		pendingSeek = 0;
		if (seekTarget > 0) {
			const t = seekTarget;
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

	async function maybeAutoJoin() {
		const rid = $page.url.searchParams.get('room');
		if (!rid || !supabaseEnabled) return;
		coPanel = true;
		coName = currentSiteName() || coName;
		// дождаться загрузки эпизодов, чтобы корректно применить состояние
		await loadRelease();
		joinRoom(rid, coIdentity(), { onSync: applySync, onRequestState: sendCurrentState }, false);
	}

	onMount(() => {
		try {
			coName = currentSiteName() || localStorage.getItem('cowatch_name') || '';
			forceIframe = localStorage.getItem('force_iframe') === '1';
		} catch {
			coName = currentSiteName() || '';
		}
		const rid = $page.url.searchParams.get('room');
		if (rid && supabaseEnabled) maybeAutoJoin();
		else loadRelease();
		window.addEventListener('keydown', onKey);
		document.addEventListener('fullscreenchange', onFsChange);
	});
	onDestroy(() => {
		saveProgress(true);
		cancelAutoNext();
		destroyHls();
		clearTimeout(hideTimer);
		leaveRoom();
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
							on:play={() => emitSync('play')}
							on:pause={() => {
								emitSync('pause');
								saveProgress(true);
							}}
							on:timeupdate={() => saveProgress()}
							on:ended={onEnded}
						></video>

						{#if buffering}
							<div class="buf"><Spinner size={56} /></div>
						{:else if paused}
							<button class="big-play" on:click|stopPropagation={togglePlay} aria-label="Воспроизвести">
								<Icon name="play" size={38} />
							</button>
						{/if}

						{#if autoNextLeft > 0}
							<div class="autonext" on:click|stopPropagation>
								<span>Следующая серия через {autoNextLeft}…</span>
								<div class="an-actions">
									<button class="an-go" on:click={() => { cancelAutoNext(); nextEp(); }}>Сейчас</button>
									<button class="an-cancel" on:click={cancelAutoNext}>Отмена</button>
								</div>
							</div>
						{:else if showSkipIntro}
							<button class="skip-btn" on:click|stopPropagation={skipIntro}>
								Пропустить опенинг <Icon name="chevronRight" size={16} />
							</button>
						{:else if showSkipEnding}
							<button class="skip-btn" on:click|stopPropagation={skipEnding}>
								Следующая серия <Icon name="chevronRight" size={16} />
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
										on:input={(e) => seekLocal(+e.currentTarget.value)}
									on:change={() => emitSync('seek')}
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
											on:input={(e) => setVol(+e.currentTarget.value)}
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
												<div class="msec">
													<span class="mlabel">Плеер</span>
													<div class="mopts">
														<button class:active={!forceIframe} on:click={() => setIframe(false)}>Без рекламы</button>
														<button class:active={forceIframe} on:click={() => setIframe(true)}>Встроенный</button>
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
			{#if supabaseEnabled}
				<div class="group cowatch">
					<h3>Совместный просмотр {#if coOn}<span class="cnt">{$participants.length}</span>{/if}</h3>
					{#if !coOn}
						<p class="co-hint">Смотрите вместе с друзьями — действия плеера синхронизируются.</p>
						{#if !currentSiteName()}
							<input class="co-name" placeholder="Ваше имя" bind:value={coName} maxlength="24" />
						{/if}
						<button class="co-btn primary" on:click={startRoom}>Создать комнату</button>
					{:else}
						<div class="co-room">
							<button class="co-btn" on:click={copyRoomLink}><Icon name="feed" size={16} /> Скопировать ссылку</button>
							<div class="parts">
								{#each $participants as p (p.id)}
									<span class="part" class:host={p.host} title={p.host ? p.name + ' (хост)' : p.name}>
										{#if p.avatar}<img src={p.avatar} alt="" referrerpolicy="no-referrer" />{:else}<span class="pa">{(p.name || '?')[0]}</span>{/if}
										{p.name}{#if p.host} ★{/if}
									</span>
								{/each}
							</div>

							{#if $isHost}
								<label class="co-toggle">
									<input type="checkbox" checked={$hostOnly} on:change={(e) => setHostOnly(e.currentTarget.checked)} />
									<span>Только я управляю</span>
								</label>
							{:else if $hostOnly}
								<p class="co-hint">Воспроизведением управляет хост.</p>
							{/if}
							<div class="chatbox">
								<div class="msgs">
									{#each $chat as m (m.ts + m.from)}
										<div class="msg"><b>{m.name}:</b> {m.text}</div>
									{/each}
								</div>
								<form class="chat-in" on:submit|preventDefault={submitChat}>
									<input placeholder="Сообщение…" bind:value={chatText} maxlength="300" />
									<button type="submit" aria-label="Отправить"><Icon name="chevronRight" size={18} /></button>
								</form>
							</div>
							<button class="co-btn danger" on:click={leaveCo}>Выйти из комнаты</button>
						</div>
					{/if}
				</div>
			{/if}

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

			<div class="group">
				<h3>Плеер</h3>
				<div class="seg">
					<button class="seg-btn" class:active={!forceIframe} on:click={() => setIframe(false)}>
						⚡ Без рекламы
					</button>
					<button class="seg-btn" class:active={forceIframe} on:click={() => setIframe(true)}>
						Встроенный
					</button>
				</div>
				<p class="seg-hint">«Встроенный» — плеер Kodik с рекламой; включите, если прямой поток не грузится.</p>
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

	/* кнопки пропуска опенинга/эндинга */
	.skip-btn {
		position: absolute;
		right: 24px;
		bottom: 92px;
		z-index: 3;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 11px 18px;
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.25);
		background: rgba(20, 20, 24, 0.72);
		backdrop-filter: blur(8px);
		color: #fff;
		font-weight: 700;
		font-size: 14px;
		cursor: pointer;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
		transition: background 0.15s ease, transform 0.15s ease;
		animation: fadeInUp 0.3s ease;
	}
	.skip-btn:hover {
		background: var(--primary-color);
		border-color: transparent;
		transform: translateY(-2px);
	}
	@media (max-width: 768px) {
		.skip-btn {
			right: 14px;
			bottom: 84px;
			padding: 9px 14px;
			font-size: 13px;
		}
	}

	/* автопереход к след. серии */
	.autonext {
		position: absolute;
		right: 24px;
		bottom: 92px;
		z-index: 4;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 16px 18px;
		border-radius: 14px;
		background: rgba(18, 18, 22, 0.9);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.14);
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
		color: #fff;
		font-weight: 600;
		font-size: 14px;
		animation: fadeInUp 0.3s ease;
	}
	.an-actions {
		display: flex;
		gap: 8px;
	}
	.an-go,
	.an-cancel {
		flex: 1;
		padding: 8px 14px;
		border-radius: 10px;
		border: none;
		cursor: pointer;
		font-weight: 700;
		font-size: 13px;
	}
	.an-go {
		background: var(--primary-color);
		color: #fff;
	}
	.an-cancel {
		background: rgba(255, 255, 255, 0.12);
		color: #fff;
	}
	@media (max-width: 768px) {
		.autonext {
			right: 14px;
			bottom: 84px;
		}
	}
	.seg {
		display: flex;
		gap: 4px;
		padding: 4px;
		border-radius: 12px;
		background: var(--background-color);
		border: 1px solid var(--glass-border);
	}
	.seg-btn {
		flex: 1;
		padding: 9px 10px;
		border: none;
		background: transparent;
		color: var(--secondary-text-color);
		border-radius: 9px;
		cursor: pointer;
		font-size: 13px;
		font-weight: 700;
		transition: background 0.15s ease, color 0.15s ease;
	}
	.seg-btn.active {
		background: var(--primary-color);
		color: #fff;
	}
	.seg-hint {
		margin-top: 8px;
		font-size: 12px;
		line-height: 1.4;
		color: var(--third-text-color);
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

	/* совместный просмотр */
	.cowatch {
		padding-bottom: 20px;
		border-bottom: 1px solid var(--glass-border);
	}
	.co-hint {
		font-size: 12.5px;
		color: var(--secondary-text-color);
		line-height: 1.5;
		margin-bottom: 12px;
	}
	.co-name,
	.chat-in input {
		width: 100%;
		padding: 10px 12px;
		border-radius: 10px;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
		color: var(--text-color);
		font-size: 13px;
		outline: none;
		margin-bottom: 10px;
	}
	.co-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		padding: 11px;
		border: 1px solid var(--glass-border);
		background: var(--elevated-color);
		color: var(--text-color);
		border-radius: 10px;
		cursor: pointer;
		font-weight: 600;
		font-size: 13px;
	}
	.co-btn.primary {
		background: var(--primary-color);
		border-color: transparent;
		color: #fff;
	}
	.co-btn.danger {
		color: var(--danger-color);
	}
	.co-room {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.parts {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.part {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 9px 4px 4px;
		background: var(--alt-background-color);
		border-radius: 20px;
		font-size: 12px;
	}
	.part.host {
		background: color-mix(in srgb, var(--primary-color) 22%, var(--alt-background-color));
	}
	.co-toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--secondary-text-color);
		cursor: pointer;
		user-select: none;
	}
	.co-toggle input {
		width: 16px;
		height: 16px;
		accent-color: var(--primary-color);
	}
	.part img,
	.part .pa {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		object-fit: cover;
		display: grid;
		place-items: center;
		background: var(--primary-color);
		color: #fff;
		font-size: 11px;
		font-weight: 700;
	}
	.chatbox {
		display: flex;
		flex-direction: column;
		background: var(--background-color);
		border: 1px solid var(--glass-border);
		border-radius: 12px;
		overflow: hidden;
	}
	.msgs {
		max-height: 180px;
		overflow-y: auto;
		padding: 10px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 13px;
	}
	.msg b {
		color: var(--primary-color);
	}
	.chat-in {
		display: flex;
		gap: 6px;
		padding: 8px;
		border-top: 1px solid var(--glass-border);
	}
	.chat-in input {
		margin-bottom: 0;
	}
	.chat-in button {
		flex-shrink: 0;
		width: 38px;
		border: none;
		border-radius: 10px;
		background: var(--primary-color);
		color: #fff;
		cursor: pointer;
		display: grid;
		place-items: center;
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
