import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Port 4280 is allowed by the test API's CORS settings.
export default defineConfig({
  plugins: [react()],
  server: { port: 4280, strictPort: true },
  preview: { port: 4280, strictPort: true },
});
