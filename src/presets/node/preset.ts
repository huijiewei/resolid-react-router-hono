import type { Preset } from "@react-router/dev/config";
import { buildPreset, type NodeVersions, type PresetBaseOptions } from "../preset-utils";

export type NodePresetOptions = PresetBaseOptions & {
  nodeVersion: NodeVersions["node"];
};

// noinspection JSUnusedGlobalSymbols
export const nodePreset = (options?: NodePresetOptions): Preset => {
  // noinspection JSUnusedGlobalSymbols
  return {
    name: "@resolid/react-router-hono-node-preset",
    reactRouterConfig: () => {
      return {
        buildEnd: async ({ buildManifest, reactRouterConfig, viteConfig }) => {
          await buildPreset({
            entryFile: options?.entryFile,
            nodeVersion: options?.nodeVersion,
            bundleLoader: options?.bundleLoader,
            buildManifest,
            reactRouterConfig,
            viteConfig,
            buildStart: async () => {
              console.log("Bundle Node Server for production...");
            },
          });
        },
      };
    },
  };
};
