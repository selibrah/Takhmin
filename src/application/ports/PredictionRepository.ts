import { Prediction } from '../../domain/entities/Prediction';

export interface PredictionRepository {
    findByUserAndMatch(userId: string, matchId: string, groupId: string): Promise<Prediction | null>;
    findByGroup(groupId: string): Promise<Prediction[]>;
    save(prediction: Prediction): Promise<void>;
}
