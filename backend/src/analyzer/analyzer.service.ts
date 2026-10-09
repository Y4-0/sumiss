import { Injectable } from '@nestjs/common';

export interface AnalyzerConfig {
  names: string[];
  aliases: string[];
  customKeywords: string[];
}

export interface AnalysisResult {
  isMention: boolean;
  score: number;
  tags: string[];
  datesExtracted: string[];
  semanticColor: string;
}

@Injectable()
export class AnalyzerService {
  public async analyzeMessagesBatch(messages: string[], config: AnalyzerConfig): Promise<AnalysisResult[]> {
    if (messages.length === 0) return [];

    const prompt = `
You are a highly intelligent text classification assistant. Analyze the following array of chat messages and return a JSON array of objects exactly matching this structure, with no markdown formatting, no code blocks, just raw JSON array. The length of the output array MUST exactly match the length of the input messages array, in the exact same order.

[
  {
    "isMention": boolean, (true if the message mentions any of these names/aliases: ${config.names.join(', ')}, ${config.aliases.join(', ')})
    "isNoise": boolean, (true if it's just a short acknowledgment like 'ok', 'thanks', 'lol', 'yes')
    "tags": string[], (Only pick from: "Mention", "Scheduling", "Question", "Task", "CustomKeyword". Add "CustomKeyword" if it contains: ${config.customKeywords.join(', ')})
    "datesExtracted": string[], (Any future dates or times mentioned in ISO string format, or empty array)
    "priorityScore": number (Integer. Start at 0. Add 50 for Mention, 30 for Scheduling, 20 for Question, 15 for CustomKeyword. If isNoise is true, score is -100.)
  }
]

Messages to analyze (JSON array):
${JSON.stringify(messages)}
    `.trim();

    try {
      let results = await this.analyzeWithGemini(prompt);
      if (!Array.isArray(results)) {
        console.error("Gemini did not return an array. Returning defaults.");
        return messages.map(() => ({ isMention: false, score: 0, tags: [], datesExtracted: [], semanticColor: '#888888' }));
      }

      return results.map((result: any) => {
        let semanticColor = '#888888';
        if (result.tags?.includes('Mention')) {
          semanticColor = '#EF4444'; // Red
        } else if (result.tags?.includes('Question') || result.tags?.includes('Task') || result.tags?.includes('CustomKeyword')) {
          semanticColor = '#F59E0B'; // Amber
        } else if (result.tags?.includes('Scheduling')) {
          semanticColor = '#10B981'; // Green
        }

        return {
          isMention: result.isMention || false,
          score: result.priorityScore || 0,
          tags: result.tags || [],
          datesExtracted: result.datesExtracted || [],
          semanticColor: semanticColor
        };
      });
    } catch (e: any) {
      console.error(e.message);
      // Fallback for failure
      return messages.map(() => ({ isMention: false, score: 0, tags: [], datesExtracted: [], semanticColor: '#888888' }));
    }
  }

  public async generateSummary(messages: any[]): Promise<string> {
    if (messages.length === 0) return "No messages available to summarize.";

    // Only send the most relevant parts to avoid exceeding token limits
    const chatLog = messages.map(m => `[${new Date(m.timestamp).toLocaleString()}] ${m.sender}: ${m.rawText}`).join('\n');

    const prompt = `
You are an executive assistant analyzing a chat log.
Please provide a concise, human-readable summary of the following chat history. 
Focus strictly on:
1. Priorities of any meetings being held, and if anything is being rescheduled or changed.
2. Important mentions or tasks demanding attention.

Return the summary as plain text (or markdown for readability). Do NOT return JSON.

Chat History:
${chatLog}
    `.trim();

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY is not set in backend/.env');

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!response.ok) {
        throw new Error('Gemini API Error');
      }
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "Failed to generate summary.";
    } catch (e: any) {
      console.error(e.message);
      return "An error occurred while generating the summary.";
    }
  }

  private async analyzeWithGemini(prompt: string) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set in backend/.env');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error('Gemini API Error: ' + JSON.stringify(errorData));
    }
    const data = await response.json();
    let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    // Strip markdown formatting if present
    rawText = rawText.replace(/```json\n?|```/g, '').trim();
    return JSON.parse(rawText);
  }
}
