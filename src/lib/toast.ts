import React from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

class ToastManager {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastListener> = new Set();

  subscribe(listener: ToastListener) {
    this.listeners.add(listener);
    listener(this.toasts);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener([...this.toasts]));
  }

  show(type: ToastType, title: string, message?: string, duration = 4000) {
    const id = Math.random().toString(36).substring(2, 9);
    const item: ToastItem = { id, type, title, message, duration };
    this.toasts.push(item);
    this.notify();

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }
    return id;
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  success(title: string, message?: string, duration?: number) {
    return this.show('success', title, message, duration);
  }

  error(title: string, message?: string, duration?: number) {
    return this.show('error', title, message, duration);
  }

  info(title: string, message?: string, duration?: number) {
    return this.show('info', title, message, duration);
  }

  warning(title: string, message?: string, duration?: number) {
    return this.show('warning', title, message, duration);
  }
}

export const toast = new ToastManager();
