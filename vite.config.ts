import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    base: './', // Use relative paths
    define: {
      // This ensures process.env.API_KEY is replaced by the actual string during build
      // Default to empty string if undefined to avoid "process is not defined" errors
      'process.env.API_KEY': JSON.stringify(env.API_KEY || 'AIzaSyAm3oIyGTPb1-Knso8Rtj58vU4nvyOYxCU')
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      port: 3000,
    }
  };
});