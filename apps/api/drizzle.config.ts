import type { Config } from "drizzle-kit";

export default {
    schema: "./src/db/schema.ts",
    out: "./drizzle",
    dialect: "mysql",
    dbCredentials: {
        url: process.env.DATABASE_URL || "mysql://root:root@localhost:3306/maintenance_monitor",
    },
} satisfies Config;
