import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'autoUpdate',
    manifest: {
      name: 'Deduction Notes',
      short_name: 'Deduction',
      description: 'Player-side notes for social deduction games',
      theme_color: '#0b0f14',
      background_color: '#0b0f14',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
    },
  }), cloudflare()],
  server: {
    // so the dev server is reachable from a phone on the same wifi
    host: true,
  },
})