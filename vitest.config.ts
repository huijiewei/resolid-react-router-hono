import { defineConfig, type ViteUserConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
}) as ViteUserConfig;
