import React, { useState, useEffect } from 'react';
import { User, LogOut, Cloud, RefreshCw, Facebook, Mail, Save, FileSpreadsheet, FileText, Download, Sparkles, WifiOff, Info, CheckCircle2, AlertCircle, Calendar, MapPin, Home, Briefcase } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { UserProfile } from '../types';
import { useRealtimeStorage, SESSION_KEY } from '../hooks/useRealtimeStorage';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { auth, googleProvider, facebookProvider } from '../services/firebaseConfig';
import * as firebaseAuth from "firebase/auth";

// Cast to any to avoid "has no exported member" errors
const { signInWithPopup, signOut } = firebaseAuth as any;

export const Profile: React.FC = () => {
  const { t } = useLanguage();
  
  // This hook automatically switches data based on the SESSION_KEY in localStorage
  const [profile, setProfile] = useRealtimeStorage<UserProfile>('user_profile', {
    name: '',
    email: '',
    avatar: '',
    provider: null,
    isLoggedIn: false,
    birthYear: '',
    hometown: '',
    address: '',
    company: ''
  });
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const isOnline = useOnlineStatus();
  
  // Update state
  const APP_VERSION = "1.0.0";
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'latest' | 'available' | 'downloading'>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Temporary state for editing
  const [editForm, setEditForm] = useState(profile);

  useEffect(() => {
    setEditForm(profile);
  }, [profile]);

  // Handle Login and Data Separation
  const login = async (providerName: 'google' | 'facebook') => {
    if (!isOnline) return;
    setIsSyncing(true);

    try {
        const authInstance = auth;
        if (authInstance && ((providerName === 'google' && googleProvider) || (providerName === 'facebook' && facebookProvider))) {
            const provider = providerName === 'google' ? googleProvider : facebookProvider;
            const result = await signInWithPopup(authInstance, provider!);
            const user = result.user;
            
            // 1. SET SESSION: Save the unique email/ID to separate data
            const userId = user.email || user.uid;
            localStorage.setItem(SESSION_KEY, userId);
            
            // 2. TRIGGER SWITCH: Notify hooks to switch to the user's data bucket
            window.dispatchEvent(new Event('auth-change'));

            // 3. UPDATE DATA: Now we are writing to "email_user_profile"
            // We use a timeout to ensure the hook has switched keys
            setTimeout(() => {
                setProfile({
                    ...profile, // Keep existing fields if they were loaded from storage
                    name: user.displayName || 'User',
                    email: user.email || '',
                    avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`,
                    provider: providerName,
                    isLoggedIn: true,
                });
                setIsSyncing(false);
            }, 100);

        } else {
            // FALLBACK: Demo mode
            console.warn("Chạy chế độ Demo login (Chưa config Firebase)");
            
            // Mock Data
            const demoEmail = providerName === 'google' ? 'demo_google@gmail.com' : 'demo_fb@facebook.com';
            
            // 1. SET SESSION
            localStorage.setItem(SESSION_KEY, demoEmail);
            
            // 2. TRIGGER SWITCH
            window.dispatchEvent(new Event('auth-change'));

            setTimeout(() => {
                setProfile({
                    name: 'Nano User',
                    email: demoEmail,
                    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`,
                    provider: providerName,
                    isLoggedIn: true,
                    birthYear: '1995',
                    hometown: 'Hanoi, Vietnam',
                    address: '123 Street, City',
                    company: 'NanoTech Inc.'
                });
                setIsSyncing(false);
            }, 1000);
        }
    } catch (error: any) {
        console.error("Login Error:", error);
        alert(`Đăng nhập thất bại: ${error.message}`);
        setIsSyncing(false);
    }
  };

  const logout = () => {
    setIsSyncing(true);
    if (auth) {
        signOut(auth).catch(console.error);
    }

    // 1. Mark current profile as logged out before switching
    setProfile(prev => ({ ...prev, isLoggedIn: false }));

    setTimeout(() => {
        // 2. CLEAR SESSION: Switch back to guest mode
        localStorage.removeItem(SESSION_KEY);
        
        // 3. TRIGGER SWITCH: Notify hooks to load guest data
        window.dispatchEvent(new Event('auth-change'));
        
        // 4. Reset local UI state
        setIsEditing(false);
        setIsSyncing(false);
        
        // Reload page to ensure clean state (optional but safer for full reset)
        // window.location.reload(); 
    }, 500);
  };

  const handleSave = () => {
    setProfile(editForm);
    setIsEditing(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckUpdate = () => {
      if (!isOnline) return;
      setUpdateStatus('checking');
      
      // Simulate network request
      setTimeout(() => {
          // Demo: Always find an update if we are on 1.0.0 for demonstration
          if (APP_VERSION === "1.0.0") {
              setUpdateStatus('available');
          } else {
              setUpdateStatus('latest');
          }
      }, 1500);
  };

  const handleDownloadUpdate = () => {
    setUpdateStatus('downloading');
    setDownloadProgress(0);
    
    // Simulate download progress
    const interval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          alert("Update v1.1.0 ready to install. Restarting app...");
          window.location.reload();
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  const downloadFile = (blob: Blob, fileName: string) => {
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const exportProfileExcel = () => {
    const headers = ["Name", "Email", "Provider", "Birth Year", "Hometown", "Address", "Company"];
    const row = [
        `"${profile.name}"`, 
        profile.email, 
        profile.provider, 
        profile.birthYear || '', 
        `"${profile.hometown || ''}"`, 
        `"${profile.address || ''}"`, 
        `"${profile.company || ''}"`
    ];
    const csvContent = "\uFEFF" + [headers, row].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadFile(blob, `profile-${profile.name.replace(/\s+/g,'_')}.csv`);
  };

  const exportProfileWord = () => {
     const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset="utf-8"><title>Profile</title></head>
      <body style="font-family: Arial, sans-serif;">
        <h1 style="color: #f97316;">${t.profile} - ${profile.name}</h1>
        <table border="1" style="border-collapse:collapse;width:100%; margin-top: 20px;">
          <tr><td style="background:#fff7ed; padding:10px; font-weight:bold;">Email</td><td style="padding:10px;">${profile.email}</td></tr>
          <tr><td style="background:#fff7ed; padding:10px; font-weight:bold;">${t.birthYear}</td><td style="padding:10px;">${profile.birthYear || ''}</td></tr>
          <tr><td style="background:#fff7ed; padding:10px; font-weight:bold;">${t.hometown}</td><td style="padding:10px;">${profile.hometown || ''}</td></tr>
          <tr><td style="background:#fff7ed; padding:10px; font-weight:bold;">${t.address}</td><td style="padding:10px;">${profile.address || ''}</td></tr>
          <tr><td style="background:#fff7ed; padding:10px; font-weight:bold;">${t.company}</td><td style="padding:10px;">${profile.company || ''}</td></tr>
          <tr><td style="background:#fff7ed; padding:10px; font-weight:bold;">Provider</td><td style="padding:10px;">${profile.provider || ''}</td></tr>
        </table>
      </body></html>
    `;
    const blob = new Blob([htmlContent], { type: 'application/msword;charset=utf-8' });
    downloadFile(blob, `profile-${profile.name.replace(/\s+/g,'_')}.doc`);
  };

  useEffect(() => {
    if (profile.isLoggedIn && isOnline) {
        const interval = setInterval(() => {
            // Background sync simulation
        }, 30000);
        return () => clearInterval(interval);
    }
  }, [profile.isLoggedIn, isOnline]);

  const profileFields = [
    { label: t.birthYear, key: 'birthYear' as keyof UserProfile, icon: Calendar },
    { label: t.hometown, key: 'hometown' as keyof UserProfile, icon: MapPin },
    { label: t.address, key: 'address' as keyof UserProfile, icon: Home },
    { label: t.company, key: 'company' as keyof UserProfile, icon: Briefcase }
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <div className="relative overflow-hidden bg-gradient-to-r from-orange-500 to-amber-500 p-8 text-white shrink-0 shadow-lg">
         <div className="absolute -right-6 -bottom-6 opacity-10">
            <User size={120} />
        </div>
        <h1 className="text-2xl font-bold flex items-center gap-3 relative z-10">
          <Cloud size={28} className="text-orange-200" />
          {t.loginHeader}
        </h1>
        <p className="text-orange-100 text-sm mt-2 font-medium opacity-90 relative z-10">
          {t.loginSubHeader}
        </p>
      </div>

      <div className="flex-1 p-6 flex flex-col items-center justify-start overflow-y-auto custom-scrollbar pb-24">
        {/* Check direct session key for initial render flicker prevention, but rely on profile.isLoggedIn for logic */}
        {profile.isLoggedIn ? (
          <div className="w-full max-w-2xl bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-100 flex flex-col animate-fade-in space-y-8">
            
            {/* User Details Section */}
            <div>
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-8 border-b border-slate-100 pb-8">
                    <div className="relative shrink-0">
                        <img src={profile.avatar} alt="Avatar" className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-orange-100 shadow-sm object-cover" />
                        <div className="absolute bottom-1 right-1 bg-white p-1 rounded-full shadow-sm">
                            {profile.provider === 'facebook' ? (
                                <Facebook size={20} className="text-[#1877F2]" fill="currentColor"/>
                            ) : (
                                <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center p-0.5">
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="G" className="w-full h-full"/>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="text-center sm:text-left flex-1 w-full">
                        {isEditing ? (
                            <div className="space-y-3">
                                <label className="block text-xs font-bold text-slate-400 uppercase">Tên hiển thị</label>
                                <input 
                                    name="name" 
                                    value={editForm.name} 
                                    onChange={handleInputChange} 
                                    className="w-full text-xl font-bold border-b border-slate-200 focus:border-orange-500 focus:outline-none py-1 bg-slate-50 rounded px-2" 
                                    placeholder="Name" 
                                />
                                
                                <label className="block text-xs font-bold text-slate-400 uppercase mt-2">Email</label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-2 top-2.5 text-slate-400"/>
                                    <input 
                                        name="email" 
                                        value={editForm.email} 
                                        onChange={handleInputChange} 
                                        className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-200 focus:outline-none text-sm text-slate-600"
                                        placeholder="Email"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">{profile.name}</h2>
                                <p className="text-slate-400 text-sm mb-4 flex items-center justify-center sm:justify-start gap-2"><Mail size={14}/> {profile.email}</p>
                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                                    <span className={`text-xs px-2 py-1 rounded-full border ${isSyncing ? 'text-amber-600 border-amber-200 bg-amber-50' : !isOnline ? 'text-slate-500 border-slate-200 bg-slate-50' : 'text-green-600 border-green-200 bg-green-50'} flex items-center gap-1`}>
                                        {!isOnline ? <WifiOff size={10} /> : isSyncing ? <RefreshCw size={10} className="animate-spin" /> : <Cloud size={10} />}
                                        {!isOnline ? "Offline" : isSyncing ? t.syncing : t.synced}
                                    </span>
                                    {profile.provider === 'google' && (
                                        <span className="text-xs px-2 py-1 rounded-full border border-violet-200 bg-violet-50 text-violet-600 flex items-center gap-1">
                                            <Sparkles size={10}/> {t.geminiIntegration}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Editable Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mb-8">
                    {profileFields.map((field) => (
                        <div key={field.key} className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <field.icon size={12} />
                                {field.label}
                            </label>
                            {isEditing ? (
                                <div className="relative">
                                    <input 
                                        name={field.key} 
                                        value={(editForm[field.key] as string) || ''} 
                                        onChange={handleInputChange} 
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-200 focus:outline-none transition-all text-slate-700 font-medium"
                                        placeholder={field.label}
                                    />
                                </div>
                            ) : (
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-slate-700 font-medium min-h-[48px] flex items-center">
                                    {(profile[field.key] as string) || <span className="text-slate-300 italic">--</span>}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
                    {isEditing ? (
                        <button onClick={handleSave} className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
                            <Save size={18} /> {t.saveProfile}
                        </button>
                    ) : (
                        <button onClick={() => setIsEditing(true)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors">
                            {t.editProfile}
                        </button>
                    )}
                    
                    <div className="flex gap-2">
                        <button onClick={exportProfileExcel} className="p-3 border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 rounded-xl" title="Export Excel">
                            <FileSpreadsheet size={20}/>
                        </button>
                        <button onClick={exportProfileWord} className="p-3 border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl" title="Export Word">
                            <FileText size={20}/>
                        </button>
                    </div>

                    <button 
                        onClick={logout}
                        className="py-3 px-6 border border-red-200 text-red-500 hover:bg-red-50 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                    >
                        <LogOut size={18} /> <span className="hidden sm:inline">{t.logout}</span>
                    </button>
                </div>
            </div>

            {/* App Info & Updates Section */}
            <div className={`p-6 rounded-2xl border transition-all duration-300 ${updateStatus === 'available' ? 'bg-blue-50 border-blue-200 ring-4 ring-blue-50' : 'bg-slate-50 border-slate-100'}`}>
                <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <Info size={16} className={updateStatus === 'available' ? 'text-blue-600' : 'text-blue-500'}/> {t.appInfo}
                </h3>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">{t.version}</p>
                        <p className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            v{APP_VERSION}
                            {updateStatus === 'available' && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">Update available</span>}
                        </p>
                    </div>
                    <div className="text-right">
                         {updateStatus === 'checking' ? (
                             <span className="text-xs font-bold text-blue-500 flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-full">
                                 <RefreshCw size={12} className="animate-spin"/> {t.checkingUpdate}
                             </span>
                         ) : updateStatus === 'latest' ? (
                            <span className="text-xs font-bold text-green-600 flex items-center gap-1.5 bg-green-50 px-3 py-1.5 rounded-full">
                                <CheckCircle2 size={12}/> {t.upToDate}
                            </span>
                         ) : updateStatus === 'available' ? (
                             <div className="flex flex-col items-end gap-1">
                                <span className="text-[10px] text-blue-600 font-bold mb-1">v1.1.0 available</span>
                                <button 
                                    onClick={handleDownloadUpdate}
                                    className="text-xs font-bold text-white flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-full shadow-lg shadow-blue-200 transition-all hover:scale-105 active:scale-95"
                                >
                                    <Download size={14}/> {t.downloadUpdate}
                                </button>
                             </div>
                         ) : updateStatus === 'downloading' ? (
                             <div className="w-32">
                                <div className="flex justify-between text-[10px] font-bold text-blue-600 mb-1">
                                    <span>Downloading...</span>
                                    <span>{downloadProgress}%</span>
                                </div>
                                <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-blue-600 transition-all duration-300"
                                        style={{ width: `${downloadProgress}%` }}
                                    ></div>
                                </div>
                             </div>
                         ) : (
                             <button 
                                onClick={handleCheckUpdate}
                                disabled={!isOnline}
                                className={`text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${
                                    isOnline 
                                    ? 'text-slate-600 border-slate-300 hover:bg-white hover:border-blue-300 hover:text-blue-600' 
                                    : 'text-slate-400 border-slate-200 cursor-not-allowed'
                                }`}
                             >
                                 {!isOnline ? <WifiOff size={12}/> : <RefreshCw size={12}/>} 
                                 {t.checkUpdate}
                             </button>
                         )}
                         {!isOnline && <p className="text-[10px] text-red-400 mt-1 font-medium">{t.offlineUpdate}</p>}
                    </div>
                </div>
                {updateStatus === 'available' && (
                    <div className="mt-4 p-3 bg-white/80 rounded-lg text-xs text-slate-600 border border-blue-100 flex gap-2">
                        <AlertCircle size={14} className="text-blue-500 shrink-0 mt-0.5" />
                        <div>
                            <span className="font-bold block text-slate-700">What's New in v1.1.0:</span>
                            • Improved AI performance and response speed.<br/>
                            • Fixed minor UI glitches in dark mode.<br/>
                            • Enhanced offline data synchronization.
                        </div>
                    </div>
                )}
            </div>

          </div>
        ) : (
          <div className="w-full max-w-sm space-y-4 animate-fade-in">
             <div className="text-center mb-8">
                 <div className="w-20 h-20 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                     <User size={32} />
                 </div>
                 <h3 className="text-lg font-bold text-slate-700">Welcome to Daily Task</h3>
                 <p className="text-slate-400 text-sm">Sign in with Google to sync tasks and enable Gemini AI features.</p>
             </div>
            
            {!isOnline && (
                 <div className="text-center p-3 bg-slate-100 rounded-lg text-slate-500 text-sm mb-4">
                     <WifiOff size={16} className="inline-block mr-1" /> Login unavailable offline
                 </div>
            )}

             <button 
                onClick={() => login('google')}
                disabled={!isOnline}
                className={`w-full py-3.5 border rounded-xl shadow-sm font-bold flex items-center justify-center gap-3 transition-all relative overflow-hidden group ${!isOnline ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95'}`}
             >
                 {isSyncing && <div className="absolute inset-0 bg-white/50 z-10"></div>}
                 <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" className={`w-5 h-5 ${!isOnline ? 'grayscale opacity-50' : ''}`}/>
                 <span className={`${isOnline ? 'group-hover:text-blue-600' : ''} transition-colors`}>{t.loginGoogle}</span>
             </button>

             <button 
                onClick={() => login('facebook')}
                disabled={!isOnline}
                className={`w-full py-3.5 rounded-xl shadow-md font-bold flex items-center justify-center gap-3 transition-all relative overflow-hidden ${!isOnline ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-[#1877F2] text-white hover:bg-[#166fe5] active:scale-95'}`}
             >
                 {isSyncing && <div className="absolute inset-0 bg-white/20 z-10"></div>}
                 <Facebook size={20} fill="currentColor" />
                 {t.loginFacebook}
             </button>
             
             {isSyncing && (
                 <p className="text-center text-xs text-orange-500 font-semibold animate-pulse mt-4">{t.syncing}</p>
             )}
          </div>
        )}
      </div>
    </div>
  );
};