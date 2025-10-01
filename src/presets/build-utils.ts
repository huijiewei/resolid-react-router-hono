import type { BuildManifest } from "@react-router/dev/config";
import { nodeFileTrace } from "@vercel/nft";
import esbuild from "esbuild";
import { cp, mkdir, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
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
        "process.env.NODE_ENV": JSON.stringify("production"),
        "import.meta.env.NODE_ENV": JSON.stringify("production"),
        "import.meta.env.RESOLID_BUILD_DIR": JSON.stringify(buildDir),
        "import.meta.env.RESOLID_ASSETS_DIR": JSON.stringify(assetsDir),
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

export const createDir = async (paths: string[], rmBefore: boolean = false): Promise<string> => {
  const presetRoot = join(...paths);

  if (rmBefore) {
    await rm(presetRoot, { recursive: true, force: true });
  }

  await mkdir(presetRoot, { recursive: true });

  return presetRoot;
};

export const getServerBundles = (
  buildManifest: BuildManifest | undefined,
  rootPath: string,
  buildDirectory: string,
  serverBuildFile: string,
): {
  [serverBundleId: string]: {
    id: string;
    file: string;
  };
} => {
  return (
    buildManifest?.serverBundles ?? {
      site: {
        id: "site",
        file: relative(rootPath, join(join(buildDirectory, "server"), serverBuildFile)),
      },
    }
  );
};

export const getServerRoutes = (
  buildManifest: BuildManifest | undefined,
): {
  path: string;
  bundleId: string;
}[] => {
  if (buildManifest?.routeIdToServerBundleId) {
    const routes: { id: string; path: string }[] = Object.values(buildManifest.routes)
      .filter((route) => route.id != "root")
      .map((route) => {
        const path = [...getRoutePathsFromParentId(buildManifest.routes, route.parentId), route.path].join("/");

        return {
          id: route.id,
          path: `/${path}`,
        };
      });

    const routePathBundles: Record<string, string[]> = {};

    for (const routeId in buildManifest?.routeIdToServerBundleId) {
      const serverBoundId = buildManifest?.routeIdToServerBundleId[routeId];

      if (!routePathBundles[serverBoundId]) {
        routePathBundles[serverBoundId] = [];
      }

      for (const routePath of routes) {
        if (routePath.id == routeId) {
          routePathBundles[serverBoundId].push(routePath.path);
        }
      }
    }

    const bundleRoutes: Record<string, { path: string; bundleId: string }> = {};

    for (const bundleId in routePathBundles) {
      const paths = routePathBundles[bundleId];

      paths.sort((a, b) => (a.length < b.length ? -1 : 1));

      for (const path of paths) {
        if (
          !bundleRoutes[path] &&
          !Object.keys(bundleRoutes).find((key) => {
            return bundleRoutes[key].bundleId == bundleId && path.startsWith(bundleRoutes[key].path);
          })
        ) {
          bundleRoutes[path] = { path: path, bundleId: bundleId };
        }
      }
    }

    const result = Object.values(bundleRoutes).map((route) => {
      return { path: route.path.slice(0, -1), bundleId: route.bundleId };
    });

    result.sort((a, b) => (a.path.length > b.path.length ? -1 : 1));

    return result;
  }

  return [{ path: "", bundleId: "site" }];
};

const getRoutePathsFromParentId = (routes: BuildManifest["routes"], parentId: string | undefined) => {
  if (parentId == undefined) {
    return [];
  }

  const paths: string[] = [];

  const findPath = (routeId: string) => {
    const route = routes[routeId];

    if (route.parentId) {
      findPath(route.parentId);
    }

    if (route.path) {
      paths.push(route.path);
    }
  };

  findPath(parentId);

  return paths;
};

export const copyDependenciesToFunction = async (
  bundleFile: string,
  basePath: string,
  destPath: string,
  copyParentModules: string[],
  nftCache: object,
): Promise<void> => {
  const traced = await nodeFileTrace([bundleFile], {
    base: basePath,
    cache: nftCache,
  });

  for (const file of traced.fileList) {
    const source = join(basePath, file);

    if (source == bundleFile) {
      continue;
    }

    const real = await realpath(source);
    const dest = join(destPath, relative(basePath, source));

    if (copyParentModules.find((p) => real.endsWith(p))) {
      const parent = join(real, "..");

      for (const dir of (await readdir(parent)).filter((d) => !d.startsWith("."))) {
        const realPath = await realpath(join(parent, dir));
        const realDest = join(dest, "..", dir);

        await cp(realPath, realDest, { recursive: true });
      }
    } else {
      await cp(real, dest, { recursive: true });
    }
  }
};
