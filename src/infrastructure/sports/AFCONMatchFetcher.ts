import { Match } from '../../domain/entities/Match';
import axios from 'axios';

export interface MatchData {
    homeTeam: string;
    awayTeam: string;
    kickoffTime: Date;
    matchId: string;
}

export class AFCONMatchFetcher {
    private apiKey: string;
    private baseUrl: string = 'https://api.live-score-api.com/api-football';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async fetchTodayMatches(): Promise<MatchData[]> {
        try {
            // Live-score API endpoint for AFCON 2025
            const response = await axios.get(`${this.baseUrl}/matches/today`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                params: {
                    competition: 'AFCON_2025',
                    timezone: 'Africa/Casablanca'
                }
            });

            const matches = response.data.matches || [];

            return matches.map((m: any) => ({
                matchId: `AFCON${m.id}`,
                homeTeam: m.home_team.name,
                awayTeam: m.away_team.name,
                kickoffTime: new Date(m.kickoff_time)
            }));
        } catch (error: any) {
            console.error('Failed to fetch AFCON matches:', error.response?.data || error.message);
            return [];
        }
    }

    async getMatchStatus(matchId: string): Promise<'live' | 'finished' | 'scheduled'> {
        try {
            const response = await axios.get(`${this.baseUrl}/matches/${matchId}`, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` }
            });
            return response.data.status;
        } catch (error) {
            return 'scheduled';
        }
    }
}
