import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckSquare, MessageSquare, Wand2, BarChart3, UserCircle2, 
  LayoutGrid, X, GripHorizontal, GripVertical, Calendar, Shield
} from 'lucide-react';
import { AppTab, UserProfile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useRealtimeStorage } from '../hooks/useRealtimeStorage';

interface FloatingDockProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  onTabChange?: () => void;
}

export const FloatingDock: React.FC<FloatingDockProps> = ({ activeTab, setActiveTab, onTabChange }) => {
  const { t } = useLanguage();
  const [userProfile] = useRealtimeStorage<UserProfile>('user_profile', { 
      name: 'User', email: '', avatar: '', provider: null, isLoggedIn: false, uid: '' 
  });
  
  const isAdmin = userProfile.email === 'admin@dailytask.com';
  
  // FIX: Move default Y position up (minus 150px) to clear the bottom Add button area
  const [position, setPosition] = useState({ 
      x: typeof window !== 'undefined' ? window.innerWidth - 80 : 0, 
      y: typeof window !== 'undefined' ? window.innerHeight - 160 : 0 
  });
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false); 
  
  // Drag logic refs
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dockStartPos = useRef({ x: 0, y: 0 });
  const isDragGesture = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const COLLAPSE_TIMEOUT = 5000;
  const EDGE_THRESHOLD = 80; 

  const isVertical = position.x < EDGE_THRESHOLD || position.x > window.innerWidth - EDGE_THRESHOLD - 80;

  const resetIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (isExpanded) {
      idleTimerRef.current = setTimeout(() => {
        setIsExpanded(false);
      }, COLLAPSE_TIMEOUT);
    }
  };

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [isExpanded]);

  // Handle Resize
  useEffect(() => {
      const handleResize = () => {
          if (!hasMoved) {
              // Keep relative position on resize
              setPosition({ x: window.innerWidth - 80, y: window.innerHeight - 160 });
          } else {
              // Clamp to screen
              setPosition(prev => ({
                  x: Math.min(Math.max(20, prev.x), window.innerWidth - 80),
                  y: Math.min(Math.max(20, prev.y), window.innerHeight - 80)
              }));
          }
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, [hasMoved]);

  // Handle Dragging
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button') && isExpanded) return;

    e.preventDefault();
    setIsDragging(true);
    isDragGesture.current = false;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dockStartPos.current = { ...position };

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      isDragGesture.current = true;
      setHasMoved(true);
    }

    setPosition({
      x: dockStartPos.current.x + dx,
      y: dockStartPos.current.y + dy
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    const padding = 16;
    let newX = position.x;
    let newY = position.y;

    if (newX < padding) newX = padding;
    if (newX > window.innerWidth - 80) newX = window.innerWidth - 80;
    if (newY < padding) newY = padding;
    if (newY > window.innerHeight - 80) newY = window.innerHeight - 80;

    if (!isDragging && (newX !== position.x || newY !== position.y)) {
        setPosition({ x: newX, y: newY });
    }

    if (!isDragGesture.current && !isExpanded) {
      setIsExpanded(true);
    }
  };

  const handleTabClick = (id: AppTab) => {
    setActiveTab(id);
    if (onTabChange) onTabChange();
    resetIdleTimer();
  };

  const menuItems = [
    { id: 'tasks', icon: CheckSquare, label: t.tasks, color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/40', text: 'text-blue-600' },
    { id: 'calendar', icon: Calendar, label: t.calendar, color: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/40', text: 'text-emerald-600' },
    { id: 'ai', icon: MessageSquare, label: 'AI', color: 'from-violet-500 to-purple-600', shadow: 'shadow-purple-500/40', text: 'text-purple-600' },
    { id: 'studio', icon: Wand2, label: 'Studio', color: 'from-fuchsia-500 to-pink-600', shadow: 'shadow-pink-500/40', text: 'text-pink-600' },
    { id: 'reports', icon: BarChart3, label: 'Stats', color: 'from-amber-400 to-orange-500', shadow: 'shadow-orange-500/40', text: 'text-orange-600' },
    { id: 'profile', icon: UserCircle2, label: t.profile, color: 'from-slate-500 to-slate-700', shadow: 'shadow-slate-500/40', text: 'text-slate-600' },
  ];

  if (isAdmin) {
      menuItems.push({ id: 'admin', icon: Shield, label: 'Admin', color: 'from-slate-800 to-black', shadow: 'shadow-slate-900/40', text: 'text-slate-900' });
  }

  return (
    <div 
      className="fixed z-[9999] touch-none select-none"
      style={{ 
        left: position.x, 
        top: position.y,
        transition: isDragging ? 'none' : 'top 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), left 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}
      onMouseEnter={resetIdleTimer}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* COLLAPSED STATE (The "Magic Orb") */}
      <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isExpanded ? 'opacity-0 scale-50 pointer-events-none' : 'opacity-100 scale-100'}`}>
        <div className="group relative w-14 h-14 cursor-pointer">
            <div className="absolute inset-0 bg-slate-900 rounded-2xl shadow-lg transform rotate-3 transition-transform group-hover:rotate-6 opacity-30"></div>
            <div className="relative w-full h-full rounded-2xl bg-[#0f172a] border border-white/10 shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform duration-300 overflow-hidden ring-1 ring-white/10">
                <LayoutGrid size={24} className="text-white relative z-10" strokeWidth={2} />
            </div>
        </div>
      </div>

      {/* EXPANDED STATE */}
      <div 
        className={`
            relative rounded-[2rem] flex items-center shadow-2xl ring-1 ring-black/5 transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] origin-center backdrop-blur-xl bg-white/95
            ${isExpanded ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-50 translate-y-10 pointer-events-none w-0 h-0 p-0 overflow-hidden'}
            ${isVertical ? 'flex-col w-[4rem] py-2 gap-1' : 'flex-row h-[4rem] px-2 gap-1'}
        `}
      >
        <div className={`text-slate-300 cursor-move flex items-center justify-center z-10 ${isVertical ? 'h-4 w-full mb-1' : 'w-4 h-full mr-1'}`}>
            {isVertical ? <GripHorizontal size={14} /> : <GripVertical size={14} />}
        </div>

        {menuItems.map((item, index) => {
          const isActive = activeTab === item.id;
          return (
            <button 
                key={item.id}
                onClick={(e) => { e.stopPropagation(); handleTabClick(item.id as AppTab); }}
                className="relative w-10 h-10 flex flex-col items-center justify-center group z-10"
                style={{ transitionDelay: `${isExpanded ? index * 30 : 0}ms` }}
            >
                <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${isActive ? `bg-gradient-to-br ${item.color} opacity-100 shadow-sm` : 'opacity-0 hover:bg-slate-100'}`}></div>
                <div className={`relative z-10 transition-all duration-300 transform ${isActive ? 'text-white scale-100' : `text-slate-400 group-hover:${item.text}`}`}>
                    <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                </div>
            </button>
          );
        })}

        <div className={`bg-slate-100 ${isVertical ? 'h-px w-6 my-1' : 'w-px h-6 mx-1'}`}></div>

        <button 
            onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-colors z-10 active:scale-90"
        >
            <X size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};