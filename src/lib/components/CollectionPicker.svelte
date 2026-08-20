<script>
	import { listMyCollections, createCollection, addToCollection } from '$lib/collections';
	import { showToast } from '$lib/stores';
	import Icon from './Icon.svelte';

	export let release;

	let open = false;
	let items = [];
	let loading = false;
	let loaded = false;
	let creating = false;
	let title = '';
	let busy = false;

	async function toggle() {
		open = !open;
		if (open && !loaded) {
			loading = true;
			items = await listMyCollections().catch(() => []);
			loaded = true;
			loading = false;
		}
	}

	async function put(collection) {
		if (busy) return;
		busy = true;
		try {
			await addToCollection(collection.id, release);
			showToast(`Добавлено в «${collection.title}»`, 'success');
			open = false;
		} catch (e) {
			console.error('collection add', e);
			showToast('Не удалось добавить', 'error');
		}
		busy = false;
	}

	async function createAndPut() {
		const name = title.trim();
		if (!name) return showToast('Нужно название', 'error');
		busy = true;
		try {
			const created = await createCollection({ title: name });
			await addToCollection(created.id, release);
			items = [created, ...items];
			title = '';
			creating = false;
			open = false;
			showToast(`Коллекция «${name}» создана`, 'success');
		} catch (e) {
			console.error('collection create', e);
			showToast('Не удалось создать', 'error');
		}
		busy = false;
	}
</script>

<div class="wrap">
	<button class="icon-btn" on:click={toggle} aria-label="В коллекцию" title="Добавить в коллекцию">
		<Icon name="collection" size={20} />
	</button>

	{#if open}
		<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
		<div class="backdrop" on:click={() => (open = false)}></div>
		<div class="pop">
			<div class="pop-head">
				<strong>В коллекцию</strong>
				<button class="x" on:click={() => (open = false)} aria-label="Закрыть">
					<Icon name="close" size={15} />
				</button>
			</div>

			{#if loading}
				<p class="hint">Загрузка…</p>
			{:else if items.length === 0 && !creating}
				<p class="hint">Коллекций пока нет</p>
			{:else if !creating}
				<div class="list">
					{#each items as c (c.id)}
						<button class="row" on:click={() => put(c)} disabled={busy}>
							<span class="name">{c.title}</span>
							<span class="cnt">{c.release_count}</span>
						</button>
					{/each}
				</div>
			{/if}

			{#if creating}
				<div class="create">
					<input bind:value={title} maxlength="100" placeholder="Название коллекции" />
					<button class="primary" on:click={createAndPut} disabled={busy}>Создать</button>
				</div>
			{:else}
				<button class="add" on:click={() => (creating = true)}>Новая коллекция</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.wrap {
		position: relative;
	}
	.icon-btn {
		width: 46px;
		height: 46px;
		display: grid;
		place-items: center;
		border: 1px solid var(--glass-border);
		border-radius: 12px;
		background: transparent;
		color: var(--text-color);
		cursor: pointer;
	}
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 40;
	}
	.pop {
		position: absolute;
		right: 0;
		bottom: calc(100% + 8px);
		z-index: 50;
		width: 260px;
		padding: 12px;
		border-radius: 14px;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
	}
	.pop-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 10px;
		font-size: 14px;
	}
	.x {
		width: 26px;
		height: 26px;
		display: grid;
		place-items: center;
		border: none;
		border-radius: 7px;
		background: transparent;
		color: var(--secondary-text-color);
		cursor: pointer;
	}
	.hint {
		padding: 6px 0 10px;
		font-size: 13px;
		color: var(--secondary-text-color);
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-height: 220px;
		overflow-y: auto;
		margin-bottom: 8px;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 9px 10px;
		border: none;
		border-radius: 9px;
		background: transparent;
		color: var(--text-color);
		font-size: 13.5px;
		text-align: left;
		cursor: pointer;
	}
	.row:hover {
		background: var(--background-color);
	}
	.row .name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.row .cnt {
		flex-shrink: 0;
		font-size: 11.5px;
		color: var(--secondary-text-color);
	}
	.create {
		display: flex;
		gap: 6px;
	}
	.create input {
		flex: 1;
		min-width: 0;
		padding: 9px 10px;
		border-radius: 9px;
		border: 1px solid var(--glass-border);
		background: var(--background-color);
		color: var(--text-color);
		font: inherit;
		font-size: 13px;
	}
	.add,
	.primary {
		width: 100%;
		padding: 9px 12px;
		border: none;
		border-radius: 9px;
		background: var(--primary-color);
		color: #fff;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
	}
	.primary {
		width: auto;
		flex-shrink: 0;
	}
	.add:disabled,
	.primary:disabled,
	.row:disabled {
		opacity: 0.6;
		cursor: default;
	}
</style>
