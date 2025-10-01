import type { BuildManifest, Preset } from "@react-router/dev/config";
import { cp, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import {
  buildEntry,
  type BundlerLoader,
  copyDependenciesToFunction,
  createDir,
  getServerBundles,
  getServerRoutes,
  type NodeVersion,
} from "../build-utils";

export type VercelPresetOptions = {
  regions: string[];
  entryFile?: string;
  nodeVersion?: NodeVersion;
  bundleLoader?: BundlerLoader;
  copyParentModules?: string[];
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
          const rootPath = viteConfig.root;
          const appPath = reactRouterConfig.appDirectory;
          const buildDir = relative(rootPath, reactRouterConfig.buildDirectory);
          const assetsDir = viteConfig.build.assetsDir ?? "assets";
          const packageFile = join(rootPath, "package.json");

          const serverBundles = getServerBundles(
            buildManifest,
            rootPath,
            reactRouterConfig.buildDirectory,
            reactRouterConfig.serverBuildFile,
          );

          console.log("Bundle Vercel Serverless for production...");

          const vercelOutput = await createDir([rootPath, ".vercel", "output"], true);

          await copyStaticFiles(join(reactRouterConfig.buildDirectory, "client"), vercelOutput);
          await writeVercelConfigJson(assetsDir, buildManifest, join(vercelOutput, "config.json"));

          const nftCache = {};

          for (const key in serverBundles) {
            const serverBundleId = serverBundles[key].id;
            const buildFile = join(rootPath, serverBundles[key].file);
            const buildPath = dirname(buildFile);

            const bundleFile = await buildEntry(
              appPath,
              options?.entryFile ?? "server.ts",
              buildPath,
              buildFile,
              buildDir,
              assetsDir,
              serverBundleId,
              packageFile,
              viteConfig.ssr.external,
              nodeVersion,
              options.bundleLoader,
            );

            await copyFunctionsFiles(
              rootPath,
              vercelOutput,
              buildPath,
              reactRouterConfig.serverBuildFile,
              bundleFile,
              `_${serverBundleId}`,
              nodeVersion,
              options.regions,
              options.copyParentModules ?? [],
              nftCache,
            );
          }
        },
      };
    },
  };
};

const copyFunctionsFiles = async (
  rootPath: string,
  vercelOutDir: string,
  buildPath: string,
  serverBuildFile: string,
  bundleFile: string,
  functionName: string,
  functionRuntime: NodeVersion,
  functionRegions: string[],
  copyParentModules: string[],
  nftCache: object,
) => {
  console.log(`Coping Vercel function files for ${functionName}...`);

  const vercelFunctionDir = await createDir([vercelOutDir, "functions", `${functionName}.func`]);

  await copyDependenciesToFunction(bundleFile, rootPath, vercelFunctionDir, copyParentModules, nftCache);

  await writeFile(
    join(vercelFunctionDir, ".vc-config.json"),
    JSON.stringify(
      {
        handler: "index.mjs",
        runtime: `nodejs${functionRuntime}.x`,
        launcherType: "Nodejs",
        supportsResponseStreaming: true,
        regions: functionRegions,
      },
      null,
      2,
    ),
    "utf8",
  );

  await cp(bundleFile, join(vercelFunctionDir, "index.mjs"));

  for (const file of (await readdir(buildPath)).filter(
    (file) => file != basename(bundleFile) && file != serverBuildFile,
  )) {
    await cp(join(buildPath, file), join(vercelFunctionDir, file), { recursive: true });
  }
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

  const configJson: { version: number; routes: unknown[] } = {
    version: 3,
    routes: [],
  };

  configJson.routes.push({
    src: `^/${assetsDir}/.*`,
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    continue: true,
  });

  configJson.routes.push({
    handle: "filesystem",
  });

  const bundleRoutes = getServerRoutes(buildManifest);

  for (const bundle of bundleRoutes) {
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
