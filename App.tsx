import React, { useState } from 'react';
import { ListTodo, Wand2 } from 'lucide-react';
import { TodoList } from './components/TodoList';
import { ImageEditor } from './components/ImageEditor';
import { AppTab } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('tasks');

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-800">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 h-[85vh] flex flex-col relative">
        
        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden relative">
          {/* We render both to keep state when switching, or we could conditionally render. 
              Conditional rendering is better for performance here unless we want to keep scroll position strictly.
              Let's simple conditional render.
          */}
          {activeTab === 'tasks' ? <TodoList /> : <ImageEditor />}
        </div>

        {/* Bottom Navigation */}
        <div className="bg-white border-t border-slate-200 p-2 flex justify-around items-center shrink-0">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex flex-col items-center justify-center p-2 rounded-xl flex-1 transition-all duration-200 ${
              activeTab === 'tasks' 
                ? 'text-blue-600 bg-blue-50' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            <ListTodo size={24} className={activeTab === 'tasks' ? 'stroke-[2.5px]' : ''} />
            <span className="text-xs font-medium mt-1">Công việc</span>
          </button>
          
          <button
            onClick={() => setActiveTab('studio')}
            className={`flex flex-col items-center justify-center p-2 rounded-xl flex-1 transition-all duration-200 ${
              activeTab === 'studio' 
                ? 'text-purple-600 bg-purple-50' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Wand2 size={24} className={activeTab === 'studio' ? 'stroke-[2.5px]' : ''} />
            <span className="text-xs font-medium mt-1">AI Studio</span>
          </button>
        </div>

      </div>
    </div>
  );
}