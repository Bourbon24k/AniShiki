<script>
	import { getApi } from '$lib/api';
	import { userToken, showToast } from '$lib/stores';
	import { siteSession } from '$lib/stores/auth';
	import { setListStatus } from '$lib/sitedata';
	import Icon from './Icon.svelte';

	export let releaseId;
	export let status = 0;
	export let release = null; // site-аккаунту нужен для сохранения title/image

	let open = false;

	export const LISTS = [
		{ id: 1, label: 'Смотрю', cls: 'watching' },
		{ id: 2, label: 'В планах', cls: 'plan' },
		{ id: 3, label: 'Просмотрено', cls: 'completed' },
		{ id: 4, label: 'Отложено', cls: 'hold' },
		{ id: 5, label: 'Брошено', cls: 'dropped' },
		{ id: 0, label: 'Убрать из списка', cls: 'none' }
	];

	$: current = LISTS.find((l) => l.id === status);

	async function pick(id) {
		open = false;
		if (!$userToken && !$siteSession) {
			showToast('Войдите в аккаунт', 'error');
			return;
		}
		const prev = status;
		status = id;
		try {
			if ($userToken) await getApi().release.addToProfileList(releaseId, id);
			else await setListStatus(release || { id: releaseId }, id);
			showToast(id === 0 ? 'Убрано из списка' : `В список: ${LISTS.find((l) => l.id === id).label}`, 'success');
		} catch (e) {
			status = prev;
			showToast('Ошибка', 'error');
		}
	}
</script>

<svelte:window on:click={() => (open = false)} />

<div class="wrap" on:click|stopPropagation>
	<button class="btn {current?.cls || ''}" on:click={() => (open = !open)}>
		<Icon name="bookmarkAdd" size={18} />
		<span>{status && status !== 0 ? current?.label : 'В список'}</span>
		<Icon name="chevronDown" size={16} />
	</button>
	{#if open}
		<div class="menu glass">
			{#each LISTS as l}
				<button class="opt {l.cls}" class:active={l.id === status} on:click={() => pick(l.id)}>
					{l.label}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.wrap {
		position: relative;
	}
	.btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 12px 18px;
		border-radius: 14px;
		border: 1px solid var(--glass-border);
		background: var(--elevated-color);
		color: var(--text-color);
		font-weight: 600;
		font-size: 14px;
		cursor: pointer;
		transition: transform 0.15s ease;
	}
	.btn:hover {
		transform: translateY(-2px);
	}
	.btn.watching {
		background: var(--watching-color);
		color: #fff;
		border-color: transparent;
	}
	.btn.plan {
		background: var(--plan-color);
		color: #fff;
		border-color: transparent;
	}
	.btn.completed {
		background: var(--completed-color);
		color: #fff;
		border-color: transparent;
	}
	.btn.hold {
		background: var(--hold-on-color);
		color: #fff;
		border-color: transparent;
	}
	.btn.dropped {
		background: var(--dropped-color);
		color: #fff;
		border-color: transparent;
	}
	.menu {
		position: absolute;
		top: calc(100% + 8px);
		left: 0;
		min-width: 220px;
		padding: 6px;
		border-radius: 14px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		z-index: 50;
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
	}
	.opt {
		text-align: left;
		padding: 11px 14px;
		border: none;
		background: transparent;
		color: var(--text-color);
		font-size: 14px;
		border-radius: 10px;
		cursor: pointer;
		border-left: 3px solid transparent;
	}
	.opt:hover {
		background: var(--background-color);
	}
	.opt.active {
		font-weight: 700;
	}
	.opt.watching {
		border-left-color: var(--watching-color);
	}
	.opt.plan {
		border-left-color: var(--plan-color);
	}
	.opt.completed {
		border-left-color: var(--completed-color);
	}
	.opt.hold {
		border-left-color: var(--hold-on-color);
	}
	.opt.dropped {
		border-left-color: var(--dropped-color);
	}
	.opt.none {
		color: var(--secondary-text-color);
	}
</style>
