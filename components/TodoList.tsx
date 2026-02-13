import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle, Circle, Calendar, ListFilter, X } from 'lucide-react';
import { Task, FilterType } from '../types';

export const TodoList: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const savedTasks = localStorage.getItem('daily_tasks');
      if (!savedTasks) return [];
      const parsed = JSON.parse(savedTasks);
      return parsed.map((t: any) => ({
        ...t,
        progress: t.progress !== undefined ? t.progress : (t.completed ? 100 : 0)
      }));
    } catch (e) {
      return [];
    }
  });

  const [inputValue, setInputValue] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    localStorage.setItem('daily_tasks', JSON.stringify(tasks));
  }, [tasks]);

  const currentDate = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const addTask = () => {
    if (inputValue.trim() === '') return;
    const newTask: Task = {
      id: Date.now(),
      text: inputValue,
      completed: false,
      progress: 0,
      createdAt: new Date().toISOString()
    };
    setTasks([newTask, ...tasks]);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') addTask();
  };

  const toggleTask = (id: number) => {
    setTasks(tasks.map(task => {
      if (task.id === id) {
        const newCompleted = !task.completed;
        return { 
          ...task, 
          completed: newCompleted,
          progress: newCompleted ? 100 : 0 
        };
      }
      return task;
    }));
  };

  const updateProgress = (id: number, newProgress: string) => {
    const progressVal = parseInt(newProgress, 10);
    setTasks(tasks.map(task => 
      task.id === id ? { 
        ...task, 
        progress: progressVal,
        completed: progressVal === 100 
      } : task
    ));
  };

  const deleteTask = (id: number) => {
    setTasks(tasks.filter(task => task.id !== id));
  };

  const clearCompleted = () => {
    setTasks(tasks.filter(task => !task.completed));
  };

  const totalTasks = tasks.length;
  const totalProgressSum = tasks.reduce((sum, task) => sum + task.progress, 0);
  const overallProgress = totalTasks === 0 ? 0 : Math.round(totalProgressSum / totalTasks);
  const completedCount = tasks.filter(t => t.completed).length;

  const filteredTasks = tasks.filter(task => {
    if (filter === 'active') return !task.completed;
    if (filter === 'completed') return task.completed;
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shrink-0">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold">Việc Cần Làm</h1>
            <p className="text-blue-100 text-sm flex items-center mt-1 capitalize">
              <Calendar size={14} className="mr-1" />
              {currentDate}
            </p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-bold">{overallProgress}%</span>
            <p className="text-xs text-blue-100 uppercase tracking-wider">Tiến độ ngày</p>
          </div>
        </div>

        <div className="w-full bg-blue-900/30 h-3 rounded-full overflow-hidden relative">
          <div 
            className="bg-white h-full transition-all duration-500 ease-out rounded-full relative z-10"
            style={{ width: `${overallProgress}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-xs text-blue-100 mt-2">
          <span>Đã xong: {completedCount}/{totalTasks} việc</span>
          <span>{overallProgress === 100 && totalTasks > 0 ? "Tuyệt vời!" : "Cố lên!"}</span>
        </div>
      </div>

      {/* Input Section */}
      <div className="p-4 border-b border-slate-100 shrink-0">
        <div className="relative">
          <input
            type="text"
            placeholder="Thêm công việc mới..."
            className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={addTask}
            className="absolute right-2 top-2 bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-lg transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 text-sm text-slate-500 font-medium border-b border-slate-100 shrink-0">
        <div className="flex space-x-1">
          {(['all', 'active', 'completed'] as FilterType[]).map((f) => (
             <button 
             key={f}
             onClick={() => setFilter(f)}
             className={`px-3 py-1 rounded-full transition-colors capitalize ${filter === f ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200'}`}
           >
             {f === 'all' ? 'Tất cả' : f === 'active' ? 'Đang làm' : 'Đã xong'}
           </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <ListFilter size={48} className="mx-auto mb-2 opacity-20" />
            <p>Chưa có công việc nào.</p>
          </div>
        ) : (
          <ul className="space-y-3 mt-3">
            {filteredTasks.map((task) => (
              <li 
                key={task.id} 
                className={`group p-3 rounded-xl border transition-all duration-200 ${
                  task.completed 
                    ? 'bg-slate-50 border-slate-100' 
                    : 'bg-white border-slate-200 shadow-sm hover:border-blue-300'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3 overflow-hidden w-full">
                    <button 
                      onClick={() => toggleTask(task.id)}
                      className={`flex-shrink-0 transition-colors ${
                        task.completed ? 'text-green-500' : 'text-slate-300 hover:text-blue-500'
                      }`}
                    >
                      {task.completed ? <CheckCircle size={22} className="fill-current" /> : <Circle size={22} />}
                    </button>
                    <span 
                      className={`truncate font-medium transition-all select-none cursor-pointer flex-grow ${
                        task.completed ? 'line-through text-slate-400' : 'text-slate-700'
                      }`}
                      onClick={() => toggleTask(task.id)}
                    >
                      {task.text}
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => deleteTask(task.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors ml-2"
                    title="Xóa"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                {/* Individual Task Progress Slider */}
                <div className="flex items-center gap-3 pl-9 pr-1">
                  <div className="relative flex-grow h-6 flex items-center">
                     <input
                      type="range"
                      min="0"
                      max="100"
                      value={task.progress}
                      onChange={(e) => updateProgress(task.id, e.target.value)}
                      className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer transition-colors ${
                        task.completed ? 'bg-green-200' : 'bg-slate-200'
                      } accent-blue-600`}
                    />
                  </div>
                  <span className={`text-xs font-bold w-9 text-right ${
                    task.completed ? 'text-green-600' : 'text-blue-600'
                  }`}>
                    {task.progress}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      {completedCount > 0 && (
        <div className="bg-slate-50 p-3 text-center border-t border-slate-100 shrink-0">
          <button 
            onClick={clearCompleted}
            className="text-xs text-slate-500 hover:text-red-600 flex items-center justify-center gap-1 mx-auto transition-colors"
          >
            <X size={12} /> Xóa các việc đã hoàn thành
          </button>
        </div>
      )}
    </div>
  );
};