import { useState } from 'react';
import { useDesign } from '@/hooks/useDesignVariant';
import { Send, Plus, MoreVertical, Phone, Video } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatInterfaceProps {
  messages: Message[];
  onSend: (message: string) => void;
}

const CurrentChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSend }) => {
  const [input, setInput] = useState('');

  return (
    <div className="flex h-full">
      <div className="w-64 bg-gray-50 border-r border-gray-200">
        <div className="p-3 border-b border-gray-200">
          <div className="text-sm font-semibold text-gray-700">Chats</div>
        </div>
        <div className="p-2">
          <div className="flex items-center gap-2 p-2 bg-gray-100 rounded">
            <div className="w-8 h-8 bg-gray-300 rounded-full" />
            <div className="text-sm text-gray-700">AI Advisor</div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <div className="p-3 border-b border-gray-200 bg-white">
          <div className="text-sm font-semibold text-gray-900">Chat</div>
        </div>
        <div className="flex-1 p-4 bg-white">
          {messages.map((msg) => (
            <div key={msg.id} className={`mb-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
              <div className={`inline-block p-2 rounded-lg text-sm ${msg.role === 'user' ? 'bg-gray-100' : 'bg-gray-200'}`}>
                {msg.content}
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-gray-200 bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              onKeyPress={(e) => e.key === 'Enter' && onSend(input)}
            />
            <button
              onClick={() => onSend(input)}
              className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const NewChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSend }) => {
  const [input, setInput] = useState('');

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900">
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Conversations</h2>
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <Plus className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border-0 rounded-xl text-sm placeholder-gray-400 focus:ring-2 focus:ring-green-500/20"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-sm font-semibold text-white">AI</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-white text-sm">AI Farming Advisor</div>
                <div className="text-xs text-gray-500 truncate">How can I improve soil...</div>
              </div>
              <div className="w-2 h-2 bg-green-500 rounded-full" />
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-sm font-semibold text-white">AI</span>
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-white">AI Farming Advisor</div>
              <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                Online - Ready to help
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl">
              <Phone className="w-5 h-5 text-gray-500" />
            </button>
            <button className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl">
              <Video className="w-5 h-5 text-gray-500" />
            </button>
            <button className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl">
              <MoreVertical className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
                <div className={`px-4 py-3 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-green-500 text-white rounded-br-md'
                    : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-md shadow-sm'
                }`}>
                  <p className="text-sm">{msg.content}</p>
                </div>
                <p className={`text-xs text-gray-400 mt-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  2:34 PM
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about farming..."
                className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-700 border-0 rounded-full text-sm placeholder-gray-400 focus:ring-2 focus:ring-green-500/20"
                onKeyPress={(e) => e.key === 'Enter' && onSend(input)}
              />
            </div>
            <button
              onClick={() => onSend(input)}
              className="w-12 h-12 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/25 transition-all hover:scale-105"
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SearchIconProps extends React.SVGProps<SVGSVGElement> {}

const Search: React.FC<SearchIconProps> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

export const ChatInterface: React.FC<ChatInterfaceProps> = (props) => {
  const Chat = useDesign({
    current: CurrentChatInterface,
    new: NewChatInterface,
  });
  return <Chat {...props} />;
};

export default ChatInterface;
