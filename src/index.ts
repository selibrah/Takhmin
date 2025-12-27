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
