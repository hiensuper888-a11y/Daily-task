import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Sparkles, User, Trash2, Zap, MessageSquare, ListChecks, Loader2, WifiOff } from 'lucide-react';
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

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const handleSendMessage = async (text?: string) => {
        if (!isOnline) return;
        
        const messageText = text || inputValue;
        if (!messageText.trim()) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            text: messageText,
            timestamp: Date.now(),
        };

        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInputValue('');
        setIsLoading(true);

        try {
            const historyForApi = messages.map(m => ({
                role: m.role,
                parts: [{ text: m.text }]
            }));

            let responseText = "";
            if (selectedModel === 'gemini') {
                responseText = await chatWithGemini(userMsg.text, historyForApi as any);
            } else if (selectedModel === 'chatgpt') {
                 responseText = await chatWithGemini(userMsg.text, historyForApi as any);
                 responseText = "(ChatGPT Mode) " + responseText;
            } else if (selectedModel === 'grok') {
                 responseText = await chatWithGemini(userMsg.text, historyForApi as any);
                 responseText = "(Grok Mode) " + responseText;
            }

            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: responseText,
                timestamp: Date.now(),
                modelUsed: selectedModel
            };

            setMessages([...newMessages, aiMsg]);
        } catch (error) {
            console.error(error);
            const errorMsg: ChatMessage = {
                id: Date.now().toString(),
                role: 'model',
                text: "Sorry, I encountered an error while processing your request.",
                timestamp: Date.now(),
                modelUsed: selectedModel
            };
            setMessages([...newMessages, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnalyzeTasks = () => {
        if (!isOnline) return;

        const activeTasks = tasks.filter(t => !t.completed && !t.archived);
        if (activeTasks.length === 0) {
            const noTaskMsg: ChatMessage = {
                id: Date.now().toString(),
                role: 'model',
                text: "You have no active tasks to analyze! Great job!",
                timestamp: Date.now(),
                modelUsed: selectedModel
            };
            setMessages([...messages, noTaskMsg]);
            return;
        }

        const taskListStr = activeTasks.map(t => 
            `- [Priority: ${t.priority ? t.priority.toUpperCase() : 'MEDIUM'}] ${t.text} (Progress: ${t.progress}%)`
        ).join('\n');

        const prompt = `Please analyze my active tasks:\n\n${taskListStr}\n\nBased on this list, please provide the following in Markdown format:\n1. **Prioritized List**: A clear list of tasks sorted by importance, explicitly mentioning their priority.\n2. **Execution Plan**: A suggested execution order to be most productive.\n3. **Strategic Advice**: Specific advice on how to tackle high-priority items effectively.`;
        
        handleSendMessage(prompt);
    };

    const clearChat = () => {
        setMessages([]);
    };

    const getModelIcon = (model: AiModel) => {
        switch(model) {
            case 'gemini': return <Sparkles size={14} />;
            case 'chatgpt': return <Zap size={14} />;
            case 'grok': return <Bot size={14} />;
        }
    };

    const getModelName = (model: AiModel) => {
        switch(model) {
            case 'gemini': return 'Gemini 3';
            case 'chatgpt': return 'ChatGPT 4o';
            case 'grok': return 'Grok 3';
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/50 md:bg-transparent relative">
             {/* Header */}
            <div className="relative overflow-hidden bg-gradient-to-r from-rose-500 to-pink-600 p-6 md:p-8 text-white shrink-0 shadow-lg md:rounded-t-[2.5rem] z-10">
                <div className="absolute right-0 bottom-0 opacity-10 p-4 animate-float"><Bot size={120} /></div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            <MessageSquare size={28} className="text-rose-200" />
                            {t.aiHeader}
                        </h1>
                        <p className="text-rose-100 text-sm mt-1 font-medium opacity-90">{t.aiSubHeader}</p>
                    </div>

                    <div className="flex gap-2 self-start md:self-auto flex-wrap">
                        <div className="bg-white/20 backdrop-blur-md p-1.5 rounded-xl flex gap-1 border border-white/20">
                            {(['gemini', 'chatgpt', 'grok'] as AiModel[]).map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setSelectedModel(m)}
                                    disabled={!isOnline}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                                        selectedModel === m 
                                        ? 'bg-white text-rose-600 shadow-sm scale-105' 
                                        : 'text-rose-100 hover:bg-white/10'
                                    } ${!isOnline ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {getModelIcon(m)}
                                    {getModelName(m)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar space-y-6 pb-32 md:pb-10">
                {!isOnline && (
                    <div className="bg-slate-800 text-white p-3 rounded-full text-xs font-bold flex items-center justify-center gap-2 mx-auto max-w-sm shadow-xl animate-scale-in">
                        <WifiOff size={16} /> Internet connection required for AI.
                    </div>
                )}
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-6 min-h-[300px] animate-fade-in">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center animate-bounce shadow-xl shadow-rose-100 ring-4 ring-rose-50">
                            <Sparkles size={48} className="text-rose-400" />
                        </div>
                        <div className="text-center space-y-2">
                             <p className="text-lg font-bold text-slate-500">{t.welcomeAi}</p>
                             <p className="text-sm text-slate-400">Ask me anything or analyze your daily tasks.</p>
                        </div>
                        {tasks.length > 0 && (
                             <button 
                                onClick={handleAnalyzeTasks}
                                disabled={!isOnline}
                                className={`mt-2 px-6 py-3 rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-md hover:shadow-lg hover:-translate-y-1 ${
                                    isOnline 
                                    ? 'bg-white text-rose-600 border border-rose-100 hover:bg-rose-50' 
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                }`}
                             >
                                <ListChecks size={18}/> {t.analyzeTasks}
                             </button>
                        )}
                    </div>
                ) : (
                    messages.map((msg, index) => (
                        <div 
                            key={msg.id} 
                            className={`flex gap-4 max-w-[90%] md:max-w-[80%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'} group animate-scale-in`}
                            style={{ animationDelay: '0ms' }}
                        >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-md ${
                                msg.role === 'user' 
                                ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white' 
                                : 'bg-white text-rose-500 border border-rose-100'
                            }`}>
                                {msg.role === 'user' ? <User size={18}/> : <Bot size={20}/>}
                            </div>
                            <div className={`p-5 rounded-[1.5rem] text-sm leading-relaxed shadow-sm whitespace-pre-wrap relative transition-all hover:shadow-md ${
                                msg.role === 'user' 
                                ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-200' 
                                : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]'
                            }`}>
                                {msg.modelUsed && msg.role === 'model' && (
                                    <div className="text-[10px] uppercase font-bold text-rose-400 mb-2 opacity-80 tracking-wider flex items-center gap-1.5 border-b border-rose-50 pb-2">
                                        {getModelIcon(msg.modelUsed)} {getModelName(msg.modelUsed)}
                                    </div>
                                )}
                                {msg.text}
                            </div>
                        </div>
                    ))
                )}
                {isLoading && (
                    <div className="flex gap-4 mr-auto max-w-[80%] animate-fade-in">
                         <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 border border-rose-50 shadow-sm">
                            <Bot size={20} className="text-rose-300"/>
                        </div>
                        <div className="p-4 px-6 rounded-[1.5rem] bg-white border border-slate-100 rounded-tl-none shadow-sm flex items-center gap-1.5 h-14">
                            <div className="w-2 h-2 bg-rose-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-rose-400 rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></div>
                            <div className="w-2 h-2 bg-rose-400 rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 md:p-6 bg-gradient-to-t from-white via-white/80 to-transparent z-10 sticky bottom-0 md:relative md:rounded-b-[2.5rem]">
                <div className="flex items-end gap-3 max-w-4xl mx-auto bg-white/80 backdrop-blur-xl p-2 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-white ring-1 ring-slate-100">
                     <button 
                        onClick={clearChat}
                        className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors w-12 h-12 flex items-center justify-center"
                        title={t.clearChat}
                    >
                        <Trash2 size={20} />
                    </button>
                    {tasks.length > 0 && (
                        <button 
                            onClick={handleAnalyzeTasks}
                            disabled={isLoading || !isOnline}
                            className={`p-3 rounded-full transition-colors w-12 h-12 flex items-center justify-center ${!isOnline ? 'text-slate-300 cursor-not-allowed' : 'text-rose-500 hover:bg-rose-50'}`}
                            title={t.analyzeTasks}
                        >
                            <ListChecks size={22} />
                        </button>
                    )}
                    <div className="flex-1 bg-slate-50 hover:bg-slate-100 focus-within:bg-white focus-within:ring-2 focus-within:ring-rose-100 transition-all rounded-[1.5rem] flex items-center px-2 border border-transparent focus-within:border-rose-200">
                        <textarea
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            disabled={!isOnline}
                            placeholder={isOnline ? t.typeMessage : "Offline mode - Chat disabled"}
                            className="w-full bg-transparent border-none focus:ring-0 p-3 max-h-32 min-h-[52px] resize-none text-sm text-slate-700 placeholder:text-slate-400 disabled:text-slate-400 disabled:cursor-not-allowed"
                            rows={1}
                        />
                    </div>
                    <button
                        onClick={() => handleSendMessage()}
                        disabled={!inputValue.trim() || isLoading || !isOnline}
                        className={`p-3 rounded-full transition-all shadow-md w-12 h-12 flex items-center justify-center ${
                            !inputValue.trim() || isLoading || !isOnline
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                            : 'bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:scale-110 active:scale-95 shadow-rose-200'
                        }`}
                    >
                        {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className="ml-0.5" />}
                    </button>
                </div>
            </div>
        </div>
    );
};