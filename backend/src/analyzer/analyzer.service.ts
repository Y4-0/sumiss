import { Injectable } from '@nestjs/common';
import * as chrono from 'chrono-node';

export interface AnalyzerConfig {
  username: string;
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
You are an expert AI assistant that extracts important action items and context from chat logs.
Your task is to analyze the following array of chat messages. Aggressively filter out conversational filler, system messages (e.g., "joined using a link"), and casual chatter.

For each message, return a JSON object exactly matching this structure, in the exact same order as the input. The output array MUST have the exact same length as the input array.

[
  {
    "isMention": boolean, (true ONLY if the message explicitly mentions the user '@${config.username}' or addresses them directly. False for general group statements)
    "isNoise": boolean, (true if it's casual chatter, a system message like "joined the group", or a short acknowledgment like 'ok', 'thanks', 'lol', 'yes')
    "tags": string[], (Only pick from: "Mention", "Scheduling", "Question", "Task", "CustomKeyword". Empty array if none apply.)
    "datesExtracted": string[], (Any future dates, deadlines, or times mentioned in ISO string format, or empty array)
    "priorityScore": number (Integer. Start at 0. Add 50 for Mention, 30 for Scheduling, 20 for Question, 15 for Task/CustomKeyword. If isNoise is true, set to -100.)
  }
]

CRITICAL RULES:
- If a message says "X joined using a group link", it is strictly NOISE.
- If it doesn't contain the user's explicit username (${config.username}), it is not a mention.
- Return ONLY the raw JSON array.

Messages to analyze:
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

  public async analyzeMessagesBatchLexical(messages: string[], config: AnalyzerConfig): Promise<AnalysisResult[]> {
    const meetingWords = ["zoom", "meet", "sync", "call", "huddle"];
    const taskWords = ["fix", "review", "deadline", "urgent"];
    const questionWords = ["how", "what", "can you", "where"];
    const noiseWords = ["ok", "thanks", "lol", "yes", "no", "okay", "yep", "sure"];

    return messages.map(msg => {
      let isMention = false;
      let score = 0;
      let tags: string[] = [];
      let datesExtracted: string[] = [];

      const lowerMsg = msg.toLowerCase();

      // Mention check
      if (config.username && lowerMsg.includes(config.username.toLowerCase())) {
        isMention = true;
      }
      
      if (isMention) {
        score += 50;
        tags.push('Mention');
      }

      // Dates (chrono-node)
      const parsedDates = chrono.parse(msg);
      if (parsedDates.length > 0) {
        score += 30;
        tags.push('Scheduling');
        datesExtracted = parsedDates.map((d: any) => d.start.date().toISOString());
      }

      // Question check
      if (msg.includes('?')) {
        for (const w of questionWords) {
          if (lowerMsg.includes(w)) {
            score += 20;
            if (!tags.includes('Question')) tags.push('Question');
            break;
          }
        }
      }

      // Keyword check
      let hasProjectKeyword = false;
      for (const kw of config.customKeywords) {
        if (kw && lowerMsg.includes(kw.toLowerCase())) {
          hasProjectKeyword = true;
          if (!tags.includes('CustomKeyword')) tags.push('CustomKeyword');
        }
      }
      for (const w of meetingWords) {
         if (lowerMsg.includes(w)) {
            hasProjectKeyword = true;
            if (!tags.includes('Scheduling')) tags.push('Scheduling');
         }
      }
      for (const w of taskWords) {
         if (lowerMsg.includes(w)) {
            hasProjectKeyword = true;
            if (!tags.includes('Task')) tags.push('Task');
         }
      }

      if (hasProjectKeyword) {
        score += 15;
      }

      // Noise check
      const alphaOnly = lowerMsg.trim().replace(/[^a-z]/g, '');
      if (noiseWords.includes(alphaOnly)) {
        score = -100;
      }

      let semanticColor = '#888888';
      if (tags.includes('Mention')) {
        semanticColor = '#EF4444'; // Red
      } else if (tags.includes('Question') || tags.includes('Task') || tags.includes('CustomKeyword')) {
        semanticColor = '#F59E0B'; // Amber
      } else if (tags.includes('Scheduling')) {
        semanticColor = '#10B981'; // Green
      }

      return {
        isMention,
        score,
        tags,
        datesExtracted,
        semanticColor
      };
    });
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
