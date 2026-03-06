import { useState, useEffect, useRef, useCallback } from 'react';
import { Task } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

export interface DeadlineNotification {
  id: string;
  taskId?: number;
  taskText: string;
  type: 'upcoming' | 'overdue' | 'summary';
  timestamp: number;
  count?: number;
}

export function useDeadlineNotifications(tasks: Task[]) {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<DeadlineNotification[]>([]);
  const notifiedTaskIds = useRef<Set<string>>(new Set());
  const hasShownSummary = useRef(false);

  useEffect(() => {
    const checkDeadlines = () => {
      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA');
      const upcomingThreshold = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
      
      const newNotifications: DeadlineNotification[] = [];

      // --- DAILY SUMMARY CHECK (Run once) ---
      if (!hasShownSummary.current && tasks.length > 0) {
          let todayCount = 0;
          let backlogCount = 0;

          tasks.forEach(t => {
              if (t.completed || t.archived) return;
              
              const createdDate = new Date(t.createdAt).toLocaleDateString('en-CA');
              const deadlineDate = t.deadline ? new Date(t.deadline).toLocaleDateString('en-CA') : null;
              
              const isToday = createdDate === todayStr || deadlineDate === todayStr;
              const isBacklog = (deadlineDate && deadlineDate < todayStr) || (!deadlineDate && createdDate < todayStr);

              if (isToday) todayCount++;
              else if (isBacklog) backlogCount++;
          });

          if (todayCount > 0 || backlogCount > 0) {
              const message = (t.dailySummary || "You have {today} tasks for today and {backlog} overdue tasks.")
                  .replace('{today}', todayCount.toString())
                  .replace('{backlog}', backlogCount.toString());

              newNotifications.push({
                  id: 'daily-summary',
                  taskText: message,
                  type: 'summary',
                  timestamp: Date.now(),
                  count: todayCount + backlogCount
              });
              hasShownSummary.current = true;
          }
      }

      tasks.forEach(task => {
        if (task.completed || !task.deadline || task.archived) return;

        const deadline = new Date(task.deadline);
        const taskKeyUpcoming = `${task.id}_upcoming`;
        const taskKeyOverdue = `${task.id}_overdue`;

        // Check for Overdue
        if (deadline < now && !notifiedTaskIds.current.has(taskKeyOverdue)) {
          newNotifications.push({
            id: Math.random().toString(36).substring(2, 9),
            taskId: task.id,
            taskText: task.text,
            type: 'overdue',
            timestamp: Date.now()
          });
          notifiedTaskIds.current.add(taskKeyOverdue);
          notifiedTaskIds.current.add(taskKeyUpcoming);
        } 
        // Check for Upcoming (within 1 hour)
        else if (deadline > now && deadline <= upcomingThreshold && !notifiedTaskIds.current.has(taskKeyUpcoming)) {
          newNotifications.push({
            id: Math.random().toString(36).substring(2, 9),
            taskId: task.id,
            taskText: task.text,
            type: 'upcoming',
            timestamp: Date.now()
          });
          notifiedTaskIds.current.add(taskKeyUpcoming);
        }
      });

      if (newNotifications.length > 0) {
        setNotifications(prev => [...prev, ...newNotifications]);
      }
    };

    // Initial check
    checkDeadlines();

    // Check every 30 seconds
    const interval = setInterval(checkDeadlines, 30000);
    return () => clearInterval(interval);
  }, [tasks]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return { notifications, dismissNotification };
}