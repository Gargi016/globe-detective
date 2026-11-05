import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths: the built site works at a domain root or in a sub-folder (routing uses the URL hash).
  base: './',
  build: {
    // The 3D engine (three.js) is large by nature. It is split into its own cached chunk and only loaded by
    // pages that show a globe; About, Profile and the 404 page never download it.
    chunkSizeWarningLimit: 2100,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three/') || id.includes('node_modules/three-globe') || id.includes('node_modules/globe.gl') || id.includes('node_modules/react-globe.gl') || id.includes('node_modules/three-')) return 'three';
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react';
          if (id.includes('node_modules/firebase/') || id.includes('node_modules/@firebase/')) return 'firebase';
          return undefined;
        },
      },
    },
  },
});
