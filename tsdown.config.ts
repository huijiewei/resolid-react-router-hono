import { defineConfig, type UserConfig } from "tsdown";

export default defineConfig({
  entry: {
    dev: "src/dev/index.ts",
    types: "src/types/index.ts",
    "node-server": "src/presets/node/server.ts",
    "node-preset": "src/presets/node/preset.ts",
    "netlify-server": "src/presets/netlify/server.ts",
    "netlify-preset": "src/presets/netlify/preset.ts",
    "vercel-server": "src/presets/vercel/server.ts",
    "vercel-preset": "src/presets/vercel/preset.ts",
  },
  format: "esm",
  platform: "node",
  target: "node20.19",
  dts: true,
  treeshake: true,
  clean: true,
  minify: true,
  external: [
    // virtual module provided by React Router at build time
    "virtual:react-router/server-build",
  ],
}) as UserConfig;
