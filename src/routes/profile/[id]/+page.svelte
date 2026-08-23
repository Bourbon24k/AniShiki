<script>
	/**
	 * Профиль Anixart — со всем, что отдаёт API: роли и значки, соцсети,
	 * кольцо распределения по спискам, любимые жанры, динамика просмотра,
	 * оценки с датами и недавно просмотренное.
	 *
	 * Часть блоков закрывается приватностью (is_stats_hidden / is_counts_hidden
	 * / is_social_hidden) — тогда мы их просто не рисуем и объясняем почему.
	 */
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { getApi, reinitApi } from '$lib/api';
	import { userToken, notificationCount, showToast } from '$lib/stores';
	import { returnTimeString, formatWatchTime, fmtNum, timeAgo, thumb } from '$lib/utils';
	import { haptic } from '$lib/ios';
	import Icon from '$lib/components/Icon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import ReleaseRow from '$lib/components/ReleaseRow.svelte';
	import Donut from '$lib/components/Donut.svelte';
	import AreaChart from '$lib/components/AreaChart.svelte';

	$: profileId = Number($page.params.id);

	let profile = null;
	let isMine = false;
	let loading = true;
	let friendBusy = false;

	/** Оценки и история: в профиле приходят короткие превью — грузим страницы целиком. */
	let votes = [];
	let votesLoading = false;
	let history = [];

	/** Сколько последних дней показывать на графике динамики (окно API — 31 день). */
	const RANGES = [
		{ id: 7, label: 'Неделя' },
		{ id: 14, label: '2 недели' },
		{ id: 31, label: 'Месяц' }
	];
	let range = 14;

	$: watch = formatWatchTime(profile?.watched_time);

	// Цвета совпадают с обозначениями списков в самом Anixart.
	$: lists = profile
		? [
				{ type: 1, label: 'Смотрю', value: profile.watching_count, color: 'var(--watching-color)' },
				{ type: 2, label: 'В планах', value: profile.plan_count, color: 'var(--plan-color)' },
				{ type: 3, label: 'Просмотрено', value: profile.completed_count, color: 'var(--completed-color)' },
				{ type: 4, label: 'Отложено', value: profile.hold_on_count, color: 'var(--hold-on-color)' },
				{ type: 5, label: 'Брошено', value: profile.dropped_count, color: 'var(--dropped-color)' }
			]
		: [];

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

	$: dynamics = buildDynamics(profile?.watch_dynamics, range);
	// Пустой график (одни нули) показывать незачем — он ничего не сообщает.
	$: hasDynamics = (profile?.watch_dynamics || []).some((d) => Number(d?.count) > 0);

	/**
	 * Динамика просмотра.
	 *
	 * В API это не временной ряд, а ровно 31 ячейка по числам месяца. Метка
	 * времени в ячейке — когда её в последний раз трогали, поэтому у дней без
	 * недавнего просмотра там висят даты годичной давности. Если рисовать
	 * график прямо по ним, подписи разъезжаются на годы — что и происходило.
	 *
	 * Поэтому строим окно последних N дней от сегодня и подставляем в него
	 * значения тех ячеек, чья метка попадает в этот же календарный день.
	 * Остальные дни — честные нули.
	 */
	function buildDynamics(raw, days) {
		const counts = new Map();
		for (const item of raw || []) {
			const ms = Number(item?.timestamp) * 1000;
			if (!Number.isFinite(ms) || ms <= 0) continue;
			counts.set(dayKey(new Date(ms)), Number(item.count) || 0);
		}
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const points = [];
		for (let back = days - 1; back >= 0; back--) {
			const date = new Date(today);
			date.setDate(today.getDate() - back);
			points.push({
				value: counts.get(dayKey(date)) ?? 0,
				label: shortDate(date),
				full: fullDate(date)
			});
		}
		return points;
	}

	const dayKey = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

	/** «Закладки» — это все списки разом, а не избранное: там свой счётчик. */
	$: bookmarksTotal = lists.reduce((sum, item) => sum + (Number(item.value) || 0), 0);

	// Один блок разделов вместо двух: счётчики раньше дублировали ссылки ниже.
	// Показываем только то, что можно открыть, — плитка без адреса бесполезна.
	$: links = profile
		? [
				{ href: `/profile/${profileId}/bookmarks`, label: 'Закладки', icon: 'bookmark', count: bookmarksTotal },
				{ href: `/profile/${profileId}/collections`, label: 'Коллекции', icon: 'collection', count: profile.collection_count },
				{ href: `/profile/${profileId}/history`, label: 'История', icon: 'history', count: null },
				{ href: `/profile/${profileId}/votes`, label: 'Оценки', icon: 'star', count: votes.length || null },
				{ href: `/friends/${profileId}`, label: 'Друзья', icon: 'friends', count: profile.friend_count }
			]
		: [];

	function shortDate(date) {
		return `${date.getDate()} ${date.toLocaleDateString('ru-RU', { month: 'short' })}`;
	}

	function fullDate(date) {
		return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
	}

	async function load(id) {
		loading = true;
		try {
			const data = await getApi().profile.info(id);
			profile = data?.profile;
			isMine = data?.is_my_profile || Number($userToken?.id) === id;
		} catch (e) {
			console.error('profile', e);
			profile = null;
		}
		loading = false;
		if (profile && !profile.is_stats_hidden) {
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
		votesLoading = true;
		votes = profile?.votes || [];
		try {
			const data = await getApi().profile.getVotedReleases(id, 0);
			if (data?.content?.length) votes = data.content;
		} catch (e) {
			console.error('votes', e);
		}
		votesLoading = false;
	}

	/* ── друзья ── */

	async function toggleFriend() {
		if (!$userToken) return showToast('Войдите в аккаунт Anixart', 'error');
		friendBusy = true;
		try {
			const api = getApi();
			const result =
				profile.friend_status === null || profile.friend_status === undefined
					? await api.profile.sendFriendRequest(profileId)
					: await api.profile.removeFriendRequest(profileId);
			profile = { ...profile, friend_status: result?.friend_status ?? null };
			haptic('medium');
			showToast(profile.friend_status != null ? 'Заявка отправлена' : 'Заявка отменена', 'success');
		} catch (e) {
			console.error('friend', e);
			showToast('Не получилось', 'error');
		}
		friendBusy = false;
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

	$: if (profileId) load(profileId);
</script>

<svelte:head><title>{profile?.login || 'Профиль'} — AniShiki</title></svelte:head>

{#if loading}
	<Spinner center label="Загрузка профиля…" />
{:else if profile}
	<div class="profile">
		<div class="cover">
			{#if profile.avatar}
				<img class="cover-art" src={profile.avatar} alt="" referrerpolicy="no-referrer" aria-hidden="true" />
			{/if}
		</div>
		<div class="container">
			{#if profile.is_banned || profile.is_perm_banned}
				<div class="banner danger">
					<strong>Аккаунт заблокирован</strong>
					<span>
						{profile.ban_reason || 'Причина не указана'}
						{#if !profile.is_perm_banned && profile.ban_expires}
							· до {returnTimeString(profile.ban_expires * 1000, true)}
						{/if}
					</span>
				</div>
			{/if}
			{#if profile.is_me_blocked}
				<div class="banner">Пользователь ограничил вам доступ к профилю.</div>
			{/if}

			{#if badges.length}
				<div class="badges">
					{#each badges as b}
						<span class="role" style={`--c:#${String(b.color).replace('#', '')}`}>{b.name}</span>
					{/each}
				</div>
			{/if}

			<header class="head">
				<div class="avatar" class:online={profile.is_online}>
					{#if profile.avatar}
						<img src={profile.avatar} alt="" referrerpolicy="no-referrer" />
					{:else}
						<Icon name="user" size={48} />
					{/if}
				</div>
				<div class="ident">
					<h1>
						{profile.login}
						<span class="rating" class:good={Number(profile.rating_score) >= 0}>
							{fmtNum(profile.rating_score || 0)}
						</span>
					</h1>
					{#if profile.status}<p class="status" data-selectable>{profile.status}</p>{/if}
					<p class="reg">
						на сайте с {new Date(profile.register_date * 1000).getFullYear()} ·
						{profile.is_online ? 'в сети' : `был(а) ${timeAgo(profile.last_activity_time)}`}
					</p>
				</div>
				<div class="head-actions">
					{#if isMine}
						<a class="btn ghost" href="/settings"><Icon name="settings" size={18} /> Настройки</a>
						<button class="btn ghost" on:click={logout}>Выйти</button>
					{:else if $userToken && !profile.is_friend_requests_disallowed}
						<button class="btn primary" on:click={toggleFriend} disabled={friendBusy}>
							<Icon name="friends" size={17} />
							{friendLabel(profile.friend_status)}
						</button>
					{/if}
				</div>
			</header>

			{#if socials.length && !profile.is_social_hidden}
				<div class="socials">
					{#each socials as s}
						{#if s.url}
							<a class="social" href={s.url} target="_blank" rel="noopener noreferrer" style={`--c:${s.color}`}>
								<b>{s.label}</b> {s.name}
							</a>
						{:else}
							<span class="social" style={`--c:${s.color}`}><b>{s.label}</b> {s.name}</span>
						{/if}
					{/each}
				</div>
			{/if}

			{#if profile.is_stats_hidden}
				<div class="banner">Статистика, оценки и история скрыты настройками приватности.</div>
			{:else}
				<!-- Статистика: кольцо + любимые жанры, как на карточке Anixart -->
				<section class="card stats">
					<div class="card-head">
						<h2>Статистика</h2>
						<a class="more" href={`/profile/${profileId}/bookmarks`}>Показать все <Icon name="chevronRight" size={16} /></a>
					</div>
					<div class="stats-body">
						<div class="stats-text">
							<div class="legend">
								{#each lists as s}
									<a class="leg" href={`/profile/${profileId}/bookmarks?type=${s.type}`}>
										<span class="dot" style={`background:${s.color}`}></span>
										{s.label} <b>{fmtNum(s.value || 0)}</b>
									</a>
								{/each}
							</div>
							{#each preferred as group}
								<p class="pref">
									{group.label}:
									{#each group.items.slice(0, 4) as item, i}
										{i > 0 ? ', ' : ' '}<a href={`/search?genre=${encodeURIComponent(item.name)}`}>{item.name}</a>
										<span class="pct">{item.percentage}%</span>
									{/each}
								</p>
							{/each}
							<p class="pref">Просмотрено серий: <b>{fmtNum(profile.watched_episode_count)}</b></p>
							<p class="pref">
								Время просмотра: <b>~{watch.long}</b>
								<span class="pct">≈ {watch.hoursLong}</span>
							</p>
						</div>
						<Donut segments={lists} />
					</div>
				</section>

				{#if hasDynamics}
					<section class="card">
						<div class="card-head">
							<h2>Динамика просмотра серий</h2>
							<div class="ranges">
								{#each RANGES as r}
									<button class="range" class:on={range === r.id} on:click={() => (range = r.id)}>
										{r.label}
									</button>
								{/each}
							</div>
						</div>
						<AreaChart points={dynamics} />
						<p class="chart-hint">Наведите или проведите пальцем, чтобы увидеть конкретный день.</p>
					</section>
				{/if}
			{/if}

			<nav class="links">
				{#each links as l}
					<a class="link" href={l.href}>
						<span class="lico"><Icon name={l.icon} size={20} /></span>
						<span class="lname">{l.label}</span>
						{#if l.count != null}<span class="cnt">{fmtNum(l.count)}</span>{/if}
					</a>
				{/each}
			</nav>

			{#if !profile.is_stats_hidden && votes.length}
				<section class="card">
					<div class="card-head">
						<h2>Оценки</h2>
						<a class="more" href={`/profile/${profileId}/votes`}>Посмотреть все <Icon name="chevronRight" size={16} /></a>
					</div>
					<div class="votes">
						{#each votes.slice(0, 12) as v (v.id)}
							<a class="vote" href={`/release/${v.id}`}>
								<div class="vposter">
									{#if v.image || v.poster}
										<img src={thumb(v.image || v.poster, { w: 128 })} alt="" referrerpolicy="no-referrer" loading="lazy" decoding="async" />
									{/if}
								</div>
								<div class="vbody">
									<span class="vtitle">{v.title_ru || v.title_original}</span>
									<span class="stars" aria-label={`Оценка ${v.my_vote} из 5`}>
										{#each [1, 2, 3, 4, 5] as star}
											<Icon name="star" size={14} fill={star <= v.my_vote ? '#ffc107' : 'var(--gray-btn)'} />
										{/each}
									</span>
									{#if v.voted_at}<span class="vdate">{returnTimeString(v.voted_at * 1000, true)}</span>{/if}
								</div>
							</a>
						{/each}
					</div>
					{#if votes.length > 12}
						<a class="see-all" href={`/profile/${profileId}/votes`}>
							Ещё оценки <Icon name="chevronRight" size={16} />
						</a>
					{/if}
				</section>
			{/if}

			{#if !profile.is_stats_hidden && history.length}
				<ReleaseRow
					title="Недавно просмотренные"
					items={history}
					href={`/profile/${profileId}/history`}
				/>
			{/if}
		</div>
	</div>
{:else}
	<div class="err"><h2>Профиль не найден</h2></div>
{/if}

<style>
	/* Обложка: размытый аватар в полную силу, затухающий книзу.
	   Ничего не притеняем — от затемнения шапка выглядела грязным пятном. */
	.cover {
		height: 300px;
		position: relative;
		overflow: hidden;
		background: var(--background-color);
	}
	.cover-art {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		/* Увеличение прячет размытые края картинки за границами блока. */
		transform: scale(1.25);
		filter: blur(38px) saturate(145%);
	}
	/* Затухание отдельным слоем, а не маской на картинке: маска масштабируется
	   вместе с ней, её «прозрачный» конец уезжает за границу блока, и низ
	   обложки обрывался резкой полосой. Этот слой не масштабируется. */
	.cover::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to bottom,
			transparent 0%,
			transparent 34%,
			color-mix(in srgb, var(--background-color) 45%, transparent) 62%,
			color-mix(in srgb, var(--background-color) 82%, transparent) 84%,
			var(--background-color) 100%
		);
	}
	.container {
		position: relative;
		max-width: 1100px;
		margin: -120px auto 0;
		padding: 0 24px 60px;
	}
	.banner {
		margin: 0 0 12px;
		padding: 13px 16px;
		border-radius: 14px;
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
		font-size: 13.5px;
		color: var(--secondary-text-color);
	}
	.banner.danger {
		border-color: color-mix(in srgb, var(--danger-color) 50%, transparent);
	}
	.banner strong {
		display: block;
		color: var(--danger-color);
		font-size: 14.5px;
		margin-bottom: 3px;
	}

	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
		margin-bottom: 12px;
		position: relative;
		z-index: 2;
	}

	.role {
		padding: 5px 12px;
		border-radius: 999px;
		border: 1px solid var(--c);
		color: var(--c);
		font-size: 12.5px;
		font-weight: 600;
		background: color-mix(in srgb, var(--c) 12%, transparent);
	}

	.head {
		display: flex;
		align-items: flex-end;
		gap: 22px;
		margin-bottom: 20px;
	}
	.avatar {
		position: relative;
		width: 112px;
		height: 112px;
		min-width: 112px;
		border-radius: 50%;
		overflow: hidden;
		display: grid;
		place-items: center;
		background: var(--alt-background-color);
		border: 4px solid var(--background-color);
		color: var(--secondary-text-color);
	}
	.avatar.online {
		border-color: var(--watching-color);
	}
	.avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.ident {
		flex: 1;
		min-width: 0;
		padding-bottom: 6px;
	}
	h1 {
		font-size: 27px;
		font-weight: 800;
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.rating {
		font-size: 13px;
		font-weight: 700;
		padding: 2px 9px;
		border-radius: 8px;
		border: 1px solid var(--bad-reputation-color);
		color: var(--bad-reputation-color);
	}
	.rating.good {
		border-color: var(--good-reputation-color);
		color: var(--good-reputation-color);
	}
	.status {
		color: var(--text-color);
		margin: 5px 0;
		font-size: 14.5px;
		white-space: pre-wrap;
	}
	.reg {
		font-size: 13px;
		color: var(--third-text-color);
	}
	.head-actions {
		display: flex;
		gap: 10px;
		padding-bottom: 6px;
		flex-shrink: 0;
	}
	.btn {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 10px 16px;
		border-radius: 12px;
		font-weight: 600;
		font-size: 14px;
		cursor: pointer;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
		color: var(--text-color);
	}
	.btn.primary {
		background: var(--primary-color);
		border-color: transparent;
		color: #fff;
	}
	.btn:disabled {
		opacity: 0.6;
	}

	.socials {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 18px;
	}
	.social {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 8px 14px;
		border-radius: 11px;
		border: 1px solid var(--c);
		color: var(--c);
		font-size: 13px;
		transition: background 0.18s ease, color 0.18s ease;
	}
	.social b {
		font-weight: 700;
	}
	a.social:hover {
		background: var(--c);
		color: #fff;
	}

	.card {
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
		border-radius: 18px;
		padding: 20px 22px;
		margin-bottom: 16px;
	}
	.card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 16px;
	}
	.card-head h2 {
		font-size: 19px;
		font-weight: 700;
	}
	.card-head.plain {
		margin-bottom: 14px;
	}
	.more {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		font-size: 13px;
		font-weight: 600;
		color: var(--secondary-text-color);
		white-space: nowrap;
	}
	.more:hover {
		color: var(--primary-color);
	}

	.stats-body {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		flex-wrap: wrap;
	}
	.stats-text {
		flex: 1;
		min-width: 240px;
	}
	.legend {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 6px 18px;
		margin-bottom: 14px;
	}
	.leg {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13.5px;
		color: var(--secondary-text-color);
		white-space: nowrap;
	}
	.leg b {
		color: var(--text-color);
		font-weight: 800;
	}
	.dot {
		width: 12px;
		height: 12px;
		border-radius: 4px;
		flex-shrink: 0;
	}
	.pref {
		font-size: 13.5px;
		color: var(--secondary-text-color);
		line-height: 1.75;
	}
	.pref a {
		color: var(--text-color);
	}
	.pref a:hover {
		color: var(--primary-color);
	}
	.pref b {
		color: var(--text-color);
	}
	.pct {
		font-size: 12px;
		color: var(--third-text-color);
	}

	.links {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 12px;
		margin-bottom: 24px;
	}
	.link {
		display: flex;
		align-items: center;
		gap: 11px;
		padding: 15px;
		border-radius: 14px;
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
		color: var(--text-color);
		font-weight: 600;
		transition: transform 0.15s ease, border-color 0.2s ease;
	}
	.link:hover {
		transform: translateY(-2px);
		border-color: var(--primary-color);
	}
	.lico {
		display: grid;
		place-items: center;
		color: var(--primary-color);
	}
	.lname {
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.link .cnt {
		color: var(--third-text-color);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	.ranges {
		display: flex;
		gap: 4px;
		padding: 3px;
		border-radius: 11px;
		background: var(--background-color);
		border: 1px solid var(--glass-border);
	}
	.range {
		padding: 6px 11px;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--secondary-text-color);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
	}
	.range.on {
		background: var(--primary-color);
		color: #fff;
	}
	.chart-hint {
		margin-top: 10px;
		font-size: 12px;
		color: var(--third-text-color);
	}
	.see-all {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		margin-top: 14px;
		font-size: 13px;
		font-weight: 600;
		color: var(--primary-color);
	}
	.votes {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 12px;
	}
	.vote {
		display: flex;
		gap: 12px;
		color: var(--text-color);
	}
	.vposter {
		width: 54px;
		min-width: 54px;
		aspect-ratio: 2/3;
		border-radius: 9px;
		overflow: hidden;
		background: var(--background-color);
	}
	.vposter img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.vbody {
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 4px;
	}
	.vtitle {
		font-size: 14px;
		font-weight: 600;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		line-height: 1.3;
	}
	.stars {
		display: flex;
		gap: 1px;
	}
	.vdate {
		font-size: 11.5px;
		color: var(--third-text-color);
	}

	section h2 {
		font-size: 19px;
		font-weight: 700;
	}
	section {
		margin-bottom: 30px;
	}
	/* Последний блок не должен добавлять пустоту над нижней панелью. */
	section:last-child,
	.card:last-child {
		margin-bottom: 0;
	}
	.err {
		text-align: center;
		padding: 80px;
	}

	@media (max-width: 768px) {
		/* На телефоне обложка во весь рост оставляла пустую полосу в пол-экрана. */
		.cover {
			height: 200px;
		}
		/* Перекрытие подобрано так, чтобы аватар стоял ниже самой яркой части
		   обложки: раньше он приходился ровно на её нижнюю кромку. Разница
		   высоты и отрицательного отступа — это и есть пустая полоса над
		   бейджем; было 118px, стало 66px. */
		.container {
			margin-top: -134px;
			padding: 0 14px 12px;
		}
		.badges {
			justify-content: center;
		}
		.head {
			flex-direction: column;
			align-items: center;
			text-align: center;
			gap: 14px;
		}
		.ident {
			text-align: center;
		}
		h1 {
			justify-content: center;
		}
		.head-actions {
			width: 100%;
		}
		.head-actions .btn {
			flex: 1;
			justify-content: center;
		}
		.socials {
			justify-content: center;
		}
		.stats-body {
			flex-direction: column-reverse;
			align-items: stretch;
		}
		.stats-body :global(svg) {
			align-self: center;
		}
		.legend {
			grid-template-columns: 1fr 1fr;
		}
		.card {
			padding: 16px;
		}
	}
</style>
