export interface MessagingService {
    sendMessage(to: string, text: string): Promise<void>;
}
