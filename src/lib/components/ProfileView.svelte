<script>
	/**
	 * Экран профиля — общий для аккаунта Anixart и аккаунта сайта.
	 *
	 * Раньше он существовал только для Anixart, а профиль сайта был отдельной
	 * страницей с вкладками и без статистики. Чтобы у двух видов аккаунта был
	 * ровно один набор возможностей, вся отрисовка живёт здесь, а страницы
	 * только приводят свои данные к общей форме (см. поле `p`).
	 *
	 * Кнопки действий отличаются у Anixart и сайта (выход, заявка в друзья,
	 * настройки), поэтому они приходят слотом.
	 */
	import Icon from './Icon.svelte';
	import ReleaseRow from './ReleaseRow.svelte';
	import Donut from './Donut.svelte';
	import AreaChart from './AreaChart.svelte';
	import { fmtNum, timeAgo, thumb, returnTimeString } from '$lib/utils';

	/** @type {any} Нормализованный профиль, см. normalize* в страницах. */
	export let p;

	/** Сколько последних дней показывать на графике динамики. */
	const RANGES = [
		{ id: 7, label: 'Неделя' },
		{ id: 14, label: '2 недели' },
		{ id: 31, label: 'Месяц' }
	];
	let range = 14;

	$: dynamics = buildDynamics(p?.dailyWatch, range);
	$: hasDynamics = (p?.dailyWatch || []).some((d) => Number(d?.count) > 0);

	/**
	 * Динамика просмотра.
	 *
	 * На входе не временной ряд, а разрозненные пары «метка времени → сколько
	 * серий». У Anixart это 31 ячейка по числам месяца, и метка у давно не
	 * тронутых ячеек отстаёт на год; у сайта это записи активности. Поэтому
	 * строим окно последних N дней от сегодня и раскладываем значения по
	 * календарным дням, а остальные дни оставляем честными нулями.
	 */
	function buildDynamics(raw, days) {
		const counts = new Map();
		for (const item of raw || []) {
			const ms = Number(item?.ms);
			if (!Number.isFinite(ms) || ms <= 0) continue;
			const key = dayKey(new Date(ms));
			counts.set(key, (counts.get(key) || 0) + (Number(item.count) || 0));
		}
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const points = [];
		for (let back = days - 1; back >= 0; back--) {
			const date = new Date(today);
			date.setDate(today.getDate() - back);
			points.push({
				value: counts.get(dayKey(date)) ?? 0,
				label: shortDate(date),
				full: fullDate(date)
			});
		}
		return points;
	}

	function dayKey(date) {
		return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
	}
	function shortDate(date) {
		return `${date.getDate()} ${date.toLocaleDateString('ru-RU', { month: 'short' })}`;
	}
	function fullDate(date) {
		return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
	}
</script>

<div class="profile">
	<div class="cover">
		{#if p.avatar}
			<img class="cover-art" src={p.avatar} alt="" referrerpolicy="no-referrer" aria-hidden="true" />
		{/if}
	</div>
	<div class="container">
		{#each p.banners || [] as b}
			<div class="banner" class:danger={b.danger}>
				{#if b.title}<strong>{b.title}</strong>{/if}
				<span>{b.text}</span>
			</div>
		{/each}

		{#if (p.badges || []).length}
			<div class="badges">
				{#each p.badges as b}
					<span class="role" style={`--c:#${String(b.color).replace('#', '')}`}>{b.name}</span>
				{/each}
			</div>
		{/if}

		<header class="head">
			<div class="avatar" class:online={p.isOnline}>
				{#if p.avatar}
					<img src={p.avatar} alt="" referrerpolicy="no-referrer" />
				{:else}
					<Icon name="user" size={48} />
				{/if}
			</div>
			<div class="ident">
				<h1>
					{p.name}
					{#if p.score != null}
						<span class="rating" class:good={Number(p.score) >= 0}>{fmtNum(p.score)}</span>
					{/if}
				</h1>
				{#if p.status}<p class="status" data-selectable>{p.status}</p>{/if}
				<p class="reg">
					{#if p.registeredYear}на сайте с {p.registeredYear} · {/if}
					{p.isOnline ? 'в сети' : `был(а) ${timeAgo(p.lastActivitySec)}`}
				</p>
			</div>
			<div class="head-actions"><slot name="actions" /></div>
		</header>

		{#if (p.socials || []).length && !p.socialHidden}
			<div class="socials">
				{#each p.socials as s}
					{#if s.url}
						<a class="social" href={s.url} target="_blank" rel="noopener noreferrer" style={`--c:${s.color}`}>
							<b>{s.label}</b> {s.name}
						</a>
					{:else}
						<span class="social" style={`--c:${s.color}`}><b>{s.label}</b> {s.name}</span>
					{/if}
				{/each}
			</div>
		{/if}

		{#if p.statsHidden}
			<div class="banner">Статистика, оценки и история скрыты настройками приватности.</div>
		{:else}
			<section class="card stats">
				<div class="card-head">
					<h2>Статистика</h2>
					{#if p.bookmarksHref}
						<a class="more" href={p.bookmarksHref}>Показать все <Icon name="chevronRight" size={16} /></a>
					{/if}
				</div>
				<div class="stats-body">
					<div class="stats-text">
						<div class="legend">
							{#each p.lists as s}
								<a class="leg" href={s.href}>
									<span class="dot" style={`background:${s.color}`}></span>
									{s.label} <b>{fmtNum(s.value || 0)}</b>
								</a>
							{/each}
						</div>
						{#each p.preferred || [] as group}
							<p class="pref">
								{group.label}:
								{#each group.items.slice(0, 4) as item, i}
									{i > 0 ? ', ' : ' '}<a href={`/search?genre=${encodeURIComponent(item.name)}`}>{item.name}</a>
									<span class="pct">{item.percentage}%</span>
								{/each}
							</p>
						{/each}
						<p class="pref">Просмотрено серий: <b>{fmtNum(p.watchedEpisodes || 0)}</b></p>
						{#if p.watchTime}
							<p class="pref">
								Время просмотра: <b>~{p.watchTime.long}</b>
								<span class="pct">≈ {p.watchTime.hoursLong}</span>
							</p>
						{/if}
						{#if p.avgRating}
							<p class="pref">Средняя оценка: <b>{p.avgRating}</b></p>
						{/if}
					</div>
					<Donut segments={p.lists} />
				</div>
			</section>

			{#if hasDynamics}
				<section class="card">
					<div class="card-head">
						<h2>Динамика просмотра серий</h2>
						<div class="ranges">
							{#each RANGES as r}
								<button class="range" class:on={range === r.id} on:click={() => (range = r.id)}>
									{r.label}
								</button>
							{/each}
						</div>
					</div>
					<AreaChart points={dynamics} />
					<p class="chart-hint">Наведите или проведите пальцем, чтобы увидеть конкретный день.</p>
				</section>
			{/if}
		{/if}

		<nav class="links">
			{#each p.links || [] as l}
				<a class="link" href={l.href}>
					<span class="lico"><Icon name={l.icon} size={20} /></span>
					<span class="lname">{l.label}</span>
					{#if l.count != null}<span class="cnt">{fmtNum(l.count)}</span>{/if}
				</a>
			{/each}
		</nav>

		{#if !p.statsHidden && (p.votes || []).length}
			<section class="card">
				<div class="card-head">
					<h2>Оценки</h2>
					{#if p.votesHref}
						<a class="more" href={p.votesHref}>Посмотреть все <Icon name="chevronRight" size={16} /></a>
					{/if}
				</div>
				<div class="votes">
					{#each p.votes.slice(0, 12) as v (v.id)}
						<a class="vote" href={`/release/${v.id}`}>
							<div class="vposter">
								{#if v.image}
									<img src={thumb(v.image, { w: 128 })} alt="" referrerpolicy="no-referrer" loading="lazy" decoding="async" />
								{/if}
							</div>
							<div class="vbody">
								<span class="vtitle">{v.title}</span>
								<span class="stars" aria-label={`Оценка ${v.stars} из 5`}>
									{#each [1, 2, 3, 4, 5] as star}
										<Icon name="star" size={14} fill={star <= v.stars ? '#ffc107' : 'var(--gray-btn)'} />
									{/each}
								</span>
								<span class="vdate">
									{#if v.label}{v.label}{#if v.dateMs} · {/if}{/if}{#if v.dateMs}{returnTimeString(v.dateMs, true)}{/if}
								</span>
							</div>
						</a>
					{/each}
				</div>
				{#if p.votes.length > 12 && p.votesHref}
					<a class="see-all" href={p.votesHref}>Ещё оценки <Icon name="chevronRight" size={16} /></a>
				{/if}
			</section>
		{/if}

		{#if !p.statsHidden && (p.history || []).length}
			<ReleaseRow title="Недавно просмотренные" items={p.history} href={p.historyHref} />
		{/if}

		<slot />
	</div>
</div>

<style>
	/* Обложка: размытый аватар в полную силу, затухающий книзу.
	   Ничего не притеняем — от затемнения шапка выглядела грязным пятном. */
	.cover {
		height: 300px;
		position: relative;
		overflow: hidden;
		background: var(--background-color);
	}
	.cover-art {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		/* Увеличение прячет размытые края картинки за границами блока. */
		transform: scale(1.25);
		filter: blur(38px) saturate(145%);
	}
	/* Затухание отдельным слоем, а не маской на картинке: маска масштабируется
	   вместе с ней, её «прозрачный» конец уезжает за границу блока, и низ
	   обложки обрывался резкой полосой. Этот слой не масштабируется. */
	.cover::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to bottom,
			transparent 0%,
			transparent 34%,
			color-mix(in srgb, var(--background-color) 45%, transparent) 62%,
			color-mix(in srgb, var(--background-color) 82%, transparent) 84%,
			var(--background-color) 100%
		);
	}
	.container {
		position: relative;
		max-width: 1100px;
		margin: -120px auto 0;
		padding: 0 24px 60px;
	}
	.banner {
		margin: 0 0 12px;
		padding: 13px 16px;
		border-radius: 14px;
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
		font-size: 13.5px;
		color: var(--secondary-text-color);
	}
	.banner.danger {
		border-color: color-mix(in srgb, var(--danger-color) 50%, transparent);
	}
	.banner strong {
		display: block;
		color: var(--danger-color);
		font-size: 14.5px;
		margin-bottom: 3px;
	}

	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
		margin-bottom: 12px;
		position: relative;
		z-index: 2;
	}

	.role {
		padding: 5px 12px;
		border-radius: 999px;
		border: 1px solid var(--c);
		color: var(--c);
		font-size: 12.5px;
		font-weight: 600;
		background: color-mix(in srgb, var(--c) 12%, transparent);
	}

	.head {
		display: flex;
		align-items: flex-end;
		gap: 22px;
		margin-bottom: 20px;
	}
	.avatar {
		position: relative;
		width: 112px;
		height: 112px;
		min-width: 112px;
		border-radius: 50%;
		overflow: hidden;
		display: grid;
		place-items: center;
		background: var(--alt-background-color);
		border: 4px solid var(--background-color);
		color: var(--secondary-text-color);
	}
	.avatar.online {
		border-color: var(--watching-color);
	}
	.avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.ident {
		flex: 1;
		min-width: 0;
		padding-bottom: 6px;
	}
	h1 {
		font-size: 27px;
		font-weight: 800;
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.rating {
		font-size: 13px;
		font-weight: 700;
		padding: 2px 9px;
		border-radius: 8px;
		border: 1px solid var(--bad-reputation-color);
		color: var(--bad-reputation-color);
	}
	.rating.good {
		border-color: var(--good-reputation-color);
		color: var(--good-reputation-color);
	}
	.status {
		color: var(--text-color);
		margin: 5px 0;
		font-size: 14.5px;
		white-space: pre-wrap;
	}
	.reg {
		font-size: 13px;
		color: var(--third-text-color);
	}
	.head-actions {
		display: flex;
		gap: 10px;
		padding-bottom: 6px;
		flex-shrink: 0;
	}
	/* Кнопки действий приходят слотом, поэтому размечены в странице и её
	   областью видимости — :global здесь обязателен, иначе стили до них
	   не доходят. */
	.head-actions :global(.btn) {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 10px 16px;
		border-radius: 12px;
		font-weight: 600;
		font-size: 14px;
		cursor: pointer;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
		color: var(--text-color);
	}
	.head-actions :global(.btn.primary) {
		background: var(--primary-color);
		border-color: transparent;
		color: #fff;
	}
	.head-actions :global(.btn:disabled) {
		opacity: 0.6;
	}

	.socials {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 18px;
	}
	.social {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 8px 14px;
		border-radius: 11px;
		border: 1px solid var(--c);
		color: var(--c);
		font-size: 13px;
		transition: background 0.18s ease, color 0.18s ease;
	}
	.social b {
		font-weight: 700;
	}
	a.social:hover {
		background: var(--c);
		color: #fff;
	}

	.card {
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
		border-radius: 18px;
		padding: 20px 22px;
		margin-bottom: 16px;
	}
	.card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 16px;
	}
	.card-head h2 {
		font-size: 19px;
		font-weight: 700;
	}
	.card-head.plain {
		margin-bottom: 14px;
	}
	.more {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		font-size: 13px;
		font-weight: 600;
		color: var(--secondary-text-color);
		white-space: nowrap;
	}
	.more:hover {
		color: var(--primary-color);
	}

	.stats-body {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		flex-wrap: wrap;
	}
	.stats-text {
		flex: 1;
		min-width: 240px;
	}
	.legend {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 6px 18px;
		margin-bottom: 14px;
	}
	.leg {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13.5px;
		color: var(--secondary-text-color);
		white-space: nowrap;
	}
	.leg b {
		color: var(--text-color);
		font-weight: 800;
	}
	.dot {
		width: 12px;
		height: 12px;
		border-radius: 4px;
		flex-shrink: 0;
	}
	.pref {
		font-size: 13.5px;
		color: var(--secondary-text-color);
		line-height: 1.75;
	}
	.pref a {
		color: var(--text-color);
	}
	.pref a:hover {
		color: var(--primary-color);
	}
	.pref b {
		color: var(--text-color);
	}
	.pct {
		font-size: 12px;
		color: var(--third-text-color);
	}

	.links {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 12px;
		margin-bottom: 24px;
	}
	.link {
		display: flex;
		align-items: center;
		gap: 11px;
		padding: 15px;
		border-radius: 14px;
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
		color: var(--text-color);
		font-weight: 600;
		transition: transform 0.15s ease, border-color 0.2s ease;
	}
	.link:hover {
		transform: translateY(-2px);
		border-color: var(--primary-color);
	}
	.lico {
		display: grid;
		place-items: center;
		color: var(--primary-color);
	}
	.lname {
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.link .cnt {
		color: var(--third-text-color);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	.ranges {
		display: flex;
		gap: 4px;
		padding: 3px;
		border-radius: 11px;
		background: var(--background-color);
		border: 1px solid var(--glass-border);
	}
	.range {
		padding: 6px 11px;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--secondary-text-color);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
	}
	.range.on {
		background: var(--primary-color);
		color: #fff;
	}
	.chart-hint {
		margin-top: 10px;
		font-size: 12px;
		color: var(--third-text-color);
	}
	.see-all {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		margin-top: 14px;
		font-size: 13px;
		font-weight: 600;
		color: var(--primary-color);
	}
	.votes {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 12px;
	}
	.vote {
		display: flex;
		gap: 12px;
		color: var(--text-color);
	}
	.vposter {
		width: 54px;
		min-width: 54px;
		aspect-ratio: 2/3;
		border-radius: 9px;
		overflow: hidden;
		background: var(--background-color);
	}
	.vposter img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.vbody {
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 4px;
	}
	.vtitle {
		font-size: 14px;
		font-weight: 600;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		line-height: 1.3;
	}
	.stars {
		display: flex;
		gap: 1px;
	}
	.vdate {
		font-size: 11.5px;
		color: var(--third-text-color);
	}

	section h2 {
		font-size: 19px;
		font-weight: 700;
	}
	section {
		margin-bottom: 30px;
	}
	/* Последний блок не должен добавлять пустоту над нижней панелью. */
	section:last-child,
	.card:last-child {
		margin-bottom: 0;
	}
	@media (max-width: 768px) {
		/* На телефоне обложка во весь рост оставляла пустую полосу в пол-экрана. */
		.cover {
			height: 200px;
		}
		/* Перекрытие подобрано так, чтобы аватар стоял ниже самой яркой части
		   обложки: раньше он приходился ровно на её нижнюю кромку. Разница
		   высоты и отрицательного отступа — это и есть пустая полоса над
		   бейджем; было 118px, стало 66px. */
		.container {
			margin-top: -134px;
			padding: 0 14px 12px;
		}
		.badges {
			justify-content: center;
		}
		.head {
			flex-direction: column;
			align-items: center;
			text-align: center;
			gap: 14px;
		}
		.ident {
			text-align: center;
		}
		h1 {
			justify-content: center;
		}
		.head-actions {
			width: 100%;
		}
		.head-actions :global(.btn) {
			flex: 1;
			justify-content: center;
		}
		.socials {
			justify-content: center;
		}
		.stats-body {
			flex-direction: column-reverse;
			align-items: stretch;
		}
		.stats-body :global(svg) {
			align-self: center;
		}
		.legend {
			grid-template-columns: 1fr 1fr;
		}
		.card {
			padding: 16px;
		}
	}
</style>
