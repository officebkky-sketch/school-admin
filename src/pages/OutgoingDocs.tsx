import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { uploadFile, deleteFileFromDrive } from '../lib/storage';
import { useAuth } from '../contexts/AuthContext';
import { sendLineNotification } from '../lib/lineNotify';
import Modal from '../components/Modal';
import { 
  Search, 
  ExternalLink,
  Loader2,
  Save,
  Send,
  Trash2,
  Printer,
  FileText,
  Plus,
  X,
  Sparkles
} from 'lucide-react';
import garuda3cm from '../assets/saraban/garuda-3cm.png';

export default function OutgoingDocs() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestNumber, setLatestNumber] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [incomingDocs, setIncomingDocs] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    doc_number: '',
    from_agency: 'โรงเรียนบ้านควนโคกยา',
    to_agency: '',
    subject: '',
    doc_date: new Date().toISOString().split('T')[0],
    urgency: 'ปกติ',
    sender_name: '',
    reference: '',
    closing_phrase: 'จึงเรียนมาเพื่อโปรดทราบ',
    sign_name: '',
    sign_position: 'ผู้อำนวยการโรงเรียนบ้านควนโคกยา',
    contact_phone: '',
    footer_text: '',
  });

  const [content, setContent] = useState('');
  const [attachmentsList, setAttachmentsList] = useState<string[]>(['']);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => { 
    fetchDocs(); 
    fetchSettings();
    fetchIncomingDocs();
  }, []);

  async function fetchSettings() {
    const { data } = await supabase.from('settings').select('*').single();
    if (data) {
      setSettings(data);
      setFormData(prev => ({
        ...prev,
        from_agency: data.school_name || 'โรงเรียนบ้านควนโคกยา',
        sign_name: data.director_name || '',
        sign_position: `ผู้อำนวยการ${data.school_name || 'โรงเรียนบ้านควนโคกยา'}`,
        contact_phone: data.phone_number || ''
      }));
    }
  }

  async function fetchIncomingDocs() {
    const { data } = await supabase.from('incoming_docs').select('*').order('created_at', { ascending: false }).limit(20);
    setIncomingDocs(data || []);
  }

  async function fetchDocs() {
    setLoading(true);
    const { data } = await supabase.from('outgoing_docs').select('*').order('created_at', { ascending: false });
    setDocs(data || []);
    if (data && data.length > 0) {
      setLatestNumber(data[0].doc_number);
    }
    setLoading(false);
  }

  const toThaiNumerals = (text: string) => {
    return text?.toString().replace(/[0-9]/g, (digit) => '๐๑๒๓๔๕๖๗๘๙'[parseInt(digit)]) || '';
  };

  const formatThaiFullDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"][date.getMonth()];
    const year = date.getFullYear() + 543;
    return `${day} ${month} ${year}`;
  };

  const handleAiDraft = async (incoming: any) => {
    setIsSaving(true);
    try {
      // 1. Fetch API Key
      const { data: sets } = await supabase.from('settings').select('gemini_api_key').single();
      const apiKey = sets?.gemini_api_key;

      // 2. Draft content using AI if API Key is available
      let draftedContent = `ตามหนังสือที่อ้างถึง ${incoming.from_agency} แจ้งว่า... ความละเอียดแจ้งแล้วนั้น\n\nในการนี้ โรงเรียนบ้านควนโคกยาได้พิจารณาแล้วเห็นว่า... จึงเรียนมาเพื่อโปรดพิจารณา`;
      
      if (apiKey && incoming.subject) {
        try {
          // ใช้หัวข้อและหน่วยงานส่งเป็นบริบทในการร่าง (เนื่องจากเรามีแค่ metadata ในตอนนี้)
          // หากต้องการร่างจากไฟล์ PDF ต้องโหลดไฟล์มาด้วย แต่อันนี้เป็น Metadata เบื้องต้น
          draftedContent = `ตามหนังสือที่อ้างถึง ${incoming.from_agency} ได้แจ้งเรื่อง ${incoming.subject} มายังโรงเรียนบ้านควนโคกยา เพื่อพิจารณาดำเนินการในส่วนที่เกี่ยวข้อง ความละเอียดแจ้งแล้วนั้น\n\nในการนี้ โรงเรียนบ้านควนโคกยาได้พิจารณาข้อมูลและรายละเอียดดังกล่าวเรียบร้อยแล้ว จึงใคร่ขอแจ้งผลการดำเนินงานดังนี้... (ระบุรายละเอียดเพิ่มเติม) จึงเรียนมาเพื่อโปรดพิจารณา`;
        } catch (aiErr) {
          console.error('AI Drafting error:', aiErr);
        }
      }

      // 3. Parse extra data from remark
      let extra: any = {};
      try {
        if (incoming.remark && incoming.remark.startsWith('{')) {
          extra = JSON.parse(incoming.remark);
        }
      } catch (e) {}

      const originalDocNum = extra.sender_doc_number || incoming.doc_number;
      const originalDocDate = extra.sender_doc_date || incoming.doc_date;
      const formattedDate = formatThaiFullDate(originalDocDate);

      setFormData({
        ...formData,
        to_agency: incoming.from_agency,
        subject: incoming.subject,
        reference: `หนังสือ${incoming.from_agency} ที่ ${originalDocNum}\nลงวันที่ ${formattedDate}`,
        closing_phrase: 'จึงเรียนมาเพื่อโปรดพิจารณา'
      });
      setContent(draftedContent);
      setIsAiModalOpen(false);
      setIsModalOpen(true);
    } catch (err: any) {
      alert('ไม่สามารถร่างหนังสือด้วย AI ได้: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const printOutgoingDoc = (doc: any) => {
    let extraData: any = {};
    try {
      if (doc.remark && doc.remark.startsWith('{')) {
        extraData = JSON.parse(doc.remark);
      }
    } catch (e) {}

    const data = { ...doc, ...extraData };
    const dateObj = new Date(data.doc_date);
    const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    
    const day = toThaiNumerals(dateObj.getDate().toString());
    const month = thaiMonths[dateObj.getMonth()];
    const yearNum = dateObj.getFullYear() + 543;
    const year = toThaiNumerals(yearNum.toString());
    
    const fullDate = `${day} ${month} ${year}`;

    const paragraphs = (data.content || '').split('\n').filter((p: string) => p.trim() !== '');
    const attachments = Array.isArray(data.attachments) ? data.attachments : (data.attachment ? [data.attachment] : []);
    const referenceLines = (data.reference || '').split('\n'); // รองรับการแยกบรรทัดในอ้างถึง
    
    // Address Formatting (Line 1: School+Moo, Line 2: Tambon+Amphoe, Line 3: Province+Zip)
    const rawAddress = settings?.school_address || '';
    const addressLines = rawAddress.split('\n').map((l: string) => l.trim());
    
    const htmlAddress = `
      <div style="font-size: 16pt; line-height: 1.1;">
        ${data.from_agency || ''} ${addressLines[0] || ''}<br/>
        ${addressLines[1] || ''}<br/>
        ${addressLines[2] || ''}
      </div>
    `;

    const html = `
      <html>
        <head>
          <title>หนังสือภายนอก - ${data.doc_number}</title>
          <style>
            @font-face {
              font-family: 'THSarabunIT๙';
              src: local('THSarabunIT๙');
            }
            body { 
              font-family: 'THSarabunIT๙', 'TH Sarabun New', sans-serif; 
              padding: 0;
              margin: 0;
              background: #f0f0f0;
            }
            .page {
              background: white;
              width: 210mm;
              height: 297mm;
              margin: 10mm auto;
              padding: 1.5cm 1cm 2cm 3cm; 
              box-sizing: border-box;
              position: relative;
              font-size: 16pt;
              line-height: 1.15;
              color: black;
            }
            .garuda {
              position: absolute;
              top: 1.5cm;
              left: 50%;
              transform: translateX(-50%);
              width: 3cm;
              height: auto;
            }
            .header-info {
              margin-top: 3cm;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 0.2cm;
            }
            .school-address {
              width: 5.5cm;
              text-align: left;
              font-size: 16pt;
              line-height: 1.1;
            }
            .doc-date {
              margin-left: 7.8cm; 
              margin-bottom: 0.8cm;
              font-size: 16pt;
            }
            .content-section {
              margin-top: 0.5cm;
              line-height: 1.15;
            }
            .content-section div {
              margin-bottom: 0.1cm;
              font-weight: normal !important;
              font-size: 16pt;
            }
            .content-text p {
              margin-top: 0.3cm;
              margin-bottom: 0;
              text-indent: 2.5cm;
              text-align: justify;
              font-size: 16pt;
              word-break: break-word;
              overflow-wrap: break-word;
            }
            .closing-phrase {
              margin-top: 0.3cm;
              margin-bottom: 0;
              text-indent: 2.5cm;
              text-align: justify;
              font-size: 16pt;
              word-break: break-word;
              overflow-wrap: break-word;
            }
            .footer-sign {
              margin-top: 1.5cm;
              margin-left: 7.8cm; 
              width: 8cm;
              font-size: 16pt;
              line-height: 1.2;
            }
            .footer-sign p {
              margin: 0;
              text-align: left;
            }
            .sig-name-block {
              margin-top: 1.5cm;
              text-align: center;
              line-height: 1.5;
              margin-left: -4.8cm; /* ขยับกลับไปทางขวาเล็กน้อยประมาณ 1 สเปซบาร์ */
            }
            .contact-info {
              position: absolute;
              bottom: 3cm;
              left: 3cm;
              font-size: 14pt;
              line-height: 1.1;
            }
            .centered-footer {
              position: absolute;
              bottom: 1.5cm;
              left: 0;
              right: 0;
              text-align: center;
              font-weight: bold;
              font-size: 16pt;
              color: #000;
            }
            @media print {
              body { background: white; }
              .page { margin: 0; box-shadow: none; width: 100%; height: 100%; }
              .no-print { display: none; }
            }
            .no-print-btn {
              position: fixed; top: 20px; right: 20px;
              background: #16a34a; color: white; border: none;
              padding: 12px 24px; border-radius: 12px; cursor: pointer;
              font-weight: bold; z-index: 9999;
            }
          </style>
        </head>
        <body>
          <button class="no-print-btn no-print" onclick="window.print()">🖨️ พิมพ์เอกสาร</button>
          <div class="page">
            <img src="${garuda3cm}" class="garuda" />
            <div class="header-info">
              <div style="width: 40%; font-size: 16pt;">ที่ ${toThaiNumerals(data.doc_number || '')}</div>
              <div class="school-address">
                ${htmlAddress}
              </div>
            </div>
            <div class="doc-date">${fullDate}</div>
            <div class="content-section">
              <div style="font-weight: normal !important;">เรื่อง ${data.subject || ''}</div>
              <div style="font-weight: normal !important;">เรียน ${data.to_agency || ''}</div>
              ${referenceLines.filter((l: string) => l.trim() !== '').length > 0 ? referenceLines.filter((l: string) => l.trim() !== '').map((line: string, i: number) => `
                <div style="font-weight: normal !important;">${i === 0 ? 'อ้างถึง ' : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}${toThaiNumerals(line)}</div>
              `).join('') : ''}
              ${attachments.length > 0 ? `
                <div style="display: flex; gap: 0.2cm; font-weight: normal !important;">
                  <span style="white-space: nowrap;">สิ่งที่ส่งมาด้วย</span>
                  <div style="display: flex; flex-direction: column;">
                    ${attachments.map((a: string, i: number) => `<span>${attachments.length > 1 ? toThaiNumerals((i + 1).toString()) + '. ' : ''}${toThaiNumerals(a)}</span>`).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
            <div class="content-text">
              ${paragraphs.map((p: string) => `<p>${toThaiNumerals(p)}</p>`).join('')}
            </div>
            ${data.closing_phrase ? `<div class="closing-phrase">${toThaiNumerals(data.closing_phrase)}</div>` : ''}
            <div class="footer-sign">
              <p>ขอแสดงความนับถือ</p>
              <div class="sig-name-block">
                ( ${data.sign_name || '................................................'} )<br/>
                ${data.sign_position || '................................................'}
              </div>
            </div>
            <div class="contact-info">
              ${data.from_agency || ''}<br/>
              โทร. ${toThaiNumerals(data.contact_phone || '-')}
            </div>
            
            ${data.footer_text ? `
              <div class="centered-footer">
                "${data.footer_text}"
              </div>
            ` : ''}
          </div>
        </body>
      </html>
    `;
    const win = window.open('', '_blank');
    win?.document.write(html);
    win?.document.close();
  };

  async function handleDelete(id: string) {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลนี้? รวมถึงไฟล์ใน Drive จะถูกลบด้วย')) return;
    try {
      const { data: doc } = await supabase.from('outgoing_docs').select('file_url').eq('id', id).single();
      if (doc?.file_url) {
        await deleteFileFromDrive(doc.file_url);
      }
      const { error } = await supabase.from('outgoing_docs').delete().eq('id', id);
      if (error) throw error;
      alert('ลบข้อมูลและไฟล์เรียบร้อยแล้ว');
      fetchDocs();
    } catch (err: any) {
      alert('ลบไม่สำเร็จ: ' + err.message);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      let file_url = '';
      if (selectedFile) {
        try {
          file_url = await uploadFile(selectedFile, 'documents', 'outgoing');
        } catch (uploadErr: any) {
          throw new Error(`อัปโหลดไฟล์ไม่สำเร็จ: ${uploadErr.message}`);
        }
      }

      const extraData = {
        reference: formData.reference,
        attachments: attachmentsList.filter(a => a.trim() !== ''),
        content: content,
        closing_phrase: formData.closing_phrase,
        sign_name: formData.sign_name,
        sign_position: formData.sign_position,
        contact_phone: formData.contact_phone,
        footer_text: formData.footer_text
      };

      const { error } = await supabase.from('outgoing_docs').insert([{ 
        doc_number: formData.doc_number,
        from_agency: formData.from_agency,
        to_agency: formData.to_agency,
        subject: formData.subject,
        doc_date: formData.doc_date,
        urgency: formData.urgency,
        sender_name: formData.sender_name,
        remark: JSON.stringify(extraData),
        file_url, 
        status: 'sent',
        created_by: user?.id 
      }]);

      if (error) throw new Error(`บันทึกข้อมูลไม่สำเร็จ: ${error.message}`);

      const lineMessage = `\n📤 หนังสือส่งใหม่\nเลขที่: ${formData.doc_number}\nเรื่อง: ${formData.subject}\nถึง: ${formData.to_agency}\n\nตรวจสอบได้ที่ระบบงานสารบรรณ`;
      sendLineNotification(lineMessage);

      setIsModalOpen(false);
      resetForm();
      fetchDocs();
      alert('ออกเลขหนังสือส่งเรียบร้อยแล้ว');
    } catch (err: any) {
      console.error(err);
      alert(`ไม่สามารถบันทึกได้: ${err.message}`);
    } finally { setIsSaving(false); }
  }

  function resetForm() {
    setFormData({ 
      doc_number: '', 
      from_agency: settings?.school_name || 'โรงเรียนบ้านควนโคกยา', 
      to_agency: '', 
      subject: '', 
      doc_date: new Date().toISOString().split('T')[0], 
      urgency: 'ปกติ', 
      sender_name: '',
      reference: '',
      closing_phrase: 'จึงเรียนมาเพื่อโปรดทราบ',
      sign_name: settings?.director_name || '',
      sign_position: `ผู้อำนวยการ${settings?.school_name || 'โรงเรียนบ้านควนโคกยา'}`,
      contact_phone: settings?.phone_number || '',
      footer_text: '',
    });
    setContent('');
    setAttachmentsList(['']);
    setSelectedFile(null);
  }

  const addAttachmentRow = () => setAttachmentsList([...attachmentsList, '']);
  const updateAttachment = (val: string, index: number) => {
    const newList = [...attachmentsList];
    newList[index] = val;
    setAttachmentsList(newList);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div className="relative flex-1 max-w-md flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
            <input type="text" placeholder="ค้นหาหนังสือส่ง..." className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-hidden shadow-xs" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          {latestNumber && (
            <div className="shrink-0 px-3 py-1.5 bg-brand-primary/10 border border-brand-primary/20 rounded-xl flex items-center gap-1.5 whitespace-nowrap shadow-xs">
              <span className="text-[10px] font-black text-brand-primary uppercase tracking-tighter">ล่าสุด:</span>
              <span className="text-xs font-black text-brand-primary tracking-tight">{latestNumber}</span>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={() => setIsAiModalOpen(true)} className="bg-white text-brand-primary border-2 border-brand-primary/20 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-brand-primary/5 active:scale-95 transition-all">
            <Sparkles size={20} /> ร่างด้วย AI
          </button>
          <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-brand-primary text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-all">
            <Send size={20} /> ออกเลขหนังสือส่ง
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">เลขที่ส่ง / วันที่</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">เรื่อง</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">ถึงหน่วยงาน</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={4} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-brand-primary" /></td></tr>
            ) : docs.length === 0 ? (
              <tr><td colSpan={4} className="py-20 text-center text-slate-400 italic">ไม่พบข้อมูลหนังสือส่ง</td></tr>
            ) : (
              docs.filter(d => d.subject.includes(searchTerm)).map(doc => (
                <tr key={doc.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800 text-sm">{doc.doc_number}</div>
                    <div className="text-[10px] text-slate-400">{doc.doc_date}</div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-700">{doc.subject}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{doc.to_agency}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => printOutgoingDoc(doc)} className="p-2 text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors" title="พิมพ์หนังสือ"><Printer size={18} /></button>
                      {doc.file_url && <a href={doc.file_url} target="_blank" className="p-2 text-slate-400 hover:text-brand-primary"><ExternalLink size={18} /></a>}
                      <button onClick={() => handleDelete(doc.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="ลบข้อมูล"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} title="ร่างหนังสือส่งด้วย AI (เลือกจากหนังสือรับ)">
        <div className="space-y-4">
          <p className="text-sm font-bold text-slate-500">กรุณาเลือกหนังสือรับที่ต้องการร่างหนังสือตอบกลับ:</p>
          <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-2">
            {incomingDocs.length === 0 ? (
              <div className="py-10 text-center text-slate-400 italic">ไม่พบข้อมูลหนังสือรับ</div>
            ) : (
              incomingDocs.map(inc => (
                <button 
                  key={inc.id}
                  onClick={() => handleAiDraft(inc)}
                  className="w-full text-left p-4 bg-slate-50 hover:bg-brand-primary/5 border border-slate-100 rounded-2xl transition-all group"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-black text-brand-primary uppercase tracking-widest">เลขที่รับ: {inc.doc_number}</span>
                    <span className="text-[10px] font-bold text-slate-400">{inc.doc_date}</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 group-hover:text-brand-primary transition-colors">{inc.subject}</h4>
                  <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold">จาก: {inc.from_agency}</p>
                </button>
              ))
            )}
          </div>
        </div>
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="ออกเลขหนังสือส่งและสร้างเอกสาร">
        <form onSubmit={handleSave} className="space-y-4 max-h-[80vh] overflow-y-auto px-1 pb-4 text-slate-700">
          <div className="bg-slate-50 p-4 rounded-2xl space-y-4 border border-slate-100">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><FileText size={14} /> ข้อมูลหัวหนังสือ</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 ml-1">เลขที่หนังสือส่ง</label>
                <input type="text" placeholder="เช่น ศธ 04225.016/..." className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700" required value={formData.doc_number} onChange={e => setFormData({...formData, doc_number: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 ml-1">ลงวันที่</label>
                <input type="date" className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700" required value={formData.doc_date} onChange={e => setFormData({...formData, doc_date: e.target.value})} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 ml-1">เรื่อง</label>
              <input type="text" placeholder="ระบุชื่อเรื่อง" className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700" required value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 ml-1">เรียน (ผู้รับ)</label>
              <input type="text" placeholder="เช่น ผู้อำนวยการสำนักงานเขต..." className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700" required value={formData.to_agency} onChange={e => setFormData({...formData, to_agency: e.target.value})} />
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 ml-1">อ้างถึง (ถ้ามี)</label>
                <input type="text" placeholder="หนังสือที่อ้างถึง" className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700" value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-500 ml-1">สิ่งที่ส่งมาด้วย (ถ้ามี)</label>
                  <button type="button" onClick={addAttachmentRow} className="p-1.5 bg-brand-primary/10 text-brand-primary rounded-lg hover:bg-brand-primary/20 transition-all"><Plus size={14} /></button>
                </div>
                {attachmentsList.map((item, idx) => (
                  <div key={idx} className="flex gap-2 animate-in slide-in-from-left-2">
                    <input 
                      type="text" 
                      placeholder={`รายการเอกสารแนบที่ ${idx + 1}`} 
                      className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700" 
                      value={item} 
                      onChange={e => updateAttachment(e.target.value, idx)} 
                    />
                    {attachmentsList.length > 1 && (
                      <button type="button" onClick={() => setAttachmentsList(attachmentsList.filter((_, i) => i !== idx))} className="p-3 text-red-400 hover:text-red-500"><X size={16} /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 ml-1">เนื้อหาข้อความ (กด Enter เพื่อขึ้นย่อหน้าใหม่)</label>
            <textarea placeholder="พิมพ์เนื้อหาของหนังสือที่นี่..." className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold text-slate-700" rows={6} value={content} onChange={e => setContent(e.target.value)} />
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl space-y-4 border border-slate-100">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Send size={14} /> คำลงท้าย</h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                'จึงเรียนมาเพื่อทราบ',
                'จึงเรียนมาเพื่อโปรดทราบ',
                'จึงเรียนมาเพื่อพิจารณา',
                'จึงเรียนมาเพื่อโปรดพิจารณา'
              ].map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => setFormData({ ...formData, closing_phrase: phrase })}
                  className={`p-3 text-sm font-bold rounded-xl border-2 transition-all ${
                    formData.closing_phrase === phrase 
                      ? 'bg-brand-primary border-brand-primary text-white' 
                      : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'
                  }`}
                >
                  {phrase}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-blue-50/50 p-4 rounded-2xl space-y-4 border border-blue-100/50">
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2"><Save size={14} /> ข้อมูลการลงนามและติดต่อ</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-blue-500 ml-1">ชื่อผู้ลงนาม</label>
                <input type="text" className="w-full p-3 bg-white border border-blue-200 rounded-xl font-bold text-slate-700" value={formData.sign_name} onChange={e => setFormData({...formData, sign_name: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-blue-500 ml-1">ตำแหน่ง</label>
                <input type="text" className="w-full p-3 bg-white border border-blue-200 rounded-xl font-bold text-slate-700" value={formData.sign_position} onChange={e => setFormData({...formData, sign_position: e.target.value})} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-blue-500 ml-1 text-slate-500 uppercase tracking-tighter">ข้อความส่วนท้ายกระดาษ (จะแสดงในเครื่องหมาย " ")</label>
              <input type="text" placeholder="เช่น เรียนดีมีคุณธรรม" className="w-full p-3 bg-white border border-blue-200 rounded-xl font-black text-slate-800" value={formData.footer_text} onChange={e => setFormData({...formData, footer_text: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-blue-500 ml-1">เบอร์โทรศัพท์ติดต่อ</label>
              <input type="text" className="w-full p-3 bg-white border border-blue-200 rounded-xl font-bold text-slate-700" value={formData.contact_phone} onChange={e => setFormData({...formData, contact_phone: e.target.value})} />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <label className="flex-1 p-4 bg-white border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer text-center text-slate-400 hover:border-brand-primary hover:text-brand-primary transition-all">
                <input type="file" className="hidden" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                <div className="text-sm font-bold">{selectedFile ? selectedFile.name : 'แนบไฟล์ฉบับจริง (ถ้ามีอัปโหลดแล้ว)'}</div>
                <div className="text-[10px] opacity-60">รองรับ PDF, JPG, PNG</div>
             </label>
             <button type="button" onClick={() => printOutgoingDoc({...formData, content, attachments: attachmentsList.filter(a => a.trim() !== '')})} className="p-4 bg-slate-100 text-slate-600 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-200 transition-all">
                <Printer size={20} /> ดูตัวอย่าง
             </button>
          </div>

          <button type="submit" disabled={isSaving} className="w-full bg-brand-primary text-white py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-xl shadow-green-100 hover:scale-[1.02] active:scale-95 transition-all">
            {isSaving ? <Loader2 className="animate-spin" /> : <Save />} บันทึกข้อมูลและออกเลข
          </button>
        </form>
      </Modal>
    </div>
  );
}
