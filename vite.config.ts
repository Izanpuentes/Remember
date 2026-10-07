import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // El código está montado desde Windows: sin polling no llegan los cambios al contenedor
    watch: { usePolling: true, interval: 300 },
  },
});
