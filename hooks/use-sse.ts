"use client";

import { useEffect, useRef, useState } from "react";

interface UseSSEOptions {
  enabled?: boolean;
  onMessage?: (data: any) => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onConnectionChange?: (connected: boolean) => void;
}

export function useSSE(url: string, options: UseSSEOptions = {}) {
  const {
    enabled = true,
    onMessage,
    onError,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
    onConnectionChange,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [hasFailed, setHasFailed] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isReconnectingRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);

  const updateConnectionState = (connected: boolean) => {
    setIsConnected(connected);
    onConnectionChange?.(connected);
  };

  const connect = () => {
    if (!enabled || isReconnectingRef.current) return;

    // Check if we've exceeded max reconnection attempts
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[useSSE] Max reconnection attempts (${maxReconnectAttempts}) reached for ${url}`);
      }
      setIsReconnecting(false);
      return;
    }

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[useSSE] Connecting to ${url} (attempt ${reconnectAttemptsRef.current + 1})`);
      }
      
      const eventSource = new EventSource(url);

      eventSource.onopen = () => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[useSSE] ✅ Connected to ${url}`);
        }
        updateConnectionState(true);
        setIsReconnecting(false);
        isReconnectingRef.current = false;
        // Reset reconnection attempts on successful connection
        reconnectAttemptsRef.current = 0;
        setReconnectAttempts(0);
        setHasFailed(false);
      };

      // Handle SSE messages (same pattern as arbitrage hook)
      eventSource.onmessage = (event) => {
        // Skip subscription confirmations from Redis
        if (!event.data || 
            event.data.startsWith('subscribe,') || 
            event.data.startsWith('psubscribe,')) {
          return;
        }
        
        try {
          // Redis pub/sub format: "message,pub:props:nfl,{...}"
          // Find the first { and slice from there to get the JSON payload
          const idx = (event.data as string).indexOf("{");
          const json = idx >= 0 ? (event.data as string).slice(idx) : (event.data as string);
          
          const data = JSON.parse(json);
          setLastMessage(data);
          onMessage?.(data);
        } catch (error) {
          // Only log parse errors in development
          if (process.env.NODE_ENV === 'development') {
            console.error("[useSSE] Failed to parse message:", error, "Data:", event.data);
          }
        }
      };

      eventSource.onerror = (error) => {
        // Determine error type based on EventSource readyState
        const readyState = eventSource.readyState;
        const errorType = readyState === EventSource.CLOSED ? 'closed' : 
                         readyState === EventSource.CONNECTING ? 'connecting' : 'unknown';
        
        if (process.env.NODE_ENV === 'development') {
          console.error(`[useSSE] ❌ Connection error (${errorType}):`, error);
        }
        
        updateConnectionState(false);
        onError?.(error);

        // Close the connection
        eventSource.close();
        eventSourceRef.current = null;

        // Attempt to reconnect with exponential backoff
        if (enabled && !isReconnectingRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
          isReconnectingRef.current = true;
          setIsReconnecting(true);
          reconnectAttemptsRef.current += 1;
          setReconnectAttempts(reconnectAttemptsRef.current);
          
          // Exponential backoff: base interval * (2 ^ attempts)
          const backoffDelay = Math.min(
            reconnectInterval * Math.pow(2, reconnectAttemptsRef.current - 1),
            30000 // Max 30 seconds
          );
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`[useSSE] 🔄 Reconnecting in ${backoffDelay}ms... (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          }
          
          reconnectTimeoutRef.current = setTimeout(() => {
            isReconnectingRef.current = false;
            connect();
          }, backoffDelay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setIsReconnecting(false);
          setHasFailed(true);
        }
      };

      eventSourceRef.current = eventSource;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error("[useSSE] Failed to connect:", error);
      }
      updateConnectionState(false);
    }
  };

  const disconnect = () => {
    if (process.env.NODE_ENV === 'development') {
      console.log("[useSSE] Disconnecting...");
    }
    
    // Clear any pending reconnection attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close the EventSource connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Reset all state
    updateConnectionState(false);
    setIsReconnecting(false);
    isReconnectingRef.current = false;
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);
  };

  const reconnect = () => {
    if (process.env.NODE_ENV === 'development') {
      console.log("[useSSE] Manual reconnect triggered");
    }
    disconnect();
    // Reset attempts before reconnecting
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);
    setTimeout(connect, 100);
  };

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled]);

  return {
    isConnected,
    isReconnecting,
    reconnectAttempts,
    lastMessage,
    disconnect,
    reconnect,
    hasFailed,
  };
}









