import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, LogIn, UserPlus, RefreshCw, CheckSquare, ArrowRight, Globe, Flame } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { 
  auth, 
  isFirebaseConfigured,
  signOut, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendEmailVerification 
} from '../services/authService';
import { SESSION_KEY } from '../hooks/useRealtimeStorage';
import { UserProfile } from '../types';
import { supabase } from '../services/supabaseClient';
import { playFireSound } from '../utils/sound';

const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
);

const FacebookIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
);

const XIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
);

export const AuthScreen: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const isOnline = useOnlineStatus();
  
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [introStage, setIntroStage] = useState(0);

  React.useEffect(() => {
    // Play fire sound
    const stopFireSound = playFireSound();
    
    const t1 = setTimeout(() => setIntroStage(1), 2000);
    const t2 = setTimeout(() => {
        setIntroStage(2);
        stopFireSound();
    }, 3000);
    
    return () => { 
        clearTimeout(t1); 
        clearTimeout(t2); 
        stopFireSound();
    };
  }, []);

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
    
    // Dispatch again after a short delay to ensure all listeners are ready/updated
    setTimeout(() => {
        window.dispatchEvent(new Event('auth-change'));
    }, 50);
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

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      }
    });
  };

  const handleFacebookLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: window.location.origin,
      }
    });
  };

  const handleTwitterLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'x',
      options: {
        redirectTo: window.location.origin,
      }
    });
  };

  return (
    <>
      <div className="w-full h-full relative overflow-y-auto custom-scrollbar bg-surface-50">
          {/* Animated Background Mesh (matches App.tsx global style) */}
          <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
               <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-200/40 rounded-full blur-[80px] animate-blob"></div>
               <div className="absolute top-[40%] right-[-10%] w-[40vw] h-[40vw] bg-purple-200/40 rounded-full blur-[80px] animate-blob animation-delay-2000"></div>
               <div className="absolute bottom-[-10%] left-[20%] w-[40vw] h-[40vw] bg-emerald-100/40 rounded-full blur-[80px] animate-blob animation-delay-4000"></div>
          </div>

          {/* Language Switcher */}
          <div className={`fixed top-4 right-4 z-50 transition-all duration-1000 delay-500 ${introStage < 1 ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
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
        <div className={`min-h-full w-full flex flex-col items-center justify-center p-4 py-12 relative z-10 transition-all duration-1000 delay-300 ${introStage < 1 ? 'opacity-0 scale-95 translate-y-8' : 'opacity-100 scale-100 translate-y-0'}`}>
            
            {/* APP LOGO SECTION */}
            <div className="mb-8 flex flex-col items-center animate-slide-up">
                <div className="w-24 h-24 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-[2rem] flex items-center justify-center shadow-xl shadow-indigo-500/30 mb-4 transform rotate-3 hover:-rotate-6 transition-transform duration-500 ring-4 ring-white/50 group">
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
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50/50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all placeholder-slate-400 focus:ring-4 focus:ring-indigo-100/50"
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
                                    className="w-full pl-12 pr-12 py-4 bg-slate-50/50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all placeholder-slate-400 focus:ring-4 focus:ring-indigo-100/50"
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
                        className="w-full mt-8 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-900/20 hover:bg-slate-800 active:scale-[1.02] active:opacity-95 transition-all flex items-center justify-center gap-3 group"
                    >
                        {isSyncing ? <RefreshCw size={20} className="animate-spin"/> : (authMode === 'login' ? <LogIn size={20}/> : <UserPlus size={20}/>)}
                        <span>{authMode === 'login' ? t.loginBtn : t.registerBtn}</span>
                        {!isSyncing && <ArrowRight size={18} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all"/>}
                    </button>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-2 text-slate-400 font-bold tracking-wider">Or</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-4">
                        <button 
                            onClick={handleGoogleLogin}
                            title={t.loginGoogle}
                            className="w-14 h-14 bg-white border border-slate-200 text-slate-700 rounded-2xl shadow-sm hover:bg-slate-50 hover:scale-105 active:scale-95 transition-all flex items-center justify-center group"
                        >
                            <GoogleIcon />
                        </button>

                        <button 
                            onClick={handleFacebookLogin}
                            title="Login with Facebook"
                            className="w-14 h-14 bg-[#1877F2] text-white rounded-2xl shadow-sm hover:bg-[#166FE5] hover:scale-105 active:scale-95 transition-all flex items-center justify-center group"
                        >
                            <FacebookIcon />
                        </button>

                        <button 
                            onClick={handleTwitterLogin}
                            title="Login with X"
                            className="w-14 h-14 bg-black text-white rounded-2xl shadow-sm hover:bg-slate-900 hover:scale-105 active:scale-95 transition-all flex items-center justify-center group"
                        >
                            <XIcon />
                        </button>
                    </div>

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

      {/* Intro Overlay */}
      {introStage < 2 && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none overflow-hidden bg-slate-950">
            {/* Starry Sky Background */}
            <div className={`absolute inset-0 z-0 transition-opacity duration-1000 ${introStage === 1 ? 'opacity-0' : 'opacity-100'}`} style={{
                backgroundImage: 'radial-gradient(2px 2px at 20px 30px, #fff, rgba(0,0,0,0)), radial-gradient(2px 2px at 40px 70px, #fdf, rgba(0,0,0,0)), radial-gradient(2px 2px at 50px 160px, #fff, rgba(0,0,0,0)), radial-gradient(2px 2px at 90px 40px, #fff, rgba(0,0,0,0)), radial-gradient(2px 2px at 130px 80px, #fdf, rgba(0,0,0,0)), radial-gradient(2px 2px at 160px 120px, #fff, rgba(0,0,0,0))',
                backgroundRepeat: 'repeat',
                backgroundSize: '200px 200px',
            }}></div>

            {/* Forest Silhouette at the bottom */}
            <div className={`absolute bottom-0 inset-x-0 h-[30vh] pointer-events-none z-10 transition-transform duration-1000 ${introStage === 1 ? 'translate-y-full' : 'translate-y-0'}`}>
                {/* Back layer of trees */}
                <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="absolute bottom-0 w-full h-full text-slate-900 fill-current opacity-80">
                    <path d="M0,100 L1000,100 L1000,60 L980,80 L960,40 L940,70 L920,30 L900,65 L880,25 L860,55 L840,15 L820,60 L800,20 L780,50 L760,35 L740,75 L720,25 L700,65 L680,15 L660,55 L640,30 L620,70 L600,20 L580,60 L560,10 L540,50 L520,25 L500,65 L480,15 L460,55 L440,30 L420,70 L400,20 L380,60 L360,10 L340,50 L320,25 L300,65 L280,15 L260,55 L240,30 L220,70 L200,20 L180,60 L160,10 L140,50 L120,25 L100,65 L80,15 L60,55 L40,30 L20,70 L0,20 Z" />
                </svg>
                {/* Front layer of trees */}
                <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="absolute bottom-0 w-full h-[80%] text-slate-950 fill-current">
                    <path d="M0,100 L1000,100 L1000,50 L970,80 L950,30 L920,70 L890,20 L860,60 L830,10 L800,50 L770,25 L740,65 L710,15 L680,55 L650,30 L620,70 L590,20 L560,60 L530,10 L500,50 L470,25 L440,65 L410,15 L380,55 L350,30 L320,70 L290,20 L260,60 L230,10 L200,50 L170,25 L140,65 L110,15 L80,55 L50,30 L20,70 L0,40 Z" />
                </svg>
            </div>

            {/* Shutters with glowing edges */}
            <div className={`absolute inset-x-0 top-0 h-1/2 bg-slate-950 z-20 border-b border-purple-500/20 shadow-[0_10px_40px_rgba(168,85,247,0.15)] ${introStage === 1 ? 'animate-shutter-top-reverse' : ''}`}></div>
            <div className={`absolute inset-x-0 bottom-0 h-1/2 bg-slate-950 z-20 border-t border-purple-500/20 shadow-[0_-10px_40px_rgba(168,85,247,0.15)] ${introStage === 1 ? 'animate-shutter-bottom-reverse' : ''}`}></div>
            
            {/* Cinematic Vignette */}
            <div className={`absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.85)_100%)] z-10 transition-opacity duration-1000 ${introStage === 1 ? 'opacity-0' : 'opacity-100'}`}></div>

            <div className={`relative z-30 flex flex-col items-center transition-all duration-1000 ease-[cubic-bezier(0.87,0,0.13,1)] ${introStage === 1 ? 'scale-[2] opacity-0 blur-3xl translate-y-10' : 'scale-100 opacity-100 blur-0 translate-y-0'}`}>
                <div className="relative animate-logo-fire-reveal flex items-center justify-center w-64 h-64">
                    {/* Purple Light Rays */}
                    <div className="absolute inset-[-200%] flex items-center justify-center animate-[spin_40s_linear_infinite] pointer-events-none z-0" style={{
                        maskImage: 'radial-gradient(circle at center, black 10%, transparent 60%)',
                        WebkitMaskImage: 'radial-gradient(circle at center, black 10%, transparent 60%)'
                    }}>
                        <div className="w-full h-full" style={{
                            background: 'repeating-conic-gradient(from 0deg, transparent 0deg 10deg, rgba(168, 85, 247, 0.3) 10deg 20deg, transparent 20deg 30deg, rgba(217, 70, 239, 0.2) 30deg 40deg)'
                        }}></div>
                    </div>

                    {/* Purple Sun Fire Surrounding Logo */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                        {/* Massive Sun Glow */}
                        <div className="absolute w-[200%] h-[200%] bg-[radial-gradient(circle,rgba(217,70,239,0.6)_0%,rgba(147,51,234,0.4)_30%,rgba(88,28,135,0.2)_50%,transparent_70%)] blur-[30px] animate-pulse-slow mix-blend-screen"></div>
                        
                        {/* Intense Core */}
                        <div className="absolute w-40 h-40 bg-white blur-[20px] opacity-40 animate-pulse mix-blend-screen rounded-full"></div>
                        <div className="absolute w-48 h-48 bg-fuchsia-400 blur-[25px] opacity-70 animate-fire-pulse mix-blend-screen rounded-full"></div>

                        {/* Corona / Licking Flames surrounding */}
                        <div className="absolute inset-0 flex items-center justify-center animate-[spin_15s_linear_infinite]">
                            <div className="absolute w-56 h-56 bg-gradient-to-t from-purple-700 via-fuchsia-500 to-transparent rounded-[40%_60%_70%_30%] blur-[8px] animate-flame-wobble mix-blend-screen opacity-90"></div>
                            <div className="absolute w-56 h-56 bg-gradient-to-r from-purple-700 via-fuchsia-500 to-transparent rounded-[60%_40%_30%_70%] blur-[8px] animate-flame-wobble mix-blend-screen opacity-90" style={{ animationDelay: '0.5s' }}></div>
                            <div className="absolute w-64 h-64 bg-gradient-to-b from-purple-800 via-pink-500 to-transparent rounded-[50%_50%_20%_20%] blur-[10px] animate-fire-wave-intense mix-blend-screen opacity-80 rotate-45" style={{ animationDelay: '0.2s' }}></div>
                            <div className="absolute w-64 h-64 bg-gradient-to-l from-purple-800 via-pink-500 to-transparent rounded-[20%_50%_50%_20%] blur-[10px] animate-fire-wave-intense mix-blend-screen opacity-80 -rotate-45" style={{ animationDelay: '0.7s' }}></div>
                        </div>
                        
                        {/* Counter-rotating flames */}
                        <div className="absolute inset-0 flex items-center justify-center animate-[spin_20s_linear_infinite_reverse]">
                            <div className="absolute w-60 h-60 bg-gradient-to-tr from-fuchsia-600 via-purple-500 to-transparent rounded-[30%_70%_70%_30%] blur-[12px] animate-flame-wobble mix-blend-screen opacity-70" style={{ animationDelay: '1s' }}></div>
                            <div className="absolute w-60 h-60 bg-gradient-to-bl from-pink-500 via-purple-600 to-transparent rounded-[70%_30%_30%_70%] blur-[12px] animate-fire-wave-intense mix-blend-screen opacity-70" style={{ animationDelay: '1.5s' }}></div>
                        </div>

                        {/* Radial Sparks */}
                        <div className="absolute w-full h-full animate-[spin_10s_linear_infinite]">
                            <div className="absolute top-0 left-1/2 w-2 h-2 bg-fuchsia-300 rounded-full animate-spark-rise opacity-0 blur-[1px]" style={{ animationDuration: '1.5s', animationDelay: '0.2s' }}></div>
                            <div className="absolute bottom-0 left-1/2 w-1.5 h-1.5 bg-purple-300 rounded-full animate-spark-rise opacity-0 blur-[1px]" style={{ animationDuration: '2.2s', animationDelay: '0.8s' }}></div>
                            <div className="absolute left-0 top-1/2 w-2.5 h-2.5 bg-pink-200 rounded-full animate-spark-rise opacity-0 blur-[1px]" style={{ animationDuration: '1.8s', animationDelay: '0.5s' }}></div>
                            <div className="absolute right-0 top-1/2 w-1 h-1 bg-white rounded-full animate-spark-rise opacity-0 blur-[1px]" style={{ animationDuration: '2.5s', animationDelay: '0.1s' }}></div>
                            <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-purple-200 rounded-full animate-spark-rise opacity-0 blur-[2px]" style={{ animationDuration: '1.7s', animationDelay: '0.9s' }}></div>
                            <div className="absolute bottom-1/4 right-1/4 w-1.5 h-1.5 bg-pink-100 rounded-full animate-spark-rise opacity-0 blur-[1px]" style={{ animationDuration: '2.0s', animationDelay: '0.3s' }}></div>
                        </div>
                    </div>
                    
                    {/* Logo Box */}
                    <div className="w-32 h-32 bg-gradient-to-tr from-purple-950 via-purple-800 to-fuchsia-600 rounded-[2.5rem] flex items-center justify-center shadow-[0_0_80px_rgba(168,85,247,0.8)] relative z-10 border border-fuchsia-300/40 animate-flame-dance">
                        <CheckSquare size={64} className="text-white drop-shadow-[0_0_20px_rgba(255,255,255,1)] animate-fire-flicker-intense" strokeWidth={2.5} />
                    </div>
                </div>
                <h1 className="mt-8 text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-white bg-[length:200%_auto] animate-light-sweep tracking-tighter drop-shadow-[0_0_30px_rgba(168,85,247,0.5)]">
                    Daily Task
                </h1>
                <div className="flex gap-3 mt-10">
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_15px_rgba(129,140,248,1)]" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse shadow-[0_0_15px_rgba(192,132,252,1)]" style={{ animationDelay: '200ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_15px_rgba(52,211,153,1)]" style={{ animationDelay: '400ms' }}></div>
                </div>
            </div>
        </div>
      )}
    </>
  );
};