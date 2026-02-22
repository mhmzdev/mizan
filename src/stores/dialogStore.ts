import { create } from "zustand";

export interface DialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
}

interface DialogState {
  open: boolean;
  options: DialogOptions | null;
  _resolve: ((confirmed: boolean) => void) | null;

  confirm: (opts: DialogOptions) => Promise<boolean>;
  _respond: (confirmed: boolean) => void;
}

export const useDialogStore = create<DialogState>((set, get) => ({
  open: false,
  options: null,
  _resolve: null,

  confirm: (opts) =>
    new Promise<boolean>((resolve) => {
      set({ open: true, options: opts, _resolve: resolve });
    }),

  _respond: (confirmed) => {
    get()._resolve?.(confirmed);
    set({ open: false, options: null, _resolve: null });
  },
}));
