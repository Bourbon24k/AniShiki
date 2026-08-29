<script>
	/**
	 * Настройки.
	 *
	 * Раньше здесь были только тема, плеер и эндпоинт. Теперь сюда же вынесено
	 * всё, что Anixart позволяет менять в профиле через API: никнейм, статус,
	 * аватар, соцсети, приватность и подписки на уведомления. Каждый раздел
	 * открывается шторкой, чтобы список настроек оставался обозримым.
	 */
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		guiSettings,
		endpointUrl,
		playingSettings,
		playerSettings,
		userToken,
		notificationCount,
		showToast
	} from '$lib/stores';
	import { getApi, reinitApi } from '$lib/api';
	import {
		themeValues,
		endpointValues,
		sourceValues,
		qualityValues,
		aspectRatioValues,
		playerSpeedValues,
		privacyOptions
	} from '$lib/utils';
	import { uploadAvatar } from '$lib/anixart';
	import { clearCatalogCache } from '$lib/catalog';
	import { supabase, supabaseEnabled } from '$lib/supabase';
	import { siteSession, siteProfile, siteSignOut, currentSiteName, refreshProfile } from '$lib/stores/auth';
	import { updateProfile, uploadAvatar as uploadSiteAvatar } from '$lib/sitedata';
	import {
		standalone,
		notificationPermission,
		requestNotifications,
		showLocalNotification,
		installPrompt,
		promptInstall,
		isIosSafari
	} from '$lib/pwa';
	import Icon from '$lib/components/Icon.svelte';
	import Sheet from '$lib/components/Sheet.svelte';

	/* ── состояние аккаунта Anixart ── */

	let prefs = null; // /profile/preference/my
	let me = null; // профиль целиком: оттуда флаги уведомлений
	let loadingAccount = false;

	let sheet = null; // 'login' | 'status' | 'avatar' | 'social' | 'privacy' | 'notifications'
	let saving = false;

	let loginDraft = '';
	let statusDraft = '';
	let socialDraft = { vkPage: '', tgPage: '', ttPage: '', instPage: '', discordPage: '' };
	let avatarInput;
	let avatarBusy = false;

	const privacyKeys = [
		{ key: 'stats', field: 'privacy_stats', label: 'Статистика, оценки и история', method: 'setPrivacyStats' },
		{ key: 'counts', field: 'privacy_counts', label: 'Комментарии, коллекции, друзья', method: 'setPrivacyCounts' },
		{ key: 'social', field: 'privacy_social', label: 'Социальные сети', method: 'setPrivacySocial' }
	];

	// У заявок в друзья свой набор значений: 0 — все, 1 — никто.
	const friendRequestOptions = [
		{ value: 0, label: 'Все пользователи' },
		{ value: 1, label: 'Никто' }
	];

	const notificationToggles = [
		{ field: 'is_episode_notifications_enabled', method: 'setEpisodeNotification', label: 'Новые серии' },
		{ field: 'is_related_release_notifications_enabled', method: 'setRelatedReleaseNotification', label: 'Связанные релизы' },
		{ field: 'is_comment_notifications_enabled', method: 'setCommentNotification', label: 'Ответы на комментарии' },
		{ field: 'is_my_collection_comment_notifications_enabled', method: 'setCollectionCommentNotification', label: 'Комментарии в моих коллекциях' },
		{ field: 'is_report_process_notifications_enabled', method: 'setReportProgressNotification', label: 'Обработка жалоб' }
	];

	// Тот же набор подписок для собственного аккаунта. Раньше у AniShiki их
	// вообще не было: уведомления либо приходили все, либо не приходили вовсе.
	const siteNotificationToggles = [
		{ field: 'is_episode_notifications_enabled', label: 'Новые серии' },
		{ field: 'is_related_release_notifications_enabled', label: 'Связанные релизы' },
		{ field: 'is_comment_notifications_enabled', label: 'Ответы на комментарии' },
		{ field: 'is_my_collection_comment_notifications_enabled', label: 'Комментарии в моих коллекциях' },
		{ field: 'is_report_process_notifications_enabled', label: 'Обработка жалоб' }
	];

	async function loadAccount() {
		if (!$userToken) return;
		loadingAccount = true;
		const api = getApi();
		const [p, profile] = await Promise.all([
			api.settings.getCurrentProfileSettings().catch((e) => {
				console.error('preferences', e);
				return null;
			}),
			api.profile
				.info(Number($userToken.id))
				.then((d) => d?.profile)
				.catch((e) => {
					console.error('profile', e);
					return null;
				})
		]);
		prefs = p;
		me = profile;
		loadingAccount = false;
	}

	function openSheet(name) {
		if (name === 'status') statusDraft = me?.status || prefs?.status || '';
		if (name === 'login') loginDraft = $userToken?.login || me?.login || '';
		if (name === 'social') {
			socialDraft = {
				vkPage: me?.vk_page || '',
				tgPage: me?.tg_page || '',
				ttPage: me?.tt_page || '',
				instPage: me?.inst_page || '',
				discordPage: me?.discord_page || ''
			};
		}
		sheet = name;
	}

	async function saveStatus() {
		saving = true;
		try {
			await getApi().settings.setStatus(statusDraft.trim());
			me = { ...me, status: statusDraft.trim() };
			showToast('Статус обновлён', 'success');
			sheet = null;
		} catch (e) {
			console.error('status', e);
			showToast('Не удалось сохранить статус', 'error');
		}
		saving = false;
	}

	async function saveLogin() {
		const value = loginDraft.trim();
		if (!value) return showToast('Никнейм не может быть пустым', 'error');
		saving = true;
		try {
			await getApi().settings.changeLogin(value);
			userToken.update((t) => (t ? { ...t, login: value } : t));
			showToast('Никнейм изменён', 'success');
			sheet = null;
		} catch (e) {
			console.error('login', e);
			// code 3 — такой ник уже занят; остальное разбирать смысла нет.
			showToast(e?.code === 3 ? 'Такой никнейм уже занят' : 'Не удалось сменить никнейм', 'error');
		}
		saving = false;
	}

	/** Ссылки вида vk.com/name сервер не принимает — оставляем голый ник. */
	function cleanHandle(value) {
		return String(value || '')
			.trim()
			.replace(/^https?:\/\/(www\.)?/i, '')
			.replace(/^(vk\.com|t\.me|telegram\.me|tiktok\.com|instagram\.com|discord\.com)\//i, '')
			.replace(/^@/, '')
			.replace(/\/+$/, '');
	}

	async function saveSocial() {
		saving = true;
		try {
			await getApi().settings.setSocial({
				vk_page: cleanHandle(socialDraft.vkPage),
				tg_page: cleanHandle(socialDraft.tgPage),
				tt_page: cleanHandle(socialDraft.ttPage),
				inst_page: cleanHandle(socialDraft.instPage),
				discord_page: cleanHandle(socialDraft.discordPage)
			});
			me = {
				...me,
				vk_page: cleanHandle(socialDraft.vkPage),
				tg_page: cleanHandle(socialDraft.tgPage),
				tt_page: cleanHandle(socialDraft.ttPage),
				inst_page: cleanHandle(socialDraft.instPage),
				discord_page: cleanHandle(socialDraft.discordPage)
			};
			showToast('Соцсети сохранены', 'success');
			sheet = null;
		} catch (e) {
			console.error('social', e);
			showToast('Не удалось сохранить', 'error');
		}
		saving = false;
	}

	async function onAvatarPicked(event) {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file) return;
		if (file.size > 5 * 1024 * 1024) return showToast('Файл больше 5 МБ', 'error');
		avatarBusy = true;
		try {
			await uploadAvatar(file);
			await loadAccount();
			if (me?.avatar) userToken.update((t) => (t ? { ...t, avatar: me.avatar } : t));
			showToast('Аватар обновлён', 'success');
		} catch (e) {
			console.error('avatar', e);
			showToast('Не удалось загрузить аватар', 'error');
		}
		avatarBusy = false;
	}

	async function setPrivacy(item, value) {
		const previous = prefs?.[item.field];
		prefs = { ...prefs, [item.field]: value };
		try {
			await getApi().settings[item.method](Number(value));
			showToast('Настройка сохранена', 'success');
		} catch (e) {
			console.error('privacy', e);
			prefs = { ...prefs, [item.field]: previous };
			showToast('Не удалось сохранить', 'error');
		}
	}

	async function setFriendRequests(value) {
		const previous = prefs?.privacy_friend_requests;
		prefs = { ...prefs, privacy_friend_requests: value };
		try {
			await getApi().settings.setPrivacyFriendRequests(Number(value));
			showToast('Настройка сохранена', 'success');
		} catch (e) {
			console.error('friend requests', e);
			prefs = { ...prefs, privacy_friend_requests: previous };
			showToast('Не удалось сохранить', 'error');
		}
	}

	/** Ручки уведомлений Anixart переключают состояние, а не задают его. */
	async function toggleNotification(item) {
		const previous = !!me?.[item.field];
		me = { ...me, [item.field]: !previous };
		try {
			await getApi().settings[item.method]();
		} catch (e) {
			console.error('notification setting', e);
			me = { ...me, [item.field]: previous };
			showToast('Не удалось изменить', 'error');
		}
	}

	/* ── локальные настройки ── */

	function setTheme(theme) {
		guiSettings.update((s) => ({ ...s, theme }));
	}
	function setCardType(releaseCardType) {
		guiSettings.update((s) => ({ ...s, releaseCardType }));
	}
	function setEndpoint(value) {
		endpointUrl.set(value);
		reinitApi();
		clearCatalogCache();
		showToast('Сервер изменён', 'success');
	}
	function patchPlaying(patch) {
		playingSettings.update((s) => ({ ...s, ...patch }));
	}
	function patchPlayer(patch) {
		playerSettings.update((s) => ({ ...s, ...patch }));
	}

	/* ── приложение ── */

	async function enableSystemNotifications() {
		const result = await requestNotifications();
		if (result === 'granted') {
			showToast('Уведомления включены', 'success');
			showLocalNotification({
				title: 'Уведомления включены',
				body: 'Сообщим, когда выйдет новая серия',
				url: '/notifications'
			});
		} else if (result === 'denied') {
			showToast('Разрешение отклонено — включите его в настройках устройства', 'error');
		}
	}

	async function install() {
		if ($installPrompt) await promptInstall($installPrompt);
	}

	async function clearCaches() {
		clearCatalogCache();
		try {
			const keys = await caches.keys();
			await Promise.all(keys.filter((k) => !k.startsWith('anishiki-app-')).map((k) => caches.delete(k)));
			showToast('Кэш очищен', 'success');
		} catch (e) {
			console.error('clear caches', e);
			showToast('Не удалось очистить кэш', 'error');
		}
	}

	/* ── аккаунт сайта: те же настройки, что и у Anixart ── */

	let siteLoginDraft = '';
	let siteStatusDraft = '';
	let siteSocialDraft = { vk_page: '', tg_page: '', tt_page: '', inst_page: '', discord_page: '' };
	let siteAvatarInput;
	let siteAvatarBusy = false;
	let siteSaving = false;

	// У аккаунта сайта теперь та же трёхступенчатая приватность, что у Anixart.
	// Старые флаги пишем вместе с новым полем, чтобы существующие профили не
	// меняли поведение до применения миграции.
	const sitePrivacyKeys = [
		{ field: 'privacy_stats', legacy: 'is_stats_hidden', label: 'Статистика, оценки и история', options: privacyOptions },
		{ field: 'privacy_counts', legacy: 'is_counts_hidden', label: 'Комментарии, коллекции, друзья', options: privacyOptions },
		{ field: 'privacy_social', legacy: 'is_social_hidden', label: 'Социальные сети', options: privacyOptions },
		{
			field: 'privacy_friend_requests',
			legacy: 'is_friend_requests_disallowed',
			label: 'Заявки в друзья',
			options: [
				{ value: 0, label: 'Все пользователи' },
				{ value: 2, label: 'Никто' }
			]
		}
	];

	function openSiteSheet(name) {
		const p = $siteProfile || {};
		if (name === 'site-login') siteLoginDraft = p.username || '';
		if (name === 'site-status') siteStatusDraft = p.status || '';
		if (name === 'site-social') {
			siteSocialDraft = {
				vk_page: p.vk_page || '',
				tg_page: p.tg_page || '',
				tt_page: p.tt_page || '',
				inst_page: p.inst_page || '',
				discord_page: p.discord_page || ''
			};
		}
		sheet = name;
	}

	async function saveSiteProfile(patch, message) {
		siteSaving = true;
		try {
			await updateProfile(patch);
			await refreshProfile();
			showToast(message, 'success');
			sheet = null;
		} catch (e) {
			console.error('site profile', e);
			// 23505 — ник занят: у username в БД уникальный индекс.
			showToast(e?.code === '23505' ? 'Такой никнейм уже занят' : 'Не удалось сохранить', 'error');
		}
		siteSaving = false;
	}

	async function onSiteAvatarPicked(event) {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file) return;
		if (file.size > 5 * 1024 * 1024) return showToast('Файл больше 5 МБ', 'error');
		siteAvatarBusy = true;
		try {
			const url = await uploadSiteAvatar(file);
			await updateProfile({ avatar_url: url });
			await refreshProfile();
			showToast('Аватар обновлён', 'success');
		} catch (e) {
			console.error('site avatar', e);
			showToast('Не удалось загрузить аватар', 'error');
		}
		siteAvatarBusy = false;
	}

	let passwordDraft = '';
	let passwordRepeat = '';
	let emailDraft = '';

	/** Смена пароля и почты идут через сам Supabase Auth, не через profiles. */
	async function saveSitePassword() {
		if (passwordDraft.length < 6) return showToast('Пароль короче шести символов', 'error');
		// Повтор обязателен: без него опечатка молча становится новым паролем,
		// а вспомнить его будет неоткуда.
		if (passwordDraft !== passwordRepeat) return showToast('Пароли не совпадают', 'error');
		siteSaving = true;
		try {
			const { error } = await supabase.auth.updateUser({ password: passwordDraft });
			if (error) throw error;
			passwordDraft = '';
			passwordRepeat = '';
			showToast('Пароль изменён', 'success');
			sheet = null;
		} catch (e) {
			console.error('site password', e);
			showToast('Не удалось сменить пароль', 'error');
		}
		siteSaving = false;
	}

	async function saveSiteEmail() {
		const value = emailDraft.trim();
		if (!value) return showToast('Укажите адрес', 'error');
		siteSaving = true;
		try {
			const { error } = await supabase.auth.updateUser({ email: value });
			if (error) throw error;
			showToast('Проверьте почту — нужно подтвердить адрес', 'info');
			sheet = null;
		} catch (e) {
			console.error('site email', e);
			showToast('Не удалось сменить адрес', 'error');
		}
		siteSaving = false;
	}

	function sitePrivacyValue(item) {
		const value = Number($siteProfile?.[item.field]);
		if (value === 0 || value === 1 || value === 2) return value;
		return $siteProfile?.[item.legacy] ? 2 : 0;
	}

	async function setSitePrivacy(item, value) {
		try {
			await updateProfile({ [item.field]: value, [item.legacy]: value === 2 });
			await refreshProfile();
		} catch (e) {
			console.error('site privacy', e);
			// Пока обновление базы не применено, старые флаги всё ещё умеют
			// «всем / никому». Не делаем вид, что «только друзьям» уже работает.
			if (e?.code === '42703' && value !== 1) {
				try {
					await updateProfile({ [item.legacy]: value === 2 });
					await refreshProfile();
					return;
				} catch (legacyError) {
					console.error('site privacy legacy', legacyError);
				}
			}
			showToast(value === 1 ? 'Режим «только друзьям» появится после обновления базы' : 'Не удалось сохранить', 'error');
		}
	}

	async function toggleSiteNotification(item) {
		const previous = $siteProfile?.[item.field];
		try {
			await updateProfile({ [item.field]: previous !== false });
			await refreshProfile();
		} catch (e) {
			console.error('site notification', e);
			showToast('Не удалось изменить подписку', 'error');
		}
	}

	async function siteLogout() {
		await siteSignOut();
		showToast('Вы вышли из аккаунта AniShiki', 'info');
	}

	function logout() {
		userToken.set(null);
		notificationCount.set(0);
		prefs = null;
		me = null;
		reinitApi();
		showToast('Вы вышли', 'info');
		goto('/');
	}

	onMount(loadAccount);
</script>

<svelte:head><title>Настройки — AniShiki</title></svelte:head>

<div class="page">
	<div class="inner">
		<h1>Настройки</h1>

		{#if $userToken}
			<section class="card">
				<a class="account" href={`/profile/${$userToken.id}`}>
					<div class="ava">
						{#if me?.avatar || $userToken.avatar}
							<img src={me?.avatar || $userToken.avatar} alt="" referrerpolicy="no-referrer" />
						{:else}
							<Icon name="user" size={26} />
						{/if}
					</div>
					<div class="who">
						<span class="login">{$userToken.login}</span>
						<span class="sub">{me?.status || 'Открыть профиль'}</span>
					</div>
					<Icon name="chevronRight" size={20} />
				</a>

				<div class="rows">
					<button class="row" on:click={() => avatarInput.click()} disabled={avatarBusy}>
						<Icon name="user" size={18} />
						<span>Аватар</span>
						<span class="value">{avatarBusy ? 'Загрузка…' : 'Заменить'}</span>
						<Icon name="chevronRight" size={17} />
					</button>
					<button class="row" on:click={() => openSheet('login')}>
						<Icon name="feed" size={18} />
						<span>Никнейм</span>
						<span class="value">{$userToken.login}</span>
						<Icon name="chevronRight" size={17} />
					</button>
					<button class="row" on:click={() => openSheet('status')}>
						<Icon name="star" size={18} />
						<span>Статус</span>
						<span class="value">{me?.status ? 'Изменить' : 'Не задан'}</span>
						<Icon name="chevronRight" size={17} />
					</button>
					<button class="row" on:click={() => openSheet('social')}>
						<Icon name="friends" size={18} />
						<span>Социальные сети</span>
						<Icon name="chevronRight" size={17} />
					</button>
					<button class="row" on:click={() => openSheet('privacy')}>
						<Icon name="bookmark" size={18} />
						<span>Приватность</span>
						<Icon name="chevronRight" size={17} />
					</button>
					<button class="row" on:click={() => openSheet('notifications')}>
						<Icon name="notification" size={18} />
						<span>Уведомления Anixart</span>
						<Icon name="chevronRight" size={17} />
					</button>
				</div>

				<input type="file" accept="image/*" bind:this={avatarInput} on:change={onAvatarPicked} hidden />
				<button class="logout" on:click={logout}>Выйти из аккаунта</button>
			</section>
		{:else}
			<section class="card">
				<a class="login-cta" href="/login">Войти в аккаунт Anixart</a>
				<p class="hint center">С аккаунтом синхронизируются списки, оценки и комментарии.</p>
			</section>
		{/if}

		{#if supabaseEnabled}
			<section class="card">
				<h2>Аккаунт AniShiki</h2>
				{#if $siteSession}
					<div class="account static">
						<div class="ava">
							{#if $siteProfile?.avatar_url}
								<img src={$siteProfile.avatar_url} alt="" referrerpolicy="no-referrer" />
							{:else}
								<Icon name="user" size={26} />
							{/if}
						</div>
						<div class="who">
							<span class="login">{currentSiteName()}</span>
							<span class="sub">{$siteSession.user?.email}</span>
						</div>
					</div>
					<div class="rows">
						<a class="row" href={`/u/${$siteSession.user.id}`}>
							<Icon name="settings" size={18} />
							<span>Профиль и статистика</span>
							<Icon name="chevronRight" size={17} />
						</a>
						<button class="row" on:click={() => siteAvatarInput.click()} disabled={siteAvatarBusy}>
							<Icon name="user" size={18} />
							<span>Аватар</span>
							<span class="value">{siteAvatarBusy ? 'Загрузка…' : 'Заменить'}</span>
							<Icon name="chevronRight" size={17} />
						</button>
						<button class="row" on:click={() => openSiteSheet('site-login')}>
							<Icon name="feed" size={18} />
							<span>Никнейм</span>
							<span class="value">{$siteProfile?.username || '—'}</span>
							<Icon name="chevronRight" size={17} />
						</button>
						<button class="row" on:click={() => openSiteSheet('site-status')}>
							<Icon name="star" size={18} />
							<span>Статус</span>
							<span class="value">{$siteProfile?.status ? 'Изменить' : 'Не задан'}</span>
							<Icon name="chevronRight" size={17} />
						</button>
						<button class="row" on:click={() => openSiteSheet('site-social')}>
							<Icon name="friends" size={18} />
							<span>Социальные сети</span>
							<Icon name="chevronRight" size={17} />
						</button>
						<button class="row" on:click={() => openSiteSheet('site-privacy')}>
							<Icon name="bookmark" size={18} />
							<span>Приватность</span>
							<Icon name="chevronRight" size={17} />
						</button>
						<button class="row" on:click={() => openSiteSheet('site-notifications')}>
							<Icon name="notification" size={18} />
							<span>Уведомления AniShiki</span>
							<Icon name="chevronRight" size={17} />
						</button>
						<button class="row" on:click={() => { emailDraft = $siteSession.user?.email || ''; sheet = 'site-email'; }}>
							<Icon name="notification" size={18} />
							<span>Почта</span>
							<span class="value">{$siteSession.user?.email}</span>
							<Icon name="chevronRight" size={17} />
						</button>
						<button class="row" on:click={() => { passwordDraft = ''; passwordRepeat = ''; sheet = 'site-password'; }}>
							<Icon name="settings" size={18} />
							<span>Пароль</span>
							<span class="value">Сменить</span>
							<Icon name="chevronRight" size={17} />
						</button>
					</div>
					<input type="file" accept="image/*" bind:this={siteAvatarInput} on:change={onSiteAvatarPicked} hidden />
					<button class="logout" on:click={siteLogout}>Выйти из аккаунта AniShiki</button>
				{:else}
					<a class="login-cta" href="/register">Создать аккаунт AniShiki</a>
				{/if}
			</section>
		{/if}

		<section class="card">
			<h2>Внешний вид</h2>
			<div class="field">
				<span class="label">Тема</span>
				<div class="chips">
					{#each themeValues as t}
						<button class="chip" class:active={$guiSettings.theme === t.value} on:click={() => setTheme(t.value)}>{t.label}</button>
					{/each}
				</div>
			</div>
			<div class="field">
				<span class="label">Карточки в списках</span>
				<div class="chips">
					<button class="chip" class:active={$guiSettings.releaseCardType !== 'poster'} on:click={() => setCardType('grid')}>С подписью</button>
					<button class="chip" class:active={$guiSettings.releaseCardType === 'poster'} on:click={() => setCardType('poster')}>Только постер</button>
				</div>
			</div>
		</section>

		<section class="card">
			<h2>Воспроизведение</h2>
			<div class="field">
				<span class="label">Источник по умолчанию</span>
				<div class="chips">
					{#each sourceValues as s}
						<button class="chip" class:active={$playingSettings.defaultSource === s.value} on:click={() => patchPlaying({ defaultSource: s.value })}>{s.label}</button>
					{/each}
				</div>
			</div>
			<div class="field">
				<span class="label">Качество по умолчанию</span>
				<div class="chips">
					{#each qualityValues as q}
						<button class="chip" class:active={$playingSettings.defaultQuality === q.value} on:click={() => patchPlaying({ defaultQuality: q.value })}>{q.label}</button>
					{/each}
				</div>
			</div>
			<div class="field">
				<span class="label">Скорость по умолчанию</span>
				<div class="chips">
					{#each playerSpeedValues as s}
						<button class="chip" class:active={$playerSettings.defaultSpeed === s.value} on:click={() => patchPlayer({ defaultSpeed: s.value })}>{s.label}</button>
					{/each}
				</div>
			</div>
			<div class="field">
				<span class="label">Соотношение сторон</span>
				<div class="chips">
					{#each aspectRatioValues as a}
						<button class="chip" class:active={$playerSettings.defaultAspectRatio === a.value} on:click={() => patchPlayer({ defaultAspectRatio: a.value })}>{a.label}</button>
					{/each}
				</div>
			</div>
			<div class="field row">
				<div>
					<span class="label">Автоматически включать следующую серию</span>
				</div>
				<button
					class="toggle"
					class:on={$playerSettings.autoplayEpisode}
					on:click={() => patchPlayer({ autoplayEpisode: !$playerSettings.autoplayEpisode })}
					aria-label="Переключить"
				><span class="knob"></span></button>
			</div>
			<div class="field row">
				<div>
					<span class="label">Помнить громкость</span>
					<span class="hint">Уровень звука сохраняется между сериями</span>
				</div>
				<button
					class="toggle"
					class:on={$playerSettings.saveUserVolume?.enabled}
					on:click={() =>
						patchPlayer({
							saveUserVolume: {
								...$playerSettings.saveUserVolume,
								enabled: !$playerSettings.saveUserVolume?.enabled
							}
						})}
					aria-label="Переключить"
				><span class="knob"></span></button>
			</div>
			<div class="field row">
				<div>
					<span class="label">Не сохранять историю просмотра</span>
					<span class="hint">Эпизоды не будут отмечаться как просмотренные</span>
				</div>
				<button
					class="toggle"
					class:on={$playingSettings.disableHistory}
					on:click={() => patchPlaying({ disableHistory: !$playingSettings.disableHistory })}
					aria-label="Переключить"
				><span class="knob"></span></button>
			</div>
		</section>

		<section class="card">
			<h2>Приложение</h2>
			<div class="field row">
				<div>
					<span class="label">Системные уведомления</span>
					<span class="hint">
						{#if $notificationPermission === 'granted'}
							Разрешены — новые события придут сразу, пока приложение запущено
						{:else if $notificationPermission === 'denied'}
							Запрещены в настройках устройства
						{:else if !$standalone && isIosSafari()}
							На iPhone доступны только в установленном приложении
						{:else}
							Покажем новые серии, ответы и заявки в друзья
						{/if}
					</span>
				</div>
				{#if $notificationPermission === 'default'}
					<button class="mini" on:click={enableSystemNotifications}>Включить</button>
				{/if}
			</div>

			{#if !$standalone}
				<div class="field row">
					<div>
						<span class="label">Установить приложение</span>
						<span class="hint">
							{isIosSafari()
								? 'Поделиться → «На экран «Домой»'
								: 'Ярлык, полный экран и работа офлайн'}
						</span>
					</div>
					{#if $installPrompt}
						<button class="mini" on:click={install}>Установить</button>
					{/if}
				</div>
			{/if}

			<div class="field row">
				<div>
					<span class="label">Очистить кэш</span>
					<span class="hint">Постеры и сохранённые списки. Аккаунт и настройки не тронем.</span>
				</div>
				<button class="mini" on:click={clearCaches}>Очистить</button>
			</div>
		</section>

		<section class="card">
			<h2>Сервер API</h2>
			<div class="field">
				<span class="label">Эндпоинт</span>
				<div class="chips">
					{#each endpointValues as e}
						<button class="chip" class:active={$endpointUrl === e.value} on:click={() => setEndpoint(e.value)}>{e.label}</button>
					{/each}
				</div>
				<span class="hint">При проблемах с загрузкой попробуйте сменить сервер.</span>
			</div>
		</section>

		<p class="about">
			AniShiki — неофициальный веб-клиент Anixart. Создано на основе открытых API.
			Не связано с Anixart. <span class="beta">β</span>
		</p>
	</div>
</div>

<!-- ── шторки ── -->

<Sheet open={sheet === 'login'} title="Никнейм" on:close={() => (sheet = null)}>
	<label class="f">
		<span>Новый никнейм</span>
		<input bind:value={loginDraft} maxlength="24" placeholder="Никнейм" />
	</label>
	<p class="hint">Anixart разрешает менять никнейм не чаще, чем раз в некоторое время.</p>
	<svelte:fragment slot="footer">
		<button class="btn primary wide" on:click={saveLogin} disabled={saving}>
			{saving ? 'Сохранение…' : 'Сохранить'}
		</button>
	</svelte:fragment>
</Sheet>

<Sheet open={sheet === 'status'} title="Статус" on:close={() => (sheet = null)}>
	<label class="f">
		<span>О себе</span>
		<textarea bind:value={statusDraft} rows="4" maxlength="255" placeholder="Пара слов о себе"></textarea>
	</label>
	<p class="hint">{statusDraft.length}/255</p>
	<svelte:fragment slot="footer">
		<button class="btn primary wide" on:click={saveStatus} disabled={saving}>
			{saving ? 'Сохранение…' : 'Сохранить'}
		</button>
	</svelte:fragment>
</Sheet>

<Sheet open={sheet === 'social'} title="Социальные сети" on:close={() => (sheet = null)}>
	<label class="f"><span>VK</span><input bind:value={socialDraft.vkPage} placeholder="username" /></label>
	<label class="f"><span>Telegram</span><input bind:value={socialDraft.tgPage} placeholder="username" /></label>
	<label class="f"><span>TikTok</span><input bind:value={socialDraft.ttPage} placeholder="username" /></label>
	<label class="f"><span>Instagram</span><input bind:value={socialDraft.instPage} placeholder="username" /></label>
	<label class="f"><span>Discord</span><input bind:value={socialDraft.discordPage} placeholder="username" /></label>
	<p class="hint">Достаточно имени пользователя — ссылку соберём сами.</p>
	<svelte:fragment slot="footer">
		<button class="btn primary wide" on:click={saveSocial} disabled={saving}>
			{saving ? 'Сохранение…' : 'Сохранить'}
		</button>
	</svelte:fragment>
</Sheet>

<Sheet open={sheet === 'privacy'} title="Приватность" tall on:close={() => (sheet = null)}>
	{#if loadingAccount}
		<p class="hint">Загрузка…</p>
	{:else}
		{#each privacyKeys as item}
			<div class="fgroup">
				<h3>{item.label}</h3>
				<div class="chips">
					{#each privacyOptions as o}
						<button
							class="chip small"
							class:active={Number(prefs?.[item.field]) === o.value}
							on:click={() => setPrivacy(item, o.value)}
						>{o.label}</button>
					{/each}
				</div>
			</div>
		{/each}
		<div class="fgroup">
			<h3>Кто может отправлять заявки в друзья</h3>
			<div class="chips">
				{#each friendRequestOptions as o}
					<button
						class="chip small"
						class:active={Number(prefs?.privacy_friend_requests) === o.value}
						on:click={() => setFriendRequests(o.value)}
					>{o.label}</button>
				{/each}
			</div>
		</div>
	{/if}
</Sheet>

<Sheet open={sheet === 'site-login'} title="Никнейм" on:close={() => (sheet = null)}>
	<label class="f">
		<span>Имя пользователя</span>
		<input bind:value={siteLoginDraft} maxlength="32" placeholder="Никнейм" />
	</label>
	<svelte:fragment slot="footer">
		<button
			class="btn primary wide"
			on:click={() => saveSiteProfile({ username: siteLoginDraft.trim() }, 'Никнейм изменён')}
			disabled={siteSaving || !siteLoginDraft.trim()}
		>{siteSaving ? 'Сохранение…' : 'Сохранить'}</button>
	</svelte:fragment>
</Sheet>

<Sheet open={sheet === 'site-status'} title="Статус" on:close={() => (sheet = null)}>
	<label class="f">
		<span>О себе</span>
		<textarea bind:value={siteStatusDraft} rows="4" maxlength="255" placeholder="Пара слов о себе"></textarea>
	</label>
	<p class="hint">{siteStatusDraft.length}/255</p>
	<svelte:fragment slot="footer">
		<button
			class="btn primary wide"
			on:click={() => saveSiteProfile({ status: siteStatusDraft.trim() || null }, 'Статус обновлён')}
			disabled={siteSaving}
		>{siteSaving ? 'Сохранение…' : 'Сохранить'}</button>
	</svelte:fragment>
</Sheet>

<Sheet open={sheet === 'site-social'} title="Социальные сети" on:close={() => (sheet = null)}>
	<label class="f"><span>VK</span><input bind:value={siteSocialDraft.vk_page} placeholder="username" /></label>
	<label class="f"><span>Telegram</span><input bind:value={siteSocialDraft.tg_page} placeholder="username" /></label>
	<label class="f"><span>TikTok</span><input bind:value={siteSocialDraft.tt_page} placeholder="username" /></label>
	<label class="f"><span>Instagram</span><input bind:value={siteSocialDraft.inst_page} placeholder="username" /></label>
	<label class="f"><span>Discord</span><input bind:value={siteSocialDraft.discord_page} placeholder="username" /></label>
	<p class="hint">Достаточно имени пользователя — ссылку соберём сами.</p>
	<svelte:fragment slot="footer">
		<button
			class="btn primary wide"
			on:click={() =>
				saveSiteProfile(
					{
						vk_page: cleanHandle(siteSocialDraft.vk_page) || null,
						tg_page: cleanHandle(siteSocialDraft.tg_page) || null,
						tt_page: cleanHandle(siteSocialDraft.tt_page) || null,
						inst_page: cleanHandle(siteSocialDraft.inst_page) || null,
						discord_page: cleanHandle(siteSocialDraft.discord_page) || null
					},
					'Соцсети сохранены'
				)}
			disabled={siteSaving}
		>{siteSaving ? 'Сохранение…' : 'Сохранить'}</button>
	</svelte:fragment>
</Sheet>

<Sheet open={sheet === 'site-email'} title="Почта" on:close={() => (sheet = null)}>
	<label class="f"><span>Адрес</span><input type="email" bind:value={emailDraft} placeholder="you@example.com" /></label>
	<p class="hint">На новый адрес придёт письмо — пока вы не подтвердите его, вход остаётся по старому.</p>
	<svelte:fragment slot="footer">
		<button class="btn primary wide" on:click={saveSiteEmail} disabled={siteSaving}>
			{siteSaving ? 'Сохранение…' : 'Сохранить'}
		</button>
	</svelte:fragment>
</Sheet>

<Sheet open={sheet === 'site-password'} title="Пароль" on:close={() => (sheet = null)}>
	<label class="f"><span>Новый пароль</span><input type="password" bind:value={passwordDraft} placeholder="Минимум 6 символов" /></label>
	<label class="f"><span>Ещё раз</span><input type="password" bind:value={passwordRepeat} placeholder="Повторите пароль" /></label>
	<svelte:fragment slot="footer">
		<button class="btn primary wide" on:click={saveSitePassword} disabled={siteSaving}>
			{siteSaving ? 'Сохранение…' : 'Сохранить'}
		</button>
	</svelte:fragment>
</Sheet>

<Sheet open={sheet === 'site-privacy'} title="Приватность" on:close={() => (sheet = null)}>
	{#each sitePrivacyKeys as item}
		<div class="fgroup">
			<h3>{item.label}</h3>
			<div class="chips">
				{#each item.options as option}
					<button
						class="chip small"
						class:active={sitePrivacyValue(item) === option.value}
						on:click={() => setSitePrivacy(item, option.value)}
					>{option.label}</button>
				{/each}
			</div>
		</div>
	{/each}
	<p class="hint">
		Статистика, оценки, история и списки защищены правилами базы. Для соцсетей и
		счётчиков ограничение применяется в профиле, как в Anixart.
	</p>
</Sheet>

<Sheet open={sheet === 'notifications'} title="Уведомления Anixart" on:close={() => (sheet = null)}>
	{#if loadingAccount}
		<p class="hint">Загрузка…</p>
	{:else}
		{#each notificationToggles as item}
			<div class="field row bordered">
				<span class="label">{item.label}</span>
				<button class="toggle" class:on={me?.[item.field]} on:click={() => toggleNotification(item)} aria-label="Переключить">
					<span class="knob"></span>
				</button>
			</div>
		{/each}
		<p class="hint">Это подписки на стороне Anixart — они приходят в раздел «События».</p>
	{/if}
</Sheet>

<Sheet open={sheet === 'site-notifications'} title="Уведомления AniShiki" on:close={() => (sheet = null)}>
	{#each siteNotificationToggles as item}
		<div class="field row bordered">
			<span class="label">{item.label}</span>
			<button
				class="toggle"
				class:on={$siteProfile?.[item.field] !== false}
				on:click={() => toggleSiteNotification(item)}
				aria-label="Переключить"
			>
				<span class="knob"></span>
			</button>
		</div>
	{/each}
	<p class="hint">Заявки в друзья приходят всегда. Подписки действуют для новых событий.</p>
</Sheet>

<style>
	.page {
		height: 100%;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}
	.inner {
		max-width: 720px;
		margin: 0 auto;
		padding: 24px;
	}
	h1 {
		font-size: 30px;
		font-weight: 800;
		margin-bottom: 22px;
	}
	.card {
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
		border-radius: 18px;
		padding: 20px;
		margin-bottom: 18px;
	}
	.card h2 {
		font-size: 16px;
		font-weight: 700;
		margin-bottom: 16px;
	}
	.account {
		display: flex;
		align-items: center;
		gap: 14px;
		color: var(--text-color);
	}
	.ava {
		width: 54px;
		height: 54px;
		min-width: 54px;
		border-radius: 50%;
		overflow: hidden;
		display: grid;
		place-items: center;
		background: var(--background-color);
		color: var(--secondary-text-color);
	}
	.ava img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.who {
		flex: 1;
		min-width: 0;
	}
	.login {
		display: block;
		font-weight: 700;
		font-size: 16px;
	}
	.sub {
		display: block;
		font-size: 13px;
		color: var(--secondary-text-color);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.rows {
		margin-top: 16px;
		border-top: 1px solid var(--glass-border);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 13px 2px;
		border: none;
		border-bottom: 1px solid var(--glass-border);
		background: transparent;
		color: var(--text-color);
		font-size: 14.5px;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
	}
	.row:last-child {
		border-bottom: none;
	}
	.row > span:first-of-type {
		flex: 1;
	}
	.row .value {
		flex: 0 1 auto;
		font-size: 13px;
		color: var(--third-text-color);
		max-width: 45%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.row:disabled {
		opacity: 0.6;
	}

	.logout {
		width: 100%;
		margin-top: 16px;
		padding: 12px;
		border: 1px solid var(--danger-color);
		background: transparent;
		color: var(--danger-color);
		border-radius: 12px;
		font-weight: 600;
		cursor: pointer;
	}
	.login-cta {
		display: block;
		text-align: center;
		padding: 14px;
		background: var(--primary-color);
		color: #fff;
		border-radius: 12px;
		font-weight: 700;
	}

	.field {
		margin-bottom: 18px;
	}
	.field:last-child {
		margin-bottom: 0;
	}
	.field.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}
	.field.row.bordered {
		padding: 12px 0;
		margin-bottom: 0;
		border-bottom: 1px solid var(--glass-border);
	}
	.label {
		display: block;
		font-size: 14px;
		font-weight: 600;
		margin-bottom: 10px;
	}
	.field.row .label {
		margin-bottom: 2px;
	}
	.hint {
		display: block;
		font-size: 12px;
		color: var(--third-text-color);
		margin-top: 8px;
		line-height: 1.5;
	}
	.hint.center {
		text-align: center;
	}
	.field.row .hint {
		margin-top: 0;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.chip {
		padding: 9px 16px;
		border: 1px solid var(--glass-border);
		background: var(--background-color);
		color: var(--text-color);
		border-radius: 11px;
		cursor: pointer;
		font-size: 13px;
		font-weight: 500;
	}
	.chip.small {
		padding: 8px 13px;
		font-size: 12.5px;
	}
	.chip.active {
		background: var(--primary-color);
		color: #fff;
		border-color: transparent;
	}
	.mini {
		flex-shrink: 0;
		padding: 9px 15px;
		border-radius: 11px;
		border: 1px solid var(--glass-border);
		background: var(--background-color);
		color: var(--text-color);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}
	.toggle {
		width: 52px;
		height: 30px;
		min-width: 52px;
		border-radius: 16px;
		border: none;
		background: var(--gray-btn);
		position: relative;
		cursor: pointer;
		transition: background 0.2s ease;
	}
	.toggle.on {
		background: var(--primary-color);
	}
	.knob {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: #fff;
		transition: transform 0.2s ease;
	}
	.toggle.on .knob {
		transform: translateX(22px);
	}

	/* шторки */
	.f {
		display: block;
		margin: 14px 0;
	}
	.f span {
		display: block;
		font-size: 12.5px;
		font-weight: 600;
		color: var(--secondary-text-color);
		margin-bottom: 7px;
	}
	.f input,
	.f textarea {
		width: 100%;
		padding: 12px 14px;
		border-radius: 12px;
		border: 1px solid var(--glass-border);
		background: var(--background-color);
		color: var(--text-color);
		font-family: inherit;
		outline: none;
		resize: vertical;
	}
	.f input:focus,
	.f textarea:focus {
		border-color: var(--primary-color);
	}
	.fgroup {
		padding: 14px 0;
		border-bottom: 1px solid var(--glass-border);
	}
	.fgroup:last-child {
		border-bottom: none;
	}
	.fgroup h3 {
		font-size: 14px;
		font-weight: 700;
		margin-bottom: 10px;
	}
	.btn {
		padding: 13px;
		border-radius: 13px;
		font-weight: 700;
		font-size: 14.5px;
		cursor: pointer;
		border: 1px solid var(--glass-border);
	}
	.btn.primary {
		background: var(--primary-color);
		border-color: transparent;
		color: #fff;
	}
	.btn.wide {
		width: 100%;
	}
	.btn:disabled {
		opacity: 0.6;
	}

	.about {
		text-align: center;
		font-size: 13px;
		color: var(--third-text-color);
		line-height: 1.6;
		margin-top: 24px;
	}
	.beta {
		color: var(--primary-color);
		font-weight: 700;
	}
	@media (max-width: 768px) {
		.inner {
			padding: 16px 12px;
		}
		h1 {
			font-size: 24px;
		}
	}
</style>
