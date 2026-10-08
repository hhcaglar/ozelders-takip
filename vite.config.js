import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    target: 'es2020',
    chunkSizeWarningLimit: 700,
  },
  // Yerel geliştirme/önizleme için: proxy önizleme alan adlarına izin ver.
  // (Üretimde etkisi yoktur — statik dosyalar Vercel tarafından sunulur.)
  server: { allowedHosts: true },
  preview: { allowedHosts: true },
})
