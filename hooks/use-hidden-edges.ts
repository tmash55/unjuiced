import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth/auth-provider';

interface HideEdgeParams {
  edgeKey: string;
  eventId?: string;
  eventDate?: string;
  sport?: string;
  playerName?: string;
  market?: string;
  line?: number;
  autoUnhideHours?: number;
}

export function useHiddenEdges() {
  const { user } = useAuth();
  const [hiddenEdges, setHiddenEdges] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Load hidden edges from localStorage (for all users) and database (for logged-in users)
  useEffect(() => {
    const loadHiddenEdges = async () => {
      setIsLoading(true);
      const edges = new Set<string>();

      // Load from localStorage first (works for everyone)
      try {
        const localHidden = localStorage.getItem('hiddenEdges');
        if (localHidden) {
          const parsed = JSON.parse(localHidden);
          parsed.forEach((key: string) => edges.add(key));
        }
      } catch (error) {
        console.error('Error loading hidden edges from localStorage:', error);
      }

      // If user is logged in, also load from database
      if (user) {
        try {
          const response = await fetch('/api/user/hidden-edges');
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
  }, [user]);

  // Hide an edge
  const hideEdge = useCallback(async (params: HideEdgeParams) => {
    const { edgeKey } = params;

    // Add to local state immediately
    setHiddenEdges(prev => new Set([...prev, edgeKey]));

    // Save to localStorage
    try {
      const current = Array.from(hiddenEdges);
      current.push(edgeKey);
      localStorage.setItem('hiddenEdges', JSON.stringify(current));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }

    // If user is logged in, also save to database
    if (user) {
      try {
        await fetch('/api/user/hidden-edges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        });
      } catch (error) {
        console.error('Error saving hidden edge to database:', error);
      }
    }
  }, [user, hiddenEdges]);

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
      localStorage.setItem('hiddenEdges', JSON.stringify(current));
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

  // Clear all hidden edges
  const clearAllHidden = useCallback(async () => {
    // Clear local state
    setHiddenEdges(new Set());

    // Clear localStorage
    try {
      localStorage.removeItem('hiddenEdges');
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }

    // If user is logged in, also clear database
    if (user) {
      try {
        await fetch('/api/user/hidden-edges', {
          method: 'DELETE'
        });
      } catch (error) {
        console.error('Error clearing hidden edges from database:', error);
      }
    }
  }, [user]);

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

