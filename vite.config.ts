import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load environment variables from process.env (Vercel) and .env files
  // The third argument '' ensures we load all variables, not just those with VITE_ prefix
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    define: {
      // Polyfill process.env.API_KEY for the browser environment
      // This is critical for Vercel deployment to prevent "process is not defined" runtime errors
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Polyfill the empty process object to prevent crashes on other process.* accesses
      'process.env': {},
    },
    build: {
      // Resolve the "Some chunks are larger than 500 kB" warning
      rollupOptions: {
        output: {
          manualChunks: {
            // Split third-party libraries into a separate 'vendor' chunk
            vendor: ['react', 'react-dom', 'd3', 'lucide-react', '@google/genai'],
          },
        },
      },
    },
  };
});