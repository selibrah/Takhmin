import { Database } from 'better-sqlite3';
import { Prediction, PredictionChoice } from '../../domain/entities/Prediction';
import { PredictionRepository } from '../../application/ports/PredictionRepository';

export class SqlitePredictionRepository implements PredictionRepository {
    constructor(private db: Database) { }

    async findByUserAndMatch(userId: string, matchId: string, groupId: string): Promise<Prediction | null> {
        const row = this.db.prepare(`
            SELECT * FROM predictions 
            WHERE userId = ? AND matchId = ? AND groupId = ?
        `).get(userId, matchId, groupId) as any;

        if (!row) return null;

        return this.mapToPrediction(row);
    }

    async findByGroup(groupId: string): Promise<Prediction[]> {
        const rows = this.db.prepare('SELECT * FROM predictions WHERE groupId = ?').all(groupId) as any[];
        return rows.map(row => this.mapToPrediction(row));
    }

    private mapToPrediction(row: any): Prediction {
        return new Prediction(
            row.matchId,
            row.userId,
            row.groupId,
            row.choice as PredictionChoice,
            new Date(row.createdAt)
        );
    }

    async save(prediction: Prediction): Promise<void> {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO predictions (matchId, userId, groupId, choice, createdAt)
            VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(
            prediction.matchId,
            prediction.userId,
            prediction.groupId,
            prediction.choice,
            prediction.createdAt.toISOString()
        );
    }
}
