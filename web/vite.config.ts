import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative asset paths let the build run from any host or subpath.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
