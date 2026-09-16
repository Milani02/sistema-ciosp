import { useState } from "react";
import { BottomSheet, Button, FieldLabel, Select, Textarea, cn, showToast } from "@biodinamica/ui";
import { Megaphone } from "lucide-react";
import type { Department } from "@biodinamica/supabase";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/useAuth";

export function AnnouncementComposer() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [target, setTarget] = useState<Department | "ambas">("ambas");
  const [sending, setSending] = useState(false);

  if (!profile || profile.level !== "admin") return null;

  async function send() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    const { error } = await supabase
      .from("announcements")
      .insert({ text: trimmed, author_name: profile!.name, target });
    setSending(false);
    if (error) {
      showToast("Erro: " + error.message);
      return;
    }
    setText("");
    setOpen(false);
    showToast("Comunicado enviado.");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-[calc(5.2rem+env(safe-area-inset-bottom))] left-4 z-[55] flex items-center gap-2 rounded-full bg-clay px-4 py-3 text-[0.84rem] font-bold text-white shadow-[var(--shadow-lift)]"
        )}
      >
        <Megaphone className="h-[17px] w-[17px]" />
        Comunicado
      </button>

      <BottomSheet open={open} onOpenChange={setOpen} title="Mandar comunicado pra equipe">
        <p className="mb-2 text-[0.8rem] text-ink-soft">
          Aparece na hora, em popup, na tela de quem tiver acesso de staff na equipe escolhida.
        </p>
        <FieldLabel className="mt-0">Pra quem</FieldLabel>
        <Select value={target} onChange={(e) => setTarget(e.target.value as Department | "ambas")}>
          <option value="ambas">Consultoria Técnica + Comercial</option>
          <option value="tecnica">Só Consultoria Técnica</option>
          <option value="comercial">Só Comercial</option>
        </Select>
        <FieldLabel>Mensagem</FieldLabel>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ex.: Reunião rápida no estande em 10 min."
          rows={4}
          maxLength={280}
          autoFocus
        />
        <Button className="mt-3" onClick={send} loading={sending} disabled={!text.trim()}>
          <Megaphone className="h-4 w-4" />
          Enviar
        </Button>
      </BottomSheet>
    </>
  );
}
