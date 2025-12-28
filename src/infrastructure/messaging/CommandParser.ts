export type ParsedCommand =
    | { type: 'START' }
    | { type: 'MATCHES' }
    | { type: 'POLL', matchId?: string }  // Request interactive poll
    | { type: 'MENU' }  // Request quick actions
    | { type: 'PREDICTIONS', matchId?: string }  // View predictions
    | { type: 'MATCH', id: string, teamA: string, teamB: string, time: string }
    | { type: 'PREDICT', matchId: string, choice: '1' | 'X' | '2' }
    | { type: 'RESULT', matchId: string, result: '1' | 'X' | '2' }
    | { type: 'SCORE' }
    | { type: 'UNKNOWN' };

export class CommandParser {
    parse(text: string): ParsedCommand {
        const parts = text.trim().split(/\s+/);
        const cmd = parts[0].toLowerCase();

        if (cmd === '/start') return { type: 'START' };
        if (cmd === '/matches') return { type: 'MATCHES' };
        if (cmd === '/menu' || cmd === '/actions') return { type: 'MENU' };
        if (cmd === '/poll') return { type: 'POLL', matchId: parts[1] };
        if (cmd === '/predictions' || cmd === '/preds') return { type: 'PREDICTIONS', matchId: parts[1] };
        if (cmd === '/score') return { type: 'SCORE' };

        if (cmd === '/match' && parts.length >= 4) {
            // /match M1 Wydad Raja 20:00
            // Simplified for Phase 0
            return {
                type: 'MATCH',
                id: parts[1],
                teamA: parts[2],
                teamB: parts[3],
                time: parts[4] || '20:00'
            };
        }

        if (cmd === '/result' && parts.length >= 3) {
            // /result M1 1
            return {
                type: 'RESULT',
                matchId: parts[1],
                result: parts[2] as any
            };
        }

        // Support for "1", "2", "3" (where 3 is '2' in our internal 1-X-2 system)
        // User input: 1 = TEAM_A, 2 = Draw, 3 = TEAM_B
        if (['1', '2', '3'].includes(cmd)) {
            // We need a way to know which match the user is predicting for.
            // For Phase 0, we'll assume the most recent match or explicit match ID.
            // For now, let's assume "/predict M1 1"
        }

        if (cmd === '/predict' && parts.length >= 3) {
            return {
                type: 'PREDICT',
                matchId: parts[1],
                choice: this.mapChoice(parts[2])
            };
        }

        return { type: 'UNKNOWN' };
    }

    private mapChoice(input: string): '1' | 'X' | '2' {
        if (input === '1') return '1';
        if (input === '2') return 'X';
        if (input === '3') return '2';
        return input as any;
    }
}
