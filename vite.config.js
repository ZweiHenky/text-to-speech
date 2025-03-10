import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        },
      },
      includeAssets: ['favicon.png'],
      manifest: {
        name: 'Text to Speech',
        short_name: 'TS',
        description: 'Convert text to speech',
        theme_color: '#ffffff',
        icons: [
          {
            src: '512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
