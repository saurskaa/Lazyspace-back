import WebSocket from "ws";

const URL = "ws://localhost:3000";

function createClient(userId: string, name: string, onMsg: (data: any) => void): Promise<WebSocket> {
    return new Promise((resolve) => {
        const ws = new WebSocket(`${URL}?userId=${userId}&name=${name}`, {
            headers: {
                'x-forwarded-for': `192.168.1.${userId.replace('user', '')}`
            }
        });

        ws.on('open', () => resolve(ws));
        ws.on('message', (data) => onMsg(JSON.parse(data.toString())));
    });
}

async function test() {
    console.log("Starting test...");

    let userBConvo = "";

    const wsA = await createClient("user1", "Alice", (msg) => {
        console.log("[Alice]", msg);
    });

    const wsB = await createClient("user2", "Bob", (msg) => {
        console.log("[Bob]", msg);
        if (msg.type === "MATCH_FOUND") {
            userBConvo = msg.payload.conversationId;
        }
    });

    console.log("A and B joined queue...");
    wsA.send(JSON.stringify({ type: "JOIN_QUEUE" }));
    wsB.send(JSON.stringify({ type: "JOIN_QUEUE" }));

    await new Promise(r => setTimeout(r, 1000));

    console.log("Alice reporting Bob...");
    wsA.send(JSON.stringify({ type: "REPORT_USER" }));

    await new Promise(r => setTimeout(r, 500));

    // Disconnect Alice and Bob
    wsA.close();
    wsB.close();

    // Now create 3 more users to report Bob to get him shadowbanned (he needs 3 total IPs)
    // Alice was 192.168.1.1. We need 192.168.1.3 and 192.168.1.4 to report Bob

    const wsB2 = await createClient("user2", "Bob", () => { });
    const wsC = await createClient("user3", "Charlie", () => { });

    wsB2.send(JSON.stringify({ type: "JOIN_QUEUE" }));
    wsC.send(JSON.stringify({ type: "JOIN_QUEUE" }));

    await new Promise(r => setTimeout(r, 1000));

    console.log("Charlie reporting Bob...");
    wsC.send(JSON.stringify({ type: "REPORT_USER" }));

    await new Promise(r => setTimeout(r, 500));

    wsC.close();
    wsB2.close();

    const wsB3 = await createClient("user2", "Bob", () => { });
    const wsD = await createClient("user4", "Dave", () => { });

    wsB3.send(JSON.stringify({ type: "JOIN_QUEUE" }));
    wsD.send(JSON.stringify({ type: "JOIN_QUEUE" }));

    await new Promise(r => setTimeout(r, 1000));

    console.log("Dave reporting Bob...");
    wsD.send(JSON.stringify({ type: "REPORT_USER" }));

    await new Promise(r => setTimeout(r, 500));

    wsD.close();
    wsB3.close();

    console.log("Bob should now be shadowbanned (3 strikes).");

    // Test if Bob matches with normal user E
    const wsB4 = await createClient("user2", "Bob", (msg) => console.log("[Bob]", msg));
    const wsE = await createClient("user5", "Eve", (msg) => console.log("[Eve]", msg));

    wsB4.send(JSON.stringify({ type: "JOIN_QUEUE" }));
    wsE.send(JSON.stringify({ type: "JOIN_QUEUE" }));

    console.log("Waiting 2s to see if Bob and Eve match (they shouldn't)...");
    await new Promise(r => setTimeout(r, 2000));

    // Test if Bob matches with shadowbanned user F
    // Fast track F to shadowban
    const wsF = await createClient("user6", "Frank", (msg) => console.log("[Frank]", msg));
    // Manually cheat since we know how reports work
    const wsX1 = await createClient("user7", "X1", () => { });
    const wsX2 = await createClient("user8", "X2", () => { });
    const wsX3 = await createClient("user9", "X3", () => { });

    wsF.send(JSON.stringify({ type: "JOIN_QUEUE" }));
    wsX1.send(JSON.stringify({ type: "JOIN_QUEUE" }));
    await new Promise(r => setTimeout(r, 500));
    wsX1.send(JSON.stringify({ type: "REPORT_USER" }));
    wsX1.close();

    wsX2.send(JSON.stringify({ type: "JOIN_QUEUE" }));
    wsF.send(JSON.stringify({ type: "FIND_ANOTHER_MATCH" }));
    await new Promise(r => setTimeout(r, 500));
    wsX2.send(JSON.stringify({ type: "REPORT_USER" }));
    wsX2.close();

    wsX3.send(JSON.stringify({ type: "JOIN_QUEUE" }));
    wsF.send(JSON.stringify({ type: "FIND_ANOTHER_MATCH" }));
    await new Promise(r => setTimeout(r, 500));
    wsX3.send(JSON.stringify({ type: "REPORT_USER" }));
    wsX3.close();

    console.log("Frank should now be shadowbanned.");

    wsF.send(JSON.stringify({ type: "FIND_ANOTHER_MATCH" }));
    wsB4.send(JSON.stringify({ type: "FIND_ANOTHER_MATCH" }));

    console.log("Waiting 2s to see if Bob and Frank match (they should)...");
    await new Promise(r => setTimeout(r, 2000));

    process.exit(0);
}

test();
