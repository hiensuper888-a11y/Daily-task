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
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
        activeTab === tab 
          ? `${bgClass} ${colorClass} shadow-sm ring-1 ring-inset ring-black/5` 
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
      }`}
    >
      <Icon size={20} className={activeTab === tab ? 'stroke-[2.5px]' : ''} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex h-[100dvh] w-full bg-slate-50 text-slate-800 font-sans overflow-hidden">
      
      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="hidden md:flex flex-col w-72 bg-white/80 backdrop-blur-xl border-r border-slate-200 shrink-0 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="p-8 pb-6">
          <div className="flex flex-col">
            <div className="flex items-center gap-3 text-2xl font-extrabold tracking-tight text-slate-900 group cursor-default">
               {/* Logo */}
               <div className="relative w-10 h-10 transition-transform duration-300 group-hover:scale-110">
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
          <p className="text-xs text-slate-400 font-medium mt-6 tracking-wide border-t border-slate-100 pt-4">
              AI Productivity Studio
          </p>
        </div>

        <nav className="flex-1 px-4 space-y-2 py-4">
          <NavItem tab="tasks" icon={ListTodo} label={t.tasks} colorClass="text-blue-600" bgClass="bg-blue-50" />
          <NavItem tab="ai" icon={MessageSquare} label={t.ai} colorClass="text-rose-600" bgClass="bg-rose-50" />
          <NavItem tab="reports" icon={BarChart3} label={t.reports} colorClass="text-emerald-600" bgClass="bg-emerald-50" />
          <NavItem tab="studio" icon={Wand2} label={t.studio} colorClass="text-violet-600" bgClass="bg-violet-50" />
          <NavItem tab="profile" icon={UserCircle2} label={t.profile} colorClass="text-orange-600" bgClass="bg-orange-50" />
        </nav>

        <div className="p-6 border-t border-slate-100 flex flex-col gap-3">
           {/* Desktop Language Switcher */}
           <div className="relative">
             <button 
               onClick={() => setShowLangMenu(!showLangMenu)}
               className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 rounded-xl text-sm font-medium text-slate-600 transition-all border border-slate-200 shadow-sm"
             >
               <span className="flex items-center gap-2">
                 <Globe size={16} className="text-slate-400" /> 
                 {language === 'vi' ? 'Tiếng Việt' : languages.find(l => l.code === language)?.label}
               </span>
             </button>
             
             {showLangMenu && (
               <div className="absolute bottom-full left-0 w-full mb-2 bg-white rounded-xl shadow-xl border border-slate-100 py-2 max-h-60 overflow-y-auto z-50 animate-fade-in">
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
           
           <div className="text-center">
             <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">v1.0.0</span>
           </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col relative h-full overflow-hidden">
        
        {/* Offline Indicator */}
        {!isOnline && (
            <div className="bg-slate-800 text-white text-xs font-bold py-1 px-4 text-center flex items-center justify-center gap-2 z-[60]">
                <WifiOff size={12} />
                Offline Mode - Changes saved locally
            </div>
        )}

        {/* Mobile Header / Lang Switcher */}
        <div className="md:hidden absolute top-4 right-4 z-50">
           <button 
             onClick={() => setShowLangMenu(!showLangMenu)}
             className="bg-white/80 backdrop-blur-md border border-slate-200 shadow-sm text-slate-700 px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 hover:bg-white"
           >
             <Globe size={12} /> {language.toUpperCase()}
           </button>
           
           {showLangMenu && (
             <div className="absolute right-0 top-full mt-2 w-36 bg-white rounded-xl shadow-xl border border-slate-100 py-2 max-h-60 overflow-y-auto z-50">
               {languages.map((lang) => (
                 <button
                   key={lang.code}
                   onClick={() => { setLanguage(lang.code); setShowLangMenu(false); }}
                   className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-slate-50 ${language === lang.code ? 'text-blue-600 bg-blue-50' : 'text-slate-700'}`}
                 >
                   {lang.label}
                 </button>
               ))}
             </div>
           )}
        </div>

        {/* Content Container */}
        <div className="flex-1 overflow-hidden relative bg-slate-50 md:p-6 lg:p-8">
           {/* Desktop Card Wrapper */}
           <div className="h-full w-full max-w-[1920px] mx-auto md:bg-white md:rounded-[2rem] md:shadow-sm md:border md:border-slate-200/60 overflow-hidden relative transition-all duration-300">
               {activeTab === 'tasks' ? <TodoList /> : 
               activeTab === 'ai' ? <AiAssistant /> :
               activeTab === 'reports' ? <Reports /> : 
               activeTab === 'profile' ? <Profile /> : <ImageEditor />}
           </div>
        </div>

        {/* --- MOBILE BOTTOM NAV --- */}
        <div className="md:hidden bg-white/90 backdrop-blur-xl border-t border-slate-100 p-2 pb-safe flex justify-between items-center shrink-0 z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.02)] px-4">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex flex-col items-center justify-center p-2 rounded-2xl flex-1 transition-all duration-300 group ${
              activeTab === 'tasks' 
                ? 'text-blue-600 bg-blue-50/80 scale-100' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 scale-95 opacity-70 hover:opacity-100'
            }`}
          >
            <div className={`transition-transform duration-300 ${activeTab === 'tasks' ? '-translate-y-0.5' : ''}`}>
                <ListTodo size={22} className={activeTab === 'tasks' ? 'stroke-[2.5px] drop-shadow-sm' : ''} />
            </div>
          </button>

           <button
            onClick={() => setActiveTab('ai')}
            className={`flex flex-col items-center justify-center p-2 rounded-2xl flex-1 transition-all duration-300 group ${
              activeTab === 'ai' 
                ? 'text-rose-600 bg-rose-50/80 scale-100' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 scale-95 opacity-70 hover:opacity-100'
            }`}
          >
             <div className={`transition-transform duration-300 ${activeTab === 'ai' ? '-translate-y-0.5' : ''}`}>
                <MessageSquare size={22} className={activeTab === 'ai' ? 'stroke-[2.5px] drop-shadow-sm' : ''} />
             </div>
          </button>

           <button
            onClick={() => setActiveTab('reports')}
            className={`flex flex-col items-center justify-center p-2 rounded-2xl flex-1 transition-all duration-300 group ${
              activeTab === 'reports' 
                ? 'text-emerald-600 bg-emerald-50/80 scale-100' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 scale-95 opacity-70 hover:opacity-100'
            }`}
          >
             <div className={`transition-transform duration-300 ${activeTab === 'reports' ? '-translate-y-0.5' : ''}`}>
                <BarChart3 size={22} className={activeTab === 'reports' ? 'stroke-[2.5px] drop-shadow-sm' : ''} />
             </div>
          </button>
          
          <button
            onClick={() => setActiveTab('studio')}
            className={`flex flex-col items-center justify-center p-2 rounded-2xl flex-1 transition-all duration-300 group ${
              activeTab === 'studio' 
                ? 'text-violet-600 bg-violet-50/80 scale-100' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 scale-95 opacity-70 hover:opacity-100'
            }`}
          >
             <div className={`transition-transform duration-300 ${activeTab === 'studio' ? '-translate-y-0.5' : ''}`}>
                <Wand2 size={22} className={activeTab === 'studio' ? 'stroke-[2.5px] drop-shadow-sm' : ''} />
             </div>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center p-2 rounded-2xl flex-1 transition-all duration-300 group ${
              activeTab === 'profile' 
                ? 'text-orange-600 bg-orange-50/80 scale-100' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 scale-95 opacity-70 hover:opacity-100'
            }`}
          >
             <div className={`transition-transform duration-300 ${activeTab === 'profile' ? '-translate-y-0.5' : ''}`}>
                <UserCircle2 size={22} className={activeTab === 'profile' ? 'stroke-[2.5px] drop-shadow-sm' : ''} />
             </div>
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