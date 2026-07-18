import { create } from "zustand";

interface ImpersonationState {
  isImpersonating: boolean;
  producerId: string | null;
  producerName: string | null;
  startImpersonation: (params: { producerId: string; producerName: string }) => void;
  clearImpersonation: () => void;
}

export const useImpersonationStore = create<ImpersonationState>((set) => ({
  isImpersonating: false,
  producerId: null,
  producerName: null,
  startImpersonation: ({ producerId, producerName }) =>
    set({
      isImpersonating: true,
      producerId,
      producerName,
    }),
  clearImpersonation: () =>
    set({
      isImpersonating: false,
      producerId: null,
      producerName: null,
    }),
}));
