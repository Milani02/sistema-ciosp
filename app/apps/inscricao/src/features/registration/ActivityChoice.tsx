import { Card, IconChip } from "@biodinamica/ui";
import { FlaskConical, Mic } from "lucide-react";
import type { Activity } from "@biodinamica/supabase";

export function ActivityChoice({ onChoose }: { onChoose: (activity: Activity) => void }) {
  return (
    <Card className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => onChoose("handson")}
        className="flex items-center gap-3 rounded-2xl border-2 border-line bg-surface p-4 text-left hover:border-sage"
      >
        <IconChip icon={FlaskConical} tone="moss" className="h-11 w-11" />
        <div>
          <div className="text-[1.05rem] font-bold text-ink">Hands-on</div>
          <div className="mt-0.5 text-[0.82rem] text-ink-soft">Demonstração prática na bancada</div>
        </div>
      </button>
      <button
        type="button"
        onClick={() => onChoose("palestra")}
        className="flex items-center gap-3 rounded-2xl border-2 border-line bg-surface p-4 text-left hover:border-sage"
      >
        <IconChip icon={Mic} tone="moss" className="h-11 w-11" />
        <div>
          <div className="text-[1.05rem] font-bold text-ink">Palestra</div>
          <div className="mt-0.5 text-[0.82rem] text-ink-soft">Apresentação no auditório do estande</div>
        </div>
      </button>
    </Card>
  );
}
