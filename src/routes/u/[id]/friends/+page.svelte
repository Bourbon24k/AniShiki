<script>
	/**
	 * Друзья пользователя сайта. Раньше ссылка «Друзья» в чужом профиле вела
	 * на /friends — то есть на ваш собственный список, хотя рядом стоял счётчик
	 * чужого. У Anixart для этого есть /friends/[id], теперь есть и у сайта.
	 */
	import { page } from '$app/stores';
	import { supabase } from '$lib/supabase';
	import { authReady } from '$lib/stores/auth';
	import { getSiteProfile } from '$lib/siteprofile';
	import Icon from '$lib/components/Icon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import ProfileSubPage from '$lib/components/ProfileSubPage.svelte';

	$: id = $page.params.id;

	let items = [];
	let loading = true;
	/** Счётчик друзей в профиле уважает приватность — список обязан тоже. */
	let hidden = false;

	async function load(userId) {
		loading = true;
		const owner = await getSiteProfile(userId).catch(() => null);
		if (userId !== id) return;
		hidden = Boolean(owner?.countsHidden);
		if (hidden) {
			items = [];
			loading = false;
			return;
		}
		try {
			const { data } = await supabase
				.from('friendships')
				.select('requester, addressee')
				.eq('status', 'accepted')
				.or(`requester.eq.${userId},addressee.eq.${userId}`);
			const ids = (data || []).map((r) => (r.requester === userId ? r.addressee : r.requester));
			if (!ids.length) {
				if (userId === id) items = [];
			} else {
				const { data: profiles } = await supabase
					.from('profiles')
					.select('id, username, avatar_url, status')
					.in('id', ids);
				if (userId === id) items = profiles || [];
			}
		} catch (e) {
			console.error('friends', e);
		}
		if (userId === id) loading = false;
	}

	let loadedFor;
	$: if ($authReady && id && id !== loadedFor) {
		loadedFor = id;
		load(id);
	}
</script>

<ProfileSubPage backHref={`/u/${id}`} title="Друзья">
	{#if loading}
		<Spinner center />
	{:else if hidden}
		<p class="note">Список друзей скрыт настройками приватности пользователя.</p>
	{:else if !items.length}
		<p class="note">Друзей пока нет.</p>
	{:else}
		<div class="grid">
			{#each items as f (f.id)}
				<a class="friend" href={`/u/${f.id}`}>
					<span class="ava">
						{#if f.avatar_url}
							<img src={f.avatar_url} alt="" referrerpolicy="no-referrer" />
						{:else}
							<Icon name="user" size={22} />
						{/if}
					</span>
					<span class="who">
						<b>{f.username}</b>
						{#if f.status}<small>{f.status}</small>{/if}
					</span>
				</a>
			{/each}
		</div>
	{/if}
</ProfileSubPage>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 10px;
	}
	.friend {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border-radius: 14px;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
	}
	.ava {
		width: 44px;
		height: 44px;
		min-width: 44px;
		border-radius: 50%;
		overflow: hidden;
		display: grid;
		place-items: center;
		background: var(--elevated-color);
		color: var(--secondary-text-color);
	}
	.ava img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.who {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.who b {
		font-size: 14.5px;
		font-weight: 600;
	}
	.who small {
		font-size: 12px;
		color: var(--secondary-text-color);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.note {
		text-align: center;
		padding: 70px 20px;
		color: var(--secondary-text-color);
	}
	@media (max-width: 768px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}
</style>
