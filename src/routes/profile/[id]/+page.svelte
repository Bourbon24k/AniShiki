<script>
	/**
	 * Профиль Anixart. Данные тянутся из API и приводятся к общей форме, а
	 * рисует их ProfileView — тот же компонент, что и профиль аккаунта сайта.
	 *
	 * Часть блоков закрывается приватностью (is_stats_hidden / is_social_hidden)
	 * — тогда мы их просто не рисуем и объясняем почему.
	 */
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { getApi, reinitApi } from '$lib/api';
	import { userToken, notificationCount, showToast } from '$lib/stores';
	import { returnTimeString, formatWatchTime } from '$lib/utils';
	import { haptic } from '$lib/ios';
	import Icon from '$lib/components/Icon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import ProfileView from '$lib/components/ProfileView.svelte';
	import { isSiteId } from '$lib/siteprofile';

	$: profileId = Number($page.params.id);

	let profile = null;
	let isMine = false;
	let loading = true;
	let friendBusy = false;

	/** Оценки и история: в профиле приходят короткие превью — грузим страницы целиком. */
	let votes = [];
	let history = [];

	// Цвета совпадают с обозначениями списков в самом Anixart.
	$: lists = profile
		? [
				{ type: 1, label: 'Смотрю', value: profile.watching_count, color: 'var(--watching-color)' },
				{ type: 2, label: 'В планах', value: profile.plan_count, color: 'var(--plan-color)' },
				{ type: 3, label: 'Просмотрено', value: profile.completed_count, color: 'var(--completed-color)' },
				{ type: 4, label: 'Отложено', value: profile.hold_on_count, color: 'var(--hold-on-color)' },
				{ type: 5, label: 'Брошено', value: profile.dropped_count, color: 'var(--dropped-color)' }
			].map((s) => ({ ...s, href: `/profile/${profileId}/bookmarks?type=${s.type}` }))
		: [];

	/** Настройка «скрыть счётчики» до сих пор не делала ничего — счётчики рисовались всегда. */
	$: countsHidden = Boolean(profile?.is_counts_hidden) && !isMine;

	/** «Закладки» — это все списки разом, а не только избранное. */
	$: bookmarksTotal = lists.reduce((sum, s) => sum + (Number(s.value) || 0), 0);

	/** Значки статуса профиля + роли команды, как в клиенте Anixart. */
	$: badges = profile
		? [
				isMine && { name: 'Мой профиль', color: '3f83f8' },
				profile.is_blocked && { name: 'Заблокирован', color: 'f56565' },
				profile.is_verified && { name: 'Верифицирован', color: '0e9f6e' },
				profile.is_sponsor && { name: 'Спонсор Anixart', color: 'ecc94b' },
				...(profile.roles || []).map((r) => ({ name: r.name, color: r.color }))
			].filter(Boolean)
		: [];

	$: socials = profile
		? [
				profile.vk_page && { name: profile.vk_page, url: `https://vk.com/${profile.vk_page}`, label: 'VK', color: '#4a76a8' },
				profile.tg_page && { name: profile.tg_page, url: `https://t.me/${profile.tg_page}`, label: 'Telegram', color: '#2aabee' },
				profile.tt_page && { name: profile.tt_page, url: `https://tiktok.com/@${profile.tt_page}`, label: 'TikTok', color: '#ee1d52' },
				profile.inst_page && { name: profile.inst_page, url: `https://instagram.com/${profile.inst_page}`, label: 'Instagram', color: '#c32aa3' },
				profile.discord_page && { name: profile.discord_page, url: null, label: 'Discord', color: '#5865f2' }
			].filter(Boolean)
		: [];

	$: preferred = profile
		? [
				{ label: 'Жанры', items: profile.preferred_genres || [] },
				{ label: 'Аудитория', items: profile.preferred_audiences || [] },
				{ label: 'Тематика', items: profile.preferred_themes || [] }
			].filter((group) => group.items.length)
		: [];

	$: banners = profile
		? [
				(profile.is_banned || profile.is_perm_banned) && {
					danger: true,
					title: 'Аккаунт заблокирован',
					text:
						(profile.ban_reason || 'Причина не указана') +
						(!profile.is_perm_banned && profile.ban_expires
							? ` · до ${returnTimeString(profile.ban_expires * 1000, true)}`
							: '')
				},
				profile.is_me_blocked && { text: 'Пользователь ограничил вам доступ к профилю.' },
				profile.is_deleted && { danger: true, title: 'Аккаунт удалён', text: 'Профиль больше не поддерживается владельцем.' },
				profile.is_deletion_requested && { text: 'Владелец запросил удаление аккаунта.' },
				profile.is_private && { text: 'Профиль закрыт настройками приватности.' }
			].filter(Boolean)
		: [];

	$: view = profile && {
		name: profile.login,
		avatar: profile.avatar,
		score: profile.rating_score ?? 0,
		status: profile.status,
		registeredYear: profile.register_date ? new Date(profile.register_date * 1000).getFullYear() : null,
		isOnline: profile.is_online,
		lastActivitySec: profile.last_activity_time,
		// Приватность прячет профиль от посторонних, а не от владельца:
		// со скрытой статистикой человек переставал видеть собственную.
		statsHidden: profile.is_stats_hidden && !isMine,
		socialHidden: profile.is_social_hidden && !isMine,
		badges,
		socials,
		banners,
		lists,
		preferred,
		watchedEpisodes: profile.watched_episode_count,
		watchTime: formatWatchTime(profile.watched_time),
		dailyWatch: (profile.watch_dynamics || []).map((d) => ({
			ms: Number(d?.timestamp) * 1000,
			count: Number(d?.count) || 0
		})),
		links: [
			{ href: `/profile/${profileId}/bookmarks`, label: 'Закладки', icon: 'bookmark', count: bookmarksTotal },
			{ href: `/profile/${profileId}/collections`, label: 'Коллекции', icon: 'collection', count: countsHidden ? null : profile.collection_count },
			{ href: `/profile/${profileId}/history`, label: 'История', icon: 'history', count: null },
			{ href: `/profile/${profileId}/votes`, label: 'Оценки', icon: 'star', count: votes.length || null },
			{ href: `/friends/${profileId}`, label: 'Друзья', icon: 'friends', count: countsHidden ? null : profile.friend_count }
		],
		votes: votes.map((v) => ({
			id: v.id,
			title: v.title_ru || v.title_original,
			image: v.image || v.poster,
			stars: v.my_vote,
			dateMs: v.voted_at ? v.voted_at * 1000 : null
		})),
		history,
		bookmarksHref: `/profile/${profileId}/bookmarks`,
		votesHref: `/profile/${profileId}/votes`,
		historyHref: `/profile/${profileId}/history`
	};

	async function load(id) {
		loading = true;
		votes = [];
		history = [];
		try {
			const data = await getApi().profile.info(id);
			// Ответ мог прийти после перехода на другой профиль — тогда он уже
			// не наш: иначе чужие оценки и история показывались под новым именем.
			if (id !== profileId) return;
			profile = data?.profile;
			isMine = data?.is_my_profile || Number($userToken?.id) === id;
		} catch (e) {
			console.error('profile', e);
			if (id !== profileId) return;
			profile = null;
		}
		loading = false;
		// Тот же признак, что и во view: владельцу приватность профиль не
		// закрывает, иначе статистика рисовалась, а оценки с историей молча
		// пропадали — картина получалась рваной.
		if (profile && !(profile.is_stats_hidden && !isMine)) {
			loadVotes(id);
			loadHistory(id);
		}
	}

	/**
	 * Недавно просмотренное. В профиле приходит всего несколько тайтлов;
	 * свою историю можно догрузить страницей, чужая доступна только превью.
	 */
	async function loadHistory(id) {
		history = (profile?.history || []).map(toHistoryCard);
		if (!isMine) return;
		try {
			const data = await getApi().release.getHistory(0);
			if (id !== profileId) return;
			if (data?.content?.length) history = data.content.map(toHistoryCard);
		} catch (e) {
			console.error('history', e);
		}
	}

	/**
	 * Карточка истории: ссылка сразу в плеер, подпись «на чём остановились»
	 * и полоса прогресса по постеру, если известно общее число серий.
	 */
	function toHistoryCard(release) {
		const position = Number(release?.last_view_episode?.position) || 0;
		const total = Number(release?.episodes_total) || Number(release?.episodes_released) || 0;
		return {
			...release,
			href: position > 0 ? `/player/${release.id}?ep=${position}` : `/release/${release.id}`,
			badge: position > 0 ? (total ? `${position} серия из ${total}` : `${position} серия`) : null,
			progress: position > 0 && total ? Math.min(100, (position / total) * 100) : 0
		};
	}

	/** Полная первая страница оценок: в профиле их приходит всего несколько. */
	async function loadVotes(id) {
		votes = profile?.votes || [];
		try {
			const data = await getApi().profile.getVotedReleases(id, 0);
			if (id !== profileId) return;
			if (data?.content?.length) votes = data.content;
		} catch (e) {
			console.error('votes', e);
		}
	}

	/* ── друзья ── */

	/**
	 * Действие с заявкой в друзья.
	 *
	 * Входящая заявка (статус 1) подтверждается повторной отправкой — у Anixart
	 * это SendFriendRequestResult.RequestConfirmed. Раньше кнопка «Принять
	 * заявку» звала removeFriendRequest, то есть заявку отклоняла.
	 *
	 * Итоговый статус перечитываем из профиля, а не берём из ответа: поле
	 * friend_status в ответе несёт код результата операции, а не отношение с
	 * пользователем, и подпись кнопки после действия врала.
	 *
	 * @param {'toggle' | 'decline'} action
	 */
	async function friendAction(action = 'toggle') {
		if (!$userToken) return showToast('Войдите в аккаунт Anixart', 'error');
		friendBusy = true;
		const was = profile.friend_status;
		try {
			const api = getApi();
			const accepting = action === 'toggle' && (was === 1 || was === null || was === undefined);
			const result = accepting
				? await api.profile.sendFriendRequest(profileId)
				: await api.profile.removeFriendRequest(profileId);
			// code = 0 только при успехе; всё остальное — отказ сервера
			// (профиль заблокирован, лимит друзей, заявки запрещены).
			if (result?.code) {
				showToast(FRIEND_ERRORS[result.code] || 'Не получилось', 'error');
			} else {
				haptic('medium');
				showToast(friendResultText(was, action), 'success');
			}
			const fresh = await api.profile.info(profileId);
			if (profileId !== Number($page.params.id)) return;
			if (fresh?.profile) profile = fresh.profile;
		} catch (e) {
			console.error('friend', e);
			showToast('Не получилось', 'error');
		}
		friendBusy = false;
	}

	const FRIEND_ERRORS = {
		4: 'Пользователь вас заблокировал',
		5: 'Вы заблокировали этого пользователя',
		6: 'У вас достигнут предел друзей',
		7: 'У пользователя достигнут предел друзей',
		8: 'Пользователь запретил заявки в друзья',
		9: 'Слишком много заявок — попробуйте позже'
	};

	function friendResultText(previous, action) {
		if (action === 'decline') return 'Заявка отклонена';
		if (previous === 1) return 'Заявка принята';
		if (previous === 2) return 'Удалено из друзей';
		if (previous === 0) return 'Заявка отменена';
		return 'Заявка отправлена';
	}

	function friendLabel(status) {
		switch (status) {
			case 0:
				return 'Заявка отправлена';
			case 1:
				return 'Принять заявку';
			case 2:
				return 'В друзьях';
			default:
				return 'Добавить в друзья';
		}
	}

	function logout() {
		userToken.set(null);
		notificationCount.set(0);
		reinitApi();
		showToast('Вы вышли из аккаунта', 'info');
		goto('/');
	}

	// Идентификатор аккаунта сайта — uuid, у Anixart он числовой. По такой
	// ссылке страница раньше отвечала «Профиль не найден».
	$: if (isSiteId($page.params.id)) goto(`/u/${$page.params.id}`, { replaceState: true });
	else if (profileId) load(profileId);
	// Ни uuid, ни число: адрес битый. Без этой ветки страница либо навсегда
	// оставалась со спиннером, либо показывала предыдущего пользователя.
	else {
		profile = null;
		loading = false;
	}
</script>

<svelte:head><title>{profile?.login || 'Профиль'} — AniShiki</title></svelte:head>

{#if loading}
	<Spinner center label="Загрузка профиля…" />
{:else if view}
	<ProfileView p={view}>
		<svelte:fragment slot="actions">
			{#if isMine}
				<a class="btn ghost" href="/settings"><Icon name="settings" size={18} /> Настройки</a>
				<button class="btn ghost" on:click={logout}>Выйти</button>
			{:else if $userToken && !profile.is_friend_requests_disallowed}
				<button class="btn primary" on:click={() => friendAction('toggle')} disabled={friendBusy}>
					<Icon name="friends" size={17} />
					{friendLabel(profile.friend_status)}
				</button>
				{#if profile.friend_status === 1}
					<!-- Отклонить входящую заявку было нечем: кнопка одна, и она
					     теперь принимает. -->
					<button class="btn ghost" on:click={() => friendAction('decline')} disabled={friendBusy}>
						Отклонить
					</button>
				{/if}
			{/if}
		</svelte:fragment>
	</ProfileView>
{:else}
	<div class="err"><h2>Профиль не найден</h2></div>
{/if}

<style>
	.err {
		text-align: center;
		padding: 80px;
	}
</style>
