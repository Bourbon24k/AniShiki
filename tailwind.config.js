/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				primary: '#cc2e56',
				bg: '#121212',
				'bg-alt': '#1a1919'
			},
			fontFamily: {
				mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
			}
		}
	},
	plugins: []
};
