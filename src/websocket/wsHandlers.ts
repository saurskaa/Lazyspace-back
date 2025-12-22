import { WsMessage } from "./wsTypes";
import { getConnection, getConnectionInfo } from "../state/connectionStore";
import {
  joinQueue,
  leaveQueue,
  getPartner,
  endMatch
} from "../state/matchMakingStore";

import {
  getConversationId,
  getOtherUser,
  setReconnectTimer,
  endConversation
} from "../state/conversationStore";

const WAIT_MS = 2 * 60 * 1000; 

export function handleMessage(connectionId: string, raw: string) {
  const ws = getConnection(connectionId);
  if (!ws) return;

  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    ws.send(JSON.stringify({
      type: WsMessage.ERROR,
      payload: "Invalid JSON"
    }));
    return;
  }

  switch (msg.type) {

    case WsMessage.PING:
      ws.send(JSON.stringify({ type: WsMessage.PONG }));
      break;

    case WsMessage.JOIN_QUEUE: {
      const partnerId = joinQueue(connectionId);
      
      if (!partnerId) {
        return;
      }
      
      const user = getConnectionInfo(connectionId);
      const partner = getConnectionInfo(partnerId);

    if(!partner || !user) return;

      if (partnerId) {
        const partnerWs = getConnection(partnerId);

        user.ws.send(JSON.stringify({
          type: WsMessage.MATCH_FOUND,
          payload: { partnerName : partner.username }
        }));

        partner.ws.send(JSON.stringify({
          type: WsMessage.MATCH_FOUND,
          payload: { partnerName : user.username}
        }));
      }
      break;
    }

    case WsMessage.LEAVE_QUEUE:
      leaveQueue(connectionId);
      break;

      case WsMessage.END_CHAT: {
        // treat as intentional disconnect
        handleDisconnect(connectionId);
        break;
      }
      

      case WsMessage.FIND_ANOTHER_MATCH:
        findAnotherMatch(connectionId);
        break;

      case WsMessage.CHAT_MESSAGE: {
        const partnerId = getPartner(connectionId);
        if (!partnerId) return;
      
        const partnerWs = getConnection(partnerId);
        const senderWs = getConnection(connectionId);
      
        const chatMsg = JSON.stringify({
          type: WsMessage.CHAT_MESSAGE,
          payload: {
            message: msg.payload.message,
            from: connectionId   // 🔥 IMPORTANT
          }
        });
      
        // send to partner
        partnerWs?.send(chatMsg);
      
        // echo back to sender
        senderWs?.send(chatMsg);
      
        break;
      }
      

    default:
      ws.send(JSON.stringify({
        type: WsMessage.ERROR,
        payload: `Unknown type: ${msg.type}`
      }));
  }
}

export function handleDisconnect(connectionId: string) {
  // Remove from waiting queue if present
  leaveQueue(connectionId);

  // End active match (if any)
  const partnerId = endMatch(connectionId);

  if (!partnerId) return;

  const partnerWs = getConnection(partnerId);

  // Inform partner that chat has ended
  partnerWs?.send(JSON.stringify({
    type: WsMessage.PEER_DISCONNECTED
  }));

}

export function findAnotherMatch(userId: string) {
  handleDisconnect(userId);
  console.log(`Diconnect called for : ${userId}`);
  // 2. Put user back into queue
  const newPartner = joinQueue(userId);

  // 3. If someone is waiting, match immediately
  if (newPartner) {
    const userWs = getConnection(userId);
    const partnerWs = getConnection(newPartner);

    userWs?.send(JSON.stringify({
      type: WsMessage.MATCH_FOUND,
      payload: { partnerId: newPartner }
    }));

    partnerWs?.send(JSON.stringify({
      type: WsMessage.MATCH_FOUND,
      payload: { partnerId: userId }
    }));
  }
}

export function sendPeerDisconnectMessage(connectionId: string) : string  {
  // leaveQueue(connectionId);
  
  if (connectionId) {
    const partnerWs = getConnection(connectionId);
    partnerWs?.send(JSON.stringify({
      type: WsMessage.PEER_DISCONNECTED
    }));
  }
  return connectionId;
}