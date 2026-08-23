<script>
	/** Публичные коллекции пользователя сайта. */
	import { page } from '$app/stores';
	import { authReady } from '$lib/stores/auth';
	import { listCollectionsByUser } from '$lib/collections';
	import CollectionCard from '$lib/components/CollectionCard.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import ProfileSubPage from '$lib/components/ProfileSubPage.svelte';

	$: id = $page.params.id;

	let items = [];
	let loading = true;

	async function load(userId) {
		loading = true;
		const loaded = await listCollectionsByUser(userId).catch(() => []);
		if (userId !== id) return;
		items = loaded;
		loading = false;
	}

	// Ждём восстановления сессии: без токена свои закрытые данные не придут.
	let loadedFor;
	$: if ($authReady && id && id !== loadedFor) {
		loadedFor = id;
		load(id);
	}
</script>

<ProfileSubPage backHref={`/u/${id}`} title="Коллекции">
	{#if loading}
		<Spinner center />
	{:else if !items.length}
		<p class="note">Коллекций пока нет.</p>
	{:else}
		<div class="grid">
			{#each items as c (c.id)}
				<CollectionCard collection={c} />
			{/each}
		</div>
	{/if}
</ProfileSubPage>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
		gap: 16px;
	}
	.note {
		text-align: center;
		padding: 70px 20px;
		color: var(--secondary-text-color);
	}
	@media (max-width: 768px) {
		.grid {
			grid-template-columns: 1fr 1fr;
			gap: 12px;
		}
	}
</style>
