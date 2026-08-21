import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Sparkles, Brain, Code, Terminal, Zap, Wifi, WifiOff, Mic, MicOff, Paperclip, X, Image as ImageIcon, FileText, AlertCircle } from 'lucide-react';
import { apiQueue } from '../../shared/apiQueue';
import { usePersistence } from '../../shared/hooks/usePersistence';
import CONFIG from '../../shared/config';
import { VisitLogger } from './components/VisitLogger';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // Changed to string for persistence compatibility
  file?: {
    name: string;
    url: string;
    type: string;
  };
}

interface PageContext {
  title: string;
  url: string;
  selectedText: string;
  metaDescription: string;
  mainContent: string;
}

function App() {
  const [messages, setMessages, isLoaded] = usePersistence<Message[]>('chatHistory', []);
  const [activeAgent] = usePersistence('activeAgent', 'AGENT ALPHA');
  const [language] = usePersistence('language', 'en');
  const [apiEndpoint] = usePersistence('apiEndpoint', CONFIG.API_BASE_URL);
  const [activeFarmerId, setActiveFarmerId] = usePersistence('activeFarmerId', '');
  const [activeTab, setActiveTab] = useState<'chat' | 'log'>('chat');
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queuedRequests, setQueuedRequests] = useState<QueuedRequest[]>([]);
  const [showOfflineManager, setShowOfflineManager] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [isListening, setIsListening] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [farmers, setFarmers] = useState<( { id: string; firstName: string; lastName: string } | null )[]>([]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessageToAI = async (message: string, imageData?: string, pageCtx?: PageContext, fileData?: Record<string, unknown>): Promise<string> => {
    try {
      const payload: any = {
        message,
        mode: 'extension',
        agent: activeAgent,
        language: language,
        farmerId: activeFarmerId
      };

      if (pageCtx) {
        payload.pageContext = {
          title: pageCtx.title,
          url: pageCtx.url,
          selectedText: pageCtx.selectedText
        };
      }

      if (imageData) {
        payload.imageData = imageData;
      }

      if (fileData) {
        payload.file = fileData;
      }

      const response = await apiQueue.makeRequest(`${apiEndpoint}/chatbot/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.queued) {
          return 'Message queued for offline processing. It will be sent when connection is restored.';
        }
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      return data.response || data.message || 'Sorry, I could not process your request.';
    } catch (error) {
      console.error('Error sending message to AI:', error);
      return 'Sorry, I\'m having trouble connecting to the AI service. Please check your connection and try again.';
    }
  };

  const loadQueuedRequests = async () => {
    try {
      const requests = await apiQueue.getQueuedRequests();
      setQueuedRequests(requests);
    } catch (error) {
      console.error('Failed to load queued requests:', error);
    }
  };

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await apiQueue.syncNow();
      await loadQueuedRequests();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiQueue.makeRequest(`${CONFIG.API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
        // Remove content-type to let browser generate boundary
        headers: {}, 
      });

      if (!response.ok) throw new Error('Upload failed');
      const result = await response.json();
      
      if (result.success) {
        setSelectedFile(null); // Clear selection after successful upload preparation
        return result.data;
      }
    } catch (error) {
      console.error('File upload error:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
    return null;
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || isLoading || isUploading) return;

    setIsLoading(true);
    let uploadedFileData = null;

    if (selectedFile) {
      uploadedFileData = await handleFileUpload(selectedFile);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input || (selectedFile ? `Uploaded: ${selectedFile.name}` : ''),
      timestamp: new Date().toISOString(),
      file: uploadedFileData ? {
        name: uploadedFileData.originalName,
        url: uploadedFileData.url,
        type: uploadedFileData.mimetype
      } : undefined
    };

    setMessages((prev: Message[]) => [...prev, userMessage]);
    setInput('');
    setSelectedFile(null);

    try {
      const aiResponse = await sendMessageToAI(
        userMessage.content, 
        undefined, 
        pageContext || undefined,
        uploadedFileData
      );

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date().toISOString()
      };

      setMessages((prev: Message[]) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString()
      };
      setMessages((prev: Message[]) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = (window as { SpeechRecognition: new (...args: any[]) => any }).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language === 'sw' ? 'sw-TZ' : (language === 'fr' ? 'fr-FR' : 'en-US');
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + ' ' + transcript);
    };

    recognition.start();
  };

  const handleQuickAction = async (action: string) => {
    if (isLoading || !pageContext) return;

    const { title, metaDescription, mainContent, url } = pageContext;
    let prompt = '';
    switch (action) {
      case 'Summarize':
        prompt = `Please provide agricultural insights and a summary for this page. Title: ${title}. Key metadata: ${metaDescription}. Content snippet: ${mainContent.substring(0, 1000)}`;
        break;
      case 'Weather':
        prompt = `Based on the agricultural context of this page (${title}), please provide a relevant weather forecast and its impact on crops mentioned. Current URL: ${url}`;
        break;
      case 'Extract Data':
        prompt = `Please extract key agricultural data, facts, and soil/crop information from this page. Title: ${title}. Content: ${mainContent.substring(0, 1000)}`;
        break;
      case 'Analyze Page':
        prompt = `Please analyze this webpage for agricultural relevance and decision support. Title: ${title}. URL: ${url}. Description: ${metaDescription}`;
        break;
      default:
        return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: `${action} request for the current page.`,
      timestamp: new Date().toISOString()
    };

    setMessages((prev: Message[]) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const aiResponse = await sendMessageToAI(prompt);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date().toISOString()
      };
      setMessages((prev: Message[]) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date().toISOString()
      };
      setMessages((prev: Message[]) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Get page context on mount
  useEffect(() => {
    const getPageContext = async () => {
      try {
        // Fetch farmers
        try {
          const fRes = await apiQueue.makeRequest(`${CONFIG.API_BASE_URL}/farmers`);
          if (fRes.ok) {
            const fData = await fRes.json();
            setFarmers(fData.data || []);
          }
        } catch (fErr) {
          console.error('Failed to fetch farmers:', fErr);
        }

        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
          browser.tabs.sendMessage(tab.id, { action: 'get_page_context' }, (response: PageContext) => {
            if (response) {
              setPageContext(response);
              // Only add welcome message if no history
              if (messages.length === 0) {
                const welcomeMessage: Message = {
                  id: 'welcome',
                  role: 'assistant',
                  content: `I've loaded the page "${response.title}". I can help you summarize content, extract data, or analyze this page. What would you like to do?`,
                  timestamp: new Date().toISOString()
                };
                setMessages([welcomeMessage]);
              }
            }
          });
        }
      } catch (error) {
        console.error('Error getting page context:', error);
      }
    };

    getPageContext();
  }, [isLoaded]); // Depend on history being loaded

  // Listen for online status changes and queue updates
  useEffect(() => {
    const handleStatusMessage = (message: any) => {
      if (message.action === 'online_status_changed') {
        setIsOnline(message.isOnline);
      } else if (message.action === 'queue_updated') {
        loadQueuedRequests();
      }
    };

    browser.runtime.onMessage.addListener(handleStatusMessage);
    loadQueuedRequests();
    apiQueue.isCurrentlyOnline().then(setIsOnline);

    return () => {
      browser.runtime.onMessage.removeListener(handleStatusMessage);
    };
  }, []);

  // Listen for messages from background script or popup
  useEffect(() => {
    const browserAPI = browser;
    
    if (browserAPI && browserAPI.runtime) {
      const handlePopupMessage = async (message: { action: string; actionType?: string; text?: string; tab?: any; imageData?: string }) => {
        if (message.action === 'trigger_quick_action') {
          handleQuickAction(message.actionType);
        } else if (message.action === 'analyze_selection' && message.text) {
          const selectionMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: `Analyze this selection: "${message.text}"`,
            timestamp: new Date().toISOString()
          };
          setMessages((prev: Message[]) => [...prev, selectionMessage]);
          setIsLoading(true);
          try {
            const aiResponse = await sendMessageToAI(`Please analyze this text selection: ${message.text}`, undefined, pageContext || undefined);
            const assistantMessage: Message = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: aiResponse,
              timestamp: new Date().toISOString()
            };
            setMessages((prev: Message[]) => [...prev, assistantMessage]);
          } catch (error) {
            console.error('Selection analysis error:', error);
          } finally {
            setIsLoading(false);
          }
        } else if (message.action === 'trigger_capture') {
          // Trigger the 'Analyze Page' quick action as a capture proxy for now
          handleQuickAction('Analyze Page');
        } else if (message.action === 'photo_captured' && message.imageData) {
          const photoMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: '📸 Photo captured - analyzing with AI...',
            timestamp: new Date().toISOString()
          };
          setMessages((prev: Message[]) => [...prev, photoMessage]);

          setIsLoading(true);
          try {
            const aiResponse = await sendMessageToAI('', message.imageData);
            const assistantMessage: Message = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: aiResponse,
              timestamp: new Date().toISOString()
            };
            setMessages((prev: Message[]) => [...prev, assistantMessage]);
          } catch (error) {
            console.error('Photo analysis error:', error);
          } finally {
            setIsLoading(false);
          }
        } else if (message.action === 'switch_sidepanel_tab') {
          if (message.tab === 'log' || message.tab === 'chat') {
            setActiveTab(message.tab);
          }
        }
      };

      browserAPI.runtime.onMessage.addListener(handlePopupMessage);
      return () => browserAPI.runtime.onMessage.removeListener(handlePopupMessage);
    }
  }, [pageContext, isLoaded]); 

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans">
      {/* Header */}
      <header className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
            <img src="/logo.png" alt="GPExts Logo" className="w-7 h-7 object-contain" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight text-white uppercase">GPExts Advisor</h1>
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {isOnline ? 'Online' : 'Offline'} • {activeAgent.split(' ')[1]}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {queuedRequests.length > 0 && (
            <span className="px-2 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full text-[10px] font-bold text-orange-400">
              {queuedRequests.length}
            </span>
          )}
          <button
            onClick={() => setShowOfflineManager(!showOfflineManager)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700"
          >
            {isOnline ? (
              <Wifi className="w-4 h-4 text-slate-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400" />
            )}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900/30">
        <button 
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${activeTab === 'chat' ? 'text-primary-400 border-primary-500 bg-primary-500/5' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
        >
          AI Advisor
        </button>
        <button 
          onClick={() => setActiveTab('log')}
          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${activeTab === 'log' ? 'text-emerald-400 border-emerald-500 bg-emerald-500/5' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
        >
          Visit Logger
        </button>
      </div>

      {/* Farmer Context Selector */}
      <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-800 flex items-center gap-2">
        <User className="w-3 h-3 text-slate-500" />
        <select
          value={activeFarmerId}
          onChange={(e) => setActiveFarmerId(e.target.value)}
          className="flex-1 bg-transparent text-[10px] font-bold text-slate-400 uppercase tracking-widest outline-none cursor-pointer hover:text-white transition-colors"
        >
          <option value="">Select Farmer Context...</option>
          {farmers.map(f => (
            <option key={f.id} value={f.id}>{f.firstName} {f.lastName}</option>
          ))}
        </select>
        {activeFarmerId && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-1 h-1 rounded-full bg-emerald-500" />
            <span className="text-[8px] font-black text-emerald-400 uppercase">Context Active</span>
          </div>
        )}
      </div>

      {/* Messages / Logger */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {activeTab === 'log' ? (
          <VisitLogger farmerId={activeFarmerId} />
        ) : (
          <>
            {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${msg.role === 'assistant'
              ? 'bg-primary-500/10 border-primary-500/20 shadow-lg shadow-primary-500/5'
              : 'bg-secondary-500/10 border-secondary-500/20 shadow-lg shadow-secondary-500/5'
              }`}>
              {msg.role === 'assistant' ? <Bot className="w-4 h-4 text-primary-400" /> : <User className="w-4 h-4 text-secondary-400" />}
            </div>
            <div className="flex flex-col gap-1 max-w-[85%]">
              <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'assistant'
                ? 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                : 'bg-primary-600 border border-primary-500 text-white rounded-tr-none'
                }`}>
                {msg.content}
                {msg.file && (
                  <div className="mt-2 p-2 bg-black/20 rounded-xl border border-white/10 flex items-center gap-2">
                    {msg.file.type.startsWith('image/') ? <ImageIcon className="w-4 h-4 text-primary-300" /> : <FileText className="w-4 h-4 text-primary-300" />}
                    <span className="text-[10px] font-medium truncate">{msg.file.name}</span>
                  </div>
                )}
              </div>
              <span className={`text-[9px] font-medium text-slate-600 px-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary-400 animate-pulse" />
                </div>
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl rounded-tl-none flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}

        {/* Offline Queue Manager */}
        {showOfflineManager && (
          <div className="mb-4 p-4 bg-slate-800/50 border border-slate-700 rounded-lg animate-in slide-in-from-top duration-300">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">Offline Queue</h3>
              <button
                onClick={handleSync}
                disabled={!isOnline || queuedRequests.length === 0 || isSyncing}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white text-xs font-bold rounded transition-colors disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSyncing && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>

            {queuedRequests.length === 0 ? (
              <p className="text-sm text-slate-400 Italics px-1">No pending requests</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {queuedRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded border border-slate-600">
                    <div className="flex-1">
                      <p className="text-xs font-mono text-slate-300">{request.method} {request.url.replace(apiEndpoint, '')}</p>
                      <p className="text-[10px] text-slate-500">
                        {new Date(request.timestamp).toLocaleString()} • {request.retries} retries
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${request.retries > 0 ? 'bg-orange-500' : 'bg-slate-500'}`} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Input Area */}
      <footer className="p-4 bg-slate-900/80 border-t border-slate-800 backdrop-blur-md">
        {selectedFile && (
          <div className="mb-3 p-2 bg-primary-600/20 border border-primary-500/30 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center">
                {selectedFile.type.startsWith('image/') ? <ImageIcon className="w-4 h-4 text-primary-400" /> : <FileText className="w-4 h-4 text-primary-400" />}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white max-w-[180px] truncate">{selectedFile.name}</span>
                <span className="text-[10px] text-slate-400 lowercase">{(selectedFile.size / 1024).toFixed(1)} KB</span>
              </div>
            </div>
            <button onClick={() => setSelectedFile(null)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        )}

        <div className="flex gap-2 mb-3 px-1 overflow-x-auto no-scrollbar">
          {['Summarize', 'Extract Data', 'Analyze Page'].map(tag => (
            <button key={tag} onClick={() => handleQuickAction(tag)} disabled={isLoading || !pageContext} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-[10px] font-black text-slate-400 hover:text-white transition-all uppercase tracking-tighter disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
              {tag}
            </button>
          ))}
        </div>
        
        <div className="flex gap-2 items-center">
          <div className="relative flex-1 group">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isListening ? "Listening..." : "Ask ALFA Core..."}
              className={`w-full bg-slate-950 border focus:border-primary-500 rounded-2xl py-3 pl-4 pr-12 text-sm outline-none transition-all placeholder:text-slate-600 shadow-inner ${isListening ? 'border-primary-500 ring-2 ring-primary-500/20 animate-pulse' : 'border-slate-700'}`}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                onClick={handleVoiceInput}
                className={`p-2 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-slate-500 hover:text-primary-400 hove:bg-slate-800'}`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>
          </div>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])}
            className="hidden" 
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-400 hover:text-white transition-all shadow-lg"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleSend}
            disabled={isLoading || isUploading || (!input.trim() && !selectedFile)}
            className="p-3 bg-primary-600 hover:bg-primary-500 rounded-xl text-white transition-all shadow-lg shadow-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading || isUploading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        
        <p className="mt-2 text-center text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em] flex items-center justify-center gap-1">
          <Sparkles className="w-2.5 h-2.5" /> AG-Extension Intelligence Unit
        </p>
      </footer>
    </div>
  );
}

export default App;
