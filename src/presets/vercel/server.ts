import type { Http2Bindings, HttpBindings } from "@hono/node-server";
import { handle } from "@hono/node-server/vercel";
import type { IncomingMessage, ServerResponse } from "http";
import type { Http2ServerRequest, Http2ServerResponse } from "http2";
import { env } from "node:process";
import { createHonoServer, type HonoServerOptions } from "../hono-server";

type VercelEnv = { Bindings: HttpBindings | Http2Bindings };

export type HonoVercelServerOptions = HonoServerOptions<VercelEnv>;

// noinspection JSUnusedGlobalSymbols
export const createHonoVercelServer = async (
  options: HonoVercelServerOptions = {},
): Promise<
  (incoming: IncomingMessage | Http2ServerRequest, outgoing: ServerResponse | Http2ServerResponse) => Promise<void>
> => {
  const mode = env.NODE_ENV == "test" ? "development" : env.NODE_ENV;

  const server = await createHonoServer<VercelEnv>(mode, {
    configure: options.configure,
    getLoadContext: options.getLoadContext,
    honoOptions: options.honoOptions,
  });

  return handle(server);
};
