import { Database } from 'better-sqlite3';
import { Match, MatchStatus, MatchResult } from '../../domain/entities/Match';
import { MatchRepository } from '../../application/ports/MatchRepository';

export class SqliteMatchRepository implements MatchRepository {
    constructor(private db: Database) { }

    async findById(id: string): Promise<Match | null> {
        const row = this.db.prepare('SELECT * FROM matches WHERE id = ?').get(id) as any;
        if (!row) return null;

        return this.mapToMatch(row);
    }

    async findAllFinished(): Promise<Match[]> {
        const rows = this.db.prepare('SELECT * FROM matches WHERE status = ?').all(MatchStatus.FINISHED) as any[];
        return rows.map(row => this.mapToMatch(row));
    }

    private mapToMatch(row: any): Match {
        const match = new Match(
            row.id,
            row.teamA,
            row.teamB,
            new Date(row.kickoffTime),
            row.status as MatchStatus,
            row.result as MatchResult
        );

        // Restore poll tracking and lock state
        (match as any).pollMessageId = row.poll_message_id;
        (match as any).locked = row.locked === 1;
        (match as any).lockedAt = row.locked_at;

        return match;
    }

    async save(match: Match): Promise<void> {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO matches (id, teamA, teamB, kickoffTime, status, result, poll_message_id, locked, locked_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            match.id,
            match.teamA,
            match.teamB,
            match.kickoffTime.toISOString(),
            match.status,
            match.result || null,
            (match as any).pollMessageId || null,
            (match as any).locked ? 1 : 0,
            (match as any).lockedAt || null
        );
    }
}
