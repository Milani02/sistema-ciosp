import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import jsQR from "jsqr";
import { showToast } from "@biodinamica/ui";
import { CameraModal } from "./CameraModal";

interface CameraScanApi {
  requestScan: (onResult: (code: string) => void) => void;
}

const CameraScanContext = createContext<CameraScanApi | null>(null);

export function useCameraScan() {
  const ctx = useContext(CameraScanContext);
  if (!ctx) throw new Error("useCameraScan must be used inside <CameraScanProvider>");
  return ctx;
}

export function CameraScanProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  function close() {
    setOpen(false);
    window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function requestScan(onResult: (code: string) => void) {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast("Este navegador não dá acesso à câmera. Use um leitor USB/Bluetooth ou digite o código.");
      return;
    }

    setOpen(true);
    await new Promise((r) => setTimeout(r, 0)); // let <video> mount before attaching the stream

    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    } catch (e) {
      showToast("Não consegui acessar a câmera: " + (e as Error).message);
      close();
      return;
    }
    if (videoRef.current) videoRef.current.srcObject = streamRef.current;

    if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext("2d", { willReadFrequently: true });

    timerRef.current = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || !canvasCtx || video.readyState < video.HAVE_CURRENT_DATA || video.videoWidth === 0) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvasCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = canvasCtx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(frame.data, frame.width, frame.height);
      if (result) {
        close();
        onResult(result.data);
      }
    }, 300);
  }

  return (
    <CameraScanContext.Provider value={{ requestScan }}>
      {children}
      <CameraModal open={open} videoRef={videoRef} onCancel={close} />
    </CameraScanContext.Provider>
  );
}
