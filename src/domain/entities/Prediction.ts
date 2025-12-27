export type PredictionChoice = '1' | 'X' | '2';

export class Prediction {
    constructor(
        public readonly matchId: string,
        public readonly userId: string,
        public readonly groupId: string,
        public readonly choice: PredictionChoice,
        public readonly createdAt: Date
    ) { }
}
