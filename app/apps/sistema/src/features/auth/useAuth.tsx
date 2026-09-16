import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Profile } from "@biodinamica/supabase";
import { supabase } from "../../lib/supabase";

type Status = "loading" | "anon" | "authed" | "profile-error" | "reconnecting";

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

async function loadProfile(userId: string): Promise<{ profile: Profile | null; failed: boolean }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,name,department,level,staff_id")
    .eq("id", userId)
    .maybeSingle();
  return { profile: data as Profile | null, failed: !!error };
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
      // Tenta de novo indefinidamente em caso de falha de rede/consulta —
      // um evento ao vivo não pode travar o login de alguém numa tela de
      // erro permanente só porque o wifi engasgou por um segundo. Só cai
      // em "profile-error" quando a consulta REALMENTE funcionou e não
      // achou linha nenhuma (aí sim é config faltando, não instabilidade).
      let attempt = 0;
      while (!cancelled) {
        const { profile: p, failed } = await loadProfile(userId);
        if (cancelled) return;
        if (failed) {
          attempt++;
          setStatus("reconnecting");
          await new Promise((r) => setTimeout(r, Math.min(1500 * attempt, 8000)));
          continue;
        }
        if (p) {
          setProfile(p);
          setStatus("authed");
        } else {
          setProfile(null);
          setStatus("profile-error");
        }
        return;
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
