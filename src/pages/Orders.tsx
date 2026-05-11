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
  Book,
  Trash2,
  Printer,
  FileText
} from 'lucide-react';
import garuda3cm from '../assets/saraban/garuda-3cm.png';

export default function Orders() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  const [formData, setFormData] = useState({
    order_number: '',
    subject: '',
    issuer: 'โรงเรียนบ้านควนโคกยา',
    order_date: new Date().toISOString().split('T')[0],
    content: '',
    sign_name: '',
    sign_position: 'ผู้อำนวยการโรงเรียนบ้านควนโคกยา',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => { 
    fetchDocs(); 
    fetchSettings();
  }, []);

  async function fetchSettings() {
    const { data } = await supabase.from('settings').select('*').single();
    if (data) {
      setSettings(data);
      setFormData(prev => ({
        ...prev,
        issuer: data.school_name || 'โรงเรียนบ้านควนโคกยา',
        sign_name: data.director_name || '',
        sign_position: `ผู้อำนวยการ${data.school_name || 'โรงเรียนบ้านควนโคกยา'}`
      }));
    }
  }

  async function fetchDocs() {
    setLoading(true);
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    setDocs(data || []);
    setLoading(false);
  }

  const toThaiNumerals = (text: string) => {
    return text?.toString().replace(/[0-9]/g, (digit) => '๐๑๒๓๔๕๖๗๘๙'[parseInt(digit)]) || '';
  };

  const printOrder = (doc: any) => {
    let extraData: any = {};
    try {
      if (doc.remark && doc.remark.startsWith('{')) {
        extraData = JSON.parse(doc.remark);
      }
    } catch (e) {}

    const data = { ...doc, ...extraData };
    const dateObj = new Date(data.order_date);
    const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    const fullDate = `สั่ง ณ วันที่ ${toThaiNumerals(dateObj.getDate().toString())} เดือน ${thaiMonths[dateObj.getMonth()]} พ.ศ. ${toThaiNumerals((dateObj.getFullYear() + 543).toString())}`;

    const html = `
      <html>
        <head>
          <title>คำสั่ง - ${data.order_number}</title>
          <style>
            @font-face {
              font-family: 'THSarabunIT๙';
              src: local('THSarabunIT๙');
            }
            body { 
              font-family: 'THSarabunIT๙', 'TH Sarabun New', sans-serif; 
              padding: 0; margin: 0; background: #f0f0f0;
            }
            .page {
              background: white; width: 210mm; min-height: 297mm;
              margin: 10mm auto; padding: 1.5cm 1.5cm 2cm 3cm;
              box-sizing: border-box; position: relative;
              font-size: 16pt; line-height: 1.15; color: black;
            }
            .garuda {
              display: block; margin: 0 auto 0.5cm auto; width: 3cm; height: auto;
            }
            .header-title {
              text-align: center; font-size: 18pt; font-weight: bold; margin-bottom: 0.2cm;
            }
            .order-info {
              text-align: center; font-size: 16pt; font-weight: bold; margin-bottom: 0.8cm;
            }
            .subject-title {
              text-align: center; font-size: 16pt; font-weight: bold; margin-bottom: 0.8cm;
            }
            .content-text {
              margin-top: 0.5cm;
            }
            .content-text p {
              text-indent: 2.5cm; text-align: justify; margin: 0 0 0.3cm 0; font-size: 16pt;
              word-break: break-word;
              overflow-wrap: break-word;
            }
            .footer-date-block {
              margin-top: 2cm;
              margin-left: 7.8cm;
              width: 8cm;
              font-size: 16pt;
            }
            .footer-date-content {
              text-align: center;
              margin-left: -4.8cm;
            }
            .sig-block {
              margin-top: 1cm;
              margin-left: 7.8cm;
              width: 8cm;
            }
            .sig-name-block {
              text-align: center;
              margin-left: -4.8cm;
              line-height: 1.5;
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
          <button class="no-print-btn no-print" onclick="window.print()">🖨️ พิมพ์คำสั่ง</button>
          <div class="page">
            <img src="${garuda3cm}" class="garuda" />
            <div class="header-title">คำสั่ง${data.issuer || ''}</div>
            <div class="order-info">ที่ ${toThaiNumerals(data.order_number)}</div>
            <div class="subject-title">เรื่อง ${data.subject}</div>
            <div class="content-text">
              ${(data.content || '').split('\n').filter((p: string) => p.trim() !== '').map((p: string) => `<p>${toThaiNumerals(p)}</p>`).join('')}
            </div>
            
            <div class="footer-date-block">
              <div class="footer-date-content">
                ${toThaiNumerals(fullDate)}
              </div>
            </div>

            <div class="sig-block">
              <div class="sig-name-block">
                ( ${data.sign_name || '................................................'} )<br/>
                ตำแหน่ง ${data.sign_position || '................................................'}
              </div>
            </div>
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
      const { data: doc } = await supabase.from('orders').select('file_url').eq('id', id).single();
      if (doc?.file_url) {
        await deleteFileFromDrive(doc.file_url);
      }
      const { error } = await supabase.from('orders').delete().eq('id', id);
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
          file_url = await uploadFile(selectedFile, 'documents', 'orders');
        } catch (uploadErr: any) {
          throw new Error(`อัปโหลดไฟล์ไม่สำเร็จ: ${uploadErr.message}`);
        }
      }

      const extraData = {
        content: formData.content,
        sign_name: formData.sign_name,
        sign_position: formData.sign_position
      };

      const { error } = await supabase.from('orders').insert([{ 
        order_number: formData.order_number,
        subject: formData.subject,
        issuer: formData.issuer,
        order_date: formData.order_date,
        remark: JSON.stringify(extraData),
        file_url, 
        status: 'active',
        created_by: user?.id 
      }]);

      if (error) throw new Error(`บันทึกข้อมูลไม่สำเร็จ: ${error.message}`);

      const lineMessage = `\n📋 คำสั่งใหม่\nเลขที่: ${formData.order_number}\nเรื่อง: ${formData.subject}\n\nตรวจสอบและพิมพ์ได้ที่ระบบงานสารบรรณ`;
      sendLineNotification(lineMessage);

      setIsModalOpen(false);
      resetForm();
      fetchDocs();
      alert('บันทึกคำสั่งเรียบร้อยแล้ว');
    } catch (err: any) {
      console.error(err);
      alert(`ไม่สามารถบันทึกได้: ${err.message}`);
    } finally { setIsSaving(false); }
  }

  function resetForm() {
    setFormData({ 
      order_number: '', 
      subject: '', 
      issuer: settings?.school_name || 'โรงเรียนบ้านควนโคกยา', 
      order_date: new Date().toISOString().split('T')[0], 
      content: '',
      sign_name: settings?.director_name || '',
      sign_position: `ผู้อำนวยการ${settings?.school_name || 'โรงเรียนบ้านควนโคกยา'}`
    });
    setSelectedFile(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
          <input type="text" placeholder="ค้นหาคำสั่ง..." className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-hidden shadow-xs" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-brand-primary text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-all">
          <Book size={20} /> ออกเลขคำสั่ง
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">เลขที่คำสั่ง / วันที่</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">เรื่อง</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={3} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-brand-primary" /></td></tr>
            ) : docs.length === 0 ? (
              <tr><td colSpan={3} className="py-20 text-center text-slate-400 italic">ไม่พบข้อมูลคำสั่ง</td></tr>
            ) : (
              docs.filter(d => d.subject.includes(searchTerm)).map(doc => (
                <tr key={doc.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800 text-sm">{doc.order_number}</div>
                    <div className="text-[10px] text-slate-400">{doc.order_date}</div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-700">{doc.subject}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => printOrder(doc)} className="p-2 text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors" title="พิมพ์คำสั่ง"><Printer size={18} /></button>
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="ออกเลขคำสั่งและสร้างเอกสาร">
        <form onSubmit={handleSave} className="space-y-4 max-h-[80vh] overflow-y-auto px-1 pb-4 text-slate-700">
          <div className="bg-slate-50 p-4 rounded-2xl space-y-4 border border-slate-100">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><FileText size={14} /> ข้อมูลหัวคำสั่ง</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 ml-1">เลขที่คำสั่ง</label>
                <input type="text" placeholder="เช่น 123/2569" className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold" required value={formData.order_number} onChange={e => setFormData({...formData, order_number: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 ml-1">สั่ง ณ วันที่</label>
                <input type="date" className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold" required value={formData.order_date} onChange={e => setFormData({...formData, order_date: e.target.value})} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 ml-1">เรื่อง</label>
              <input type="text" placeholder="ระบุชื่อเรื่องคำสั่ง" className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold" required value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 ml-1">เนื้อหาคำสั่ง (กด Enter เพื่อขึ้นย่อหน้าใหม่)</label>
            <textarea placeholder="พิมพ์เนื้อหาคำสั่งที่นี่..." className="w-full p-4 bg-white border border-slate-200 rounded-xl font-medium" rows={10} value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} />
          </div>

          <div className="bg-blue-50/50 p-4 rounded-2xl space-y-4 border border-blue-100/50">
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2"><Save size={14} /> ข้อมูลการลงนาม</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-blue-500 ml-1">ชื่อผู้ลงนาม</label>
                <input type="text" className="w-full p-3 bg-white border border-blue-200 rounded-xl font-bold" required value={formData.sign_name} onChange={e => setFormData({...formData, sign_name: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-blue-500 ml-1">ตำแหน่ง</label>
                <input type="text" className="w-full p-3 bg-white border border-blue-200 rounded-xl font-bold" value={formData.sign_position} onChange={e => setFormData({...formData, sign_position: e.target.value})} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <label className="flex-1 p-4 bg-white border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer text-center text-slate-400 hover:border-brand-primary hover:text-brand-primary transition-all">
                <input type="file" className="hidden" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                <div className="text-sm font-bold">{selectedFile ? selectedFile.name : 'แนบไฟล์ฉบับที่มีลายเซ็น (ถ้ามี)'}</div>
                <div className="text-[10px] opacity-60">รองรับ PDF, JPG, PNG</div>
             </label>
             <button type="button" onClick={() => printOrder(formData)} className="p-4 bg-slate-100 text-slate-600 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-200 transition-all">
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
