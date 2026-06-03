import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds the whole game into ONE self-contained HTML file (all JS + CSS
// inlined). Run from anywhere — including double-clicking from disk (file://).
// When opened standalone the bundled card art / music files aren't beside it,
// so the game uses its built-in procedural cards and generative audio.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    outDir: 'dist-single',
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 8000,
    rollupOptions: {
      output: { inlineDynamicImports: true }
    }
  }
});
