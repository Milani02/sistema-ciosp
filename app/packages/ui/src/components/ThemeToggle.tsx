import { Moon, Sun } from "lucide-react";
import { useTheme } from "../lib/useTheme";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={theme === "dark" ? "Tema claro" : "Tema escuro"}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/80 hover:bg-white/20"
    >
      {theme === "dark" ? <Sun className="h-[15px] w-[15px]" /> : <Moon className="h-[15px] w-[15px]" />}
    </button>
  );
}
