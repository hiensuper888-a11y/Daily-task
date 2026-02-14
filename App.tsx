import React, { useState, useEffect, useRef, Suspense } from 'react';
import { ListTodo, Wand2, Globe, BarChart3, UserCircle2, CheckSquare, MessageSquare, WifiOff, Users, Plus, ScanLine, Share2, Copy, X, Camera, Image as ImageIcon, Settings, Shield, ShieldAlert, UserMinus, Trash2, LogOut, UserPlus, Loader2 } from 'lucide-react';
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
      // 1. Update local MyGroups
      let newMyGroups;
      if (isDelete) {
          newMyGroups = myGroups.filter(g => g.id !== updatedGroup.id);
          if (activeGroupId === updatedGroup.id) setActiveGroupId(null);
      } else {
          newMyGroups = myGroups.map(g => g.id === updatedGroup.id ? updatedGroup : g);
      }
      setMyGroups(newMyGroups);

      // 2. Update Global Simulation (so other "users" see changes)
      const globalGroupsStr = localStorage.getItem('simulated_global_groups');
      if (globalGroupsStr) {
          let globalGroups: Group[] = JSON.parse(globalGroupsStr);
          if (isDelete) {
              globalGroups = globalGroups.filter(g => g.id !== updatedGroup.id);
          } else {
              // Replace or Add
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
          avatar: newGroupImage, // Save the image
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
      
      // Update storage using helper to ensure global sync immediately
      updateGroupInStorage(newGroup);
      
      setNewGroupName('');
      setNewGroupImage('');
      setShowGroupModal(false);
      setActiveGroupId(newGroup.id);
      alert(t.groupCreated);
  };

  const handleJoinGroup = () => {
     // Simulation: Check if code matches any group in "mock global db"
     const globalGroupsStr = localStorage.getItem('simulated_global_groups');
     const globalGroups: Group[] = globalGroupsStr ? JSON.parse(globalGroupsStr) : [];
     
     // Sync local groups to global for simulation if missing
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
         alert(t.groupJoined);
     } else {
         alert(t.groupJoinError);
     }
  };

  // --- Group Management Handlers ---

  const handleLeaveGroup = () => {
      if (!managingGroup) return;
      if (confirm("Are you sure you want to leave this group?")) {
          const updatedGroup: Group = {
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
      if (confirm("Are you sure you want to delete this group? This action cannot be undone.")) {
          updateGroupInStorage(managingGroup, true); // true = delete
          setManagingGroup(null);
      }
  };

  const handleRemoveMember = (memberId: string) => {
      if (!managingGroup) return;
      if (confirm("Remove this member?")) {
          const updatedGroup: Group = {
              ...managingGroup,
              members: managingGroup.members.filter(m => m.id !== memberId)
          };
          updateGroupInStorage(updatedGroup);
          setManagingGroup(updatedGroup); // Update local modal state
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

  const NavItem = ({ tab, icon: Icon, label, colorClass, bgClass }: any) => (
    <button
      onClick={() => { setActiveTab(tab); if(tab !== 'tasks') setActiveGroupId(null); }}
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 font-medium group relative overflow-hidden ${
        activeTab === tab && activeGroupId === null
          ? `bg-slate-900 text-white shadow-lg shadow-slate-200` 
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <div className={`relative z-10 flex items-center gap-3`}>
        <Icon size={20} className={`transition-all duration-300 ${activeTab === tab ? 'scale-110' : 'group-hover:scale-110'}`} />
        <span className={`${activeTab === tab ? 'font-bold' : 'font-medium'}`}>{label}</span>
      </div>
      {activeTab === tab && activeGroupId === null && (
        <div className="absolute inset-0 bg-white/10 z-0 animate-pulse"></div>
      )}
    </button>
  );

  return (
    <div className="flex h-[100dvh] w-full bg-[#f1f5f9] text-slate-800 font-sans overflow-hidden selection:bg-indigo-100 selection:text-indigo-700 relative">
      
      {/* Optimized Background: Static Gradient instead of heavy animations */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-gradient-to-br from-slate-50 via-indigo-50/50 to-rose-50/50"></div>

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

          <div className="mt-6 mb-2 pl-1 pr-2 flex items-center justify-between">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] opacity-80">
                  {t.myGroups}
              </p>
              <div className="flex gap-1">
                 <button onClick={() => setShowJoinModal(true)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-md transition-all" title={t.joinGroup}><ScanLine size={14}/></button>
                 <button onClick={() => setShowGroupModal(true)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-md transition-all" title={t.createGroup}><Plus size={14}/></button>
              </div>
          </div>

          <div className="space-y-1">
              {myGroups.map(group => (
                  <button
                    key={group.id}
                    onClick={() => { setActiveTab('tasks'); setActiveGroupId(group.id); }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-300 font-medium group relative overflow-hidden ${
                        activeGroupId === group.id
                        ? `bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm` 
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                      <div className="flex items-center gap-3 min-w-0">
                          {group.avatar ? (
                              <img src={group.avatar} alt={group.name} className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"/>
                          ) : (
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${activeGroupId === group.id ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>
                                  {group.name.substring(0,2).toUpperCase()}
                              </div>
                          )}
                          <span className="text-sm truncate">{group.name}</span>
                      </div>
                      <div className="flex items-center" onClick={(e) => { e.stopPropagation(); setManagingGroup(group); }}>
                          <Settings size={14} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-500"/>
                      </div>
                  </button>
              ))}
              {myGroups.length === 0 && (
                  <div className="text-xs text-slate-400 text-center py-4 italic border border-dashed border-slate-200 rounded-xl">
                      No groups yet
                  </div>
              )}
          </div>
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

      {/* --- MODALS --- */}
      
      {/* Create Group Modal */}
      {showGroupModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-in relative">
                  <button onClick={() => setShowGroupModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20}/></button>
                  <h3 className="text-xl font-bold text-slate-800 mb-4">{t.createGroup}</h3>
                  <div className="space-y-4">
                      {/* Avatar Upload */}
                      <div className="flex justify-center mb-2">
                          <div 
                            className="relative w-20 h-20 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all overflow-hidden group"
                            onClick={() => groupFileInputRef.current?.click()}
                          >
                              {newGroupImage ? (
                                  <img src={newGroupImage} alt="Group Avatar" className="w-full h-full object-cover" />
                              ) : (
                                  <div className="flex flex-col items-center text-slate-400 group-hover:text-indigo-500">
                                      <ImageIcon size={20} />
                                      <span className="text-[9px] font-bold mt-1">Upload</span>
                                  </div>
                              )}
                              <input 
                                  type="file" 
                                  ref={groupFileInputRef} 
                                  className="hidden" 
                                  accept="image/*" 
                                  onChange={handleGroupImageUpload}
                              />
                          </div>
                      </div>

                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t.groupName}</label>
                          <input 
                              autoFocus
                              value={newGroupName}
                              onChange={(e) => setNewGroupName(e.target.value)}
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200"
                              placeholder="My Awesome Team"
                          />
                      </div>
                      <button 
                          onClick={handleCreateGroup}
                          className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                      >
                          {t.createGroup}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Join Group Modal */}
      {showJoinModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-in relative">
                  <button onClick={() => setShowJoinModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20}/></button>
                  <h3 className="text-xl font-bold text-slate-800 mb-4">{t.joinGroup}</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t.joinCode}</label>
                          <input 
                              autoFocus
                              value={joinCodeInput}
                              onChange={(e) => setJoinCodeInput(e.target.value)}
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200 font-mono tracking-widest text-center text-lg"
                              placeholder="ABC123"
                          />
                      </div>
                      <button 
                          onClick={handleJoinGroup}
                          className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                      >
                          {t.joinGroup}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Group Management Modal (Replaces simple Share Modal) */}
      {managingGroup && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-scale-in relative overflow-hidden flex flex-col max-h-[80vh]">
                  {/* Header */}
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                      <div className="flex items-center gap-3">
                           {managingGroup.avatar ? (
                                <img src={managingGroup.avatar} className="w-10 h-10 rounded-full border border-slate-200 object-cover" />
                           ) : (
                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold border border-indigo-200">
                                    {managingGroup.name.substring(0,2).toUpperCase()}
                                </div>
                           )}
                           <div>
                               <h3 className="font-bold text-slate-800">{managingGroup.name}</h3>
                               <p className="text-xs text-slate-500">{managingGroup.members.length} {t.member}</p>
                           </div>
                      </div>
                      <button onClick={() => setManagingGroup(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors"><X size={20}/></button>
                  </div>

                  <div className="overflow-y-auto p-6 space-y-8 custom-scrollbar">
                      
                      {/* Section 1: Invite */}
                      <div>
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><UserPlus size={14}/> Invite Members</h4>
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-center">
                              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${managingGroup.joinCode}`} alt="QR Code" className="w-24 h-24 mb-3 border border-white rounded-lg shadow-sm"/>
                              <div className="flex items-center gap-2 w-full">
                                  <div className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-center font-mono font-bold tracking-widest text-slate-700 select-all">
                                      {managingGroup.joinCode}
                                  </div>
                                  <button onClick={() => {navigator.clipboard.writeText(managingGroup.joinCode); alert(t.copySuccess)}} className="p-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                                      <Copy size={16}/>
                                  </button>
                              </div>
                          </div>
                      </div>

                      {/* Section 2: Members */}
                      <div>
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Users size={14}/> Members</h4>
                          <div className="space-y-2">
                              {managingGroup.members.map(member => {
                                  const isMe = member.id === currentUserId;
                                  // I am admin if I am creator or promoted leader
                                  const myRole = managingGroup.members.find(m => m.id === currentUserId)?.role;
                                  const iAmAdmin = managingGroup.leaderId === currentUserId || myRole === 'leader';
                                  
                                  return (
                                      <div key={member.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-indigo-100 transition-colors group">
                                          <div className="flex items-center gap-3">
                                              <img src={member.avatar} className="w-8 h-8 rounded-full bg-slate-200" />
                                              <div>
                                                  <p className="text-sm font-bold text-slate-700 flex items-center gap-1">
                                                      {member.name} {isMe && <span className="text-[10px] text-slate-400">(You)</span>}
                                                  </p>
                                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${member.role === 'leader' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                                      {member.role === 'leader' ? 'Leader' : 'Member'}
                                                  </span>
                                              </div>
                                          </div>
                                          
                                          {/* Actions - Only if I am admin, and not acting on myself (unless leaving/demoting self logic handled elsewhere) */}
                                          {iAmAdmin && !isMe && (
                                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <button 
                                                    onClick={() => handleToggleRole(member.id)}
                                                    className={`p-1.5 rounded-lg transition-colors ${member.role === 'leader' ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-400 hover:bg-indigo-50 hover:text-indigo-600'}`}
                                                    title={member.role === 'leader' ? "Demote to Member" : "Promote to Leader"}
                                                  >
                                                      {member.role === 'leader' ? <ShieldAlert size={16}/> : <Shield size={16}/>}
                                                  </button>
                                                  <button 
                                                    onClick={() => handleRemoveMember(member.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Remove Member"
                                                  >
                                                      <UserMinus size={16}/>
                                                  </button>
                                              </div>
                                          )}
                                      </div>
                                  );
                              })}
                          </div>
                      </div>

                      {/* Section 3: Danger Zone */}
                      <div className="pt-4 border-t border-slate-100">
                          {managingGroup.leaderId === currentUserId ? (
                              <button 
                                onClick={handleDeleteGroup}
                                className="w-full py-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors border border-red-100"
                              >
                                  <Trash2 size={18}/> Delete Group
                              </button>
                          ) : (
                              <button 
                                onClick={handleLeaveGroup}
                                className="w-full py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                              >
                                  <LogOut size={18}/> Leave Group
                              </button>
                          )}
                      </div>

                  </div>
              </div>
          </div>
      )}


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
                   className={`w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 ${language === lang.code ? 'text-indigo-600 bg-indigo-50' : 'text-slate-700'}`}
                 >
                   {lang.label}
                 </button>
               ))}
             </div>
           )}
        </div>

        {/* Content Container - Wrapped in Suspense for Lazy Loading */}
        <div className="flex-1 overflow-hidden relative md:p-6 lg:p-6 h-full transition-all duration-500 ease-out">
           {/* Desktop Card Wrapper */}
           <div className="h-full w-full max-w-[1600px] mx-auto md:bg-white/40 md:backdrop-blur-xl md:rounded-[2.5rem] md:border md:border-white/50 overflow-hidden relative transition-all duration-300">
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
                onClick={() => { setActiveTab(item.id as AppTab); if(item.id !== 'tasks') setActiveGroupId(null); }}
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