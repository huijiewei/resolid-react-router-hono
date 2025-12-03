import { getRequestListener } from "@hono/node-server";
import type { Config as ReactRouterConfig } from "@react-router/dev/config";
import { existsSync, statSync } from "node:fs";
import type http from "node:http";
import { join, relative } from "node:path";
import type { Connect, RunnableDevEnvironment, UserConfig, ViteDevServer, Plugin as VitePlugin } from "vite";
import { createExcludePatterns, shouldExcludeUrl } from "./utils";

type ReactRouterHonoServerOptions = {
  entryFile?: string;
  exclude?: (string | RegExp)[];
};

type ReactRouterPluginContext = {
  reactRouterConfig: Required<ReactRouterConfig>;
  rootDirectory: string;
  entryClientFilePath: string;
  entryServerFilePath: string;
};

type Fetch = (
  request: Request,
  env: { incoming: http.IncomingMessage; outgoing: http.ServerResponse },
) => Promise<Response>;

const resolveReactRouterPluginConfig = (config: UserConfig, options: ReactRouterHonoServerOptions | undefined) => {
  if (!("__reactRouterPluginContext" in config)) {
    return null;
  }

  const { reactRouterConfig, rootDirectory } = config.__reactRouterPluginContext as ReactRouterPluginContext;

  const appDir = relative(rootDirectory, reactRouterConfig.appDirectory);

  return {
    appDir: appDir,
    entryFile: join(appDir, options?.entryFile ?? "server.ts"),
    buildDir: relative(rootDirectory, reactRouterConfig.buildDirectory),
    assetsDir: config.build?.assetsDir || "assets",
    feature: reactRouterConfig.future,
  };
};

type ReactRouterPluginConfig = ReturnType<typeof resolveReactRouterPluginConfig>;

// noinspection JSUnusedGlobalSymbols
export const reactRouterHonoServer = (options?: ReactRouterHonoServerOptions): VitePlugin => {
  let publicDirPath = "";
  let reactRouterConfig: ReactRouterPluginConfig;

  return {
    name: "@resolid/react-router-hono-server",
    enforce: "post",
    config(config) {
      reactRouterConfig = resolveReactRouterPluginConfig(config, options);

      if (!reactRouterConfig) {
        return;
      }

      return {
        define: {
          "import.meta.env.RESOLID_BUILD_DIR": JSON.stringify(reactRouterConfig.buildDir),
          "import.meta.env.RESOLID_ASSETS_DIR": JSON.stringify(reactRouterConfig.assetsDir),
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
      if (!reactRouterConfig) {
        return;
      }

      const excludePatterns = createExcludePatterns(reactRouterConfig.appDir, options?.exclude);

      const createMiddleware =
        async (server: ViteDevServer): Promise<Connect.HandleFunction> =>
        async (req: http.IncomingMessage, res: http.ServerResponse, next: Connect.NextFunction): Promise<void> => {
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

          if (req.url && shouldExcludeUrl(req.url, excludePatterns)) {
            return next();
          }

          let app: null | { fetch: Fetch };
          const entry = reactRouterConfig!.entryFile;

          if (reactRouterConfig!.feature.v8_viteEnvironmentApi) {
            app = (await (server.environments.ssr as RunnableDevEnvironment).runner.import(entry))["default"];
          } else {
            app = (await server.ssrLoadModule(entry))["default"];
          }

          if (!app) {
            return next(new Error(`Failed to find default export from ${entry}`));
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

      server.middlewares.use(await createMiddleware(server));
    },
    handleHotUpdate({ server, modules }) {
      const isSSR = modules.some((mod) => mod._ssrModule);
      if (isSSR) {
        server.hot.send({ type: "full-reload" });
        return [];
      }
    },
  };
};
