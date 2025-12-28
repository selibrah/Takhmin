import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { initDb } from './infrastructure/database/init';
import { SqliteMatchRepository } from './infrastructure/database/SqliteMatchRepository';
import { SqlitePredictionRepository } from './infrastructure/database/SqlitePredictionRepository';
import { SystemClock } from './infrastructure/Clock';
import { WhatsAppMessagingService } from './infrastructure/messaging/WhatsAppMessagingService';
import { CommandParser } from './infrastructure/messaging/CommandParser';
import { SubmitPrediction } from './application/use-cases/SubmitPrediction';
import { CreateMatch } from './application/use-cases/CreateMatch';
import { SubmitResult } from './application/use-cases/SubmitResult';
import { GetLeaderboard } from './application/use-cases/GetLeaderboard';
import { DarijaMessages } from './infrastructure/messaging/DarijaMessages';
import { AFCONMatchFetcher } from './infrastructure/sports/AFCONMatchFetcher';
import { MatchScheduler } from './infrastructure/jobs/MatchScheduler';

const app = express();
app.use(bodyParser.json());

// Global Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Configuration
const DB_PATH = process.env.DB_PATH || './takhmin.db';
const WA_TOKEN = process.env.WA_TOKEN || 'dummy_token';
const WA_ID = process.env.WA_ID || 'dummy_id';
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'takhmin_secret';
const PORT = process.env.PORT || 8080;
const DEFAULT_GROUP = process.env.DEFAULT_GROUP || '15551786049'; // Test number from Meta

// Dependencies (initialized later)
let matchRepo: SqliteMatchRepository;
let predictionRepo: SqlitePredictionRepository;
let messagingService: WhatsAppMessagingService;
let parser: CommandParser;
let submitPrediction: SubmitPrediction;
let createMatch: CreateMatch;
let submitResult: SubmitResult;
let getLeaderboard: GetLeaderboard;
const clock = new SystemClock();

// --- CRITICAL: LIGHTWEIGHT ENDPOINTS FIRST ---

app.get('/', (req, res) => {
    res.send('<h1>Takhmin ⚽️ Bot is Online!</h1><p>Status: v1.0.6 (Listen-First Ready)</p>');
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', version: '1.0.6', timestamp: new Date().toISOString() });
});

app.get('/webhook', (req: any, res: any) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// --- START SERVER IMMEDIATELY ---

const server = app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(`   Takhmin Bot v1.0.6 - STARTING`);
    console.log(`   Internal Port: ${PORT}`);
    console.log(`   Mode: Listen-First (Rescue Mode)`);
    console.log(`=========================================`);
});

// --- BACKGROUND INITIALIZATION ---

const initialize = async () => {
    try {
        console.log(`Initializing infrastructure (DB_PATH: ${DB_PATH})...`);

        const dbDir = path.dirname(DB_PATH);
        if (!fs.existsSync(dbDir)) {
            console.log(`Creating directory: ${dbDir}`);
            fs.mkdirSync(dbDir, { recursive: true });
        }

        const db = initDb(DB_PATH);
        matchRepo = new SqliteMatchRepository(db);
        predictionRepo = new SqlitePredictionRepository(db);
        messagingService = new WhatsAppMessagingService(WA_TOKEN, WA_ID);
        parser = new CommandParser();

        submitPrediction = new SubmitPrediction(matchRepo, predictionRepo, clock);
        createMatch = new CreateMatch(matchRepo);
        submitResult = new SubmitResult(matchRepo);
        getLeaderboard = new GetLeaderboard(matchRepo, predictionRepo);

        // Start AFCON match scheduler (FlashScore scraping - FREE!)
        const fetcher = new AFCONMatchFetcher();
        const scheduler = new MatchScheduler(fetcher, messagingService, matchRepo, DEFAULT_GROUP);
        scheduler.start();

        console.log('✅ Infrastructure initialized successfully.');
    } catch (error) {
        console.error('❌ CRITICAL: Failed to initialize infrastructure:', error);
    }
};

initialize();

// --- WEBHOOK LOGIC ---

app.post('/webhook', async (req: any, res: any) => {
    console.log('>>> Incoming Webhook POST');
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const message = value?.messages?.[0];

        // Handle button replies (interactive messages)
        if (message?.type === 'interactive') {
            const from = message.from;
            const buttonReply = message.interactive?.button_reply;
            const buttonId = buttonReply?.id;
            const groupId = value?.metadata?.display_phone_number || 'default_group';

            console.log(`Received button click: "${buttonId}" from ${from}`);

            if (!submitPrediction) {
                return res.sendStatus(503);
            }

            try {
                // Parse button ID format: "predict:MATCHID:CHOICE" or "action:TYPE"
                const parts = buttonId.split(':');

                if (parts[0] === 'predict') {
                    const matchId = parts[1];
                    const choice = parts[2]; // "1", "2", or "3"
                    const choiceMap: any = { '1': '1', '2': 'X', '3': '2' };

                    await submitPrediction.execute({
                        userId: from,
                        matchId: matchId,
                        groupId: groupId,
                        choice: choiceMap[choice]
                    });

                    await messagingService.sendMessage(from, '✅ Nta o zahrak! Prediction saved 🍀');

                } else if (parts[0] === 'action') {
                    // Handle quick actions
                    const action = parts[1];
                    if (action === 'matches') {
                        const command = parser.parse('/matches');
                        // Trigger matches command (code below handles it)
                    } else if (action === 'score') {
                        const scores = await getLeaderboard.execute(groupId);
                        const rankingText = scores
                            .map((s: any, i: number) => `${i + 1}. ${s.userId.slice(-4)}: ${s.score} pts`)
                            .join('\n');
                        await messagingService.sendMessage(from, DarijaMessages.LEADERBOARD(rankingText || 'مازال تا واحد ما بدا التوقع.'));
                    } else if (action === 'help') {
                        await messagingService.sendMessage(from, DarijaMessages.WELCOME);
                    }
                }
            } catch (error: any) {
                console.error('Error processing button:', error.message);
                await messagingService.sendMessage(from, error.message);
            }

            return res.sendStatus(200);
        }

        // Handle text messages
        if (message?.type === 'text') {
            const from = message.from;
            const text = message.text.body;
            const groupId = value?.metadata?.display_phone_number || 'default_group';

            console.log(`Received message: "${text}" from ${from}`);

            // Ensure initialization is complete before handling
            if (!submitPrediction) {
                console.error('Dropped message: App not fully initialized.');
                return res.sendStatus(503);
            }

            try {
                const command = parser.parse(text);

                switch (command.type) {
                    case 'START':
                        await messagingService.sendMessage(from, DarijaMessages.WELCOME);
                        break;
                    case 'MATCH':
                        await createMatch.execute({
                            id: command.id, teamA: command.teamA, teamB: command.teamB,
                            kickoffTime: new Date(command.time)
                        });
                        await messagingService.sendMessage(from, DarijaMessages.MATCH_CREATED(command.teamA, command.teamB));
                        break;
                    case 'PREDICT':
                        await submitPrediction.execute({
                            userId: from, matchId: command.matchId, groupId: groupId, choice: command.choice
                        });
                        await messagingService.sendMessage(from, DarijaMessages.PREDICTION_SAVED);
                        break;
                    case 'RESULT':
                        await submitResult.execute({ matchId: command.matchId, result: command.result });
                        await messagingService.sendMessage(from, DarijaMessages.RESULT_SAVED(command.matchId, command.result));
                        break;
                    case 'SCORE':
                        const scores = await getLeaderboard.execute(groupId);
                        const rankingText = scores
                            .map((s: any, i: number) => `${i + 1}. ${s.userId.slice(-4)}: ${s.score} pts`)
                            .join('\n');
                        await messagingService.sendMessage(from, DarijaMessages.LEADERBOARD(rankingText || 'مازال تا واحد ما بدا التوقع.'));
                        break;
                    case 'MATCHES':
                        // Show available matches
                        const db = (matchRepo as any).db;
                        const upcomingMatches = db.prepare(`
                            SELECT * FROM matches 
                            WHERE datetime(kickoffTime) > datetime('now')
                            AND locked = 0
                            ORDER BY kickoffTime ASC
                        `).all();

                        if (upcomingMatches.length === 0) {
                            await messagingService.sendMessage(
                                from,
                                `Ma kaynch matches lyoum! 🤷‍♂️\n\nCheck back later wla dir /start for commands.`
                            );
                        } else {
                            const matchList = upcomingMatches.map((m: any, i: number) => {
                                const kickoff = new Date(m.kickoffTime);
                                const time = kickoff.toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' });
                                return `${i + 1}. ${m.teamA} 🆚 ${m.teamB}\n   ⏰ ${time} | ID: ${m.id}\n   /predict ${m.id} [1/2/3]`;
                            }).join('\n\n');

                            await messagingService.sendMessage(
                                from,
                                `⚽️ Available Matches:\n\n${matchList}\n\nDir prediction dyalek! 🎯`
                            );
                        }
                        break;
                    case 'POLL':
                        // Send interactive poll for a match (or all matches)
                        const pollDb = (matchRepo as any).db;
                        let matchesToPoll: any[] = [];

                        if (command.matchId) {
                            // Specific match
                            const match = pollDb.prepare('SELECT * FROM matches WHERE id = ? AND locked = 0').get(command.matchId);
                            if (match) matchesToPoll = [match];
                        } else {
                            // All unlocked matches
                            matchesToPoll = pollDb.prepare(`
                                SELECT * FROM matches 
                                WHERE datetime(kickoffTime) > datetime('now')
                                AND locked = 0
                                ORDER BY kickoffTime ASC
                            `).all();
                        }

                        if (matchesToPoll.length === 0) {
                            await messagingService.sendMessage(from, 'Ma kaynch matches available for polls! 🤷‍♂️');
                        } else {
                            for (const m of matchesToPoll) {
                                const kickoff = new Date(m.kickoffTime);
                                const time = kickoff.toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' });
                                await messagingService.sendPoll(from, m.id, m.teamA, m.teamB, time);
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                        }
                        break;
                    case 'MENU':
                        // Send quick actions menu
                        await messagingService.sendQuickActions(from);
                        break;
                    case 'PREDICTIONS':
                        // Show predictions for a match or all unlocked matches
                        const predDb = (matchRepo as any).db;
                        let matchesToShow: any[] = [];

                        if (command.matchId) {
                            // Specific match
                            const match = predDb.prepare('SELECT * FROM matches WHERE id = ?').get(command.matchId);
                            if (match) matchesToShow = [match];
                        } else {
                            // All unlocked matches
                            matchesToShow = predDb.prepare(`
                                SELECT * FROM matches 
                                WHERE datetime(kickoffTime) > datetime('now')
                                AND locked = 0
                                ORDER BY kickoffTime ASC
                                LIMIT 5
                            `).all();
                        }

                        if (matchesToShow.length === 0) {
                            await messagingService.sendMessage(from, 'Ma kaynch matches! 🤷‍♂️');
                        } else {
                            let predictionSummary = '📊 Predictions:\n\n';

                            for (const match of matchesToShow) {
                                const predictions = predDb.prepare(`
                                    SELECT userId, choice, createdAt 
                                    FROM predictions 
                                    WHERE matchId = ?
                                    ORDER BY createdAt ASC
                                `).all(match.id);

                                predictionSummary += `⚽️ ${match.teamA} vs ${match.teamB}\n`;

                                if (predictions.length === 0) {
                                    predictionSummary += '   No predictions yet! 😴\n\n';
                                } else {
                                    const choiceMap: any = { '1': '🏠 Home', 'X': '🤝 Draw', '2': '✈️ Away' };
                                    const grouped: any = { '1': 0, 'X': 0, '2': 0 };

                                    predictions.forEach((p: any) => {
                                        grouped[p.choice]++;
                                    });

                                    predictionSummary += `   ${choiceMap['1']}: ${grouped['1']} | ${choiceMap['X']}: ${grouped['X']} | ${choiceMap['2']}: ${grouped['2']}\n`;
                                    predictionSummary += `   Total: ${predictions.length} predictions\n\n`;
                                }
                            }

                            await messagingService.sendMessage(from, predictionSummary + 'Dir prediction dyalek! 🎯');
                        }
                        break;
                    default:
                        await messagingService.sendMessage(from, DarijaMessages.INVALID_COMMAND);
                }
            } catch (error: any) {
                console.error('Error processing command:', error.message);
                await messagingService.sendMessage(from, error.message);
            }
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

// --- CRASH GUARDS ---

process.on('uncaughtException', (err) => {
    console.error('🔥 UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 UNHANDLED REJECTION at:', promise, 'reason:', reason);
});
