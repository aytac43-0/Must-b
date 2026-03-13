import fetch from 'node-fetch';

export interface TelegramSendParams {
  botToken: string;
  chatId: string | number;
  text: string;
  parseMode?: 'MarkdownV2' | 'HTML' | 'Markdown';
  disableWebPagePreview?: boolean;
}

export class TelegramTools {
  private API = 'https://api.telegram.org/bot';

  async sendMessage(params: TelegramSendParams): Promise<any> {
    if (!params.botToken) throw new Error('Telegram bot token missing');
    if (!params.chatId) throw new Error('Telegram chatId missing');
    if (!params.text) throw new Error('Telegram text missing');

    const url = `${this.API}${params.botToken}/sendMessage`;
    const body: any = {
      chat_id: params.chatId,
      text: params.text,
      parse_mode: params.parseMode,
      disable_web_page_preview: params.disableWebPagePreview
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Telegram API error: ${err}`);
    }
    return res.json();
  }
}
