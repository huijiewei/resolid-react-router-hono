# @resolid/react-router-hono

[简体中文](README.zh_CN.md)

Resolid Remix extension package, mainly some plug-ins to enhance Remix and needs to be used with Vite

## Feature

- [Dev Server](#dev-server)
- [Node.js Serve](#nodejs-serve)
- [Vercel Serve](#vercel-serve)
- [Netlify Serve](#netlify-serve)
- [Hono Middleware](#hono-middleware)
- [React Router Load Context](#remix-load-context)

## Install

```bash
pnpm add -D @resolid/react-router-hono
```

## Install related dependencies

```bash
pnpm add hono @hono/node-server
```

## Dev Server

Edit vite.config.ts to config dev server

```ts
// vite.config.ts
import { reactRouter } from "@react-router/dev/vite";
import { reactRouterHonoServer } from "@resolid/react-router-hono/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    reactRouterHonoServer({
      // Entry file
      entryFile: "server.node.ts", // default is server.ts
    }),
    reactRouter(),
    tsconfigPaths(),
  ],
});
```

## Node.js Serve

### Create Node.js Server

```ts
// app/server.node.ts
import { createHonoNodeServer } from "@resolid/react-router-hono/node-server";

export default await createHonoNodeServer();
```

### Config Node.js Preset in React Router Config

```ts
// react-router.config.ts
import type { Config } from "@react-router/dev/config";
import { nodePreset } from "@resolid/react-router-hono/node-preset";

export default {
  presets: [
    nodePreset({
      // Entry file
      entryFile: "server.node.ts", // default is server.ts
      nodeVersion: 22, // default is 22
    }),
  ],
} satisfies Config;
```

Supports the `SERVER_PORT` and `SERVER_PATH` environment variables. The `SERVE_PATH` environment variable is
for React Router's serverBundles feature.

> After running build, `server.mjs` and `package.json` files will be automatically generated in the `build/server`
> directory. The `package.json` file defines the `ssr.external` set by Vite in the server directory. Run `npm install`
> to
> install dependencies excluded during build

## Vercel Serve

> You can use https://github.com/huijiewei/react-router-hono-vercel-template to quick start deploy to vercel.

### Create Vercel server

```ts
// app/server.vercel.ts
import { createHonoVercelServer } from "@resolid/react-router-hono/vercel-server";

export default await createHonoVercelServer();
```

### Config Vercel Preset in React Router Config

```ts
// react-router.config.ts
import type { Config } from "@react-router/dev/config";
import { vercelPreset } from "@resolid/react-router-hono/vercel-preset";

export default {
  presets: [
    vercelPreset({
      // Deployment area
      regions: ["sin1"],
      // Entry file
      entryFile: "server.vercel.ts", // default is server.ts
      nodeVersion: 22, // default is 22
      // Some packages will introduce binary packages according to different platforms. The binary packages are not in the same directory during installation, such as @node-rs/bcrypt
      copyParentModules: ["@node-rs/bcrypt"],
    }),
  ],
} satisfies Config;
```

> Vercel project Framework Preset needs to be set to Vite, Node.js Version needs to be same
>
> If you are using a monorepo structure, please set the Root Directory to the project directory that needs to be
> deployed, and then customize the relevant commands. The configuration
> of [Resolid](https://github.com/huijiewei/resolid)
> is as shown below
> ![Vercel related settings](.github/assets/vercel-settings.png)

## Netlify Serve

> You can use https://github.com/huijiewei/react-router-hono-netlify-template to quick start deploy to netlify.

### Create Netlify server

```ts
// app/server.netlify.ts
import { createHonoNetlifyServer } from "@resolid/react-router-hono/netlify-server";

export default await createHonoNetlifyServer();
```

### Config Netlify Preset in React Router Config

```ts
// react-router.config.ts

import type { Config } from "@react-router/dev/config";
import { netlifyPreset } from "@resolid/react-router-hono/netlify-preset";

export default {
  presets: [
    netlifyPreset({
      // Entry file
      entryFile: "server.netlify.ts", // default is server.ts
      nodeVersion: 22, // default is 22
      // Some packages will introduce binary packages according to different platforms. The binary packages are not in the same directory during installation, such as @node-rs/bcrypt
      copyParentModules: ["@node-rs/bcrypt"],
    }),
  ],
} satisfies Config;
```

> Vercel project Framework Preset needs to be set to Vite, Node.js Version needs to be same
>
> If you are using a monorepo structure, please set the Root Directory to the project directory that needs to be
> deployed, and then customize the relevant commands. The configuration
> of [Resolid](https://github.com/huijiewei/resolid)
> is as shown below
> ![Vercel related settings](.github/assets/vercel-settings.png)

## Hono Middleware

Middleware are functions that are called before React Router calls your loader/action. See
the [Hono docs](https://hono.dev/docs/guides/middleware) for more information.

You can use configure option in createHonoNodeServer or createHonoVercelServer to use Hono middleware

```ts
import { createHonoNodeServer } from "@resolid/react-router-hono/node-server";

export default await createHonoNodeServer({
  configure: (server) => {
    server.use(/* Hono Middleware */);
  },
});
```

## React Router load context

If you'd like to add additional properties to the load context, you can config getLoadContext option in
createHonoNodeServer or createHonoVercelServer to augmenting load context.

```ts
import { createHonoNodeServer } from "@resolid/react-router-hono/node-server";
import type { HttpBindings } from "@hono/node-server";
import type { Context } from "hono";

export default await createHonoNodeServer({
  getLoadContext: (c: Context<{ Bindings: HttpBindings }>) => {
    return {
      remoteAddress: c.env.incoming.socket.remoteAddress,
    };
  },
});
```

## Acknowledgment

- [@hono/vite-dev-server](https://github.com/honojs/vite-plugins/tree/main/packages/dev-server)
- [react-router-hono-server](https://github.com/rphlmr/react-router-hono-server)
