import esbuild from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { exit } from "node:process";
import type { PackageJson } from "type-fest";
import type { ResolvedConfig } from "vite";

export type NodeVersion = 20 | 22;

export type SsrExternal = ResolvedConfig["ssr"]["external"];

const getPackageDependencies = (dependencies: Record<string, string | undefined>, ssrExternal: SsrExternal) => {
  const ssrExternalFiltered = Array.isArray(ssrExternal)
    ? ssrExternal.filter(
        (id) =>
          ![
            "react-router",
            "react-router-dom",
            "@react-router/architect",
            "@react-router/cloudflare",
            "@react-router/dev",
            "@react-router/express",
            "@react-router/node",
            "@react-router/serve",
          ].includes(id),
      )
    : ssrExternal;

  return Object.keys(dependencies)
    .filter((key) => {
      if (ssrExternalFiltered === undefined || ssrExternalFiltered === true) {
        return false;
      }

      return ssrExternalFiltered.includes(key);
    })
    .reduce((obj: Record<string, string>, key) => {
      obj[key] = dependencies[key] ?? "";

      return obj;
    }, {});
};

const writePackageJson = async (
  pkg: PackageJson,
  outputFile: string,
  dependencies: unknown,
  nodeVersion: NodeVersion,
) => {
  const distPkg = {
    name: pkg.name,
    type: pkg.type,
    scripts: {
      postinstall: pkg.scripts?.postinstall ?? "",
    },
    dependencies: dependencies,
    engines: {
      node: `${nodeVersion}.x`,
    },
  };

  await writeFile(outputFile, JSON.stringify(distPkg, null, 2), "utf8");
};

export type BundlerLoader = {
  [p: string]: esbuild.Loader;
};

export const buildEntry = async (
  appPath: string,
  entryFile: string,
  buildPath: string,
  buildFile: string,
  buildDir: string,
  assetsDir: string,
  serverBundleId: string,
  packageFile: string,
  ssrExternal: string[] | true | undefined,
  nodeVersion: NodeVersion,
  bundleLoader: BundlerLoader | undefined,
): Promise<string> => {
  console.log(`Bundle Server file for ${serverBundleId}...`);

  const pkg = JSON.parse(await readFile(packageFile, "utf8")) as PackageJson;

  const packageDependencies = getPackageDependencies({ ...pkg.dependencies }, ssrExternal);

  await writePackageJson(pkg, join(buildPath, "package.json"), packageDependencies, nodeVersion);

  const bundleFile = join(buildPath, "server.mjs");

  await esbuild
    .build({
      outfile: bundleFile,
      entryPoints: [join(appPath, entryFile)],
      alias: {
        "virtual:react-router/server-build": buildFile,
      },
      define: {
        "process.env.NODE_ENV": "'production'",
        "import.meta.env.RESOLID_BUILD_DIR": `'${buildDir}'`,
        "import.meta.env.RESOLID_ASSETS_DIR": `'${assetsDir}'`,
      },
      banner: { js: "import { createRequire } from 'module';const require = createRequire(import.meta.url);" },
      platform: "node",
      target: `node${nodeVersion}`,
      format: "esm",
      external: ["vite", ...Object.keys(packageDependencies)],
      bundle: true,
      charset: "utf8",
      legalComments: "none",
      minify: false,
      loader: {
        ".aac": "file",
        ".css": "file",
        ".eot": "file",
        ".flac": "file",
        ".gif": "file",
        ".jpeg": "file",
        ".jpg": "file",
        ".mp3": "file",
        ".mp4": "file",
        ".ogg": "file",
        ".otf": "file",
        ".png": "file",
        ".svg": "file",
        ".ttf": "file",
        ".wav": "file",
        ".webm": "file",
        ".webp": "file",
        ".woff": "file",
        ".woff2": "file",
        ...(bundleLoader || {}),
      },
    })
    .catch((error: unknown) => {
      console.error(error);
      exit(1);
    });

  return bundleFile;
};
