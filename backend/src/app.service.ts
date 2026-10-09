import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { AnalyzerService } from './analyzer/analyzer.service.js';

@Injectable()
export class AppService {
  constructor(
    private prisma: PrismaService,
    private analyzer: AnalyzerService,
  ) {}

  async getMessages() {
    return this.prisma.message.findMany({
      where: { score: { gt: 0 } },
      orderBy: { score: 'desc' },
    });
  }

  async deleteSource(sourceName: string) {
    await this.prisma.message.deleteMany({
      where: { sourceName }
    });
    return { success: true };
  }

  async processChat(content: string, sourceName: string, engine: string) {
    const lines = content.split('\n');
    let currentMessage = '';
    let currentSender = '';
    let currentTimestamp = new Date();

    const lineRegex = /^(?:\[)?(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[aApP][mM])?)(?:\])?\s*[-]?\s*([^:]+):\s*(.*)/;

    const messagesToSave: any[] = [];
    const config = {
      names: ['Jane', 'Alex', 'Mike'],
      aliases: ['you'],
      customKeywords: ['deployment', 'bug', 'urgent', 'release'],
    };

    const flushMessage = async () => {
      if (currentMessage.trim()) {
        const analysis = await this.analyzer.analyzeMessage(currentMessage, config, engine);
        messagesToSave.push({
          rawText: currentMessage,
          sender: currentSender || 'Unknown',
          timestamp: currentTimestamp,
          isMention: analysis.isMention,
          score: analysis.score,
          tags: analysis.tags,
          semanticColor: analysis.semanticColor,
          sourceName: sourceName,
        });
      }
    };

    for (const line of lines) {
      const match = lineRegex.exec(line);
      if (match) {
        await flushMessage();
        
        const dateStr = match[1];
        currentSender = match[2].trim();
        currentMessage = match[3];
        currentTimestamp = new Date(dateStr);
        if (isNaN(currentTimestamp.getTime())) currentTimestamp = new Date();
      } else {
        currentMessage += '\n' + line;
      }
    }
    await flushMessage();

    for (const msg of messagesToSave) {
       await this.prisma.message.create({ data: msg });
    }

    return { success: true, count: messagesToSave.length };
  }
}
