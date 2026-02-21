import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Clock, AlertCircle, CheckCircle2, Flag
} from 'lucide-react';
import { Task, Group, Priority } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useRealtimeStorage } from '../hooks/useRealtimeStorage';

interface CalendarViewProps {
  activeGroup: Group | null;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ activeGroup }) => {
  const { t, language } = useLanguage();
  const [currentDate, setCurrentDate] = useState(new Date());

  // Storage Logic (same as TodoList)
  const storageKey = activeGroup ? `group_${activeGroup.id}_tasks` : 'daily_tasks';
  const isGlobalStorage = !!activeGroup;
  const [tasks] = useRealtimeStorage<Task[]>(storageKey, [], isGlobalStorage);

  // Calendar Logic
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const monthName = currentDate.toLocaleString(language, { month: 'long', year: 'numeric' });

  const calendarDays = useMemo(() => {
    const days = [];
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);

    // Previous month days
    const prevMonthTotalDays = daysInMonth(year, month - 1);
    for (let i = startDay - 1; i >= 0; i--) {
      days.push({
        day: prevMonthTotalDays - i,
        month: month - 1,
        year: year,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        day: i,
        month: month,
        year: year,
        isCurrentMonth: true,
      });
    }

    // Next month days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        day: i,
        month: month + 1,
        year: year,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [year, month]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach(task => {
      if (task.deadline && !task.archived) {
        try {
            const date = new Date(task.deadline).toISOString().split('T')[0];
            if (!map[date]) map[date] = [];
            map[date].push(task);
        } catch (e) {
            // Ignore invalid dates
        }
      }
    });
    return map;
  }, [tasks]);

  const priorityColors: Record<Priority, string> = {
    high: 'bg-rose-500',
    medium: 'bg-amber-500',
    low: 'bg-emerald-500'
  };

  return (
    <div className="flex flex-col h-full bg-white/50 backdrop-blur-xl">
      {/* Header */}
      <div className="p-6 border-b border-slate-200/50 flex items-center justify-between bg-white/80">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200">
            <CalendarIcon size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 capitalize">{monthName}</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{activeGroup ? activeGroup.name : t.personal}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={goToToday} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-95 shadow-sm">
            {t.today}
          </button>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button onClick={prevMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600">
              <ChevronLeft size={20} />
            </button>
            <button onClick={nextMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-hidden flex flex-col p-4">
        {/* Weekdays */}
        <div className="grid grid-cols-7 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest py-2">
              {d}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="flex-1 grid grid-cols-7 grid-rows-6 gap-2">
          {calendarDays.map((date, i) => {
            const dateStr = new Date(date.year, date.month, date.day).toISOString().split('T')[0];
            const dayTasks = tasksByDate[dateStr] || [];
            const isToday = new Date().toISOString().split('T')[0] === dateStr;

            return (
              <div 
                key={i} 
                className={`
                  relative p-2 rounded-2xl border transition-all flex flex-col gap-1 overflow-hidden
                  ${date.isCurrentMonth ? 'bg-white border-slate-100' : 'bg-slate-50/50 border-transparent opacity-40'}
                  ${isToday ? 'ring-2 ring-indigo-500 ring-offset-2' : 'shadow-sm'}
                `}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-sm font-black ${isToday ? 'text-indigo-600' : 'text-slate-700'}`}>
                    {date.day}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">
                      {dayTasks.length}
                    </span>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-none space-y-1">
                  {dayTasks.map(task => (
                    <div 
                      key={task.id}
                      className={`
                        px-2 py-1 rounded-lg text-[10px] font-bold truncate flex items-center gap-1.5
                        ${task.completed ? 'bg-slate-100 text-slate-400 line-through' : 'bg-white border border-slate-100 text-slate-700 shadow-sm'}
                      `}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityColors[task.priority || 'medium']}`}></div>
                      {task.text}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};