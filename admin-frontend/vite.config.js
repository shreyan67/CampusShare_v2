import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'CampusShare Admin',
        short_name: 'CS Admin',
        description: 'Admin dashboard for CampusShare payouts and disputes.',
        theme_color: '#1a1a1a',
        background_color: '#f5f5f0',
        display: "standalone",
        icons: [
          {
            src: 'https://cdn-icons-png.flaticon.com/512/1033/1033166.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    port: 5174
  }
})
