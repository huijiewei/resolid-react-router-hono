interface ReactRouterHonoServerEnv {
  readonly RESOLID_BUILD_DIR: string;
  readonly RESOLID_ASSETS_DIR: string;
}

interface ImportMetaEnv extends ReactRouterHonoServerEnv {}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
