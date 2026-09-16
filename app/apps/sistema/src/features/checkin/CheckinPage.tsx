import { useEffect, useMemo, useState } from "react";
import { Button, Card, CardTitle, EmptyState, FieldLabel, Input, ListRow, PageHeader, Select, SkeletonRow, showToast } from "@biodinamica/ui";
import { AlertCircle, Camera, CheckCircle2, ScanLine, TriangleAlert, UserRound, UsersRound } from "lucide-react";
import type { Activity } from "@biodinamica/supabase";
import { supabase } from "../../lib/supabase";
import { sessionFillCount, sessionLabel } from "../../lib/derived";
import { fmtDT } from "../../lib/format";
import { useLiveData } from "../live-data/useLiveData";
import { useCameraScan } from "../camera/useCameraScan";

type ResultKind = "ok" | "warn" | "bad";
const RESULT_STYLE: Record<ResultKind, string> = {
  ok: "bg-sage-tint text-moss-deep",
  warn: "bg-clay-tint text-clay",
  bad: "bg-brick-tint text-brick",
};
const RESULT_ICON = { ok: CheckCircle2, warn: TriangleAlert, bad: AlertCircle };

export function CheckinPage() {
  const { checkins, sessions, loading } = useLiveData();
  const { requestScan } = useCameraScan();
  const [qrInput, setQrInput] = useState("");
  const [result, setResult] = useState<{ kind: ResultKind; text: string } | null>(null);

  const [manualSession, setManualSession] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualInfo, setManualInfo] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => new Date(a.session_time).getTime() - new Date(b.session_time).getTime()),
    [sessions]
  );

  useEffect(() => {
    if (!manualSession && sortedSessions.length > 0) {
      const firstOpen = sortedSessions.find((s) => sessionFillCount(checkins, s.id) < s.capacity);
      if (firstOpen) setManualSession(String(firstOpen.id));
    }
  }, [sortedSessions, checkins, manualSession]);

  async function processQrCheckin(token: string) {
    if (!token) return;
    const { data, error } = await supabase.rpc("checkin_by_qr", { p_token: token });
    if (error) {
      setResult({ kind: "bad", text: "Erro: " + error.message });
      return;
    }
    const row = data?.[0];
    if (!row) {
      setResult({ kind: "bad", text: "QR não reconhecido." });
      return;
    }
    const activityLbl = row.out_activity === "handson" ? "Hands-on" : "Palestra";
    if (row.out_result === "ok") {
      setResult({
        kind: "ok",
        text: `Check-in feito: ${row.out_name} (${activityLbl}) — entregar pulseira ${row.out_wristband}`,
      });
      showToast("Check-in confirmado — pulseira " + row.out_wristband);
    } else if (row.out_result === "already") {
      setResult({ kind: "warn", text: `Check-in já tinha sido feito antes: ${row.out_name} — pulseira ${row.out_wristband}` });
    } else if (row.out_result === "waitlisted") {
      setResult({ kind: "warn", text: `${row.out_name} ainda está na fila de espera — sem vaga confirmada ainda.` });
    } else if (row.out_result === "expired") {
      setResult({ kind: "bad", text: "Essa inscrição não é mais válida (desistência ou cancelada)." });
    } else {
      setResult({ kind: "bad", text: "QR não encontrado no sistema." });
    }
    setQrInput("");
  }

  async function submitManual() {
    if (!manualSession) {
      showToast("Escolha uma sessão.");
      return;
    }
    const name = manualName.trim();
    if (!name) {
      showToast("Digite o nome do visitante.");
      return;
    }
    setManualSubmitting(true);
    const { data, error } = await supabase.rpc("manual_checkin", {
      p_session_id: parseInt(manualSession, 10),
      p_name: name,
      p_info: manualInfo.trim() || null,
    });
    setManualSubmitting(false);
    if (error) {
      showToast("Erro: " + error.message);
      return;
    }
    const row = data?.[0];
    if (row?.out_status === "lotada") {
      showToast("Sessão lotada — escolha outra.");
      return;
    }
    setManualName("");
    setManualInfo("");
    showToast("Cadastrado e check-in feito — pulseira " + (row ? row.out_wristband : "") + ".");
  }

  function waitingList(activity: Activity) {
    return checkins
      .filter((c) => c.activity === activity && c.status === "confirmed")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  return (
    <>
      <PageHeader
        icon={ScanLine}
        tone="moss"
        title="Check-in do visitante"
        subtitle="O visitante já se inscreveu pelo celular dele. Escaneie o QR pessoal que ele mostra na tela — o sistema confirma a chegada e mostra qual pulseira entregar."
      />

      <Card>
        <CardTitle>Escanear QR do visitante</CardTitle>
        <div className="flex gap-2">
          <Input
            value={qrInput}
            onChange={(e) => setQrInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                processQrCheckin(qrInput.trim());
              }
            }}
            placeholder="Aponte o leitor aqui e escaneie"
          />
          <button
            type="button"
            title="Escanear com a câmera"
            onClick={() => requestScan((code) => { setQrInput(code); processQrCheckin(code); })}
            className="flex shrink-0 items-center justify-center rounded-xl bg-sage-tint px-3 text-moss-deep"
          >
            <Camera className="h-[17px] w-[17px]" />
          </button>
        </div>
        <Button className="mt-3" onClick={() => processQrCheckin(qrInput.trim())}>
          <ScanLine className="h-4 w-4" />
          Confirmar check-in
        </Button>
        {result && (
          <div className={"mt-3 flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium " + RESULT_STYLE[result.kind]}>
            {(() => {
              const Icon = RESULT_ICON[result.kind];
              return <Icon className="mt-0.5 h-4 w-4 shrink-0" />;
            })()}
            <span>{result.text}</span>
          </div>
        )}
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(["handson", "palestra"] as Activity[]).map((activity) => (
          <Card key={activity}>
            <CardTitle>Aguardando chegada · {activity === "handson" ? "Hands-on" : "Palestra"}</CardTitle>
            <div className="mt-2 max-h-[300px] divide-y divide-line overflow-y-auto border-t border-line">
              {loading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : waitingList(activity).length === 0 ? (
                <EmptyState icon={UsersRound} title="Ninguém aguardando" subtitle="Assim que alguém confirmar presença, aparece aqui." />
              ) : (
                waitingList(activity).map((c) => (
                  <ListRow
                    key={c.id}
                    icon={UserRound}
                    title={c.visitor_name}
                    subtitle={sessionLabel(sessions, c.session_id)}
                    trailing={
                      <Button size="sm" className="w-auto" onClick={() => processQrCheckin(c.qr_token)}>
                        Check-in
                      </Button>
                    }
                  />
                ))
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardTitle>Cadastrar visitante sem celular</CardTitle>
        <FieldLabel className="mt-0">Sessão</FieldLabel>
        <Select value={manualSession} onChange={(e) => setManualSession(e.target.value)}>
          {sortedSessions.length === 0 ? (
            <option value="">Nenhuma sessão cadastrada — vá em Agenda</option>
          ) : (
            sortedSessions.map((s) => {
              const filled = sessionFillCount(checkins, s.id);
              const full = filled >= s.capacity;
              const lbl = `${s.activity === "handson" ? "Hands-on" : "Palestra"} · ${fmtDT(s.session_time)} · ${s.title}`;
              return (
                <option key={s.id} value={s.id} disabled={full}>
                  {lbl} ({filled}/{s.capacity}{full ? " · lotada" : ""})
                </option>
              );
            })
          )}
        </Select>
        <FieldLabel>Nome do visitante</FieldLabel>
        <Input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Nome completo" />
        <FieldLabel>CRO / contato (opcional)</FieldLabel>
        <Input value={manualInfo} onChange={(e) => setManualInfo(e.target.value)} placeholder="CRO-SP 00000" />
        <Button className="mt-3" loading={manualSubmitting} onClick={submitManual}>
          <CheckCircle2 className="h-4 w-4" />
          Cadastrar e fazer check-in
        </Button>
      </Card>
    </>
  );
}
