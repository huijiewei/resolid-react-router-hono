import esbuild from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { exit } from "node:process";
import type { PackageJson } from "type-fest";
import type { ResolvedConfig } from "vite";

export type SsrExternal = ResolvedConfig["ssr"]["external"];

const getPackageDependencies = (dependencies: Record<string, string | undefined>, ssrExternal: SsrExternal) => {
  const ssrExternalFiltered = Array.isArray(ssrExternal)
    ? ssrExternal.filter((id) => !id.startsWith("@remix-run"))
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

const writePackageJson = async (pkg: PackageJson, outputFile: string, dependencies: unknown) => {
  const distPkg = {
    name: pkg.name,
    type: pkg.type,
    scripts: {
      postinstall: pkg.scripts?.postinstall ?? "",
    },
    dependencies: dependencies,
  };

  await writeFile(outputFile, JSON.stringify(distPkg, null, 2), "utf8");
};

export const buildEntry = async (
  appPath: string,
  entryFile: string,
  buildPath: string,
  buildFile: string,
  serverBundleId: string,
  packageFile: string,
  ssrExternal: string[] | true | undefined,
): Promise<string> => {
  console.log(`Bundle Server file for ${serverBundleId}...`);

  const pkg = JSON.parse(await readFile(packageFile, "utf8")) as PackageJson;

  const packageDependencies = getPackageDependencies({ ...pkg.dependencies }, ssrExternal);

  await writePackageJson(pkg, join(buildPath, "package.json"), packageDependencies);

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
      },
      banner: { js: "import { createRequire } from 'module';const require = createRequire(import.meta.url);" },
      platform: "node",
      target: "node20",
      format: "esm",
      external: ["vite", ...Object.keys(packageDependencies)],
      bundle: true,
      charset: "utf8",
      legalComments: "none",
      minify: false,
    })
    .catch((error: unknown) => {
      console.error(error);
      exit(1);
    });

  return bundleFile;
};
