/**
 * «Покажись, когда приблизились».
 *
 * IntersectionObserver — основной механизм, но он молчит в некоторых
 * окружениях (встроенные веб-вью, страницы без отрисовки), а догрузка списков
 * от него зависит целиком. Поэтому рядом всегда живёт запасной вариант:
 * обычный слушатель прокрутки на ближайшем прокручиваемом предке.
 */

const MARGIN = 600;

/** Ближайший предок, который реально прокручивается. */
function scrollParent(node) {
	let el = node?.parentElement;
	while (el) {
		const style = getComputedStyle(el);
		if (/(auto|scroll|overlay)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) return el;
		el = el.parentElement;
	}
	return null;
}

/**
 * Вызвать callback, когда узел подошёл к области видимости.
 * @param {Element} node
 * @param {() => void} callback
 * @param {{ margin?: number, once?: boolean }} options
 * @returns {() => void} отписка
 */
export function whenNear(node, callback, { margin = MARGIN, once = false } = {}) {
	if (!node || typeof window === 'undefined') return () => {};

	let done = false;
	const fire = () => {
		if (done) return;
		if (once) done = true;
		callback();
	};

	let observer = null;
	if (typeof IntersectionObserver !== 'undefined') {
		observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) fire();
			},
			{ rootMargin: `${margin}px 0px` }
		);
		observer.observe(node);
	}

	const container = scrollParent(node);
	const check = () => {
		if (done) return;
		const rect = node.getBoundingClientRect();
		const limit = container ? container.getBoundingClientRect().bottom : window.innerHeight;
		if (rect.top - limit < margin) fire();
	};

	const target = container || window;
	target.addEventListener('scroll', check, { passive: true });
	window.addEventListener('resize', check, { passive: true });
	// Первая проверка сразу: элемент мог оказаться в поле зрения без прокрутки.
	const timer = setTimeout(check, 60);

	return () => {
		done = true;
		clearTimeout(timer);
		observer?.disconnect();
		target.removeEventListener('scroll', check);
		window.removeEventListener('resize', check);
	};
}
