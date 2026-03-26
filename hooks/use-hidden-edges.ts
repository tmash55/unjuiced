import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth/auth-provider';

export type HiddenEdgeTool = "edge-finder" | "positive-ev" | "sharp-intel";

interface HideEdgeParams {
  edgeKey: string;
  tool?: HiddenEdgeTool;
  eventId?: string;
  eventDate?: string;
  sport?: string;
  playerName?: string;
  market?: string;
  line?: number;
  autoUnhideHours?: number;
}

export function useHiddenEdges(tool?: HiddenEdgeTool) {
  const { user } = useAuth();
  const [hiddenEdges, setHiddenEdges] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const storageKey = tool ? `hiddenEdges:${tool}` : 'hiddenEdges';

  // Load hidden edges from localStorage (for all users) and database (for logged-in users)
  useEffect(() => {
    const loadHiddenEdges = async () => {
      setIsLoading(true);
      const edges = new Set<string>();

      // Load from localStorage first (works for everyone)
      try {
        const localHidden = localStorage.getItem(storageKey);
        if (localHidden) {
          const parsed = JSON.parse(localHidden);
          parsed.forEach((key: string) => edges.add(key));
        }
        // Migrate legacy key for edge-finder (old data stored under generic 'hiddenEdges')
        if (tool === "edge-finder" && !localHidden) {
          const legacy = localStorage.getItem('hiddenEdges');
          if (legacy) {
            const parsed = JSON.parse(legacy);
            parsed.forEach((key: string) => edges.add(key));
            // Migrate: write to new key and remove old one
            localStorage.setItem(storageKey, legacy);
            localStorage.removeItem('hiddenEdges');
          }
        }
      } catch (error) {
        console.error('Error loading hidden edges from localStorage:', error);
      }

      // If user is logged in, also load from database
      if (user) {
        try {
          const url = tool
            ? `/api/user/hidden-edges?tool=${tool}`
            : '/api/user/hidden-edges';
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            data.hiddenEdges?.forEach((key: string) => edges.add(key));
          }
        } catch (error) {
          console.error('Error loading hidden edges from database:', error);
        }
      }

      setHiddenEdges(edges);
      setIsLoading(false);
    };

    loadHiddenEdges();
  }, [user, storageKey, tool]);

  // Hide an edge
  const hideEdge = useCallback(async (params: HideEdgeParams) => {
    const { edgeKey } = params;
    const paramsWithTool = { ...params, tool: params.tool || tool };

    // Add to local state immediately
    setHiddenEdges(prev => new Set([...prev, edgeKey]));

    // Save to localStorage
    try {
      const current = Array.from(hiddenEdges);
      current.push(edgeKey);
      localStorage.setItem(storageKey, JSON.stringify(current));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }

    // If user is logged in, also save to database
    if (user) {
      try {
        await fetch('/api/user/hidden-edges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(paramsWithTool)
        });
      } catch (error) {
        console.error('Error saving hidden edge to database:', error);
      }
    }
  }, [user, hiddenEdges, storageKey, tool]);

  // Unhide an edge
  const unhideEdge = useCallback(async (edgeKey: string) => {
    // Remove from local state immediately
    setHiddenEdges(prev => {
      const next = new Set(prev);
      next.delete(edgeKey);
      return next;
    });

    // Remove from localStorage
    try {
      const current = Array.from(hiddenEdges).filter(key => key !== edgeKey);
      localStorage.setItem(storageKey, JSON.stringify(current));
    } catch (error) {
      console.error('Error updating localStorage:', error);
    }

    // If user is logged in, also remove from database
    if (user) {
      try {
        await fetch(`/api/user/hidden-edges/${encodeURIComponent(edgeKey)}`, {
          method: 'DELETE'
        });
      } catch (error) {
        console.error('Error removing hidden edge from database:', error);
      }
    }
  }, [user, hiddenEdges]);

  // Clear all hidden edges (scoped to tool if provided)
  const clearAllHidden = useCallback(async () => {
    // Clear local state
    setHiddenEdges(new Set());

    // Clear localStorage
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }

    // If user is logged in, also clear database
    if (user) {
      try {
        const url = tool
          ? `/api/user/hidden-edges?tool=${tool}`
          : '/api/user/hidden-edges';
        await fetch(url, { method: 'DELETE' });
      } catch (error) {
        console.error('Error clearing hidden edges from database:', error);
      }
    }
  }, [user, storageKey, tool]);

  // Check if an edge is hidden
  const isHidden = useCallback((edgeKey: string) => {
    return hiddenEdges.has(edgeKey);
  }, [hiddenEdges]);

  return {
    hiddenEdges,
    hiddenCount: hiddenEdges.size,
    isLoading,
    hideEdge,
    unhideEdge,
    clearAllHidden,
    isHidden
  };
}

