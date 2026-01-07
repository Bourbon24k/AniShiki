<script>
	import { browser } from '$app/environment';
	
	let isMobile = false;
	let theme = 'dark';
	
	if (browser) {
		isMobile = window.innerWidth <= 768;
		const settings = localStorage.getItem('guiSettings');
		if (settings) {
			const parsed = JSON.parse(settings);
			theme = parsed.theme || 'dark';
		}
	}

	function toggleTheme() {
		theme = theme === 'dark' ? 'light' : 'dark';
		const settings = { theme, enableAnimations: true };
		localStorage.setItem('guiSettings', JSON.stringify(settings));
		document.body.className = `${theme}-theme`;
	}

	function logout() {
		localStorage.removeItem('user_token');
		window.location.reload();
	}
</script>

<div class="settings-page" class:mobile={isMobile}>
	<div class="page-header">
		<h1>Настройки</h1>
	</div>

	<div class="settings-section">
		<h2>Внешний вид</h2>
		<div class="setting-item">
			<span>Тема</span>
			<button class="theme-toggle" on:click={toggleTheme}>
				{theme === 'dark' ? '🌙 Темная' : '☀️ Светлая'}
			</button>
		</div>
	</div>

	<div class="settings-section">
		<h2>Аккаунт</h2>
		<button class="logout-btn" on:click={logout}>
			Выйти из аккаунта
		</button>
	</div>

	<div class="settings-footer">
		<p>AniShika v1.0.0</p>
		<p>Неофициальный веб-клиент Anixart</p>
	</div>
</div>

<style>
	.settings-page {
		padding: 20px;
		max-width: 800px;
		margin: 0 auto;
	}

	.page-header h1 {
		font-size: 28px;
		margin-bottom: 30px;
	}

	.settings-section {
		background: var(--alt-background-color);
		border-radius: 12px;
		padding: 20px;
		margin-bottom: 20px;
	}

	.settings-section h2 {
		font-size: 18px;
		margin-bottom: 16px;
		color: var(--text-color);
	}

	.setting-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 0;
	}

	.theme-toggle {
		padding: 8px 16px;
		background: var(--primary-color);
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 14px;
	}

	.logout-btn {
		padding: 12px 24px;
		background: rgba(255, 107, 107, 0.2);
		color: var(--primary-color);
		border: 1px solid var(--primary-color);
		border-radius: 8px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
	}

	.settings-footer {
		text-align: center;
		padding: 20px;
		color: rgba(255, 255, 255, 0.4);
		font-size: 12px;
	}

	.settings-footer p {
		margin: 4px 0;
	}
</style>
