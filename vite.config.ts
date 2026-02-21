import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Sử dụng process.cwd() chuẩn xác, không dùng (process as any)
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    base: './', // Use relative paths for flexible deployment
    define: {
      // Chỉ đọc từ env. Không hardcode key thật vào đây!
      // Nếu không có key trong .env, sẽ fallback về chuỗi rỗng để tránh lộ key.
      'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || ''),
      'process.env.NODE_ENV': JSON.stringify(mode),
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