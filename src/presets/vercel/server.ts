import { handle } from "@hono/node-server/vercel";
import type { Env } from "hono";
import type { BlankEnv } from "hono/types";
import type { IncomingMessage, ServerResponse } from "http";
import type { Http2ServerRequest, Http2ServerResponse } from "http2";
import { env } from "node:process";
import { createHonoServer, type HonoServerOptions } from "../hono-server";

export type { HonoServerOptions };

export type HonoVercelServerOptions<E extends Env = BlankEnv> = HonoServerOptions<E>;

// noinspection JSUnusedGlobalSymbols
export const createHonoVercelServer = async <E extends Env = BlankEnv>(
  options: HonoVercelServerOptions<E> = {},
): Promise<
  (incoming: IncomingMessage | Http2ServerRequest, outgoing: ServerResponse | Http2ServerResponse) => Promise<void>
> => {
  const mode = env.NODE_ENV == "test" ? "development" : env.NODE_ENV;

  const server = await createHonoServer(mode, {
    configure: options.configure,
    getLoadContext: options.getLoadContext,
    honoOptions: options.honoOptions,
  });

  return handle(server);
};
