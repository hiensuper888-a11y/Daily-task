import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, LogIn, UserPlus, RefreshCw, CheckSquare, ArrowRight, Globe } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { 
  auth, 
  isFirebaseConfigured,
  signOut, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendEmailVerification 
} from '../services/firebaseConfig';
import { SESSION_KEY } from '../hooks/useRealtimeStorage';
import { UserProfile } from '../types';

export const AuthScreen: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const isOnline = useOnlineStatus();
  
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const languages = [
    { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'zh', label: '中文', flag: '🇨🇳' },
    { code: 'ja', label: '日本語', flag: '🇯🇵' },
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
  ];

  const loginSuccess = (user: any, provider: string) => {
    const userId = user.uid;
    localStorage.setItem(SESSION_KEY, userId);
    
    const newProfile: UserProfile = { 
        uid: user.uid, 
        name: user.displayName || user.email?.split('@')[0] || 'User', 
        email: user.email || '', 
        avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`, 
        provider: provider as any, 
        isLoggedIn: true, 
        birthYear: '', hometown: '', address: '', company: '', phoneNumber: '', jobTitle: '', department: '' 
    };

    const storageKey = `${userId}_user_profile`;
    const existingProfileStr = localStorage.getItem(storageKey);
    let finalProfile = newProfile;
    
    if (existingProfileStr) { 
        try { 
            finalProfile = { ...JSON.parse(existingProfileStr), ...newProfile, uid: user.uid, isLoggedIn: true }; 
        } catch (e) {} 
    }
    
    localStorage.setItem(storageKey, JSON.stringify(finalProfile));
    localStorage.setItem('user_profile', JSON.stringify(finalProfile));

    window.dispatchEvent(new Event('auth-change'));
    window.dispatchEvent(new Event('local-storage'));
    window.dispatchEvent(new Event('storage'));
  };

  const handleEmailAuth = async () => {
    if (!isFirebaseConfigured()) { alert(t.firebaseError); return; }
    if (!isOnline) { alert(t.networkError); return; }
    if (!emailInput || !passwordInput) { alert(t.fillAllFields); return; }
    
    setIsSyncing(true);
    const cleanEmail = emailInput.trim().toLowerCase();
    try {
        if (authMode === 'register') {
            const credential = await createUserWithEmailAndPassword(auth, cleanEmail, passwordInput);
            await sendEmailVerification(credential.user);
            await signOut(auth);
            alert(t.registerSuccess);
            setAuthMode('login');
        } else {
            const credential = await signInWithEmailAndPassword(auth, cleanEmail, passwordInput);
            loginSuccess(credential.user, 'email');
        }
    } catch (error: any) { 
        alert(`${t.errorPrefix}${error.message}`); 
    } finally { 
        setIsSyncing(false); 
    }
  };

  return (
    <div className="w-full h-full relative overflow-y-auto custom-scrollbar bg-surface-50">
        {/* Animated Background Mesh (matches App.tsx global style) */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
             <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-200/40 rounded-full blur-[80px] animate-blob"></div>
             <div className="absolute top-[40%] right-[-10%] w-[40vw] h-[40vw] bg-purple-200/40 rounded-full blur-[80px] animate-blob animation-delay-2000"></div>
             <div className="absolute bottom-[-10%] left-[20%] w-[40vw] h-[40vw] bg-emerald-100/40 rounded-full blur-[80px] animate-blob animation-delay-4000"></div>
        </div>

        {/* Language Switcher */}
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
            <div className="flex items-center gap-1.5 bg-white/30 backdrop-blur-xl p-1.5 rounded-2xl border border-white/40 shadow-sm overflow-x-auto max-w-[calc(100vw-32px)] scrollbar-none">
                {languages.map(lang => (
                    <button 
                        key={lang.code}
                        onClick={() => setLanguage(lang.code as any)}
                        className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-lg transition-all ${language === lang.code ? 'bg-white shadow-md scale-100 ring-1 ring-black/5 opacity-100' : 'hover:bg-white/40 opacity-60 hover:opacity-100 hover:scale-105'}`}
                        title={lang.label}
                    >
                        {lang.flag}
                    </button>
                ))}
            </div>
        </div>

        {/* Scrollable Container */}
        <div className="min-h-full w-full flex flex-col items-center justify-center p-4 py-12 relative z-10">
            
            {/* APP LOGO SECTION */}
            <div className="mb-8 flex flex-col items-center animate-slide-up">
                <div className="w-24 h-24 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-[2rem] flex items-center justify-center shadow-xl shadow-indigo-500/30 mb-4 transform rotate-3 hover:rotate-6 transition-transform duration-500 ring-4 ring-white/50 group">
                    <CheckSquare size={48} className="text-white group-hover:scale-110 transition-transform" strokeWidth={2.5} />
                </div>
                <h1 className="text-4xl font-black text-slate-800 tracking-tighter drop-shadow-sm">Daily Task</h1>
                <div className="h-1.5 w-12 bg-indigo-500 rounded-full mt-3 opacity-30"></div>
            </div>

            {/* AUTH CARD */}
            <div className="glass-modal w-full max-w-[380px] p-8 md:p-10 rounded-[2.5rem] shadow-2xl border border-white/60 relative overflow-hidden animate-scale-in bg-white/70 backdrop-blur-xl">
                 {/* Top Decor */}
                 <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-bl-[100px] -z-10"></div>
                 
                 <div className="relative z-10">
                    <div className="mb-8">
                         <h2 className="text-2xl font-black text-slate-800 tracking-tight">{authMode === 'login' ? t.welcomeBack : t.createAccount}</h2>
                         <p className="text-slate-500 text-sm mt-1 font-medium">{authMode === 'login' ? t.loginContinue : t.startJourney}</p>
                    </div>

                    <div className="space-y-5">
                         <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 ml-1 uppercase tracking-widest">{t.emailLabel}</label>
                            <div className="relative group/input">
                                <Mail size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-indigo-600 transition-colors"/>
                                <input 
                                    type="email"
                                    value={emailInput}
                                    onChange={(e) => setEmailInput(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50/50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:ring-4 focus:ring-indigo-100/50"
                                    placeholder="name@example.com"
                                />
                            </div>
                         </div>
                         <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 ml-1 uppercase tracking-widest">{t.passwordLabel}</label>
                            <div className="relative group/input">
                                <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-indigo-600 transition-colors"/>
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    value={passwordInput}
                                    onChange={(e) => setPasswordInput(e.target.value)}
                                    className="w-full pl-12 pr-12 py-4 bg-slate-50/50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:ring-4 focus:ring-indigo-100/50"
                                    placeholder="••••••••"
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors p-1">
                                    {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                                </button>
                            </div>
                         </div>
                    </div>

                    <button 
                        onClick={handleEmailAuth}
                        disabled={isSyncing}
                        className="w-full mt-8 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-900/20 hover:bg-slate-800 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 group"
                    >
                        {isSyncing ? <RefreshCw size={20} className="animate-spin"/> : (authMode === 'login' ? <LogIn size={20}/> : <UserPlus size={20}/>)}
                        <span>{authMode === 'login' ? t.loginBtn : t.registerBtn}</span>
                        {!isSyncing && <ArrowRight size={18} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all"/>}
                    </button>

                    <div className="mt-8 text-center">
                        <button 
                            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                            className="text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors py-2 px-4 rounded-xl hover:bg-indigo-50"
                        >
                            {authMode === 'login' ? t.noAccountPrompt : t.hasAccountPrompt}
                        </button>
                    </div>
                 </div>
            </div>

            {/* BRANDING FOOTER */}
            <div className="mt-12 text-center animate-fade-in delay-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] opacity-60 hover:opacity-100 transition-opacity">
                    Designed & Built by
                </p>
                <div className="mt-1.5 relative inline-block group cursor-default">
                    <span className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600 tracking-widest relative z-10">
                        Mr.HIEN
                    </span>
                    <div className="absolute -inset-2 bg-indigo-100 rounded-lg blur-md opacity-0 group-hover:opacity-50 transition-opacity duration-500 -z-0"></div>
                </div>
            </div>
        </div>
    </div>
  );
};