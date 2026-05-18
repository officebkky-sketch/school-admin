import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import IncomingDocs from './pages/IncomingDocs';
import OutgoingDocs from './pages/OutgoingDocs';
import Orders from './pages/Orders';
import Memos from './pages/Memos';
import Students from './pages/Students';
import Teachers from './pages/Teachers';
import TaskManagement from './pages/TaskManagement';
import Attendance from './pages/Attendance';
import AttendanceReport from './pages/AttendanceReport';
import LibraryModule from './pages/Library';
import WFHModule from './pages/WFH';
import LECReports from './pages/LECReports';
import Reports from './pages/Reports';
import CustomStudentPrint from './pages/CustomStudentPrint';
import SettingsPage from './pages/Settings';
import UsersManagement from './pages/Users';
import ProfilePage from './pages/Profile';
import Dashboard from './pages/Dashboard';
import Academic from './pages/Academic';
import Finance from './pages/Finance';
import FreeEducation from './pages/FreeEducation';
import Utilities from './pages/Utilities';
import AICowork from './pages/AICowork';

import { 
  Loader2, 
  LayoutDashboard, 
  Users, 
  Clock, 
  Library, 
  Settings as SettingsIcon, 
  LogOut, 
  Book, 
  MessageSquare,
  ChevronRight,
  PieChart,
  Printer,
  UserCheck,
  ClipboardList,
  ShieldCheck,
  UserCircle,
  GraduationCap,
  Wallet,
  BarChart3,
  FileDown,
  FileUp,
  User,
  Bot,
  Coins,
  Droplets
} from 'lucide-react';


type Tab = 'dashboard' | 'incoming' | 'outgoing' | 'orders' | 'memos' | 'students' | 'teachers' | 'tasks' | 'attendance' | 'attendance_report' | 'library' | 'wfh' | 'settings' | 'lec' | 'custom_print' | 'users' | 'academic' | 'finance' | 'reports' | 'profile' | 'ai_cowork' | 'free_education' | 'utilities';

function App() {
  const { user, profile, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [schoolName, setSchoolName] = useState('โรงเรียนบ้านควนโคกยา');

  useEffect(() => {
    async function fetchSchoolName() {
      try {
        const { data } = await supabase.from('settings').select('school_name').single();
        if (data?.school_name) setSchoolName(data.school_name);
      } catch (err) {
        console.error('Error fetching school name:', err);
      }
    }
    fetchSchoolName();
  }, []);

  const isAdmin = profile?.role === 'admin';
  const isDirector = profile?.role === 'director' || isAdmin;
  const isTeacher = profile?.role === 'teacher';
  const isGuest = profile?.role === 'guest' || !profile?.role;

  useEffect(() => {
    if (isGuest && activeTab !== 'dashboard') {
      setActiveTab('dashboard');
    }
  }, [isGuest, activeTab]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-brand-primary" size={48} /></div>;
  if (!user) return <Login />;

  const extraPerms = profile?.extra_permissions || {};
  const canAccessRegistration = !isGuest && (!isTeacher || extraPerms.access_administrative);
  const canAccessStaff = !isGuest && (!isTeacher || extraPerms.access_hr);
  const canAccessReports = !isGuest && (isDirector || extraPerms.access_reports);

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen overflow-y-auto scrollbar-hide shrink-0 shadow-sm">
        <div className="p-6 border-b border-slate-50 flex items-center gap-3 bg-white">
          <img src="logo.png" alt="School Logo" className="w-12 h-12 object-contain" />
          <div>
            <h1 className="font-black text-slate-800 text-xs tracking-tighter">{schoolName}</h1>
            <p className="text-[9px] text-brand-primary font-black uppercase tracking-widest">ระบบบริหารจัดการข้อมูลโรงเรียน</p>
          </div>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-1">
          <SidebarItem icon={<LayoutDashboard size={20} />} label="แดชบอร์ด" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          
          {!isGuest && (
            <>
              <SidebarItem icon={<User size={20} />} label="ข้อมูลส่วนตัว" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
              {canAccessReports && <SidebarItem icon={<BarChart3 size={20} />} label="ระบบรายงานอัจฉริยะ" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />}

              <div className="py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mt-4 text-[9px]">งานสารบรรณ</div>
              {canAccessRegistration && <SidebarItem icon={<FileDown size={20} />} label="หนังสือรับ" active={activeTab === 'incoming'} onClick={() => setActiveTab('incoming')} />}
              {canAccessRegistration && <SidebarItem icon={<FileUp size={20} />} label="หนังสือส่ง" active={activeTab === 'outgoing'} onClick={() => setActiveTab('outgoing')} />}
              {isDirector && <SidebarItem icon={<Book size={20} />} label="คำสั่ง" active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} />}
              <SidebarItem icon={<MessageSquare size={20} />} label="บันทึกข้อความ" active={activeTab === 'memos'} onClick={() => setActiveTab('memos')} />
              <SidebarItem icon={<ClipboardList size={20} />} label="ติดตามงาน/สั่งการ" active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} />

              <div className="py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mt-4 text-[9px]">นวัตกรรม AI</div>
              <SidebarItem icon={<Bot size={20} />} label="AI Cowork" active={activeTab === 'ai_cowork'} onClick={() => setActiveTab('ai_cowork')} />

              <div className="py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mt-4 text-[9px]">งานวิชาการ</div>

              <SidebarItem icon={<GraduationCap size={20} />} label="ระบบวิชาการ" active={activeTab === 'academic'} onClick={() => setActiveTab('academic')} />
              <SidebarItem icon={<Library size={20} />} label="ระบบห้องสมุด" active={activeTab === 'library'} onClick={() => setActiveTab('library')} />

              <div className="py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mt-4 text-[9px]">งานงบประมาณ</div>
              <SidebarItem icon={<Wallet size={20} />} label="การเงิน/พัสดุ" active={activeTab === 'finance'} onClick={() => setActiveTab('finance')} />
              <SidebarItem icon={<Droplets size={20} />} label="เบิกค่าสาธารณูปโภค" active={activeTab === 'utilities'} onClick={() => setActiveTab('utilities')} />
              <SidebarItem icon={<Coins size={20} />} label="จ่ายเงินเรียนฟรี" active={activeTab === 'free_education'} onClick={() => setActiveTab('free_education')} />

              <div className="py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mt-4 text-[9px]">งานบุคคล</div>
              {canAccessStaff && <SidebarItem icon={<UserCheck size={20} />} label="จัดการข้อมูลครู" active={activeTab === 'teachers'} onClick={() => setActiveTab('teachers')} />}
              <SidebarItem icon={<Clock size={20} />} label="ลงเวลาปฏิบัติงาน" active={activeTab === 'wfh'} onClick={() => setActiveTab('wfh')} />

              <div className="py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mt-4 text-[9px]">งานบริหารทั่วไป</div>
              <SidebarItem icon={<Users size={20} />} label="ข้อมูลนักเรียน" active={activeTab === 'students'} onClick={() => setActiveTab('students')} />
              {isDirector && <SidebarItem icon={<Printer size={20} />} label="พิมพ์รายชื่อ" active={activeTab === 'custom_print'} onClick={() => setActiveTab('custom_print')} />}
              {isDirector && <SidebarItem icon={<PieChart size={20} />} label="รายงาน LEC" active={activeTab === 'lec'} onClick={() => setActiveTab('lec')} />}
              <SidebarItem icon={<Clock size={20} />} label="บันทึกเวลาเรียน" active={activeTab === 'attendance'} onClick={() => setActiveTab('attendance')} />
              <SidebarItem icon={<BarChart3 size={20} />} label="รายงานเวลาเรียน" active={activeTab === 'attendance_report'} onClick={() => setActiveTab('attendance_report')} />
              
              {isAdmin && (
                <>
                  <div className="py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mt-4 text-[9px]">ตั้งค่าและความปลอดภัย</div>
                  <SidebarItem icon={<ShieldCheck size={20} />} label="จัดการสิทธิ์" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
                  <SidebarItem icon={<SettingsIcon size={20} />} label="ตั้งค่าระบบ" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
                </>
              )}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100 bg-white">
          <button onClick={() => signOut()} className="flex items-center gap-3 w-full px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-all font-bold text-sm">
            <LogOut size={20} /> ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 shadow-xs">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 uppercase tracking-tight">
            {activeTab === 'dashboard' && 'แดชบอร์ด'}
            {activeTab === 'profile' && 'ข้อมูลส่วนตัวและลายเซ็น'}
            {activeTab === 'reports' && 'ระบบรายงานอัจฉริยะ'}
            {activeTab === 'incoming' && 'หนังสือรับ'}
            {activeTab === 'outgoing' && 'หนังสือส่ง'}
            {activeTab === 'orders' && 'คำสั่ง'}
            {activeTab === 'memos' && 'บันทึกข้อความ'}
            {activeTab === 'students' && 'ข้อมูลนักเรียน'}
            {activeTab === 'teachers' && 'จัดการข้อมูลครู (งานบุคคล)'}
            {activeTab === 'tasks' && 'ระบบติดตามงาน (งานสารบรรณ)'}
            {activeTab === 'custom_print' && 'พิมพ์รายชื่อ (บริหารทั่วไป)'}
            {activeTab === 'lec' && 'รายงาน LEC (บริหารทั่วไป)'}
            {activeTab === 'attendance' && 'บันทึกเวลาเรียน (บริหารทั่วไป)'}
            {activeTab === 'attendance_report' && 'รายงานเวลาเรียน (บริหารทั่วไป)'}
            {activeTab === 'library' && 'ระบบห้องสมุด (วิชาการ)'}
            {activeTab === 'wfh' && 'ลงเวลาปฏิบัติงาน (งานบุคคล)'}
            {activeTab === 'settings' && 'ตั้งค่าระบบ'}
            {activeTab === 'users' && 'จัดการสิทธิ์ผู้ใช้งาน'}
            {activeTab === 'academic' && 'งานวิชาการ'}
            {activeTab === 'finance' && 'งานงบประมาณ (การเงิน/พัสดุ)'}
            {activeTab === 'utilities' && 'ระบบเบิกค่าสาธารณูปโภค'}
            {activeTab === 'free_education' && 'ระบบจ่ายเงินเรียนฟรี (๑๕ ปี)'}
            {activeTab === 'ai_cowork' && 'AI Cowork'}
          </h2>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-800 leading-none">{profile?.display_name || user.email}</p>
              <p className="text-[10px] font-bold text-brand-primary uppercase mt-1">
                {profile?.role === 'admin' && 'Administrator'}
                {profile?.role === 'director' && 'Director (ผอ.)'}
                {profile?.role === 'teacher' && 'Teacher (ครู)'}
                {profile?.role === 'guest' && 'Guest (รออนุมัติ)'}
                {!profile?.role && 'User'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 shadow-inner overflow-hidden">
              <UserCircle size={32} />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'profile' && <ProfilePage />}
            {activeTab === 'reports' && <Reports />}
            {activeTab === 'incoming' && <IncomingDocs />}
            {activeTab === 'outgoing' && <OutgoingDocs />}
            {activeTab === 'orders' && <Orders />}
            {activeTab === 'memos' && <Memos />}
            {activeTab === 'students' && <Students />}
            {activeTab === 'teachers' && <Teachers />}
            {activeTab === 'tasks' && <TaskManagement />}
            {activeTab === 'custom_print' && <CustomStudentPrint />}
            {activeTab === 'lec' && <LECReports />}
            {activeTab === 'attendance' && <Attendance />}
            {activeTab === 'attendance_report' && <AttendanceReport />}
            {activeTab === 'library' && <LibraryModule />}
            {activeTab === 'wfh' && <WFHModule />}
            {activeTab === 'settings' && <SettingsPage />}
            {activeTab === 'users' && <UsersManagement />}
            {activeTab === 'academic' && <Academic />}
            {activeTab === 'finance' && <Finance />}
            {activeTab === 'utilities' && <Utilities />}
            {activeTab === 'free_education' && <FreeEducation />}
            {activeTab === 'ai_cowork' && <AICowork />}
          </div>
        </div>
      </main>
    </div>
  );
}


interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function SidebarItem({ icon, label, active, onClick }: SidebarItemProps) {
  return (
    <button onClick={onClick} className={`flex items-center justify-between w-full px-4 py-3.5 rounded-2xl transition-all group ${active ? 'bg-brand-primary text-white shadow-lg shadow-green-100 scale-[1.02]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
      <div className="flex items-center gap-3">
        <span className={active ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}>{icon}</span>
        <span className="text-sm font-bold">{label}</span>
      </div>
      {active && <ChevronRight size={14} />}
    </button>
  );
}

export default App;
