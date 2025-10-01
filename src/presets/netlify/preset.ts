import type { Preset } from "@react-router/dev/config";
import { writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { name, version } from "../../../package.json";
import {
  buildEntry,
  type BundlerLoader,
  copyDependenciesToFunction,
  createDir,
  getServerBundles,
  getServerRoutes,
  type NodeVersion,
} from "../build-utils";

export type NetlifyPresetOptions = {
  entryFile?: string;
  nodeVersion?: NodeVersion;
  bundleLoader?: BundlerLoader;
  copyParentModules?: string[];
};

export const netlifyPreset = (options: NetlifyPresetOptions): Preset => {
  const nodeVersion = options.nodeVersion ?? 22;

  return {
    name: "@resolid/react-router-hono-netlify-preset",
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

          console.log("Bundle Netlify Serverless for production...");

          const netlifyRoot = await createDir([rootPath, ".netlify", "v1"], true);

          await writeNetlifyConfigJson(assetsDir, join(netlifyRoot, "config.json"));

          const netlifyFunctionDir = await createDir([netlifyRoot, "functions"]);

          const serverRoutes = getServerRoutes(buildManifest);

          const nftCache = {};

          for (const key in serverBundles) {
            const serverBundleId = serverBundles[key].id;
            const buildFile = join(rootPath, serverBundles[key].file);
            const buildPath = dirname(buildFile);
            const serverRoutePath = serverRoutes.find((r) => r.bundleId == serverBundleId)?.path;

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
              netlifyFunctionDir,
              bundleFile,
              serverBundleId,
              serverRoutePath ?? "",
              nodeVersion,
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
  netlifyFunctionDir: string,
  bundleFile: string,
  functionName: string,
  functionPath: string,
  nodeVersion: NodeVersion,
  copyParentModules: string[],
  nftCache: object,
) => {
  console.log(`Coping Netlify function files for ${functionName}...`);

  await copyDependenciesToFunction(bundleFile, rootPath, netlifyFunctionDir, copyParentModules, nftCache);

  const pathPattern = functionPath == "" ? "/*" : [functionPath, `${functionPath}/*`];

  await writeFile(
    join(netlifyFunctionDir, `${functionName}.mjs`),
    `export { default } from "${relative(netlifyFunctionDir, bundleFile)}";

export const config = {
  path: ${Array.isArray(pathPattern) ? JSON.stringify(pathPattern) : `"${pathPattern}"`},
  displayName: "${functionName} server",
  generator: "${name}@${version}",
  preferStatic: true,
  nodeVersion: ${nodeVersion}
};
`,
    "utf8",
  );
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
