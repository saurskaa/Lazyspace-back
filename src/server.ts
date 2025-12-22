import Fastify from "fastify";
import { createWebSocketServer } from "./websocket/wsServer";

const app = Fastify({ logger: true });

app.get("/health", async () => {
  return { status: "ok" };
});

const server = app.server;

createWebSocketServer(server);

app.listen({ port: 3000, host: "0.0.0.0" }, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
