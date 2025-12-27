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
}
