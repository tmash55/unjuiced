import { useState, useEffect, useRef } from 'react';
import { GameEvent } from '@/types/nba';

interface NBAScheduleData {
  events: GameEvent[];
  connected: boolean;
  error: string | null;
}

/**
 * Hook to subscribe to NBA game schedule via SSE
 * Connects to /api/sse/props?sport=nba for real-time updates
 */
export function useNBASchedule() {
  const [data, setData] = useState<NBAScheduleData>({
    events: [],
    connected: false,
    error: null,
  });
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    const connect = () => {
      try {
        const eventSource = new EventSource('/api/sse/props?sport=nba');
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          console.log('[NBA Schedule] SSE connected');
          setData(prev => ({ ...prev, connected: true, error: null }));
          reconnectAttempts.current = 0;
        };

        eventSource.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            // Handle different message types
            if (message.type === 'snapshot' && message.events) {
              setData(prev => ({
                ...prev,
                events: message.events,
                connected: true,
              }));
            } else if (message.type === 'update' && message.event) {
              // Update or add single event
              setData(prev => {
                const existingIndex = prev.events.findIndex(
                  e => e.eid === message.event.eid
                );
                
                const newEvents = [...prev.events];
                if (existingIndex >= 0) {
                  newEvents[existingIndex] = message.event;
                } else {
                  newEvents.push(message.event);
                }
                
                return { ...prev, events: newEvents };
              });
            }
          } catch (error) {
            console.error('[NBA Schedule] Parse error:', error);
          }
        };

        eventSource.onerror = (error) => {
          console.error('[NBA Schedule] SSE error:', error);
          eventSource.close();
          
          setData(prev => ({
            ...prev,
            connected: false,
            error: 'Connection lost. Reconnecting...',
          }));

          // Exponential backoff for reconnection
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`[NBA Schedule] Reconnecting (attempt ${reconnectAttempts.current})...`);
            connect();
          }, delay);
        };
      } catch (error) {
        console.error('[NBA Schedule] Connection error:', error);
        setData(prev => ({
          ...prev,
          connected: false,
          error: 'Failed to connect to live updates',
        }));
      }
    };

    connect();

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return data;
}

