import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ServerConfig } from "./config.js";
import type { WSHub } from "./ws.js";
import { getProviderConfig } from "./provider-config.js";

export interface ServerHandle {
  url: string;
  wsUrl: string;
  close: () => Promise<void>;
}

export async function startServer(config: ServerConfig, hub: WSHub): Promise<ServerHandle> {
  const app = Fastify({ logger: false });

  await app.register(fastifyWebsocket, {
    options: { maxPayload: 1024 * 1024 },
  });

  app.get("/ws", { websocket: true }, (socket) => {
    hub.addClient(socket as unknown as import("ws").WebSocket);
  });

  app.get("/healthz", async () => ({ ok: true, version: config.version }));
  app.get("/api/status", async () => hub.status());

  app.get("/api/config", async () => getProviderConfig().sanitized());

  app.post("/api/config/openai", async (req, reply) => {
    const body = (req.body ?? {}) as { baseUrl?: string; apiKey?: string };
    if (body.baseUrl !== undefined && typeof body.baseUrl !== "string") {
      return reply.code(400).send({ error: "baseUrl must be a string" });
    }
    if (body.apiKey !== undefined && typeof body.apiKey !== "string") {
      return reply.code(400).send({ error: "apiKey must be a string" });
    }
    getProviderConfig().setOpenAI({
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
    });
    await hub.refreshModels();
    return reply.send(getProviderConfig().sanitized());
  });

  const dashboardDir = resolve(config.dashboardDir);
  if (existsSync(dashboardDir)) {
    await app.register(fastifyStatic, {
      root: dashboardDir,
      prefix: "/",
      wildcard: false,
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === "GET" && !req.url.startsWith("/api") && !req.url.startsWith("/ws")) {
        return reply.sendFile("index.html");
      }
      return reply.code(404).send({ error: "not found" });
    });
  }

  const address = await app.listen({ port: config.port, host: config.host });

  // When port=0 is requested, Fastify picks a random one.
  const actualPort = typeof address === "string"
    ? parseInt(new URL(address).port, 10)
    : (address as { port: number }).port;

  const url = `http://${config.host}:${actualPort}`;
  const wsUrl = `ws://${config.host}:${actualPort}/ws`;

  return {
    url,
    wsUrl,
    close: () => app.close(),
  };
}
