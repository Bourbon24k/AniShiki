<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import {
		getCollection,
		updateCollection,
		deleteCollection,
		removeFromCollection
	} from '$lib/collections';
	import { showToast } from '$lib/stores';
	import AnimeCard from '$lib/components/AnimeCard.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	$: id = $page.params.id;

	let collection = null;
	let loading = true;
	let notFound = false;
	let editing = false;
	let title = '';
	let description = '';
	let isPublic = true;
	let saving = false;

	async function load(collectionId) {
		loading = true;
		collection = await getCollection(collectionId).catch((e) => {
			console.error('collection', e);
			return null;
		});
		notFound = !collection;
		if (collection) {
			title = collection.title;
			description = collection.description || '';
			isPublic = collection.is_public;
		}
		loading = false;
	}

	let loadedFor;
	$: if (id && id !== loadedFor) {
		loadedFor = id;
		load(id);
	}

	async function save() {
		if (!title.trim()) return showToast('Нужно название', 'error');
		saving = true;
		try {
			await updateCollection(id, { title: title.trim(), description, isPublic });
			collection = { ...collection, title: title.trim(), description, is_public: isPublic };
			editing = false;
			showToast('Сохранено', 'success');
		} catch (e) {
			console.error(e);
			showToast('Не удалось сохранить', 'error');
		}
		saving = false;
	}

	async function drop() {
		if (!confirm('Удалить коллекцию? Это необратимо.')) return;
		try {
			await deleteCollection(id);
			showToast('Коллекция удалена', 'success');
			goto('/collections');
		} catch (e) {
			console.error(e);
			showToast('Не удалось удалить', 'error');
		}
	}

	async function removeItem(releaseId) {
		collection = {
			...collection,
			releases: collection.releases.filter((r) => r.id !== releaseId)
		};
		await removeFromCollection(id, releaseId).catch(() => {});
	}
</script>

<svelte:head><title>{collection?.title || 'Коллекция'} — AniShiki</title></svelte:head>

<div class="page">
	<div class="inner">
		{#if loading}
			<Spinner center label="Загрузка…" />
		{:else if notFound}
			<div class="empty">
				<p>Коллекция не найдена или скрыта автором</p>
				<a class="btn" href="/collections">К коллекциям</a>
			</div>
		{:else}
			<header class="top">
				<div class="info">
					{#if editing}
						<input class="fld" bind:value={title} maxlength="100" placeholder="Название" />
						<textarea class="fld" bind:value={description} maxlength="1000" rows="3" placeholder="Описание"
						></textarea>
						<label class="chk">
							<input type="checkbox" bind:checked={isPublic} />
							Видна всем
						</label>
						<div class="actions">
							<button class="primary" on:click={save} disabled={saving}>Сохранить</button>
							<button class="ghost" on:click={() => (editing = false)}>Отмена</button>
						</div>
					{:else}
						<h1>{collection.title}</h1>
						{#if collection.description}<p class="desc">{collection.description}</p>{/if}
						<p class="meta">
							<a href={`/u/${collection.author.id}`}>{collection.author.username}</a>
							· {collection.releases.length} тайтлов
							{#if !collection.is_public}· скрытая{/if}
						</p>
					{/if}
				</div>

				{#if collection.isMine && !editing}
					<div class="owner">
						<button class="ghost" on:click={() => (editing = true)}>
							<Icon name="settings" size={16} /> Изменить
						</button>
						<button class="danger" on:click={drop}><Icon name="close" size={16} /> Удалить</button>
					</div>
				{/if}
			</header>

			{#if collection.releases.length === 0}
				<p class="empty">
					В коллекции пока пусто.
					{#if collection.isMine}Добавляйте тайтлы кнопкой на странице релиза.{/if}
				</p>
			{:else}
				<div class="grid">
					{#each collection.releases as r (r.id)}
						<div class="cell">
							<AnimeCard anime={r} type="grid" />
							{#if collection.isMine}
								<button class="rm" aria-label="Убрать" on:click={() => removeItem(r.id)}>
									<Icon name="close" size={14} />
								</button>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.page {
		height: 100%;
		overflow-y: auto;
	}
	.inner {
		max-width: 1400px;
		margin: 0 auto;
		padding: 24px;
	}
	.top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 22px;
	}
	.info {
		flex: 1;
		min-width: 0;
	}
	h1 {
		font-size: 28px;
		font-weight: 800;
		letter-spacing: -0.4px;
	}
	.desc {
		margin-top: 6px;
		font-size: 14px;
		color: var(--secondary-text-color);
		white-space: pre-wrap;
	}
	.meta {
		margin-top: 8px;
		font-size: 13px;
		color: var(--secondary-text-color);
	}
	.meta a {
		color: var(--primary-color);
		font-weight: 600;
	}
	.fld {
		display: block;
		width: 100%;
		max-width: 560px;
		margin-bottom: 10px;
		padding: 11px 13px;
		border-radius: 11px;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
		color: var(--text-color);
		font: inherit;
		font-size: 14px;
		resize: vertical;
	}
	.chk {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--secondary-text-color);
	}
	.actions,
	.owner {
		display: flex;
		gap: 8px;
		margin-top: 12px;
	}
	.owner {
		margin-top: 0;
		flex-shrink: 0;
	}
	button {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 9px 14px;
		border-radius: 10px;
		border: 1px solid var(--glass-border);
		background: transparent;
		color: var(--text-color);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}
	button.primary {
		background: var(--primary-color);
		border-color: var(--primary-color);
		color: #fff;
	}
	button.danger {
		color: #ff6b6b;
	}
	button:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
		gap: 18px;
	}
	.cell {
		position: relative;
	}
	.rm {
		position: absolute;
		top: 8px;
		right: 8px;
		width: 28px;
		height: 28px;
		padding: 0;
		display: grid;
		place-items: center;
		border: none;
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.65);
		color: #fff;
	}
	.empty {
		padding: 40px 0;
		text-align: center;
		color: var(--secondary-text-color);
	}
	.btn {
		display: inline-block;
		margin-top: 12px;
		padding: 10px 18px;
		border-radius: 10px;
		background: var(--primary-color);
		color: #fff;
		font-weight: 700;
	}
	@media (max-width: 768px) {
		.inner {
			padding: 16px 12px 24px;
		}
		.top {
			flex-direction: column;
		}
		h1 {
			font-size: 22px;
		}
		.grid {
			grid-template-columns: repeat(auto-fill, minmax(134px, 1fr));
			gap: 12px;
		}
	}
</style>
