# @resolid/react-router-hono

[English](README.md)

React Router Hono 服务包

## 功能

- [开发服务器](#开发服务器)
- [Node.js 服务](#nodejs-服务)
- [Vercel 服务](#vercel-服务)
- [Netlify 服务](#netlify-服务)
- [Hono 中间件](#hono-中间件)
- [React Router 负载上下文](#react-router-负载上下文)

## 安装

```bash
pnpm add -D @resolid/react-router-hono
```

## 安装相关依赖

```bash
pnpm add hono @hono/node-server
```

## 开发服务器

修改 vite.config.ts 配置开发服务器

```ts
// vite.config.ts
import { reactRouter } from "@react-router/dev/vite";
import { reactRouterHonoServer } from "@resolid/react-router-hono/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    reactRouterHonoServer({
      // 入口文件
      entryFile: "server.node.ts", // 默认为 server.ts
    }),
    reactRouter(),
    tsconfigPaths(),
  ],
});
```

## Node.js 服务

### 创建 Node.js 服务

```ts
// app/server.node.ts
import { createHonoNodeServer } from "@resolid/react-router-hono/node-server";

export default await createHonoNodeServer();
```

### 配置 Node.js Preset

```ts
// react-router.config.ts
import type { Config } from "@react-router/dev/config";
import { nodePreset } from "@resolid/react-router-hono/node-preset";

export default {
  presets: [
    nodePreset({
      // 入口文件
      entryFile: "server.node.ts", // 默认为 server.ts
      nodeVersion: 22, // 默认为 22
    }),
  ],
} satisfies Config;
```

支持 `SERVER_PORT` 和 `SERVER_PATH` 环境变量, `SERVER_PATH` 环境变量用于 React Router 的 serverBundles 功能

> 运行 build 成功以后自动会在 `build/server` 目录下生成 `server.mjs` 和 `package.json` 文件, `package.json` 文件里面定义了
> Vite 设置的 `ssr.external`, 在服务器目录下运行 `npm install` 即可安装构建时排除的依赖

## Vercel 服务

> 你可以使用 https://github.com/huijiewei/react-router-hono-vercel-template 模版快速部署到 Vercel.

### 创建 Vercel 服务

```ts
// app/server.vercel.ts
import { createHonoVercelServer } from "@resolid/react-router-hono/vercel-server";

export default await createHonoVercelServer();
```

### 配置 Vercel Preset

```ts
// react-router.config.ts
import type { Config } from "@react-router/dev/config";
import { vercelPreset } from "@resolid/react-router-hono/vercel-preset";

export default {
  presets: [
    vercelPreset({
      // 入口文件
      entryFile: "server.vercel.ts", // 默认为 server.ts
      nodeVersion: 22, // 默认为 22
    }),
  ],
} satisfies Config;
```

> Vercel 项目 Framework Preset 需设置为 Vite, Node.js Version 需设置为一样
>
> 如果你使用的是 monorepo 结构, 请设置 Root Directory 为需要部署的项目目录,
> 然后自定义相关命令, [Resolid](https://github.com/huijiewei/resolid) 的配置如下图
> ![Vercel相关设置](.github/assets/vercel-settings.png)

## Netlify 服务

> 你可以使用 https://github.com/huijiewei/react-router-hono-netlify-template 模版快速部署到 Vercel.

### 创建 Netlify 服务

```ts
// app/server.netlify.ts
import { createHonoNetlifyServer } from "@resolid/react-router-hono/vercel-server";

export default await createHonoNetlifyServer();
```

### 配置 Vercel Preset

```ts
// react-router.config.ts

import type { Config } from "@react-router/dev/config";
import { netlifyPreset } from "@resolid/react-router-hono/netlify-preset";

export default {
  presets: [
    netlifyPreset({
      // 入口文件
      entryFile: "server.netlify.ts", // 默认为 server.ts
      nodeVersion: 22, // 默认为 22
    }),
  ],
} satisfies Config;
```

## Hono 中间件

中间件是在 React Router 调用加载器/操作之前调用的函数, 请参阅 [Hono 文档](https://hono.dev/docs/guides/middleware) 以获取更多信息。

你可以配置 createHonoNodeServer 或者 createHonoVercelServer 的 configure 来方便使用 Hono 中间件

```ts
import { createHonoNodeServer } from "@resolid/react-router-hono/node-server";

export default await createHonoNodeServer({
  configure: (server) => {
    server.use(/* Hono 中间件 */);
  },
});
```

## React Router 负载上下文

如果您想向 React Router 加载上下文添加其他属性，你可以配置 createHonoNodeServer 或者 createHonoVercelServer 的 getLoadContext
来增加加载上下文

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

## 致谢

- [@hono/vite-dev-server](https://github.com/honojs/vite-plugins/tree/main/packages/dev-server)
- [react-router-hono-server](https://github.com/rphlmr/react-router-hono-server)
