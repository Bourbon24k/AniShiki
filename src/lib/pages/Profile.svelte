<script>
	import { browser } from '$app/environment';
	
	let isMobile = false;
	
	if (browser) {
		isMobile = window.innerWidth <= 768;
	}
</script>

<div class="profile-page" class:mobile={isMobile}>
	<div class="page-header">
		<h1>Профиль</h1>
	</div>
	<div class="content">
		<p>Раздел в разработке</p>
	</div>
</div>

<style>
	.profile-page {
		padding: 20px;
	}
	.page-header h1 {
		font-size: 28px;
		margin-bottom: 20px;
	}
	.content {
		color: rgba(255, 255, 255, 0.6);
	}
</style>
