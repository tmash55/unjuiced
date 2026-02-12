"use client";
import React from "react";
import { createContext, useContext, useEffect, useState, useMemo } from "react";
import { createClient } from "@/libs/supabase/client";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import config from "@/config";
import { getRedirectUrl } from "@/libs/utils/auth";
import posthog from "posthog-js";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  requireAuth: (callback?: () => void) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  showAuthModal: false,
  setShowAuthModal: () => {},
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  signInWithGoogle: async () => {},
  requireAuth: async () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // Memoize Supabase client to prevent recreating on every render
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
        }
        
        if (mounted) {
          setUser(session?.user ?? null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Auth error:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Hide auth modal on successful auth
        if (session?.user) {
          setShowAuthModal(false);
        }
        
        // Handle password recovery - redirect to forgot-password page
        if (event === 'PASSWORD_RECOVERY') {
          router.push('/forgot-password');
          return;
        }
        
        // Invalidate entitlements cache on sign in/out to force refetch
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          queryClient.invalidateQueries({ queryKey: ['me-plan'] });
          // Ensure any server components re-read cookies and re-render
          try { router.refresh(); } catch {}
        }

        // PostHog: Identify user on sign in, reset on sign out
        if (event === 'SIGNED_IN' && session?.user) {
          const { id, email, user_metadata } = session.user;
          posthog.identify(id, {
            email,
            name: user_metadata?.full_name || user_metadata?.name,
            first_name: user_metadata?.first_name,
            last_name: user_metadata?.last_name,
          });
          posthog.capture("user_signed_in", {
            method: user_metadata?.provider || "email",
            email,
          });
        } else if (event === 'SIGNED_OUT') {
          posthog.reset();
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, queryClient]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    // Proactively invalidate & refetch entitlements after sign-in to avoid stale gates
    queryClient.invalidateQueries({ queryKey: ['me-plan'] });
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
    // In case of magic-link-less environments where user becomes authenticated immediately
    queryClient.invalidateQueries({ queryKey: ['me-plan'] });
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    router.push(config.auth.loginUrl);
    // Ensure all pages reflect signed-out state immediately
    queryClient.invalidateQueries({ queryKey: ['me-plan'] });
  };

  const signInWithGoogle = async () => {
    // Check if there's a redirect URL in the current page's search params
    const searchParams = new URLSearchParams(window.location.search);
    const redirectTo = searchParams.get('redirectTo') || searchParams.get('redirect');

    let redirectUrl = getRedirectUrl();

    // If there's a redirect URL, append it to the callback URL
    if (redirectTo) {
      redirectUrl += `?redirectTo=${encodeURIComponent(redirectTo)}`;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      }
    });

    if (error) throw error;
  };

  // Helper function to require auth, optionally showing modal and executing callback
  const requireAuth = async (callback?: () => void): Promise<boolean> => {
    if (!user) {
      setShowAuthModal(true);
      return false;
    }
    
    if (callback) {
      callback();
    }
    return true;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        showAuthModal,
        setShowAuthModal,
        signIn,
        signUp,
        signOut,
        signInWithGoogle,
        requireAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}; 
