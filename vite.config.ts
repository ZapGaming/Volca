// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  assetsInclude: ['**/*.zcss', '**/*.glb', '**/*.wgsl'],
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    }
  },
  build: {
    target: "esnext"
  }
});
