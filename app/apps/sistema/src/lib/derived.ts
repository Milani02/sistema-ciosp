import type { Checkin, Session, SessionFeedback, Shift } from "@biodinamica/supabase";
import { fmtDT } from "./format";

export function sessionFillCount(checkins: Checkin[], sessionId: number) {
  return checkins.filter((c) => c.session_id === sessionId && (c.status === "confirmed" || c.status === "checked_in"))
    .length;
}

export type CapacityLevel = "ok" | "wait" | "crit";

/** ok até 80% da lotação, wait ("quase lotada") de 80% até <100%, crit a partir de 100%. */
export function capacityLevel(filled: number, capacity: number): CapacityLevel {
  if (capacity <= 0) return "ok";
  const ratio = filled / capacity;
  if (ratio >= 1) return "crit";
  if (ratio >= 0.8) return "wait";
  return "ok";
}

export function sessionRatingAvg(feedback: SessionFeedback[], sessionId: number) {
  const ratings = feedback.filter((f) => f.session_id === sessionId).map((f) => f.rating);
  if (ratings.length === 0) return null;
  return { avg: ratings.reduce((a, b) => a + b, 0) / ratings.length, count: ratings.length };
}

export function sessionLabel(sessions: Session[], sessionId: number) {
  const s = sessions.find((x) => x.id === sessionId);
  return s ? fmtDT(s.session_time) + " · " + s.title : "sessão removida";
}

export function isShiftNow(shift: Shift) {
  const today = new Date().toISOString().slice(0, 10);
  if (shift.day !== today) return false;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = shift.start_time.split(":").map(Number);
  const [eh, em] = shift.end_time.split(":").map(Number);
  const start = sh * 60 + (sm || 0);
  const end = eh * 60 + (em || 0);
  return cur >= start && cur <= end;
}
