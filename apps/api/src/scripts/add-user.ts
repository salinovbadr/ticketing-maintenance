import { db } from "../db";
import { users } from "../db/schema";

async function addUser() {
    const jid = "6285156491879@s.whatsapp.net";
    console.log(`Adding user with JID: ${jid}...`);

    try {
        await db.insert(users).values({
            name: "Admin",
            whatsappJid: jid,
            role: "admin",
            isActive: true,
        });
        console.log("✅ User added successfully!");
    } catch (error) {
        console.error("❌ Failed to add user:", error);
    }
    process.exit(0);
}

addUser();
