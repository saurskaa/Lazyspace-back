import { WebSocket } from "ws";

export interface Connection {
  userId: string;
  username: string;
  ws: WebSocket;
}

const connections = new Map<string, Connection>();

export function addConnection(
  userId: string,
  username: string,
  ws: WebSocket
) {
  connections.set(userId, {
    userId,
    username,
    ws
  });
}

export function removeConnection(userId: string) {
  connections.delete(userId);
}

export function getConnection(userId: string): WebSocket | undefined {
  return connections.get(userId)?.ws;
}

export function getConnectionInfo(userId: string): Connection | undefined {
  return connections.get(userId);
}

