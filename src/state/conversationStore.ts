type UserId = string;

interface Conversation {
  userA: UserId;
  userB: UserId;
  reconnectTimer?: NodeJS.Timeout;
}

const conversations = new Map<string, Conversation>();
const userToConversation = new Map<UserId, string>();

export function createConversation(a: UserId, b: UserId) {
  const id = crypto.randomUUID();
  conversations.set(id, { userA: a, userB: b });
  userToConversation.set(a, id);
  userToConversation.set(b, id);
  return id;
}

export function getConversationId(userId: UserId) {
  return userToConversation.get(userId);
}

export function getOtherUser(convoId: string, userId: UserId) {
  const c = conversations.get(convoId);
  if (!c) return undefined;
  return c.userA === userId ? c.userB : c.userA;
}

export function setReconnectTimer(
  convoId: string,
  timer: NodeJS.Timeout
) {
  const c = conversations.get(convoId);
  if (c) c.reconnectTimer = timer;
}

export function clearReconnectTimer(convoId: string) {
  const c = conversations.get(convoId);
  if (c?.reconnectTimer) {
    clearTimeout(c.reconnectTimer);
    delete c.reconnectTimer;
  }
}

export function endConversation(convoId: string) {
  const c = conversations.get(convoId);
  if (!c) return;
  userToConversation.delete(c.userA);
  userToConversation.delete(c.userB);
  conversations.delete(convoId);
}
