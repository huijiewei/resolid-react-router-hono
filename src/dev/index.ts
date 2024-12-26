import { getRequestListener } from "@hono/node-server";
import type { Config as ReactRouterConfig } from "@react-router/dev/config";
import { minimatch } from "minimatch";
import { existsSync, statSync } from "node:fs";
import type http from "node:http";
import { join, relative } from "node:path";
import type { Connect, UserConfig, ViteDevServer, Plugin as VitePlugin } from "vite";

type ReactRouterHonoServerOptions = {
  entryFile?: string;
  exclude?: (string | RegExp)[];
};

const defaultConfig: Required<ReactRouterHonoServerOptions> = {
  entryFile: "server.ts",
  exclude: [
    /.*\.css$/,
    /^\/@.+$/,
    /\?import$/,
    /^\/favicon\.ico$/,
    /^\/assets\/.+/,
    /^\/static\/.+/,
    /^\/node_modules\/.*/,
  ],
};

type ReactRouterPluginContext = {
  reactRouterConfig: Required<ReactRouterConfig>;
  rootDirectory: string;
  entryClientFilePath: string;
  entryServerFilePath: string;
  isSsrBuild: true;
};

type Fetch = (
  request: Request,
  env: { incoming: http.IncomingMessage; outgoing: http.ServerResponse },
) => Promise<Response>;

type LoadModule = (server: ViteDevServer, entry: string) => Promise<{ fetch: Fetch }>;

// noinspection JSUnusedGlobalSymbols
export const reactRouterHonoServer = (config?: ReactRouterHonoServerOptions): VitePlugin => {
  const mergedConfig = { ...defaultConfig, ...config };

  let publicDirPath = "";
  let appDirectory = "";

  return {
    name: "@resolid/react-router-hono-server",
    enforce: "post",
    config(config) {
      if (!("__reactRouterPluginContext" in config)) {
        return null;
      }

      const reactRouterConfig = config.__reactRouterPluginContext as ReactRouterPluginContext;
      const rootDirectory = reactRouterConfig.rootDirectory;
      const buildDir = relative(rootDirectory, reactRouterConfig.reactRouterConfig.buildDirectory);
      const assetsDir = config.build?.assetsDir || "assets";

      appDirectory = relative(rootDirectory, reactRouterConfig.reactRouterConfig.appDirectory);

      return {
        define: {
          "import.meta.env.RESOLID_BUILD_DIR": JSON.stringify(buildDir),
          "import.meta.env.RESOLID_ASSETS_DIR": JSON.stringify(assetsDir),
        },
        ssr: {
          noExternal: ["@resolid/react-router-hono"],
        },
      } satisfies UserConfig;
    },
    configResolved(config) {
      publicDirPath = config.publicDir;
    },
    async configureServer(server) {
      const mergedExclude = [`/${appDirectory}/**/*`, `/${appDirectory}/**/.*/**`, ...mergedConfig.exclude];

      async function createMiddleware(server: ViteDevServer): Promise<Connect.HandleFunction> {
        return async (
          req: http.IncomingMessage,
          res: http.ServerResponse,
          next: Connect.NextFunction,
        ): Promise<void> => {
          if (req.url) {
            const filePath = join(publicDirPath, req.url);

            try {
              if (existsSync(filePath) && statSync(filePath).isFile()) {
                return next();
              }
            } catch {
              // do nothing
            }
          }

          for (const pattern of mergedExclude) {
            if (req.url) {
              if (pattern instanceof RegExp) {
                if (pattern.test(req.url)) {
                  return next();
                }
              } else if (minimatch(req.url?.toString(), pattern)) {
                return next();
              }
            }
          }

          const loadModule: LoadModule = async (server, entry) => {
            const appModule = await server.ssrLoadModule(entry);
            const app = appModule["default"] as { fetch: Fetch };
            if (!app) {
              throw new Error(`Failed to find default export from ${entry}`);
            }

            return app;
          };

          let app: { fetch: Fetch };

          try {
            app = await loadModule(server, join(appDirectory, mergedConfig.entryFile));
          } catch (e) {
            return next(e);
          }

          await getRequestListener(
            async (request) => {
              const response = await app.fetch(request, { incoming: req, outgoing: res });

              if (!(response instanceof Response)) {
                throw response;
              }

              return response;
            },
            {
              overrideGlobalObjects: false,
              errorHandler: (e) => {
                let err: Error;
                if (e instanceof Error) {
                  err = e;
                  server.ssrFixStacktrace(err);
                } else if (typeof e === "string") {
                  err = new Error(`The response is not an instance of "Response", but: ${e}`);
                } else {
                  err = new Error(`Unknown error: ${e}`);
                }

                next(err);
              },
            },
          )(req, res);
        };
      }

      server.middlewares.use(await createMiddleware(server));
    },
  };
};
