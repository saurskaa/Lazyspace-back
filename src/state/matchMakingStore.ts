import { Conversation, createConversation } from "./conversationStore";
import { canMatch } from "../Util/rateLimiter";
import { isShadowBanned, hasReportBlock } from "./reportStore";

type ConnectionId = string;

const waitingQueue: ConnectionId[] = [];
const shadowBannedQueue: ConnectionId[] = [];
const activeMatches = new Map<ConnectionId, ConnectionId>();


export function joinQueue(id: ConnectionId): Conversation | { error: string } | null {
  if (!canMatch(id)) {
    return { error: 'RATE_LIMIT_EXCEEDED' };
  }

  if (activeMatches.has(id) || waitingQueue.includes(id) || shadowBannedQueue.includes(id)) {
    return null;
  }

  const shadowBanned = isShadowBanned(id);
  const queueToUse = shadowBanned ? shadowBannedQueue : waitingQueue;

  if (queueToUse.length > 0) {
    let partnerIndex = -1;
    for (let i = 0; i < queueToUse.length; i++) {
      if (!hasReportBlock(id, queueToUse[i])) {
        partnerIndex = i;
        break;
      }
    }

    if (partnerIndex !== -1) {
      const partner = queueToUse[partnerIndex];
      queueToUse.splice(partnerIndex, 1);

      activeMatches.set(id, partner);
      activeMatches.set(partner, id);
      return createConversation(id, partner);
    }
  }

  queueToUse.push(id);
  return null;
}

export function leaveQueue(id: ConnectionId) {
  const index = waitingQueue.indexOf(id);
  if (index !== -1) {
    waitingQueue.splice(index, 1);
  }

  const sbIndex = shadowBannedQueue.indexOf(id);
  if (sbIndex !== -1) {
    shadowBannedQueue.splice(sbIndex, 1);
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
