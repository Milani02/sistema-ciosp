import { useState, type FormEvent } from "react";
import { Button, LivingLinesBackground } from "@biodinamica/ui";
import { useAuth } from "./useAuth";

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await login(email.trim(), password);
    setSubmitting(false);
    if (!result.ok) setError(result.message);
  }

  return (
    <div className="noir-bg flex min-h-screen flex-col items-center justify-center px-6 py-10">
      <LivingLinesBackground />

      <div className="relative w-full max-w-[360px]">
        <div className="mb-8 flex flex-col items-center gap-4">
          <img
            src="/logo-icon.png"
            alt="Grupo Biodinâmica"
            className="animate-icon-pop h-16 w-16 rounded-[20px] shadow-[0_16px_36px_-12px_rgba(0,0,0,0.5),0_0_28px_-4px_#34d17c77]"
          />
          <div className="animate-rise text-center" style={{ animationDelay: "0.1s" }}>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Entrar</h1>
            <p className="mt-1 text-sm text-white/75">Sistema interno · Grupo Biodinâmica</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="animate-rise" style={{ animationDelay: "0.18s" }}>
          <div className="glass-panel overflow-hidden rounded-[28px]">
            <label className="block px-5 py-3.5">
              <span className="block text-[0.68rem] font-semibold text-ink-soft">E-mail</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@biodinamica.com.br"
                className="mt-0.5 block w-full bg-transparent text-[0.95rem] text-ink outline-none placeholder:text-ink-soft/50"
              />
            </label>
            <div className="mx-5 h-px bg-line/70" />
            <label className="block px-5 py-3.5">
              <span className="block text-[0.68rem] font-semibold text-ink-soft">Senha</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-0.5 block w-full bg-transparent text-[0.95rem] text-ink outline-none placeholder:text-ink-soft/50"
              />
            </label>
          </div>

          {error && (
            <div className="mt-3 rounded-xl bg-brick-tint px-3 py-2.5 text-sm font-medium text-brick">{error}</div>
          )}

          <Button type="submit" className="mt-5" loading={submitting}>
            {submitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="animate-rise mt-6 text-center text-xs text-white/70" style={{ animationDelay: "0.26s" }}>
          Sem conta ainda? Peça pra coordenação criar seu acesso. A tela de inscrição do visitante não precisa de
          login.
        </p>
      </div>
    </div>
  );
}
