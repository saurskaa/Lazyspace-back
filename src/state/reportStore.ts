import { getConnectionInfo } from "./connectionStore";
import { supabase } from "../db";
import {
    getConversationByUser
} from "../state/conversationStore";

// Maps an IP address to a set of reporter user IDs to ensure 1 strike per reporter
const reportsByIp = new Map<string, Set<string>>();

// Contains IP addresses that have 5 or more strikes
export const permanentShadowBans = new Set<string>();

export async function initReportStore() {
    try {
        const { data: bansData, error: bansError } = await supabase.from('bans').select('ip_address');
        if (bansError) throw bansError;

        for (const row of bansData || []) {
            permanentShadowBans.add(row.ip_address);
        }

        const { data: reportsData, error: reportsError } = await supabase.from('reports').select('reported_ip, reporter_ip');
        if (reportsError) throw reportsError;

        for (const row of reportsData || []) {
            if (row.reported_ip && row.reporter_ip) {
                if (!reportsByIp.has(row.reported_ip)) {
                    reportsByIp.set(row.reported_ip, new Set<string>());
                }
                reportsByIp.get(row.reported_ip)!.add(row.reporter_ip);
            }
        }
        console.log(`Loaded ${permanentShadowBans.size} bans and reports for ${reportsByIp.size} IPs.`);
    } catch (err) {
        console.error("Failed to initialize report store from DB (tables might not exist):", err);
    }
}

export async function reportUser(reporterUserId: string, reportedUserId: string) {
    const reporterConn = getConnectionInfo(reporterUserId);
    const reportedConn = getConnectionInfo(reportedUserId);
    const reportedConvo = getConversationByUser(reportedUserId);


    if (!reporterConn || !reportedConn) {
        return; // Connection details must exist
    }

    const reporterIp = reporterConn.ip;
    const reportedIp = reportedConn.ip;

    if (!reportsByIp.has(reportedIp)) {
        reportsByIp.set(reportedIp, new Set<string>());
    }

    const strikesSet = reportsByIp.get(reportedIp)!;

    // De-duplicate in memory
    if (strikesSet.has(reporterIp)) {
        return; // Already reported by this IP
    }

    strikesSet.add(reporterIp);

    // Persist Report Asynchronously
    supabase.from('reports').insert([{
        reporter_id: reporterUserId,
        reporter_ip: reporterIp,
        reported_id: reportedUserId,
        reported_ip: reportedIp,
        conversation_id: reportedConvo?.id,
        created_at: Date.now()
    }]).then(({ error }) => {
        if (error) console.error("Error saving report to DB:", error);
    });

    // If there are exactly 5 strikes, trigger permanent shadowban
    if (strikesSet.size === 5) {
        permanentShadowBans.add(reportedIp);

        // Persist Ban Asynchronously
        supabase.from('bans').insert([{
            user_id: reportedUserId,
            ip_address: reportedIp,
            created_at: Date.now()
        }]).then(({ error }) => {
            if (error) console.error("Error saving ban to DB:", error);
        });
    }
}

export function isShadowBanned(userId: string): boolean {
    const conn = getConnectionInfo(userId);
    if (!conn) {
        return false;
    }

    const userIp = conn.ip;

    if (permanentShadowBans.has(userIp)) {
        return true;
    }

    const strikesSet = reportsByIp.get(userIp);
    if (strikesSet && strikesSet.size >= 3) {
        return true;
    }

    return false;
}

export function hasReportBlock(userId1: string, userId2: string): boolean {
    const conn1 = getConnectionInfo(userId1);
    const conn2 = getConnectionInfo(userId2);

    if (!conn1 || !conn2) {
        return false;
    }

    const ip1 = conn1.ip;
    const ip2 = conn2.ip;

    const reportersOf2 = reportsByIp.get(ip2);
    if (reportersOf2 && reportersOf2.has(ip1)) {
        return true;
    }

    const reportersOf1 = reportsByIp.get(ip1);
    if (reportersOf1 && reportersOf1.has(ip2)) {
        return true;
    }

    return false;
}

