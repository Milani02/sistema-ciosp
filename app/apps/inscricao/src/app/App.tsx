import { useState } from "react";
import { AppHeader, LivingLinesBackground, ThemeToggle, Toaster } from "@biodinamica/ui";
import type { Activity } from "@biodinamica/supabase";
import { ActivityChoice } from "../features/registration/ActivityChoice";
import { SessionList } from "../features/registration/SessionList";
import { RegistrationForm } from "../features/registration/RegistrationForm";
import { Confirmation } from "../features/registration/Confirmation";

type Step =
  | { name: "activity" }
  | { name: "sessions"; activity: Activity }
  | { name: "form"; activity: Activity; sessionId?: number }
  | { name: "confirm"; token: string };

function initialStep(): Step {
  const params = new URLSearchParams(location.search);
  const token = params.get("r");
  return token ? { name: "confirm", token } : { name: "activity" };
}

export default function App() {
  const [step, setStep] = useState<Step>(initialStep);

  return (
    <div className="noir-bg relative min-h-screen">
      <LivingLinesBackground fixed />

      <div className="relative mx-auto max-w-[460px] pb-12 sm:max-w-[720px]">
      <AppHeader transparent eyebrow="Biodinâmica · CIOSP 2027" title="Inscreva-se no estande" right={<ThemeToggle />} />
      <main className="px-4 py-5 sm:px-6">
        {step.name !== "confirm" && (
          <p className="mb-4 text-[0.86rem] text-white/70">
            A inscrição abre 1 hora antes de cada sessão. Você recebe um QR — mostre pra equipe 15 min antes do
            horário.
          </p>
        )}

        {step.name === "activity" && (
          <ActivityChoice
            onChoose={(activity) =>
              setStep(activity === "handson" ? { name: "form", activity } : { name: "sessions", activity })
            }
          />
        )}

        {step.name === "sessions" && (
          <SessionList
            activity={step.activity}
            onBack={() => setStep({ name: "activity" })}
            onSelect={(sessionId) => setStep({ name: "form", activity: step.activity, sessionId })}
          />
        )}

        {step.name === "form" && (
          <RegistrationForm
            activity={step.activity}
            sessionId={step.sessionId}
            onBack={() =>
              setStep(step.sessionId !== undefined ? { name: "sessions", activity: step.activity } : { name: "activity" })
            }
            onRegistered={(token) => setStep({ name: "confirm", token })}
          />
        )}

        {step.name === "confirm" && (
          <Confirmation
            token={step.token}
            onRestart={() => {
              history.replaceState(null, "", location.pathname);
              setStep({ name: "activity" });
            }}
          />
        )}
      </main>
      </div>
      <Toaster />
    </div>
  );
}
