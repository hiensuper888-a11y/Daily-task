import React, { useState } from 'react';
import { ListTodo, Wand2, Globe, BarChart3, UserCircle2, CheckCircle2, CheckSquare, Bot, MessageSquare, WifiOff } from 'lucide-react';
import { TodoList } from './components/TodoList';
import { ImageEditor } from './components/ImageEditor';
import { Reports } from './components/Reports';
import { Profile } from './components/Profile';
import { AiAssistant } from './components/AiAssistant';
import { AppTab, Language } from './types';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { useOnlineStatus } from './hooks/useOnlineStatus';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('tasks');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const isOnline = useOnlineStatus();

  const languages: { code: Language; label: string }[] = [
    { code: 'vi', label: 'Tiếng Việt' },
    { code: 'en', label: 'English' },
    { code: 'zh', label: '中文' },
    { code: 'ja', label: '日本語' },
    { code: 'ko', label: '한국어' },
    { code: 'fr', label: 'Français' },
    { code: 'de', label: 'Deutsch' },
    { code: 'es', label: 'Español' },
    { code: 'ru', label: 'Русский' },
    { code: 'hi', label: 'हिन्दी' },
  ];

  const NavItem = ({ tab, icon: Icon, label, colorClass, bgClass }: any) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 font-medium group relative overflow-hidden ${
        activeTab === tab 
          ? `${bgClass} ${colorClass} shadow-sm ring-1 ring-inset ring-black/5 scale-[1.02]` 
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
      }`}
    >
      <div className={`relative z-10 flex items-center gap-3`}>
        <Icon size={20} className={`transition-transform duration-300 ${activeTab === tab ? 'scale-110 stroke-[2.5px]' : 'group-hover:scale-110'}`} />
        <span>{label}</span>
      </div>
      {activeTab === tab && (
        <div className="absolute inset-0 bg-white/20 z-0 animate-fade-in"></div>
      )}
    </button>
  );

  return (
    <div className="flex h-[100dvh] w-full bg-[#f8fafc] text-slate-800 font-sans overflow-hidden selection:bg-blue-100 selection:text-blue-700">
      
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100/50 rounded-full blur-[100px] opacity-60"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-100/50 rounded-full blur-[100px] opacity-60"></div>
      </div>

      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="hidden md:flex flex-col w-72 bg-white/60 backdrop-blur-2xl border-r border-white/50 shrink-0 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)] m-4 my-6 ml-6 rounded-[2rem] h-[calc(100vh-3rem)] transition-all">
        <div className="p-8 pb-6">
          <div className="flex flex-col">
            <div className="flex items-center gap-3 text-2xl font-extrabold tracking-tight text-slate-900 group cursor-default">
               {/* Logo */}
               <div className="relative w-10 h-10 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-[360deg]">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/30 rotate-3 group-hover:rotate-6 transition-all duration-300"></div>
                  <div className="absolute inset-0 bg-gradient-to-tr from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center -rotate-3 group-hover:-rotate-0 transition-all duration-300 border border-white/20">
                      <CheckSquare size={24} className="text-white drop-shadow-md" strokeWidth={2.5} />
                  </div>
               </div>
               <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">
                  Daily Task
               </span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest pl-[52px] mt-[-2px] opacity-80">
                by Mr.Hien
            </p>
          </div>
          <p className="text-xs text-slate-400 font-bold mt-8 tracking-wider uppercase opacity-60 px-2">
              Menu
          </p>
        </div>

        <nav className="flex-1 px-4 space-y-2 py-2 overflow-y-auto custom-scrollbar">
          <NavItem tab="tasks" icon={ListTodo} label={t.tasks} colorClass="text-blue-600" bgClass="bg-blue-50" />
          <NavItem tab="ai" icon={MessageSquare} label={t.ai} colorClass="text-rose-600" bgClass="bg-rose-50" />
          <NavItem tab="reports" icon={BarChart3} label={t.reports} colorClass="text-emerald-600" bgClass="bg-emerald-50" />
          <NavItem tab="studio" icon={Wand2} label={t.studio} colorClass="text-violet-600" bgClass="bg-violet-50" />
          <NavItem tab="profile" icon={UserCircle2} label={t.profile} colorClass="text-orange-600" bgClass="bg-orange-50" />
        </nav>

        <div className="p-6 border-t border-slate-100/50 flex flex-col gap-3 bg-white/40 rounded-b-[2rem]">
           {/* Desktop Language Switcher */}
           <div className="relative">
             <button 
               onClick={() => setShowLangMenu(!showLangMenu)}
               className="w-full flex items-center justify-between px-4 py-3 bg-white/80 hover:bg-white rounded-2xl text-sm font-medium text-slate-600 transition-all border border-slate-200/50 shadow-sm hover:shadow-md"
             >
               <span className="flex items-center gap-2">
                 <Globe size={16} className="text-slate-400" /> 
                 {language === 'vi' ? 'Tiếng Việt' : languages.find(l => l.code === language)?.label}
               </span>
             </button>
             
             {showLangMenu && (
               <div className="absolute bottom-full left-0 w-full mb-3 bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 py-2 max-h-60 overflow-y-auto z-50 animate-fade-in custom-scrollbar ring-1 ring-black/5">
                 {languages.map((lang) => (
                   <button
                     key={lang.code}
                     onClick={() => { setLanguage(lang.code); setShowLangMenu(false); }}
                     className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors ${language === lang.code ? 'text-blue-600 bg-blue-50/50' : 'text-slate-700'}`}
                   >
                     {lang.label}
                   </button>
                 ))}
               </div>
             )}
           </div>
           
           <div className="text-center mt-2">
             <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">v1.0.0</span>
           </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col relative h-full overflow-hidden z-10">
        
        {/* Offline Indicator */}
        {!isOnline && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-slate-800/90 backdrop-blur-md text-white text-xs font-bold py-1.5 px-4 rounded-full shadow-xl flex items-center justify-center gap-2 z-[60] animate-fade-in border border-white/10">
                <WifiOff size={12} />
                Offline Mode
            </div>
        )}

        {/* Mobile Header / Lang Switcher */}
        <div className="md:hidden absolute top-4 right-4 z-50">
           <button 
             onClick={() => setShowLangMenu(!showLangMenu)}
             className="glass shadow-sm text-slate-700 px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 hover:bg-white active:scale-95"
           >
             <Globe size={12} /> {language.toUpperCase()}
           </button>
           
           {showLangMenu && (
             <div className="absolute right-0 top-full mt-2 w-36 glass rounded-xl shadow-xl py-2 max-h-60 overflow-y-auto z-50 animate-fade-in custom-scrollbar">
               {languages.map((lang) => (
                 <button
                   key={lang.code}
                   onClick={() => { setLanguage(lang.code); setShowLangMenu(false); }}
                   className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-slate-50 ${language === lang.code ? 'text-blue-600 bg-blue-50/50' : 'text-slate-700'}`}
                 >
                   {lang.label}
                 </button>
               ))}
             </div>
           )}
        </div>

        {/* Content Container */}
        <div className="flex-1 overflow-hidden relative md:p-6 lg:p-6 h-full">
           {/* Desktop Card Wrapper */}
           <div className="h-full w-full max-w-[1600px] mx-auto md:bg-white/80 md:backdrop-blur-xl md:rounded-[2.5rem] md:shadow-[0_8px_32px_rgba(0,0,0,0.04)] md:border md:border-white/60 overflow-hidden relative transition-all duration-300">
               {activeTab === 'tasks' ? <TodoList /> : 
               activeTab === 'ai' ? <AiAssistant /> :
               activeTab === 'reports' ? <Reports /> : 
               activeTab === 'profile' ? <Profile /> : <ImageEditor />}
           </div>
        </div>

        {/* --- MOBILE BOTTOM NAV --- */}
        <div className="md:hidden bg-white/80 backdrop-blur-xl border-t border-slate-200/60 p-2 pb-safe flex justify-between items-center shrink-0 z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.02)] px-4">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex flex-col items-center justify-center p-2 rounded-2xl flex-1 transition-all duration-300 group hover-scale-active ${
              activeTab === 'tasks' 
                ? 'text-blue-600 bg-blue-50/80' 
                : 'text-slate-400'
            }`}
          >
            <div className={`transition-transform duration-300 ${activeTab === 'tasks' ? '-translate-y-1' : ''}`}>
                <ListTodo size={24} className={activeTab === 'tasks' ? 'stroke-[2.5px] drop-shadow-sm' : ''} />
            </div>
            {activeTab === 'tasks' && <span className="text-[10px] font-bold animate-fade-in">{t.tasks}</span>}
          </button>

           <button
            onClick={() => setActiveTab('ai')}
            className={`flex flex-col items-center justify-center p-2 rounded-2xl flex-1 transition-all duration-300 group hover-scale-active ${
              activeTab === 'ai' 
                ? 'text-rose-600 bg-rose-50/80' 
                : 'text-slate-400'
            }`}
          >
             <div className={`transition-transform duration-300 ${activeTab === 'ai' ? '-translate-y-1' : ''}`}>
                <MessageSquare size={24} className={activeTab === 'ai' ? 'stroke-[2.5px] drop-shadow-sm' : ''} />
             </div>
             {activeTab === 'ai' && <span className="text-[10px] font-bold animate-fade-in">{t.ai}</span>}
          </button>

           <button
            onClick={() => setActiveTab('reports')}
            className={`flex flex-col items-center justify-center p-2 rounded-2xl flex-1 transition-all duration-300 group hover-scale-active ${
              activeTab === 'reports' 
                ? 'text-emerald-600 bg-emerald-50/80' 
                : 'text-slate-400'
            }`}
          >
             <div className={`transition-transform duration-300 ${activeTab === 'reports' ? '-translate-y-1' : ''}`}>
                <BarChart3 size={24} className={activeTab === 'reports' ? 'stroke-[2.5px] drop-shadow-sm' : ''} />
             </div>
             {activeTab === 'reports' && <span className="text-[10px] font-bold animate-fade-in">{t.reports}</span>}
          </button>
          
          <button
            onClick={() => setActiveTab('studio')}
            className={`flex flex-col items-center justify-center p-2 rounded-2xl flex-1 transition-all duration-300 group hover-scale-active ${
              activeTab === 'studio' 
                ? 'text-violet-600 bg-violet-50/80' 
                : 'text-slate-400'
            }`}
          >
             <div className={`transition-transform duration-300 ${activeTab === 'studio' ? '-translate-y-1' : ''}`}>
                <Wand2 size={24} className={activeTab === 'studio' ? 'stroke-[2.5px] drop-shadow-sm' : ''} />
             </div>
             {activeTab === 'studio' && <span className="text-[10px] font-bold animate-fade-in">{t.studio}</span>}
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center p-2 rounded-2xl flex-1 transition-all duration-300 group hover-scale-active ${
              activeTab === 'profile' 
                ? 'text-orange-600 bg-orange-50/80' 
                : 'text-slate-400'
            }`}
          >
             <div className={`transition-transform duration-300 ${activeTab === 'profile' ? '-translate-y-1' : ''}`}>
                <UserCircle2 size={24} className={activeTab === 'profile' ? 'stroke-[2.5px] drop-shadow-sm' : ''} />
             </div>
             {activeTab === 'profile' && <span className="text-[10px] font-bold animate-fade-in">{t.profile}</span>}
          </button>
        </div>

      </main>
    </div>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}