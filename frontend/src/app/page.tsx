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
  const [aiEngine, setAiEngine] = useState('ollama'); // 'ollama' | 'gemini'
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

  useEffect(() => {
    fetchMessages();
  }, []);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(`Uploading and parsing ${file.name} with ${aiEngine === 'gemini' ? 'Gemini API' : 'Local Ollama'}... This might take a minute depending on the file size.`);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('engine', aiEngine);

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

  const removeSource = async (sourceName: string) => {
    if (!confirm(`Are you sure you want to remove all chats from ${sourceName}?`)) return;
    
    try {
      await fetch(`http://localhost:4000/sources/${encodeURIComponent(sourceName)}`, {
        method: 'DELETE'
      });
      await fetchMessages();
    } catch (e) {
      console.error("Failed to remove source", e);
    }
  };

  const filteredMessages = messages.filter((msg) => {
    if (activeFilter === 'Inbox') return true;
    if (activeFilter === 'Mentions') return msg.tags.includes('Mention');
    if (activeFilter === 'Meetings') return msg.tags.includes('Scheduling');
    if (activeFilter === 'Questions') return msg.tags.includes('Question') || msg.tags.includes('Task');
    return true;
  });

  const getFilterCounts = () => {
    return {
      Inbox: messages.length,
      Mentions: messages.filter(m => m.tags.includes('Mention')).length,
      Meetings: messages.filter(m => m.tags.includes('Scheduling')).length,
      Questions: messages.filter(m => m.tags.includes('Question') || m.tags.includes('Task')).length,
    }
  };
  const counts = getFilterCounts();

  return (
    <div className="flex h-screen w-full bg-[var(--background)] text-[var(--foreground)] font-sans overflow-hidden">
      
      {/* LOADING OVERLAY */}
      {isUploading && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[var(--surface)] p-8 rounded-xl shadow-2xl max-w-sm text-center border border-[#333]">
            <div className="w-16 h-16 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <h3 className="text-xl font-bold mb-3">Analyzing Chat...</h3>
            <p className="text-sm text-[var(--muted)] leading-relaxed">{uploadStatus}</p>
          </div>
        </div>
      )}

      {/* LEFT PANE */}
      <aside className="w-64 border-r border-[#333] flex flex-col p-4 space-y-6">
        <div>
          <h2 className="text-xl font-bold mb-4 tracking-tight">Sumiss</h2>
          
          {/* AI ENGINE TOGGLE */}
          <div className="bg-[#1a1a1a] p-1 rounded-md flex mb-4 text-xs font-semibold">
            <button
              onClick={() => setAiEngine('ollama')}
              className={`flex-1 py-1.5 rounded transition-colors ${aiEngine === 'ollama' ? 'bg-[var(--accent)] text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Local (Ollama)
            </button>
            <button
              onClick={() => setAiEngine('gemini')}
              className={`flex-1 py-1.5 rounded transition-colors ${aiEngine === 'gemini' ? 'bg-[var(--accent)] text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Gemini API
            </button>
          </div>

          <input type="file" ref={fileInputRef} className="hidden" accept=".txt" onChange={handleFileChange} />
          <button 
            onClick={handleUploadClick}
            disabled={isUploading}
            className="w-full bg-[var(--surface)] hover:bg-[#333] border border-[#333] text-white py-2 rounded-md font-medium transition-colors disabled:opacity-50"
          >
            + Upload Export
          </button>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">Smart Views</h3>
          <ul className="space-y-1">
            {['Inbox', 'Mentions', 'Meetings', 'Questions'].map((filter) => (
              <li 
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-3 py-2 rounded-md cursor-pointer text-sm font-medium transition-colors flex justify-between ${
                  activeFilter === filter 
                    ? 'bg-[var(--surface)] text-white' 
                    : 'hover:bg-[var(--surface)] text-[var(--muted)] hover:text-white'
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
            <ul className="space-y-1">
              {sources.map(src => (
                <li key={src} className="flex justify-between items-center px-3 py-2 bg-[var(--surface)] rounded-md text-sm text-gray-300 group">
                  <span className="truncate" title={src}>{src}</span>
                  <button 
                    onClick={() => removeSource(src)}
                    className="text-[var(--muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove source"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                  </button>
                </li>
              ))}
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
            
            let bgClass = 'bg-[#888888]/20 text-[#888888]';
            let borderClass = 'border-[#888888]';
            if (msg.semanticColor === '#EF4444') { bgClass = 'bg-[#EF4444]/20 text-[#EF4444]'; borderClass = 'border-[#EF4444]'; }
            if (msg.semanticColor === '#F59E0B') { bgClass = 'bg-[#F59E0B]/20 text-[#F59E0B]'; borderClass = 'border-[#F59E0B]'; }
            if (msg.semanticColor === '#10B981') { bgClass = 'bg-[#10B981]/20 text-[#10B981]'; borderClass = 'border-[#10B981]'; }

            return (
              <div key={msg.id} className={`bg-[var(--surface)] rounded-lg p-4 border-l-4 ${borderClass} shadow-sm transition-transform hover:-translate-y-0.5`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold">{senderInitials}</div>
                    <div>
                      <h4 className="text-sm font-semibold">{msg.sender}</h4>
                      <p className="text-xs text-[var(--muted)]">{dateStr}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {msg.tags.map((tag: string) => (
                       <span key={tag} className={`px-2 py-1 text-[10px] uppercase font-bold rounded ${bgClass}`}>
                         {tag}
                       </span>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-gray-300 mb-4 mt-2">{msg.rawText}</p>
                <div className="flex justify-between items-center">
                  <div className="flex space-x-3">
                    <button className="text-xs text-[var(--accent)] font-medium hover:underline">Mark Resolved</button>
                    <button className="text-xs text-[var(--muted)] hover:text-white">Snooze</button>
                    <button className="text-xs text-[var(--muted)] hover:text-white">View Context</button>
                  </div>
                  <span className="text-[10px] text-[var(--muted)] font-mono">Score: {msg.score}</span>
                </div>
              </div>
            );
          })}

        </div>
      </main>

      {/* RIGHT PANE: Placeholder for now */}
      <aside className="w-80 flex flex-col p-6 space-y-6 overflow-y-auto">
        <div>
          <h3 className="text-sm font-bold mb-3 border-b border-[#333] pb-2">Context Viewer</h3>
          <p className="text-xs text-[var(--muted)]">Select a message to view context.</p>
        </div>
      </aside>

    </div>
  );
}
