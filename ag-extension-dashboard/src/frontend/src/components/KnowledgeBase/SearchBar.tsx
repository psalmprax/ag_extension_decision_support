import React, { useRef } from 'react';
import { Search, Paperclip, Mic, BarChart3, ArrowRight, X, File as FileIcon } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { Attachment } from '@/api/knowledgeService';
import toast from 'react-hot-toast';

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  isAsking: boolean;
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;
  showStats: boolean;
  setShowStats: (show: boolean) => void;
  onSearch: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  setSearchQuery,
  attachments,
  setAttachments,
  isAsking,
  isRecording,
  setIsRecording,
  showStats,
  setShowStats,
  onSearch,
}) => {
  const originalQueryRef = useRef('');

  const {
    start: startSpeech,
    stop: stopSpeech,
    isSupported: isSpeechSupported,
  } = useSpeechRecognition({
    onResult: transcript => {
      const prefix = originalQueryRef.current.trim();
      setSearchQuery(prefix.length > 0 ? `${prefix} ${transcript}` : transcript);
    },
    onError: error => {
      setIsRecording(false);
      if (error === 'not-supported') {
        toast.error('Voice input is not supported in your browser. Try Chrome, Edge, or Safari.');
      } else if (error === 'not-allowed' || error === 'service-not-allowed') {
        toast.error('Microphone access was denied.');
      } else {
        toast.error(`Microphone error: ${error}`);
      }
    },
    onEnd: () => {
      setIsRecording(false);
    },
  });

  const handleMicClick = () => {
    if (isRecording) {
      stopSpeech();
      setIsRecording(false);
    } else {
      originalQueryRef.current = searchQuery;
      startSpeech();
      setIsRecording(true);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setAttachments(prev => [
          ...prev,
          {
            type: file.type.startsWith('image/') ? 'image' : 'file',
            data: base64String,
            name: file.name,
            mimeType: file.type,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-teal-500/20 blur opacity-60 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
      <div className="relative w-full max-w-full bg-slate-950/80 border border-white/10 p-1.5 sm:p-2 shadow-2xl focus-within:ring-2 focus-within:ring-emerald-500/40 focus-within:border-emerald-500/60 rounded-2xl overflow-hidden backdrop-blur-xl">
        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 py-2 sm:px-4 sm:py-2.5 border-b border-white/10">
            {attachments.map((att, i) => (
              <div
                key={i}
                className="flex items-center gap-2 bg-emerald-500/10 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border border-emerald-500/20 group/att"
              >
                {att.type === 'image' ? (
                  <img src={att.data} className="w-4 h-4 sm:w-5 sm:h-5 object-cover rounded-lg" />
                ) : (
                  <FileIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                )}
                <span className="text-xxs font-bold text-emerald-300 max-w-[100px] truncate">
                  {att.name}
                </span>
                <button
                  onClick={() => removeAttachment(i)}
                  className="text-emerald-400/60 hover:text-rose-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {isRecording && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-950/40 border-b border-rose-500/20 text-rose-300 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>Listening for agronomic inquiry... Speak now</span>
            <div className="flex items-center gap-0.5 ml-auto">
              {[4, 12, 8, 16, 10, 14, 6].map((h, i) => (
                <span
                  key={i}
                  className="w-1 bg-rose-400 rounded-full animate-pulse"
                  style={{ height: `${h}px`, animationDelay: `${i * 100}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center min-w-0 w-full overflow-hidden">
          <div className="pl-3 sm:pl-4 text-emerald-400 shrink-0 flex items-center justify-center">
            <Search className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSearch()}
            placeholder="Ask ALFA Agro-RAG (e.g., Maize Fall Armyworm IPM, Soil Acidity pH 4.8)..."
            className="flex-1 min-w-0 bg-transparent border-none focus:ring-0 py-2.5 sm:py-3.5 px-3 sm:px-4 text-xs sm:text-sm font-medium text-white placeholder-white/40 truncate"
          />
          <div className="flex items-center gap-1 sm:gap-2 pr-1 sm:pr-2 shrink-0">
            <label
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-white/60 hover:text-white cursor-pointer transition-all shrink-0 border border-transparent hover:border-white/10"
              title="Attach leaf photo or soil test report"
            >
              <Paperclip className="w-4 h-4" />
              <input type="file" multiple className="hidden" onChange={handleFileUpload} />
            </label>
            <button
              type="button"
              onClick={handleMicClick}
              disabled={!isSpeechSupported}
              className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl transition-all shrink-0 border ${
                !isSpeechSupported
                  ? 'opacity-30 cursor-not-allowed border-transparent text-white/30'
                  : isRecording
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                  : 'hover:bg-white/10 text-white/60 hover:text-white border-transparent hover:border-white/10'
              }`}
              title={
                isSpeechSupported ? 'Voice STT Input' : 'Voice input not supported in this browser'
              }
            >
              <Mic className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowStats(!showStats)}
              className={`hidden sm:flex w-8 h-8 sm:w-9 sm:h-9 items-center justify-center rounded-xl transition-all shrink-0 border ${
                showStats
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'hover:bg-white/10 text-white/60 hover:text-white border-transparent hover:border-white/10'
              }`}
              title="Vector Index Telemetry"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={isAsking || (!searchQuery.trim() && attachments.length === 0)}
              onClick={onSearch}
              className="h-8 sm:h-9 px-3 sm:px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-950/40 text-xs shrink-0 flex items-center justify-center gap-1.5 transition-all"
            >
              <span className="hidden sm:inline">Search RAG</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
