<script>
	/**
	 * Шапка на телефоне. В standalone под ней проходит статус-бар (мы просили
	 * black-translucent), поэтому высота считается вместе с верхней зоной
	 * безопасности — иначе часы наезжают на заголовок.
	 */
	import { mobileMenuOpen, userToken } from '$lib/stores';
	import { siteSession, siteProfile } from '$lib/stores/auth';
	import { haptic } from '$lib/ios';
	import Icon from './Icon.svelte';

	export let showBack = false;

	$: avatar = $userToken?.avatar || $siteProfile?.avatar_url || null;
	$: profileHref = $userToken ? `/profile/${$userToken.id}` : $siteSession ? `/u/${$siteSession.user.id}` : '/login';

	function back() {
		haptic('light');
		history.back();
	}
</script>

<header class="header">
	<div class="side">
		{#if showBack}
			<button class="ico-btn" on:click={back} aria-label="Назад">
				<Icon name="back" />
			</button>
		{:else}
			<button class="ico-btn" on:click={() => mobileMenuOpen.set(true)} aria-label="Меню">
				<Icon name="menu" />
			</button>
		{/if}
	</div>
	<a href="/" class="logo">
		AniShiki<img class="mark" src="/favicon.svg" alt="" width="28" height="28" />
	</a>
	<div class="side right">
		<a href={profileHref} class="ico-btn ava" aria-label="Профиль">
			{#if avatar}
				<img src={avatar} alt="" referrerpolicy="no-referrer" />
			{:else}
				<Icon name="user" size={22} />
			{/if}
		</a>
	</div>
</header>

<style>
	.header {
		display: none;
		position: sticky;
		top: 0;
		/* Плюс пара пикселей к зоне безопасности: вплотную под статус-баром
		   шапка выглядела поджатой. */
		height: calc(52px + var(--safe-top, 0px) + 4px);
		padding: calc(var(--safe-top, 0px) + 4px) 10px 0;
		align-items: center;
		justify-content: space-between;
		z-index: 50;
		/* Сплошной фон страницы вместо стекла: размытие подкрашивало полосу
		   под шапкой, и на экранах с обложкой её край читался как шов.
		   Стык прячет уже сама обложка — она уходит в этот же цвет. */
		background: var(--background-color);
	}
	.side {
		display: flex;
		align-items: center;
		min-width: 44px;
	}
	.right {
		justify-content: flex-end;
	}
	.ico-btn {
		width: 38px;
		height: 38px;
		display: grid;
		place-items: center;
		border: none;
		background: transparent;
		color: var(--text-color);
		border-radius: 50%;
		cursor: pointer;
		transition: transform 0.12s ease;
	}
	.ico-btn:active {
		transform: scale(0.9);
	}
	.ava {
		overflow: hidden;
		background: var(--alt-background-color);
		color: var(--secondary-text-color);
	}
	.ava img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.logo {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: 19px;
		font-weight: 800;
		letter-spacing: -0.3px;
	}
	/* Значок вместо «β» — в полную высоту строки, а не приписка сверху. */
	.logo .mark {
		width: 1.5em;
		height: 1.5em;
		flex-shrink: 0;
	}
	@media (max-width: 768px) {
		.header {
			display: flex;
		}
	}
</style>
