import React, { useState, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Brain, Code, Terminal, Zap, Wifi, WifiOff } from 'lucide-react';
import { apiQueue } from '../../shared/apiQueue';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface PageContext {
  title: string;
  url: string;
  selectedText: string;
  metaDescription: string;
  mainContent: string;
}

// API configuration - should be configurable
const API_BASE_URL = 'http://localhost:3001/api'; // Adjust based on your backend URL

async function sendLocationToBackend(location: { latitude: number; longitude: number; accuracy: number; accuracyStatus: string; timestamp: string }): Promise<{ success: boolean; message: string }> {
  try {
    const response = await apiQueue.makeRequest(`${API_BASE_URL}/visits/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add authorization if needed
        // 'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(location)
    });

    if (!response.ok) {
      // Check if it's a queued response
      const data = await response.json();
      if (data.queued) {
        return { success: true, message: 'Location queued for offline sync' };
      }
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, message: data.data?.message || 'Location logged successfully' };
  } catch (error) {
    console.error('Error sending location to backend:', error);
    return { success: false, message: 'Failed to log location to backend' };
  }
}

async function sendMessageToAI(message: string, imageData?: string, pageContext?: PageContext): Promise<string> {
  try {
    const payload: any = {
      message,
      mode: 'extension',

      language: 'en' // Could be configurable
    };

    if (pageContext) {
      payload.pageContext = {
        title: pageContext.title,
        url: pageContext.url,
        selectedText: pageContext.selectedText
      };
    }

    if (imageData) {
      payload.imageData = imageData;
      payload.message = `Please analyze this agricultural image: ${message || 'Identify any plants, diseases, or agricultural features in this photo.'}`;
    }

    const response = await apiQueue.makeRequest(`${API_BASE_URL}/chatbot/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add authorization if needed
        // 'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      // Check if it's a queued response
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
}
interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  timestamp: number;
  retries: number;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queuedRequests, setQueuedRequests] = useState<QueuedRequest[]>([]);
  const [showOfflineManager, setShowOfflineManager] = useState(false);

  // Handlers defined first to avoid use-before-definition issues in effects
  const loadQueuedRequests = async () => {
    try {
      const requests = await apiQueue.getQueuedRequests();
      setQueuedRequests(requests);
    } catch (error) {
      console.error('Failed to load queued requests:', error);
    }
  };

  const handleSync = async () => {
    try {
      await apiQueue.syncNow();
      await loadQueuedRequests();
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages((prev: Message[]) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const aiResponse = await sendMessageToAI(input, undefined, pageContext || undefined);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      };

      setMessages((prev: Message[]) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages((prev: Message[]) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = async (action: string) => {
    if (isLoading || !pageContext) return;

    let prompt = '';
    switch (action) {
      case 'Summarize':
        prompt = `Please summarize the content of this page. Title: ${pageContext.title}. Description: ${pageContext.metaDescription}. Main content: ${pageContext.mainContent}`;
        break;
      case 'Extract Data':
        prompt = `Please extract key data, facts, and information from this page. Title: ${pageContext.title}. Description: ${pageContext.metaDescription}. Main content: ${pageContext.mainContent}`;
        break;
      case 'Analyze Page':
        prompt = `Please analyze this webpage for agricultural relevance. Title: ${pageContext.title}. URL: ${pageContext.url}. Description: ${pageContext.metaDescription}. Main content: ${pageContext.mainContent}`;
        break;
      case 'Weather':
        prompt = "Provide a detailed weather forecast and agricultural implications for the current region.";
        break;
      case 'Settings':
        prompt = "Open extension settings and configuration options.";
        break;
      default:
        return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: `${action} request for the current page.`,
      timestamp: new Date()
    };

    setMessages((prev: Message[]) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const aiResponse = await sendMessageToAI(prompt);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      };
      setMessages((prev: Message[]) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date()
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
        const browserAPI = (window as any).browser || (window as any).chrome;
        if (browserAPI && browserAPI.tabs) {
          const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
          if (tab && tab.id) {
            browserAPI.tabs.sendMessage(tab.id, { action: 'get_page_context' }, (response: PageContext) => {
              if (response) {
                setPageContext(response);
                const welcomeMessage: Message = {
                  id: 'welcome',
                  role: 'assistant',
                  content: `I've loaded the page "${response.title}". I can help you summarize content, extract data, or analyze this page. What would you like to do?`,
                  timestamp: new Date()
                };
                setMessages([welcomeMessage]);
              }
            });
          }
        }
      } catch (error) {
        console.error('Error getting page context:', error);
      }
    };

    getPageContext();
  }, []);

  // Listen for online status changes and queue updates
  useEffect(() => {
    const browserAPI = (window as any).browser || (window as any).chrome;
    if (browserAPI && browserAPI.runtime) {
      const handleStatusMessage = (message: any) => {
        if (message.action === 'online_status_changed') {
          setIsOnline(message.isOnline);
        } else if (message.action === 'queue_updated') {
          loadQueuedRequests();
        }
      };

      browserAPI.runtime.onMessage.addListener(handleStatusMessage);
      loadQueuedRequests();
      apiQueue.isCurrentlyOnline().then(setIsOnline);

      return () => {
        browserAPI.runtime.onMessage.removeListener(handleStatusMessage);
      };
    }
  }, []);

  // Listen for messages from background script or popup
  useEffect(() => {
    const anyWin = window as any;
    const browserAPI = typeof anyWin.browser !== 'undefined' ? anyWin.browser : (typeof anyWin.chrome !== 'undefined' ? anyWin.chrome : null);
    
    if (browserAPI && browserAPI.runtime) {
      const handlePopupMessage = async (message: any) => {
        if (message.action === 'trigger_quick_action') {
          handleQuickAction(message.actionType);
        } else if (message.action === 'photo_captured' && message.imageData) {
          const photoMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: '📸 Photo captured - analyzing with AI...',
            timestamp: new Date()
          };
          setMessages((prev: Message[]) => [...prev, photoMessage]);

          setIsLoading(true);
          try {
            const aiResponse = await sendMessageToAI('', message.imageData);
            const assistantMessage: Message = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: aiResponse,
              timestamp: new Date()
            };
            setMessages((prev: Message[]) => [...prev, assistantMessage]);
          } catch (error) {
            console.error('Photo analysis error:', error);
          } finally {
            setIsLoading(false);
          }
        } else if (message.action === 'location_captured' && message.location) {
          const { latitude, longitude } = message.location;
          const locationMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: `📍 Location captured: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            timestamp: new Date()
          };
          setMessages((prev: Message[]) => [...prev, locationMessage]);
          
          setIsLoading(true);
          try {
            const aiResponse = await sendMessageToAI(`Location data: Latitude ${latitude}, Longitude ${longitude}. Provide agricultural insights.`);
            const assistantMessage: Message = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: aiResponse,
              timestamp: new Date()
            };
            setMessages((prev: Message[]) => [...prev, assistantMessage]);
          } catch (error) {
            console.error('Location analysis error:', error);
          } finally {
            setIsLoading(false);
          }
        }
      };

      browserAPI.runtime.onMessage.addListener(handlePopupMessage);
      return () => browserAPI.runtime.onMessage.removeListener(handlePopupMessage);
    }
  }, [pageContext]); 

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans">
      {/* Header */}
      <header className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center border border-primary-500/20 shadow-lg shadow-primary-500/5">
            <Brain className="w-6 h-6 text-primary-400" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tighter text-white uppercase italic">ALFA ADVISOR</h1>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
              )}
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {isOnline ? 'Online' : 'Offline'}
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

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${msg.role === 'assistant'
              ? 'bg-primary-500/10 border-primary-500/20 shadow-lg shadow-primary-500/5'
              : 'bg-secondary-500/10 border-secondary-500/20 shadow-lg shadow-secondary-500/5'
              }`}>
              {msg.role === 'assistant' ? <Bot className="w-4 h-4 text-primary-400" /> : <User className="w-4 h-4 text-secondary-400" />}
            </div>
            <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'assistant'
              ? 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
              : 'bg-primary-600 border border-primary-500 text-white rounded-tr-none'
              }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {/* Offline Queue Manager */}
        {showOfflineManager && (
          <div className="mb-4 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">Offline Queue</h3>
              <button
                onClick={handleSync}
                disabled={!isOnline || queuedRequests.length === 0}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white text-xs font-bold rounded transition-colors disabled:cursor-not-allowed"
              >
                Sync Now
              </button>
            </div>

            {queuedRequests.length === 0 ? (
              <p className="text-sm text-slate-400">No pending requests</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {queuedRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded border border-slate-600">
                    <div className="flex-1">
                      <p className="text-xs font-mono text-slate-300">{request.method} {request.url.replace(API_BASE_URL, '')}</p>
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

            {!isOnline && (
              <p className="mt-3 text-xs text-orange-400 flex items-center gap-1">
                <WifiOff className="w-3 h-3" />
                Offline - requests will sync when connection is restored
              </p>
            )}
          </div>
        )}
      </main>

      {/* Input Area */}
      <footer className="p-4 bg-slate-900/80 border-t border-slate-800 backdrop-blur-md">
        <div className="flex gap-2 mb-3 px-1">
          {['Summarize', 'Extract Data', 'Analyze Page'].map(tag => (
            <button key={tag} onClick={() => handleQuickAction(tag)} disabled={isLoading || !pageContext} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-[10px] font-black text-slate-400 hover:text-white transition-all uppercase tracking-tighter disabled:opacity-50 disabled:cursor-not-allowed">
              {tag}
            </button>
          ))}
        </div>
        <div className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask ALFA Core..."
            className="w-full bg-slate-950 border border-slate-700 focus:border-primary-500 rounded-2xl py-3 pl-4 pr-12 text-sm outline-none transition-all placeholder:text-slate-600 shadow-inner"
          />
          <button
            onClick={handleSend}
            disabled={isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary-600 hover:bg-primary-500 rounded-xl text-white transition-all shadow-lg shadow-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="mt-2 text-center text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em] flex items-center justify-center gap-1">
          <Sparkles className="w-2.5 h-2.5" /> Powered by OpenCrew AI & Claude
        </p>
      </footer>
    </div>
  );
}

export default App;
