<script>
	import { onMount } from 'svelte';
	import { getApi } from '$lib/api';
	import { userToken, showToast } from '$lib/stores';
	import { siteSession } from '$lib/stores/auth';
	import {
		searchUsers,
		listFriends,
		listIncoming,
		listOutgoing,
		sendRequest,
		respondRequest,
		removeFriend
	} from '$lib/friends';
	import { friendsActivity } from '$lib/sitedata';
	import Icon from '$lib/components/Icon.svelte';
	import ProfileGrid from '$lib/components/ProfileGrid.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	let friends = [];
	let requests = [];
	let loading = true;

	// site-аккаунт
	$: siteOnly = !$userToken && !!$siteSession;
	let sFriends = [];
	let sIncoming = [];
	let sOutgoing = [];
	let feed = [];
	let query = '';
	let results = [];
	let searching = false;
	let sLoaded = false;

	$: if (siteOnly && !sLoaded) {
		sLoaded = true;
		loadSite();
	}

	async function loadSite() {
		loading = true;
		[sFriends, sIncoming, sOutgoing, feed] = await Promise.all([
			listFriends(),
			listIncoming(),
			listOutgoing(),
			friendsActivity()
		]);
		loading = false;
	}

	const actVerb = { watch: 'смотрит', rate: 'оценил(а)', list: 'обновил(а) список' };
	function actText(a) {
		if (a.type === 'rate') return `оценил(а) на ${a.meta}/10`;
		if (a.type === 'list') return a.meta || 'обновил(а) список';
		if (a.type === 'watch') return `смотрит${a.meta ? ' · ' + a.meta : ''}`;
		return actVerb[a.type] || '';
	}
	function ago(ts) {
		const d = (Date.now() - new Date(ts).getTime()) / 1000;
		if (d < 60) return 'только что';
		if (d < 3600) return `${Math.floor(d / 60)} мин назад`;
		if (d < 86400) return `${Math.floor(d / 3600)} ч назад`;
		return `${Math.floor(d / 86400)} дн назад`;
	}

	let searchTimer;
	function onSearch() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(async () => {
			if (!query.trim()) {
				results = [];
				return;
			}
			searching = true;
			results = await searchUsers(query);
			searching = false;
		}, 350);
	}

	function relation(id) {
		if (sFriends.some((f) => f.id === id)) return 'friend';
		if (sOutgoing.some((f) => f.id === id)) return 'outgoing';
		if (sIncoming.some((f) => f.id === id)) return 'incoming';
		return 'none';
	}

	async function add(p) {
		try {
			await sendRequest(p.id);
			sOutgoing = [...sOutgoing, p];
			showToast('Заявка отправлена', 'success');
		} catch {
			showToast('Ошибка', 'error');
		}
	}
	async function respond(p, ok) {
		try {
			await respondRequest(p.id, ok);
			sIncoming = sIncoming.filter((x) => x.id !== p.id);
			if (ok) sFriends = [p, ...sFriends];
			showToast(ok ? 'Заявка принята' : 'Заявка отклонена', 'success');
		} catch {
			showToast('Ошибка', 'error');
		}
	}
	async function unfriend(p) {
		try {
			await removeFriend(p.id);
			sFriends = sFriends.filter((x) => x.id !== p.id);
			sOutgoing = sOutgoing.filter((x) => x.id !== p.id);
			showToast('Удалено', 'success');
		} catch {
			showToast('Ошибка', 'error');
		}
	}

	async function load() {
		if (siteOnly) return; // site грузится через loadSite
		if (!$userToken) {
			loading = false;
			return;
		}
		const api = getApi();
		try {
			const [f, r] = await Promise.all([
				api.profile.getFriends({ id: $userToken.id, page: 0 }).catch(() => null),
				api.profile.getFriendRequests({ page: 0 }).catch(() => null)
			]);
			friends = f?.content || [];
			requests = r?.content || [];
		} catch (e) {
			console.error('friends', e);
		}
		loading = false;
	}

	async function accept(p) {
		try {
			await getApi().profile.sendFriendRequest(p.id);
			requests = requests.filter((x) => x.id !== p.id);
			friends = [p, ...friends];
			showToast('Заявка принята', 'success');
		} catch {
			showToast('Ошибка', 'error');
		}
	}

	onMount(load);
</script>

<svelte:head><title>Друзья — AniShiki</title></svelte:head>

<div class="page">
	<div class="inner">
		<h1>Друзья</h1>

		{#if siteOnly}
			<div class="search">
				<Icon name="search" size={18} />
				<input placeholder="Найти пользователя по нику…" bind:value={query} on:input={onSearch} />
			</div>
			{#if results.length}
				<section>
					<h2>Результаты</h2>
					<div class="req-list">
						{#each results as p (p.id)}
							<div class="req">
								<div class="req-user">
									{#if p.avatar_url}<img src={p.avatar_url} alt="" referrerpolicy="no-referrer" />{:else}<span class="ph"><Icon name="user" size={20} /></span>{/if}
									<span>{p.username}</span>
								</div>
								{#if relation(p.id) === 'friend'}
									<span class="tag">В друзьях</span>
								{:else if relation(p.id) === 'outgoing'}
									<span class="tag">Заявка отправлена</span>
								{:else if relation(p.id) === 'incoming'}
									<button class="accept" on:click={() => respond(p, true)}>Принять</button>
								{:else}
									<button class="accept" on:click={() => add(p)}>Добавить</button>
								{/if}
							</div>
						{/each}
					</div>
				</section>
			{:else if query.trim() && !searching}
				<p class="muted">Ничего не найдено</p>
			{/if}

			{#if loading}
				<Spinner center label="Загрузка…" />
			{:else}
				{#if feed.length}
					<section>
						<h2>Активность друзей</h2>
						<div class="feed">
							{#each feed as a (a.id)}
								<a class="act" href={`/release/${a.release_id}`}>
									<div class="act-av">
										{#if a.author?.avatar_url}<img src={a.author.avatar_url} alt="" referrerpolicy="no-referrer" />{:else}<Icon name="user" size={16} />{/if}
									</div>
									{#if a.image}<img class="act-poster" src={a.image} alt="" referrerpolicy="no-referrer" loading="lazy" />{/if}
									<div class="act-body">
										<span class="act-text"><b>{a.author?.username}</b> {actText(a)} <b>{a.title}</b></span>
										<span class="act-time">{ago(a.created_at)}</span>
									</div>
								</a>
							{/each}
						</div>
					</section>
				{/if}

				{#if sIncoming.length}
					<section>
						<h2>Заявки в друзья <span class="cnt">{sIncoming.length}</span></h2>
						<div class="req-list">
							{#each sIncoming as p (p.id)}
								<div class="req">
									<div class="req-user">
										{#if p.avatar_url}<img src={p.avatar_url} alt="" referrerpolicy="no-referrer" />{:else}<span class="ph"><Icon name="user" size={20} /></span>{/if}
										<span>{p.username}</span>
									</div>
									<div class="req-actions">
										<button class="accept" on:click={() => respond(p, true)}>Принять</button>
										<button class="decline" on:click={() => respond(p, false)}>Отклонить</button>
									</div>
								</div>
							{/each}
						</div>
					</section>
				{/if}

				<section>
					<h2>Мои друзья <span class="cnt">{sFriends.length}</span></h2>
					{#if sFriends.length}
						<div class="req-list">
							{#each sFriends as p (p.id)}
								<div class="req">
									<div class="req-user">
										{#if p.avatar_url}<img src={p.avatar_url} alt="" referrerpolicy="no-referrer" />{:else}<span class="ph"><Icon name="user" size={20} /></span>{/if}
										<span>{p.username}</span>
									</div>
									<button class="decline" on:click={() => unfriend(p)}>Удалить</button>
								</div>
							{/each}
						</div>
					{:else}
						<p class="muted">Друзей пока нет — найдите кого-нибудь через поиск выше.</p>
					{/if}
				</section>
			{/if}
		{:else if !$userToken}
			<div class="auth-needed">
				<p>Войдите, чтобы видеть друзей</p>
				<a class="btn" href="/login">Войти</a>
			</div>
		{:else if loading}
			<Spinner center label="Загрузка…" />
		{:else}
			{#if requests.length}
				<section>
					<h2>Заявки в друзья <span class="cnt">{requests.length}</span></h2>
					<div class="req-list">
						{#each requests as p (p.id)}
							<div class="req">
								<a href={`/profile/${p.id}`} class="req-user">
									{#if p.avatar}<img src={p.avatar} alt="" referrerpolicy="no-referrer" />{/if}
									<span>{p.login}</span>
								</a>
								<button class="accept" on:click={() => accept(p)}>Принять</button>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<section>
				<h2>Мои друзья</h2>
				<ProfileGrid profiles={friends} empty="Друзей пока нет" />
			</section>
		{/if}
	</div>
</div>

<style>
	.page {
		height: 100%;
		overflow-y: auto;
	}
	.inner {
		max-width: 1100px;
		margin: 0 auto;
		padding: 24px;
	}
	h1 {
		font-size: 30px;
		font-weight: 800;
		margin-bottom: 22px;
	}
	section {
		margin-bottom: 32px;
	}
	h2 {
		font-size: 18px;
		font-weight: 700;
		margin-bottom: 16px;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.cnt {
		font-size: 12px;
		padding: 2px 8px;
		border-radius: 9px;
		background: var(--primary-color);
		color: #fff;
	}
	.req-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.req {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
		border-radius: 14px;
	}
	.req-user {
		display: flex;
		align-items: center;
		gap: 12px;
		color: var(--text-color);
		font-weight: 600;
	}
	.req-user img {
		width: 42px;
		height: 42px;
		border-radius: 50%;
		object-fit: cover;
	}
	.accept {
		padding: 9px 18px;
		border: none;
		border-radius: 10px;
		background: var(--primary-color);
		color: #fff;
		font-weight: 600;
		cursor: pointer;
	}
	.req-actions {
		display: flex;
		gap: 8px;
	}
	.decline {
		padding: 9px 16px;
		border: 1px solid var(--glass-border);
		border-radius: 10px;
		background: transparent;
		color: var(--secondary-text-color);
		font-weight: 600;
		cursor: pointer;
	}
	.decline:hover {
		color: var(--dropped-color);
		border-color: var(--dropped-color);
	}
	.tag {
		font-size: 12.5px;
		color: var(--secondary-text-color);
	}
	.req-user .ph {
		width: 42px;
		height: 42px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: var(--elevated-color);
		color: var(--third-text-color);
	}
	.search {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 16px;
		margin-bottom: 24px;
		border-radius: 14px;
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
		color: var(--secondary-text-color);
	}
	.search input {
		flex: 1;
		border: none;
		background: transparent;
		color: var(--text-color);
		font-size: 15px;
		outline: none;
	}
	.muted {
		color: var(--secondary-text-color);
		margin-bottom: 24px;
	}
	.feed {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.act {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 14px;
		border-radius: 12px;
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
		color: inherit;
	}
	.act:hover {
		border-color: var(--primary-color);
	}
	.act-av {
		width: 34px;
		height: 34px;
		min-width: 34px;
		border-radius: 50%;
		overflow: hidden;
		display: grid;
		place-items: center;
		background: var(--elevated-color);
		color: var(--third-text-color);
	}
	.act-av img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.act-poster {
		width: 34px;
		height: 48px;
		min-width: 34px;
		border-radius: 6px;
		object-fit: cover;
	}
	.act-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.act-text {
		font-size: 14px;
		line-height: 1.4;
	}
	.act-time {
		font-size: 12px;
		color: var(--third-text-color);
	}
	.auth-needed {
		text-align: center;
		padding: 60px;
		color: var(--secondary-text-color);
	}
	.auth-needed .btn {
		display: inline-block;
		margin-top: 14px;
		padding: 12px 24px;
		background: var(--primary-color);
		color: #fff;
		border-radius: 12px;
		font-weight: 600;
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
