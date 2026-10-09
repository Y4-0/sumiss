import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { AnalyzerService } from './analyzer/analyzer.service.js';

@Injectable()
export class AppService {
  constructor(
    private prisma: PrismaService,
    private analyzer: AnalyzerService,
  ) { }

  async getMessages() {
    return this.prisma.message.findMany({
      where: { score: { gt: 0 } },
      orderBy: { score: 'desc' },
    });
  }

  async getSummary() {
    const messages = await this.prisma.message.findMany({
      where: { 
        score: { gt: 0 },
        tags: {
          hasSome: ['Scheduling', 'Mention', 'CustomKeyword']
        }
      },
      orderBy: { timestamp: 'asc' }, // Ascending for chronological chat log
    });

    const summaryText = await this.analyzer.generateSummary(messages);
    return { summary: summaryText };
  }

  async deleteSource(sourceName: string) {
    await this.prisma.message.deleteMany({
      where: { sourceName }
    });
    return { success: true };
  }

  async processChat(content: string, sourceName: string) {
    const lines = content.split('\n');
    let currentMessage = '';
    let currentSender = '';
    let currentTimestamp = new Date();

    const lineRegex = /^(?:\[)?(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[aApP][mM])?)(?:\])?\s*[-]?\s*([^:]+):\s*(.*)/;

    const rawMessages: any[] = [];
    const config = {
      names: ['Jane', 'Alex', 'Mike'],
      aliases: ['you'],
      customKeywords: ['deployment', 'bug', 'urgent', 'release'],
    };

    const flushRawMessage = () => {
      if (currentMessage.trim()) {
        rawMessages.push({
          rawText: currentMessage,
          sender: currentSender || 'Unknown',
          timestamp: currentTimestamp,
        });
      }
    };

    for (const line of lines) {
      const match = lineRegex.exec(line);
      if (match) {
        flushRawMessage();
        
        let dateStr = match[1];
        // Convert DD/MM/YYYY to MM/DD/YYYY to prevent "Invalid Date"
        dateStr = dateStr.replace(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/, (m, d, mth, y) => `${mth}/${d}/${y}`);
        
        currentSender = match[2].trim();
        currentMessage = match[3];
        currentTimestamp = new Date(dateStr);
        if (isNaN(currentTimestamp.getTime())) currentTimestamp = new Date();
      } else {
        currentMessage += '\n' + line;
      }
    }
    flushRawMessage();

    // Process messages in chunks to prevent rate limiting but keep it concurrent
    const chunkSize = 10;
    const messagesToSave: any[] = [];
    
    for (let i = 0; i < rawMessages.length; i += chunkSize) {
      const chunk = rawMessages.slice(i, i + chunkSize);
      const analyses = await Promise.all(
        chunk.map(msg => this.analyzer.analyzeMessage(msg.rawText, config))
      );
      
      for (let j = 0; j < chunk.length; j++) {
        const msg = chunk[j];
        const analysis = analyses[j];
        messagesToSave.push({
          rawText: msg.rawText,
          sender: msg.sender,
          timestamp: msg.timestamp,
          isMention: analysis.isMention,
          score: analysis.score,
          tags: analysis.tags,
          semanticColor: analysis.semanticColor,
          sourceName: sourceName,
        });
      }
    }

    if (messagesToSave.length > 0) {
      await this.prisma.message.createMany({ data: messagesToSave });
    }

    return { success: true, count: messagesToSave.length };
  }
}
