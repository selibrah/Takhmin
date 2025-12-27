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

const app = express();
app.use(bodyParser.json());

// Global Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Configuration (should be environment variables)
const DB_PATH = process.env.DB_PATH || './takhmin.db';
const WA_TOKEN = process.env.WA_TOKEN || 'dummy_token';
const WA_ID = process.env.WA_ID || 'dummy_id';
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'takhmin_secret';

// Initialize Infrastructure
console.log(`Starting Takhmin...`);
console.log(`DB_PATH: ${DB_PATH}`);
console.log(`PORT: ${process.env.PORT || 3000}`);
console.log(`WA_TOKEN presence: ${WA_TOKEN !== 'dummy_token'} (length: ${WA_TOKEN.length})`);
console.log(`WA_ID presence: ${WA_ID !== 'dummy_id'} (length: ${WA_ID.length})`);
console.log(`VERIFY_TOKEN presence: ${VERIFY_TOKEN !== 'takhdir_secret'} (length: ${VERIFY_TOKEN.length})`);

let matchRepo: SqliteMatchRepository;
let predictionRepo: SqlitePredictionRepository;
let messagingService: WhatsAppMessagingService;
let parser: CommandParser;
let submitPrediction: SubmitPrediction;
let createMatch: CreateMatch;
let submitResult: SubmitResult;
let getLeaderboard: GetLeaderboard;
const clock = new SystemClock();

try {
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

    // Initialize Use Cases
    submitPrediction = new SubmitPrediction(matchRepo, predictionRepo, clock);
    createMatch = new CreateMatch(matchRepo);
    submitResult = new SubmitResult(matchRepo);
    getLeaderboard = new GetLeaderboard(matchRepo, predictionRepo);
} catch (error) {
    console.error('CRITICAL: Failed to initialize infrastructure:', error);
    process.exit(1);
}

// Health Check
app.get('/', (req, res) => {
    res.send('<h1>Takhmin ⚽️ Bot is Online!</h1><p>Webhook is ready at /webhook</p>');
});

// Webhook Verification (WhatsApp requirement)
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

// Webhook Message Handling
app.post('/webhook', async (req: any, res: any) => {
    console.log('>>> Incoming Webhook POST');
    const body = req.body;
    console.log('Body:', JSON.stringify(body, null, 2));

    if (body.object === 'whatsapp_business_account') {
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const message = value?.messages?.[0];

        if (message?.type === 'text') {
            const from = message.from;
            const text = message.text.body;
            const groupId = value?.metadata?.display_phone_number || 'default_group';

            console.log(`Received message: "${text}" from ${from} in group ${groupId}`);

            try {
                const command = parser.parse(text);

                switch (command.type) {
                    case 'START':
                        await messagingService.sendMessage(from, DarijaMessages.WELCOME);
                        break;

                    case 'MATCH':
                        await createMatch.execute({
                            id: command.id,
                            teamA: command.teamA,
                            teamB: command.teamB,
                            kickoffTime: new Date(command.time)
                        });
                        await messagingService.sendMessage(from, DarijaMessages.MATCH_CREATED(command.teamA, command.teamB));
                        break;

                    case 'PREDICT':
                        await submitPrediction.execute({
                            userId: from,
                            matchId: command.matchId,
                            groupId: groupId,
                            choice: command.choice
                        });
                        await messagingService.sendMessage(from, DarijaMessages.PREDICTION_SAVED);
                        break;

                    case 'RESULT':
                        await submitResult.execute({
                            matchId: command.matchId,
                            result: command.result
                        });
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
                await messagingService.sendMessage(from, error.message);
            }
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

const PORT = process.env.PORT || 8080;
app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(`   Takhmin Bot v1.0.4 - ONLINE`);
    console.log(`   Internal Port: ${PORT}`);
    console.log(`   Database: ${DB_PATH}`);
    console.log(`=========================================`);
});
