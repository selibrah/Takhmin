import { Match } from '../../domain/entities/Match';
import { Prediction } from '../../domain/entities/Prediction';

export interface MatchRepository {
    findById(id: string): Promise<Match | null>;
    findAllFinished(): Promise<Match[]>;
    save(match: Match): Promise<void>;
}

export interface PredictionRepository {
    findByUserAndMatch(userId: string, matchId: string, groupId: string): Promise<Prediction | null>;
    findByGroup(groupId: string): Promise<Prediction[]>;
    save(prediction: Prediction): Promise<void>;
}
