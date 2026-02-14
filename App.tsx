import React, { useState, useEffect, useRef, Suspense } from 'react';
import { ListTodo, Wand2, Globe, BarChart3, UserCircle2, CheckSquare, MessageSquare, WifiOff, Users, Plus, ScanLine, Share2, Copy, X, Camera, Image as ImageIcon, Settings, Shield, ShieldAlert, UserMinus, Trash2, LogOut, UserPlus, Loader2, Home, LayoutGrid } from 'lucide-react';
import { AppTab, Language, Group, UserProfile } from './types';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useRealtimeStorage, SESSION_KEY } from './hooks/useRealtimeStorage';

// Lazy Load Components for Performance Optimization
const TodoList = React.lazy(() => import('./components/TodoList').then(module => ({ default: module.TodoList })));
const ImageEditor = React.lazy(() => import('./components/ImageEditor').then(module => ({ default: module.ImageEditor })));
const Reports = React.lazy(() => import('./components/Reports').then(module => ({ default: module.Reports })));
const Profile = React.lazy(() => import('./components/Profile').then(module => ({ default: module.Profile })));
const AiAssistant = React.lazy(() => import('./components/AiAssistant').then(module => ({ default: module.AiAssistant })));

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full w-full text-slate-400">
    <div className="flex flex-col items-center gap-2">
      <Loader2 size={32} className="animate-spin text-indigo-500" />
      <span className="text-xs font-medium">Loading resources...</span>
    </div>
  </div>
);

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('tasks');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const isOnline = useOnlineStatus();
  
  // Group State
  const [myGroups, setMyGroups] = useRealtimeStorage<Group[]>('my_groups', []);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null); // null = Personal
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  
  // Group Management Modal State
  const [managingGroup, setManagingGroup] = useState<Group | null>(null);

  // Form Inputs
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupImage, setNewGroupImage] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const groupFileInputRef = useRef<HTMLInputElement>(null);

  // Current User (Simulated for demo)
  const [userProfile] = useRealtimeStorage<UserProfile>('user_profile', { name: 'User', email: 'guest', avatar: '', provider: null, isLoggedIn: false });
  const currentUserId = userProfile.email || 'guest';

  const activeGroup = myGroups.find(g => g.id === activeGroupId) || null;

  // --- Helper to update group in both local and global simulation ---
  const updateGroupInStorage = (updatedGroup: Group, isDelete: boolean = false) => {
      let newMyGroups;
      if (isDelete) {
          newMyGroups = myGroups.filter(g => g.id !== updatedGroup.id);
          if (activeGroupId === updatedGroup.id) setActiveGroupId(null);
      } else {
          newMyGroups = myGroups.map(g => g.id === updatedGroup.id ? updatedGroup : g);
      }
      setMyGroups(newMyGroups);

      const globalGroupsStr = localStorage.getItem('simulated_global_groups');
      if (globalGroupsStr) {
          let globalGroups: Group[] = JSON.parse(globalGroupsStr);
          if (isDelete) {
              globalGroups = globalGroups.filter(g => g.id !== updatedGroup.id);
          } else {
              const exists = globalGroups.find(g => g.id === updatedGroup.id);
              if (exists) {
                  globalGroups = globalGroups.map(g => g.id === updatedGroup.id ? updatedGroup : g);
              } else {
                  globalGroups.push(updatedGroup);
              }
          }
          localStorage.setItem('simulated_global_groups', JSON.stringify(globalGroups));
      }
  };

  const handleGroupImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setNewGroupImage(reader.result as string);
        };
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
              name: userProfile.name || 'User',
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
  };

  const handleJoinGroup = () => {
     const globalGroupsStr = localStorage.getItem('simulated_global_groups');
     const globalGroups: Group[] = globalGroupsStr ? JSON.parse(globalGroupsStr) : [];
     const allGroups = [...globalGroups, ...myGroups].filter((v,i,a)=>a.findIndex(t=>(t.id===v.id))===i);
     const targetGroup = allGroups.find(g => g.joinCode === joinCodeInput);

     if (targetGroup) {
         if (myGroups.find(g => g.id === targetGroup.id)) {
             alert("Already in group");
             return;
         }
         const updatedGroup = {
             ...targetGroup,
             members: [...targetGroup.members, {
                id: currentUserId,
                name: userProfile.name,
                avatar: userProfile.avatar,
                role: 'member' as const,
                joinedAt: Date.now()
             }]
         };
         updateGroupInStorage(updatedGroup);
         setJoinCodeInput('');
         setShowJoinModal(false);
         setActiveGroupId(targetGroup.id);
     } else {
         alert(t.groupJoinError);
     }
  };

  const handleLeaveGroup = () => {
      if (!managingGroup) return;
      if (confirm("Are you sure you want to leave this group?")) {
          const updatedGroup = {
              ...managingGroup,
              members: managingGroup.members.filter(m => m.id !== currentUserId)
          };
          updateGroupInStorage(updatedGroup);
          setManagingGroup(null);
          setActiveGroupId(null);
      }
  };

  const handleDeleteGroup = () => {
      if (!managingGroup) return;
      if (confirm("Are you sure you want to delete this group?")) {
          updateGroupInStorage(managingGroup, true);
          setManagingGroup(null);
      }
  };

  const handleRemoveMember = (memberId: string) => {
      if (!managingGroup) return;
      if (confirm("Remove this member?")) {
          const updatedGroup = {
              ...managingGroup,
              members: managingGroup.members.filter(m => m.id !== memberId)
          };
          updateGroupInStorage(updatedGroup);
          setManagingGroup(updatedGroup);
      }
  };

  const handleToggleRole = (memberId: string) => {
      if (!managingGroup) return;
      const member = managingGroup.members.find(m => m.id === memberId);
      if (!member) return;
      const newRole: 'leader' | 'member' = member.role === 'leader' ? 'member' : 'leader';
      const updatedGroup: Group = {
          ...managingGroup,
          members: managingGroup.members.map(m => m.id === memberId ? { ...m, role: newRole } : m)
      };
      updateGroupInStorage(updatedGroup);
      setManagingGroup(updatedGroup);
  };

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

  const NavItem = ({ tab, icon: Icon, label }: any) => (
    <button
      onClick={() => { setActiveTab(tab); setActiveGroupId(null); }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium group relative ${
        activeTab === tab && activeGroupId === null
          ? `bg-indigo-600 text-white shadow-md shadow-indigo-100` 
          : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
      }`}
    >
      <Icon size={18} className={`shrink-0 ${activeTab === tab && activeGroupId === null ? 'animate-pulse' : 'text-slate-400 group-hover:text-indigo-500'}`} />
      <span className="text-sm">{label}</span>
    </button>
  );

  return (
    <div className="flex h-[100dvh] w-full bg-[#f8fafc] text-slate-800 font-sans overflow-hidden selection:bg-indigo-100 selection:text-indigo-700 relative">
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-gradient-to-br from-slate-50 via-indigo-50/30 to-rose-50/30"></div>

      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="hidden md:flex flex-col w-72 bg-white/80 backdrop-blur-xl border-r border-slate-200 shrink-0 z-20 relative transition-all duration-300">
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <CheckSquare size={24} strokeWidth={2.5} />
            </div>
            <span className="text-xl font-black tracking-tighter text-slate-900">DAILY TASK</span>
          </div>
          
          <div className="space-y-1">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pl-1">Không gian cá nhân</p>
             <NavItem tab="tasks" icon={Home} label="Tổng quan cá nhân" />
             <NavItem tab="ai" icon={MessageSquare} label={t.ai} />
             <NavItem tab="reports" icon={BarChart3} label={t.reports} />
             <NavItem tab="studio" icon={Wand2} label={t.studio} />
             <NavItem tab="profile" icon={UserCircle2} label={t.profile} />
          </div>
        </div>

        <div className="flex-1 px-6 py-4 overflow-y-auto custom-scrollbar border-t border-slate-100 mt-4">
          <div className="flex items-center justify-between mb-4">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Không gian nhóm</p>
             <div className="flex gap-1">
                <button onClick={() => setShowJoinModal(true)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><ScanLine size={14}/></button>
                <button onClick={() => setShowGroupModal(true)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><Plus size={14}/></button>
             </div>
          </div>

          <div className="space-y-1">
              {myGroups.map(group => (
                  <button
                    key={group.id}
                    onClick={() => { setActiveTab('tasks'); setActiveGroupId(group.id); }}
                    className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all duration-200 group ${
                        activeGroupId === group.id
                        ? `bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm shadow-emerald-50` 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                      <div className="flex items-center gap-3 min-w-0">
                          {group.avatar ? (
                              <img src={group.avatar} alt={group.name} className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"/>
                          ) : (
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${activeGroupId === group.id ? 'bg-emerald-200 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                                  {group.name.substring(0,2).toUpperCase()}
                              </div>
                          )}
                          <span className="text-sm font-bold truncate">{group.name}</span>
                      </div>
                      <Settings 
                        size={14} 
                        className={`shrink-0 transition-opacity ${activeGroupId === group.id ? 'opacity-100 text-emerald-500' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100'}`}
                        onClick={(e) => { e.stopPropagation(); setManagingGroup(group); }}
                      />
                  </button>
              ))}
              {myGroups.length === 0 && (
                  <div className="py-8 text-center px-4">
                      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                         <Users size={20} className="text-slate-300" />
                      </div>
                      <p className="text-[11px] text-slate-400 font-medium leading-relaxed">Bạn chưa tham gia nhóm nào.<br/>Tạo hoặc tham gia ngay!</p>
                  </div>
              )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-100">
           <button 
             onClick={() => setShowLangMenu(!showLangMenu)}
             className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-600 transition-all border border-slate-100"
           >
             <span className="flex items-center gap-2">
               <Globe size={14} className="text-indigo-500" /> 
               {language === 'vi' ? 'Tiếng Việt' : languages.find(l => l.code === language)?.label}
             </span>
           </button>
           
           {showLangMenu && (
             <div className="absolute bottom-20 left-6 right-6 bg-white rounded-xl shadow-2xl border border-slate-100 py-1 max-h-60 overflow-y-auto z-50 animate-scale-in custom-scrollbar">
               {languages.map((lang) => (
                 <button
                   key={lang.code}
                   onClick={() => { setLanguage(lang.code); setShowLangMenu(false); }}
                   className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors ${language === lang.code ? 'text-indigo-600 bg-indigo-50 font-bold' : 'text-slate-600'}`}
                 >
                   {lang.label}
                 </button>
               ))}
             </div>
           )}
        </div>
      </aside>

      {/* --- MODALS --- */}
      {showGroupModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-in relative">
                  <button onClick={() => setShowGroupModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20}/></button>
                  <h3 className="text-xl font-black text-slate-800 mb-6">{t.createGroup}</h3>
                  <div className="space-y-5">
                      <div className="flex justify-center mb-2">
                          <div 
                            className="relative w-20 h-20 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all overflow-hidden group"
                            onClick={() => groupFileInputRef.current?.click()}
                          >
                              {newGroupImage ? (
                                  <img src={newGroupImage} alt="Group Avatar" className="w-full h-full object-cover" />
                              ) : (
                                  <div className="flex flex-col items-center text-slate-400 group-hover:text-indigo-500">
                                      <ImageIcon size={24} strokeWidth={1.5} />
                                      <span className="text-[10px] font-black mt-1">ẢNH NHÓM</span>
                                  </div>
                              )}
                              <input type="file" ref={groupFileInputRef} className="hidden" accept="image/*" onChange={handleGroupImageUpload} />
                          </div>
                      </div>
                      <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">{t.groupName}</label>
                          <input 
                              autoFocus
                              value={newGroupName}
                              onChange={(e) => setNewGroupName(e.target.value)}
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200 font-bold"
                              placeholder="Nhập tên nhóm..."
                          />
                      </div>
                      <button onClick={handleCreateGroup} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-[0.98]">{t.createGroup}</button>
                  </div>
              </div>
          </div>
      )}

      {showJoinModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-in relative">
                  <button onClick={() => setShowJoinModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20}/></button>
                  <h3 className="text-xl font-black text-slate-800 mb-6">{t.joinGroup}</h3>
                  <div className="space-y-5">
                      <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">{t.joinCode}</label>
                          <input 
                              autoFocus
                              value={joinCodeInput}
                              onChange={(e) => setJoinCodeInput(e.target.value)}
                              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200 font-mono tracking-[0.3em] text-center text-xl font-bold"
                              placeholder="ABC123"
                          />
                      </div>
                      <button onClick={handleJoinGroup} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 active:scale-[0.98]">{t.joinGroup}</button>
                  </div>
              </div>
          </div>
      )}

      {managingGroup && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-scale-in relative overflow-hidden flex flex-col max-h-[85vh]">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 backdrop-blur">
                      <div className="flex items-center gap-3">
                           {managingGroup.avatar ? (
                                <img src={managingGroup.avatar} className="w-12 h-12 rounded-xl border border-white shadow-sm object-cover" />
                           ) : (
                                <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black shadow-lg shadow-indigo-100">
                                    {managingGroup.name.substring(0,2).toUpperCase()}
                                </div>
                           )}
                           <div>
                               <h3 className="font-black text-slate-800 leading-tight">{managingGroup.name}</h3>
                               <p className="text-xs text-slate-500 font-medium">{managingGroup.members.length} {t.member}</p>
                           </div>
                      </div>
                      <button onClick={() => setManagingGroup(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-full transition-colors"><X size={20}/></button>
                  </div>

                  <div className="overflow-y-auto p-6 space-y-8 custom-scrollbar">
                      <div>
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><UserPlus size={14} className="text-indigo-500"/> Mời thành viên</h4>
                          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col items-center">
                              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${managingGroup.joinCode}`} alt="QR Code" className="w-28 h-28 mb-4 border-4 border-white rounded-2xl shadow-sm"/>
                              <div className="flex items-center gap-2 w-full">
                                  <div className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-center font-mono font-black tracking-widest text-slate-700 text-lg shadow-inner">
                                      {managingGroup.joinCode}
                                  </div>
                                  <button onClick={() => {navigator.clipboard.writeText(managingGroup.joinCode); alert(t.copySuccess)}} className="p-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100">
                                      <Copy size={18}/>
                                  </button>
                              </div>
                          </div>
                      </div>

                      <div>
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Users size={14} className="text-indigo-500"/> Danh sách thành viên</h4>
                          <div className="space-y-2">
                              {managingGroup.members.map(member => {
                                  const isMe = member.id === currentUserId;
                                  const myRole = managingGroup.members.find(m => m.id === currentUserId)?.role;
                                  const iAmAdmin = managingGroup.leaderId === currentUserId || myRole === 'leader';
                                  
                                  return (
                                      <div key={member.id} className="flex items-center justify-between p-3 bg-slate-50/50 hover:bg-white border border-transparent hover:border-slate-100 rounded-2xl transition-all group">
                                          <div className="flex items-center gap-3">
                                              <img src={member.avatar} className="w-10 h-10 rounded-xl bg-slate-200 object-cover" />
                                              <div>
                                                  <p className="text-sm font-black text-slate-800">
                                                      {member.name} {isMe && <span className="text-[10px] text-indigo-500 font-bold ml-1">(Bạn)</span>}
                                                  </p>
                                                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tight ${member.role === 'leader' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>
                                                      {member.role === 'leader' ? 'Trưởng nhóm' : 'Thành viên'}
                                                  </span>
                                              </div>
                                          </div>
                                          
                                          {iAmAdmin && !isMe && (
                                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <button onClick={() => handleToggleRole(member.id)} className="p-2 rounded-lg transition-colors text-slate-400 hover:bg-amber-50 hover:text-amber-600" title="Đổi quyền"><Shield size={16}/></button>
                                                  <button onClick={() => handleRemoveMember(member.id)} className="p-2 rounded-lg transition-colors text-slate-400 hover:bg-red-50 hover:text-red-600" title="Xóa khỏi nhóm"><UserMinus size={16}/></button>
                                              </div>
                                          )}
                                      </div>
                                  );
                              })}
                          </div>
                      </div>

                      <div className="pt-4">
                          {managingGroup.leaderId === currentUserId ? (
                              <button onClick={handleDeleteGroup} className="w-full py-4 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-2xl font-black flex items-center justify-center gap-2 transition-all border border-rose-100"><Trash2 size={18}/> GIẢI TÁN NHÓM</button>
                          ) : (
                              <button onClick={handleLeaveGroup} className="w-full py-4 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-2xl font-black flex items-center justify-center gap-2 transition-all"><LogOut size={18}/> RỜI KHỎI NHÓM</button>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col relative h-full overflow-hidden z-10 transition-all duration-300">
        {!isOnline && (
            <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-rose-500 text-white text-xs font-bold py-2 px-6 rounded-full shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 z-[60] animate-fade-in">
                <WifiOff size={14} className="animate-pulse" /> Offline Mode
            </div>
        )}

        <div className="md:hidden absolute top-4 right-4 z-50">
           <button onClick={() => setShowLangMenu(!showLangMenu)} className="bg-white/80 backdrop-blur shadow-sm border border-slate-200 text-slate-700 px-3 py-2 rounded-full text-xs font-black flex items-center gap-2 active:scale-95">
             <Globe size={14} className="text-indigo-500" /> {language.toUpperCase()}
           </button>
        </div>

        <div className="flex-1 overflow-hidden relative md:p-6 h-full transition-all duration-500">
           <div className={`h-full w-full max-w-[1600px] mx-auto md:bg-white/80 md:backdrop-blur-2xl md:rounded-[2.5rem] md:border md:border-white md:shadow-2xl md:shadow-slate-200/50 overflow-hidden relative transition-all duration-300 ${activeGroupId ? 'ring-4 ring-emerald-500/10' : ''}`}>
               <div className="h-full animate-fade-in">
                   <Suspense fallback={<LoadingFallback />}>
                       {activeTab === 'tasks' ? <TodoList activeGroup={activeGroup} /> : 
                       activeTab === 'ai' ? <AiAssistant /> :
                       activeTab === 'reports' ? <Reports /> : 
                       activeTab === 'profile' ? <Profile /> : <ImageEditor />}
                   </Suspense>
               </div>
           </div>
        </div>

        {/* --- MOBILE BOTTOM NAV --- */}
        <div className="md:hidden bg-white border-t border-slate-200 pb-safe pt-2 px-4 flex justify-between items-center shrink-0 z-30">
          {[
              { id: 'tasks', icon: activeGroupId ? Users : LayoutGrid },
              { id: 'ai', icon: MessageSquare },
              { id: 'reports', icon: BarChart3 },
              { id: 'profile', icon: UserCircle2 }
          ].map((item) => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id as AppTab); if(item.id !== 'tasks') setActiveGroupId(null); }}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl flex-1 transition-all duration-300 ${
                  activeTab === item.id 
                    ? (activeGroupId ? 'text-emerald-600 bg-emerald-50' : 'text-indigo-600 bg-indigo-50')
                    : 'text-slate-400'
                }`}
              >
                <item.icon size={24} strokeWidth={activeTab === item.id ? 2.5 : 2} />
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