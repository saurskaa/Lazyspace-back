import { WebSocketServer } from "ws";
import { handleMessage, handleDisconnect } from "./wsHandlers";
import { addConnection, getConnection } from "../state/connectionStore";
import {
  clearReconnectTimer
} from "../state/conversationStore";
import { WsMessage } from "./wsTypes";
import { IncomingMessage } from "http";
import { getConversationByUser } from "../state/conversationStore";
import { handleAmbigousDisconnect } from "./wsHandlers";


export function createWebSocketServer(server: any) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req: IncomingMessage) => {
    const url = new URL(req.url!, "http://localhost");
    const userId = url.searchParams.get("userId");
    const username = url.searchParams.get("name") ?? "Someone";
    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown_ip";

    if (!userId) {
      ws.close(1008, "userId required");
      return;
    }

    /* 1️⃣ Register connection */
    addConnection(userId, username, ws, ip);

    const convo = getConversationByUser(userId);
    if (convo) {
      // 🔥 User reconnected within grace period
      clearReconnectTimer(userId);

      const partnerId = convo.users.find(u => u !== userId)!;
      const partnerWs = getConnection(partnerId);

      partnerWs?.send(JSON.stringify({
        type: WsMessage.PEER_RECONNECTED
      }));

      ws.send(JSON.stringify({
        type: WsMessage.RESUME_CONVERSATION,
        payload: {
          partnerId: partnerId,
          conversationId: convo
        }
      }));


    }

    /* 3️⃣ Normal message handling */
    ws.on("message", (data) => {
      handleMessage(userId, data.toString());
    });

    /* 4️⃣ On socket close → start reconnect wait */
    ws.on("close", () => {
      handleAmbigousDisconnect(userId);
    });
  });
}
