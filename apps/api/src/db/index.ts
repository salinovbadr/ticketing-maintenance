import { drizzle, MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

const connection = await mysql.createPool({
    uri: process.env.DATABASE_URL,
});

export const db: MySql2Database<typeof schema> = drizzle(connection, { schema, mode: 'default' });
