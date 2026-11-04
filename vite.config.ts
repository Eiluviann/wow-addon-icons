import { defineConfig } from 'vite';

export default defineConfig({
	root: 'web',
	// Relative asset paths, so the build works under any GitHub Pages repo path.
	base: './',
	build: { outDir: '../web-dist', emptyOutDir: true, target: 'es2022' },
	worker: { format: 'es' },
});
