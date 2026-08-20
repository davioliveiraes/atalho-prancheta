import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_PROXY_TARGET || "http://127.0.0.1:8000";

  // Bind mount Windows -> Linux não propaga inotify: sem polling o HMR dentro
  // do container nunca enxerga as edições feitas no host.
  const usePolling = env.VITE_USE_POLLING === "true";

  const proxyRule = {
    target: proxyTarget,
    changeOrigin: false,
    headers: {
      host: env.VITE_PROXY_HOST || "localhost:5173",
    },
  };

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      watch: usePolling ? { usePolling: true, interval: 300 } : undefined,
      proxy: {
        "^/api/": proxyRule,
        "^/media/": proxyRule,
      },
    },
  };
});
