import { defineConfig } from "vite"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import { VitePWA } from "vite-plugin-pwa"
import * as fs from "fs"
import * as path from "path"

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        // Add compatibility with Svelte 4 API if using Svelte 5
        compatibility: {
          componentApi: 4
        }
      }
    }),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: true
      },
      manifest: {
        name: "My PWA",
        short_name: "MyPWA",
        description: "My Progressive Web App",
        theme_color: "#ffffff",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      }
    })
  ],
  server: {
    https: {
      key: fs.readFileSync("localhost-key.pem"),
      cert: fs.readFileSync("localhost.pem"),
    },
    host: "0.0.0.0"
  }
})
