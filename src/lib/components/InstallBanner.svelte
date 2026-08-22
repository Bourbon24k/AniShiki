<script>
	/**
	 * Предложение установить приложение и включить уведомления.
	 *
	 * На iOS системного диалога установки нет — только «Поделиться → На экран
	 * «Домой»», поэтому там показываем шаги. И только после установки Safari
	 * разрешает спрашивать про уведомления, так что это второй, отдельный шаг.
	 */
	import { onMount } from 'svelte';
	import {
		installPrompt,
		standalone,
		updateReady,
		applyUpdate,
		isIosSafari,
		promptInstall,
		notificationPermission,
		requestNotifications
	} from '$lib/pwa';
	import { showToast } from '$lib/stores';
	import Icon from './Icon.svelte';

	const DISMISS_KEY = 'install_dismissed_until';
	const NOTIFY_KEY = 'notify_dismissed_until';

	let dismissed = true;
	let notifyDismissed = true;
	let ios = false;
	let steps = false;

	onMount(() => {
		ios = isIosSafari();
		dismissed = !expired(DISMISS_KEY);
		notifyDismissed = !expired(NOTIFY_KEY);
	});

	function expired(key) {
		try {
			return Number(localStorage.getItem(key) || 0) <= Date.now();
		} catch {
			return true;
		}
	}

	function snooze(key, days) {
		try {
			localStorage.setItem(key, String(Date.now() + days * 24 * 3600 * 1000));
		} catch {
			/* приватный режим */
		}
	}

	$: canInstall = !$standalone && !dismissed && ($installPrompt || ios);
	// Уведомления имеет смысл предлагать только в установленном приложении:
	// в Safari на iPhone разрешение всё равно не выдадут.
	$: canNotify =
		$standalone &&
		!notifyDismissed &&
		$notificationPermission === 'default' &&
		typeof Notification !== 'undefined';

	function hideInstall() {
		dismissed = true;
		steps = false;
		snooze(DISMISS_KEY, 14);
	}

	function hideNotify() {
		notifyDismissed = true;
		snooze(NOTIFY_KEY, 30);
	}

	async function install() {
		if ($installPrompt) {
			const ok = await promptInstall($installPrompt);
			if (ok) hideInstall();
			return;
		}
		steps = !steps;
	}

	async function enableNotifications() {
		const result = await requestNotifications();
		if (result === 'granted') {
			showToast('Уведомления включены', 'success');
			hideNotify();
		} else if (result === 'denied') {
			showToast('Уведомления запрещены в настройках устройства', 'error');
			hideNotify();
		}
	}
</script>

{#if $updateReady}
	<div class="bar update" role="status">
		<Icon name="discover" size={18} />
		<span class="one-line">Доступно обновление приложения</span>
		<button class="go" on:click={applyUpdate}>Обновить</button>
	</div>
{:else if canNotify}
	<div class="bar" role="complementary">
		<span class="ic"><Icon name="notification" size={18} /></span>
		<div class="text">
			<strong>Сообщать о новых сериях?</strong>
			<span>Придёт уведомление, когда выйдет серия из списка «Смотрю»</span>
		</div>
		<button class="go" on:click={enableNotifications}>Включить</button>
		<button class="close" on:click={hideNotify} aria-label="Скрыть"><Icon name="close" size={16} /></button>
	</div>
{:else if canInstall}
	<div class="bar" role="complementary">
		<span class="ic"><Icon name="play" size={18} /></span>
		<div class="text">
			<strong>Установить AniShiki</strong>
			<span>
				{ios
					? 'Откроется во весь экран, без адресной строки Safari'
					: 'Полный экран, ярлык и работа офлайн'}
			</span>
			{#if steps}
				<ol class="steps">
					<li>Нажмите <b>«Поделиться»</b> на нижней панели Safari</li>
					<li>Пролистайте до <b>«На экран «Домой»</b></li>
					<li>Подтвердите — иконка появится рядом с остальными приложениями</li>
				</ol>
			{/if}
		</div>
		<button class="go" on:click={install}>{ios ? (steps ? 'Понятно' : 'Как?') : 'Установить'}</button>
		<button class="close" on:click={hideInstall} aria-label="Скрыть"><Icon name="close" size={16} /></button>
	</div>
{/if}

<style>
	.bar {
		position: fixed;
		left: 12px;
		right: 12px;
		bottom: calc(var(--nav-height) + 14px + var(--safe-bottom, 0px));
		z-index: 60;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border-radius: 18px;
		border: 1px solid var(--glass-border);
		background: var(--elevated-color);
		box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45);
		color: var(--text-color);
		animation: fadeInUp 0.3s ease both;
	}
	.bar.update {
		border-color: color-mix(in srgb, var(--primary-color) 45%, var(--glass-border));
	}
	.ic {
		width: 34px;
		height: 34px;
		flex-shrink: 0;
		display: grid;
		place-items: center;
		border-radius: 11px;
		background: color-mix(in srgb, var(--primary-color) 18%, transparent);
		color: var(--primary-color);
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
	.one-line {
		flex: 1;
		font-size: 13px;
		font-weight: 600;
	}
	.steps {
		margin: 10px 0 2px 16px;
		display: flex;
		flex-direction: column;
		gap: 5px;
		font-size: 12.5px;
		color: var(--text-color);
		line-height: 1.45;
	}
	.go {
		flex-shrink: 0;
		padding: 9px 14px;
		border: none;
		border-radius: 11px;
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
	@media (min-width: 769px) {
		.bar {
			left: auto;
			right: 24px;
			bottom: 24px;
			max-width: 400px;
		}
	}
</style>
