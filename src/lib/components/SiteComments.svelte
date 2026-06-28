<script>
	import { onMount } from 'svelte';
	import { siteSession } from '$lib/stores/auth';
	import { showToast } from '$lib/stores';
	import { listComments, addComment, deleteComment } from '$lib/sitedata';
	import Icon from './Icon.svelte';

	export let releaseId;

	let items = [];
	let text = '';
	let loading = true;
	let sending = false;

	$: me = $siteSession?.user?.id;

	async function load() {
		loading = true;
		items = await listComments(releaseId);
		loading = false;
	}

	async function send() {
		const t = text.trim();
		if (!t) return;
		sending = true;
		try {
			await addComment(releaseId, t);
			text = '';
			await load();
		} catch {
			showToast('Не удалось отправить', 'error');
		}
		sending = false;
	}

	async function remove(c) {
		try {
			await deleteComment(c.id);
			items = items.filter((x) => x.id !== c.id);
		} catch {
			showToast('Ошибка', 'error');
		}
	}

	function fmt(ts) {
		const d = new Date(ts);
		return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
	}

	onMount(load);
</script>

<section class="sc">
	<h2>Обсуждение AniShiki {#if items.length}<span class="cnt">{items.length}</span>{/if}</h2>

	<div class="composer">
		<textarea
			bind:value={text}
			rows="2"
			maxlength="2000"
			placeholder="Поделитесь мнением…"
		></textarea>
		<button class="send" on:click={send} disabled={sending || !text.trim()}>
			<Icon name="chevronRight" size={18} />
		</button>
	</div>

	{#if loading}
		<p class="muted">Загрузка…</p>
	{:else if !items.length}
		<p class="muted">Пока нет комментариев — будьте первым.</p>
	{:else}
		<div class="list">
			{#each items as c (c.id)}
				<div class="c">
					<div class="av">
						{#if c.author?.avatar_url}
							<img src={c.author.avatar_url} alt="" referrerpolicy="no-referrer" />
						{:else}
							<Icon name="user" size={18} />
						{/if}
					</div>
					<div class="body">
						<div class="meta">
							<span class="name">{c.author?.username || 'Пользователь'}</span>
							<span class="time">{fmt(c.created_at)}</span>
							{#if c.user_id === me}
								<button class="del" on:click={() => remove(c)} aria-label="Удалить">
									<Icon name="close" size={14} />
								</button>
							{/if}
						</div>
						<p class="text">{c.text}</p>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>

<style>
	.sc {
		margin-top: 8px;
	}
	h2 {
		font-size: 20px;
		font-weight: 700;
		margin-bottom: 16px;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.cnt {
		font-size: 12px;
		padding: 2px 9px;
		border-radius: 9px;
		background: var(--primary-color);
		color: #fff;
	}
	.composer {
		display: flex;
		gap: 10px;
		align-items: flex-end;
		margin-bottom: 22px;
	}
	textarea {
		flex: 1;
		resize: vertical;
		min-height: 46px;
		padding: 12px 14px;
		border-radius: 12px;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
		color: var(--text-color);
		font-size: 14px;
		font-family: inherit;
		outline: none;
	}
	textarea:focus {
		border-color: var(--primary-color);
	}
	.send {
		width: 46px;
		height: 46px;
		min-width: 46px;
		border: none;
		border-radius: 12px;
		background: var(--primary-color);
		color: #fff;
		cursor: pointer;
		display: grid;
		place-items: center;
	}
	.send:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.c {
		display: flex;
		gap: 12px;
	}
	.av {
		width: 40px;
		height: 40px;
		min-width: 40px;
		border-radius: 50%;
		overflow: hidden;
		display: grid;
		place-items: center;
		background: var(--elevated-color);
		color: var(--third-text-color);
	}
	.av img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.body {
		flex: 1;
		min-width: 0;
	}
	.meta {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 3px;
	}
	.name {
		font-weight: 700;
		font-size: 14px;
	}
	.time {
		font-size: 12px;
		color: var(--third-text-color);
	}
	.del {
		margin-left: auto;
		border: none;
		background: transparent;
		color: var(--third-text-color);
		cursor: pointer;
		padding: 2px;
		border-radius: 6px;
	}
	.del:hover {
		color: var(--dropped-color);
	}
	.text {
		font-size: 14px;
		line-height: 1.5;
		color: var(--secondary-text-color);
		white-space: pre-wrap;
		word-break: break-word;
	}
</style>
