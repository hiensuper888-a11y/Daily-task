import React, { useState, useEffect } from 'react';
import { User, LogOut, Cloud, RefreshCw, Facebook, Mail, Save, FileSpreadsheet, FileText, Download, Sparkles, WifiOff, Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { UserProfile } from '../types';
import { useRealtimeStorage } from '../hooks/useRealtimeStorage';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const Profile: React.FC = () => {
  const { t, language } = useLanguage();
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
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'latest' | 'available'>('idle');

  // Temporary state for editing
  const [editForm, setEditForm] = useState(profile);

  useEffect(() => {
    setEditForm(profile);
  }, [profile]);

  const login = (provider: 'google' | 'facebook') => {
    if (!isOnline) return;
    setIsSyncing(true);
    setTimeout(() => {
      setProfile({
        name: 'Nano User',
        email: provider === 'google' ? 'user@gmail.com' : 'user@facebook.com',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`,
        provider: provider,
        isLoggedIn: true,
        birthYear: '1995',
        hometown: 'Hanoi, Vietnam',
        address: '123 Street, City',
        company: 'NanoTech Inc.'
      });
      setIsSyncing(false);
    }, 1500);
  };

  const logout = () => {
    setProfile({
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
    setIsEditing(false);
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
          // For demo purposes, we just say it's up to date.
          // In a real electron app, you would use ipcRenderer.send('check-for-update') here.
          setUpdateStatus('latest');
      }, 2000);
  };

  const exportProfileExcel = () => {
    const headers = ["Name", "Email", "Provider", "Birth Year", "Hometown", "Address", "Company"];
    const row = [
        `"${profile.name}"`, 
        profile.email, 
        profile.provider, 
        profile.birthYear, 
        `"${profile.hometown}"`, 
        `"${profile.address}"`, 
        `"${profile.company}"`
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
          <tr><td style="background:#fff7ed; padding:10px; font-weight:bold;">${t.birthYear}</td><td style="padding:10px;">${profile.birthYear}</td></tr>
          <tr><td style="background:#fff7ed; padding:10px; font-weight:bold;">${t.hometown}</td><td style="padding:10px;">${profile.hometown}</td></tr>
          <tr><td style="background:#fff7ed; padding:10px; font-weight:bold;">${t.address}</td><td style="padding:10px;">${profile.address}</td></tr>
          <tr><td style="background:#fff7ed; padding:10px; font-weight:bold;">${t.company}</td><td style="padding:10px;">${profile.company}</td></tr>
          <tr><td style="background:#fff7ed; padding:10px; font-weight:bold;">Provider</td><td style="padding:10px;">${profile.provider}</td></tr>
        </table>
      </body></html>
    `;
    const blob = new Blob([htmlContent], { type: 'application/msword;charset=utf-8' });
    downloadFile(blob, `profile-${profile.name.replace(/\s+/g,'_')}.doc`);
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

  useEffect(() => {
    if (profile.isLoggedIn && isOnline) {
        // Simulate background sync
        const interval = setInterval(() => {
            setIsSyncing(true);
            setTimeout(() => setIsSyncing(false), 1000);
        }, 30000);
        return () => clearInterval(interval);
    }
  }, [profile.isLoggedIn, isOnline]);

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
                                <input name="name" value={editForm.name} onChange={handleInputChange} className="w-full text-xl font-bold border-b border-slate-200 focus:border-orange-500 focus:outline-none py-1" placeholder="Name" />
                                <p className="text-slate-400 text-sm flex items-center justify-center sm:justify-start gap-2"><Mail size={14}/> {profile.email}</p>
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
                    {[
                        { label: t.birthYear, key: 'birthYear', type: 'text' },
                        { label: t.hometown, key: 'hometown', type: 'text' },
                        { label: t.address, key: 'address', type: 'text' },
                        { label: t.company, key: 'company', type: 'text' }
                    ].map((field) => (
                        <div key={field.key} className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{field.label}</label>
                            {isEditing ? (
                                <input 
                                    name={field.key} 
                                    value={(editForm as any)[field.key]} 
                                    onChange={handleInputChange} 
                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-200 focus:outline-none transition-all"
                                />
                            ) : (
                                <p className="text-slate-800 font-medium border-b border-transparent py-2">{(profile as any)[field.key] || '---'}</p>
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
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <Info size={16} className="text-blue-500"/> {t.appInfo}
                </h3>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">{t.version}</p>
                        <p className="text-lg font-bold text-slate-800">v{APP_VERSION}</p>
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
                             <button className="text-xs font-bold text-white flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-full shadow-sm transition-all">
                                 <Download size={12}/> {t.downloadUpdate}
                             </button>
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