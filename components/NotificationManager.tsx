import React, { useEffect, useState } from 'react';
import { Timer, AlertCircle, X, Bell, ChevronRight } from 'lucide-react';
import { DeadlineNotification } from '../hooks/useDeadlineNotifications';
import { useLanguage } from '../contexts/LanguageContext';

interface NotificationManagerProps {
  notifications: DeadlineNotification[];
  onDismiss: (id: string) => void;
}

export const NotificationManager: React.FC<NotificationManagerProps> = ({ notifications, onDismiss }) => {
  return (
    <div className="fixed top-6 right-6 z-[300] flex flex-col gap-4 pointer-events-none w-full max-w-[380px] px-4 md:px-0">
      {notifications.map((notif) => (
        <NotificationItem key={notif.id} notif={notif} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const NotificationItem: React.FC<{ notif: DeadlineNotification, onDismiss: (id: string) => void }> = ({ notif, onDismiss }) => {
  const { t } = useLanguage();
  const [isClosing, setIsClosing] = useState(false);
  const DURATION = 8000;
  
  useEffect(() => {
    const timer = setTimeout(() => {
        setIsClosing(true);
        setTimeout(() => onDismiss(notif.id), 400); // Wait for exit animation
    }, DURATION);
    return () => clearTimeout(timer);
  }, [notif.id, onDismiss]);

  const handleDismiss = () => {
      setIsClosing(true);
      setTimeout(() => onDismiss(notif.id), 400);
  };

  const isOverdue = notif.type === 'overdue';
  const isSummary = notif.type === 'summary';

  let accentColor = 'from-amber-400 to-orange-500';
  let shadowColor = 'shadow-orange-500/20';
  let iconBg = 'bg-gradient-to-br from-amber-400 to-orange-500 text-white';
  let titleColor = 'text-orange-600 dark:text-orange-400';
  let titleText = t.upcoming || 'Upcoming';
  let Icon = Timer;

  if (isOverdue) {
      accentColor = 'from-rose-500 to-red-600';
      shadowColor = 'shadow-rose-500/20';
      iconBg = 'bg-gradient-to-br from-rose-500 to-red-600 text-white';
      titleColor = 'text-rose-600 dark:text-rose-400';
      titleText = t.overdue || 'Overdue';
      Icon = AlertCircle;
  } else if (isSummary) {
      accentColor = 'from-indigo-500 to-violet-600';
      shadowColor = 'shadow-indigo-500/20';
      iconBg = 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white';
      titleColor = 'text-indigo-600 dark:text-indigo-400';
      titleText = t.dailySummaryTitle || 'Daily Summary';
      Icon = Bell;
  }

  return (
    <div className={`pointer-events-auto group relative flex flex-col p-1.5 rounded-[1.5rem] bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] ${isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'} transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.16)] dark:hover:shadow-[0_12px_40px_rgb(0,0,0,0.4)] border border-white/80 dark:border-white/10 overflow-hidden ${shadowColor}`}>
      {/* Animated Glow Background */}
      <div className={`absolute -inset-10 bg-gradient-to-br ${accentColor} opacity-[0.08] blur-2xl group-hover:opacity-[0.15] transition-opacity duration-500`}></div>

      <div className="relative flex items-start gap-4 p-3 z-10">
          <div className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center shrink-0 shadow-lg ${iconBg} transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 relative`}>
            <div className="absolute inset-0 rounded-[1.25rem] bg-white/20 animate-ping opacity-0 group-hover:opacity-100" style={{ animationDuration: '2s' }}></div>
            <Icon size={22} strokeWidth={2.5} className="relative z-10 drop-shadow-md" />
          </div>
          
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex justify-between items-center mb-1.5">
                <p className={`text-[11px] font-bold uppercase tracking-wider ${titleColor} flex items-center gap-1.5`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                  {titleText}
                </p>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    Just now
                </span>
            </div>
            <h4 className="text-[14px] font-semibold text-slate-800 dark:text-slate-100 leading-snug pr-6 drop-shadow-sm">
              {notif.taskText}
            </h4>
          </div>

          <button 
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all duration-200 hover:rotate-90"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
      </div>

      {/* Progress Bar */}
      <div className="h-1 w-full bg-slate-100/50 dark:bg-slate-800/50 rounded-b-[1.5rem] overflow-hidden mt-1 mx-1 w-[calc(100%-8px)]">
          <div 
            className={`h-full bg-gradient-to-r ${accentColor} rounded-full`}
            style={{ 
                width: '100%',
                animation: `shrink ${DURATION}ms linear forwards`
            }}
          ></div>
      </div>
    </div>
  );
};