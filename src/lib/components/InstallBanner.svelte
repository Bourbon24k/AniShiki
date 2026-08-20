<script>
	import { onMount } from 'svelte';
	import { installPrompt, standalone, updateReady, applyUpdate, isIosSafari, promptInstall } from '$lib/pwa';
	import Icon from './Icon.svelte';

	const DISMISS_KEY = 'install_dismissed_until';
	let dismissed = true;
	let ios = false;
	let iosHint = false;

	onMount(() => {
		ios = isIosSafari();
		try {
			dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0) > Date.now();
		} catch {
			dismissed = false;
		}
	});

	// Показываем, когда есть что предложить: системный диалог или подсказка для iOS.
	$: canInstall = !$standalone && !dismissed && ($installPrompt || ios);

	function hide() {
		dismissed = true;
		iosHint = false;
		// Не мозолим глаза: следующее предложение — через две недели.
		try {
			localStorage.setItem(DISMISS_KEY, String(Date.now() + 14 * 24 * 3600 * 1000));
		} catch {}
	}

	async function install() {
		if ($installPrompt) {
			const ok = await promptInstall($installPrompt);
			if (ok) hide();
			return;
		}
		iosHint = !iosHint;
	}
</script>

{#if $updateReady}
	<div class="bar update" role="status">
		<Icon name="discover" size={18} />
		<span>Доступно обновление приложения</span>
		<button class="go" on:click={applyUpdate}>Обновить</button>
	</div>
{:else if canInstall}
	<div class="bar" role="complementary">
		<Icon name="play" size={18} />
		<div class="text">
			<strong>Установить AniShiki</strong>
			<span>{ios ? 'Добавьте на экран «Домой» — откроется как приложение' : 'Полный экран, ярлык и работа офлайн'}</span>
			{#if iosHint}
				<p class="hint">Нажмите «Поделиться» внизу Safari, затем «На экран «Домой».</p>
			{/if}
		</div>
		<button class="go" on:click={install}>{ios ? 'Как?' : 'Установить'}</button>
		<button class="close" on:click={hide} aria-label="Скрыть"><Icon name="close" size={16} /></button>
	</div>
{/if}

<style>
	.bar {
		position: fixed;
		left: 12px;
		right: 12px;
		bottom: calc(68px + var(--safe-bottom, 0px));
		z-index: 60;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border-radius: 16px;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
		box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45);
		color: var(--text-color);
		animation: fadeInUp 0.3s ease both;
	}
	.bar.update {
		border-color: color-mix(in srgb, var(--primary-color) 45%, var(--glass-border));
	}
	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.text strong {
		font-size: 14px;
	}
	.text span {
		font-size: 12px;
		color: var(--secondary-text-color);
	}
	.hint {
		margin-top: 6px;
		font-size: 12px;
		color: var(--text-color);
	}
	.go {
		flex-shrink: 0;
		padding: 9px 14px;
		border: none;
		border-radius: 10px;
		background: var(--primary-color);
		color: #fff;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
	}
	.close {
		flex-shrink: 0;
		width: 30px;
		height: 30px;
		display: grid;
		place-items: center;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--secondary-text-color);
		cursor: pointer;
	}
	.update span {
		flex: 1;
		font-size: 13px;
		font-weight: 600;
	}
	@media (min-width: 769px) {
		.bar {
			left: auto;
			right: 24px;
			bottom: 24px;
			max-width: 380px;
		}
	}
</style>
