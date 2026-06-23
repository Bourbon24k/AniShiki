<script>
	import { onMount } from 'svelte';
	import { getApi } from '$lib/api';
	import { userToken, showToast } from '$lib/stores';
	import ProfileGrid from '$lib/components/ProfileGrid.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	let friends = [];
	let requests = [];
	let loading = true;

	async function load() {
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

		{#if !$userToken}
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
