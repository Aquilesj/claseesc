import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// La app React se compila a dist/ y la sirve el backend Express (server.js).
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist' }
});
