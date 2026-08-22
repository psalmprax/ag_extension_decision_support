import React, { useRef } from 'react';
import { Search, Paperclip, Mic, BarChart3, ArrowRight, X, File as FileIcon } from 'lucide-react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { Button } from '../ui/Button';
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
  const { radiusClass } = useThemeClasses();
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
    <div className="relative group mb-12">
      <div
        className="absolute -inset-1 bg-gradient-to-r from-primary-600 to-indigo-600 blur opacity-20 group-hover:opacity-40 transition-opacity"
        style={{ borderRadius: 'calc(var(--radius-card) + 4px)' }}
      ></div>
      <div
        className="relative w-full max-w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 p-1 sm:p-1.5 shadow-2xl focus-within:ring-2 focus-within:ring-primary-500/30 focus-within:border-primary-500/50 overflow-hidden"
        style={{
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-premium)',
        }}
      >
        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 py-2 sm:px-4 sm:py-3 border-b border-gray-100 dark:border-gray-700/50">
            {attachments.map((att, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 bg-primary-50 dark:bg-primary-900/40 px-2.5 py-1 sm:px-3 sm:py-1.5 ${radiusClass} border border-primary-100 dark:border-primary-800 group/att`}
              >
                {att.type === 'image' ? (
                  <img src={att.data} className="w-4 h-4 sm:w-5 sm:h-5 object-cover rounded-md" />
                ) : (
                  <FileIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary-500" />
                )}
                <span className="text-xxs font-bold text-primary-700 dark:text-primary-300 max-w-[80px] sm:max-w-[100px] truncate">
                  {att.name}
                </span>
                <button
                  onClick={() => removeAttachment(i)}
                  className="text-primary-400 hover:text-rose-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center min-w-0 w-full overflow-hidden">
          <div className="pl-2.5 sm:pl-4 text-primary-500 shrink-0 flex items-center justify-center">
            <Search className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSearch()}
            placeholder="Ask ALFA anything..."
            className="flex-1 min-w-0 bg-transparent border-none focus:ring-0 py-2 sm:py-3.5 md:py-4 px-2 sm:px-3 md:px-4 text-xs sm:text-base md:text-xl font-medium text-gray-900 dark:text-white placeholder-gray-400 truncate"
          />
          <div className="flex items-center gap-0.5 sm:gap-1.5 pr-1 sm:pr-2 shrink-0">
            <label
              className={`w-7 h-7 sm:w-9 sm:h-9 md:w-10 md:h-10 flex items-center justify-center ${radiusClass} hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-400 cursor-pointer transition-all shrink-0`}
              title="Attach photo or document"
            >
              <Paperclip className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />
              <input type="file" multiple className="hidden" onChange={handleFileUpload} />
            </label>
            <button
              type="button"
              onClick={handleMicClick}
              disabled={!isSpeechSupported}
              className={`w-7 h-7 sm:w-9 sm:h-9 md:w-10 md:h-10 flex items-center justify-center ${radiusClass} transition-all shrink-0 ${!isSpeechSupported ? 'opacity-30 cursor-not-allowed' : isRecording ? 'bg-rose-100 text-rose-600 animate-pulse' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-400'}`}
              title={
                isSpeechSupported ? 'Voice Input' : 'Voice input not supported in this browser'
              }
            >
              <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowStats(!showStats)}
              className={`hidden sm:flex w-7 h-7 sm:w-9 sm:h-9 md:w-10 md:h-10 items-center justify-center ${radiusClass} transition-all shrink-0 ${showStats ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-400'}`}
              title="Insights"
            >
              <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />
            </button>
            <Button
              loading={isAsking}
              disabled={!searchQuery.trim() && attachments.length === 0}
              onClick={onSearch}
              className="h-7 sm:h-9 md:h-10 px-2 sm:px-4 md:px-6 font-bold shadow-lg shadow-primary-500/20 text-xs sm:text-sm shrink-0 flex items-center justify-center gap-1"
            >
              <span className="hidden md:inline">Generate</span>
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
