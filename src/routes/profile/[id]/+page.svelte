<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { getApi, reinitApi } from '$lib/api';
	import { userToken, notificationCount, showToast } from '$lib/stores';
	import { returnTimeString, formatWatchTime, fmtNum } from '$lib/utils';
	import Icon from '$lib/components/Icon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import AnimeCard from '$lib/components/AnimeCard.svelte';

	$: profileId = Number($page.params.id);

	let profile = null;
	let isMine = false;
	let loading = true;

	$: watch = formatWatchTime(profile?.watched_time);
	// Распределение по спискам (сегментированная полоса + кликабельная легенда).
	$: dist = profile
		? [
				{ type: 1, label: 'Смотрю', value: profile.watching_count, color: 'var(--watching-color)' },
				{ type: 2, label: 'В планах', value: profile.plan_count, color: 'var(--plan-color)' },
				{ type: 3, label: 'Просмотрено', value: profile.completed_count, color: 'var(--completed-color)' },
				{ type: 4, label: 'Отложено', value: profile.hold_on_count, color: 'var(--hold-on-color)' },
				{ type: 5, label: 'Брошено', value: profile.dropped_count, color: 'var(--dropped-color)' }
			]
		: [];
	$: distTotal = dist.reduce((a, s) => a + (s.value || 0), 0) || 1;
	// Крупные карточки-показатели.
	$: heroStats = profile
		? [
				{ icon: 'history', value: watch.value, sub: watch.unit, label: 'Время просмотра', accent: true },
				{ icon: 'play', value: fmtNum(profile.watched_episode_count), label: 'Эпизодов' },
				{ icon: 'bookmark', value: fmtNum(profile.favorite_count), label: 'В избранном' },
				{ icon: 'friends', value: fmtNum(profile.friend_count), label: 'Друзей' }
			]
		: [];
	// Мелкие чипы-показатели.
	$: chips = profile
		? [
				{ icon: 'collection', value: profile.collection_count, label: 'коллекций' },
				{ icon: 'feed', value: profile.comment_count, label: 'комментариев' },
				{ icon: 'discover', value: profile.subscription_count, label: 'подписок' },
				{ icon: 'play', value: profile.video_count, label: 'видео' }
			].filter((c) => c.value != null)
		: [];

	$: links = profile
		? [
				{ href: `/profile/${profileId}/bookmarks`, label: 'Закладки', icon: 'bookmark', count: profile.favorite_count },
				{ href: `/profile/${profileId}/collections`, label: 'Коллекции', icon: 'collection', count: profile.collection_count },
				{ href: `/profile/${profileId}/history`, label: 'История', icon: 'history' },
				{ href: `/profile/${profileId}/votes`, label: 'Оценки', icon: 'star' },
				{ href: `/friends/${profileId}`, label: 'Друзья', icon: 'friends', count: profile.friend_count }
			]
		: [];

	async function load(id) {
		loading = true;
		try {
			const data = await getApi().profile.info(id);
			profile = data?.profile;
			isMine = data?.is_my_profile || $userToken?.id === id;
		} catch (e) {
			console.error('profile', e);
		}
		loading = false;
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
		<div class="cover"></div>
		<div class="container">
			<header class="head">
				<div class="avatar">
					{#if profile.avatar}
						<img src={profile.avatar} alt="" referrerpolicy="no-referrer" />
					{:else}
						<Icon name="user" size={48} />
					{/if}
				</div>
				<div class="ident">
					<h1>{profile.login}{#if profile.is_sponsor}<span class="sponsor">PRO</span>{/if}</h1>
					{#if profile.status}<p class="status">{profile.status}</p>{/if}
					<p class="reg">
						на сайте с {new Date(profile.register_date * 1000).getFullYear()} ·
						{profile.is_online ? 'в сети' : `был(а) ${returnTimeString(profile.last_activity_time * 1000)}`}
					</p>
				</div>
				<div class="head-actions">
					{#if isMine}
						<a class="btn ghost" href="/settings"><Icon name="settings" size={18} /> Настройки</a>
						<button class="btn ghost" on:click={logout}>Выйти</button>
					{/if}
				</div>
			</header>

			<!-- Крупные карточки -->
			<div class="hero-stats">
				{#each heroStats as s}
					<div class="hstat" class:accent={s.accent}>
						<span class="hicon"><Icon name={s.icon} size={20} /></span>
						<span class="hval">{s.value}{#if s.sub}<span class="hsub">{s.sub}</span>{/if}</span>
						<span class="hlabel">{s.label}</span>
					</div>
				{/each}
			</div>

			<!-- Распределение по спискам -->
			{#if dist.some((s) => s.value)}
				<div class="dist">
					<div class="dist-head">
						<h2>Списки</h2>
						<span class="dist-total">{fmtNum(distTotal)} тайтлов · {watch.long} просмотра</span>
					</div>
					<div class="dist-bar">
						{#each dist as s}
							{#if s.value}
								<span class="seg" style="width:{(s.value / distTotal) * 100}%;background:{s.color}" title={`${s.label}: ${s.value}`}></span>
							{/if}
						{/each}
					</div>
					<div class="dist-legend">
						{#each dist as s}
							<a class="leg" href={`/profile/${profileId}/bookmarks?type=${s.type}`}>
								<span class="dot" style="background:{s.color}"></span>
								<span class="leg-val">{fmtNum(s.value)}</span>
								<span class="leg-label">{s.label}</span>
							</a>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Чипы -->
			{#if chips.some((c) => c.value)}
				<div class="chips">
					{#each chips as c}
						{#if c.value}
							<div class="chip"><Icon name={c.icon} size={15} /> <b>{fmtNum(c.value)}</b> {c.label}</div>
						{/if}
					{/each}
				</div>
			{/if}

			<div class="links">
				{#each links as l}
					<a class="link" href={l.href}>
						<Icon name={l.icon} size={20} />
						<span>{l.label}</span>
						{#if l.count != null}<span class="cnt">{l.count}</span>{/if}
					</a>
				{/each}
			</div>

			{#if profile.history?.length}
				<section>
					<h2>Недавно смотрел</h2>
					<div class="grid">
						{#each profile.history.slice(0, 12) as r (r.id)}<AnimeCard anime={r} type="grid" />{/each}
					</div>
				</section>
			{/if}

			{#if profile.votes?.length}
				<section>
					<h2>Оценки</h2>
					<div class="grid">
						{#each profile.votes.slice(0, 12) as v (v.release?.id || v.id)}
							{#if v.release}<AnimeCard anime={v.release} type="grid" />{/if}
						{/each}
					</div>
				</section>
			{/if}
		</div>
	</div>
{:else}
	<div class="err"><h2>Профиль не найден</h2></div>
{/if}

<style>
	.cover {
		height: 180px;
		background: linear-gradient(135deg, color-mix(in srgb, var(--primary-color) 40%, #1a1020), var(--background-color));
	}
	.container {
		max-width: 1100px;
		margin: 0 auto;
		padding: 0 24px 60px;
	}
	.head {
		display: flex;
		align-items: flex-end;
		gap: 22px;
		margin-top: -50px;
		margin-bottom: 28px;
	}
	.avatar {
		width: 120px;
		height: 120px;
		min-width: 120px;
		border-radius: 50%;
		overflow: hidden;
		display: grid;
		place-items: center;
		background: var(--alt-background-color);
		border: 4px solid var(--background-color);
		color: var(--secondary-text-color);
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
		font-size: 28px;
		font-weight: 800;
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.sponsor {
		font-size: 11px;
		font-weight: 800;
		padding: 2px 8px;
		border-radius: 6px;
		background: linear-gradient(135deg, #ffb347, #ff7a00);
		color: #fff;
	}
	.status {
		color: var(--text-color);
		margin: 4px 0;
	}
	.reg {
		font-size: 13px;
		color: var(--third-text-color);
	}
	.head-actions {
		display: flex;
		gap: 10px;
		padding-bottom: 6px;
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
	/* Крупные карточки */
	.hero-stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 14px;
		margin-bottom: 18px;
	}
	.hstat {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 18px;
		border-radius: 18px;
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
		overflow: hidden;
	}
	.hstat.accent {
		background: linear-gradient(135deg, color-mix(in srgb, var(--primary-color) 26%, var(--alt-background-color)), var(--alt-background-color));
		border-color: color-mix(in srgb, var(--primary-color) 40%, transparent);
	}
	.hicon {
		width: 38px;
		height: 38px;
		display: grid;
		place-items: center;
		border-radius: 11px;
		background: var(--background-color);
		color: var(--primary-color);
	}
	.hstat.accent .hicon {
		background: var(--primary-color);
		color: #fff;
	}
	.hval {
		font-size: 30px;
		font-weight: 800;
		line-height: 1;
		display: flex;
		align-items: baseline;
		gap: 6px;
	}
	.hsub {
		font-size: 14px;
		font-weight: 600;
		color: var(--secondary-text-color);
	}
	.hlabel {
		font-size: 13px;
		color: var(--secondary-text-color);
	}

	/* Распределение */
	.dist {
		padding: 18px 22px;
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
		border-radius: 18px;
		margin-bottom: 18px;
	}
	.dist-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 14px;
	}
	.dist-head h2 {
		font-size: 17px;
		font-weight: 700;
	}
	.dist-total {
		font-size: 12.5px;
		color: var(--third-text-color);
	}
	.dist-bar {
		display: flex;
		height: 12px;
		border-radius: 7px;
		overflow: hidden;
		background: var(--background-color);
	}
	.dist-bar .seg {
		height: 100%;
		transition: width 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.dist-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 14px;
	}
	.leg {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border-radius: 11px;
		background: var(--background-color);
		color: var(--text-color);
		transition: transform 0.15s ease, background 0.2s ease;
	}
	.leg:hover {
		transform: translateY(-2px);
		background: var(--elevated-color);
	}
	.leg .dot {
		width: 10px;
		height: 10px;
		border-radius: 3px;
	}
	.leg-val {
		font-weight: 800;
		font-size: 14px;
	}
	.leg-label {
		font-size: 13px;
		color: var(--secondary-text-color);
	}

	/* Чипы */
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-bottom: 22px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		border-radius: 11px;
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
		font-size: 13px;
		color: var(--secondary-text-color);
	}
	.chip b {
		color: var(--text-color);
		font-weight: 800;
	}
	.links {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 12px;
		margin-bottom: 36px;
	}
	.link {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 16px;
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
	.link .cnt {
		margin-left: auto;
		color: var(--third-text-color);
		font-size: 13px;
	}
	section h2 {
		font-size: 20px;
		font-weight: 700;
		margin: 0 0 16px;
	}
	section {
		margin-bottom: 34px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 16px;
	}
	.err {
		text-align: center;
		padding: 80px;
	}
	@media (max-width: 768px) {
		.container {
			padding: 0 14px 40px;
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
		.grid {
			grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
			gap: 12px;
		}
		.hero-stats {
			grid-template-columns: 1fr 1fr;
		}
		.hval {
			font-size: 24px;
		}
		.dist {
			padding: 16px;
		}
	}
</style>
