import type { RefObject } from "react";

export function CameraModal({
  open,
  videoRef,
  onCancel,
}: {
  open: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-[#141a0c]/85 p-4">
      <video ref={videoRef} autoPlay playsInline muted className="w-full max-w-[480px] rounded-2xl bg-black" />
      <div className="max-w-[320px] text-center text-sm text-white">Aponte a câmera pro QR do visitante</div>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-ink"
      >
        Cancelar
      </button>
    </div>
  );
}
