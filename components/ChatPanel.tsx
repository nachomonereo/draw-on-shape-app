
import React, { useState, useRef, useEffect } from 'react';
import { Icons } from './IconComponents';
import { ChatMessage } from '../types';

interface ChatPanelProps {
    messages: ChatMessage[];
    onSendMessage: (text: string) => void;
    isLoading: boolean;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSendMessage, isLoading }) => {
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;
        onSendMessage(input);
        setInput('');
    };

    return (
        <div className="flex flex-col h-full bg-white border-l border-gray-200">
            <div className="p-4 border-b border-gray-100 bg-white">
                <h2 className="text-sm font-bold flex items-center gap-2 text-yellow-600">
                    <Icons.AI size={16} /> AI Assistant
                </h2>
                <p className="text-[10px] text-gray-400 mt-1">
                    Describe objects to create or ask for modeling tips.
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50" ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="text-center mt-10 opacity-50">
                        <Icons.AI className="mx-auto mb-2 text-yellow-500" size={32} />
                        <p className="text-xs text-gray-500">Try saying:</p>
                        <p className="text-xs text-gray-800 mt-1 italic">"Create a snowman"</p>
                        <p className="text-xs text-gray-800 mt-1 italic">"Add 3 stacked boxes"</p>
                        <p className="text-xs text-gray-800 mt-1 italic">"How do I make a table?"</p>
                    </div>
                )}
                
                {messages.map((msg) => (
                    <div 
                        key={msg.id} 
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div 
                            className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-sm ${
                                msg.role === 'user' 
                                ? 'bg-yellow-400 text-black font-medium rounded-br-none' 
                                : 'bg-white text-gray-700 border border-gray-100 rounded-bl-none'
                            }`}
                        >
                            {msg.text}
                        </div>
                    </div>
                ))}
                
                {isLoading && (
                     <div className="flex justify-start">
                        <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-none p-3 flex items-center gap-2 shadow-sm">
                             <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce" />
                             <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce delay-100" />
                             <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce delay-200" />
                        </div>
                     </div>
                )}
            </div>

            <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-gray-200">
                <div className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your idea..."
                        className="w-full bg-gray-50 text-black text-xs rounded-full py-3 px-4 pr-10 border border-gray-200 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all placeholder:text-gray-400"
                    />
                    <button 
                        type="submit" 
                        disabled={isLoading || !input.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-yellow-500 hover:text-yellow-600 disabled:opacity-30 transition-colors p-1"
                    >
                        <Icons.Chat size={16} />
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ChatPanel;