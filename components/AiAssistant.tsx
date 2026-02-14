import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Sparkles, User, Trash2, Zap, MessageSquare, ListChecks, Loader2, WifiOff, RefreshCw } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { AiModel, ChatMessage, Task } from '../types';
import { chatWithGemini } from '../services/geminiService';
import { useRealtimeStorage } from '../hooks/useRealtimeStorage';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const AiAssistant: React.FC = () => {
    const { t } = useLanguage();
    const [messages, setMessages] = useRealtimeStorage<ChatMessage[]>('ai_chat_history', []);
    const [tasks] = useRealtimeStorage<Task[]>('daily_tasks', []);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedModel, setSelectedModel] = useState<AiModel>('gemini');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isOnline = useOnlineStatus();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => { scrollToBottom(); }, [messages, isLoading]);

    const handleSendMessage = async (text?: string) => {
        if (!isOnline) return;
        const messageText = text || inputValue;
        if (!messageText.trim()) return;

        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: messageText, timestamp: Date.now() };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages); setInputValue(''); setIsLoading(true);

        try {
            const historyForApi = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
            let responseText = await chatWithGemini(userMsg.text, historyForApi as any);
            if (selectedModel !== 'gemini') responseText = `[${selectedModel.toUpperCase()} Mode] ${responseText}`;
            
            const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: responseText, timestamp: Date.now(), modelUsed: selectedModel };
            setMessages([...newMessages, aiMsg]);
        } catch (error) {
            setMessages([...newMessages, { id: Date.now().toString(), role: 'model', text: "Lỗi kết nối AI.", timestamp: Date.now() }]);
        } finally { setIsLoading(false); }
    };

    const handleAnalyzeTasks = () => {
        if (!isOnline) return;
        const activeTasks = tasks.filter(t => !t.completed && !t.archived);
        if (activeTasks.length === 0) return handleSendMessage("Tôi không có công việc nào, hãy khen tôi!");
        const taskListStr = activeTasks.map(t => `- [${t.priority?.toUpperCase() || 'M'}] ${t.text}`).join('\n');
        handleSendMessage(`Phân tích danh sách việc cần làm:\n${taskListStr}\n\nHãy cho lời khuyên về thứ tự thực hiện.`);
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] rounded-none lg:rounded-[2.5rem] relative overflow-hidden">
             {/* Simple Header */}
            <div className="bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-200">
                        <Sparkles size={20} className="text-white"/>
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-slate-800 leading-none">AI Chat</h2>
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Online
                        </span>
                    </div>
                </div>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                    {(['gemini', 'chatgpt'] as AiModel[]).map((m) => (
                        <button key={m} onClick={() => setSelectedModel(m)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${selectedModel === m ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>{m}</button>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center"><Bot size={40} className="opacity-20"/></div>
                        <p className="text-sm font-bold">Bắt đầu trò chuyện với AI</p>
                    </div>
                )}
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'} animate-scale-in`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 border-white shadow-sm ${msg.role === 'user' ? 'bg-slate-800' : 'bg-indigo-600'}`}>
                            {msg.role === 'user' ? <User size={14} className="text-white"/> : <Sparkles size={14} className="text-white"/>}
                        </div>
                        <div className={`p-4 rounded-2xl text-[15px] leading-relaxed shadow-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-slate-800 text-white rounded-tr-sm' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-sm'}`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-3 mr-auto animate-fade-in">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0"><Bot size={14} className="text-white"/></div>
                        <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm border border-slate-100 flex gap-1 items-center shadow-sm">
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-75"></span>
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-150"></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-100 shrink-0 pb-safe">
                <div className="flex items-end gap-2 max-w-4xl mx-auto">
                    <button onClick={() => setMessages([])} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={20}/></button>
                    {tasks.length > 0 && <button onClick={handleAnalyzeTasks} className="p-3 text-indigo-500 hover:bg-indigo-50 rounded-xl transition-colors"><ListChecks size={20}/></button>}
                    
                    <div className="flex-1 bg-slate-50 border border-slate-200 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 rounded-2xl transition-all flex items-center px-2">
                        <textarea
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }}}
                            disabled={!isOnline}
                            placeholder="Nhập tin nhắn..."
                            className="w-full bg-transparent border-none focus:ring-0 p-3 max-h-32 min-h-[48px] resize-none text-sm font-medium text-slate-700 placeholder:text-slate-400"
                            rows={1}
                        />
                    </div>
                    
                    <button 
                        onClick={() => handleSendMessage()} 
                        disabled={!inputValue.trim() || isLoading}
                        className={`p-3 rounded-xl transition-all shadow-md ${!inputValue.trim() ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'}`}
                    >
                        <Send size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};