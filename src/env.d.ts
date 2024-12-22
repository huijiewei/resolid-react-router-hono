interface ReactRouterHonoServerEnv {
  readonly RRR_HONO_SERVER_BUILD_DIRECTORY: string;
  readonly RRR_HONO_SERVER_ASSETS_DIR: string;
}

interface ImportMetaEnv extends ReactRouterHonoServerEnv {}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
