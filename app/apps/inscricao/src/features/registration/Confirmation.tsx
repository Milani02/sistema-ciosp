import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Camera, CheckCircle2, Home, MapPin, Ticket } from "lucide-react";
import { Badge, Button, Card } from "@biodinamica/ui";
import type { Checkin } from "@biodinamica/supabase";
import { supabase } from "../../lib/supabase";
import { fmtDT } from "../../lib/format";

// TODO: endereço fictício — trocar pelo endereço real do estande assim
// que a organização do CIOSP divulgar o mapa/numeração dos estandes.
const BOOTH_ADDRESS = "Expo Center Norte · Pavilhão Branco · Estande A-000";

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

        <div className="mt-4 rounded-xl border-2 border-moss bg-sage-tint px-4 py-3.5 text-left">
          <div className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/70 text-moss-deep">
              <Ticket className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[0.95rem] font-black leading-tight text-moss-deep">Inscrição efetuada</p>
              <p className="mt-1 text-[0.86rem] font-semibold leading-snug text-ink">
                Para confirmar sua inscrição, se dirija à equipe no estande e retire sua pulseira de acesso.
              </p>
              <p className="mt-2 flex items-center gap-1 text-[0.76rem] text-ink-soft">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {BOOTH_ADDRESS}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-xl border-2 border-brick bg-brick-tint px-4 py-3.5 text-left">
          <div className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/70 text-brick">
              <Camera className="h-5 w-5" />
            </span>
            <div className="space-y-1.5">
              <p className="text-[0.84rem] font-bold leading-snug text-brick">
                Tire um print/screenshot deste QR Code — sem ele você não entra na palestra/hands-on.
              </p>
              <p className="text-[0.78rem] font-semibold leading-snug text-brick/90">
                Take a screenshot of this QR Code — without it you won't be able to enter the lecture/hands-on.
              </p>
              <p className="text-[0.78rem] font-semibold leading-snug text-brick/90">
                Toma una captura de pantalla de este código QR — sin ella no podrás entrar a la charla/hands-on.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-ink-soft">Chegue 15 min antes e mostre este QR pra equipe.</p>
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
