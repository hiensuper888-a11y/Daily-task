import React, { useState, useRef, useEffect, memo } from 'react';
import { Send, Bot, Sparkles, User, Trash2, Zap, MessageSquare, ListChecks, Loader2, WifiOff, RefreshCw } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { AiModel, ChatMessage, Task } from '../types';
import { chatWithGemini } from '../services/geminiService';
import { useRealtimeStorage } from '../hooks/useRealtimeStorage';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

// Memoized Chat Bubble Component
const ChatBubble = memo(({ msg }: { msg: ChatMessage }) => {
    return (
        <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'} animate-slide-up group`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-slate-800 text-white' : 'bg-white text-indigo-600 border border-indigo-100'}`}>
                {msg.role === 'user' ? <User size={14}/> : <Sparkles size={14}/>}
            </div>
            <div className={`p-4 rounded-2xl text-[15px] leading-relaxed shadow-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-slate-800 text-white rounded-tr-sm' : 'bg-white/90 text-slate-700 backdrop-blur-md rounded-tl-sm border border-white/50'}`}>
                {msg.text}
            </div>
        </div>
    );
});

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
            setMessages([...newMessages, { id: Date.now().toString(), role: 'model', text: t.aiError, timestamp: Date.now() }]);
        } finally { setIsLoading(false); }
    };

    const handleAnalyzeTasks = () => {
        if (!isOnline) return;
        const activeTasks = tasks.filter(t => !t.completed && !t.archived);
        if (activeTasks.length === 0) return handleSendMessage(t.aiNoTasksPrompt);
        
        // Format tasks with more details for better AI analysis
        const taskListStr = activeTasks.map(t => {
            const deadlineInfo = t.deadline ? ` (Due: ${new Date(t.deadline).toLocaleString()})` : '';
            const subtasksInfo = t.subtasks && t.subtasks.length > 0 
                ? ` (Checklist: ${t.subtasks.filter(s => s.completed).length}/${t.subtasks.length} done)` 
                : '';
            return `- [${t.priority?.toUpperCase() || 'MEDIUM'}] ${t.text}${deadlineInfo}${subtasksInfo}`;
        }).join('\n');

        handleSendMessage(`${t.aiAnalyzeIntro}\n${taskListStr}\n${t.aiAnalyzeOutro}`);
    };

    return (
        <div className="flex flex-col h-full bg-transparent relative overflow-hidden">
             {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between shrink-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/60 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-sm border border-white/40">
                        <Sparkles size={20} className="text-indigo-600"/>
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-slate-800 leading-none drop-shadow-sm">{t.aiChatTitle}</h2>
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> {t.online}
                        </span>
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto px-4 pb-32 pt-2 space-y-6 custom-scrollbar relative z-10 mask-gradient-top">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 animate-fade-in">
                        <div className="w-24 h-24 bg-white/40 backdrop-blur-sm rounded-3xl flex items-center justify-center shadow-inner"><Bot size={48} className="opacity-40 text-indigo-300"/></div>
                        <p className="text-sm font-bold opacity-70">{t.startChat}</p>
                    </div>
                )}
                {messages.map((msg) => (
                    <ChatBubble key={msg.id} msg={msg} />
                ))}
                {isLoading && (
                    <div className="flex gap-3 mr-auto animate-fade-in pl-1">
                        <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm"><Sparkles size={14} className="text-indigo-600"/></div>
                        <div className="bg-white/60 px-4 py-3 rounded-2xl rounded-tl-sm backdrop-blur-md flex gap-1 items-center shadow-sm">
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-75"></span>
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-150"></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Floating Input Area */}
            <div className="fixed bottom-[90px] left-4 right-4 lg:left-[340px] z-[40] pb-safe flex justify-center">
                <div className="w-full max-w-2xl bg-white/80 backdrop-blur-[30px] rounded-[2rem] p-2 pl-3 shadow-float ring-1 ring-white/60 animate-slide-up flex items-center gap-2 group transition-all hover:shadow-[0_25px_60px_-10px_rgba(0,0,0,0.15)]">
                    <button onClick={() => setMessages([])} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><Trash2 size={18}/></button>
                    
                    {/* Task Analysis Button */}
                    {tasks.length > 0 && (
                        <button 
                            onClick={handleAnalyzeTasks} 
                            className="p-2.5 text-indigo-500 hover:bg-indigo-50 rounded-full transition-colors relative group/analyze"
                            title={t.analyzeTasks}
                        >
                            <ListChecks size={18}/>
                            <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded-lg opacity-0 group-hover/analyze:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-md">
                                {t.analyzeTasks}
                            </span>
                        </button>
                    )}
                    
                    <input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
                        disabled={!isOnline}
                        placeholder={t.typeMessage}
                        className="flex-1 bg-transparent border-none px-2 py-2 text-[15px] font-medium text-slate-800 placeholder-slate-400 min-w-0 outline-none"
                    />
                    
                    <button 
                        onClick={() => handleSendMessage()} 
                        disabled={!inputValue.trim() || isLoading}
                        className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 shrink-0 shadow-md ${!inputValue.trim() ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white hover:scale-110 hover:bg-indigo-700'}`}
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};