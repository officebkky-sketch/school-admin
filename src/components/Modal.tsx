import React from 'react';
import { X, Sparkles } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | 'full';
}

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  size = '2xl'
}: ModalProps) {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-xl',
    xl: 'max-w-3xl',
    '2xl': 'max-w-4xl',
    '4xl': 'max-w-6xl',
    full: 'max-w-[95vw]'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop with Backdrop Blur & Smooth Dark Overlay */}
      <div
        className="fixed inset-0 bg-slate-950/65 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        className={`relative bg-white/95 backdrop-blur-2xl w-full ${sizeClasses[size]} rounded-[36px] shadow-2xl border border-white/50 ring-1 ring-slate-900/10 flex flex-col max-h-[92vh] overflow-hidden transition-all duration-300 animate-in fade-in-0 zoom-in-95 duration-200`}
      >
        {/* Top Decorative Gradient Line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-brand-primary via-indigo-500 to-purple-500" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100/80 bg-slate-50/50">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-primary/10 via-purple-500/10 to-indigo-500/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary shadow-xs shrink-0">
              {icon || <Sparkles size={22} />}
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight">{title}</h3>
              {subtitle && (
                <p className="text-[11px] font-bold text-slate-400 mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-slate-100/80 hover:bg-red-50 hover:text-red-500 text-slate-400 transition-all duration-200 flex items-center justify-center hover:scale-105 active:scale-95 shadow-xs"
            title="ปิดหน้าต่าง"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}
