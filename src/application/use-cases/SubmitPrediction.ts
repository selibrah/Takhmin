import { Prediction, PredictionChoice } from '../../domain/entities/Prediction';
import { MatchRepository } from '../ports/MatchRepository';
import { PredictionRepository } from '../ports/PredictionRepository';
import { Clock } from '../ports/Clock';

export interface SubmitPredictionDTO {
    userId: string;
    matchId: string;
    groupId: string;
    choice: PredictionChoice;
}

export class SubmitPrediction {
    constructor(
        private matchRepo: MatchRepository,
        private predictionRepo: PredictionRepository,
        private clock: Clock
    ) { }

    async execute(dto: SubmitPredictionDTO): Promise<void> {
        const match = await this.matchRepo.findById(dto.matchId);
        if (!match) {
            throw new Error('Match not found');
        }

        if (match.isLocked(this.clock.now())) {
            throw new Error('Match is already locked (kickoff passed)');
        }

        const existing = await this.predictionRepo.findByUserAndMatch(dto.userId, dto.matchId, dto.groupId);
        if (existing) {
            throw new Error('Prediction already exists');
        }

        const prediction = new Prediction(
            dto.matchId,
            dto.userId,
            dto.groupId,
            dto.choice,
            this.clock.now()
        );

        await this.predictionRepo.save(prediction);
    }
}
