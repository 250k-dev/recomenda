import { create } from "zustand";
import type { Step } from "react-joyride";

interface HelpTourState {
  steps: Step[];
  run: boolean;
  /** Muda a cada início — remonta o Joyride para o tour sempre recomeçar do passo 1. */
  runId: number;
  start: (steps: Step[]) => void;
  stop: () => void;
}

/** Tour em andamento. Quem inicia é a ajuda; quem desenha é o `<HelpTour />` da casca. */
export const useHelpTourStore = create<HelpTourState>()((set) => ({
  steps: [],
  run: false,
  runId: 0,
  start: (steps) =>
    set((state) => ({ steps, run: steps.length > 0, runId: state.runId + 1 })),
  stop: () => set({ run: false }),
}));
