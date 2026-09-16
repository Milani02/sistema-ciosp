import { useState } from "react";
import { BottomSheet, Button, Textarea } from "@biodinamica/ui";

export function RemoveStockSheet({
  open,
  productName,
  quantity,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  productName: string;
  quantity: number;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState("");

  function handleConfirm() {
    const trimmed = note.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    setNote("");
  }

  function handleCancel() {
    setNote("");
    onCancel();
  }

  return (
    <BottomSheet open={open} onOpenChange={(v) => !v && handleCancel()} title="Motivo da retirada">
      <p className="mb-1 text-[0.8rem] text-ink-soft">
        Removendo {quantity} unidade{quantity === 1 ? "" : "s"} de <b>{productName}</b> do estoque. Por quê?
      </p>
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Ex.: quebrado, perdido, contagem errada..."
        rows={3}
        autoFocus
      />
      <div className="mt-3 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={handleCancel}>
          Cancelar
        </Button>
        <Button className="flex-1" disabled={!note.trim()} onClick={handleConfirm}>
          Confirmar
        </Button>
      </div>
    </BottomSheet>
  );
}
