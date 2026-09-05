import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // 로컬 개발 서버 전용 — 백엔드의 관리자 판정(세션/사내망 등, 배포 환경에서만 성립)을 우회해서
      // 항상 관리자로 취급한다. 프론트 로직(useIsAdmin 등)은 그대로 두고, 이 요청만 실제 백엔드로
      // 넘기지 않고 Vite가 직접 응답한다. vite build(운영 빌드)엔 server.proxy 자체가 적용되지 않으므로
      // 이 우회는 로컬 dev 서버에서만 동작한다.
      '/api/access/admin-status': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        bypass: (_req, res) => {
          if (!res) return
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ isAdmin: true }))
          return false
        },
      },
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
  build: {
    cssMinify: false,
  },
})
