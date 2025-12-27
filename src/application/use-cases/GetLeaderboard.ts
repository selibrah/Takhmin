import { MatchRepository } from '../ports/MatchRepository';
import { PredictionRepository } from '../ports/PredictionRepository';
import { ScoringRules } from '../../domain/rules/Scoring';

export interface ScoreEntry {
    userId: string;
    score: number;
}

export class GetLeaderboard {
    constructor(
        private matchRepo: MatchRepository,
        private predictionRepo: PredictionRepository
    ) { }

    async execute(groupId: string): Promise<ScoreEntry[]> {
        const finishedMatches = await this.matchRepo.findAllFinished();
        const predictions = await this.predictionRepo.findByGroup(groupId);

        const scores: Record<string, number> = {};

        for (const prediction of predictions) {
            const match = finishedMatches.find(m => m.id === prediction.matchId);
            if (match && match.result) {
                const points = ScoringRules.calculateScore(prediction.choice, match.result);
                scores[prediction.userId] = (scores[prediction.userId] || 0) + points;
            }
        }

        return Object.entries(scores)
            .map(([userId, score]) => ({ userId, score }))
            .sort((a, b) => b.score - a.score);
    }
}
