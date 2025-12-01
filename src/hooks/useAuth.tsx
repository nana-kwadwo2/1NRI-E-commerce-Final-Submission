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

  console.log("🔐 Initializing auth state...");

  // Check for existing session FIRST
  const { data: { session } } = await supabase.auth.getSession();
  globalSession = session;
  globalUser = session?.user ?? null;
  globalLoading = false;

  console.log("🔐 Initial session:", globalUser ? "Logged in" : "Not logged in");
  notifyListeners();

  // THEN set up auth state listener
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      console.log("🔐 Auth state change:", event, session?.user ? "User present" : "No user");

      // Handle different auth events
      if (event === 'SIGNED_IN') {
        console.log("✅ User signed in");
        globalSession = session;
        globalUser = session?.user ?? null;
        globalLoading = false;
        notifyListeners();
      } else if (event === 'SIGNED_OUT') {
        console.log("🚪 User signed out");
        globalSession = null;
        globalUser = null;
        globalLoading = false;
        notifyListeners();
      } else if (event === 'USER_UPDATED') {
        console.log("🔄 User updated");
        globalSession = session;
        globalUser = session?.user ?? null;
        notifyListeners();
      } else if (event === 'TOKEN_REFRESHED') {
        // Silently update session without notifying (prevents unnecessary re-renders)
        console.log("🔄 Token refreshed (silent update)");
        globalSession = session;
        globalUser = session?.user ?? null;
      } else if (event === 'INITIAL_SESSION') {
        console.log("🔐 Initial session event");
        globalSession = session;
        globalUser = session?.user ?? null;
        globalLoading = false;
        notifyListeners();
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
