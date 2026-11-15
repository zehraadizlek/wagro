import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// `npm run evaluate`: runs the evaluation and writes docs/ml/evaluation.md.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["scripts/**/*.eval.ts"],
    environment: "node",
    testTimeout: 120000,
  },
});
