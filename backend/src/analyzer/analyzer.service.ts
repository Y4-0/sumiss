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
  public async analyzeMessage(rawText: string, config: AnalyzerConfig, engine: string): Promise<AnalysisResult> {
    if (rawText.trim().length === 0) {
      return { isMention: false, score: -100, tags: [], datesExtracted: [], semanticColor: '#888888' };
    }

    const prompt = `
You are a highly intelligent text classification assistant. Analyze the following chat message and return a JSON object exactly matching this structure, with no markdown formatting, no code blocks, just raw JSON.

{
  "isMention": boolean, (true if the message mentions any of these names/aliases: ${config.names.join(', ')}, ${config.aliases.join(', ')})
  "isNoise": boolean, (true if it's just a short acknowledgment like 'ok', 'thanks', 'lol', 'yes')
  "tags": string[], (Only pick from: "Mention", "Scheduling", "Question", "Task", "CustomKeyword". Add "CustomKeyword" if it contains: ${config.customKeywords.join(', ')})
  "datesExtracted": string[], (Any future dates or times mentioned in ISO string format, or empty array)
  "priorityScore": number (Integer. Start at 0. Add 50 for Mention, 30 for Scheduling, 20 for Question, 15 for CustomKeyword. If isNoise is true, score is -100.)
}

Message to analyze:
"${rawText}"
    `.trim();

    try {
      let result;
      if (engine === 'gemini') {
        result = await this.analyzeWithGemini(prompt);
      } else {
        result = await this.analyzeWithOllama(prompt);
      }

      // Resolve Semantic Color based on prioritized tags
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
    } catch (e) {
      console.error(e.message);
      // Fallback for failure
      return { isMention: false, score: 0, tags: [], datesExtracted: [], semanticColor: '#888888' };
    }
  }

  private async analyzeWithOllama(prompt: string) {
    const ollamaModel = process.env.OLLAMA_MODEL || 'qwen3.5:9b';
    const response = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        prompt: prompt,
        stream: false,
        format: 'json'
      })
    });
    if (!response.ok) throw new Error('Ollama connection failed');
    const data = await response.json();
    return JSON.parse(data.response);
  }

  private async analyzeWithGemini(prompt: string) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set in backend/.env');
    
    const response = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=\${apiKey}\`, {
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
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return JSON.parse(rawText);
  }
}
