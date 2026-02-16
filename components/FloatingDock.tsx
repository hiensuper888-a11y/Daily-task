import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckSquare, MessageSquare, Wand2, BarChart3, UserCircle2, 
  LayoutGrid, X, GripHorizontal, GripVertical 
} from 'lucide-react';
import { AppTab } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface FloatingDockProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  onTabChange?: () => void;
}

export const FloatingDock: React.FC<FloatingDockProps> = ({ activeTab, setActiveTab, onTabChange }) => {
  const { t } = useLanguage();
  
  // Initialize position (Bottom Right by default to avoid overlap with Center Add Button)
  const [position, setPosition] = useState({ 
      x: typeof window !== 'undefined' ? window.innerWidth - 90 : 0, 
      y: typeof window !== 'undefined' ? window.innerHeight - 100 : 0 
  });
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false); // Track if user has ever moved it
  
  // Drag logic refs
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dockStartPos = useRef({ x: 0, y: 0 });
  const isDragGesture = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Constants
  const COLLAPSE_TIMEOUT = 5000;
  const EDGE_THRESHOLD = 80; 

  // Determine orientation based on X position relative to screen width
  const isVertical = position.x < EDGE_THRESHOLD || position.x > window.innerWidth - EDGE_THRESHOLD - 80;

  // Auto-collapse logic
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

  // Handle Resize to keep dock on screen
  useEffect(() => {
      const handleResize = () => {
          if (!hasMoved) {
              // Keep sticking to bottom right if not moved by user
              setPosition({ x: window.innerWidth - 90, y: window.innerHeight - 100 });
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

    // Bounce back bounds logic
    const padding = 16;
    let newX = position.x;
    let newY = position.y;
    const dockSize = isVertical ? 80 : 320; // Approximate sizes

    if (newX < padding) newX = padding;
    if (newX > window.innerWidth - 80) newX = window.innerWidth - 80; // Width of collapsed icon approx
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

  // Configuration for colorful tabs
  const menuItems = [
    { id: 'tasks', icon: CheckSquare, label: t.tasks, color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/40', text: 'text-blue-600' },
    { id: 'ai', icon: MessageSquare, label: 'AI', color: 'from-violet-500 to-purple-600', shadow: 'shadow-purple-500/40', text: 'text-purple-600' },
    { id: 'studio', icon: Wand2, label: 'Studio', color: 'from-fuchsia-500 to-pink-600', shadow: 'shadow-pink-500/40', text: 'text-pink-600' },
    { id: 'reports', icon: BarChart3, label: 'Stats', color: 'from-amber-400 to-orange-500', shadow: 'shadow-orange-500/40', text: 'text-orange-600' },
    { id: 'profile', icon: UserCircle2, label: t.profile, color: 'from-emerald-400 to-teal-600', shadow: 'shadow-emerald-500/40', text: 'text-emerald-600' },
  ];

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
        <div className="group relative w-16 h-16 cursor-pointer">
            {/* Ambient Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full blur-xl opacity-40 animate-pulse-slow"></div>
            
            {/* The Orb */}
            <div className="relative w-full h-full rounded-2xl bg-slate-900 border border-white/10 shadow-float flex items-center justify-center hover:scale-110 active:scale-95 transition-transform duration-300 overflow-hidden ring-1 ring-white/20">
                {/* Shine Effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-50"></div>
                <div className="relative z-10 text-white drop-shadow-md">
                    <LayoutGrid size={28} strokeWidth={2.5} />
                </div>
            </div>
        </div>
      </div>

      {/* EXPANDED STATE (The "Vibrant Dock") */}
      <div 
        className={`
            relative rounded-[2.5rem] flex items-center shadow-float ring-1 ring-white/60 transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] origin-center backdrop-blur-xl bg-white/90
            ${isExpanded ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-50 translate-y-10 pointer-events-none w-0 h-0 p-0 overflow-hidden'}
            ${isVertical ? 'flex-col w-[4.5rem] py-3 gap-2' : 'flex-row h-[4.5rem] px-3 gap-2'}
        `}
      >
        {/* Drag Handle */}
        <div className={`text-slate-400/50 cursor-move flex items-center justify-center hover:text-slate-600 transition-colors z-10 ${isVertical ? 'h-4 w-full mb-1' : 'w-4 h-full mr-1'}`}>
            {isVertical ? <GripHorizontal size={16} /> : <GripVertical size={16} />}
        </div>

        {menuItems.map((item, index) => {
          const isActive = activeTab === item.id;
          return (
            <button 
                key={item.id}
                onClick={(e) => { e.stopPropagation(); handleTabClick(item.id as AppTab); }}
                className="relative w-12 h-12 flex flex-col items-center justify-center group z-10"
                style={{ transitionDelay: `${isExpanded ? index * 40 : 0}ms` }}
            >
                {/* Active Indicator & Hover Gradient */}
                <div className={`absolute inset-0 rounded-2xl transition-all duration-500 ease-out ${isActive ? `bg-gradient-to-br ${item.color} ${item.shadow} scale-100 rotate-0 opacity-100` : 'scale-75 opacity-0 hover:opacity-10 hover:scale-95 bg-slate-100'}`}></div>
                
                {/* Icon */}
                <div className={`relative z-10 transition-all duration-300 transform ${isActive ? 'text-white scale-110' : `text-slate-400 group-hover:${item.text} group-hover:scale-110`}`}>
                    <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                </div>

                {/* Active Dot (only if horizontal space permits or nice touch) */}
                {isActive && (
                    <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-white/80 shadow-glow"></div>
                )}
            </button>
          );
        })}

        {/* Separator */}
        <div className={`bg-slate-200/50 ${isVertical ? 'h-px w-8 my-1' : 'w-px h-8 mx-1'}`}></div>

        {/* Close Button */}
        <button 
            onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
            className="w-10 h-10 flex items-center justify-center rounded-2xl text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-colors z-10 active:scale-90"
        >
            <X size={20} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};