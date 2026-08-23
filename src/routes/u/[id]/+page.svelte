<script>
	/**
	 * Профиль аккаунта сайта. Рисуется тем же ProfileView, что и профиль
	 * Anixart, и показывает ровно тот же набор блоков: статус, соцсети,
	 * приватность, кольцо списков, любимые жанры, время просмотра, динамику
	 * по дням, оценки с датами и недавно просмотренное.
	 */
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { getSiteProfile } from '$lib/siteprofile';
	import { friendStatusWith, sendRequest, respondRequest, removeFriend } from '$lib/friends';
	import { siteSession, siteSignOut, authReady } from '$lib/stores/auth';
	import { showToast } from '$lib/stores';
	import { haptic } from '$lib/ios';
	import { formatWatchTime } from '$lib/utils';
	import Icon from '$lib/components/Icon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import ProfileView from '$lib/components/ProfileView.svelte';

	$: id = $page.params.id;

	let profile = null;
	let loading = true;
	let notFound = false;
	let friendStatus = 'none';
	let friendBusy = false;

	$: badges = profile
		? [
				profile.isMine && { name: 'Мой профиль', color: '3f83f8' },
				profile.isVerified && { name: 'Верифицирован', color: '0e9f6e' },
				profile.isSponsor && { name: 'Спонсор', color: 'ecc94b' },
				friendStatus === 'friends' && { name: 'В друзьях', color: '9f7aea' }
			].filter(Boolean)
		: [];

	$: socials = profile
		? [
				profile.socials.vk && { name: profile.socials.vk, url: `https://vk.com/${profile.socials.vk}`, label: 'VK', color: '#4a76a8' },
				profile.socials.tg && { name: profile.socials.tg, url: `https://t.me/${profile.socials.tg}`, label: 'Telegram', color: '#2aabee' },
				profile.socials.tt && { name: profile.socials.tt, url: `https://tiktok.com/@${profile.socials.tt}`, label: 'TikTok', color: '#ee1d52' },
				profile.socials.inst && { name: profile.socials.inst, url: `https://instagram.com/${profile.socials.inst}`, label: 'Instagram', color: '#c32aa3' },
				profile.socials.discord && { name: profile.socials.discord, url: null, label: 'Discord', color: '#5865f2' }
			].filter(Boolean)
		: [];

	/** Свои списки живут на общих страницах, чужие — в разделах профиля. */
	$: listHref = (type) => `/u/${id}/bookmarks?type=${type}`;

	$: view = profile && {
		name: profile.username,
		avatar: profile.avatar,
		score: null,
		status: profile.status,
		registeredYear: profile.registeredAt ? new Date(profile.registeredAt).getFullYear() : null,
		isOnline: profile.isOnline,
		lastActivitySec: profile.lastActiveAt ? Math.floor(Date.parse(profile.lastActiveAt) / 1000) : 0,
		statsHidden: profile.statsHidden,
		socialHidden: profile.socialHidden,
		badges,
		socials,
		banners: [],
		lists: [
			{ type: 1, label: 'Смотрю', value: profile.counts[1], color: 'var(--watching-color)' },
			{ type: 2, label: 'В планах', value: profile.counts[2], color: 'var(--plan-color)' },
			{ type: 3, label: 'Просмотрено', value: profile.counts[3], color: 'var(--completed-color)' },
			{ type: 4, label: 'Отложено', value: profile.counts[4], color: 'var(--hold-on-color)' },
			{ type: 5, label: 'Брошено', value: profile.counts[5], color: 'var(--dropped-color)' }
		].map((s) => ({ ...s, href: listHref(s.type) })),
		preferred: profile.preferred,
		watchedEpisodes: profile.watchedEpisodes,
		// Строку показываем всегда, как у Anixart: пропадая при нуле, она
		// оставляла в статистике дыру там, где у второго аккаунта строка есть.
		watchTime: formatWatchTime(profile.watchedMinutes || 0),
		avgRating: profile.avgRating,
		dailyWatch: profile.dailyWatch,
		links: [
			{
				// Именно раздел профиля, а не общая /bookmarks: та показывает списки
				// Anixart, если пользователь вошёл ещё и туда.
				href: `/u/${id}/bookmarks`,
				label: 'Закладки',
				icon: 'bookmark',
				// Закладки — это все пять списков вместе с избранным, а не один из них.
				count: Object.values(profile.counts).reduce((a, b) => a + b, 0) + profile.favoriteCount
			},
			{ href: `/u/${id}/collections`, label: 'Коллекции', icon: 'collection', count: profile.countsHidden ? null : profile.collectionCount },
			{ href: `/u/${id}/history`, label: 'История', icon: 'history', count: profile.historyCount || null },
			{ href: `/u/${id}/votes`, label: 'Оценки', icon: 'star', count: profile.ratedCount || null },
			{ href: profile.isMine ? '/friends' : `/u/${id}/friends`, label: 'Друзья', icon: 'friends', count: profile.countsHidden ? null : profile.friendCount }
		],
		votes: profile.rated.map((r) => ({
			id: r.id,
			title: r.title_ru,
			image: r.image,
			// Оценки сайта десятибалльные, звёзд пять — приводим к общей шкале,
			// а точное значение оставляем подписью: 5 из 10 иначе неотличимо
			// от 6 из 10, обе округляются до трёх звёзд.
			stars: Math.round(r.vote / 2),
			label: `${r.vote}/10`,
			dateMs: r.ratedAt ? Date.parse(r.ratedAt) : null
		})),
		history: profile.history,
		bookmarksHref: `/u/${id}/bookmarks`,
		votesHref: `/u/${id}/votes`,
		historyHref: `/u/${id}/history`
	};

	async function load(userId) {
		loading = true;
		notFound = false;
		const [p, fs] = await Promise.all([
			getSiteProfile(userId).catch((e) => {
				console.error('profile', e);
				return null;
			}),
			friendStatusWith(userId).catch(() => 'none')
		]);
		// Пока запрос летел, могли уйти на другой профиль — тогда ответ уже чужой.
		if (userId !== id) return;
		profile = p;
		friendStatus = fs;
		notFound = !p;
		loading = false;
	}

	function friendLabel(status) {
		switch (status) {
			case 'outgoing':
				return 'Заявка отправлена';
			case 'incoming':
				return 'Принять заявку';
			case 'friends':
				return 'В друзьях';
			default:
				return 'Добавить в друзья';
		}
	}

	async function toggleFriend() {
		friendBusy = true;
		try {
			if (friendStatus === 'none') {
				await sendRequest(id);
				friendStatus = 'outgoing';
				showToast('Заявка отправлена', 'success');
			} else if (friendStatus === 'incoming') {
				await respondRequest(id, true);
				friendStatus = 'friends';
				showToast('Теперь вы друзья', 'success');
			} else {
				// Текст выбираем до сброса статуса: иначе при удалении друга
				// показывалось «Заявка отменена».
				const wasFriend = friendStatus === 'friends';
				await removeFriend(id);
				friendStatus = 'none';
				showToast(wasFriend ? 'Удалено из друзей' : 'Заявка отменена', 'info');
			}
			haptic('medium');
		} catch (e) {
			console.error('friend', e);
			showToast('Не получилось', 'error');
		}
		friendBusy = false;
	}

	async function logout() {
		await siteSignOut();
		showToast('Вы вышли из аккаунта', 'info');
		goto('/');
	}

	// Ждём восстановления сессии. Без этого при заходе по прямой ссылке на
	// собственный профиль запросы уходили без токена: свой профиль выглядел
	// чужим — с кнопкой «Добавить в друзья» на самого себя, без настроек, а
	// при включённой приватности ещё и без собственной статистики.
	let loadedFor;
	$: if ($authReady && id && id !== loadedFor) {
		loadedFor = id;
		load(id);
	}
</script>

<svelte:head><title>{profile?.username || 'Профиль'} — AniShiki</title></svelte:head>

{#if loading}
	<Spinner center label="Загрузка профиля…" />
{:else if view}
	<ProfileView p={view}>
		<svelte:fragment slot="actions">
			{#if profile.isMine}
				<a class="btn ghost" href="/settings"><Icon name="settings" size={18} /> Настройки</a>
				<button class="btn ghost" on:click={logout}>Выйти</button>
			{:else if $siteSession && !profile.friendRequestsDisallowed}
				<button class="btn primary" on:click={toggleFriend} disabled={friendBusy}>
					<Icon name="friends" size={17} />
					{friendLabel(friendStatus)}
				</button>
			{/if}
		</svelte:fragment>
	</ProfileView>
{:else if notFound}
	<div class="err"><h2>Профиль не найден</h2></div>
{/if}

<style>
	.err {
		text-align: center;
		padding: 80px;
	}
</style>
