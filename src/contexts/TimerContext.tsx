import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TimerState {
  taskId: string;
  isRunning: boolean;
  isPaused: boolean;
  startTime: number | null;
  pausedTime: number | null;
  totalPausedDuration: number;
  currentSessionDuration: number;
  totalDuration: number;
  estimatedHours: number | null;
  timeEntryId: string | null;
}

export interface TimerContextType {
  timers: Map<string, TimerState>;
  startTimer: (taskId: string, estimatedHours?: number) => Promise<void>;
  pauseTimer: (taskId: string) => Promise<void>;
  resumeTimer: (taskId: string) => Promise<void>;
  stopTimer: (taskId: string) => Promise<void>;
  getTimerState: (taskId: string) => TimerState | null;
  getFormattedTime: (taskId: string) => string;
  getRemainingTime: (taskId: string) => number | null;
  isTimerRunning: (taskId: string) => boolean;
  isTimerPaused: (taskId: string) => boolean;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export const TimerProvider = ({ children }: { children: ReactNode }) => {
  const [timers, setTimers] = useState<Map<string, TimerState>>(new Map());
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);
  const { user } = useAuth();

  // Update timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const newTimers = new Map(prev);
        let hasRunningTimers = false;

        newTimers.forEach((timer, taskId) => {
          if (timer.isRunning && !timer.isPaused) {
            hasRunningTimers = true;
            const now = Date.now();
            const sessionDuration = now - (timer.startTime || 0) - timer.totalPausedDuration;
            
            newTimers.set(taskId, {
              ...timer,
              currentSessionDuration: Math.max(0, sessionDuration),
              totalDuration: timer.totalDuration + (sessionDuration - timer.currentSessionDuration)
            });
          }
        });

        return newTimers;
      });
    }, 1000);

    setIntervalId(interval);
    return () => clearInterval(interval);
  }, []);

  // Cleanup interval when no timers are running
  useEffect(() => {
    const hasRunningTimers = Array.from(timers.values()).some(timer => timer.isRunning && !timer.isPaused);
    
    if (!hasRunningTimers && intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
  }, [timers, intervalId]);

  const startTimer = async (taskId: string, estimatedHours?: number) => {
    if (!user) return;

    try {
      // Check if there's already a running timer for this task
      const existingTimer = timers.get(taskId);
      if (existingTimer?.isRunning) {
        return;
      }

      // Create new time entry in database
      const { data: timeEntry, error } = await supabase
        .from('task_time_entries')
        .insert([
          {
            task_id: taskId,
            user_id: user.id,
            started_at: new Date().toISOString(),
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Update timer state
      const now = Date.now();
      setTimers(prev => {
        const newTimers = new Map(prev);
        newTimers.set(taskId, {
          taskId,
          isRunning: true,
          isPaused: false,
          startTime: now,
          pausedTime: null,
          totalPausedDuration: 0,
          currentSessionDuration: 0,
          totalDuration: 0,
          estimatedHours: estimatedHours || null,
          timeEntryId: timeEntry.id,
        });
        return newTimers;
      });

      // Update task status to in_progress
      await supabase
        .from('tasks')
        .update({ status: 'in_progress' })
        .eq('id', taskId);

    } catch (error) {
      console.error('Error starting timer:', error);
    }
  };

  const pauseTimer = async (taskId: string) => {
    const timer = timers.get(taskId);
    if (!timer || !timer.isRunning || timer.isPaused) return;

    const now = Date.now();
    setTimers(prev => {
      const newTimers = new Map(prev);
      newTimers.set(taskId, {
        ...timer,
        isPaused: true,
        pausedTime: now,
        totalPausedDuration: timer.totalPausedDuration + (now - (timer.startTime || 0) - timer.currentSessionDuration),
      });
      return newTimers;
    });
  };

  const resumeTimer = async (taskId: string) => {
    const timer = timers.get(taskId);
    if (!timer || !timer.isRunning || !timer.isPaused) return;

    const now = Date.now();
    setTimers(prev => {
      const newTimers = new Map(prev);
      newTimers.set(taskId, {
        ...timer,
        isPaused: false,
        startTime: now - timer.currentSessionDuration,
        pausedTime: null,
      });
      return newTimers;
    });
  };

  const stopTimer = async (taskId: string) => {
    const timer = timers.get(taskId);
    if (!timer || !timer.isRunning) return;

    try {
      // Update time entry in database
      if (timer.timeEntryId) {
        const now = new Date();
        const totalDuration = timer.totalDuration + timer.currentSessionDuration;
        
        await supabase
          .from('task_time_entries')
          .update({
            ended_at: now.toISOString(),
          })
          .eq('id', timer.timeEntryId);
      }

      // Remove timer from state
      setTimers(prev => {
        const newTimers = new Map(prev);
        newTimers.delete(taskId);
        return newTimers;
      });

    } catch (error) {
      console.error('Error stopping timer:', error);
    }
  };

  const getTimerState = (taskId: string): TimerState | null => {
    return timers.get(taskId) || null;
  };

  const getFormattedTime = (taskId: string): string => {
    const timer = timers.get(taskId);
    if (!timer) return '00:00:00';

    const totalSeconds = Math.floor((timer.totalDuration + timer.currentSessionDuration) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getRemainingTime = (taskId: string): number | null => {
    const timer = timers.get(taskId);
    if (!timer || !timer.estimatedHours) return null;

    const totalSeconds = Math.floor((timer.totalDuration + timer.currentSessionDuration) / 1000);
    const estimatedSeconds = timer.estimatedHours * 3600;
    const remainingSeconds = estimatedSeconds - totalSeconds;

    return Math.max(0, remainingSeconds);
  };

  const isTimerRunning = (taskId: string): boolean => {
    const timer = timers.get(taskId);
    return timer?.isRunning && !timer?.isPaused || false;
  };

  const isTimerPaused = (taskId: string): boolean => {
    const timer = timers.get(taskId);
    return timer?.isPaused || false;
  };

  // Load existing running timers on mount
  useEffect(() => {
    const loadRunningTimers = async () => {
      if (!user) return;

      try {
        const { data: runningEntries, error } = await supabase
          .from('task_time_entries')
          .select(`
            id,
            task_id,
            started_at,
            tasks!inner(
              id,
              estimated_hours
            )
          `)
          .eq('user_id', user.id)
          .is('ended_at', null);

        if (error) throw error;

        const newTimers = new Map<string, TimerState>();
        
        runningEntries?.forEach(entry => {
          const startTime = new Date(entry.started_at).getTime();
          const now = Date.now();
          const currentSessionDuration = now - startTime;

          newTimers.set(entry.task_id, {
            taskId: entry.task_id,
            isRunning: true,
            isPaused: false,
            startTime,
            pausedTime: null,
            totalPausedDuration: 0,
            currentSessionDuration,
            totalDuration: 0,
            estimatedHours: entry.tasks?.estimated_hours || null,
            timeEntryId: entry.id,
          });
        });

        setTimers(newTimers);
      } catch (error) {
        console.error('Error loading running timers:', error);
      }
    };

    loadRunningTimers();
  }, [user]);

  return (
    <TimerContext.Provider
      value={{
        timers,
        startTimer,
        pauseTimer,
        resumeTimer,
        stopTimer,
        getTimerState,
        getFormattedTime,
        getRemainingTime,
        isTimerRunning,
        isTimerPaused,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (context === undefined) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
};
