import React, { useState, useEffect, useRef } from 'react';
import { User, LogOut, Mail, Save, Calendar, MapPin, Home, Briefcase, Camera, Phone, LayoutDashboard, Building2, UserSquare } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { UserProfile } from '../types';
import { useRealtimeStorage, SESSION_KEY } from '../hooks/useRealtimeStorage';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { 
  auth, 
  isFirebaseConfigured,
  signOut, 
  updateProfile 
} from '../services/firebaseConfig';

const DEFAULT_PROFILE: UserProfile = {
    uid: '',
    name: '',
    email: '',
    avatar: '',
    provider: null,
    isLoggedIn: false,
    birthYear: '',
    hometown: '',
    address: '',
    company: '',
    phoneNumber: '',
    jobTitle: '',
    department: ''
};

export const Profile: React.FC = () => {
  const { t } = useLanguage();
  
  // Hooks
  const [profile, setProfile] = useRealtimeStorage<UserProfile>('user_profile', DEFAULT_PROFILE);
  const [isEditing, setIsEditing] = useState(false);
  const isOnline = useOnlineStatus();
  
  const [editForm, setEditForm] = useState(profile);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
        setEditForm(profile);
    }
  }, [profile, isEditing]);

  const logout = () => { 
      if (isFirebaseConfigured() && auth) signOut(auth).catch(console.error); 
      setProfile(DEFAULT_PROFILE); 
      localStorage.removeItem(SESSION_KEY); 
      localStorage.removeItem('user_profile'); // Clear current profile from storage
      window.dispatchEvent(new Event('auth-change')); 
      window.dispatchEvent(new Event('local-storage'));
      // App.tsx will detect isLoggedIn is false (or profile missing) and switch to AuthScreen
  };

  const handleSave = async () => { 
      setProfile(editForm); 
      setIsEditing(false); 
      try { 
          if (isFirebaseConfigured() && auth && auth.currentUser) await updateProfile(auth.currentUser, { displayName: editForm.name, photoURL: editForm.avatar }); 
      } catch (error) {} 
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { const { name, value } = e.target; setEditForm(prev => ({ ...prev, [name]: value })); };
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setEditForm(prev => ({ ...prev, avatar: reader.result as string })); }; reader.readAsDataURL(file); } e.target.value = ''; };

  const renderProfileScreen = () => (
    <div className="w-full max-w-5xl mx-auto animate-fade-in pb-28 pt-4 px-4">
        {/* Header Card */}
        <div className="glass-panel rounded-[2.5rem] p-6 md:p-10 mb-6 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group border-white/60">
             <div className="absolute top-0 right-0 p-32 bg-gradient-to-br from-indigo-50 to-pink-50 rounded-full blur-3xl -z-10 opacity-60"></div>
             
             <div className="relative group">
                 <div className="w-32 h-32 rounded-[2rem] p-1.5 bg-white shadow-lg relative z-10 border border-slate-100">
                     <img src={editForm.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=default"} className="w-full h-full rounded-[1.7rem] object-cover bg-slate-50" alt="Avatar"/>
                     {isEditing && (
                        <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-2.5 rounded-xl shadow-md hover:scale-110 transition-transform ring-4 ring-white">
                            <Camera size={16}/>
                        </button>
                     )}
                     <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />
                 </div>
             </div>

             <div className="flex-1 text-center md:text-left relative z-10">
                 {isEditing ? (
                     <input name="name" value={editForm.name} onChange={handleInputChange} className="text-3xl font-black text-slate-800 bg-slate-50 border-b-2 border-indigo-500 outline-none w-full md:w-auto text-center md:text-left rounded-lg px-2 py-1"/>
                 ) : (
                     <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-1">{profile.name}</h2>
                 )}
                 <p className="text-slate-400 font-medium flex items-center justify-center md:justify-start gap-1.5 text-sm mb-4 bg-slate-50 inline-block px-3 py-1 rounded-full border border-slate-100">
                     <Mail size={14}/> {profile.email}
                 </p>
                 
                 <div className="flex gap-3 justify-center md:justify-start">
                     {isEditing ? (
                         <button onClick={handleSave} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md hover:bg-indigo-700 transition-colors flex items-center gap-2"><Save size={16}/> {t.save}</button>
                     ) : (
                         <button onClick={() => setIsEditing(true)} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors flex items-center gap-2 border border-slate-200"><LayoutDashboard size={16}/> {t.edit}</button>
                     )}
                     <button onClick={logout} className="px-4 py-2.5 bg-red-50 text-red-500 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors border border-red-100"><LogOut size={16}/></button>
                 </div>
             </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoCard title={t.personalInfo} icon={User} color="orange">
                <InfoRow icon={Calendar} label={t.birthYear} name="birthYear" value={editForm.birthYear} isEditing={isEditing} onChange={handleInputChange} />
                <InfoRow icon={Phone} label={t.phoneNumber} name="phoneNumber" value={editForm.phoneNumber} isEditing={isEditing} onChange={handleInputChange} />
                <InfoRow icon={Home} label={t.address} name="address" value={editForm.address} isEditing={isEditing} onChange={handleInputChange} />
            </InfoCard>

            <InfoCard title={t.work} icon={Briefcase} color="blue">
                 <InfoRow icon={Briefcase} label={t.company} name="company" value={editForm.company} isEditing={isEditing} onChange={handleInputChange} />
                 <InfoRow icon={UserSquare} label={t.jobTitle} name="jobTitle" value={editForm.jobTitle} isEditing={isEditing} onChange={handleInputChange} />
                 <InfoRow icon={Building2} label={t.department} name="department" value={editForm.department} isEditing={isEditing} onChange={handleInputChange} />
                 <InfoRow icon={MapPin} label={t.hometown} name="hometown" value={editForm.hometown} isEditing={isEditing} onChange={handleInputChange} />
                 <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t.statusLabel}</span>
                     <span className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                         <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                         {isOnline ? 'Online' : 'Offline'}
                     </span>
                 </div>
            </InfoCard>
        </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-transparent overflow-y-auto custom-scrollbar">
       {renderProfileScreen()}
    </div>
  );
};

// Helper Components for Cleaner Code
const InfoCard = ({ title, icon: Icon, color, children }: any) => {
    const colorClasses = {
        orange: 'bg-orange-50 text-orange-600',
        blue: 'bg-blue-50 text-blue-600'
    };
    return (
        <div className="glass-panel rounded-[2rem] p-8 hover:shadow-lg transition-shadow border-white/60">
            <div className="flex items-center gap-3 mb-6">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${colorClasses[color as keyof typeof colorClasses]}`}>
                    <Icon size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            </div>
            <div className="space-y-5">{children}</div>
        </div>
    );
};

const InfoRow = ({ icon: Icon, label, name, value, isEditing, onChange }: any) => {
    const { t } = useLanguage();
    return (
        <div className="group">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">{label}</label>
            {isEditing ? (
                <input name={name} value={value} onChange={onChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-200 outline-none transition-all"/>
            ) : (
                <div className="text-sm font-bold text-slate-700 flex items-center gap-3 h-10 border-b border-slate-50">
                    <Icon size={16} className="text-slate-300"/>
                    {value || <span className="text-slate-300 italic font-normal text-xs">{t.notUpdated}</span>}
                </div>
            )}
        </div>
    );
};