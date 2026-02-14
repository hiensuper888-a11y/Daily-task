import { useState, useEffect, useRef } from 'react';
import { Task } from '../types';

export interface DeadlineNotification {
  id: string;
  taskId: number;
  taskText: string;
  type: 'upcoming' | 'overdue';
  timestamp: number;
}

export function useDeadlineNotifications(tasks: Task[]) {
  const [notifications, setNotifications] = useState<DeadlineNotification[]>([]);
  const notifiedTaskIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const checkDeadlines = () => {
      const now = new Date();
      const upcomingThreshold = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
      
      const newNotifications: DeadlineNotification[] = [];

      tasks.forEach(task => {
        if (task.completed || !task.deadline || task.archived) return;

        const deadline = new Date(task.deadline);
        const taskKeyUpcoming = `${task.id}_upcoming`;
        const taskKeyOverdue = `${task.id}_overdue`;

        // Check for Overdue
        if (deadline < now && !notifiedTaskIds.current.has(taskKeyOverdue)) {
          newNotifications.push({
            id: Math.random().toString(36).substr(2, 9),
            taskId: task.id,
            taskText: task.text,
            type: 'overdue',
            timestamp: Date.now()
          });
          notifiedTaskIds.current.add(taskKeyOverdue);
          // If we notify overdue, we don't need to notify upcoming anymore
          notifiedTaskIds.current.add(taskKeyUpcoming);
        } 
        // Check for Upcoming (within 1 hour)
        else if (deadline > now && deadline <= upcomingThreshold && !notifiedTaskIds.current.has(taskKeyUpcoming)) {
          newNotifications.push({
            id: Math.random().toString(36).substr(2, 9),
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

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return { notifications, dismissNotification };
}