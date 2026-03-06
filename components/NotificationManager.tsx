import React, { useEffect } from 'react';
import { Timer, AlertCircle, X, Bell } from 'lucide-react';
import { DeadlineNotification } from '../hooks/useDeadlineNotifications';
import { useLanguage } from '../contexts/LanguageContext';

interface NotificationManagerProps {
  notifications: DeadlineNotification[];
  onDismiss: (id: string) => void;
}

export const NotificationManager: React.FC<NotificationManagerProps> = ({ notifications, onDismiss }) => {
  return (
    <div className="fixed top-6 right-6 z-[300] flex flex-col gap-3 pointer-events-none w-full max-w-sm px-4 md:px-0">
      {notifications.map((notif) => (
        <NotificationItem key={notif.id} notif={notif} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const NotificationItem: React.FC<{ notif: DeadlineNotification, onDismiss: (id: string) => void }> = ({ notif, onDismiss }) => {
  const { t } = useLanguage();
  
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(notif.id), 8000);
    return () => clearTimeout(timer);
  }, [notif.id, onDismiss]);

  const isOverdue = notif.type === 'overdue';
  const isSummary = notif.type === 'summary';

  let accentColor = 'bg-amber-500';
  let shadowColor = 'shadow-amber-500/10';
  let iconBg = 'bg-amber-50 text-amber-600';
  let titleColor = 'text-amber-500';
  let titleText = t.upcoming || 'Upcoming';
  let Icon = Timer;

  if (isOverdue) {
      accentColor = 'bg-rose-500';
      shadowColor = 'shadow-rose-500/10';
      iconBg = 'bg-rose-50 text-rose-600';
      titleColor = 'text-rose-500';
      titleText = t.overdue || 'Overdue';
      Icon = AlertCircle;
  } else if (isSummary) {
      accentColor = 'bg-indigo-500';
      shadowColor = 'shadow-indigo-500/10';
      iconBg = 'bg-indigo-50 text-indigo-600';
      titleColor = 'text-indigo-500';
      titleText = t.dailySummaryTitle || 'Daily Summary';
      Icon = Bell;
  }

  return (
    <div className={`pointer-events-auto group relative flex items-center gap-3 p-4 rounded-2xl bg-white/90 backdrop-blur-xl shadow-2xl animate-slide-in-right transition-all hover:scale-[1.02] border border-white/60 overflow-hidden ${shadowColor}`}>
      {/* Background Accent */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${accentColor}`}></div>

      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${iconBg}`}>
        <Icon size={20} strokeWidth={2.5} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-0.5">
            <p className={`text-[9px] font-black uppercase tracking-wider ${titleColor}`}>
            {titleText}
            </p>
            <span className="text-[9px] text-slate-300 font-medium">Just now</span>
        </div>
        <h4 className="text-xs font-bold text-slate-800 leading-tight">
          {notif.taskText}
        </h4>
      </div>

      <button 
        onClick={() => onDismiss(notif.id)}
        className="p-1.5 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
};