import React, { useEffect } from 'react';
import { Timer, AlertCircle, X, Bell } from 'lucide-react';
import { DeadlineNotification } from '../hooks/useDeadlineNotifications';

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
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(notif.id), 8000);
    return () => clearTimeout(timer);
  }, [notif.id, onDismiss]);

  const isOverdue = notif.type === 'overdue';

  return (
    <div className={`pointer-events-auto group relative flex items-center gap-3 p-4 rounded-2xl bg-white/90 backdrop-blur-xl shadow-2xl animate-slide-in-right transition-all hover:scale-[1.02] border border-white/60 overflow-hidden ${
      isOverdue ? 'shadow-rose-500/10' : 'shadow-amber-500/10'
    }`}>
      {/* Background Accent */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isOverdue ? 'bg-rose-500' : 'bg-amber-500'}`}></div>

      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${
        isOverdue ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
      }`}>
        {isOverdue ? <AlertCircle size={20} strokeWidth={2.5} /> : <Timer size={20} strokeWidth={2.5} />}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-0.5">
            <p className={`text-[9px] font-black uppercase tracking-wider ${
            isOverdue ? 'text-rose-500' : 'text-amber-500'
            }`}>
            {isOverdue ? 'Overdue' : 'Upcoming'}
            </p>
            <span className="text-[9px] text-slate-300 font-medium">Just now</span>
        </div>
        <h4 className="text-xs font-bold text-slate-800 leading-tight truncate">
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