import { Badge, Card, CardTitle, IconChip, ListEmpty, ListRow, PageHeader, StatTile } from "@biodinamica/ui";
import { Clock, LayoutDashboard, Star, TrendingUp, TriangleAlert, UserCheck, Users, UserX } from "lucide-react";
import { capacityLevel, isShiftNow, sessionFillCount } from "../../lib/derived";
import { fmtDT } from "../../lib/format";
import { useLiveData } from "../live-data/useLiveData";

export function PainelPage() {
  const { staff, shifts, checkins, sessions, feedback, alerts } = useLiveData();

  const nowShifts = shifts.filter(isShiftNow);

  const aguardando = checkins.filter((c) => c.status === "confirmed").length;
  const checkedIn = checkins.filter((c) => c.status === "checked_in").length;
  const noShow = checkins.filter((c) => c.status === "no_show").length;
  const fila = checkins.filter((c) => c.status === "waitlisted").length;
  const comparecimentoBase = checkedIn + noShow;
  const taxaComparecimento = comparecimentoBase === 0 ? null : Math.round((checkedIn / comparecimentoBase) * 100);

  const ratings = feedback.map((f) => f.rating);
  const ratingAvg = ratings.length === 0 ? null : ratings.reduce((a, b) => a + b, 0) / ratings.length;

  const quaseLotando = sessions
    .map((s) => ({ session: s, filled: sessionFillCount(checkins, s.id) }))
    .filter(({ session, filled }) => capacityLevel(filled, session.capacity) === "wait")
    .sort((a, b) => new Date(a.session.session_time).getTime() - new Date(b.session.session_time).getTime());

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        tone="brick"
        title="Painel do Administrador"
        subtitle="Visão ao vivo consolidada — atualiza sozinho conforme qualquer tablet ou visitante registra algo."
      />

      <Card>
        <CardTitle>Funil de hoje</CardTitle>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile value={aguardando} label="Aguardando chegada" icon={Clock} tone="clay" live />
          <StatTile value={checkedIn} label="Check-ins feitos" icon={UserCheck} tone="moss" live />
          <StatTile value={noShow} label="Não compareceram" icon={UserX} tone="brick" live />
          <StatTile value={fila} label="Na fila de espera" icon={Users} tone="sage" live />
          <StatTile
            value={taxaComparecimento === null ? "—" : `${taxaComparecimento}%`}
            label="Taxa de comparecimento"
            icon={TrendingUp}
            tone="moss"
          />
          <StatTile
            value={ratingAvg === null ? "—" : `${ratingAvg.toFixed(1)} ★`}
            label={`Avaliação média${ratings.length > 0 ? ` (${ratings.length})` : ""}`}
            icon={Star}
            tone="clay"
          />
        </div>
      </Card>

      <Card className="mt-4">
        <CardTitle>Sessões quase lotando</CardTitle>
        {quaseLotando.length === 0 ? (
          <ListEmpty>Nenhuma sessão perto da lotação agora.</ListEmpty>
        ) : (
          <div className="divide-y divide-line">
            {quaseLotando.map(({ session, filled }) => (
              <ListRow
                key={session.id}
                icon={TriangleAlert}
                iconTone="clay"
                title={session.title}
                subtitle={`${fmtDT(session.session_time)} · ${session.activity === "handson" ? "Hands-on" : "Palestra"}`}
                trailing={<Badge tone="wait">{filled}/{session.capacity}</Badge>}
              />
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <CardTitle>Quem está de plantão agora</CardTitle>
        {nowShifts.length === 0 ? (
          <ListEmpty>Nenhum turno cadastrado pra este horário.</ListEmpty>
        ) : (
          <div className="divide-y divide-line">
            {nowShifts.map((s) => {
              const member = staff.find((x) => x.id === s.staff_id);
              return (
                <ListRow
                  key={s.id}
                  icon={UserCheck}
                  iconTone="moss"
                  title={member ? member.name : "?"}
                  subtitle={s.area === "handson" ? "Hands-on" : "Palestra"}
                />
              );
            })}
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <CardTitle>Alertas</CardTitle>
        {alerts.length === 0 ? (
          <ListEmpty>Nenhum alerta no momento.</ListEmpty>
        ) : (
          <div className="mt-1 flex flex-col gap-2">
            {alerts.slice(0, 20).map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl bg-brick-tint px-3.5 py-2.5">
                <IconChip icon={TriangleAlert} tone="brick" className="h-8 w-8" />
                <span className="flex-1 text-[0.83rem] text-ink">{a.text}</span>
                <span className="shrink-0 text-[0.68rem] text-ink-soft">
                  {new Date(a.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
