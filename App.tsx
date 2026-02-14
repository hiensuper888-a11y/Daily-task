import React, { useState, useEffect, useRef, Suspense } from 'react';
import { ListTodo, Wand2, Globe, BarChart3, UserCircle2, CheckSquare, MessageSquare, WifiOff, Users, Plus, ScanLine, Share2, Copy, X, Camera, Image as ImageIcon, Settings, Shield, ShieldAlert, UserMinus, Trash2, LogOut, UserPlus, Loader2, Home, LayoutGrid, Layout, ChevronRight } from 'lucide-react';
import { AppTab, Language, Group, UserProfile } from './types';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useRealtimeStorage, SESSION_KEY } from './hooks/useRealtimeStorage';

const TodoList = React.lazy(() => import('./components/TodoList').then(module => ({ default: module.TodoList })));
const ImageEditor = React.lazy(() => import('./components/ImageEditor').then(module => ({ default: module.ImageEditor })));
const Reports = React.lazy(() => import('./components/Reports').then(module => ({ default: module.Reports })));
const Profile = React.lazy(() => import('./components/Profile').then(module => ({ default: module.Profile })));
const AiAssistant = React.lazy(() => import('./components/AiAssistant').then(module => ({ default: module.AiAssistant })));

const languages: { code: Language; label: string }[] = [
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'fr', label: 'Français' },
  { code: 'ko', label: '한국어' },
];

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full w-full text-slate-400">
    <div className="flex flex-col items-center gap-3">
      <Loader2 size={32} className="animate-spin text-indigo-500" />
      <span className="text-sm font-bold tracking-tight">Đang tải dữ liệu...</span>
    </div>
  </div>
);

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('tasks');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const isOnline = useOnlineStatus();
  
  const [myGroups, setMyGroups] = useRealtimeStorage<Group[]>('my_groups', []);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupImage, setNewGroupImage] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const groupFileInputRef = useRef<HTMLInputElement>(null);

  const [userProfile] = useRealtimeStorage<UserProfile>('user_profile', { name: 'Người dùng', email: 'guest', avatar: '', provider: null, isLoggedIn: false });
  const currentUserId = userProfile.email || 'guest';
  const activeGroup = myGroups.find(g => g.id === activeGroupId) || null;

  const updateGroupInStorage = (updatedGroup: Group, isDelete: boolean = false) => {
      let newMyGroups;
      if (isDelete) {
          newMyGroups = myGroups.filter(g => g.id !== updatedGroup.id);
          if (activeGroupId === updatedGroup.id) setActiveGroupId(null);
      } else {
          newMyGroups = myGroups.map(g => g.id === updatedGroup.id ? updatedGroup : g);
      }
      setMyGroups(newMyGroups);
  };

  const handleGroupImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => setNewGroupImage(reader.result as string);
        reader.readAsDataURL(file);
      }
  };

  const handleCreateGroup = () => {
      if (!newGroupName.trim()) return;
      const newGroup: Group = {
          id: Date.now().toString(),
          name: newGroupName,
          leaderId: currentUserId,
          avatar: newGroupImage,
          members: [{
              id: currentUserId,
              name: userProfile.name || 'Người dùng',
              avatar: userProfile.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUserId}`,
              role: 'leader',
              joinedAt: Date.now()
          }],
          joinCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
          createdAt: Date.now()
      };
      updateGroupInStorage(newGroup);
      setNewGroupName('');
      setNewGroupImage('');
      setShowGroupModal(false);
      setActiveGroupId(newGroup.id);
      setActiveTab('tasks');
  };

  const NavItem = ({ tab, icon: Icon, label }: any) => (
    <button
      onClick={() => { setActiveTab(tab); setActiveGroupId(null); }}
      className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-300 font-bold group mb-1 ${
        activeTab === tab && activeGroupId === null
          ? `bg-indigo-600 text-white shadow-xl shadow-indigo-100` 
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon size={18} className={`${activeTab === tab && activeGroupId === null ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'}`} />
        <span className="text-sm tracking-tight">{label}</span>
      </div>
      {activeTab === tab && activeGroupId === null && <div className="w-1.5 h-1.5 rounded-full bg-white/60"></div>}
    </button>
  );

  return (
    <div className={`flex h-[100dvh] w-full transition-all duration-700 overflow-hidden ${activeGroupId ? 'bg-emerald-50/20' : 'bg-slate-50'}`}>
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-30">
          <div className={`absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[140px] transition-colors duration-1000 ${activeGroupId ? 'bg-emerald-300/40' : 'bg-indigo-300/40'}`}></div>
          <div className={`absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[140px] transition-colors duration-1000 ${activeGroupId ? 'bg-teal-300/40' : 'bg-violet-300/40'}`}></div>
      </div>

      <aside className="hidden md:flex flex-col w-72 bg-white/80 backdrop-blur-3xl border-r border-slate-200 shrink-0 z-20 relative shadow-2xl">
        <div className="p-8 pb-4">
          <div className="flex items-center gap-4 mb-10">
            <div className={`w-12 h-12 transition-all duration-700 rounded-2xl flex items-center justify-center text-white shadow-2xl ${activeGroupId ? 'bg-emerald-600 rotate-6 shadow-emerald-200' : 'bg-indigo-600 -rotate-6 shadow-indigo-200'}`}>
                <CheckSquare size={28} strokeWidth={3} />
            </div>
            <div className="flex flex-col">
                <span className="text-xl font-black tracking-tighter text-slate-900 leading-none uppercase">Daily Task</span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1.5">By Mr.Hien</span>
            </div>
          </div>
          
          <div className="space-y-1">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 pl-1 opacity-50">Cá nhân</p>
             <NavItem tab="tasks" icon={Home} label="Tổng quan" />
             <NavItem tab="ai" icon={MessageSquare} label={t.ai} />
             <NavItem tab="reports" icon={BarChart3} label={t.reports} />
             <NavItem tab="studio" icon={Wand2} label={t.studio} />
             <NavItem tab="profile" icon={UserCircle2} label={t.profile} />
          </div>
        </div>

        <div className="flex-1 px-6 py-4 overflow-y-auto custom-scrollbar border-t border-slate-100 mt-6 bg-slate-50/30">
          <div className="flex items-center justify-between mb-5 px-2">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] opacity-50">Nhóm dự án</p>
             <div className="flex gap-2">
                <button onClick={() => setShowJoinModal(true)} className="p-2 text-slate-400 hover:text-emerald-600 transition-all"><ScanLine size={14}/></button>
                <button onClick={() => setShowGroupModal(true)} className="p-2 text-slate-400 hover:text-emerald-600 transition-all"><Plus size={14}/></button>
             </div>
          </div>

          <div className="space-y-2">
              {myGroups.map(group => (
                  <button
                    key={group.id}
                    onClick={() => { setActiveTab('tasks'); setActiveGroupId(group.id); }}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-500 border-2 ${
                        activeGroupId === group.id
                        ? `bg-emerald-600 text-white border-emerald-500 shadow-xl shadow-emerald-100` 
                        : 'text-slate-600 bg-white border-transparent hover:border-emerald-100'
                    }`}
                  >
                      {group.avatar ? (
                          <img src={group.avatar} alt={group.name} className="w-8 h-8 rounded-xl object-cover shrink-0"/>
                      ) : (
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0 ${activeGroupId === group.id ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>
                              {group.name.substring(0,2).toUpperCase()}
                          </div>
                      )}
                      <span className="text-sm font-bold truncate">{group.name}</span>
                  </button>
              ))}
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-white/40">
           <button onClick={() => setShowLangMenu(!showLangMenu)} className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-slate-50 rounded-2xl text-xs font-black text-slate-600 transition-all border border-slate-200/60 shadow-sm">
             <span className="flex items-center gap-2.5"><Globe size={15} className="text-indigo-500" /> {languages.find(l => l.code === language)?.label}</span>
             <ChevronRight size={14} className="opacity-40" />
           </button>
           {showLangMenu && (
             <div className="absolute bottom-24 left-6 right-6 bg-white rounded-2xl shadow-2xl border border-slate-100 py-3 animate-scale-in z-50">
               {languages.map((lang) => (
                 <button key={lang.code} onClick={() => { setLanguage(lang.code); setShowLangMenu(false); }} className={`w-full text-left px-6 py-3 text-sm font-bold hover:bg-slate-50 transition-colors ${language === lang.code ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}`}>
                   {lang.label}
                 </button>
               ))}
             </div>
           )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative h-full overflow-hidden z-10">
        <div className="flex-1 overflow-hidden relative md:p-6 h-full flex flex-col">
           <div className={`flex-1 w-full max-w-[1600px] mx-auto bg-white/95 backdrop-blur-3xl md:rounded-[3rem] border transition-all duration-700 shadow-2xl relative overflow-hidden flex flex-col ${activeGroupId ? 'border-emerald-200 shadow-emerald-100/20' : 'border-slate-200 shadow-indigo-100/20'}`}>
               <div className="flex-1 overflow-hidden animate-fade-in">
                   <Suspense fallback={<LoadingFallback />}>
                       {activeTab === 'tasks' ? <TodoList activeGroup={activeGroup} /> : 
                       activeTab === 'ai' ? <AiAssistant /> :
                       activeTab === 'reports' ? <Reports /> : 
                       activeTab === 'profile' ? <Profile /> : <ImageEditor />}
                   </Suspense>
               </div>
           </div>
        </div>

        <div className="md:hidden bg-white/90 backdrop-blur-2xl border-t border-slate-100 pb-safe pt-3 px-6 flex justify-between items-center z-30 shadow-lg">
          {[
              { id: 'tasks', icon: activeGroupId ? Users : Home },
              { id: 'ai', icon: MessageSquare },
              { id: 'reports', icon: BarChart3 },
              { id: 'profile', icon: UserCircle2 }
          ].map((item) => (
              <button key={item.id} onClick={() => { setActiveTab(item.id as AppTab); if(item.id !== 'tasks') setActiveGroupId(null); }} className={`p-4 rounded-2xl transition-all ${activeTab === item.id ? (activeGroupId ? 'text-emerald-600 bg-emerald-50' : 'text-indigo-600 bg-indigo-50') : 'text-slate-400'}`}>
                <item.icon size={26} strokeWidth={activeTab === item.id ? 2.5 : 2} />
              </button>
          ))}
        </div>
      </main>

      {showGroupModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
              <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl animate-scale-in relative border border-slate-100">
                  <button onClick={() => setShowGroupModal(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-600"><X size={24}/></button>
                  <h3 className="text-2xl font-black text-slate-800 mb-8 tracking-tighter">Tạo nhóm mới</h3>
                  <div className="space-y-6">
                      <div className="flex justify-center">
                          <div className="relative w-24 h-24 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-indigo-500 overflow-hidden" onClick={() => groupFileInputRef.current?.click()}>
                              {newGroupImage ? <img src={newGroupImage} alt="Group" className="w-full h-full object-cover" /> : <ImageIcon size={32} className="text-slate-300" />}
                              <input type="file" ref={groupFileInputRef} className="hidden" accept="image/*" onChange={handleGroupImageUpload} />
                          </div>
                      </div>
                      <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Tên nhóm..." />
                      <button onClick={handleCreateGroup} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all uppercase tracking-widest text-xs">Khởi tạo</button>
                  </div>
              </div>
          </div>
      )}
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