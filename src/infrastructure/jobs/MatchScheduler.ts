import cron from 'node-cron';
import { AFCONMatchFetcher, MatchData } from '../sports/AFCONMatchFetcher';
import { WhatsAppMessagingService } from '../messaging/WhatsAppMessagingService';
import { getRandomMeme } from '../messaging/DarijaMemes';
import { MatchRepository } from '../../application/ports/MatchRepository';
import { Match, MatchStatus } from '../../domain/entities/Match';

export class MatchScheduler {
    private fetcher: AFCONMatchFetcher;
    private messaging: WhatsAppMessagingService;
    private matchRepo: MatchRepository;
    private groupId: string;

    constructor(
        fetcher: AFCONMatchFetcher,
        messaging: WhatsAppMessagingService,
        matchRepo: MatchRepository,
        groupId: string
    ) {
        this.fetcher = fetcher;
        this.messaging = messaging;
        this.matchRepo = matchRepo;
        this.groupId = groupId;
    }

    start() {
        // Fetch today's matches immediately on startup (if not fetched yet)
        this.fetchAndAnnounceMatches().catch(err =>
            console.error('[Scheduler] Startup fetch failed:', err)
        );

        // Daily match fetch at 8 AM Morocco time (Africa/Casablanca = UTC+1)
        cron.schedule('0 8 * * *', async () => {
            console.log('[Scheduler] Fetching today\'s AFCON matches...');
            await this.fetchAndAnnounceMatches();
        }, {
            timezone: 'Africa/Casablanca'
        });

        // Check for match locks every 1 minute
        cron.schedule('* * * * *', async () => {
            await this.checkLockingMatches();
        });

        // Check for result reminders every 30 minutes
        cron.schedule('*/30 * * * *', async () => {
            await this.checkResultReminders();
        });

        console.log('✅ Match scheduler started (startup fetch + 8 AM daily + lock checks + result reminders)');
    }

    private async fetchAndAnnounceMatches(): Promise<void> {
        try {
            const matches = await this.fetcher.fetchTodayMatches();

            if (matches.length === 0) {
                console.log('[Scheduler] No AFCON matches today');
                return;
            }

            // Check if we already have these matches (avoid duplicate announcements)
            const existingMatch = await this.matchRepo.findById(matches[0].matchId);
            if (existingMatch) {
                console.log('[Scheduler] Matches already fetched for today, skipping announcement');
                return;
            }

            // Save matches to DB
            for (const m of matches) {
                const match = new Match(
                    m.matchId,
                    m.homeTeam,
                    m.awayTeam,
                    m.kickoffTime,
                    'SCHEDULED' as MatchStatus
                );
                await this.matchRepo.save(match);
            }

            // Announce to group with sarcasm
            const announcement = getRandomMeme('matchAnnouncement');
            const matchList = matches.map((m, i) =>
                `${i + 1}. ${m.homeTeam} 🆚 ${m.awayTeam} - ${m.kickoffTime.toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' })}`
            ).join('\n');

            await this.messaging.sendMessage(
                this.groupId,
                `${announcement}\n\n${matchList}\n\n⚽️ Dir prediction dyalek daba!`
            );

            console.log(`✅ Announced ${matches.length} matches to group`);
        } catch (error) {
            console.error('[Scheduler] Failed to fetch/announce matches:', error);
        }
    }

    private async checkLockingMatches(): Promise<void> {
        try {
            // Find matches starting in next 15 minutes that aren't locked yet
            const now = new Date();
            const fifteenMinutesLater = new Date(now.getTime() + 15 * 60 * 1000);

            const stmt = (this.matchRepo as any).db.prepare(`
                SELECT * FROM matches 
                WHERE datetime(kickoffTime) BETWEEN datetime(?) AND datetime(?)
                AND locked = 0
            `);

            const rows = stmt.all(now.toISOString(), fifteenMinutesLater.toISOString());

            for (const row of rows) {
                const match = (this.matchRepo as any).mapToMatch(row);

                // Get predictions count
                const predStmt = (this.matchRepo as any).db.prepare(
                    'SELECT COUNT(*) as count FROM predictions WHERE matchId = ?'
                );
                const predCount = predStmt.get(match.id).count;

                // Send lock notification
                const lockMeme = getRandomMeme('lock');
                const minutesLeft = Math.ceil((match.kickoffTime.getTime() - now.getTime()) / 60000);

                await this.messaging.sendMessage(
                    this.groupId,
                    `🔒 ${lockMeme}\n\n${match.teamA} vs ${match.teamB}\n⏰ Ybda f ${minutesLeft} minutes!\n\n` +
                    `${predCount} predictions submitted.\n3ad ma b9ash wakt!`
                );

                // Mark as locked
                (match as any).locked = true;
                (match as any).lockedAt = now.toISOString();
                await this.matchRepo.save(match);

                console.log(`🔒 Locked match: ${match.id}`);
            }
        } catch (error) {
            console.error('[Scheduler] Failed to check locking matches:', error);
        }
    }

    private async checkResultReminders(): Promise<void> {
        try {
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

            const stmt = (this.matchRepo as any).db.prepare(`
                SELECT * FROM matches 
                WHERE datetime(kickoffTime) < datetime(?)
                AND result IS NULL
                AND status != 'SCHEDULED'
            `);

            const rows = stmt.all(twoHoursAgo.toISOString());

            for (const row of rows) {
                const match = (this.matchRepo as any).mapToMatch(row);
                const meme = getRandomMeme('noResult');

                await this.messaging.sendMessage(
                    this.groupId,
                    `⚽️ ${meme}\n\n${match.teamA} vs ${match.teamB} finished 2 hours ago!\n\n` +
                    `Admin: Submit result with:\n/result ${match.id} [1/2/3]\n\n` +
                    `Wla nsa likom? 🤔`
                );

                console.log(`⏰ Sent result reminder: ${match.id}`);
            }
        } catch (error) {
            console.error('[Scheduler] Failed to check result reminders:', error);
        }
    }
}
