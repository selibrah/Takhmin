import { MatchResult } from '../entities/Match';
import { PredictionChoice } from '../entities/Prediction';

export class ScoringRules {
    static calculateScore(prediction: PredictionChoice, result: MatchResult): number {
        return prediction === result ? 1 : -1;
    }
}
