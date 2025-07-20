import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  base: "/cw-gce-pricing/", // GitHub Pages
  plugins: [react()],
  server: {
    host: "127.0.0.1" // https://github.com/vitejs/vite/issues/16522
  }
})
