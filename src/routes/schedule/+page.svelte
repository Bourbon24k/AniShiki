<script>
	import { onMount } from 'svelte';
	import { getApi } from '$lib/api';
	import AnimeCard from '$lib/components/AnimeCard.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	const days = [
		['monday', 'Понедельник'],
		['tuesday', 'Вторник'],
		['wednesday', 'Среда'],
		['thursday', 'Четверг'],
		['friday', 'Пятница'],
		['saturday', 'Суббота'],
		['sunday', 'Воскресенье']
	];
	const todayIdx = (new Date().getDay() + 6) % 7;

	let data = null;
	let loading = true;
	let active = days[todayIdx][0];

	onMount(async () => {
		try {
			data = await getApi().getSchedule();
		} catch (e) {
			console.error('schedule', e);
		}
		loading = false;
	});
</script>

<svelte:head><title>Расписание — AniShiki</title></svelte:head>

<div class="page">
	<h1>Расписание</h1>

	<div class="day-tabs no-scrollbar">
		{#each days as [key, label], i}
			<button class="day" class:active={active === key} class:today={i === todayIdx} on:click={() => (active = key)}>
				{label}
			</button>
		{/each}
	</div>

	{#if loading}
		<Spinner center label="Загрузка…" />
	{:else if data}
		{#each days as [key, label]}
			{#if active === key}
				{#if data[key]?.length}
					<div class="grid">
						{#each data[key] as r (r.id)}<AnimeCard anime={r} type="grid" />{/each}
					</div>
				{:else}
					<p class="empty">На {label.toLowerCase()} ничего не запланировано</p>
				{/if}
			{/if}
		{/each}
	{/if}
</div>

<style>
	.page {
		max-width: 1500px;
		margin: 0 auto;
		padding: 24px;
	}
	h1 {
		font-size: 30px;
		font-weight: 800;
		margin-bottom: 20px;
	}
	.day-tabs {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		margin-bottom: 24px;
	}
	.day {
		white-space: nowrap;
		padding: 10px 18px;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
		color: var(--secondary-text-color);
		border-radius: 12px;
		cursor: pointer;
		font-weight: 600;
		font-size: 14px;
	}
	.day.today {
		border-color: var(--primary-color);
	}
	.day.active {
		background: var(--primary-color);
		color: #fff;
		border-color: transparent;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 18px;
	}
	.empty {
		text-align: center;
		padding: 60px;
		color: var(--secondary-text-color);
	}
	@media (max-width: 768px) {
		.page {
			padding: 16px 12px;
		}
		h1 {
			font-size: 24px;
		}
		.grid {
			grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
			gap: 12px;
		}
	}
</style>
