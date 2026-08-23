<script>
	/** Закладки пользователя сайта: те же пять списков плюс избранное. */
	import { page } from '$app/stores';
	import { authReady } from '$lib/stores/auth';
	import { getSiteProfile } from '$lib/siteprofile';
	import GridList from '$lib/components/GridList.svelte';
	import ProfileSubPage from '$lib/components/ProfileSubPage.svelte';

	$: id = $page.params.id;

	/** @type {{ key: number | 'fav', label: string }[]} */
	const TABS = [
		{ key: 1, label: 'Смотрю' },
		{ key: 2, label: 'В планах' },
		{ key: 3, label: 'Просмотрено' },
		{ key: 4, label: 'Отложено' },
		{ key: 5, label: 'Брошено' },
		{ key: 'fav', label: 'Избранное' }
	];

	let profile = null;
	let loading = true;
	/** @type {number | 'fav'} В адресе может стоять type=fav — числом он не разбирается. */
	let active =
		$page.url.searchParams.get('type') === 'fav'
			? 'fav'
			: Number($page.url.searchParams.get('type')) || 1;

	$: items = !profile ? [] : active === 'fav' ? profile.favorites : profile.byStatus(Number(active));

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

<ProfileSubPage backHref={`/u/${id}`} title="Закладки">
	<div class="tabs no-scrollbar" slot="tabs">
		{#each TABS as t}
			<button class="tab" class:active={active === t.key} on:click={() => (active = t.key)}>
				{t.label}
			</button>
		{/each}
	</div>
	{#if profile?.statsHidden}
		<p class="note">Списки скрыты настройками приватности пользователя.</p>
	{:else}
		<GridList {items} {loading} empty="Список пуст" />
	{/if}
</ProfileSubPage>

<style>
	.note {
		text-align: center;
		padding: 70px 20px;
		color: var(--secondary-text-color);
	}
</style>
