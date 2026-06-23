import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import { 
  Users as UsersIcon, 
  Shield, 
  UserCircle, 
  Search, 
  Loader2, 
  CheckCircle2,
  ChevronDown,
  UserCheck,
  UserX,
  RefreshCw,
  Clock,
  FileDown,
  PieChart,
  Save,
  GraduationCap,
  Wallet,
  Gamepad2
} from 'lucide-react';

export default function UsersManagement() {
  const { profile: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [selectedUserForPerm, setSelectedUserForPerm] = useState<any>(null);

  const MODULE_PERMISSIONS = [
    { key: 'access_administrative', label: 'งานสารบรรณ (รับ-ส่ง/คำสั่ง)', icon: <FileDown size={18} /> },
    { key: 'access_hr', label: 'งานบุคคล (จัดการครู/WFH)', icon: <UserCheck size={18} /> },
    { key: 'access_student_affairs', label: 'งานทะเบียน (ข้อมูลนักเรียน/รายงานเวลาเรียน)', icon: <UsersIcon size={18} /> },
    { key: 'access_reports', label: 'งานรายงานและสถิติ (รายงานวิเคราะห์/LEC)', icon: <PieChart size={18} /> },
    { key: 'access_academic', label: 'งานวิชาการ (ระบบวิชาการ/ห้องสมุด)', icon: <GraduationCap size={18} /> },
    { key: 'access_finance', label: 'งานงบประมาณ (การเงิน/พัสดุ/สาธารณูปโภค/เรียนฟรี)', icon: <Wallet size={18} /> },
    { key: 'access_athletics', label: 'งานลงทะเบียนนักกีฬา (บันทึกข้อมูล/พิมพ์การ์ด)', icon: <Gamepad2 size={18} /> },
  ];

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const { data: profilesData, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (pError) throw pError;

      const { data: teachersData } = await supabase
        .from('teachers')
        .select('email, prefix, first_name, last_name');

      const enrichedUsers = (profilesData || []).map(profile => {
        const teacherMatch = (teachersData || []).find(t => t.email?.toLowerCase() === profile.email?.toLowerCase());
        return { 
          ...profile, 
          official_info: teacherMatch || null,
          extra_permissions: profile.extra_permissions || {} 
        };
      });

      setUsers(enrichedUsers);
    } catch (err: any) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }

  async function updateExtraPermissions(userId: string, perms: any) {
    setIsSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ extra_permissions: perms })
      .eq('id', userId);

    if (!error) {
      setUsers(users.map(u => u.id === userId ? { ...u, extra_permissions: perms } : u));
      setIsPermModalOpen(false);
    } else {
      alert('ไม่สามารถอัปเดตสิทธิ์พิเศษได้: ' + error.message);
    }
    setIsSaving(false);
  }

  const togglePermission = (key: string) => {
    if (!selectedUserForPerm) return;
    const currentPerms = { ...selectedUserForPerm.extra_permissions };
    currentPerms[key] = !currentPerms[key];
    setSelectedUserForPerm({ ...selectedUserForPerm, extra_permissions: currentPerms });
  };

  async function updateRole(userId: string, newRole: string) {
    setUpdatingId(userId);
    
    // ถ้าเปลี่ยนจาก guest ไปเป็น role อื่น ต้องเปลี่ยน status เป็น active ด้วย
    const currentUser = users.find(u => u.id === userId);
    const shouldActivate = currentUser?.role === 'guest' && newRole !== 'guest';
    
    const updateData: any = { role: newRole };
    if (shouldActivate) {
      updateData.status = 'active';
    }
    
    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (!error) {
      setUsers(users.map(u => u.id === userId ? { ...u, ...updateData } : u));
      if (shouldActivate) {
        alert(`✅ อนุมัติสิทธิ์สำเร็จ! เปลี่ยนเป็น "${newRole}" และเปิดใช้งานบัญชีแล้วค่ะ`);
      }
    } else {
      alert('ไม่สามารถอัปเดตสิทธิ์ได้: ' + error.message);
    }
    setUpdatingId(null);
  }

  async function updateStatus(userId: string, status: string) {
    setUpdatingId(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ status })
      .eq('id', userId);

    if (!error) {
      setUsers(users.map(u => u.id === userId ? { ...u, status } : u));
    }
    setUpdatingId(null);
  }

  const filteredUsers = users.filter(u => 
    u.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin': return <span className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase flex items-center gap-1 border border-red-100"><Shield size={10} /> Administrator</span>;
      case 'director': return <span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-full text-[10px] font-black uppercase flex items-center gap-1 border border-purple-100"><UserCheck size={10} /> Director</span>;
      case 'teacher': return <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase flex items-center gap-1 border border-blue-100"><UserCircle size={10} /> Teacher</span>;
      default: return <span className="px-3 py-1 bg-slate-50 text-slate-400 rounded-full text-[10px] font-black uppercase flex items-center gap-1 border border-slate-100"><Clock size={10} /> Guest (Pending)</span>;
    }
  };

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[40px] border border-slate-100 shadow-sm">
        <Shield className="text-red-200 mb-4" size={64} />
        <h3 className="text-xl font-black text-slate-800">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</h3>
        <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mt-1">เฉพาะผู้ดูแลระบบเท่านั้น</p>
      </div>
    );
  }

  const stats = {
    total: users.length,
    pending: users.filter(u => u.role === 'guest').length,
    active: users.filter(u => u.status === 'active').length
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <Shield size={32} className="text-brand-primary" />
            จัดการสิทธิ์ผู้ใช้งาน
          </h2>
          <p className="text-slate-400 font-bold mt-1 uppercase tracking-widest text-xs">User Role & Access Management</p>
        </div>
        <button 
          onClick={() => fetchUsers()} 
          className="p-4 bg-white text-slate-500 rounded-2xl hover:bg-slate-50 transition-all border border-slate-100 shadow-sm"
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="ผู้ใช้งานทั้งหมด" value={stats.total} icon={<UsersIcon size={24} />} color="bg-blue-500" />
        <StatCard label="รออนุมัติสิทธิ์" value={stats.pending} icon={<Clock size={24} />} color="bg-amber-500" pulse={stats.pending > 0} />
        <StatCard label="บัญชีใช้งานปกติ" value={stats.active} icon={<CheckCircle2 size={24} />} color="bg-green-500" />
      </div>

      <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
          <input 
            type="text" 
            placeholder="ค้นหาตามชื่อ หรืออีเมลผู้ใช้งาน..." 
            className="w-full pl-12 pr-4 py-4.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="text-left py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ข้อมูลผู้ใช้งาน</th>
                <th className="text-left py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ระดับสิทธิ์ปัจจุบัน</th>
                <th className="text-left py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ปรับระดับสิทธิ์</th>
                <th className="text-center py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">สถานะ / การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={4} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-brand-primary" size={32} /></td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={4} className="py-20 text-center text-slate-400 font-bold italic">ไม่พบข้อมูลผู้ใช้งานที่ค้นหา</td></tr>
              ) : filteredUsers.map(user => (
                <tr key={user.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="py-5 px-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-2xl border border-slate-100 flex items-center justify-center text-slate-300 shadow-xs overflow-hidden">
                        <UserCircle size={28} />
                      </div>
                      <div>
                        <p className="font-black text-slate-800 leading-none">
                          {user.official_info 
                            ? `${user.official_info.prefix}${user.official_info.first_name} ${user.official_info.last_name}`
                            : (user.display_name || 'ไม่ได้ระบุชื่อ')}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs font-bold text-slate-400">{user.email}</p>
                          {user.official_info && (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded text-[8px] font-black uppercase border border-blue-100">Staff</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-5 px-4">{getRoleBadge(user.role)}</td>
                  <td className="py-5 px-4">
                    <div className="relative w-48">
                       <select 
                        disabled={updatingId === user.id}
                        className="w-full pl-3 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-600 appearance-none focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary outline-hidden cursor-pointer disabled:opacity-50"
                        value={user.role}
                        onChange={(e) => updateRole(user.id, e.target.value)}
                       >
                        <option value="guest">Guest (รออนุมัติ)</option>
                        <option value="teacher">Teacher (ครู)</option>
                        <option value="director">Director (ผอ.)</option>
                        <option value="admin">Administrator</option>
                       </select>
                       <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    </div>
                  </td>
                  <td className="py-5 px-4">
                    <div className="flex items-center justify-center gap-2">
                       {user.status === 'active' ? (
                         <button 
                          onClick={() => updateStatus(user.id, 'inactive')}
                          className="px-4 py-2 bg-green-50 text-green-600 border border-green-100 rounded-xl text-[10px] font-black uppercase hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all flex items-center gap-2"
                         >
                            <UserCheck size={14} /> ปกติ
                         </button>
                       ) : (
                         <button 
                          onClick={() => updateStatus(user.id, 'active')}
                          className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[10px] font-black uppercase hover:bg-green-50 hover:text-green-600 hover:border-green-100 transition-all flex items-center gap-2"
                         >
                            <UserX size={14} /> ระงับ
                         </button>
                       )}
                       
                       {user.role === 'guest' && (
                         <button 
                          onClick={() => updateRole(user.id, 'teacher')}
                          className="px-4 py-2 bg-brand-primary text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-green-100 hover:bg-green-700 transition-all animate-pulse"
                         >
                           อนุมัติเป็นครู
                         </button>
                       )}

                       <button 
                        onClick={() => { setSelectedUserForPerm(JSON.parse(JSON.stringify(user))); setIsPermModalOpen(true); }}
                        className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"
                        title="ปรับสิทธิ์รายบุคคล"
                       >
                         <Shield size={16} />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Granular Permissions */}
      <Modal 
        isOpen={isPermModalOpen} 
        onClose={() => setIsPermModalOpen(false)} 
        title={`ปรับสิทธิ์เฉพาะบุคคล: ${selectedUserForPerm?.display_name}`}
      >
        <div className="space-y-6">
          <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
            <p className="text-xs font-bold text-blue-700 leading-relaxed">
              การเลือกสิทธิ์เหล่านี้จะอนุญาตให้ผู้ใช้เข้าถึงเมนูพิเศษเพิ่มเติมจากระดับสิทธิ์ปกติ (Role) 
              โดยไม่มีผลต่อสิทธิ์การลบข้อมูล
            </p>
          </div>

          <div className="space-y-3">
            {MODULE_PERMISSIONS.map((module) => (
              <div 
                key={module.key} 
                onClick={() => togglePermission(module.key)}
                className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  selectedUserForPerm?.extra_permissions?.[module.key] 
                    ? 'border-brand-primary bg-green-50 shadow-sm' 
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    selectedUserForPerm?.extra_permissions?.[module.key] ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {module.icon}
                  </div>
                  <span className="font-black text-slate-700 text-sm">{module.label}</span>
                </div>
                <input 
                  type="checkbox" 
                  className="w-5 h-5 accent-brand-primary rounded-lg pointer-events-none"
                  checked={!!selectedUserForPerm?.extra_permissions?.[module.key]}
                  readOnly
                />
              </div>
            ))}
          </div>

          <button 
            onClick={() => updateExtraPermissions(selectedUserForPerm.id, selectedUserForPerm.extra_permissions)}
            disabled={isSaving}
            className="w-full py-4.5 bg-slate-800 text-white rounded-[24px] font-black text-lg flex items-center justify-center gap-3 shadow-xl hover:bg-slate-900 transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="animate-spin" /> : <Save />} บันทึกสิทธิ์พิเศษ
          </button>
        </div>
      </Modal>
    </div>
  );
}

function StatCard({ label, value, icon, color, pulse = false }: any) {
  return (
    <div className={`bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4 ${pulse ? 'ring-2 ring-amber-400 ring-offset-2' : ''}`}>
      <div className={`w-14 h-14 ${color} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-black text-slate-800">{value}</p>
      </div>
    </div>
  );
}
