import { WsMessage } from "./wsTypes";
import { getConnection, getConnectionInfo } from "../state/connectionStore";
import { randomUUID } from "crypto";
import { AppConstant } from "../constants/AppConstant";
import {
  joinQueue,
  leaveQueue,
  getPartner,
  endMatch
} from "../state/matchMakingStore";

import {
  getConversationByUser,startReconnectTimer,endConversation,
  isValidConversation,getPartnerId,getPrivateConversationByInviteToken,getConversation,
  createPrivateConversation
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

    case WsMessage.CREATE_PRIVATE_CONVERSATION: {
    const userWs = getConnection(connectionId);
    const privateConvo = createPrivateConversation(connectionId);
     if(!privateConvo || !userWs) return;
  
      userWs.send( JSON.stringify({
        type: WsMessage.PRIVATE_LINK_CREATED,
        payload: {
          inviteLink: `${AppConstant.FRONTEND_URL}/chat?invite=${privateConvo.inviteToken}`,
          conversationId : privateConvo.id
        }
      }));
      break;
    }

    case WsMessage.JOIN_PRIVATE_CONVERSATION: {
      const { inviteToken } = msg.payload;
      const userConnection = getConnectionInfo(connectionId);
      const storedConvo = getPrivateConversationByInviteToken(inviteToken);
    
      if (!storedConvo || storedConvo.users.length >= 2) {
        userConnection?.ws.send(JSON.stringify( 
          { type: WsMessage.INVALID_INVITE }));
        return;
      }
    
      storedConvo.users.push(connectionId);
    
   const partnerId = getPartnerId(connectionId);
   const partnerConnection = getConnectionInfo(partnerId);

   userConnection?.ws.send(JSON.stringify( {
        type: WsMessage.MATCH_FOUND,
        payload: {
          conversationId : storedConvo.id,
          partnerName: partnerConnection?.username


        }
      }));
    
      partnerConnection?.ws.send(JSON.stringify({
        type: WsMessage.MATCH_FOUND,
        payload: {
          conversationId : storedConvo.id,
          partnerName: userConnection?.username
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
  startReconnectTimer(convo.id, () => {
    const currentConvo = getConversation(convo.id);
  if (!currentConvo) return;

  if (!currentConvo.users.includes(partnerId)) return;

  partnerWs?.send(JSON.stringify({
    type: WsMessage.PEER_DISCONNECTED,
    payload: { conversationId: convo.id }
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
    const userConnection = getConnectionInfo(userId);
    const partnerConnection = getConnectionInfo(newPartner);

    userConnection?.ws.send(JSON.stringify({
      type: WsMessage.MATCH_FOUND,
      payload: { 
        partnerId: newPartner,
        conversationId : newConvoId?.id,
        partnerName :  partnerConnection?.username
      }
    }));

    partnerConnection?.ws.send(JSON.stringify({
      type: WsMessage.MATCH_FOUND,
      payload: { 
        partnerId: userId,
        conversationId : newConvoId?.id, 
        partnerName : userConnection?.username
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
