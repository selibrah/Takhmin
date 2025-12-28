import { MessagingService } from '../../application/ports/MessagingService';
import axios from 'axios';

export class WhatsAppMessagingService implements MessagingService {
    constructor(
        private accessToken: string,
        private phoneNumberId: string
    ) { }

    async sendMessage(to: string, text: string): Promise<void> {
        const url = `https://graph.facebook.com/v22.0/${this.phoneNumberId}/messages`;

        try {
            await axios.post(url, {
                messaging_product: 'whatsapp',
                to,
                type: 'text',
                text: { body: text }
            }, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`✅ Message sent successfully to ${to}`);
        } catch (error: any) {
            const errorData = error.response?.data || error.message;
            console.error(`❌ Error sending message to ${to}:`, JSON.stringify(errorData, null, 2));
        }
    }

    async sendPoll(to: string, matchId: string, teamA: string, teamB: string, kickoffTime: string): Promise<string | null> {
        const url = `https://graph.facebook.com/v22.0/${this.phoneNumberId}/messages`;

        try {
            const response = await axios.post(url, {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to,
                type: 'interactive',
                interactive: {
                    type: 'button',
                    body: {
                        text: `⚽️ ${teamA} 🆚 ${teamB}\n⏰ ${kickoffTime}\n\nDir prediction dyalek!`
                    },
                    action: {
                        buttons: [
                            {
                                type: 'reply',
                                reply: {
                                    id: `predict:${matchId}:1`,
                                    title: `🏠 ${teamA.substring(0, 20)}`
                                }
                            },
                            {
                                type: 'reply',
                                reply: {
                                    id: `predict:${matchId}:2`,
                                    title: '🤝 Draw'
                                }
                            },
                            {
                                type: 'reply',
                                reply: {
                                    id: `predict:${matchId}:3`,
                                    title: `✈️ ${teamB.substring(0, 20)}`
                                }
                            }
                        ]
                    }
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`✅ Interactive poll sent to ${to} for ${matchId}`);
            return response.data.messages?.[0]?.id || null;
        } catch (error: any) {
            const errorData = error.response?.data || error.message;
            console.error(`❌ Error sending poll to ${to}:`, JSON.stringify(errorData, null, 2));
            return null;
        }
    }

    async sendQuickActions(to: string): Promise<void> {
        const url = `https://graph.facebook.com/v22.0/${this.phoneNumberId}/messages`;

        try {
            await axios.post(url, {
                messaging_product: 'whatsapp',
                to,
                type: 'interactive',
                interactive: {
                    type: 'button',
                    body: { text: 'Quick actions:' },
                    action: {
                        buttons: [
                            {
                                type: 'reply',
                                reply: { id: 'action:matches', title: '📋 Matches' }
                            },
                            {
                                type: 'reply',
                                reply: { id: 'action:score', title: '🏆 Score' }
                            },
                            {
                                type: 'reply',
                                reply: { id: 'action:help', title: 'ℹ️ Help' }
                            }
                        ]
                    }
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`✅ Quick actions sent to ${to}`);
        } catch (error: any) {
            console.error(`❌ Failed to send quick actions:`, error.response?.data || error.message);
        }
    }
}
