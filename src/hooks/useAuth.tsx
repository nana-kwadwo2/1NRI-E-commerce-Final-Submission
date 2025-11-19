import { useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Singleton state to prevent multiple subscriptions
let globalUser: User | null = null;
let globalSession: Session | null = null;
let globalLoading = true;
let listeners: Set<() => void> = new Set();
let authSubscription: { unsubscribe: () => void } | null = null;
let isInitialized = false;

const notifyListeners = () => {
  listeners.forEach(listener => listener());
};

// Initialize auth state once
const initializeAuth = async () => {
  if (isInitialized) return;
  isInitialized = true;

  // Check for existing session FIRST
  const { data: { session } } = await supabase.auth.getSession();
  globalSession = session;
  globalUser = session?.user ?? null;
  globalLoading = false;
  notifyListeners();

  // THEN set up auth state listener - only notify on meaningful events
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      // Only notify on these important events, NOT on TOKEN_REFRESHED
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
        globalSession = session;
        globalUser = session?.user ?? null;
        globalLoading = false;
        notifyListeners();
      } else {
        // For TOKEN_REFRESHED, just update the session silently
        globalSession = session;
        globalUser = session?.user ?? null;
      }
    }
  );

  authSubscription = subscription;
};

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(globalUser);
  const [session, setSession] = useState<Session | null>(globalSession);
  const [loading, setLoading] = useState(globalLoading);

  useEffect(() => {
    // Initialize on first mount
    initializeAuth();

    // Subscribe to global state changes
    const updateState = () => {
      setUser(globalUser);
      setSession(globalSession);
      setLoading(globalLoading);
    };

    listeners.add(updateState);
    updateState(); // Set initial state

    return () => {
      listeners.delete(updateState);
    };
  }, []);

  return { user, session, loading };
};
