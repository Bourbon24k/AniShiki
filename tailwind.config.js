/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				primary: '#FF6B6B',
				secondary: '#4ECDC4',
				dark: '#1A1A2E',
				darker: '#16213E',
				light: '#F5F5F5'
			}
		}
	},
	plugins: []
};
