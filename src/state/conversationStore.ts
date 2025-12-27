import { randomUUID } from "crypto";
export type Conversation = {
  id: string;
  users: [string, string];
};

const conversations = new Map<string, Conversation>();
const userToConversation = new Map<string, string>();
const reconnectTimers = new Map<string, NodeJS.Timeout>();

export function createConversation(u1: string, u2: string) {
  const id = randomUUID();
  const convo = { id, users: [u1, u2] as [string, string] };

  conversations.set(id, convo);
  userToConversation.set(u1, id);
  userToConversation.set(u2, id);
  console.log(`new converstation created ${id}`);
  return convo;
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
  userId: string,
  onExpire: () => void,
  delayMs = 90_000
) {
  clearReconnectTimer(userId);

  const timer = setTimeout(() => {
    reconnectTimers.delete(userId);
    onExpire();
  }, delayMs);

  reconnectTimers.set(userId, timer);
}

export function clearReconnectTimer(userId: string) {
  const timer = reconnectTimers.get(userId);
  if (timer) {
    clearTimeout(timer);
    reconnectTimers.delete(userId);
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

export function getPartnerId(userId : string) : string{
  const convo = getConversationByUser(userId);
  return convo?.users.find(u => u !== userId)!;
}
