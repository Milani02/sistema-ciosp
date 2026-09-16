import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { CheckCircle2, Home, Ticket } from "lucide-react";
import { Badge, Button, Card } from "@biodinamica/ui";
import type { Checkin } from "@biodinamica/supabase";
import { supabase } from "../../lib/supabase";
import { fmtDT } from "../../lib/format";

export function Confirmation({ token, onRestart }: { token: string; onRestart: () => void }) {
  const [reg, setReg] = useState<Checkin | null | undefined>(undefined);
  const [waitlistPos, setWaitlistPos] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from("checkins")
        .select("*, sessions(*)")
        .eq("qr_token", token)
        .maybeSingle();
      if (cancelled) return;
      setReg(data as Checkin | null);

      if (data?.status === "waitlisted") {
        const { data: ahead } = await supabase
          .from("checkins")
          .select("id, created_at")
          .eq("session_id", data.session_id)
          .eq("status", "waitlisted");
        if (cancelled) return;
        const pos = (ahead ?? []).filter((a) => a.created_at <= data.created_at).length;
        setWaitlistPos(pos);
      }
    }

    load();
    const channel = supabase
      .channel("reg-" + token)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "checkins", filter: "qr_token=eq." + token },
        load
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [token]);

  useEffect(() => {
    if (!reg || reg.status !== "confirmed" || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, token, { width: 220, margin: 1, color: { dark: "#082e28" } });
  }, [reg, token]);

  if (reg === undefined) {
    return <Card className="py-6 text-center text-sm text-ink-soft">Carregando...</Card>;
  }
  if (reg === null) {
    return <Card className="py-6 text-center text-sm text-ink-soft">Inscrição não encontrada.</Card>;
  }

  if (reg.status === "waitlisted") {
    return (
      <Card className="text-center">
        <Badge tone="wait" className="mb-3">
          Na fila de espera
        </Badge>
        <div className="my-2 text-3xl font-extrabold text-clay">{waitlistPos ?? "…"}º</div>
        <p className="mb-1 text-sm text-ink">
          Assim que uma vaga abrir, você é chamado automaticamente e um QR aparece aqui.
        </p>
        <p className="text-xs text-ink-soft">Deixe esta página aberta — ela atualiza sozinha.</p>
      </Card>
    );
  }

  if (reg.status === "checked_in") {
    const activityLbl = reg.activity === "handson" ? "Hands-on" : "Palestra";
    return (
      <Card className="py-10 text-center">
        <span className="animate-icon-pop mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sage-tint text-moss-deep">
          <CheckCircle2 className="h-10 w-10" />
        </span>
        <h2 className="animate-rise mt-5 text-[1.35rem] font-black tracking-tight text-moss-deep">
          Check-in realizado com sucesso!
        </h2>
        <p className="animate-rise mt-1.5 text-[1.05rem] font-bold text-ink" style={{ animationDelay: "0.08s" }}>
          Bom curso!
        </p>
        <p className="animate-rise mt-4 text-sm text-ink-soft" style={{ animationDelay: "0.16s" }}>
          <b>{activityLbl}</b> — {reg.sessions?.title} · {reg.sessions ? fmtDT(reg.sessions.session_time) : ""}
        </p>
        <Button
          variant="outline"
          className="animate-rise mt-6"
          style={{ animationDelay: "0.24s" }}
          onClick={onRestart}
        >
          <Home className="h-4 w-4" />
          Voltar para o início
        </Button>
      </Card>
    );
  }

  if (reg.status === "confirmed") {
    const activityLbl = reg.activity === "handson" ? "Hands-on" : "Palestra";
    return (
      <Card className="text-center">
        <Badge tone="ok" className="mb-3">
          Inscrição confirmada
        </Badge>
        <canvas ref={canvasRef} className="mx-auto my-1 rounded-xl" />
        <p className="mb-1 mt-3 text-sm text-ink">
          <b>{activityLbl}</b> — {reg.sessions?.title} · {reg.sessions ? fmtDT(reg.sessions.session_time) : ""}
        </p>
        <p className="text-xs text-ink-soft">Chegue 15 min antes e mostre este QR pra equipe.</p>
        <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-clay-tint px-3.5 py-3 text-left">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/60 text-clay">
            <Ticket className="h-[18px] w-[18px]" />
          </span>
          <p className="text-[0.82rem] font-medium text-ink">Pegue sua pulseira de identificação com a equipe do estande ao chegar.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="text-center">
      <Badge tone="wait" className="mb-3">
        Inscrição encerrada
      </Badge>
      <p className="text-sm text-ink">Essa inscrição não está mais ativa (desistência ou cancelamento).</p>
    </Card>
  );
}
