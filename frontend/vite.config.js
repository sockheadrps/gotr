import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		port: 5173,
		proxy: {
			'/chapters': 'http://localhost:8100',
			'/generate': 'http://localhost:8100',
			'/stream':   'http://localhost:8100',
			'/files':    'http://localhost:8100',
			'/api':      'http://localhost:8100',
			'/static/chapters': 'http://localhost:8100',
		},
	},
});
