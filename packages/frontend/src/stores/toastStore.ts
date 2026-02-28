import { create } from 'zustand';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'destructive';
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

let toastCounter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = `toast-${++toastCounter}`;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    // Auto-remove after 4 seconds
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

// Convenience functions
export function toast(title: string, description?: string) {
  useToastStore.getState().addToast({ title, description, variant: 'default' });
}

export function toastSuccess(title: string, description?: string) {
  useToastStore.getState().addToast({ title, description, variant: 'success' });
}

export function toastError(title: string, description?: string) {
  useToastStore.getState().addToast({ title, description, variant: 'destructive' });
}
