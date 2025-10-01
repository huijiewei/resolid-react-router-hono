import type { Context as NetlifyContext } from "@netlify/types";
import type { Env } from "hono";
import { handle } from "hono/netlify";
import type { BlankEnv } from "hono/types";
import { env } from "node:process";
import { createHonoServer, type HonoServerOptions } from "../hono-server";

export type { HonoServerOptions };

export type HonoNetlifyServerOptions<E extends Env = BlankEnv> = HonoServerOptions<E>;

export type { NetlifyContext };

// noinspection JSUnusedGlobalSymbols
export const createHonoNetlifyServer = async <E extends Env = BlankEnv>(
  options: HonoNetlifyServerOptions<E> = {},
): Promise<(req: Request, context: NetlifyContext) => Response | Promise<Response>> => {
  const mode = env.NODE_ENV == "test" ? "development" : env.NODE_ENV;

  const server = await createHonoServer(mode, {
    configure: options.configure,
    getLoadContext: options.getLoadContext,
    honoOptions: options.honoOptions,
  });

  return handle(server);
};
