import { randomUUID } from "crypto";
export type ConversationType = "RANDOM" | "PRIVATE";
export type Conversation = {
  id: string;
  type: ConversationType;
  users: string[];
  inviteToken?: string;
  createdAt: number;
};

const conversations = new Map<string, Conversation>();
const userToConversation = new Map<string, string>();
const reconnectTimers = new Map<string, NodeJS.Timeout>();
const inviteIndex = new Map<string, string>(); // inviteToken → conversationId

export function createConversation(u1: string, u2: string) {
  const id = randomUUID();
  const conversationType: ConversationType = "RANDOM";
  const convo = { 
    id, 
    users: [u1, u2] as [string, string], 
    type: conversationType,
    createdAt : Date.now()
  };

  conversations.set(id, convo);
  userToConversation.set(u1, id);
  userToConversation.set(u2, id);
  console.log(`new converstation created ${id}`);
  return convo;
}


export function createPrivateConversation(u1: string) {
  const id = randomUUID(); // convoId
  const inviteToken = randomUUID();
  const conversationType: ConversationType = "PRIVATE";
  const convo = { 
    id, 
    users: [u1], 
    inviteToken,
    type: conversationType,
    createdAt : Date.now()
  };

  conversations.set(id, convo);
  inviteIndex.set(inviteToken, id)
  // userToConversation.set(u1, id);
  // userToConversation.set(u2, id);
  console.log(`new converstation created private : ${id}`);
  return convo;
}

export function getPrivateConversationByInviteToken(inviteToken : string) : Conversation | null{
  const storedConvoId = inviteIndex.get(inviteToken);
  if(!storedConvoId) return null;
  const storedConversation = getConversation(storedConvoId);
  return storedConversation ? storedConversation : null;
}
export function getConversationByUser(userId: string) {
  const convoId = userToConversation.get(userId);
  if (!convoId) return null;
  return conversations.get(convoId) ?? null;
}

export function endConversation(convoId: string) {
  const convo = conversations.get(convoId);
  if (!convo) return;

  conversations.delete(convoId);
  userToConversation.delete(convo.users[0]);
  userToConversation.delete(convo.users[1]);
  console.log(` converstation died ${convoId}`);
}

export function startReconnectTimer(
  convoId: string,
  onExpire: () => void,
  delayMs = 90_000
) {
  clearReconnectTimer(convoId);

  const timer = setTimeout(() => {
    reconnectTimers.delete(convoId);
    onExpire();
  }, delayMs);

  reconnectTimers.set(convoId, timer);
}

export function clearReconnectTimer(convoId: string) {
  const timer = reconnectTimers.get(convoId);
  if (timer) {
    clearTimeout(timer);
    reconnectTimers.delete(convoId);
  }
}

export function isValidConversation(userId : string, convoIdtoValidate: string) : boolean{
  const convo = conversations.get(convoIdtoValidate);
  if (!convo || (!convo.users.includes(userId))) {
    return false;
  }
  const potentialConvoUser = getConversationByUser(userId);
  const potentialConvoPartner = getConversationByUser(convo.users.find(u => u!== userId)!);
  if(potentialConvoPartner?.id !== potentialConvoUser?.id) return false;

  return true;
}

export function getConversation(conversationId : string) : Conversation | undefined{
  return conversations.get(conversationId);
}

export function getPartnerId(userId : string) : string{
  const convo = getConversationByUser(userId);
  return convo?.users.find(u => u !== userId)!;
}
