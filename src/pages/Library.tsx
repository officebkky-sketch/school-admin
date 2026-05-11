import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Library, 
  BookOpen, 
  History, 
  Loader2,
  Plus,
  Search,
  User,
  CheckCircle2,
  ArrowRightLeft,
  Save
} from 'lucide-react';
import Modal from '../components/Modal';

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black transition-all ${active ? 'bg-white text-brand-primary shadow-sm scale-105' : 'text-slate-400 hover:text-slate-600'}`}
    >
      {icon}
      {label}
    </button>
  );
}

export default function LibraryModule() {
  const [books, setBooks] = useState<any[]>([]);
  const [borrowList, setBorrowList] = useState<any[]>([]);
  const [usageLogs, setUsageLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'books' | 'borrow' | 'logs'>('books');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal States
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [isLogModalOpen, setIsUsageLogModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form States
  const [bookForm, setBookForm] = useState({
    book_id: '',
    title: '',
    category: 'วิชาการ',
    author: '',
    total_qty: 1
  });

  const [borrowForm, setBorrowForm] = useState(() => ({
    book_id: '',
    borrower_name: '',
    borrower_id: '', // Student ID or UUID
    return_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  }));

  const [usageForm, setUsageLogForm] = useState({
    name: '',
    level: 'ป.1',
    purpose: 'อ่านหนังสือ/ค้นคว้า'
  });

  async function fetchBooks() {
    const { data } = await supabase.from('library_books').select('*').order('title');
    setBooks(data || []);
  }

  async function fetchBorrowList() {
    const { data } = await supabase
      .from('library_borrow')
      .select('*, library_books(title)')
      .order('borrow_date', { ascending: false });
    setBorrowList(data || []);
  }

  async function fetchUsageLogs() {
    const { data } = await supabase
      .from('library_usage_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(50);
    setUsageLogs(data || []);
  }

  async function fetchData() {
    setLoading(true);
    if (activeTab === 'books') await fetchBooks();
    else if (activeTab === 'borrow') await fetchBorrowList();
    else if (activeTab === 'logs') await fetchUsageLogs();
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  async function handleAddBook(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    const { error } = await supabase.from('library_books').insert([{
      ...bookForm,
      available_qty: bookForm.total_qty
    }]);
    if (!error) {
      setIsBookModalOpen(false);
      setBookForm({ book_id: '', title: '', category: 'วิชาการ', author: '', total_qty: 1 });
      fetchBooks();
    } else {
      alert('บันทึกไม่สำเร็จ: ' + error.message);
    }
    setIsSaving(false);
  }

  async function handleBorrow(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      // 1. Check availability
      const { data: book } = await supabase.from('library_books').select('available_qty').eq('id', borrowForm.book_id).single();
      if (!book || book.available_qty <= 0) throw new Error('หนังสือเล่มนี้ถูกยืมหมดแล้ว');

      // 2. Create borrow record
      const { error: borrowError } = await supabase.from('library_borrow').insert([borrowForm]);
      if (borrowError) throw borrowError;

      // 3. Update available qty
      const { error: updateError } = await supabase
        .from('library_books')
        .update({ available_qty: book.available_qty - 1 })
        .eq('id', borrowForm.book_id);
      
      if (updateError) throw updateError;

      setIsBorrowModalOpen(false);
      setBorrowForm({ book_id: '', borrower_name: '', borrower_id: '', return_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] });
      fetchBorrowList();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReturn(borrow: any) {
    if (!confirm('ยืนยันการคืนหนังสือ?')) return;
    setIsSaving(true);
    try {
      // 1. Update borrow status
      const { error: returnError } = await supabase
        .from('library_borrow')
        .update({ status: 'returned', return_date: new Date().toISOString().split('T')[0] })
        .eq('id', borrow.id);
      
      if (returnError) throw returnError;

      // 2. Increase available qty
      const { data: book } = await supabase.from('library_books').select('available_qty').eq('id', borrow.book_id).single();
      if (book) {
        await supabase.from('library_books').update({ available_qty: book.available_qty + 1 }).eq('id', borrow.book_id);
      }

      fetchBorrowList();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLogUsage(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    const { error } = await supabase.from('library_usage_logs').insert([usageForm]);
    if (!error) {
      setIsUsageLogModalOpen(false);
      setUsageLogForm({ name: '', level: 'ป.1', purpose: 'อ่านหนังสือ/ค้นคว้า' });
      fetchUsageLogs();
    }
    setIsSaving(false);
  }

  const filteredBooks = books.filter(b => b.title.toLowerCase().includes(searchTerm.toLowerCase()) || b.book_id.includes(searchTerm));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <Library size={32} className="text-brand-primary" />
            ระบบห้องสมุดดิจิทัล
          </h2>
          <p className="text-slate-400 font-bold mt-1 uppercase tracking-widest text-xs">Library & Resource Management</p>
        </div>
        <div className="flex gap-2 p-1 bg-white border border-slate-100 rounded-2xl shadow-sm">
          <TabButton active={activeTab === 'books'} onClick={() => setActiveTab('books')} icon={<Library size={16} />} label="คลังหนังสือ" />
          <TabButton active={activeTab === 'borrow'} onClick={() => setActiveTab('borrow')} icon={<BookOpen size={16} />} label="ยืม-คืน" />
          <TabButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<History size={16} />} label="การเข้าใช้" />
        </div>
      </div>

      <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 min-h-[600px] p-8">
        {activeTab === 'books' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input 
                  type="text" 
                  placeholder="ค้นหารหัสหนังสือ หรือชื่อเรื่อง..." 
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button 
                onClick={() => setIsBookModalOpen(true)}
                className="bg-brand-primary text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 shadow-lg shadow-green-100 hover:bg-green-700 active:scale-95 transition-all w-full md:w-auto justify-center"
              >
                <Plus size={20} /> เพิ่มหนังสือใหม่
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="animate-spin text-brand-primary mb-4" size={40} />
                <p className="text-slate-400 font-bold text-sm uppercase">กำลังโหลดข้อมูลหนังสือ...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredBooks.map(book => (
                  <div key={book.id} className="p-6 bg-white rounded-[32px] border border-slate-100 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                    <div className="w-full aspect-[3/4] bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200 mb-4 group-hover:bg-brand-primary/5 transition-colors">
                      <Library size={64} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-brand-primary uppercase tracking-widest">{book.category}</p>
                      <h4 className="font-black text-slate-800 line-clamp-1">{book.title}</h4>
                      <p className="text-xs text-slate-400 font-bold">โดย {book.author || 'ไม่ระบุชื่อผู้แต่ง'}</p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                       <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${book.available_qty > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                          {book.available_qty > 0 ? `คงเหลือ ${book.available_qty}` : 'ยืมหมดแล้ว'}
                       </span>
                       <span className="text-[10px] text-slate-300 font-bold">ID: {book.book_id}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'borrow' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
               <h3 className="text-xl font-black text-slate-800">รายการยืม-คืนหนังสือ</h3>
               <button 
                onClick={() => setIsBorrowModalOpen(true)}
                className="bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:bg-slate-900 transition-all"
               >
                 <ArrowRightLeft size={18} /> บันทึกการยืม
               </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">วันที่ยืม</th>
                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">หนังสือ</th>
                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ผู้ยืม</th>
                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">กำหนดคืน</th>
                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">สถานะ</th>
                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {borrowList.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-4 font-bold text-slate-500 text-xs">{new Date(item.borrow_date).toLocaleDateString('th-TH')}</td>
                      <td className="px-4 py-4 font-black text-slate-800 text-sm">{item.library_books?.title}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                           <User size={14} className="text-slate-300" />
                           <span className="font-bold text-slate-700 text-sm">{item.borrower_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-bold text-slate-400 text-xs">{item.return_date || '-'}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${item.status === 'borrowing' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                          {item.status === 'borrowing' ? 'กำลังยืม' : 'คืนแล้ว'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        {item.status === 'borrowing' && (
                          <button 
                            onClick={() => handleReturn(item)}
                            className="p-2 text-brand-primary hover:bg-green-50 rounded-xl transition-all"
                            title="คืนหนังสือ"
                          >
                            <CheckCircle2 size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-8">
             <div className="flex justify-between items-center">
               <h3 className="text-xl font-black text-slate-800">สถิติการเข้าใช้ห้องสมุด</h3>
               <button 
                onClick={() => setIsUsageLogModalOpen(true)}
                className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-all"
               >
                 <Plus size={18} /> บันทึกการเข้าใช้
               </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {usageLogs.map(log => (
                 <div key={log.id} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-blue-500 shadow-xs">
                       <User size={20} />
                    </div>
                    <div>
                       <p className="font-black text-slate-800 text-sm">{log.name}</p>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ชั้น {log.level} • {log.purpose}</p>
                       <p className="text-[9px] text-slate-300 font-bold mt-1 uppercase">{new Date(log.timestamp).toLocaleString('th-TH')}</p>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <Modal isOpen={isBookModalOpen} onClose={() => setIsBookModalOpen(false)} title="เพิ่มหนังสือใหม่เข้าคลัง">
        <form onSubmit={handleAddBook} className="space-y-4">
           <div className="space-y-1.5">
             <label className="text-[10px] font-black text-slate-400 uppercase ml-1">รหัสหนังสือ (Book ID)</label>
             <input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" required value={bookForm.book_id} onChange={e => setBookForm({...bookForm, book_id: e.target.value})} />
           </div>
           <div className="space-y-1.5">
             <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ชื่อหนังสือ</label>
             <input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" required value={bookForm.title} onChange={e => setBookForm({...bookForm, title: e.target.value})} />
           </div>
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">หมวดหมู่</label>
                <select className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" value={bookForm.category} onChange={e => setBookForm({...bookForm, category: e.target.value})}>
                   <option>วิชาการ</option>
                   <option>วรรณกรรม/นิยาย</option>
                   <option>ความรู้ทั่วไป</option>
                   <option>ภาษา</option>
                   <option>คอมพิวเตอร์</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">จำนวนเล่ม</label>
                <input type="number" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" min="1" value={bookForm.total_qty} onChange={e => setBookForm({...bookForm, total_qty: parseInt(e.target.value)})} />
              </div>
           </div>
           <div className="space-y-1.5">
             <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ผู้แต่ง</label>
             <input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" value={bookForm.author} onChange={e => setBookForm({...bookForm, author: e.target.value})} />
           </div>
           <button type="submit" disabled={isSaving} className="w-full bg-brand-primary text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl shadow-green-100">
             {isSaving ? <Loader2 className="animate-spin" /> : <Save />} บันทึกหนังสือ
           </button>
        </form>
      </Modal>

      <Modal isOpen={isBorrowModalOpen} onClose={() => setIsBorrowModalOpen(false)} title="บันทึกการยืมหนังสือ">
        <form onSubmit={handleBorrow} className="space-y-4">
           <div className="space-y-1.5">
             <label className="text-[10px] font-black text-slate-400 uppercase ml-1">เลือกหนังสือที่ต้องการยืม</label>
             <select 
              className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" 
              required 
              value={borrowForm.book_id} 
              onChange={e => setBorrowForm({...borrowForm, book_id: e.target.value})}
             >
               <option value="">-- กรุณาเลือกหนังสือ --</option>
               {books.filter(b => b.available_qty > 0).map(b => (
                 <option key={b.id} value={b.id}>{b.title} (ID: {b.book_id})</option>
               ))}
             </select>
           </div>
           <div className="space-y-1.5">
             <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ชื่อผู้ยืม (นักเรียน/ครู)</label>
             <input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" required value={borrowForm.borrower_name} onChange={e => setBorrowForm({...borrowForm, borrower_name: e.target.value})} />
           </div>
           <div className="space-y-1.5">
             <label className="text-[10px] font-black text-slate-400 uppercase ml-1">กำหนดส่งคืน</label>
             <input type="date" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" required value={borrowForm.return_date} onChange={e => setBorrowForm({...borrowForm, return_date: e.target.value})} />
           </div>
           <button type="submit" disabled={isSaving || !borrowForm.book_id} className="w-full bg-slate-800 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2">
             {isSaving ? <Loader2 className="animate-spin" /> : <ArrowRightLeft />} ยืนยันการยืม
           </button>
        </form>
      </Modal>

      <Modal isOpen={isLogModalOpen} onClose={() => setIsUsageLogModalOpen(false)} title="บันทึกการเข้าใช้ห้องสมุด">
        <form onSubmit={handleLogUsage} className="space-y-4">
           <div className="space-y-1.5">
             <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ชื่อ-นามสกุล</label>
             <input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" required value={usageForm.name} onChange={e => setUsageLogForm({...usageForm, name: e.target.value})} />
           </div>
           <div className="space-y-1.5">
             <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ระดับชั้น</label>
             <select className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" value={usageForm.level} onChange={e => setUsageLogForm({...usageForm, level: e.target.value})}>
                {['อ.1','อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6','ม.1','ม.2','ม.3','ครู/บุคลากร'].map(l => <option key={l}>{l}</option>)}
             </select>
           </div>
           <div className="space-y-1.5">
             <label className="text-[10px] font-black text-slate-400 uppercase ml-1">วัตถุประสงค์</label>
             <input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" required value={usageForm.purpose} onChange={e => setUsageLogForm({...usageForm, purpose: e.target.value})} />
           </div>
           <button type="submit" disabled={isSaving} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl shadow-blue-100">
             {isSaving ? <Loader2 className="animate-spin" /> : <Save />} บันทึกข้อมูล
           </button>
        </form>
      </Modal>
    </div>
  );
}
