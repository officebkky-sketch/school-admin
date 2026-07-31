import { useEffect, useState } from 'react';
import { toast } from '../lib/toast';
import type { ToastItem } from '../lib/toast';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toast.subscribe((updatedToasts) => {
      setToasts(updatedToasts);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map((item) => {
        const icons = {
          success: <CheckCircle2 className="text-emerald-500 shrink-0" size={24} />,
          error: <AlertCircle className="text-rose-500 shrink-0" size={24} />,
          warning: <AlertTriangle className="text-amber-500 shrink-0" size={24} />,
          info: <Info className="text-blue-500 shrink-0" size={24} />
        };

        const borderStyles = {
          success: 'border-emerald-200/80 bg-emerald-50/90 text-emerald-950',
          error: 'border-rose-200/80 bg-rose-50/90 text-rose-950',
          warning: 'border-amber-200/80 bg-amber-50/90 text-amber-950',
          info: 'border-blue-200/80 bg-blue-50/90 text-blue-950'
        };

        return (
          <div
            key={item.id}
            className={`pointer-events-auto p-4 rounded-[24px] border backdrop-blur-xl shadow-xl flex items-start gap-3.5 transition-all duration-300 animate-in fade-in-0 slide-in-from-bottom-5 duration-300 ${borderStyles[item.type]}`}
          >
            {icons[item.type]}
            <div className="flex-1 pr-2">
              <h4 className="text-sm font-black tracking-tight leading-tight">{item.title}</h4>
              {item.message && (
                <p className="text-xs font-medium opacity-80 mt-1 leading-relaxed">{item.message}</p>
              )}
            </div>
            <button
              onClick={() => toast.dismiss(item.id)}
              className="p-1.5 hover:bg-black/5 rounded-xl transition-colors text-slate-400 hover:text-slate-600 shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
