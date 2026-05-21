import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { uploadFileToDrive, deleteFileFromDrive, uploadToSupabase, deleteFromSupabase } from '../lib/storage';
import { useAuth } from '../contexts/AuthContext';
import { sendLineNotification } from '../lib/lineNotify';
import { applyDigitalStamps } from '../lib/pdfService';
import { summarizeDocument } from '../lib/aiService';
import Modal from '../components/Modal';
import { 
  FilePlus, 
  Search, 
  FileText, 
  Loader2,
  Upload,
  Save,
  Paperclip,
  X,
  Trash2,
  UserCheck,
  Send,
  Sparkles,
  Shield
} from 'lucide-react';

export default function IncomingDocs() {
  const { user, profile } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestNumber, setLatestNumber] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  // Assignment Form State
  const [assignForm, setAssignForm] = useState({
    teacher_id: '',
    instruction: '',
    stamp_page: 1
  });

  const [formData, setFormData] = useState({
    doc_number: '',
    from_agency: '',
    subject: '',
    doc_date: new Date().toISOString().split('T')[0],
    sender_doc_number: '',
    sender_doc_date: '',
    urgency: 'ปกติ',
    remark: '',
    stamp_page: 1
  });

  const [proposalData, setProposalData] = useState({
    summary: '',
    proposal: 'เพื่อโปรดพิจารณา'
  });

  const [mainFile, setMainFile] = useState<File | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);

  useEffect(() => { 
    fetchDocs(); 
    fetchTeachers();
  }, []);

  async function fetchDocs() {
    setLoading(true);
    try {
      const { data } = await supabase.from('incoming_docs').select('*').order('created_at', { ascending: false });
      setDocs(data || []);
      if (data && data.length > 0) {
        setLatestNumber(data[0].doc_number);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTeachers() {
    const { data } = await supabase.from('teachers').select('*').order('first_name');
    setTeachers(data || []);
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!assignForm.teacher_id || !selectedDoc) return;
    setIsSaving(true);

    try {
      console.log('--- START FINAL RETIREMENT PROCESS ---');
      
      // 1. Re-stamp PDF with Director's Order
      if (assignForm.instruction && selectedDoc.file_url) {
        try {
          console.log('Fetching PDF for final stamping:', selectedDoc.file_url);
          
          const response = await fetch(selectedDoc.file_url);
          if (!response.ok) throw new Error(`ไม่สามารถดาวน์โหลดไฟล์ได้ (Status: ${response.status})`);
          
          const pdfBuffer = await response.arrayBuffer();
          const { data: setts } = await supabase.from('settings').select('director_name, director_signature_url').single();

          console.log('Applying Director Stamp...');
          const stampedBytes = await applyDigitalStamps(
            pdfBuffer,
            undefined, // Do NOT re-stamp receipt info
            undefined, // Do NOT re-stamp proposal info
            {
              order: assignForm.instruction,
              signer: setts?.director_name || 'ผู้อำนวยการโรงเรียน',
              position: 'ผู้อำนวยการโรงเรียนบ้านควนโคกยา',
              date: new Date().toISOString().split('T')[0],
              signatureUrl: setts?.director_signature_url,
              pageNumber: assignForm.stamp_page // User selected page
            }
          );

          const sanitizedSubject = selectedDoc.subject.replace(/[\/\\?%*:|"<>]/g, '-').slice(0, 50);
          const finalFileName = `${selectedDoc.doc_number}_เรื่อง_${sanitizedSubject}.pdf`;
          const finalFile = new File([stampedBytes as any], finalFileName, { type: 'application/pdf' });
          
          console.log('Uploading FINAL document to Google Drive...');
          const gDriveUrl = await uploadFileToDrive(finalFile, 'incoming', finalFileName.replace('.pdf', ''));
          
          console.log('Updating database with final Google Drive link and status...');
          await supabase.from('incoming_docs').update({ 
            file_url: gDriveUrl,
            status: 'assigned' 
          }).eq('id', selectedDoc.id);
          
          // If it was on Supabase, try to clean up
          if (selectedDoc.file_url.includes('supabase.co')) {
            try {
              const tempPath = selectedDoc.file_url.split('/').pop()?.split('?')[0];
              if (tempPath) await deleteFromSupabase('temp_docs', tempPath);
            } catch (de) { console.warn('Supabase cleanup failed:', de); }
          }
          
          selectedDoc.file_url = gDriveUrl;
          console.log('FINAL ARCHIVING SUCCESS');
        } catch (pdfErr: any) {
          console.error('FINAL STAMP FAILED:', pdfErr);
          await supabase.from('incoming_docs').update({ status: 'assigned' }).eq('id', selectedDoc.id);
          alert('แจ้งเตือน: ไม่สามารถประทับตรา ผอ. ได้ (สาเหตุ: ' + pdfErr.message + ') ระบบจะบันทึกเฉพาะข้อมูลการมอบหมาย');
        }
      } else {
        await supabase.from('incoming_docs').update({ status: 'assigned' }).eq('id', selectedDoc.id);
      }

      // 2. Insert Assignment
      const { error } = await supabase.from('doc_assignments').insert([{
        doc_id: selectedDoc.id,
        assignee_id: assignForm.teacher_id,
        instruction: assignForm.instruction,
        status: 'pending'
      }]);

      if (error) throw error;

      // Notify Teacher via LINE
      const teacher = teachers.find(t => t.id === assignForm.teacher_id);
      if (teacher?.line_user_id) {
        const msg = `คุณครูมีงานมอบหมายใหม่\nเรื่อง: ${selectedDoc.subject}\nเลขที่: ${selectedDoc.doc_number}\n\nคำสั่งการ: ${assignForm.instruction || 'โปรดดำเนินการตามหนังสือฉบับนี้'}`;
        const lineAttachments = [{ label: '📄 ดูเอกสารสั่งการ', url: selectedDoc.file_url }];
        if (Array.isArray(selectedDoc.attachment_urls)) {
          selectedDoc.attachment_urls.forEach((url: string, i: number) => {
            lineAttachments.push({ label: `📎 ไฟล์แนบ ${i + 1}`, url: url });
          });
        }
        await sendLineNotification(msg, teacher.line_user_id, lineAttachments);
      }

      alert('เกษียณหนังสือและมอบหมายงานเรียบร้อยแล้ว');
      setIsAssignModalOpen(false);
      resetForm();
      fetchDocs();
    } catch (err: any) {
      alert('ดำเนินการไม่สำเร็จ: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลนี้?')) return;
    try {
      const { data: doc } = await supabase.from('incoming_docs').select('file_url, attachment_urls').eq('id', id).single();
      if (doc) {
        if (doc.file_url.includes('drive.google.com')) await deleteFileFromDrive(doc.file_url);
        else if (doc.file_url.includes('supabase.co')) {
           const path = doc.file_url.split('/').pop()?.split('?')[0];
           if (path) await deleteFromSupabase('temp_docs', path);
        }
        if (Array.isArray(doc.attachment_urls)) {
          for (const url of doc.attachment_urls) await deleteFileFromDrive(url);
        }
      }
      const { error } = await supabase.from('incoming_docs').delete().eq('id', id);
      if (error) throw error;
      fetchDocs();
    } catch (err: any) {
      alert('ลบไม่สำเร็จ: ' + err.message);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const sanitized = formData.subject.replace(/[\/\\?%*:|"<>]/g, '-').slice(0, 50);
      const prefix = `${formData.doc_number}_เรื่อง_${sanitized}`;
      let file_url = '';

      if (mainFile) {
        let fileToStaging = mainFile;
        
        if (mainFile.type === 'application/pdf') {
          try {
            const buf = await mainFile.arrayBuffer();
            const timeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            const stamped = await applyDigitalStamps(
              buf,
              { 
                docNumber: formData.doc_number, 
                date: formData.doc_date, 
                time: timeStr,
                pageNumber: formData.stamp_page 
              },
              { 
                summary: proposalData.summary || 'โปรดดูรายละเอียดตามหนังสือ', 
                proposal: proposalData.proposal, 
                signer: profile?.display_name || 'เจ้าหน้าที่ธุรการ', 
                date: formData.doc_date,
                signatureUrl: profile?.signature_url 
              }
            );
            fileToStaging = new File([stamped as any], mainFile.name, { type: 'application/pdf' });
          } catch (se) { console.error('Initial stamping failed:', se); }
        }

        console.log('Uploading to Supabase Staging...');
        // ตั้งชื่อไฟล์เป็นภาษาอังกฤษเพื่อป้องกันปัญหา Invalid Key จากชื่อไฟล์ภาษาไทยใน Supabase
        const fileExt = mainFile.name.split('.').pop() || 'pdf';
        const tempPath = `temp_${Date.now()}.${fileExt}`;
        file_url = await uploadToSupabase(fileToStaging, 'temp_docs', tempPath);
      }

      const att_urls = [];
      for (let i = 0; i < attachments.length; i++) {
        const url = await uploadFileToDrive(attachments[i], 'incoming', `แนบ_${prefix}_${i + 1}`);
        att_urls.push(url);
      }

      const extraData = {
        sender_doc_number: formData.sender_doc_number,
        sender_doc_date: formData.sender_doc_date,
        proposal_summary: proposalData.summary,
        proposal_text: proposalData.proposal
      };

      const { error } = await supabase.from('incoming_docs').insert([{
        doc_number: formData.doc_number,
        from_agency: formData.from_agency,
        subject: formData.subject,
        doc_date: formData.doc_date,
        urgency: formData.urgency,
        remark: JSON.stringify(extraData),
        file_url,
        attachment_urls: att_urls,
        status: 'pending',
        created_by: user?.id
      }]);

      if (error) throw error;

      const regMsg = `ลงรับหนังสือใหม่ (รอเกษียณ)\nเรื่อง: ${formData.subject}\nจาก: ${formData.from_agency}\nเลขที่: ${formData.doc_number}`;
      const regAttachments = [{ label: '📄 ดูต้นฉบับหนังสือ', url: file_url }];
      await sendLineNotification(regMsg, undefined, regAttachments);
      
      setIsModalOpen(false);
      resetForm();
      fetchDocs();
      alert('ลงรับหนังสือเรียบร้อยแล้ว');
    } catch (err: any) {
      alert(`บันทึกไม่สำเร็จ: ${err.message}`);
    } finally { setIsSaving(false); }
  }

  function resetForm() {
    setFormData({ 
      doc_number: '', 
      from_agency: '', 
      subject: '', 
      doc_date: new Date().toISOString().split('T')[0], 
      sender_doc_number: '',
      sender_doc_date: '',
      urgency: 'ปกติ', 
      remark: '',
      stamp_page: 1
    });
    setProposalData({ summary: '', proposal: 'เพื่อโปรดพิจารณา' });
    setMainFile(null);
    setAttachments([]);
    setAssignForm({ teacher_id: '', instruction: '', stamp_page: 1 });
  }

  const handleAddAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (attachments.length + files.length > 4) { alert('จำกัดไฟล์แนบสูงสุด 4 ไฟล์'); return; }
    setAttachments([...attachments, ...files]);
  };

  const isDirector = profile?.role === 'director' || profile?.role === 'admin';
  const isAdmin = profile?.role === 'admin';
  const extraPerms = profile?.extra_permissions || {};
  const hasAccess = isDirector || extraPerms.access_administrative;

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[40px] border border-slate-100 shadow-sm">
        <Shield size={64} className="text-red-200 mb-4" />
        <h3 className="text-xl font-black text-slate-800">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</h3>
        <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mt-1">กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์เข้าใช้งานโมดูลนี้</p>
      </div>
    );
  }

  async function handleAISummary() {
    if (!mainFile) { alert('กรุณาเลือกไฟล์หนังสือนำก่อน'); return; }
    setIsSaving(true);
    try {
      const { data: sets } = await supabase.from('settings').select('gemini_api_key').single();
      const apiKey = sets?.gemini_api_key;
      if (!apiKey) throw new Error('ยังไม่ได้ระบุ Gemini API Key');
      const buffer = await mainFile.arrayBuffer();
      const info = await summarizeDocument(buffer, apiKey);
      setProposalData(prev => ({ ...prev, summary: info.summary }));
      setFormData(prev => ({
        ...prev,
        sender_doc_number: info.doc_number || prev.sender_doc_number,
        sender_doc_date: info.doc_date || prev.sender_doc_date,
        from_agency: info.from_agency || prev.from_agency,
        subject: info.subject || prev.subject
      }));
    } catch (err: any) { alert('AI ทำงานไม่สำเร็จ: ' + err.message); }
    finally { setIsSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div className="relative flex-1 max-w-md flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
            <input type="text" placeholder="ค้นหาหนังสือรับ..." className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-hidden shadow-xs" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          {latestNumber && (
            <div className="shrink-0 px-3 py-1.5 bg-brand-primary/10 border border-brand-primary/20 rounded-xl flex items-center gap-1.5 whitespace-nowrap shadow-xs">
              <span className="text-[10px] font-black text-brand-primary uppercase tracking-tighter">ล่าสุด:</span>
              <span className="text-xs font-black text-brand-primary tracking-tight">{latestNumber}</span>
            </div>
          )}
        </div>
        {isDirector && (
          <button onClick={() => setIsModalOpen(true)} className="bg-brand-primary text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-all">
            <FilePlus size={20} /> ลงรับหนังสือใหม่
          </button>
        )}
      </div>

      <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">เลขที่รับ / วันที่</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">เรื่อง</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">เอกสาร</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={4} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-brand-primary" /></td></tr>
            ) : docs.length === 0 ? (
              <tr><td colSpan={4} className="py-20 text-center text-slate-400 italic">ไม่พบข้อมูลหนังสือรับ</td></tr>
            ) : (
              docs.filter(d => d.subject?.includes(searchTerm)).map(doc => (
                <tr key={doc.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800 text-sm">{doc.doc_number}</div>
                    <div className="text-[10px] text-slate-400">{doc.doc_date}</div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-slate-700">{doc.subject}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">{doc.from_agency}</p>
                      {doc.status === 'pending' && (
                        <span className="flex items-center gap-1 text-[9px] font-medium text-red-500 bg-red-50/50 px-1.5 py-0.5 rounded-sm">
                          <div className="w-1 h-1 bg-red-400 rounded-full"></div>
                          รอ ผอ. เกษียณ
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center gap-1.5">
                      {doc.file_url && (
                        <a href={doc.file_url} target="_blank" className="w-8 h-8 rounded-lg bg-green-50 text-brand-primary flex items-center justify-center hover:bg-green-100 transition-colors">
                          <FileText size={16} />
                        </a>
                      )}
                      {Array.isArray(doc.attachment_urls) && doc.attachment_urls.map((url: string, idx: number) => (
                        <a key={idx} href={url} target="_blank" className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center hover:bg-blue-100 transition-colors">
                          <Paperclip size={14} />
                        </a>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isDirector && (
                        <button onClick={() => { setSelectedDoc(doc); setIsAssignModalOpen(true); }} className="p-2 text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors flex items-center gap-1.5 font-bold text-xs" title="เกษียณสั่งการ/มอบหมาย">
                          <UserCheck size={18} /> เกษียณ
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => handleDelete(doc.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="ลบข้อมูล">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="ลงรับหนังสือใหม่">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5 col-span-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">เลขที่รับ</label>
              <input type="text" className="w-full p-3 bg-slate-50 border rounded-xl font-bold" required value={formData.doc_number} onChange={e => setFormData({...formData, doc_number: e.target.value})} />
            </div>
            <div className="space-y-1.5 col-span-1">
              <label className="text-[10px] font-black text-brand-primary uppercase ml-1">เกษียณเสนอที่หน้า</label>
              <input type="number" min="1" className="w-full p-3 bg-white border-2 border-brand-primary/20 rounded-xl font-black text-brand-primary text-center" required value={formData.stamp_page} onChange={e => setFormData({...formData, stamp_page: parseInt(e.target.value) || 1})} />
              <p className="text-[8px] text-slate-400 font-bold text-center mt-0.5">*เลขรับอยู่หน้า ๑ เสมอ</p>
            </div>
            <div className="space-y-1.5 col-span-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">วันที่ลงรับ</label>
              <input type="date" className="w-full p-3 bg-slate-50 border rounded-xl font-bold" required value={formData.doc_date} onChange={e => setFormData({...formData, doc_date: e.target.value})} />
            </div>
          </div>

          <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 space-y-4">
            <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest">ข้อมูลในหนังสือ (จากต้นฉบับ)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">เลขที่หนังสือ</label>
                <input type="text" className="w-full p-3 bg-white border rounded-xl font-medium" placeholder="เช่น ศธ 04225/..." value={formData.sender_doc_number} onChange={e => setFormData({...formData, sender_doc_number: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">วันที่ในหนังสือ</label>
                <input type="date" className="w-full p-3 bg-white border rounded-xl font-medium" value={formData.sender_doc_date} onChange={e => setFormData({...formData, sender_doc_date: e.target.value})} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">จากหน่วยงาน</label>
              <input type="text" className="w-full p-3 bg-white border rounded-xl font-medium" required value={formData.from_agency} onChange={e => setFormData({...formData, from_agency: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">เรื่อง</label>
              <textarea className="w-full p-3 bg-white border rounded-xl font-medium" rows={2} required value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} />
            </div>
          </div>

          <div className="p-4 bg-brand-primary/5 rounded-2xl border border-brand-primary/10 space-y-4">
             <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-black text-brand-primary uppercase tracking-widest">สรุปสาระสำคัญ</h4>
                <button type="button" onClick={handleAISummary} className="flex items-center gap-1.5 text-[10px] font-bold text-brand-primary bg-white px-2 py-1 rounded-lg border border-brand-primary/20 hover:bg-brand-primary hover:text-white transition-all shadow-xs">
                  <Sparkles size={12} /> สแกนข้อมูลและสรุปด้วย AI
                </button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">สรุปสาระสำคัญ (เกษียณเสนอ)</label>
                  <textarea className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium" rows={2} placeholder="สรุปโดยเจ้าหน้าที่..." value={proposalData.summary} onChange={e => setProposalData({...proposalData, summary: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ข้อความเสนอ</label>
                  <input type="text" className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold" value={proposalData.proposal} onChange={e => setProposalData({...proposalData, proposal: e.target.value})} />
                </div>
             </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Upload size={14} /> อัปโหลดเอกสาร (พักไฟล์ชั่วคราว)</p>
             <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600">1. หนังสือนำ / หนังสือสั่งการ</label>
                <label className={`block w-full p-4 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${mainFile ? 'border-brand-primary bg-green-50' : 'border-slate-200 hover:border-brand-primary hover:bg-slate-50'}`}>
                   <input type="file" className="hidden" onChange={e => setMainFile(e.target.files?.[0] || null)} />
                   {mainFile ? <div className="flex items-center justify-center gap-2 text-brand-primary font-bold text-sm"><FileText size={18} /> {mainFile.name}</div> : <span className="text-slate-400 text-xs font-bold uppercase">เลือกไฟล์หนังสือนำ (PDF เท่านั้น)</span>}
                </label>
             </div>
             <div className="space-y-3">
                <div className="flex justify-between items-center"><label className="text-xs font-bold text-slate-600">2. เอกสารแนบ (ส่งเข้า Drive ทันที)</label><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{attachments.length}/4 ไฟล์</span></div>
                <div className="grid grid-cols-2 gap-3">
                   {attachments.map((file, idx) => (
                     <div key={idx} className="relative group p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-2 overflow-hidden"><Paperclip size={14} className="text-blue-500 shrink-0" /><span className="text-[10px] font-bold text-blue-700 truncate">{file.name}</span><button type="button" onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))} className="absolute right-1 top-1 p-1 bg-white rounded-md shadow-sm text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X size={10} /></button></div>
                   ))}
                   {attachments.length < 4 && (
                     <label className="border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center py-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all group"><input type="file" className="hidden" multiple onChange={handleAddAttachment} /><Paperclip size={16} className="text-slate-300 group-hover:text-blue-400" /></label>
                   )}
                </div>
             </div>
          </div>
          <button type="submit" disabled={isSaving || !mainFile} className="w-full bg-brand-primary text-white py-4.5 rounded-[24px] font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-green-100 hover:bg-green-700 transition-all disabled:opacity-50">
            {isSaving ? <Loader2 className="animate-spin" /> : <Save />} บันทึกและพักไฟล์รอเกษียณ
          </button>
        </form>
      </Modal>

      <Modal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} title="เกษียณหนังสือและมอบหมายงาน">
        <form onSubmit={handleAssign} className="space-y-6">
          <div className="grid grid-cols-2 gap-4 bg-blue-50 p-4 rounded-2xl border border-blue-100">
             <div>
               <h4 className="text-sm font-black text-blue-800 mb-1">{selectedDoc?.subject}</h4>
               <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">เลขที่รับ: {selectedDoc?.doc_number}</p>
             </div>
             <div className="space-y-1">
               <label className="text-[10px] font-black text-brand-primary uppercase ml-1">ประทับตรา ผอ. ที่หน้า</label>
               <input type="number" min="1" className="w-full p-2 bg-white border-2 border-brand-primary/20 rounded-xl font-black text-brand-primary text-center" required value={assignForm.stamp_page} onChange={e => setAssignForm({...assignForm, stamp_page: parseInt(e.target.value) || 1})} />
             </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">คำสั่งการผู้อำนวยการ (จะประทับตราลงใน PDF)</label>
            <textarea className="w-full p-4 bg-white border border-brand-primary/20 rounded-2xl font-bold text-blue-800 outline-hidden focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all" rows={3} placeholder="เช่น มอบครู... ดำเนินการ, เห็นชอบตามเสนอ..." required value={assignForm.instruction} onChange={e => setAssignForm({...assignForm, instruction: e.target.value})} />
          </div>
          <div className="space-y-1.5 border-t pt-4">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">มอบหมายผู้ปฏิบัติในระบบ</label>
            <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary" required value={assignForm.teacher_id} onChange={e => setAssignForm({...assignForm, teacher_id: e.target.value})}>
              <option value="">-- กรุณาเลือกรายชื่อผู้ปฏิบัติ --</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.prefix}{t.first_name} {t.last_name} ({t.position})</option>)}
            </select>
          </div>
          <button type="submit" disabled={isSaving || !assignForm.teacher_id || !assignForm.instruction} className="w-full py-5 bg-slate-800 text-white rounded-[24px] font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-slate-200 hover:bg-slate-900 transition-all disabled:opacity-50">
            {isSaving ? <Loader2 className="animate-spin" /> : <Send />} ยืนยันเกษียณและส่งเข้า Google Drive
          </button>
          <p className="text-[9px] text-center text-slate-400 font-bold uppercase tracking-widest">ระบบจะนำไฟล์จากที่พักไฟล์มาประทับตราและส่งเข้า Drive อัตโนมัติ</p>
        </form>
      </Modal>
    </div>
  );
}
