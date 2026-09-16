import * as React from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "./Button";

interface ErrorBoundaryState {
  error: Error | null;
}

/** Catches render-time errors anywhere below it so one broken screen
 *  doesn't take down the whole app with a white screen — shows a
 *  recovery screen with a reload button instead. React error boundaries
 *  only catch errors thrown during render/lifecycle, not inside event
 *  handlers or async callbacks (those need their own try/catch + toast,
 *  which is already the pattern used across this app's Supabase calls). */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-linen px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brick-tint text-brick">
            <TriangleAlert className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-ink">Essa tela travou</h1>
            <p className="mt-1 max-w-[320px] text-sm text-ink-soft">
              Nada que já foi salvo se perdeu — é só recarregar que volta ao normal.
            </p>
          </div>
          <Button className="w-auto px-6" onClick={() => window.location.reload()}>
            Recarregar
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
