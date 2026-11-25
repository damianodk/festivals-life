import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "motion"],
          charts: ["recharts"],
          canvas: ["konva", "react-konva"],
          map: ["leaflet"],
          supabase: ["@supabase/supabase-js"]
        }
      }
    }
  }
});
