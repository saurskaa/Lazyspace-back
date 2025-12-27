import { Conversation,createConversation } from "./conversationStore";
type ConnectionId = string;

const waitingQueue: ConnectionId[] = [];
const activeMatches = new Map<ConnectionId, ConnectionId>();


export function joinQueue(id: ConnectionId): Conversation | null {
  if (activeMatches.has(id) || waitingQueue.includes(id)) {
    return null;
  }

  if (waitingQueue.length > 0) {
    const partner = waitingQueue.shift()!;
    activeMatches.set(id, partner);
    activeMatches.set(partner, id);
    return createConversation(id, partner);
  }

  waitingQueue.push(id);
  return null;
}

export function leaveQueue(id: ConnectionId) {
  const index = waitingQueue.indexOf(id);
  if (index !== -1) {
    waitingQueue.splice(index, 1);
  }
}

export function getPartner(id: ConnectionId): ConnectionId | undefined {
  return activeMatches.get(id);
}

export function endMatch(id: ConnectionId): ConnectionId | undefined {
  const partner = activeMatches.get(id);
  if (partner) {
    activeMatches.delete(id);
    activeMatches.delete(partner);
  }
  return partner;
}
