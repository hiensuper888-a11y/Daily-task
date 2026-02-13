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
          ? `${bgClass} ${colorClass} shadow-md ring-1 ring-inset ring-black/5 translate-x-1` 
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
      }`}
    >
      <div className={`relative z-10 flex items-center gap-3`}>
        <Icon size={20} className={`transition-all duration-300 ${activeTab === tab ? 'scale-110 stroke-[2.5px]' : 'group-hover:scale-110'}`} />
        <span className={`${activeTab === tab ? 'font-bold' : ''}`}>{label}</span>
      </div>
      {activeTab === tab && (
        <div className="absolute inset-0 bg-white/40 z-0 animate-pulse"></div>
      )}
    </button>
  );

  return (
    <div className="flex h-[100dvh] w-full bg-[#f8fafc] text-slate-800 font-sans overflow-hidden selection:bg-indigo-100 selection:text-indigo-700 relative">
      
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-200/30 rounded-full blur-[100px] animate-float opacity-70 mix-blend-multiply"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-rose-200/30 rounded-full blur-[100px] animate-float opacity-70 mix-blend-multiply" style={{animationDelay: '-3s'}}></div>
          <div className="absolute top-[40%] left-[30%] w-[30vw] h-[30vw] bg-emerald-100/30 rounded-full blur-[80px] animate-float opacity-50 mix-blend-multiply" style={{animationDelay: '-5s'}}></div>
      </div>

      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="hidden md:flex flex-col w-72 bg-white/60 backdrop-blur-2xl border-r border-white/60 shrink-0 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)] m-4 my-6 ml-6 rounded-[2.5rem] h-[calc(100vh-3rem)] transition-all relative overflow-hidden ring-1 ring-white/80">
        
        {/* Sidebar Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/50 via-transparent to-white/50 z-0 pointer-events-none"></div>

        <div className="p-8 pb-6 relative z-10">
          <div className="flex flex-col">
            <div className="flex items-center gap-3 text-2xl font-extrabold tracking-tight text-slate-900 group cursor-default">
               {/* Animated Logo */}
               <div className="relative w-11 h-11 transition-transform duration-700 ease-spring group-hover:scale-110 group-hover:rotate-[360deg] cursor-pointer">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/30 rotate-3 group-hover:rotate-6 transition-all duration-300"></div>
                  <div className="absolute inset-0 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-xl flex items-center justify-center -rotate-3 group-hover:-rotate-0 transition-all duration-300 border border-white/20">
                      <CheckSquare size={26} className="text-white drop-shadow-md" strokeWidth={2.5} />
                  </div>
               </div>
               <div className="flex flex-col">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-indigo-800 leading-none pb-1">
                      Daily Task
                  </span>
               </div>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] pl-[60px] mt-[-4px] opacity-80">
                by Mr.Hien
            </p>
          </div>
          <p className="text-xs text-slate-400 font-bold mt-10 tracking-wider uppercase opacity-60 px-2 flex items-center gap-2">
              <span className="w-8 h-[1px] bg-slate-200"></span> Menu
          </p>
        </div>

        <nav className="flex-1 px-4 space-y-2 py-2 overflow-y-auto custom-scrollbar relative z-10">
          <NavItem tab="tasks" icon={ListTodo} label={t.tasks} colorClass="text-indigo-600" bgClass="bg-indigo-50" />
          <NavItem tab="ai" icon={MessageSquare} label={t.ai} colorClass="text-rose-600" bgClass="bg-rose-50" />
          <NavItem tab="reports" icon={BarChart3} label={t.reports} colorClass="text-emerald-600" bgClass="bg-emerald-50" />
          <NavItem tab="studio" icon={Wand2} label={t.studio} colorClass="text-violet-600" bgClass="bg-violet-50" />
          <NavItem tab="profile" icon={UserCircle2} label={t.profile} colorClass="text-orange-600" bgClass="bg-orange-50" />
        </nav>

        <div className="p-6 border-t border-white/50 flex flex-col gap-3 bg-white/30 backdrop-blur-sm rounded-b-[2.5rem] relative z-10">
           {/* Desktop Language Switcher */}
           <div className="relative group">
             <button 
               onClick={() => setShowLangMenu(!showLangMenu)}
               className="w-full flex items-center justify-between px-4 py-3 bg-white/70 hover:bg-white rounded-2xl text-sm font-medium text-slate-600 transition-all border border-white shadow-sm hover:shadow-md hover:-translate-y-0.5"
             >
               <span className="flex items-center gap-2">
                 <Globe size={16} className="text-indigo-400 group-hover:rotate-180 transition-transform duration-500" /> 
                 {language === 'vi' ? 'Tiếng Việt' : languages.find(l => l.code === language)?.label}
               </span>
             </button>
             
             {showLangMenu && (
               <div className="absolute bottom-full left-0 w-full mb-3 bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl shadow-indigo-900/10 border border-white py-2 max-h-60 overflow-y-auto z-50 animate-fade-in custom-scrollbar ring-1 ring-indigo-50">
                 {languages.map((lang) => (
                   <button
                     key={lang.code}
                     onClick={() => { setLanguage(lang.code); setShowLangMenu(false); }}
                     className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 ${language === lang.code ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-700'}`}
                   >
                     {language === lang.code && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>}
                     {lang.label}
                   </button>
                 ))}
               </div>
             )}
           </div>
           
           <div className="text-center mt-1 opacity-50 hover:opacity-100 transition-opacity">
             <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">v1.1.0</span>
           </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col relative h-full overflow-hidden z-10">
        
        {/* Offline Indicator */}
        {!isOnline && (
            <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-slate-800/90 backdrop-blur-md text-white text-xs font-bold py-2 px-6 rounded-full shadow-2xl flex items-center justify-center gap-2 z-[60] animate-fade-in border border-white/10 ring-2 ring-red-500/50">
                <WifiOff size={14} className="animate-pulse" />
                Offline Mode
            </div>
        )}

        {/* Mobile Header / Lang Switcher */}
        <div className="md:hidden absolute top-4 right-4 z-50">
           <button 
             onClick={() => setShowLangMenu(!showLangMenu)}
             className="glass shadow-lg shadow-indigo-500/10 text-slate-700 px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 hover:bg-white active:scale-95"
           >
             <Globe size={12} className="text-indigo-500" /> {language.toUpperCase()}
           </button>
           
           {showLangMenu && (
             <div className="absolute right-0 top-full mt-2 w-40 glass rounded-2xl shadow-xl py-2 max-h-60 overflow-y-auto z-50 animate-fade-in custom-scrollbar border border-white">
               {languages.map((lang) => (
                 <button
                   key={lang.code}
                   onClick={() => { setLanguage(lang.code); setShowLangMenu(false); }}
                   className={`w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-slate-50 ${language === lang.code ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-700'}`}
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
           <div className="h-full w-full max-w-[1600px] mx-auto md:bg-white/40 md:backdrop-blur-xl md:rounded-[2.5rem] md:shadow-[0_8px_32px_rgba(0,0,0,0.03)] md:border md:border-white/60 overflow-hidden relative transition-all duration-300 ring-1 ring-white/50">
               <div className="h-full animate-fade-in">
                   {activeTab === 'tasks' ? <TodoList /> : 
                   activeTab === 'ai' ? <AiAssistant /> :
                   activeTab === 'reports' ? <Reports /> : 
                   activeTab === 'profile' ? <Profile /> : <ImageEditor />}
               </div>
           </div>
        </div>

        {/* --- MOBILE BOTTOM NAV --- */}
        <div className="md:hidden bg-white/80 backdrop-blur-xl border-t border-slate-200/60 p-2 pb-safe flex justify-between items-center shrink-0 z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.02)] px-4 mx-4 mb-4 rounded-3xl ring-1 ring-black/5">
          {[
              { id: 'tasks', icon: ListTodo, label: t.tasks, color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { id: 'ai', icon: MessageSquare, label: t.ai, color: 'text-rose-600', bg: 'bg-rose-50' },
              { id: 'reports', icon: BarChart3, label: t.reports, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { id: 'studio', icon: Wand2, label: t.studio, color: 'text-violet-600', bg: 'bg-violet-50' },
              { id: 'profile', icon: UserCircle2, label: t.profile, color: 'text-orange-600', bg: 'bg-orange-50' }
          ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as AppTab)}
                className={`flex flex-col items-center justify-center p-2 rounded-2xl flex-1 transition-all duration-300 group ${
                  activeTab === item.id 
                    ? `${item.color} ${item.bg} scale-105 shadow-sm` 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <div className={`transition-transform duration-300 ${activeTab === item.id ? '-translate-y-1' : ''}`}>
                    <item.icon size={22} className={activeTab === item.id ? 'stroke-[2.5px] drop-shadow-sm' : ''} />
                </div>
                {activeTab === item.id && <span className="text-[9px] font-bold animate-fade-in mt-[-2px]">{item.label}</span>}
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