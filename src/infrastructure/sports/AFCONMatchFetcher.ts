import { Match } from '../../domain/entities/Match';
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface MatchData {
    homeTeam: string;
    awayTeam: string;
    kickoffTime: Date;
    matchId: string;
}

export class AFCONMatchFetcher {
    private flashscoreUrl: string = 'https://www.flashscore.com/football/africa/africa-cup-of-nations/';

    async fetchTodayMatches(): Promise<MatchData[]> {
        try {
            console.log('[FlashScore] Fetching AFCON matches...');

            const response = await axios.get(this.flashscoreUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const $ = cheerio.load(response.data);
            const matches: MatchData[] = [];
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Find all match rows
            $('.event__match--scheduled, .event__match--live').each((i, elem) => {
                try {
                    const $match = $(elem);

                    // Extract match ID
                    const matchId = $match.attr('id')?.replace('g_1_', 'AFCON_') || `AFCON_${Date.now()}_${i}`;

                    // Extract time
                    const timeText = $match.find('.event__time').text().trim();

                    // Extract teams
                    const homeTeam = $match.find('.event__homeParticipant .wcl-name_jjfMf').text().trim();
                    const awayTeam = $match.find('.event__awayParticipant .wcl-name_jjfMf').text().trim();

                    if (!homeTeam || !awayTeam) return;

                    // Parse time (format: "13:30" or "29.12. 17:00")
                    let kickoffTime = new Date();

                    if (timeText.includes('.')) {
                        // Format: "29.12. 17:00"
                        const parts = timeText.split(' ');
                        const datePart = parts[0].split('.');
                        const timePart = parts[1].split(':');

                        kickoffTime = new Date(
                            today.getFullYear(),
                            parseInt(datePart[1]) - 1, // Month (0-indexed)
                            parseInt(datePart[0]), // Day
                            parseInt(timePart[0]), // Hour
                            parseInt(timePart[1]) // Minute
                        );
                    } else if (timeText.includes(':')) {
                        // Format: "13:30" (today)
                        const timePart = timeText.split(':');
                        kickoffTime = new Date(today);
                        kickoffTime.setHours(parseInt(timePart[0]), parseInt(timePart[1]), 0, 0);
                    }

                    // Only include matches from today or future
                    if (kickoffTime >= today) {
                        matches.push({
                            matchId,
                            homeTeam,
                            awayTeam,
                            kickoffTime
                        });
                    }
                } catch (err) {
                    console.error(`[FlashScore] Error parsing match:`, err);
                }
            });

            console.log(`✅ Found ${matches.length} upcoming AFCON matches`);
            return matches;
        } catch (error: any) {
            console.error('❌ Failed to fetch from FlashScore:', error.message);
            return [];
        }
    }

    async getMatchStatus(matchId: string): Promise<'live' | 'finished' | 'scheduled'> {
        // Not needed for Phase 1, but can be implemented later
        return 'scheduled';
    }
}
