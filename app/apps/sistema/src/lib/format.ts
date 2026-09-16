export function fmtDT(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const hh = String(d.getHours()).padStart(2, "0") + "h" + String(d.getMinutes()).padStart(2, "0");
  return sameDay ? hh : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + hh;
}
