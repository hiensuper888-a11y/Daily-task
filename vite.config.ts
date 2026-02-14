import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    base: './', // Use relative paths for flexible deployment
    define: {
      // Safely replace process.env.API_KEY with the string value during build
      // Using JSON.stringify ensures it's wrapped in quotes
      'process.env.API_KEY': JSON.stringify(env.API_KEY || 'AIzaSyAm3oIyGTPb1-Knso8Rtj58vU4nvyOYxCU'),
      // Prevent "process is not defined" error in browser
      'process.env': {} 
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
    },
    server: {
      port: 3000,
      host: true // Expose to network for testing
    }
  };
});