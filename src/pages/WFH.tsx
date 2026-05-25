import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Clock, 
  MapPin, 
  ArrowRightCircle, 
  ArrowLeftCircle,
  Loader2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function WFHModule() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [time, setTime] = useState(new Date().toLocaleTimeString('th-TH'));

  useEffect(() => {
    fetchLogs();
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString('th-TH')), 1000);
    return () => clearInterval(timer);
  }, []);

  async function fetchLogs() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('wfh_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(10);
    setLogs(data || []);
    setLoading(false);
  }

  async function handleLog(type: 'in' | 'out') {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('wfh_logs').insert([{
        user_id: user.id,
        log_type: type,
        location: 'สำนักงาน', // Default for now
        timestamp: new Date().toISOString()
      }]);
      if (error) throw error;
      fetchLogs();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white rounded-[40px] p-12 shadow-sm border border-slate-100 text-center">
        <h2 className="text-3xl font-bold text-slate-800 mb-2">ลงเวลาปฏิบัติงาน</h2>
        <p className="text-6xl font-black text-brand-primary tracking-tighter mb-8">{time}</p>
        
        <div className="grid grid-cols-2 gap-6">
          <button 
            disabled={isSaving}
            onClick={() => handleLog('in')}
            className="group p-8 bg-green-50 hover:bg-green-100 rounded-[32px] border-2 border-green-100 transition-all active:scale-95 flex flex-col items-center gap-4"
          >
            <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
              <ArrowRightCircle size={32} />
            </div>
            <span className="text-lg font-bold text-green-700">ลงเวลาเข้างาน</span>
          </button>

          <button 
            disabled={isSaving}
            onClick={() => handleLog('out')}
            className="group p-8 bg-orange-50 hover:bg-orange-100 rounded-[32px] border-2 border-orange-100 transition-all active:scale-95 flex flex-col items-center gap-4"
          >
            <div className="w-16 h-16 bg-brand-secondary rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
              <ArrowLeftCircle size={32} />
            </div>
            <span className="text-lg font-bold text-orange-700">ลงเวลาออกงาน</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 flex items-center gap-3">
            <Clock className="text-slate-400" />
            ประวัติการลงเวลาล่าสุด
          </h3>
          {loading && <Loader2 className="animate-spin text-brand-primary" size={20} />}
        </div>
        <div className="divide-y divide-slate-50">
          {logs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 italic">ไม่พบประวัติการลงเวลา</div>
          ) : (
            logs.map(log => (
              <div key={log.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${log.log_type === 'in' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                    {log.log_type === 'in' ? <ArrowRightCircle size={20} /> : <ArrowLeftCircle size={20} />}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{log.log_type === 'in' ? 'เข้างาน' : 'ออกงาน'}</p>
                    <p className="text-xs text-slate-400 font-medium">{new Date(log.timestamp).toLocaleString('th-TH')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <MapPin size={16} />
                  <span className="text-xs font-bold">{log.location}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
