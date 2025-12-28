import { Match } from '../../domain/entities/Match';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export interface MatchData {
    homeTeam: string;
    awayTeam: string;
    kickoffTime: Date;
    matchId: string;
}

export class AFCONMatchFetcher {
    private flashscoreUrl: string = 'https://www.flashscore.com/football/africa/africa-cup-of-nations/';

    async fetchTodayMatches(): Promise<MatchData[]> {
        let browser = null;
        try {
            console.log('[FlashScore] Launching headless browser...');

            // Launch browser (works locally and on Railway)
            browser = await puppeteer.launch({
                args: chromium.args,
                defaultViewport: { width: 1920, height: 1080 },
                executablePath: await chromium.executablePath(),
                headless: true,
            });

            const page = await browser.newPage();
            console.log('[FlashScore] Navigating to FlashScore...');

            await page.goto(this.flashscoreUrl, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            console.log('[FlashScore] Waiting for matches to load...');
            await page.waitForSelector('div[id^="g_1_"]', { timeout: 15000 });

            // Extract match data from the page
            const matches = await page.evaluate(() => {
                const matchElements = document.querySelectorAll('div[id^="g_1_"]');
                const results: any[] = [];
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                matchElements.forEach((elem: any) => {
                    try {
                        // Skip if not a match row
                        if (!elem.classList.contains('event__match')) return;

                        // Skip finished matches
                        if (elem.querySelector('.event__score')) {
                            const homeScore = elem.querySelector('.event__score--home')?.textContent?.trim();
                            if (homeScore && homeScore !== '-') return; // Match finished
                        }

                        const matchId = elem.id.replace('g_1_', 'AFCON_');
                        const timeText = elem.querySelector('.event__time')?.textContent?.trim() || '';

                        // Try multiple selector patterns for team names
                        const homeTeamElem = elem.querySelector('.event__participant--home .participant__participantName, .event__homeParticipant .wcl-name_jjfMf');
                        const awayTeamElem = elem.querySelector('.event__participant--away .participant__participantName, .event__awayParticipant .wcl-name_jjfMf');

                        const homeTeam = homeTeamElem?.textContent?.trim() || '';
                        const awayTeam = awayTeamElem?.textContent?.trim() || '';

                        if (!homeTeam || !awayTeam || !timeText) return;

                        // Parse kickoff time
                        let kickoffTime: Date | null = null;

                        if (timeText.includes('.')) {
                            // Format: "28.12. 13:30"
                            const parts = timeText.split(' ');
                            if (parts.length >= 2) {
                                const dateParts = parts[0].replace(/\./g, '').split('.');
                                const timeParts = parts[1].split(':');

                                const day = parseInt(dateParts[0]);
                                const month = parseInt(dateParts[1]) - 1;
                                const hour = parseInt(timeParts[0]);
                                const minute = parseInt(timeParts[1]) || 0;

                                kickoffTime = new Date(today.getFullYear(), month, day, hour, minute);
                            }
                        } else if (timeText.match(/^\d{1,2}:\d{2}$/)) {
                            // Format: "13:30" (today)
                            const timeParts = timeText.split(':');
                            kickoffTime = new Date(today);
                            kickoffTime.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0, 0);
                        }

                        if (kickoffTime && kickoffTime >= today) {
                            results.push({
                                matchId,
                                homeTeam,
                                awayTeam,
                                kickoffTime: kickoffTime.toISOString()
                            });
                        }
                    } catch (err) {
                        console.error('Error parsing match:', err);
                    }
                });

                return results;
            });

            // Convert ISO strings back to Date objects
            const matchData: MatchData[] = matches.map(m => ({
                ...m,
                kickoffTime: new Date(m.kickoffTime)
            }));

            console.log(`✅ Found ${matchData.length} upcoming AFCON matches`);
            matchData.forEach(m => {
                console.log(`   - ${m.homeTeam} vs ${m.awayTeam} at ${m.kickoffTime.toISOString()}`);
            });

            return matchData;
        } catch (error: any) {
            console.error('❌ Failed to fetch from FlashScore:', error.message);
            return [];
        } finally {
            if (browser) {
                await browser.close();
                console.log('[FlashScore] Browser closed');
            }
        }
    }

    async getMatchStatus(matchId: string): Promise<'live' | 'finished' | 'scheduled'> {
        return 'scheduled';
    }
}
