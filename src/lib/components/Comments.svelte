<script>
	/**
	 * Комментарии к релизу.
	 *
	 * Ветки ответов раскрываются на месте, спойлер закрыт размытием (а не
	 * «деталями», которые ломали строй списка), свои комментарии можно
	 * поправить и удалить. Голоса в Anixart: 2 — «за», 1 — «против»;
	 * прежний код слал 1 на плюс, то есть ставил минус.
	 */
	import { onMount } from 'svelte';
	import { getApi } from '$lib/api';
	import { userToken, showToast } from '$lib/stores';
	import { timeAgo, fmtNum } from '$lib/utils';
	import { haptic } from '$lib/ios';
	import Icon from './Icon.svelte';
	import Spinner from './Spinner.svelte';

	export let releaseId;

	const VOTE_UP = 2;
	const VOTE_DOWN = 1;
	const MAX_LENGTH = 1500;

	// Значения сверены с ответами API: 1 — свежие сверху, 2 — старые сверху,
	// 3 — по числу голосов. Раньше «Популярные» (2) выдавали самые старые.
	const sorts = [
		{ value: 1, label: 'Новые' },
		{ value: 3, label: 'Популярные' },
		{ value: 2, label: 'Старые' }
	];

	let comments = [];
	let pageNum = 0;
	let sort = 1;
	let loading = true;
	let loadingMore = false;
	let hasMore = true;

	let text = '';
	let spoiler = false;
	let sending = false;

	/** id комментария, на который отвечаем, и id редактируемого. */
	let replyTo = null;
	let editing = null;
	let draft = '';
	let draftSpoiler = false;

	/** Раскрытые ветки: id → { items, loading, loaded } */
	let threads = {};
	/** Раскрытые спойлеры: id → true */
	let revealed = {};

	$: myId = Number($userToken?.id) || null;

	async function load(reset = false) {
		const api = getApi();
		if (!api) return;
		if (reset) {
			pageNum = 0;
			comments = [];
			threads = {};
			hasMore = true;
			loading = true;
		}
		try {
			const data = await api.release.getComments({ id: releaseId, page: pageNum, sort });
			const list = data?.content || [];
			comments = reset ? list : [...comments, ...list];
			hasMore = pageNum < (data?.total_page_count ?? 1) - 1;
		} catch (e) {
			console.error('comments', e);
			hasMore = false;
		}
		loading = false;
		loadingMore = false;
	}

	function more() {
		if (!hasMore || loadingMore) return;
		loadingMore = true;
		pageNum++;
		load();
	}

	function setSort(value) {
		if (sort === value) return;
		sort = value;
		load(true);
	}

	/* ─────────────── отправка ─────────────── */

	async function send() {
		if (!$userToken) return showToast('Войдите в аккаунт Anixart', 'error');
		const message = text.trim();
		if (!message || sending) return;
		sending = true;
		try {
			const parent = replyTo ? comments.find((c) => c.id === replyTo) || findInThreads(replyTo) : null;
			await getApi().release.addComment(releaseId, {
				message,
				isSpoiler: spoiler,
				parentCommentId: parent ? parent.parent_comment_id || parent.id : null,
				replyToProfileId: parent ? parent.profile?.id ?? null : null
			});
			text = '';
			spoiler = false;
			haptic('medium');
			showToast('Комментарий отправлен', 'success');
			if (parent) {
				const rootId = parent.parent_comment_id || parent.id;
				threads[rootId] = { ...threads[rootId], loaded: false };
				await openThread(comments.find((c) => c.id === rootId) || parent, true);
				replyTo = null;
			} else {
				await load(true);
			}
		} catch (e) {
			console.error('add comment', e);
			showToast('Не удалось отправить', 'error');
		}
		sending = false;
	}

	function findInThreads(id) {
		for (const thread of Object.values(threads)) {
			const hit = thread?.items?.find((c) => c.id === id);
			if (hit) return hit;
		}
		return null;
	}

	function startReply(comment) {
		if (!$userToken) return showToast('Войдите в аккаунт Anixart', 'error');
		replyTo = comment.id;
		editing = null;
		text = `${comment.profile?.login ? `${comment.profile.login}, ` : ''}`;
		document.getElementById('comment-input')?.focus();
	}

	function startEdit(comment) {
		editing = comment.id;
		replyTo = null;
		draft = comment.message;
		draftSpoiler = !!comment.is_spoiler;
	}

	async function saveEdit(comment) {
		const message = draft.trim();
		if (!message) return;
		try {
			await getApi().release.editComment(comment.id, message, draftSpoiler);
			patch(comment.id, { message, is_spoiler: draftSpoiler, is_edited: true });
			editing = null;
			showToast('Комментарий изменён', 'success');
		} catch (e) {
			console.error('edit comment', e);
			showToast('Не удалось изменить', 'error');
		}
	}

	async function remove(comment) {
		if (!confirm('Удалить комментарий?')) return;
		try {
			await getApi().release.removeComment(comment.id);
			comments = comments.filter((c) => c.id !== comment.id);
			for (const key of Object.keys(threads)) {
				if (threads[key]?.items) {
					threads[key] = { ...threads[key], items: threads[key].items.filter((c) => c.id !== comment.id) };
				}
			}
			showToast('Комментарий удалён', 'info');
		} catch (e) {
			console.error('delete comment', e);
			showToast('Не удалось удалить', 'error');
		}
	}

	/* ─────────────── голоса ─────────────── */

	async function vote(comment, value) {
		if (!$userToken) return showToast('Войдите в аккаунт Anixart', 'error');
		const was = comment.vote;
		const next = was === value ? 0 : value;
		// Считаем сразу, не дожидаясь ответа: ощущается быстрее, откатим при ошибке.
		const delta = weight(next) - weight(was);
		patch(comment.id, { vote: next, vote_count: (comment.vote_count || 0) + delta });
		haptic('select');
		try {
			await getApi().release.voteComment(comment.id, next === 0 ? was : next);
		} catch (e) {
			console.error('vote comment', e);
			patch(comment.id, { vote: was, vote_count: comment.vote_count });
			showToast('Голос не засчитан', 'error');
		}
	}

	function weight(value) {
		if (value === VOTE_UP) return 1;
		if (value === VOTE_DOWN) return -1;
		return 0;
	}

	/** Обновить комментарий и в корневом списке, и внутри веток. */
	function patch(id, fields) {
		comments = comments.map((c) => (c.id === id ? { ...c, ...fields } : c));
		for (const key of Object.keys(threads)) {
			const thread = threads[key];
			if (!thread?.items) continue;
			threads[key] = {
				...thread,
				items: thread.items.map((c) => (c.id === id ? { ...c, ...fields } : c))
			};
		}
	}

	/* ─────────────── ветки ─────────────── */

	async function openThread(comment, force = false) {
		const id = comment.id;
		const current = threads[id];
		if (current?.loaded && !force) {
			threads = { ...threads, [id]: { ...current, open: !current.open } };
			return;
		}
		threads = { ...threads, [id]: { items: current?.items || [], loading: true, open: true, loaded: false } };
		try {
			// Ветку читают сверху вниз — в ответах логичен обратный порядок.
			const data = await getApi().release.getCommentReplies({ id, page: 0, sort: 2 });
			threads = {
				...threads,
				[id]: { items: data?.content || [], loading: false, open: true, loaded: true }
			};
		} catch (e) {
			console.error('replies', e);
			threads = { ...threads, [id]: { items: [], loading: false, open: true, loaded: true } };
		}
	}

	function reveal(id) {
		revealed = { ...revealed, [id]: true };
	}

	onMount(() => load(true));
</script>

<section class="comments">
	<header class="sec-head">
		<h2>Комментарии</h2>
		<div class="sorts">
			{#each sorts as s}
				<button class="sort" class:on={sort === s.value} on:click={() => setSort(s.value)}>{s.label}</button>
			{/each}
		</div>
	</header>

	<div class="composer" class:replying={replyTo}>
		{#if replyTo}
			<div class="reply-hint">
				<Icon name="back" size={14} /> Ответ на комментарий
				<button on:click={() => { replyTo = null; text = ''; }} aria-label="Отменить ответ">
					<Icon name="close" size={14} />
				</button>
			</div>
		{/if}
		<textarea
			id="comment-input"
			bind:value={text}
			maxlength={MAX_LENGTH}
			placeholder={$userToken ? 'Что думаете?' : 'Войдите в аккаунт Anixart, чтобы комментировать'}
			disabled={!$userToken}
			rows="3"
		></textarea>
		<div class="composer-foot">
			<label class="spoiler-toggle">
				<input type="checkbox" bind:checked={spoiler} disabled={!$userToken} />
				<span>Спойлер</span>
			</label>
			<span class="counter" class:warn={text.length > MAX_LENGTH - 100}>{text.length}/{MAX_LENGTH}</span>
			<button class="send" on:click={send} disabled={!$userToken || sending || !text.trim()}>
				{sending ? 'Отправка…' : 'Отправить'}
			</button>
		</div>
	</div>

	{#if loading}
		<Spinner center label="Загрузка комментариев…" />
	{:else if comments.length === 0}
		<div class="empty">
			<Icon name="feed" size={30} />
			<p>Пока тихо. Скажите первое слово.</p>
		</div>
	{:else}
		<div class="list">
			{#each comments as c (c.id)}
				<article class="comment" class:deleted={c.is_deleted}>
					<a href={`/profile/${c.profile?.id}`} class="avatar">
						{#if c.profile?.avatar}
							<img src={c.profile.avatar} alt="" referrerpolicy="no-referrer" loading="lazy" decoding="async" />
						{:else}
							<Icon name="user" size={20} />
						{/if}
					</a>
					<div class="body">
						<div class="head">
							<a href={`/profile/${c.profile?.id}`} class="login">{c.profile?.login || 'Аноним'}</a>
							{#if c.profile?.is_verified}<span class="tick" title="Верифицирован"><Icon name="star" size={11} /></span>{/if}
							{#if c.profile?.is_sponsor}<span class="pro">PRO</span>{/if}
							<span class="dot">·</span>
							<span class="date">{timeAgo(c.timestamp)}</span>
							{#if c.is_edited}<span class="edited">изменён</span>{/if}
						</div>

						{#if editing === c.id}
							<div class="edit-box">
								<textarea bind:value={draft} maxlength={MAX_LENGTH} rows="3"></textarea>
								<div class="edit-foot">
									<label class="spoiler-toggle">
										<input type="checkbox" bind:checked={draftSpoiler} />
										<span>Спойлер</span>
									</label>
									<button class="mini ghost" on:click={() => (editing = null)}>Отмена</button>
									<button class="mini primary" on:click={() => saveEdit(c)}>Сохранить</button>
								</div>
							</div>
						{:else if c.is_deleted}
							<p class="text muted">Комментарий удалён</p>
						{:else if c.is_spoiler && !revealed[c.id]}
							<button class="spoiler" on:click={() => reveal(c.id)}>
								<span class="spoiler-text">{c.message}</span>
								<span class="spoiler-cap">Спойлер — нажмите, чтобы показать</span>
							</button>
						{:else}
							<p class="text">{c.message}</p>
						{/if}

						<div class="actions">
							<div class="votes">
								<button class:on={c.vote === VOTE_UP} on:click={() => vote(c, VOTE_UP)} aria-label="Нравится">
									<Icon name="chevronDown" size={15} />
								</button>
								<span class="score" class:pos={(c.vote_count || 0) > 0} class:neg={(c.vote_count || 0) < 0}>
									{fmtNum(c.vote_count || 0)}
								</span>
								<button class="down" class:on={c.vote === VOTE_DOWN} on:click={() => vote(c, VOTE_DOWN)} aria-label="Не нравится">
									<Icon name="chevronDown" size={15} />
								</button>
							</div>
							<button class="act" on:click={() => startReply(c)}>Ответить</button>
							{#if c.reply_count > 0}
								<button class="act link" on:click={() => openThread(c)}>
									{threads[c.id]?.open ? 'Скрыть' : `Ответов: ${c.reply_count}`}
								</button>
							{/if}
							{#if myId && c.profile?.id === myId && !c.is_deleted}
								<button class="act" on:click={() => startEdit(c)}>Изменить</button>
								<button class="act danger" on:click={() => remove(c)}>Удалить</button>
							{/if}
						</div>

						{#if threads[c.id]?.open}
							<div class="thread">
								{#if threads[c.id].loading}
									<div class="thread-loading"><Spinner size={18} /></div>
								{:else}
									{#each threads[c.id].items as r (r.id)}
										<article class="reply">
											<a href={`/profile/${r.profile?.id}`} class="avatar small">
												{#if r.profile?.avatar}
													<img src={r.profile.avatar} alt="" referrerpolicy="no-referrer" loading="lazy" decoding="async" />
												{:else}
													<Icon name="user" size={14} />
												{/if}
											</a>
											<div class="body">
												<div class="head">
													<a href={`/profile/${r.profile?.id}`} class="login">{r.profile?.login || 'Аноним'}</a>
													<span class="dot">·</span>
													<span class="date">{timeAgo(r.timestamp)}</span>
												</div>
												{#if r.is_spoiler && !revealed[r.id]}
													<button class="spoiler" on:click={() => reveal(r.id)}>
														<span class="spoiler-text">{r.message}</span>
														<span class="spoiler-cap">Спойлер</span>
													</button>
												{:else}
													<p class="text">{r.message}</p>
												{/if}
												<div class="actions">
													<div class="votes">
														<button class:on={r.vote === VOTE_UP} on:click={() => vote(r, VOTE_UP)} aria-label="Нравится">
															<Icon name="chevronDown" size={13} />
														</button>
														<span class="score">{fmtNum(r.vote_count || 0)}</span>
														<button class="down" class:on={r.vote === VOTE_DOWN} on:click={() => vote(r, VOTE_DOWN)} aria-label="Не нравится">
															<Icon name="chevronDown" size={13} />
														</button>
													</div>
													<button class="act" on:click={() => startReply(r)}>Ответить</button>
													{#if myId && r.profile?.id === myId}
														<button class="act danger" on:click={() => remove(r)}>Удалить</button>
													{/if}
												</div>
											</div>
										</article>
									{/each}
								{/if}
							</div>
						{/if}
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
	.sec-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		flex-wrap: wrap;
		margin-bottom: 16px;
	}
	.sec-head h2 {
		font-size: 22px;
		font-weight: 700;
	}
	.sorts {
		display: flex;
		gap: 4px;
		padding: 3px;
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
		border-radius: 12px;
	}
	.sort {
		padding: 6px 13px;
		border: none;
		border-radius: 9px;
		background: transparent;
		color: var(--secondary-text-color);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}
	.sort.on {
		background: var(--primary-color);
		color: #fff;
	}

	/* ── форма ── */
	.composer {
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
		border-radius: 16px;
		padding: 14px;
		margin-bottom: 26px;
		transition: border-color 0.2s ease;
	}
	.composer:focus-within,
	.composer.replying {
		border-color: color-mix(in srgb, var(--primary-color) 55%, transparent);
	}
	.reply-hint {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12.5px;
		color: var(--primary-color);
		margin-bottom: 8px;
	}
	.reply-hint button {
		margin-left: auto;
		border: none;
		background: transparent;
		color: var(--secondary-text-color);
		cursor: pointer;
		display: grid;
		place-items: center;
	}
	textarea {
		width: 100%;
		resize: vertical;
		background: transparent;
		border: none;
		outline: none;
		color: var(--text-color);
		font-size: 15px;
		font-family: inherit;
		line-height: 1.55;
	}
	.composer-foot {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 12px;
	}
	.spoiler-toggle {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 13px;
		color: var(--secondary-text-color);
		cursor: pointer;
	}
	.counter {
		margin-left: auto;
		font-size: 12px;
		color: var(--third-text-color);
		font-variant-numeric: tabular-nums;
	}
	.counter.warn {
		color: var(--warning-color);
	}
	.send {
		padding: 10px 20px;
		border: none;
		border-radius: 11px;
		background: var(--primary-color);
		color: #fff;
		font-weight: 700;
		font-size: 14px;
		cursor: pointer;
	}
	.send:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 44px 20px;
		color: var(--third-text-color);
	}
	.empty p {
		font-size: 14px;
	}

	/* ── список ── */
	.list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.comment {
		display: flex;
		gap: 12px;
		padding: 14px;
		border-radius: 16px;
		transition: background 0.2s ease;
	}
	.comment:hover {
		background: var(--alt-background-color);
	}
	.comment.deleted {
		opacity: 0.55;
	}
	.avatar {
		width: 40px;
		height: 40px;
		min-width: 40px;
		border-radius: 50%;
		overflow: hidden;
		display: grid;
		place-items: center;
		background: var(--alt-background-color);
		color: var(--secondary-text-color);
	}
	.avatar.small {
		width: 30px;
		height: 30px;
		min-width: 30px;
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
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 5px;
	}
	.login {
		font-weight: 700;
		font-size: 14px;
	}
	.tick {
		display: grid;
		place-items: center;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--good-reputation-color);
		color: #fff;
	}
	.pro {
		font-size: 9.5px;
		font-weight: 800;
		padding: 2px 6px;
		border-radius: 5px;
		background: linear-gradient(135deg, #ffb347, #ff7a00);
		color: #fff;
	}
	.dot,
	.date,
	.edited {
		font-size: 12px;
		color: var(--third-text-color);
	}
	.edited {
		font-style: italic;
	}
	.text {
		font-size: 14.5px;
		line-height: 1.6;
		color: var(--text-color);
		white-space: pre-wrap;
		word-break: break-word;
	}
	.text.muted {
		color: var(--third-text-color);
		font-style: italic;
	}

	/* Спойлер: текст на месте, но нечитаем — строй списка не прыгает. */
	.spoiler {
		position: relative;
		display: block;
		width: 100%;
		text-align: left;
		border: none;
		padding: 0;
		background: transparent;
		cursor: pointer;
	}
	.spoiler-text {
		display: block;
		font-size: 14.5px;
		line-height: 1.6;
		color: var(--text-color);
		white-space: pre-wrap;
		word-break: break-word;
		filter: blur(6px);
		user-select: none;
		pointer-events: none;
	}
	.spoiler-cap {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-size: 12.5px;
		font-weight: 600;
		color: var(--primary-color);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		margin-top: 9px;
	}
	.votes {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 2px;
		border-radius: 999px;
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
	}
	.comment:hover .votes {
		background: var(--background-color);
	}
	.votes button {
		width: 26px;
		height: 26px;
		display: grid;
		place-items: center;
		border: none;
		border-radius: 50%;
		background: transparent;
		color: var(--secondary-text-color);
		cursor: pointer;
		transform: rotate(180deg); /* «шеврон вниз» → стрелка вверх */
	}
	.votes button.down {
		transform: none;
	}
	.votes button.on {
		color: var(--primary-color);
	}
	.score {
		min-width: 22px;
		text-align: center;
		font-size: 12.5px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--secondary-text-color);
	}
	.score.pos {
		color: var(--good-reputation-color);
	}
	.score.neg {
		color: var(--bad-reputation-color);
	}
	.act {
		border: none;
		background: transparent;
		color: var(--secondary-text-color);
		font-size: 12.5px;
		font-weight: 600;
		padding: 6px 9px;
		border-radius: 8px;
		cursor: pointer;
	}
	.act:hover {
		background: var(--background-color);
		color: var(--text-color);
	}
	.act.link {
		color: var(--primary-color);
	}
	.act.danger:hover {
		color: var(--danger-color);
	}

	/* ── ветки ── */
	.thread {
		margin-top: 12px;
		padding-left: 14px;
		border-left: 2px solid var(--glass-border);
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.thread-loading {
		padding: 8px 0;
	}
	.reply {
		display: flex;
		gap: 10px;
	}

	/* ── редактирование ── */
	.edit-box {
		border: 1px solid var(--glass-border);
		border-radius: 12px;
		padding: 10px 12px;
		background: var(--background-color);
	}
	.edit-foot {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 8px;
	}
	.edit-foot .spoiler-toggle {
		margin-right: auto;
	}
	.mini {
		padding: 7px 14px;
		border-radius: 9px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		border: 1px solid var(--glass-border);
	}
	.mini.ghost {
		background: transparent;
		color: var(--secondary-text-color);
	}
	.mini.primary {
		background: var(--primary-color);
		border-color: transparent;
		color: #fff;
	}

	.more {
		display: block;
		margin: 24px auto 0;
		padding: 12px 28px;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
		color: var(--text-color);
		border-radius: 12px;
		cursor: pointer;
		font-weight: 600;
	}

	@media (max-width: 768px) {
		.comment {
			padding: 12px 4px;
		}
		.comment:hover {
			background: transparent;
		}
		.sec-head h2 {
			font-size: 19px;
		}
	}
</style>
