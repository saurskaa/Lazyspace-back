import { WsMessage } from "./wsTypes";
import { getConnection } from "../state/connectionStore";
import { randomUUID } from "crypto";
import {
  joinQueue,
  leaveQueue,
  getPartner,
  endMatch
} from "../state/matchMakingStore";

import {
  getConversationByUser,
  startReconnectTimer,
  endConversation,
  isValidConversation,
  getPartnerId
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
      // const convoId = joinQueue(connectionId);
      console.log(`received something here`);
      findMatchAndInform(connectionId);
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
          id : randomUUID(),
          message: msg.payload.message,
          from: connectionId,   // 🔥 IMPORTANT
          replyTo: msg.payload.replyTo ?? null,
          createdAt: Date.now()
        }
      });

      // send to partner
      partnerWs?.send(chatMsg);

      // echo back to sender
      senderWs?.send(chatMsg);

      break;
    }

    case WsMessage.REQUEST_RESUME: 
    handleRequestResume(connectionId,msg.payload.conversationId);
    break;

    case WsMessage.TYPING_START:
    case WsMessage.TYPING_STOP: {
      const partnerId = getPartner(connectionId);
      if (!partnerId) return;

      const partnerWs = getConnection(partnerId);
      if (!partnerWs) return;

      partnerWs.send(JSON.stringify({
        type: msg.type,
        payload: {
          from: connectionId
        }
      }));
      break;
    }

    
    default:
      ws.send(JSON.stringify({
        type: WsMessage.ERROR,
        payload: `Unknown type: ${msg.type}`
      }));
  }
}

export function handleDisconnect(connectionId: string) { // intenional 
  // Remove from waiting queue if present
  leaveQueue(connectionId);

  // End active match (if any)
  const partnerId = endMatch(connectionId);
  const convo = getConversationByUser(connectionId);
  if(!convo) return;
  endConversation(convo.id);

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

  findMatchAndInform(userId);
 
}

export function sendPeerDisconnectMessage(connectionId: string): string {
  // leaveQueue(connectionId);

  if (connectionId) {
    const partnerWs = getConnection(connectionId);
    partnerWs?.send(JSON.stringify({
      type: WsMessage.PEER_DISCONNECTED
    }));
  }
  return connectionId;
}

export function handleAmbigousDisconnect(userId : string){
  leaveQueue(userId);
  const convo = getConversationByUser(userId);
  if (!convo) return;

  const partnerId = convo.users.find(u => u !== userId)!;
  const partnerWs = getConnection(partnerId);

  // Notify partner
  partnerWs?.send(JSON.stringify({
    type: WsMessage.PEER_RECONNECTING
  }));

  // Start grace period
  startReconnectTimer(userId, () => {
    // Grace period expired → end conversation
    partnerWs?.send(JSON.stringify({
      type: WsMessage.PEER_DISCONNECTED
    }));
    endMatch(userId);
    endConversation(convo.id);
  }
  
);


}


function findMatchAndInform(userId : string){
  const newConvoId = joinQueue(userId);
  const newPartner = newConvoId?.users.find(u => u !== userId)!;

  if (newPartner) {
    const userWs = getConnection(userId);
    const partnerWs = getConnection(newPartner);

    userWs?.send(JSON.stringify({
      type: WsMessage.MATCH_FOUND,
      payload: { 
        partnerId: newPartner,
        conversationId : newConvoId?.id 
      }
    }));

    partnerWs?.send(JSON.stringify({
      type: WsMessage.MATCH_FOUND,
      payload: { 
        partnerId: userId,
        conversationId : newConvoId?.id 
      }
    }));
  }
}


function handleRequestResume(userId : string, conversationId : string) {
  console.log(`is valid convo : ${isValidConversation(userId, conversationId)}`);
  const userWs = getConnection(userId);
    if(isValidConversation(userId, conversationId)){
      userWs?.send(JSON.stringify({
        type: WsMessage.RESUME_CONVERSATION,
        payload: { 
          conversationId : conversationId,
          partnerName : getPartnerId(userId)
        }
      }));
      return;
    }

    userWs?.send(JSON.stringify({
      type: WsMessage.INVALID_CONVERSATION_ID,
      payload: { 
        conversationId : conversationId 
      }
    }));

 
}
