import type { Preset } from "@react-router/dev/config";
import { dirname, join, relative } from "node:path";
import { buildEntry, type BundlerLoader, getServerBundles, type NodeVersion } from "../build-utils";

export type NodePresetOptions = {
  entryFile?: string;
  nodeVersion?: NodeVersion;
  bundleLoader?: BundlerLoader;
};

// noinspection JSUnusedGlobalSymbols
export const nodePreset = (options?: NodePresetOptions): Preset => {
  const nodeVersion = options?.nodeVersion ?? 22;

  // noinspection JSUnusedGlobalSymbols
  return {
    name: "@resolid/react-router-hono-node-preset",
    reactRouterConfig: () => {
      return {
        buildEnd: async ({ buildManifest, reactRouterConfig, viteConfig }) => {
          const rootPath = viteConfig.root;
          const buildDir = relative(rootPath, reactRouterConfig.buildDirectory);
          const assetsDir = viteConfig.build.assetsDir ?? "assets";
          const packageFile = join(rootPath, "package.json");

          const serverBundles = getServerBundles(
            buildManifest,
            rootPath,
            reactRouterConfig.buildDirectory,
            reactRouterConfig.serverBuildFile,
          );

          for (const key in serverBundles) {
            const serverBundleId = serverBundles[key].id;
            const buildFile = join(rootPath, serverBundles[key].file);
            const buildPath = dirname(buildFile);

            await buildEntry(
              reactRouterConfig.appDirectory,
              options?.entryFile ?? "server.ts",
              buildPath,
              buildFile,
              buildDir,
              assetsDir,
              serverBundleId,
              packageFile,
              viteConfig.ssr.external,
              nodeVersion,
              options?.bundleLoader,
            );
          }
        },
      };
    },
  };
};
