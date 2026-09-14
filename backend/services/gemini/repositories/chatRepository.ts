/**
 * @file chatRepository.ts
 * @description Persistence boundary for Chat Messages and AI Interactions.
 * Conforms to APP_ARCHITECTURE_SPEC Section 20 & < 200 lines.
 */

export interface ChatMessageRecord {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
}

export class ChatRepository {
  private messages: ChatMessageRecord[] = [];

  public async recordMessage(role: 'user' | 'model' | 'system', content: string): Promise<ChatMessageRecord> {
    const record: ChatMessageRecord = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      role,
      content,
      timestamp: Date.now(),
    };
    this.messages.push(record);
    return record;
  }

  public async getHistory(limit: number = 50): Promise<ChatMessageRecord[]> {
    return this.messages.slice(-limit);
  }

  public async clear(): Promise<void> {
    this.messages = [];
  }
}

export const chatRepository = new ChatRepository();
