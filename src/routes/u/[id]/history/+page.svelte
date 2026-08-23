<script>
	/** История просмотра пользователя сайта (скрывается приватностью). */
	import { page } from '$app/stores';
	import { authReady } from '$lib/stores/auth';
	import { getSiteProfile } from '$lib/siteprofile';
	import GridList from '$lib/components/GridList.svelte';
	import ProfileSubPage from '$lib/components/ProfileSubPage.svelte';

	$: id = $page.params.id;

	let profile = null;
	let loading = true;

	$: hidden = profile?.statsHidden;
	$: items = profile?.history || [];

	async function load(userId) {
		loading = true;
		const loaded = await getSiteProfile(userId).catch(() => null);
		if (userId !== id) return;
		profile = loaded;
		loading = false;
	}

	// Ждём восстановления сессии: без токена свои закрытые данные не придут.
	let loadedFor;
	$: if ($authReady && id && id !== loadedFor) {
		loadedFor = id;
		load(id);
	}
</script>

<ProfileSubPage backHref={`/u/${id}`} title="История">
	{#if hidden}
		<p class="note">История просмотра скрыта настройками приватности пользователя.</p>
	{:else}
		<GridList {items} {loading} empty="История пуста" />
	{/if}
</ProfileSubPage>

<style>
	.note {
		text-align: center;
		padding: 70px 20px;
		color: var(--secondary-text-color);
	}
</style>
