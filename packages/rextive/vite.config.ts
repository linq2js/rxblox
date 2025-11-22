/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dts from "vite-plugin-dts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
    }),
  ],
  // Don't define __DEV__ at library build time - let the consuming application
  // define it based on their build mode. This ensures proper tree-shaking
  // in the consumer's production build, not the library's build.
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "rextive",
      formats: ["es", "umd"],
      fileName: (format) => `rextive.${format === "es" ? "js" : "umd.js"}`,
    },
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true,
        passes: 2,
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      external: ["react", "react-dom", "immer"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          immer: "immer",
        },
        manualChunks: undefined,
      },
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.type.check.ts",
        "**/*.type.check.tsx",
        "**/test/**",
        "**/examples/**",
        "**/src/index.ts",
        "**/src/react/index.ts",
      ],
    },
    onConsoleLog(log, type) {
      // Suppress React warning about functions not being valid children in tests
      if (
        type === "stderr" &&
        log.includes("Functions are not valid as a React child")
      ) {
        return false;
      }
      return true;
    },
  },
});

