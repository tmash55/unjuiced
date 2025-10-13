"use client";
import React from "react";
import { createContext, useContext, useEffect, useState, useMemo } from "react";
import { createClient } from "@/libs/supabase/client";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import config from "@/config";
import { getRedirectUrl } from "@/libs/utils/auth";

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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
        setLoading(false);
        // Hide auth modal on successful auth
        if (session?.user) {
          setShowAuthModal(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
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
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    router.push(config.auth.loginUrl);
  };

  const signInWithGoogle = async () => {
    // Check if there's a redirect URL in the current page's search params
    const searchParams = new URLSearchParams(window.location.search);
    const redirectTo = searchParams.get('redirectTo');
    
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