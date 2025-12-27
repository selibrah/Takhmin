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
        // Daily match fetch at 8 AM Morocco time (Africa/Casablanca = UTC+1)
        cron.schedule('0 8 * * *', async () => {
            console.log('[Scheduler] Fetching today\'s AFCON matches...');
            await this.fetchAndAnnounceMatches();
        }, {
            timezone: 'Africa/Casablanca'
        });

        // Check for match locks every 5 minutes
        cron.schedule('*/5 * * * *', async () => {
            await this.checkLockingMatches();
        });

        console.log('✅ Match scheduler started (8 AM daily + lock checks every 5m)');
    }

    private async fetchAndAnnounceMatches(): Promise<void> {
        try {
            const matches = await this.fetcher.fetchTodayMatches();

            if (matches.length === 0) {
                console.log('[Scheduler] No AFCON matches today');
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
        // TODO: Implement lock notification logic
        // - Find matches starting in next 15 minutes  
        // - Send lock notification with predictions summary
        // - Delete polls (if implemented)
    }
}
