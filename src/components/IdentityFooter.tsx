export default function IdentityFooter() {
  return (
    <div className="mt-12 flex flex-col items-center justify-center gap-4 py-8 border-t border-slate-100">    
       <div className="flex items-center gap-4 opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all">
          <img src="logo.png" alt="School Logo" className="w-10 h-10" />
          <div className="h-8 w-px bg-slate-200"></div>
          <div className="text-left">
             <p className="text-[10px] font-black text-slate-800 uppercase tracking-tighter">โรงเรียนบ้านควนโคกยา</p>
             <p className="text-[8px] font-bold text-brand-primary uppercase tracking-widest">Office of Primary Education</p>
          </div>
       </div>
       <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">
          Smart School Admin © 2026 | <span className="text-slate-600">Phairot Makkaew & Gemini AI</span>     
       </p>
    </div>
  );
}
