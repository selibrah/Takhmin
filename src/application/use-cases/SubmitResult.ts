import { MatchResult } from '../../domain/entities/Match';
import { MatchRepository } from '../ports/MatchRepository';
import { PredictionRepository } from '../ports/PredictionRepository';

export interface SubmitResultDTO {
    matchId: string;
    result: MatchResult;
}

export class SubmitResult {
    constructor(
        private matchRepo: MatchRepository,
        // We'll need more logic here later for scoring
    ) { }

    async execute(dto: SubmitResultDTO): Promise<void> {
        const match = await this.matchRepo.findById(dto.matchId);
        if (!match) {
            throw new Error('Match not found');
        }

        match.finish(dto.result);
        await this.matchRepo.save(match);

        // TODO: In a real system, we might trigger a background job to calculate scores
        // or iterate through predictions here.
    }
}
