import { Construction } from 'lucide-react';

export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[40px] border border-slate-100 shadow-sm animate-in fade-in duration-500">
      <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-amber-100/50">
        <Construction size={40} />
      </div>
      <h3 className="text-2xl font-black text-slate-800 tracking-tight">{title}</h3>
      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2">กำลังพัฒนาระบบ (Coming Soon)</p>
      <div className="mt-8 flex gap-2">
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" />
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce [animation-delay:-0.15s]" />
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce [animation-delay:-0.3s]" />
      </div>
    </div>
  );
}
