import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Minimalni frontend config. API proxy (/api -> lokalni Worker) dodaje vlasnik
// Worker/dev setupa; ovdje se namjerno ne pretpostavlja port ni ruta.
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
