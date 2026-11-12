import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    // Public base path. Leave unset for a root deployment; set e.g. VITE_BASE=/renga/
    // when the app is served under a sub-path (games hub).
    base: env.VITE_BASE || '/',
    plugins: [react()],
    server: {
      // Dev convenience: lets VITE_SERVER_URL point at the Vite origin to reach the local server.
      proxy: {
        '/socket.io': {
          target: 'http://localhost:3001',
          ws: true,
        },
      },
    },
  }
})
