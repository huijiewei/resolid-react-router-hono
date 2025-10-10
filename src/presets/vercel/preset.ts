import type { BuildManifest, Preset } from "@react-router/dev/config";
import { cp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildPreset, copyFilesToFunction, createDir, getServerRoutes, type PresetBaseOptions } from "../preset-utils";

export type VercelPresetOptions = PresetBaseOptions & {
  regions: string[];
};

// noinspection JSUnusedGlobalSymbols
export const vercelPreset = (options: VercelPresetOptions): Preset => {
  const nodeVersion = options.nodeVersion ?? 22;

  // noinspection JSUnusedGlobalSymbols
  return {
    name: "@resolid/react-router-hono-vercel-preset",
    reactRouterConfig: () => {
      return {
        buildEnd: async ({ buildManifest, reactRouterConfig, viteConfig }) => {
          await buildPreset<{ vercelOutput: string; nftCache: object }>({
            entryFile: options?.entryFile,
            nodeVersion,
            bundleLoader: options?.bundleLoader,
            buildManifest,
            reactRouterConfig,
            viteConfig,
            buildStart: async () => {
              console.log("Bundle Vercel Serverless for production...");

              const vercelOutput = await createDir([viteConfig.root, ".vercel", "output"], true);

              await copyStaticFiles(join(reactRouterConfig.buildDirectory, "client"), vercelOutput);
              await writeVercelConfigJson(
                viteConfig.build.assetsDir ?? "assets",
                buildManifest,
                join(vercelOutput, "config.json"),
              );

              return { vercelOutput, nftCache: {} };
            },
            buildBundleEnd: async (context, buildPath, bundleId, bundleFile) => {
              console.log(`Coping Vercel function files for ${bundleId}...`);

              const vercelFunctionDir = await createDir([context.vercelOutput, "functions", `_${bundleId}.func`], true);

              const handleFile = await copyFilesToFunction(bundleFile, vercelFunctionDir, context.nftCache);

              await writeFile(
                join(vercelFunctionDir, ".vc-config.json"),
                JSON.stringify(
                  {
                    handler: handleFile,
                    runtime: `nodejs${nodeVersion}.x`,
                    launcherType: "Nodejs",
                    supportsResponseStreaming: true,
                    regions: options.regions,
                  },
                  null,
                  2,
                ),
                "utf8",
              );
            },
          });
        },
      };
    },
  };
};

const copyStaticFiles = async (outDir: string, vercelOutDir: string) => {
  console.log("Copying assets...");

  const vercelStaticDir = await createDir([vercelOutDir, "static"]);

  await cp(outDir, vercelStaticDir, {
    recursive: true,
    force: true,
  });

  await rm(join(vercelStaticDir, ".vite"), { recursive: true, force: true });
};

const writeVercelConfigJson = async (
  assetsDir: string,
  buildManifest: BuildManifest | undefined,
  vercelConfigFile: string,
) => {
  console.log("Writing Vercel config file...");

  const configJson: { version: number; routes: unknown[]; framework: { slug: string } } = {
    version: 3,
    routes: [],
    framework: {
      slug: "vite",
    },
  };

  configJson.routes.push({
    src: `^/${assetsDir}/.*`,
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    continue: true,
  });

  configJson.routes.push({
    handle: "filesystem",
  });

  const serverRoutes = getServerRoutes(buildManifest);

  for (const bundle of serverRoutes) {
    if (bundle.path.length > 0) {
      configJson.routes.push({
        src: `^${bundle.path}(?:/.*)?$`,
        dest: `_${bundle.bundleId}`,
      });
    } else {
      configJson.routes.push({
        src: "^/.*$",
        dest: `_${bundle.bundleId}`,
      });
    }
  }

  await writeFile(vercelConfigFile, JSON.stringify(configJson, null, 2), "utf8");
};
