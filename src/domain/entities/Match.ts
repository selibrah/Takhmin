export enum MatchStatus {
    SCHEDULED = 'SCHEDULED',
    FINISHED = 'FINISHED',
}

export type MatchResult = '1' | 'X' | '2';

export class Match {
    constructor(
        public readonly id: string,
        public readonly teamA: string,
        public readonly teamB: string,
        public readonly kickoffTime: Date,
        public status: MatchStatus = MatchStatus.SCHEDULED,
        public result?: MatchResult
    ) {}

    public isLocked(now: Date): boolean {
        return now >= this.kickoffTime;
    }

    public finish(result: MatchResult) {
        this.status = MatchStatus.FINISHED;
        this.result = result;
    }
}
