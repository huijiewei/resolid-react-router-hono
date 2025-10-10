import type { Preset } from "@react-router/dev/config";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { name, version } from "../../../package.json";
import { buildPreset, copyFilesToFunction, createDir, getServerRoutes, type PresetBaseOptions } from "../preset-utils";

export type NetlifyPresetOptions = PresetBaseOptions;

// noinspection JSUnusedGlobalSymbols
export const netlifyPreset = (options: NetlifyPresetOptions): Preset => {
  const nodeVersion = options.nodeVersion ?? 22;

  return {
    name: "@resolid/react-router-hono-netlify-preset",
    reactRouterConfig: () => {
      return {
        buildEnd: async ({ buildManifest, reactRouterConfig, viteConfig }) => {
          await buildPreset<{
            netlifyRoot: string;
            netlifyFunctionDir: string;
            serverRoutes: { path: string; bundleId: string }[];
            nftCache: object;
          }>({
            entryFile: options.entryFile,
            nodeVersion,
            bundleLoader: options?.bundleLoader,
            buildManifest: buildManifest,
            reactRouterConfig: reactRouterConfig,
            viteConfig: viteConfig,
            buildStart: async () => {
              console.log("Bundle Netlify Serverless for production...");

              const netlifyRoot = await createDir([viteConfig.root, ".netlify", "v1"], true);

              await writeNetlifyConfigJson(viteConfig.build.assetsDir ?? "assets", join(netlifyRoot, "config.json"));

              const netlifyFunctionDir = await createDir([netlifyRoot, "functions"]);

              const serverRoutes = getServerRoutes(buildManifest);

              return { netlifyRoot, netlifyFunctionDir, serverRoutes, nftCache: {} };
            },
            buildBundleEnd: async (context, _buildPath, bundleId, bundleFile) => {
              console.log(`Coping Netlify function files for ${bundleId}...`);

              const handleFile = await copyFilesToFunction(
                bundleFile,
                await createDir([context.netlifyFunctionDir, bundleId], true),
                context.nftCache,
              );

              const serverRoutePath = context.serverRoutes.find((r) => r.bundleId == bundleId)?.path;

              const pathPattern = !serverRoutePath ? "/*" : [serverRoutePath, `${serverRoutePath}/*`];

              await writeFile(
                join(context.netlifyFunctionDir, `${bundleId}.mjs`),
                `export { default } from "./${join(bundleId, handleFile)}";

export const config = {
  path: ${Array.isArray(pathPattern) ? JSON.stringify(pathPattern) : `"${pathPattern}"`},
  displayName: "${bundleId} server",
  generator: "${name}@${version}",
  preferStatic: true,
  nodeVersion: ${nodeVersion}
};
`,
                "utf8",
              );
            },
          });
        },
      };
    },
  };
};

const writeNetlifyConfigJson = async (assetsDir: string, netlifyConfigFile: string) => {
  console.log("Writing Netlify config file...");

  const configJson: { headers: unknown[] } = {
    headers: [],
  };

  configJson.headers.push({
    for: `^/${assetsDir}/.*`,
    values: { "Cache-Control": "public, max-age=31536000, immutable" },
  });

  await writeFile(netlifyConfigFile, JSON.stringify(configJson, null, 2), "utf8");
};
