import type { Preset } from "@react-router/dev/config";
import { dirname, join, relative } from "node:path";
import { buildEntry } from "../build-utils";

export type NodePresetOptions = {
  entryFile?: string;
};

// noinspection JSUnusedGlobalSymbols
export const nodePreset = (options?: NodePresetOptions): Preset => {
  // noinspection JSUnusedGlobalSymbols
  return {
    name: "@resolid/react-router-hono-node-preset",
    reactRouterConfig: () => {
      return {
        buildEnd: async ({ buildManifest, reactRouterConfig, viteConfig }) => {
          const rootPath = viteConfig.root;
          const appPath = reactRouterConfig.appDirectory;
          const serverBuildFile = reactRouterConfig.serverBuildFile;
          const serverBuildPath = join(reactRouterConfig.buildDirectory, "server");

          const buildDir = relative(rootPath, reactRouterConfig.buildDirectory);
          const assetsDir = viteConfig.build.assetsDir ?? "assets";

          const ssrExternal = viteConfig.ssr.external;

          const serverBundles = buildManifest?.serverBundles ?? {
            site: { id: "site", file: relative(rootPath, join(serverBuildPath, serverBuildFile)) },
          };

          for (const key in serverBundles) {
            const serverBundleId = serverBundles[key].id;
            const buildFile = join(rootPath, serverBundles[key].file);
            const buildPath = dirname(buildFile);

            await buildEntry(
              appPath,
              options?.entryFile ?? "server.ts",
              buildPath,
              buildFile,
              buildDir,
              assetsDir,
              serverBundleId,
              join(rootPath, "package.json"),
              ssrExternal,
            );
          }
        },
      };
    },
  };
};
