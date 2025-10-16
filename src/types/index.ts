import type { Http2Bindings, HttpBindings } from "@hono/node-server";
import type { Context as HonoContext } from "hono";

export type NodeEnv = { Bindings: HttpBindings | Http2Bindings };
export type { HonoContext };
