import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "out",
    emptyOutDir: true,
  },
  server: {
    host: "::",
    port: 3000,
    proxy: {
      "/api": "http://localhost:4309",
      "/socket.io": {
        target: "http://localhost:4309",
        ws: true,
      },
    },
  },
});
