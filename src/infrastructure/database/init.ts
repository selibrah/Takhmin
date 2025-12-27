import Database from 'better-sqlite3';
import { join } from 'path';

export const initDb = (dbPath: string) => {
    const db = new Database(dbPath);

    db.exec(`
        CREATE TABLE IF NOT EXISTS matches (
            id TEXT PRIMARY KEY,
            teamA TEXT NOT NULL,
            teamB TEXT NOT NULL,
            kickoffTime TEXT NOT NULL,
            status TEXT NOT NULL,
            result TEXT
        );

        CREATE TABLE IF NOT EXISTS predictions (
            matchId TEXT NOT NULL,
            userId TEXT NOT NULL,
            groupId TEXT NOT NULL,
            choice TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            PRIMARY KEY (matchId, userId, groupId)
        );
    `);

    return db;
};
