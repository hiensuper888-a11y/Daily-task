import React, { useEffect } from 'react';
import { Timer, AlertCircle, X, Bell } from 'lucide-react';
import { DeadlineNotification } from '../hooks/useDeadlineNotifications';

interface NotificationManagerProps {
  notifications: DeadlineNotification[];
  onDismiss: (id: string) => void;
}

export const NotificationManager: React.FC<NotificationManagerProps> = ({ notifications, onDismiss }) => {
  return (
    <div className="fixed top-6 right-6 z-[200] flex flex-col gap-4 pointer-events-none w-full max-w-sm px-4 md:px-0">
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
    <div className={`pointer-events-auto group relative flex items-start gap-4 p-5 rounded-[1.8rem] border-2 bg-white/95 backdrop-blur-2xl shadow-2xl animate-slide-in-right transition-all hover:scale-[1.02] overflow-hidden ${
      isOverdue ? 'border-rose-100' : 'border-amber-100'
    }`}>
      {/* Visual Timer Progress Bar */}
      <div className={`absolute bottom-0 left-0 h-1 animate-progress z-0 opacity-30 ${isOverdue ? 'bg-rose-500' : 'bg-amber-500'}`}></div>

      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm relative z-10 ${
        isOverdue ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
      }`}>
        {isOverdue ? <AlertCircle size={24} strokeWidth={2.5} /> : <Timer size={24} strokeWidth={2.5} />}
      </div>
      
      <div className="flex-1 min-w-0 pr-6 relative z-10">
        <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${
          isOverdue ? 'text-rose-500' : 'text-amber-500'
        }`}>
          {isOverdue ? 'Đã quá hạn' : 'Sắp đến hạn'}
        </p>
        <h4 className="text-sm font-bold text-slate-800 leading-tight truncate">
          {notif.taskText}
        </h4>
        <p className="text-[11px] text-slate-400 mt-1 font-medium italic">
          {isOverdue ? 'Vui lòng hoàn thành ngay!' : 'Còn chưa đầy 60 phút.'}
        </p>
      </div>

      <button 
        onClick={() => onDismiss(notif.id)}
        className="absolute top-4 right-4 p-1 text-slate-300 hover:text-slate-600 transition-colors z-20"
      >
        <X size={16} />
      </button>

      <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1/2 rounded-r-full ${
        isOverdue ? 'bg-rose-500' : 'bg-amber-500'
      }`}></div>
    </div>
  );
};