'use client';

import React, { useState, useEffect, useRef } from 'react';

type Message = {
  id: string;
  sender: string;
  timestamp: string;
  rawText: string;
  tags: string[];
  semanticColor: string;
  score: number;
  sourceName?: string;
};

export default function Dashboard() {
  const [activeFilter, setActiveFilter] = useState('Inbox');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [engine, setEngine] = useState('gemini');
  const [username, setUsername] = useState('you');
  const [geminiQuota, setGeminiQuota] = useState(20);
  const [sourceEngines, setSourceEngines] = useState<Record<string, string>>({});
  const [resetTimer, setResetTimer] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derive unique sources from messages
  const sources = Array.from(new Set(messages.map(m => m.sourceName).filter(Boolean))) as string[];

  const fetchMessages = async () => {
    try {
      const res = await fetch('http://localhost:4000/messages');
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (e) {
      console.error("Failed to fetch messages", e);
    }
  };

  const fetchSummary = async () => {
    try {
      setIsGeneratingSummary(true);
      const res = await fetch('http://localhost:4000/summary');
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
      }
    } catch (e) {
      console.error("Failed to fetch summary", e);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    fetchSummary();

    const updateTimer = () => {
      const now = new Date();
      const laTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
      const nextMidnight = new Date(laTime);
      nextMidnight.setHours(24, 0, 0, 0);
      
      const diff = nextMidnight.getTime() - laTime.getTime();
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      
      setResetTimer(`${h}h ${m}m ${s}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(`Uploading ${file.name}...`);

    const formData = new FormData();
    formData.append('file', file);

    try {
      await fetch('http://localhost:4000/upload', {
        method: 'POST',
        body: formData,
      });
      await fetchMessages();
    } catch (e) {
      console.error("Upload failed", e);
      alert("Upload failed. Ensure the backend is running.");
    } finally {
      setIsUploading(false);
      setUploadStatus('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAnalyzeSource = async (sourceName: string) => {
    setIsUploading(true);
    setUploadStatus(`Analyzing ${sourceName} using ${engine === 'gemini' ? 'Gemini AI' : 'Lexical'}...`);

    try {
      const res = await fetch('http://localhost:4000/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceName, engine, username })
      });
      const data = await res.json();
      if (data.geminiRequestsUsed) {
        setGeminiQuota(prev => Math.max(0, prev - data.geminiRequestsUsed));
      }
      setSourceEngines(prev => ({...prev, [sourceName]: engine}));
      await fetchMessages();
      await fetchSummary();
    } catch (e) {
      console.error("Analysis failed", e);
      alert("Analysis failed.");
    } finally {
      setIsUploading(false);
      setUploadStatus('');
    }
  };

  const removeSource = async (sourceName: string) => {
    if (!confirm(`Are you sure you want to remove all chats from ${sourceName}?`)) return;

    try {
      await fetch(`http://localhost:4000/sources/${encodeURIComponent(sourceName)}`, {
        method: 'DELETE'
      });
      await fetchMessages();
      await fetchSummary();
    } catch (e) {
      console.error("Failed to remove source", e);
    }
  };

  const analyzedMessages = messages.filter(m => m.score !== -999 && m.score > 0);

  const filteredMessages = analyzedMessages.filter((msg) => {
    if (activeFilter === 'Inbox') return true;
    if (activeFilter === 'Mentions') return msg.tags.includes('Mention');
    if (activeFilter === 'Meetings') return msg.tags.includes('Scheduling');
    if (activeFilter === 'Questions') return msg.tags.includes('Question') || msg.tags.includes('Task');
    return true;
  });

  const getFilterCounts = () => {
    return {
      Inbox: analyzedMessages.length,
      Mentions: analyzedMessages.filter(m => m.tags.includes('Mention')).length,
      Meetings: analyzedMessages.filter(m => m.tags.includes('Scheduling')).length,
      Questions: analyzedMessages.filter(m => m.tags.includes('Question') || m.tags.includes('Task')).length,
    }
  };
  const counts = getFilterCounts();

  return (
    <div className="flex h-screen w-full bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] text-[#ededed] font-sans overflow-hidden">

      {/* LOADING OVERLAY */}
      {isUploading && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 transition-opacity duration-300">
          <div className="bg-[#1c1c1e]/80 backdrop-blur-xl p-10 rounded-2xl shadow-2xl max-w-sm text-center border border-white/10 transform transition-all scale-105">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <h3 className="text-xl font-extrabold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Analyzing Chat...</h3>
            <p className="text-sm text-gray-400 leading-relaxed font-medium">{uploadStatus}</p>
          </div>
        </div>
      )}

      {/* LEFT PANE */}
      <aside className="w-72 border-r border-white/5 bg-black/20 backdrop-blur-md flex flex-col p-6 space-y-8 shadow-xl z-10">
        <div>
          <h2 className="text-xl font-bold mb-4 tracking-tight">Sumiss</h2>

          <input type="file" ref={fileInputRef} className="hidden" accept=".txt" onChange={handleFileChange} />
          <button
            onClick={handleUploadClick}
            disabled={isUploading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-2.5 rounded-lg font-bold shadow-lg shadow-blue-500/20 transition-all duration-300 hover:shadow-blue-500/40 hover:-translate-y-0.5 disabled:opacity-50 mb-4"
          >
            + Upload Export
          </button>

          <div className="bg-black/40 rounded-lg p-3 border border-white/5 shadow-inner mb-4">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Your Username</h3>
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              className="w-full bg-[#1a1a1a] border border-white/10 rounded-md px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-500 transition-colors" 
              placeholder="e.g. John" 
            />
            <p className="text-[9px] text-gray-500 mt-1.5">Required for tracking @mentions.</p>
          </div>
        </div>

        <div className="bg-black/40 rounded-lg p-3 border border-white/5 shadow-inner">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Analysis Engine</h3>
          <div className="flex space-x-2">
            <button 
              onClick={() => setEngine('gemini')} 
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${engine === 'gemini' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.2)]' : 'bg-transparent text-gray-500 hover:text-gray-300 border border-transparent'}`}
            >
              Gemini AI
            </button>
            <button 
              onClick={() => setEngine('lexical')} 
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${engine === 'lexical' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-transparent text-gray-500 hover:text-gray-300 border border-transparent'}`}
            >
              Lexical (Local)
            </button>
          </div>
          {engine === 'gemini' && (
            <div className="mt-3 pt-3 border-t border-white/5 animate-in fade-in zoom-in duration-300">
               <div className="flex justify-between items-center text-xs mb-1.5">
                 <span className="text-gray-400 font-medium">Daily API Quota</span>
                 <span className={`font-bold ${geminiQuota > 5 ? 'text-indigo-400' : 'text-red-400'}`}>{geminiQuota} / 20 reqs</span>
               </div>
               <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                 <div className={`h-1.5 rounded-full transition-all duration-500 ${geminiQuota > 5 ? 'bg-gradient-to-r from-blue-500 to-indigo-500' : 'bg-red-500'}`} style={{ width: `${(geminiQuota / 20) * 100}%` }}></div>
               </div>
               <p className="text-[9px] text-gray-400 mt-1.5 text-right font-medium">Resets in <span className="font-mono text-indigo-400 font-bold">{resetTimer}</span></p>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3">Smart Views</h3>
          <ul className="space-y-1.5">
            {['Inbox', 'Mentions', 'Meetings', 'Questions'].map((filter) => (
              <li
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-4 py-2.5 rounded-lg cursor-pointer text-sm font-semibold transition-all duration-200 flex justify-between items-center ${activeFilter === filter
                    ? 'bg-white/10 text-white shadow-inner border border-white/5'
                    : 'hover:bg-white/5 text-gray-400 hover:text-white'
                  }`}
              >
                <span>{filter}</span> <span className="text-[var(--muted)]">{counts[filter as keyof typeof counts]}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">Chat Sources</h3>
          {sources.length === 0 ? (
            <div className="text-center text-[var(--muted)] text-sm py-4 border border-dashed border-[#333] rounded-md">
              Add a source to get started!
            </div>
          ) : (
            <ul className="space-y-2">
              {sources.map(src => {
                const hasUnanalyzed = messages.some(m => m.sourceName === src && m.score === -999);
                const lastEngine = sourceEngines[src];
                const needsAnalysis = hasUnanalyzed || lastEngine !== engine;
                
                return (
                  <li key={src} className="flex flex-col px-3 py-2.5 bg-[#1a1a1a] rounded-md group border border-white/5 hover:border-white/10 transition-colors">
                    <div className="flex justify-between items-center text-sm text-gray-300">
                      <span className="truncate font-medium" title={src}>{src}</span>
                      <button
                        onClick={() => removeSource(src)}
                        className="text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0"
                        title="Remove source"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                      </button>
                    </div>
                    {needsAnalysis ? (
                      <div className="mt-2.5 flex justify-between items-center">
                        <span className="text-[10px] text-gray-500 font-bold tracking-wide">
                          {hasUnanalyzed ? 'Ready for analysis' : 'Ready for re-analysis'}
                        </span>
                        <button 
                          onClick={() => handleAnalyzeSource(src)} 
                          disabled={isUploading || (engine === 'gemini' && geminiQuota <= 0)}
                          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[10px] uppercase font-bold py-1 px-3 rounded shadow-lg disabled:opacity-50 transition-colors"
                        >
                          {hasUnanalyzed ? 'Analyze' : 'Re-analyze'}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2.5 flex justify-between items-center">
                        <span className="text-[10px] text-emerald-500/80 font-bold tracking-wide flex items-center">
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                          Analyzed with {engine}
                        </span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* CENTER PANE */}
      <main className="flex-1 flex flex-col border-r border-[#333]">
        <header className="h-14 border-b border-[#333] flex items-center px-6">
          <h1 className="text-lg font-semibold">{activeFilter}</h1>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {filteredMessages.length === 0 && (
            <div className="text-center text-[var(--muted)] mt-10">
              {sources.length === 0 ? "No chat history uploaded yet." : `No messages found in ${activeFilter}.`}
            </div>
          )}

          {filteredMessages.map((msg) => {
            const dateStr = new Date(msg.timestamp).toLocaleString();
            const senderInitials = msg.sender ? msg.sender.substring(0, 2).toUpperCase() : '??';

            let bgClass = 'bg-white/5 text-gray-300';
            let borderClass = 'border-white/10';
            let tagBg = 'bg-gray-800 text-gray-300';
            
            if (msg.semanticColor === '#EF4444') { bgClass = 'bg-red-500/10 text-red-50'; borderClass = 'border-red-500/50'; tagBg = 'bg-red-500/20 text-red-400 border border-red-500/20'; }
            if (msg.semanticColor === '#F59E0B') { bgClass = 'bg-amber-500/10 text-amber-50'; borderClass = 'border-amber-500/50'; tagBg = 'bg-amber-500/20 text-amber-400 border border-amber-500/20'; }
            if (msg.semanticColor === '#10B981') { bgClass = 'bg-emerald-500/10 text-emerald-50'; borderClass = 'border-emerald-500/50'; tagBg = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'; }

            return (
              <div key={msg.id} className={`rounded-xl p-5 border-l-4 ${borderClass} ${bgClass} shadow-md backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-sm font-bold shadow-inner ring-1 ring-white/10">{senderInitials}</div>
                    <div>
                      <h4 className="text-sm font-bold tracking-wide">{msg.sender}</h4>
                      <p className="text-xs text-gray-400 font-medium mt-0.5">{dateStr}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2 flex-wrap justify-end gap-y-1">
                    {msg.tags.map((tag: string) => (
                      <span key={tag} className={`px-2.5 py-1 text-[10px] uppercase font-extrabold rounded-md shadow-sm ${tagBg}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-sm leading-relaxed mb-4 mt-2 font-medium">{msg.rawText}</p>
                <div className="flex justify-between items-center opacity-70 group-hover:opacity-100 transition-opacity">
                  <div className="flex space-x-4">
                    <button className="text-xs text-blue-400 font-bold hover:text-blue-300 transition-colors">Mark Resolved</button>
                    <button className="text-xs text-gray-400 hover:text-white transition-colors">Snooze</button>
                  </div>
                  <span className="text-[10px] text-gray-500 font-mono font-bold bg-black/20 px-2 py-1 rounded">Score: {msg.score}</span>
                </div>
              </div>
            );
          })}

        </div>
      </main>

      {/* RIGHT PANE: Smart Summary */}
      <aside className="w-96 flex flex-col p-6 space-y-6 overflow-y-auto bg-black/20 backdrop-blur-md border-l border-white/5 shadow-xl z-10">
        <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-5 shadow-lg backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <h3 className="text-sm font-extrabold tracking-wide mb-3 flex items-center text-indigo-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            Executive Summary
          </h3>
          
          <div className="text-sm text-gray-300 leading-relaxed font-medium">
            {isGeneratingSummary ? (
              <div className="flex items-center space-x-2 animate-pulse text-indigo-300">
                <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
                <div className="w-2 h-2 bg-indigo-400 rounded-full animation-delay-200"></div>
                <div className="w-2 h-2 bg-indigo-400 rounded-full animation-delay-400"></div>
                <span className="ml-2">Analyzing discussions...</span>
              </div>
            ) : summary ? (
              <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap">
                {summary}
              </div>
            ) : (
               <p className="text-gray-500 italic">No summary available. Upload a chat export to generate insights.</p>
            )}
          </div>
        </div>
      </aside>

    </div>
  );
}
