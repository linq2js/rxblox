import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "rxblox",
      formats: ["es", "umd"],
      fileName: (format) => `rxblox.${format === "es" ? "js" : "umd.js"}`,
    },
    rollupOptions: {
      external: ["react", "react-dom"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    onConsoleLog(log, type) {
      // Suppress React warning about functions not being valid children in tests
      if (
        type === "warn" &&
        log.includes("Functions are not valid as a React child")
      ) {
        return false;
      }
      return true;
    },
  },
});
