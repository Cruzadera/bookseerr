const path = require("path");
const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");

module.exports = defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": process.env.BOOKSEERR_API_URL || "http://localhost:3000",
      "/locales": process.env.BOOKSEERR_API_URL || "http://localhost:3000",
      "/health": process.env.BOOKSEERR_API_URL || "http://localhost:3000",
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
});
