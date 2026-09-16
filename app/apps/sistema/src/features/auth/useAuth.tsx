import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Profile } from "@biodinamica/supabase";
import { supabase } from "../../lib/supabase";

type Status = "loading" | "anon" | "authed" | "profile-error";

interface AuthApi {
  status: Status;
  profile: Profile | null;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthApi | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from("profiles").select("id,name,department,level").eq("id", userId).maybeSingle();
  return data as Profile | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function syncFromUserId(userId: string | undefined) {
      if (!userId) {
        if (!cancelled) {
          setProfile(null);
          setStatus("anon");
        }
        return;
      }
      const p = await loadProfile(userId);
      if (cancelled) return;
      if (p) {
        setProfile(p);
        setStatus("authed");
      } else {
        setProfile(null);
        setStatus("profile-error");
      }
    }

    supabase.auth.getSession().then(({ data }) => syncFromUserId(data.session?.user.id));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      syncFromUserId(session?.user.id);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function login(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false as const, message: "E-mail ou senha incorretos." };
    return { ok: true as const };
  }

  function logout() {
    supabase.auth.signOut();
  }

  return <AuthContext.Provider value={{ status, profile, login, logout }}>{children}</AuthContext.Provider>;
}
