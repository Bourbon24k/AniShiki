<script>
	import { onMount } from 'svelte';
	import { getApi } from '$lib/api';
	import { userToken, showToast } from '$lib/stores';
	import { returnTimeString } from '$lib/utils';
	import Icon from './Icon.svelte';
	import Spinner from './Spinner.svelte';

	export let releaseId;

	let comments = [];
	let page = 0;
	let loading = true;
	let loadingMore = false;
	let hasMore = true;
	let text = '';
	let spoiler = false;
	let sending = false;

	async function load(reset = false) {
		const api = getApi();
		if (!api) return;
		if (reset) {
			page = 0;
			comments = [];
			hasMore = true;
		}
		try {
			const data = await api.release.getComments({ id: releaseId, page, sort: 0 });
			const list = data?.content || [];
			comments = reset ? list : [...comments, ...list];
			hasMore = page < (data?.total_page_count ?? 1) - 1;
		} catch (e) {
			console.error('comments', e);
		}
		loading = false;
		loadingMore = false;
	}

	async function more() {
		if (!hasMore || loadingMore) return;
		loadingMore = true;
		page++;
		await load();
	}

	async function send() {
		if (!$userToken) return showToast('Войдите в аккаунт', 'error');
		if (!text.trim() || sending) return;
		sending = true;
		try {
			await getApi().release.addComment(releaseId, {
				message: text.trim(),
				isSpoiler: spoiler
			});
			text = '';
			spoiler = false;
			showToast('Комментарий отправлен', 'success');
			await load(true);
		} catch (e) {
			showToast('Не удалось отправить', 'error');
		}
		sending = false;
	}

	async function vote(c, v) {
		if (!$userToken) return showToast('Войдите в аккаунт', 'error');
		try {
			await getApi().release.voteComment(c.id, v);
			c.vote = c.vote === v ? 0 : v;
			comments = comments;
		} catch {}
	}

	onMount(() => load(true));
</script>

<section class="comments">
	<h2>Комментарии</h2>

	<div class="composer">
		<textarea
			bind:value={text}
			placeholder={$userToken ? 'Оставьте комментарий…' : 'Войдите, чтобы комментировать'}
			disabled={!$userToken}
			rows="3"
		></textarea>
		<div class="composer-foot">
			<label class="spoiler">
				<input type="checkbox" bind:checked={spoiler} disabled={!$userToken} />
				Спойлер
			</label>
			<button class="send" on:click={send} disabled={!$userToken || sending || !text.trim()}>
				{sending ? 'Отправка…' : 'Отправить'}
			</button>
		</div>
	</div>

	{#if loading}
		<Spinner center label="Загрузка комментариев…" />
	{:else if comments.length === 0}
		<p class="empty">Пока нет комментариев. Будьте первым!</p>
	{:else}
		<div class="list">
			{#each comments as c (c.id)}
				<article class="comment">
					<a href={`/profile/${c.profile?.id}`} class="avatar">
						{#if c.profile?.avatar}
							<img src={c.profile.avatar} alt="" referrerpolicy="no-referrer" />
						{:else}
							<Icon name="user" size={20} />
						{/if}
					</a>
					<div class="body">
						<div class="head">
							<a href={`/profile/${c.profile?.id}`} class="login">{c.profile?.login || 'Аноним'}</a>
							<span class="date">{returnTimeString(c.timestamp * 1000)}</span>
						</div>
						{#if c.is_spoiler}
							<details class="spoiler-block">
								<summary>Спойлер — нажмите, чтобы показать</summary>
								<p class="text">{c.message}</p>
							</details>
						{:else}
							<p class="text">{c.message}</p>
						{/if}
						<div class="actions">
							<button class:on={c.vote === 1} on:click={() => vote(c, 1)}>▲ {c.likes_count ?? c.like_count ?? 0}</button>
							<button class:on={c.vote === 2} on:click={() => vote(c, 2)}>▼ {c.dislikes_count ?? c.dislike_count ?? 0}</button>
							{#if c.reply_count > 0}<span class="replies">{c.reply_count} ответов</span>{/if}
						</div>
					</div>
				</article>
			{/each}
		</div>
		{#if hasMore}
			<button class="more" on:click={more} disabled={loadingMore}>
				{loadingMore ? 'Загрузка…' : 'Показать ещё'}
			</button>
		{/if}
	{/if}
</section>

<style>
	.comments {
		margin-top: 40px;
	}
	h2 {
		font-size: 22px;
		font-weight: 700;
		margin-bottom: 18px;
	}
	.composer {
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
		border-radius: 16px;
		padding: 14px;
		margin-bottom: 24px;
	}
	textarea {
		width: 100%;
		resize: vertical;
		background: transparent;
		border: none;
		outline: none;
		color: var(--text-color);
		font-size: 14px;
		font-family: inherit;
		line-height: 1.5;
	}
	.composer-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 10px;
	}
	.spoiler {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: var(--secondary-text-color);
	}
	.send {
		padding: 9px 18px;
		border: none;
		border-radius: 10px;
		background: var(--primary-color);
		color: #fff;
		font-weight: 600;
		cursor: pointer;
	}
	.send:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.empty {
		color: var(--secondary-text-color);
		text-align: center;
		padding: 30px;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.comment {
		display: flex;
		gap: 12px;
	}
	.avatar {
		width: 42px;
		height: 42px;
		min-width: 42px;
		border-radius: 50%;
		overflow: hidden;
		display: grid;
		place-items: center;
		background: var(--alt-background-color);
		color: var(--secondary-text-color);
	}
	.avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.body {
		flex: 1;
		min-width: 0;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 4px;
	}
	.login {
		font-weight: 600;
		font-size: 14px;
	}
	.date {
		font-size: 12px;
		color: var(--third-text-color);
	}
	.text {
		font-size: 14px;
		line-height: 1.55;
		color: var(--text-color);
		white-space: pre-wrap;
		word-break: break-word;
	}
	.spoiler-block summary {
		cursor: pointer;
		color: var(--primary-color);
		font-size: 13px;
		margin-bottom: 6px;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-top: 8px;
	}
	.actions button {
		border: none;
		background: transparent;
		color: var(--secondary-text-color);
		font-size: 13px;
		cursor: pointer;
		padding: 2px 4px;
		border-radius: 6px;
	}
	.actions button.on {
		color: var(--primary-color);
		font-weight: 700;
	}
	.replies {
		font-size: 12px;
		color: var(--third-text-color);
	}
	.more {
		display: block;
		margin: 22px auto 0;
		padding: 11px 26px;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
		color: var(--text-color);
		border-radius: 12px;
		cursor: pointer;
		font-weight: 600;
	}
</style>
