import React, { useState } from 'react';
import { ListTodo, Wand2, Globe, BarChart3, UserCircle2, CheckSquare, MessageSquare, WifiOff } from 'lucide-react';
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
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 font-medium group relative overflow-hidden ${
        activeTab === tab 
          ? `bg-slate-900 text-white shadow-lg shadow-slate-200` 
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <div className={`relative z-10 flex items-center gap-3`}>
        <Icon size={20} className={`transition-all duration-300 ${activeTab === tab ? 'scale-110' : 'group-hover:scale-110'}`} />
        <span className={`${activeTab === tab ? 'font-bold' : 'font-medium'}`}>{label}</span>
      </div>
      {activeTab === tab && (
        <div className="absolute inset-0 bg-white/10 z-0 animate-pulse"></div>
      )}
    </button>
  );

  return (
    <div className="flex h-[100dvh] w-full bg-[#f1f5f9] text-slate-800 font-sans overflow-hidden selection:bg-indigo-100 selection:text-indigo-700 relative">
      
      {/* Refined Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#f8fafc]">
          <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-indigo-200/20 rounded-full blur-[120px] animate-float opacity-60"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-rose-200/20 rounded-full blur-[120px] animate-float opacity-60" style={{animationDelay: '-3s'}}></div>
          <div className="absolute top-[30%] left-[20%] w-[40vw] h-[40vw] bg-cyan-100/30 rounded-full blur-[100px] animate-float opacity-40" style={{animationDelay: '-5s'}}></div>
      </div>

      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="hidden md:flex flex-col w-72 bg-white/70 backdrop-blur-2xl border border-white/60 shrink-0 z-20 shadow-xl shadow-slate-200/40 m-4 my-6 ml-6 rounded-[2rem] h-[calc(100vh-3rem)] transition-all relative overflow-hidden">
        
        <div className="p-8 pb-6 relative z-10">
          <div className="flex flex-col">
            <div className="flex items-center gap-3 text-2xl font-extrabold tracking-tight text-slate-900 group cursor-default">
               {/* Logo */}
               <div className="relative w-10 h-10 transition-transform duration-500 group-hover:rotate-12">
                  <div className="absolute inset-0 bg-slate-900 rounded-xl shadow-lg rotate-3 group-hover:rotate-6 transition-all"></div>
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center -rotate-3 group-hover:-rotate-0 transition-all border border-white/20">
                      <CheckSquare size={22} className="text-white" strokeWidth={3} />
                  </div>
               </div>
               <div className="flex flex-col">
                  <span className="text-slate-900 leading-none pb-1 tracking-tight">
                      Daily Task
                  </span>
               </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-8 pl-1 opacity-80">
              Main Menu
          </p>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 py-2 overflow-y-auto custom-scrollbar relative z-10">
          <NavItem tab="tasks" icon={ListTodo} label={t.tasks} />
          <NavItem tab="ai" icon={MessageSquare} label={t.ai} />
          <NavItem tab="reports" icon={BarChart3} label={t.reports} />
          <NavItem tab="studio" icon={Wand2} label={t.studio} />
          <NavItem tab="profile" icon={UserCircle2} label={t.profile} />
        </nav>

        <div className="p-6 border-t border-slate-100/50 flex flex-col gap-3 bg-white/40 backdrop-blur-sm rounded-b-[2rem] relative z-10">
           {/* Desktop Language Switcher */}
           <div className="relative group">
             <button 
               onClick={() => setShowLangMenu(!showLangMenu)}
               className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 rounded-xl text-sm font-bold text-slate-600 transition-all border border-slate-100 shadow-sm"
             >
               <span className="flex items-center gap-2">
                 <Globe size={16} className="text-indigo-500" /> 
                 {language === 'vi' ? 'Tiếng Việt' : languages.find(l => l.code === language)?.label}
               </span>
             </button>
             
             {showLangMenu && (
               <div className="absolute bottom-full left-0 w-full mb-2 bg-white rounded-xl shadow-xl border border-slate-100 py-1 max-h-60 overflow-y-auto z-50 animate-scale-in custom-scrollbar">
                 {languages.map((lang) => (
                   <button
                     key={lang.code}
                     onClick={() => { setLanguage(lang.code); setShowLangMenu(false); }}
                     className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 ${language === lang.code ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}`}
                   >
                     {language === lang.code && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>}
                     {lang.label}
                   </button>
                 ))}
               </div>
             )}
           </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col relative h-full overflow-hidden z-10">
        
        {/* Offline Indicator */}
        {!isOnline && (
            <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-rose-500 text-white text-xs font-bold py-2 px-6 rounded-full shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 z-[60] animate-fade-in">
                <WifiOff size={14} className="animate-pulse" />
                Offline Mode
            </div>
        )}

        {/* Mobile Header / Lang Switcher */}
        <div className="md:hidden absolute top-4 right-4 z-50">
           <button 
             onClick={() => setShowLangMenu(!showLangMenu)}
             className="bg-white/80 backdrop-blur shadow-sm border border-white text-slate-700 px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 hover:bg-white active:scale-95"
           >
             <Globe size={12} className="text-indigo-500" /> {language.toUpperCase()}
           </button>
           
           {showLangMenu && (
             <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-2xl shadow-xl py-2 max-h-60 overflow-y-auto z-50 animate-scale-in custom-scrollbar border border-slate-100">
               {languages.map((lang) => (
                 <button
                   key={lang.code}
                   onClick={() => { setLanguage(lang.code); setShowLangMenu(false); }}
                   className={`w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-slate-50 ${language === lang.code ? 'text-indigo-600 bg-indigo-50' : 'text-slate-700'}`}
                 >
                   {lang.label}
                 </button>
               ))}
             </div>
           )}
        </div>

        {/* Content Container */}
        <div className="flex-1 overflow-hidden relative md:p-6 lg:p-6 h-full transition-all duration-500 ease-out">
           {/* Desktop Card Wrapper */}
           <div className="h-full w-full max-w-[1600px] mx-auto md:bg-white/40 md:backdrop-blur-xl md:rounded-[2.5rem] md:border md:border-white/50 overflow-hidden relative transition-all duration-300">
               <div className="h-full animate-fade-in">
                   {activeTab === 'tasks' ? <TodoList /> : 
                   activeTab === 'ai' ? <AiAssistant /> :
                   activeTab === 'reports' ? <Reports /> : 
                   activeTab === 'profile' ? <Profile /> : <ImageEditor />}
               </div>
           </div>
        </div>

        {/* --- MOBILE BOTTOM NAV --- */}
        <div className="md:hidden bg-white/90 backdrop-blur-xl border-t border-slate-200 pb-safe pt-2 px-4 flex justify-between items-center shrink-0 z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.02)]">
          {[
              { id: 'tasks', icon: ListTodo, label: t.tasks },
              { id: 'ai', icon: MessageSquare, label: t.ai },
              { id: 'reports', icon: BarChart3, label: t.reports },
              { id: 'studio', icon: Wand2, label: t.studio },
              { id: 'profile', icon: UserCircle2, label: t.profile }
          ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as AppTab)}
                className={`flex flex-col items-center justify-center p-2 rounded-xl flex-1 transition-all duration-300 group ${
                  activeTab === item.id 
                    ? 'text-indigo-600' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <div className={`transition-all duration-300 relative ${activeTab === item.id ? '-translate-y-1' : ''}`}>
                    <item.icon size={24} className={activeTab === item.id ? 'stroke-[2.5px] drop-shadow-sm' : ''} />
                    {activeTab === item.id && <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-600 rounded-full"></span>}
                </div>
              </button>
          ))}
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