import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { sendLineNotification } from '../lib/lineNotify';
import { uploadFileToDrive } from '../lib/storage';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import { 
  ClipboardList, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Send, 
  MessageSquare,
  User,
  FileText,
  Loader2,
  ChevronRight,
  Search,
  Paperclip,
  Upload,
  X,
  Trash2
} from 'lucide-react';

type TaskStatus = 'all' | 'pending' | 'acknowledged' | 'completed' | 'closed';

export default function TaskManagement() {
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<TaskStatus>('pending');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportFiles, setReportFiles] = useState<File[]>([]);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('doc_assignments')
        .select(`
          *,
          incoming_docs (subject, doc_number, file_url, attachment_urls),
          teachers (first_name, last_name, prefix, email, line_user_id)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (err: any) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(taskId: string, status: string, lineMsg?: string, lineUserId?: string) {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('doc_assignments')
        .update({ status })
        .eq('id', taskId);

      if (error) throw error;

      if (lineMsg) {
        await sendLineNotification(lineMsg, lineUserId);
      }
      
      await fetchTasks();
    } catch (err: any) {
      alert('ปรับปรุงสถานะไม่สำเร็จ: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReport() {
    if (!reportText) {
      alert('กรุณากรอกรายละเอียดผลการปฏิบัติงาน');
      return;
    }
    setIsSaving(true);
    try {
      const attachment_urls: string[] = [];
      const sanitizedSubject = (selectedTask.incoming_docs?.subject || 'งานมอบหมาย').replace(/[\/\\?%*:|"<>]/g, '-').slice(0, 30);
      
      for (let i = 0; i < reportFiles.length; i++) {
        const fileName = `รายงาน_${sanitizedSubject}_ไฟล์_${i+1}_โดย_${selectedTask.teachers?.first_name}`;
        const url = await uploadFileToDrive(reportFiles[i], 'reports', fileName);
        attachment_urls.push(url);
      }

      const { error } = await supabase
        .from('doc_assignments')
        .update({ 
          status: 'completed', 
          staff_report: reportText,
          report_file_urls: attachment_urls,
          reported_at: new Date().toISOString()
        })
        .eq('id', selectedTask.id);

      if (error) throw error;

      const msg = `\n✅ รายงานผลงานเสร็จสิ้น\nเรื่อง: ${selectedTask.incoming_docs?.subject}\nผู้ปฏิบัติ: ${selectedTask.teachers?.prefix}${selectedTask.teachers?.first_name} ${selectedTask.teachers?.last_name}\nผลการปฏิบัติ: ${reportText}\n${attachment_urls.length > 0 ? `📁 มีไฟล์หลักฐาน ${attachment_urls.length} ไฟล์` : ''}\n\nรอ ผอ. ตรวจสอบและปิดงาน`;
      
      await sendLineNotification(msg);
      
      setIsReportModalOpen(false);
      setReportText('');
      setReportFiles([]);
      await fetchTasks();
      alert('ส่งรายงานผลและแจ้งเตือนเรียบร้อยแล้ว');
    } catch (err: any) {
      alert('ส่งรายงานไม่สำเร็จ: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCloseTask() {
    setIsSaving(true);
    const { error } = await supabase
      .from('doc_assignments')
      .update({ 
        status: 'closed', 
        director_feedback: feedbackText,
        closed_at: new Date().toISOString()
      })
      .eq('id', selectedTask.id);

    if (!error) {
      const msg = `\n🏁 ผอ. ตรวจรับงานแล้ว\nเรื่อง: ${selectedTask.incoming_docs.subject}\nความเห็น ผอ.: ${feedbackText || 'รับทราบผลการปฏิบัติงาน'}\n\nขอบคุณสำหรับการปฏิบัติหน้าที่ครับ`;
      
      // 1. ส่งแจ้งเตือนเข้ากลุ่มไลน์หลักของโรงเรียน
      await sendLineNotification(msg);
      
      // 2. ส่งแจ้งเตือนหาคุณครูผู้ปฏิบัติโดยตรง (หากมี Line User ID)
      if (selectedTask.teachers?.line_user_id) {
        await sendLineNotification(msg, selectedTask.teachers.line_user_id);
      }
      
      setIsFeedbackModalOpen(false);
      setFeedbackText('');
      fetchTasks();
    }
    setIsSaving(false);
  }

  async function handleReopenTask(task: any) {
    if (!confirm('คุณต้องการดึงงานนี้กลับมาเพื่อตรวจสอบหรือแก้ไขใหม่ใช่หรือไม่?')) return;
    setIsSaving(true);
    const { error } = await supabase
      .from('doc_assignments')
      .update({ 
        status: 'completed', 
        closed_at: null 
      })
      .eq('id', task.id);

    if (!error) {
      alert('ดึงงานกลับเรียบร้อยแล้ว');
      fetchTasks();
    } else {
      alert('ไม่สามารถดึงงานกลับได้: ' + error.message);
    }
    setIsSaving(false);
  }

  async function handleDeleteTask(taskId: string) {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบงานที่มอบหมายนี้? การลบจะไม่สามารถเรียกคืนได้')) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('doc_assignments')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      alert('ลบงานเรียบร้อยแล้ว');
      fetchTasks();
    } catch (err: any) {
      alert('ลบงานไม่สำเร็จ: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase flex items-center gap-1"><Clock size={12} /> รอรับทราบ</span>;
      case 'acknowledged': return <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase flex items-center gap-1"><ChevronRight size={12} /> กำลังดำเนินการ</span>;
      case 'completed': return <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-black uppercase flex items-center gap-1"><CheckCircle2 size={12} /> รายงานผลแล้ว</span>;
      case 'closed': return <span className="px-3 py-1 bg-slate-100 text-slate-400 rounded-full text-[10px] font-black uppercase flex items-center gap-1"><CheckCircle2 size={12} /> จบงาน</span>;
      default: return null;
    }
  };

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = (t.incoming_docs?.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${t.teachers?.first_name} ${t.teachers?.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const isAdmin = profile?.role === 'admin';
    const isDirector = profile?.role === 'director' || isAdmin;
    const userEmail = user?.email?.toLowerCase();
    const teacherEmail = t.teachers?.email?.toLowerCase();
    const isAssignedToMe = userEmail && teacherEmail && userEmail === teacherEmail;

    // Filter by Role: Teachers only see their own tasks
    if (!isDirector && !isAssignedToMe) return false;
    
    if (activeTab === 'all') return matchesSearch;
    return matchesSearch && t.status === activeTab;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <ClipboardList size={32} className="text-brand-primary" />
            ระบบติดตามงานและสั่งการ
          </h2>
          <p className="text-slate-400 font-bold mt-1 uppercase tracking-widest text-xs">Task Assignment & Tracking System</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 p-1 bg-slate-100 rounded-[24px] w-fit">
        <TabButton label="รอรับทราบ" active={activeTab === 'pending'} onClick={() => setActiveTab('pending')} count={tasks.filter(t => t.status === 'pending').length} />
        <TabButton label="กำลังดำเนินการ" active={activeTab === 'acknowledged'} onClick={() => setActiveTab('acknowledged')} count={tasks.filter(t => t.status === 'acknowledged').length} />
        <TabButton label="รายงานผลแล้ว" active={activeTab === 'completed'} onClick={() => setActiveTab('completed')} count={tasks.filter(t => t.status === 'completed').length} />
        <TabButton label="จบงาน" active={activeTab === 'closed'} onClick={() => setActiveTab('closed')} count={tasks.filter(t => t.status === 'closed').length} />
        <TabButton label="ทั้งหมด" active={activeTab === 'all'} onClick={() => setActiveTab('all')} count={tasks.length} />
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
          <input 
            type="text" 
            placeholder="ค้นหาตามชื่อเรื่อง หรือผู้รับมอบหมาย..." 
            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => fetchTasks()} 
          className="px-6 py-4 bg-white text-slate-500 font-bold rounded-2xl hover:bg-slate-50 transition-all border border-slate-100 flex items-center gap-2"
        >
          <Loader2 size={18} className={loading ? 'animate-spin' : ''} /> รีเฟรช
        </button>
      </div>

      {/* Task List */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[40px] border border-slate-100 shadow-sm">
            <Loader2 className="animate-spin text-brand-primary mb-4" size={40} />
            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">กำลังดึงข้อมูลงาน...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[40px] border border-slate-100 shadow-sm">
            <AlertCircle className="text-slate-200 mb-4" size={48} />
            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">ไม่มีรายการงานในหมวดหมู่นี้</p>
          </div>
        ) : (
          filteredTasks.map((task, index) => {
            const isAdmin = profile?.role === 'admin';
            const isDirector = profile?.role === 'director' || isAdmin;
            const isAssignedTeacher = user?.email === task.teachers?.email;
            const canAction = isDirector || isAssignedTeacher;

            return (
              <div key={task.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                           <span className="w-8 h-8 bg-slate-800 text-white rounded-lg flex items-center justify-center font-black text-sm">{index + 1}</span>
                           <span className="text-slate-300 font-black">|</span>
                           <span className="text-slate-400 font-black text-xs uppercase tracking-widest">{new Date(task.created_at).toLocaleDateString('th-TH')}</span>
                           {getStatusBadge(task.status)}
                           {task.status === 'pending' && (
                             <span className="flex items-center gap-1 text-[9px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-sm animate-pulse border border-red-100">
                               <AlertCircle size={10} />
                               ยังไม่รับทราบงาน
                             </span>
                           )}
                        </div>
                        <h4 className="text-lg font-black text-slate-800 leading-tight pt-2">{task.incoming_docs?.subject}</h4>
                        <div className="flex items-center gap-3 mt-1">
                           <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                              <FileText size={12} /> {task.incoming_docs?.doc_number} | <User size={12} /> {task.teachers?.prefix}{task.teachers?.first_name} {task.teachers?.last_name}
                           </div>
                           {task.incoming_docs?.file_url && (
                             <a 
                               href={task.incoming_docs.file_url} 
                               target="_blank" 
                               className="flex items-center gap-1.5 text-[10px] font-black text-brand-primary bg-green-50 px-2 py-1 rounded-lg border border-brand-primary/10 hover:bg-brand-primary hover:text-white transition-all shadow-xs"
                             >
                               <FileText size={12} /> ดูเอกสารสั่งการ
                             </a>
                           )}
                           {/* Show Attachments */}
                           {Array.isArray(task.incoming_docs?.attachment_urls) && task.incoming_docs.attachment_urls.map((url: string, i: number) => (
                             <a 
                               key={i}
                               href={url} 
                               target="_blank" 
                               className="flex items-center gap-1.5 text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 hover:bg-blue-500 hover:text-white transition-all shadow-xs"
                               title={`ไฟล์แนบ ${i+1}`}
                             >
                               <Paperclip size={10} /> ไฟล์แนบ {i + 1}
                             </a>
                           ))}
                        </div>
                      </div>

                      {isAdmin && (
                        <button 
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          title="ลบงานที่มอบหมาย"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-brand-primary uppercase tracking-widest mb-1 flex items-center gap-2">
                         <MessageSquare size={12} /> คำสั่งการ
                      </p>
                      <p className="text-sm font-bold text-slate-600 italic">"{task.instruction || 'โปรดดำเนินการตามที่มอบหมาย'}"</p>
                    </div>
                  </div>

                  <div className="md:w-64 flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-50 pt-4 md:pt-0 md:pl-6">
                     {!canAction ? (
                       <div className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-100 opacity-60">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">สิทธิ์การเข้าถึง</p>
                          <p className="text-[10px] font-bold text-slate-500 italic">เฉพาะผู้ได้รับมอบหมาย</p>
                       </div>
                     ) : (
                       <div className="space-y-3">
                         {task.status === 'pending' && (
                           <button 
                            onClick={() => {
                              const msg = `\n📥 รับทราบการมอบหมายงาน\nเรื่อง: ${task.incoming_docs.subject}\nผู้ปฏิบัติ: ${task.teachers.prefix}${task.teachers.first_name}\n\nขณะนี้กำลังเริ่มดำเนินการครับ`;
                              updateStatus(task.id, 'acknowledged', msg); // ไม่ส่ง lineUserId เพื่อให้ส่งเข้ากลุ่มไลน์หลัก (แจ้ง ผอ. และครูท่านอื่น)
                            }}
                            className="w-full py-4 bg-brand-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-green-100 hover:bg-green-700 transition-all active:scale-95"
                           >
                             รับทราบงาน
                           </button>
                         )}
                         
                         {task.status === 'acknowledged' && (
                           <button 
                            onClick={() => { setSelectedTask(task); setIsReportModalOpen(true); }}
                            className="w-full py-4 bg-blue-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
                           >
                             <Send size={16} /> รายงานผลงาน
                           </button>
                         )}

                         {task.status === 'completed' && (
                           <button 
                            onClick={() => { setSelectedTask(task); setIsFeedbackModalOpen(true); }}
                            className={`w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-slate-200 hover:bg-slate-900 transition-all flex items-center justify-center gap-2 ${!isDirector ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={!isDirector}
                           >
                             <CheckCircle2 size={16} /> {isDirector ? 'ผอ. ตรวจรับงาน' : 'รอ ผอ. ตรวจรับ'}
                           </button>
                         )}

                         {task.status === 'closed' && (
                           <div className="space-y-2">
                             <div className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">เสร็จสมบูรณ์เมื่อ</p>
                                <p className="text-xs font-bold text-slate-500">{new Date(task.closed_at).toLocaleDateString('th-TH')}</p>
                             </div>
                             {isDirector && (
                               <button 
                                onClick={() => handleReopenTask(task)}
                                className="w-full py-2 bg-white text-red-500 border border-red-100 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-50 transition-all"
                               >
                                 ดึงงานกลับ
                               </button>
                             )}
                           </div>
                         )}
                       </div>
                     )}
                  </div>
                </div>

                {/* Progress Detail */}
                {(task.staff_report || task.director_feedback) && (
                  <div className="mt-6 pt-6 border-t border-slate-50 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {task.staff_report && (
                      <div className="bg-green-50/50 p-4 rounded-2xl border border-green-100/50">
                        <div className="flex flex-col mb-2">
                           <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-2">ผลการปฏิบัติงาน</p>
                           {Array.isArray(task.report_file_urls) && task.report_file_urls.length > 0 && (
                             <div className="flex flex-wrap gap-2 mb-2">
                               {task.report_file_urls.map((url: string, i: number) => (
                                 <a 
                                   key={i}
                                   href={url} 
                                   target="_blank" 
                                   className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 bg-white border border-blue-100 px-2 py-1 rounded-lg hover:bg-blue-50 transition-all"
                                 >
                                   <Paperclip size={10} /> หลักฐาน {i + 1}
                                 </a>
                               ))}
                             </div>
                           )}
                        </div>
                        <p className="text-xs font-bold text-slate-600">{task.staff_report}</p>
                        <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase">รายงานเมื่อ: {task.reported_at ? new Date(task.reported_at).toLocaleString('th-TH') : '-'}</p>
                      </div>
                    )}
                    {task.director_feedback && (
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ความเห็น ผอ.</p>
                        <p className="text-xs font-bold text-slate-600">{task.director_feedback}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Report Modal */}
      <Modal 
        isOpen={isReportModalOpen} 
        onClose={() => { setIsReportModalOpen(false); setReportFiles([]); setReportText(''); }} 
        title="รายงานผลการปฏิบัติงาน"
      >
        <div className="space-y-6">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
             <h5 className="text-sm font-black text-slate-800 mb-1">{selectedTask?.incoming_docs?.subject}</h5>
             <p className="text-xs font-bold text-slate-400 italic">คำสั่ง: {selectedTask?.instruction}</p>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">รายละเอียดผลการปฏิบัติงาน</label>
            <textarea 
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-green-500/10 focus:border-green-500 transition-all"
              rows={5}
              placeholder="พิมพ์รายงานสิ่งที่ได้ดำเนินการที่นี่..."
              value={reportText}
              onChange={e => setReportText(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 flex justify-between">
              <span>แนบไฟล์หลักฐาน / เอกสารประกอบ (สูงสุด 4 ไฟล์)</span>
              <span className="text-brand-primary">{reportFiles.length}/4</span>
            </label>
            <div className="grid grid-cols-1 gap-3">
              {reportFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-green-50 border border-green-100 rounded-xl animate-in slide-in-from-left-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Paperclip size={14} className="text-green-600 shrink-0" />
                    <span className="text-xs font-bold text-green-700 truncate">{file.name}</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setReportFiles(reportFiles.filter((_, i) => i !== idx))}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-white rounded-lg transition-all"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              
              {reportFiles.length < 4 && (
                <label className="block w-full p-4 border-2 border-dashed border-slate-200 rounded-2xl text-center cursor-pointer hover:border-brand-primary hover:bg-slate-50 transition-all group">
                  <input 
                    type="file" 
                    className="hidden" 
                    multiple 
                    onChange={e => {
                      const selected = Array.from(e.target.files || []);
                      if (reportFiles.length + selected.length > 4) {
                        alert('จำกัดไฟล์แนบสูงสุด 4 ไฟล์');
                        return;
                      }
                      setReportFiles([...reportFiles, ...selected]);
                    }} 
                  />
                  <div className="flex items-center justify-center gap-2">
                    <Upload size={18} className="text-slate-300 group-hover:text-brand-primary" />
                    <span className="text-slate-400 text-[10px] font-bold uppercase">คลิกเพื่อเพิ่มไฟล์หลักฐาน</span>
                  </div>
                </label>
              )}
            </div>
          </div>

          <button 
            onClick={handleReport}
            disabled={isSaving || !reportText}
            className="w-full py-4.5 bg-green-500 text-white rounded-[24px] font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-green-100 hover:bg-green-600 transition-all active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="animate-spin" /> : <Send />} ส่งรายงานผลพร้อมหลักฐาน
          </button>
        </div>
      </Modal>

      {/* Feedback Modal (Director Close Task) */}
      <Modal 
        isOpen={isFeedbackModalOpen} 
        onClose={() => { setIsFeedbackModalOpen(false); setFeedbackText(''); }} 
        title="ตรวจรับงานและปิดงาน"
      >
        <div className="space-y-4">
          <div className="p-4 bg-green-50 rounded-2xl border border-green-100">
             <div className="flex flex-col mb-2">
                <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-2">รายงานจากผู้ปฏิบัติ</p>
                {Array.isArray(selectedTask?.report_file_urls) && selectedTask.report_file_urls.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedTask.report_file_urls.map((url: string, i: number) => (
                      <a 
                       key={i}
                       href={url} 
                       target="_blank" 
                       className="flex items-center gap-2 text-[10px] font-black text-white bg-green-600 px-3 py-1.5 rounded-lg hover:bg-green-700 transition-all shadow-sm shadow-green-100"
                      >
                        <Paperclip size={12} /> ดูหลักฐาน {i + 1}
                      </a>
                    ))}
                  </div>
                )}
             </div>
             <p className="text-sm font-bold text-slate-700">{selectedTask?.staff_report}</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ความเห็นเพิ่มเติมจาก ผอ. (ถ้ามี)</label>
            <textarea 
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all"
              rows={3}
              placeholder="เช่น รับทราบ, ดำเนินการได้ดีมาก..."
              value={feedbackText}
              onChange={e => setFeedbackText(e.target.value)}
            />
          </div>
          <button 
            onClick={handleCloseTask}
            disabled={isSaving}
            className="w-full py-4 bg-slate-800 text-white rounded-[24px] font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-slate-200 hover:bg-slate-900 transition-all"
          >
            {isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} ตรวจรับและปิดงาน
          </button>
        </div>
      </Modal>
    </div>
  );
}

function TabButton({ label, active, onClick, count }: any) {
  return (
    <button 
      onClick={onClick}
      className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 ${active ? 'bg-white text-brand-primary shadow-sm scale-[1.02]' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}
    >
      {label}
      {count > 0 && <span className={`px-2 py-0.5 rounded-full text-[10px] ${active ? 'bg-brand-primary text-white' : 'bg-slate-200 text-slate-500'}`}>{count}</span>}
    </button>
  );
}
