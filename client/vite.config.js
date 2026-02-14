import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { viteSingleFile } from "vite-plugin-singlefile"

// This is your main configuration file
export default defineConfig({
  plugins: [react(), viteSingleFile()], // viteSingleFile is added here
  build: {
    target: "esnext",
    assetsInlineLimit: 100000000, 
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    outDir: "dist",
  },
})