import {
  BarChart3,
  Boxes,
  Calendar,
  CheckCircle2,
  ClipboardList,
  History,
  Package,
  ShoppingCart,
  UserPlus,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Department, Profile } from "@biodinamica/supabase";

export interface NavEntry {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Omit for screens shared across every department. Array for a
   *  screen shared across a few specific departments only. */
  department?: Department | Department[];
  adminOnly?: boolean;
}

export const NAV: NavEntry[] = [
  { path: "/check-in", label: "Check-in", icon: CheckCircle2, department: "tecnica" },
  { path: "/agenda", label: "Agenda", icon: Calendar, department: "tecnica", adminOnly: true },
  { path: "/inscritos", label: "Inscritos", icon: ClipboardList, department: "tecnica" },
  { path: "/painel", label: "Painel", icon: BarChart3, department: "tecnica", adminOnly: true },
  { path: "/comercial/venda", label: "Venda", icon: ShoppingCart, department: "comercial" },
  { path: "/comercial/historico", label: "Histórico", icon: History, department: "comercial" },
  { path: "/comercial/produtos", label: "Produtos", icon: Package, department: "comercial", adminOnly: true },
  // Login exclusivo — não é staff/admin comercial, é o próprio departamento "caixa".
  { path: "/caixa", label: "Caixa", icon: Wallet, department: "caixa" },
  { path: "/caixa/estoque", label: "Estoque", icon: Boxes, department: "caixa" },
  { path: "/caixa/historico", label: "Histórico", icon: History, department: "caixa" },
  // Login exclusivo — não é comercial/caixa, é o próprio departamento "cadastro".
  { path: "/cadastro", label: "Cadastros", icon: UserPlus, department: "cadastro" },
  // Dashboard só pra quem administra gente — admin comercial e admin
  // técnica, não caixa/cadastro.
  {
    path: "/almoco",
    label: "Almoço",
    icon: UtensilsCrossed,
    department: ["comercial", "tecnica"],
    adminOnly: true,
  },
  // Login individual de autoatendimento (staff_id setado) — ver navFor,
  // essa conta só enxerga essa única tela, não importa o department dela.
  { path: "/meu-almoco", label: "Meu almoço", icon: UtensilsCrossed },
];

export function navFor(profile: Profile): NavEntry[] {
  // Login individual de autoatendimento do almoço — não é uma conta de
  // departamento normal, só existe pra essa pessoa marcar o próprio
  // status. Não mostra nada além disso, nem que o department bata com
  // alguma outra tela.
  if (profile.staff_id != null) {
    return NAV.filter((n) => n.path === "/meu-almoco");
  }
  return NAV.filter(
    (n) =>
      n.path !== "/meu-almoco" &&
      (!n.department ||
        (Array.isArray(n.department) ? n.department.includes(profile.department) : n.department === profile.department)) &&
      (!n.adminOnly || profile.level === "admin")
  );
}

export function defaultPathFor(profile: Profile): string {
  if (profile.staff_id != null) return "/meu-almoco";
  if (profile.department === "comercial") return "/comercial/venda";
  if (profile.department === "caixa") return "/caixa";
  if (profile.department === "cadastro") return "/cadastro";
  return "/check-in";
}
