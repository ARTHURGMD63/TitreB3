// Configuration de Vite : l'interface Vue vit dans client/, le build est servi par Express.
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'client',
  plugins: [vue()],
  build: { outDir: 'dist', emptyOutDir: true },
  // En développement, les appels /api sont relayés vers le serveur Express
  // L'en-tête Origin est réécrit pour passer le contrôle anti-CSRF du serveur (développement uniquement)
  server: { port: 5173, proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true, headers: { Origin: 'http://localhost:3000' } } } }
});
