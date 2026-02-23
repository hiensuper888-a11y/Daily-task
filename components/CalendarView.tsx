import React, { useState, useMemo, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Clock, AlertCircle, CheckCircle2, Flag, Plus, RefreshCw, Trash2
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
  const [selectedDate, setSelectedDate] = useState<string | null>(new Date().toLocaleDateString('en-CA'));
  const [currentTime, setCurrentTime] = useState(new Date());

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Storage Logic (same as TodoList)
  const storageKey = activeGroup ? `group_${activeGroup.id}_tasks` : 'daily_tasks';
  const isGlobalStorage = !!activeGroup;
  const [tasks, setTasks] = useRealtimeStorage<Task[]>(storageKey, [], isGlobalStorage);
  const [quickTaskText, setQuickTaskText] = useState('');

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach(task => {
      if (!task.archived) {
        try {
            const dateStr = task.deadline ? new Date(task.deadline).toLocaleDateString('en-CA') : new Date(task.createdAt).toLocaleDateString('en-CA');
            if (!map[dateStr]) map[dateStr] = [];
            map[dateStr].push(task);
        } catch (e) {
            // Ignore invalid dates
        }
      }
    });
    return map;
  }, [tasks]);

  // Calendar Logic
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today.toLocaleDateString('en-CA'));
  };

  const selectedDayTasks = useMemo(() => {
    return selectedDate ? tasksByDate[selectedDate] || [] : [];
  }, [selectedDate, tasksByDate]);

  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return '';
    const date = new Date(selectedDate);
    return date.toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }, [selectedDate, language]);

  const isSelectedToday = useMemo(() => {
    return selectedDate === new Date().toLocaleDateString('en-CA');
  }, [selectedDate]);

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

  const handleAddQuickTask = () => {
    if (!quickTaskText.trim() || !selectedDate) return;

    const newTask: Task = {
      id: Date.now(),
      text: quickTaskText,
      completed: false,
      progress: 0,
      createdAt: new Date().toISOString(),
      deadline: new Date(selectedDate).toISOString(),
      priority: 'medium',
      subtasks: [],
      groupId: activeGroup?.id
    };

    setTasks(prev => [newTask, ...prev]);
    setQuickTaskText('');
  };

  const handleDeleteTask = (taskId: number) => {
    if (confirm(t.deleteTaskConfirm)) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
    }
  };

  const priorityColors: Record<Priority, string> = {
    high: 'bg-rose-500',
    medium: 'bg-amber-500',
    low: 'bg-emerald-500'
  };

  return (
    <div className="flex flex-col h-full bg-white/50 backdrop-blur-xl dark:bg-slate-900/50">
      {/* Header */}
      <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between bg-white/80 dark:bg-slate-800/80">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20">
            <CalendarIcon size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 dark:text-slate-100 capitalize">{monthName}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{activeGroup ? activeGroup.name : t.personal}</p>
              <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
              <div className="flex items-center gap-1 text-xs font-black text-indigo-600 dark:text-indigo-400">
                <Clock size={12} />
                {currentTime.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={goToToday} 
            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95 shadow-sm"
          >
            {t.today}
          </button>
          <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button onClick={prevMonth} className="p-2 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm rounded-lg transition-all text-slate-600 dark:text-slate-400">
              <ChevronLeft size={20} />
            </button>
            <button onClick={nextMonth} className="p-2 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm rounded-lg transition-all text-slate-600 dark:text-slate-400">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid & Side Panel */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row p-4 gap-4">
        {/* Main Calendar */}
        <div className="flex-[3] flex flex-col">
          {/* Weekdays */}
          <div className="grid grid-cols-7 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="flex-1 grid grid-cols-7 grid-rows-6 gap-2">
            {calendarDays.map((date, i) => {
              const dateObj = new Date(date.year, date.month, date.day);
              const dateStr = dateObj.toLocaleDateString('en-CA');
              const dayTasks = tasksByDate[dateStr] || [];
              const isToday = new Date().toLocaleDateString('en-CA') === dateStr;
              const isSelected = selectedDate === dateStr;

              return (
                <div 
                  key={i} 
                  onClick={() => setSelectedDate(dateStr)}
                  className={`
                    relative p-2 rounded-2xl border transition-all flex flex-col gap-1 overflow-hidden cursor-pointer group
                    ${date.isCurrentMonth ? 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700' : 'bg-slate-50/50 dark:bg-slate-900/30 border-transparent opacity-40'}
                    ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 z-10' : 'shadow-sm hover:border-indigo-200 dark:hover:border-indigo-800'}
                    ${isToday && !isSelected ? 'border-indigo-500/50' : ''}
                  `}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-sm font-black ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'}`}>
                      {date.day}
                    </span>
                    <div className="flex items-center gap-1">
                      {dayTasks.length > 0 && (
                        <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-md">
                          {dayTasks.length}
                        </span>
                      )}
                      {isSelected && (
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto scrollbar-none space-y-1">
                    {dayTasks.slice(0, 3).map(task => (
                      <div 
                        key={task.id}
                        className={`
                          px-2 py-1 rounded-lg text-[10px] font-bold truncate flex items-center gap-1.5
                          ${task.completed ? 'bg-slate-100 dark:bg-slate-700/50 text-slate-400 dark:text-slate-500 line-through' : 'bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 text-slate-700 dark:text-slate-200 shadow-sm'}
                        `}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityColors[task.priority || 'medium']}`}></div>
                        {task.text}
                      </div>
                    ))}
                    {dayTasks.length > 3 && (
                      <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 pl-1">
                        + {dayTasks.length - 3} more
                      </p>
                    )}
                  </div>

                  {/* Quick Add Button on Hover */}
                  <button className="absolute bottom-2 right-2 p-1.5 bg-indigo-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40">
                    <Plus size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Side Panel: Selected Day Tasks */}
        <div className="flex-1 bg-white/80 dark:bg-slate-800/80 rounded-[2rem] border border-slate-200/50 dark:border-slate-700/50 shadow-xl overflow-hidden flex flex-col animate-scale-in">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                {isSelectedToday ? t.today : t.selectedDay || 'Selected Day'}
              </h2>
              {!isSelectedToday && (
                <button 
                  onClick={goToToday}
                  className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <RefreshCw size={10} /> {t.backToToday || 'Back to Today'}
                </button>
              )}
            </div>
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 leading-tight">
              {formattedSelectedDate}
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {selectedDayTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400 dark:text-slate-500 opacity-50">
                <AlertCircle size={48} className="mb-4" />
                <p className="font-bold text-sm">{t.emptyTasks}</p>
              </div>
            ) : (
              selectedDayTasks.map(task => (
                <div 
                  key={task.id}
                  className={`
                    p-4 rounded-2xl border transition-all group
                    ${task.completed ? 'bg-slate-50 dark:bg-slate-900/30 border-transparent' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md'}
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${priorityColors[task.priority || 'medium']}`}></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <p className={`text-sm font-bold leading-tight ${task.completed ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                          {task.text}
                        </p>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                          className="p-1 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        {task.completed ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                            <CheckCircle2 size={12} /> {t.completed}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                            <Clock size={12} /> {t.active}
                          </span>
                        )}
                        {task.priority && (
                          <span className="text-[10px] font-black uppercase text-slate-300 dark:text-slate-600">
                            {task.priority}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-6 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-700/50 space-y-3">
            <div className="relative">
              <input 
                type="text"
                value={quickTaskText}
                onChange={(e) => setQuickTaskText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddQuickTask()}
                placeholder={t.addTaskPlaceholder}
                className="w-full py-3 pl-4 pr-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
              <button 
                onClick={handleAddQuickTask}
                disabled={!quickTaskText.trim()}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all ${quickTaskText.trim() ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20' : 'text-slate-300 dark:text-slate-600'}`}
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
