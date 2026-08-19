import React from 'react';
import { verifyDocumentStructure, type DocToCheck } from '../lib/docChecker';
import { CheckCircle2, AlertTriangle, XCircle, Info, ShieldCheck, Sparkles } from 'lucide-react';


interface Props {
  doc: DocToCheck;
  compact?: boolean;
}

export const DocVerificationBadge: React.FC<{ doc: DocToCheck }> = ({ doc }) => {
  const result = verifyDocumentStructure(doc);

  return (
    <span 
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-2xs ${result.badgeColor}`}
      title={result.summaryMessage}
    >
      {result.status === 'passed' && <CheckCircle2 size={12} className="text-emerald-500" />}
      {result.status === 'warning' && <AlertTriangle size={12} className="text-amber-500" />}
      {result.status === 'needs_attention' && <XCircle size={12} className="text-rose-500" />}
      {result.status === 'reserved_pending_file' && <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />}
      {result.statusLabel}
    </span>
  );
};

export const DocVerificationCard: React.FC<Props> = ({ doc, compact = false }) => {
  const result = verifyDocumentStructure(doc);

  return (
    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 space-y-4 animate-in fade-in duration-300">
      {/* Header Row */}
      <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
            <Sparkles size={16} />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
              AI Workflow Checklist
              <span className="text-[9px] px-1.5 py-0.2 bg-purple-50 text-purple-600 rounded-sm font-bold">Smart Audit</span>
            </h4>
            <p className="text-[10px] text-slate-400 font-medium">{result.summaryMessage}</p>
          </div>
        </div>

        <div className="text-right">
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${result.badgeColor}`}>
            {result.statusLabel}
          </span>
          {!result.isReserved && (
            <p className="text-[9px] font-bold text-slate-400 mt-1">คะแนนความสมบูรณ์ {result.score}%</p>
          )}
        </div>
      </div>

      {/* Checklist items */}
      {!compact && (
        <div className="space-y-2">
          {result.items.map((item) => (
            <div 
              key={item.id} 
              className={`p-3 rounded-2xl border flex items-start gap-3 transition-all ${
                item.passed 
                  ? 'bg-white border-slate-100/80 text-slate-700' 
                  : item.severity === 'error'
                    ? 'bg-rose-50/50 border-rose-100 text-rose-800'
                    : 'bg-amber-50/50 border-amber-100 text-amber-800'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {item.passed ? (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                ) : item.severity === 'error' ? (
                  <XCircle size={16} className="text-rose-500" />
                ) : (
                  <AlertTriangle size={16} className="text-amber-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800">{item.title}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{item.description}</p>
                {item.recommendation && (
                  <p className="text-[10px] font-bold text-amber-600 mt-1 flex items-center gap-1">
                    💡 คำแนะนำ: {item.recommendation}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
