import { WebSocketServer } from "ws";
import { handleMessage, handleDisconnect } from "./wsHandlers";
import { addConnection, getConnection } from "../state/connectionStore";
import {
  getConversationId,
  getOtherUser,
  clearReconnectTimer
} from "../state/conversationStore";
import { WsMessage } from "./wsTypes";
import { IncomingMessage } from "http";


export function createWebSocketServer(server: any) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req: IncomingMessage) => {
    const url = new URL(req.url!, "http://localhost");
    const userId = url.searchParams.get("userId");
    const username = url.searchParams.get("name") ?? "Someone";

    if (!userId) {
      ws.close(1008, "userId required");
      return;
    }

    /* 1️⃣ Register connection */
    addConnection(userId, username, ws);

    /* 2️⃣ Handle possible reconnect */
    // const convoId = getConversationId(userId);
    // console.log("convoId " + convoId)
    // if (convoId) {
    //   // User reconnected within grace period
    //   clearReconnectTimer(convoId);

    //   const otherUserId = getOtherUser(convoId, userId);
    //   if (otherUserId) {
    //     const otherWs = getConnection(otherUserId);
    //     otherWs?.send(JSON.stringify({
    //       type: WsMessage.PEER_RECONNECTED
    //     }));
    //   }
    // }

    /* 3️⃣ Normal message handling */
    ws.on("message", (data) => {
      handleMessage(userId, data.toString());
    });

    /* 4️⃣ On socket close → start reconnect wait */
    ws.on("close", () => {
      handleDisconnect(userId);
    });
  });
}
