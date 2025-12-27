import { Match, MatchStatus } from '../../domain/entities/Match';
import { MatchRepository } from '../ports/MatchRepository';

export interface CreateMatchDTO {
    id: string;
    teamA: string;
    teamB: string;
    kickoffTime: Date;
}

export class CreateMatch {
    constructor(private matchRepo: MatchRepository) { }

    async execute(dto: CreateMatchDTO): Promise<void> {
        const existing = await this.matchRepo.findById(dto.id);
        if (existing) {
            throw new Error(`Match with ID ${dto.id} already exists`);
        }

        const match = new Match(
            dto.id,
            dto.teamA,
            dto.teamB,
            dto.kickoffTime,
            MatchStatus.SCHEDULED
        );

        await this.matchRepo.save(match);
    }
}
