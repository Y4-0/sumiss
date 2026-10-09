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
      orderBy: { timestamp: 'desc' },
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

  async processChat(content: string, sourceName: string, engine?: string) {
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

    // Decoupled upload: just save parsed messages as unanalyzed (-999)
    const messagesToSave: any[] = [];
    
    for (const msg of rawMessages) {
      messagesToSave.push({
        rawText: msg.rawText,
        sender: msg.sender,
        timestamp: msg.timestamp,
        isMention: false,
        score: -999, // Marks it as unanalyzed
        tags: [],
        semanticColor: '#333333',
        sourceName: sourceName,
      });
    }

    if (messagesToSave.length > 0) {
      await this.prisma.message.createMany({ data: messagesToSave });
    }

    return { 
      success: true, 
      count: messagesToSave.length,
      sourceName
    };
  }

  async analyzeSource(sourceName: string, engine: string, username: string) {
    const unanalyzed = await this.prisma.message.findMany({
      where: { sourceName },
      orderBy: { timestamp: 'asc' }
    });

    if (unanalyzed.length === 0) {
      return { success: true, count: 0, geminiRequestsUsed: 0 };
    }

    const config = {
      username: username || 'you',
      customKeywords: ['deployment', 'bug', 'urgent', 'release'],
    };

    const chunkSize = 100;
    let requestsUsed = 0;
    
    // We update each chunk sequentially
    for (let i = 0; i < unanalyzed.length; i += chunkSize) {
      const chunk = unanalyzed.slice(i, i + chunkSize);
      let analyses;
      
      if (engine === 'lexical') {
        analyses = await this.analyzer.analyzeMessagesBatchLexical(chunk.map(msg => msg.rawText), config);
      } else {
        analyses = await this.analyzer.analyzeMessagesBatch(chunk.map(msg => msg.rawText), config);
        requestsUsed++;
      }
      
      // Update DB
      for (let j = 0; j < chunk.length; j++) {
        const msg = chunk[j];
        const analysis = analyses[j] || { isMention: false, score: 0, tags: [], datesExtracted: [], semanticColor: '#888888' };
        
        await this.prisma.message.update({
          where: { id: msg.id },
          data: {
            isMention: analysis.isMention,
            score: analysis.score,
            tags: analysis.tags,
            semanticColor: analysis.semanticColor
          }
        });
      }
    }

    return { 
      success: true, 
      count: unanalyzed.length,
      geminiRequestsUsed: requestsUsed
    };
  }
}
