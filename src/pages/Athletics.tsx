import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { uploadFile } from '../lib/storage';
import { 
  Trophy, 
  Search, 
  Plus, 
  Trash2, 
  Printer, 
  Loader2, 
  UserPlus, 
  Phone, 
  User, 
  Award, 
  CheckCircle,
  FileText,
  UserCheck,
  ChevronDown,
  RefreshCw,
  Info,
  Edit2,
  Upload,
  Camera,
  X,
  Save,
  ShieldCheck
} from 'lucide-react';

const dataURLtoFile = (dataurl: string, filename: string) => {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

interface Student {
  id: string;
  student_id: string;
  prefix: string;
  first_name: string;
  last_name: string;
  academic_year: string;
  gender: string;
  birth_date: string;
  class_level: string;
  room: string;
  weight: number;
  height: number;
  photo_url: string;
  national_id: string;
}

interface Registration {
  id: string;
  student_id: string;
  academic_year: string;
  prefix: string;
  first_name: string;
  last_name: string;
  gender: string;
  birth_date: string;
  class_level: string;
  room: string;
  weight: number;
  height: number;
  photo_url: string;
  citizen_id: string;
  sport_id: string;
  sport_type: string;
  age_group: string;
  shirt_size: string;
  coach_name: string;
  coach_phone: string;
  is_substitute: boolean;
  competition_type?: string;
  created_at: string;
}

const toThaiNumerals = (num: number | string) => {
  const digits = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
  return num.toString().replace(/\d/g, (d) => digits[parseInt(d)]);
};

export default function Athletics() {
  const { profile } = useAuth();
  
  // Navigation tabs within module
  const [activeSubTab, setActiveSubTab] = useState<'register' | 'reports' | 'provincial'>('register');

  // Year & Search States
  const [academicYears, setAcademicYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const compYearVal = parseInt(selectedYear, 10) || 2569;
  const compEditionVal = compYearVal - 2492;
  const compYearThai = toThaiNumerals(compYearVal);
  const compEditionThai = toThaiNumerals(compEditionVal);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchingStudents, setSearchingStudents] = useState(false);

  // Edit Mode States
  const [editingRegId, setEditingRegId] = useState<string | null>(null);

  // Form States (Registration)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [sportId, setSportId] = useState(''); // รหัสหน่วยกีฬา
  const [citizenId, setCitizenId] = useState(''); // เลขบัตรประชาชน
  const [sportType, setSportType] = useState('');
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [customSportType, setCustomSportType] = useState(''); // กรณีกีฬาอื่นๆ
  const [ageGroup, setAgeGroup] = useState('');
  const [customAgeGroup, setCustomAgeGroup] = useState(''); // กรณีรุ่นอายุอื่นๆ
  const [shirtSize, setShirtSize] = useState('M');
  const [coachName, setCoachName] = useState('');
  const [coachPhone, setCoachPhone] = useState('');
  const [isSubstitute, setIsSubstitute] = useState(false);
  const [coachFromTeacher, setCoachFromTeacher] = useState('');
  const [teachersList, setTeachersList] = useState<{id: string; prefix: string; first_name: string; last_name: string; position: string; phone: string}[]>([]);

  // Custom Events Settings
  const [showEventSettings, setShowEventSettings] = useState(false);
  const [customEvents, setCustomEvents] = useState<Record<string, string[]>>({});
  const [newEventName, setNewEventName] = useState('');
  const [newEventAgeGroup, setNewEventAgeGroup] = useState('12');
  
  // Photo Upload States
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [quickPhotoReg, setQuickPhotoReg] = useState<Registration | null>(null);
  const [quickPhotoFile, setQuickPhotoFile] = useState<File | null>(null);
  const [quickPhotoPreview, setQuickPhotoPreview] = useState<string | null>(null);
  
  const [submitting, setSubmitting] = useState(false);

  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 640, facingMode: 'user' }
      });
      setCameraStream(stream);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error('Error accessing camera:', err);
      alert('ไม่สามารถเข้าถึงกล้องถ่ายรูปได้ค่ะ กรุณาตรวจสอบสิทธิ์การเข้าใช้งานกล้องในเบราว์เซอร์ของคุณ');
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        
        try {
          const file = dataURLtoFile(dataUrl, `captured_athlete_${Date.now()}.jpg`);
          if (quickPhotoReg) {
            setQuickPhotoPreview(dataUrl);
            setQuickPhotoFile(file);
          } else {
            setPhotoPreview(dataUrl);
            setPhotoFile(file);
          }
        } catch (e) {
          console.error('Error creating file from base64:', e);
          if (quickPhotoReg) {
            setQuickPhotoPreview(dataUrl);
          } else {
            setPhotoPreview(dataUrl);
          }
        }
      }
      stopCamera();
    }
  };

  // Registration List & Filters
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [filterSport, setFilterSport] = useState('all');
  const [filterAge, setFilterAge] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Image load error cache
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  // Image aspect ratio cache ('portrait' or 'landscape')
  const [imageAspects, setImageAspects] = useState<Record<string, 'portrait' | 'landscape'>>({});

  const handleImageLoad = (id: string, e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    const isLandscape = naturalWidth > naturalHeight;
    setImageAspects(prev => ({
      ...prev,
      [id]: isLandscape ? 'landscape' : 'portrait'
    }));
  };

  // Coach Suggestion cache
  const [coachCache, setCoachCache] = useState<Record<string, { name: string; phone: string }>>({});
  
  // Official Reports States (A1, A2, A3)
  const [reportTeamName, setReportTeamName] = useState('');
  const [reportUnitCode, setReportUnitCode] = useState('002');
  const [reportManagerName, setReportManagerName] = useState('');
  const [reportManagerPhone, setReportManagerPhone] = useState('');
  const [reportAgeGroup, setReportAgeGroup] = useState('12'); // ชนิดช่วงอายุ 8, 10, 12
  const [reportGender, setReportGender] = useState<'male' | 'female'>('male');
  const [selectedReportType, setSelectedReportType] = useState<'A1' | 'A2' | 'A3' | 'CERT' | 'PETANQUE' | 'PETANQUE_MIXED'>('A1');

  // ระดับการแข่งขันเปตอง ('local' = อบต. / 'provincial' = จังหวัด)
  const [petanqueCompType, setPetanqueCompType] = useState<'local' | 'provincial'>('provincial');

  // Provincial (จังหวัด) Petanque Team States (4 players per team: player1, player2, player3, substitute)
  const [petanqueTeam1, setPetanqueTeam1] = useState<string[]>(['', '', '', '']);
  const [petanqueTeam2, setPetanqueTeam2] = useState<string[]>(['', '', '', '']);
  // Overwritten photos for petanque athletes (Base64) - index 0-3 for Team 1, index 4-7 for Team 2
  const [petanqueTeamPhotos, setPetanqueTeamPhotos] = useState<string[]>(Array(8).fill(''));

  const handlePetanquePhotoChange = (globalIdx: number, file: File | null) => {
    if (!file) {
      setPetanqueTeamPhotos(prev => {
        const next = [...prev];
        next[globalIdx] = '';
        return next;
      });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setPetanqueTeamPhotos(prev => {
        const next = [...prev];
        next[globalIdx] = base64String;
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  // Provincial (จังหวัด) Mixed Petanque Team States (Upper block = Male, Lower block = Female)
  const [petanqueMixedTeamMale, setPetanqueMixedTeamMale] = useState<string[]>(['', '', '', '']);
  const [petanqueMixedTeamFemale, setPetanqueMixedTeamFemale] = useState<string[]>(['', '', '', '']);
  const [petanqueMixedPhotos, setPetanqueMixedPhotos] = useState<string[]>(Array(8).fill(''));

  const handlePetanqueMixedPhotoChange = (globalIdx: number, file: File | null) => {
    if (!file) {
      setPetanqueMixedPhotos(prev => {
        const next = [...prev];
        next[globalIdx] = '';
        return next;
      });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setPetanqueMixedPhotos(prev => {
        const next = [...prev];
        next[globalIdx] = base64String;
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  // Local (อบต.) Petanque Team States
  const [petanqueTeam1Local, setPetanqueTeam1Local] = useState<string[]>(['', '', '', '']);
  const [petanqueTeam2Local, setPetanqueTeam2Local] = useState<string[]>(['', '', '', '']);
  const [petanqueTeamPhotosLocal, setPetanqueTeamPhotosLocal] = useState<string[]>(Array(8).fill(''));

  const handlePetanquePhotoChangeLocal = (globalIdx: number, file: File | null) => {
    if (!file) {
      setPetanqueTeamPhotosLocal(prev => {
        const next = [...prev];
        next[globalIdx] = '';
        return next;
      });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setPetanqueTeamPhotosLocal(prev => {
        const next = [...prev];
        next[globalIdx] = base64String;
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  // Local (อบต.) Mixed Petanque Team States
  const [petanqueMixedTeamMaleLocal, setPetanqueMixedTeamMaleLocal] = useState<string[]>(['', '', '', '']);
  const [petanqueMixedTeamFemaleLocal, setPetanqueMixedTeamFemaleLocal] = useState<string[]>(['', '', '', '']);
  const [petanqueMixedPhotosLocal, setPetanqueMixedPhotosLocal] = useState<string[]>(Array(8).fill(''));

  const handlePetanqueMixedPhotoChangeLocal = (globalIdx: number, file: File | null) => {
    if (!file) {
      setPetanqueMixedPhotosLocal(prev => {
        const next = [...prev];
        next[globalIdx] = '';
        return next;
      });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setPetanqueMixedPhotosLocal(prev => {
        const next = [...prev];
        next[globalIdx] = base64String;
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  // Print States
  const [printQueue, setPrintQueue] = useState<Registration[]>([]);
  const [printType, setPrintType] = useState<'cards' | 'A1' | 'A2' | 'A3' | 'CERT' | 'PETANQUE' | 'PETANQUE_MIXED'>('cards');

  // Certificate (หนังสือรับรอง) States
  const [certSportName, setCertSportName] = useState('ฟุตบอล');
  const [certSelectedRegs, setCertSelectedRegs] = useState<string[]>([]);

  // Provincial Competition States (กีฬาจังหวัดพัทลุง)
  const PROVINCIAL_SPORTS = ['ฟุตบอล', 'ฟุตซอล', 'วอลเลย์บอลในร่ม', 'วอลเลย์บอลชายหาด', 'เปตอง'] as const;
  const [provRegistrations, setProvRegistrations] = useState<Registration[]>([]);
  const [provLoadingRegs, setProvLoadingRegs] = useState(false);
  const [provSearchQuery, setProvSearchQuery] = useState('');
  const [provSearchResults, setProvSearchResults] = useState<Student[]>([]);
  const [provShowSuggestions, setProvShowSuggestions] = useState(false);
  const [provSearchingStudents, setProvSearchingStudents] = useState(false);
  const [provSelectedStudent, setProvSelectedStudent] = useState<Student | null>(null);
  const [provSportType, setProvSportType] = useState<string>('ฟุตบอล');
  const [provSubmitting, setProvSubmitting] = useState(false);
  const [provFilterSport, setProvFilterSport] = useState('all');
  const [provSearchTerm, setProvSearchTerm] = useState('');
  const [provCertSelectedRegs, setProvCertSelectedRegs] = useState<string[]>([]);
  const provSuggestionRef = useRef<HTMLDivElement>(null);
  const [isPrintMode, setIsPrintMode] = useState(false);

  const suggestionRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Options Definitions
  const SPORT_TYPES = [
    'วิ่ง 100 เมตร', 'วิ่ง 200 เมตร', 'วิ่ง 400 เมตร', 'วิ่ง 800 เมตร',
    'วิ่งผลัด 4x100 เมตร', 'วิ่งผลัด 4x400 เมตร', 'กระโดดไกล', 'เขย่งก้าวกระโดด',
    'ทุ่มน้ำหนัก', 'ขว้างจักร', 'ฟุตบอล', 'ฟุตซอล', 'แชร์บอล', 'วอลเลย์บอล',
    'วอลเลย์บอลชายหาด', 'เปตอง', 'เซปักตะกร้อ', 'เทเบิลเทนนิส', 'อื่นๆ'
  ];

  const AGE_GROUPS = [
    'รุ่นอายุไม่เกิน 6 ปี ชาย', 'รุ่นอายุไม่เกิน 6 ปี หญิง',
    'รุ่นอายุไม่เกิน 8 ปี ชาย', 'รุ่นอายุไม่เกิน 8 ปี หญิง',
    'รุ่นอายุไม่เกิน 10 ปี ชาย', 'รุ่นอายุไม่เกิน 10 ปี หญิง',
    'รุ่นอายุไม่เกิน 12 ปี ชาย', 'รุ่นอายุไม่เกิน 12 ปี หญิง',
    'รุ่นประชาชนทั่วไป ชาย', 'รุ่นประชาชนทั่วไป หญิง', 'อื่นๆ'
  ];

  const SHIRT_SIZES = ['JS', 'JM', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

  // แผนผังประเภทการแข่งขันตามรุ่นอายุ (ต้นแบบเขาชัยสน)
  const EVENT_MAP_DEFAULT: Record<string, string[]> = {
    '6': ['วิ่ง 50 เมตร', 'วิ่ง 60 เมตร', 'วิ่งผลัด 4x50 เมตร'],
    '8': ['วิ่ง 60 เมตร', 'วิ่ง 80 เมตร', 'วิ่งผลัด 4x50 เมตร'],
    '10': ['วิ่ง 60 เมตร', 'วิ่ง 80 เมตร', 'วิ่ง 100 เมตร', 'วิ่งผลัด 4x50 เมตร', 'วิ่งผลัด 4x100 เมตร', 'กระโดดไกล'],
    '12': ['วิ่ง 60 เมตร', 'วิ่ง 80 เมตร', 'วิ่ง 100 เมตร', 'วิ่ง 200 เมตร', 'วิ่งผลัด 4x50 เมตร', 'วิ่งผลัด 4x100 เมตร', 'กระโดดไกล', 'ทุ่มน้ำหนัก'],
    'other': ['ฟุตบอล', 'ฟุตซอล', 'แชร์บอล', 'วอลเลย์บอล', 'เปตอง', 'เซปักตะกร้อ', 'เทเบิลเทนนิส']
  };

  // ดึงชนิดกีฬาตามรุ่นอายุที่เลือก
  const getSportTypesForAge = (ageStr: string) => {
    // หาตัวเลขรุ่นอายุจาก string เช่น "รุ่นอายุไม่เกิน 12 ปี ชาย" => "12"
    const ageMatch = ageStr.match(/(\d+)/);
    const ageKey = ageMatch ? ageMatch[1] : '';
    
    const defaultEvents = EVENT_MAP_DEFAULT[ageKey] || [];
    const customEvts = customEvents[ageKey] || [];
    const otherSports = EVENT_MAP_DEFAULT['other'] || [];
    
    // รวมรายการจากค่าเริ่มต้น + รายการที่เพิ่มเอง + กีฬาอื่นๆ + อื่นๆ
    return [...new Set([...defaultEvents, ...customEvts, ...otherSports, 'อื่นๆ'])];
  };

  // เพิ่มรายการแข่งขันใหม่
  const addCustomEvent = () => {
    if (!newEventName.trim()) return;
    setCustomEvents(prev => {
      const existing = prev[newEventAgeGroup] || [];
      if (existing.includes(newEventName.trim())) {
        alert('รายการนี้มีอยู่แล้วค่ะ');
        return prev;
      }
      return { ...prev, [newEventAgeGroup]: [...existing, newEventName.trim()] };
    });
    setNewEventName('');
  };

  // ลบรายการแข่งขัน (เฉพาะที่เพิ่มเอง)
  const removeCustomEvent = (ageKey: string, eventName: string) => {
    setCustomEvents(prev => ({
      ...prev,
      [ageKey]: (prev[ageKey] || []).filter(e => e !== eventName)
    }));
  };

  // Close suggestions when click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch Academic Years from settings and students
  useEffect(() => {
    async function loadYears() {
      try {
        const { data: settingsData } = await supabase
          .from('settings')
          .select('current_academic_year, school_name, director_name, phone_number')
          .single();
        
        const defaultYear = settingsData?.current_academic_year || new Date().getFullYear() + 543 + '';
        
        if (settingsData) {
          setReportTeamName(settingsData.school_name || 'โรงเรียนบ้านควนโคกยา');
          setReportManagerName(settingsData.director_name || '');
          setReportManagerPhone(settingsData.phone_number || '');
        }

        const { data: studentsYears } = await supabase
          .from('students')
          .select('academic_year');
        
        const years = Array.from(new Set([
          defaultYear,
          ...(studentsYears?.map(y => y.academic_year).filter(Boolean) || [])
        ])).sort((a, b) => b.localeCompare(a));
        
        setAcademicYears(years);
        setSelectedYear(defaultYear);
      } catch (err) {
        console.error('Error loading academic years:', err);
      }
    }
    loadYears();
  }, []);

  // Fetch Registrations when selected year changes
  useEffect(() => {
    if (selectedYear) {
      fetchRegistrations();
      fetchProvincialRegistrations();
      fetchCoachHistory();
      fetchTeachers();
    }
  }, [selectedYear]);

  // Close provincial suggestions when click outside
  useEffect(() => {
    function handleClickOutsideProv(event: MouseEvent) {
      if (provSuggestionRef.current && !provSuggestionRef.current.contains(event.target as Node)) {
        setProvShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutsideProv);
    return () => document.removeEventListener('mousedown', handleClickOutsideProv);
  }, []);

  // Load suggest coaches
  async function fetchCoachHistory() {
    try {
      const { data, error } = await supabase
        .from('athletics_registrations')
        .select('sport_type, coach_name, coach_phone')
        .eq('academic_year', selectedYear)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const cache: Record<string, { name: string; phone: string }> = {};
        data.forEach(item => {
          if (item.sport_type && item.coach_name && !cache[item.sport_type]) {
            cache[item.sport_type] = {
              name: item.coach_name,
              phone: item.coach_phone || ''
            };
          }
        });
        setCoachCache(cache);
      }
    } catch (err) {
      console.error('Error loading coach history:', err);
    }
  }

  // Fetch teachers list for coach selection
  async function fetchTeachers() {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, prefix, first_name, last_name, position, phone')
        .eq('status', 'active')
        .order('first_name', { ascending: true });

      if (!error && data) {
        setTeachersList(data);
      }
    } catch (err) {
      console.error('Error loading teachers:', err);
    }
  }

  // Update coach name and phone when sport type changes
  useEffect(() => {
    const finalSport = sportType === 'อื่นๆ' ? customSportType : sportType;
    if (finalSport && coachCache[finalSport]) {
      setCoachName(coachCache[finalSport].name);
      setCoachPhone(coachCache[finalSport].phone);
    }
  }, [sportType, customSportType, coachCache]);

  // Search Students
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length >= 2 && !editingRegId) {
        searchStudents(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, selectedYear, editingRegId]);

  async function searchStudents(query: string) {
    setSearchingStudents(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('academic_year', selectedYear)
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,student_id.ilike.%${query}%`)
        .limit(8);

      if (error) throw error;
      setSearchResults(data || []);
      setShowSuggestions(true);
    } catch (err) {
      console.error('Error searching students:', err);
    } finally {
      setSearchingStudents(false);
    }
  }

  async function fetchRegistrations() {
    setLoadingRegs(true);
    try {
      const { data, error } = await supabase
        .from('athletics_registrations')
        .select('*')
        .eq('academic_year', selectedYear)
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Filter client-side: แสดงเฉพาะกรีฑาตำบล (competition_type = 'local' หรือไม่มีค่า)
      const localOnly = (data || []).filter((r: any) => !r.competition_type || r.competition_type === 'local');
      setRegistrations(localOnly);
      // เก็บ provincial ไว้ด้วย
      const provOnly = (data || []).filter((r: any) => r.competition_type === 'provincial');
      setProvRegistrations(provOnly);
      setBrokenImages({});
    } catch (err: any) {
      console.error('Error fetching registrations:', err);
      alert('ไม่สามารถโหลดข้อมูลการลงทะเบียนได้: ' + err.message);
    } finally {
      setLoadingRegs(false);
    }
  }

  async function fetchProvincialRegistrations() {
    // ดึงจาก fetchRegistrations แล้ว (เพื่อหลีกเลี่ยง query ซ้ำ)
    // ถ้ายังไม่มีข้อมูล ให้ fetchRegistrations ทำแล้ว
    if (registrations.length === 0 && provRegistrations.length === 0) {
      await fetchRegistrations();
    }
  }

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    setSearchQuery(`${student.prefix}${student.first_name} ${student.last_name}`);
    setCitizenId(student.national_id || ''); 
    
    const autoSportId = student.student_id ? student.student_id.slice(-3) : '';
    setSportId(autoSportId);
    
    setPhotoFile(null);
    setPhotoPreview(student.photo_url || null);

    // คำนวณรุ่นอายุอัตโนมัติจากวันเกิดนักเรียนและปีการศึกษาที่เลือก
    if (student.birth_date) {
      try {
        const parts = student.birth_date.split('-');
        const birthYear = parseInt(parts[0]);
        if (birthYear > 0) {
          // ปีการศึกษาปัจจุบัน (พ.ศ.) เช่น 2569
          const acadYear = parseInt(selectedYear) || (new Date().getFullYear() + 543);
          
          // แปลงปีเกิดของนักเรียนให้เป็น พ.ศ. เสมอ
          let birthYearTh = birthYear;
          if (birthYearTh < 2400) {
            birthYearTh += 543; // แปลง ค.ศ. เป็น พ.ศ.
          }
          
          const studentAge = acadYear - birthYearTh;
          
          // วิเคราะห์เพศเพื่อนำไปใส่ชื่อรุ่น
          const isMale = student.gender === 'male' || student.gender === 'ชาย' || student.gender === 'ช' || 
                         (student.prefix && (student.prefix.includes('เด็กชาย') || student.prefix.includes('นาย')));
          const genderText = isMale ? 'ชาย' : 'หญิง';
          
          // หารุ่นอายุที่เหมาะสม (ไม่เกิน 6 ปี, 8 ปี, 10 ปี, 12 ปี)
          let recommendedAge = 12;
          if (studentAge <= 6) {
            recommendedAge = 6;
          } else if (studentAge <= 8) {
            recommendedAge = 8;
          } else if (studentAge <= 10) {
            recommendedAge = 10;
          } else {
            recommendedAge = 12;
          }
          
          const autoAgeGroup = `รุ่นอายุไม่เกิน ${recommendedAge} ปี ${genderText}`;
          
          // ตรวจสอบและตั้งค่ารุ่นอายุในฟอร์มลงทะเบียนอัตโนมัติ
          if (AGE_GROUPS.includes(autoAgeGroup)) {
            setAgeGroup(autoAgeGroup);
          } else {
            // หากไม่ตรงกับมาตรฐาน ให้เคลียร์เพื่อให้ผู้ใช้เลือกเองหรือตั้งเป็นค่าว่างไว้
            setAgeGroup('');
          }
        }
      } catch (e) {
        console.error("Error calculating auto age group:", e);
      }
    }

    setShowSuggestions(false);
  };

  // Compress Photo and convert to Base64 (Reliably runs offline)
  const compressAndGetBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 500;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveQuickPhoto = async () => {
    if (!quickPhotoReg) return;
    if (!quickPhotoPreview && !quickPhotoFile) {
      alert('กรุณาเลือกรูปภาพหรือถ่ายภาพก่อนค่ะ');
      return;
    }
    
    setSubmitting(true);
    try {
      let finalPhotoUrl = quickPhotoPreview || '';
      
      if (quickPhotoFile) {
        try {
          finalPhotoUrl = await compressAndGetBase64(quickPhotoFile);
        } catch (uploadErr) {
          console.warn('Quick Photo compression failed, trying upload:', uploadErr);
          finalPhotoUrl = await uploadFile(quickPhotoFile, 'athletics_photos');
        }
      }

      if (!finalPhotoUrl) {
        alert('รูปภาพไม่สมบูรณ์ กรุณาลองใหม่อีกครั้งค่ะ');
        return;
      }

      // 1. อัปเดตใน athletics_registrations ทุกรายการของเด็กคนนี้ในปีนี้
      const { error: regError } = await supabase
        .from('athletics_registrations')
        .update({ photo_url: finalPhotoUrl })
        .eq('student_id', quickPhotoReg.student_id)
        .eq('academic_year', selectedYear);

      if (regError) throw regError;

      // 2. ซิงก์ไปอัปเดตในตารางหลัก students ด้วยเพื่อความสมบูรณ์แบบ
      const { error: studentError } = await supabase
        .from('students')
        .update({ photo_url: finalPhotoUrl })
        .eq('id', quickPhotoReg.student_id);

      if (studentError) {
        console.warn('⚠️ ไม่สามารถซิงก์รูปภาพไปประวัตินักเรียนหลักได้:', studentError.message);
      }

      alert('บันทึกรูปภาพนักกีฬาเรียบร้อยแล้วค่ะ! 💾');
      
      setQuickPhotoReg(null);
      setQuickPhotoFile(null);
      setQuickPhotoPreview(null);
      fetchRegistrations();
    } catch (err: any) {
      console.error('Error saving quick photo:', err);
      alert('เกิดข้อผิดพลาดในการบันทึกรูปภาพ: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedStudent(null);
    setSearchQuery('');
    setSportId('');
    setCitizenId('');
    setSportType('');
    setSelectedSports([]);
    setCustomSportType('');
    setAgeGroup('');
    setCustomAgeGroup('');
    setShirtSize('M');
    setCoachName('');
    setCoachPhone('');
    setPhotoFile(null);
    setPhotoPreview(null);
    setEditingRegId(null);
    setIsSubstitute(false);
    setCoachFromTeacher('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      alert('กรุณาเลือกนักเรียนก่อนบันทึกข้อมูลค่ะ');
      return;
    }
    
    const finalAgeGroup = ageGroup === 'อื่นๆ' ? customAgeGroup.trim() : ageGroup;
    if (!finalAgeGroup) {
      alert('กรุณากรอกรุ่นอายุให้ครบถ้วนด้วยค่ะ');
      return;
    }

    let sportsToRegister: string[] = [];
    if (editingRegId) {
      const finalSportType = sportType === 'อื่นๆ' ? customSportType.trim() : sportType;
      if (!finalSportType) {
        alert('กรุณากรอกประเภทกีฬาด้วยค่ะ');
        return;
      }
      sportsToRegister = [finalSportType];
    } else {
      // โหมดลงทะเบียนใหม่: กรอง 'อื่นๆ' ออกจาก selectedSports แล้วใช้ customSportType แทน
      sportsToRegister = selectedSports.filter(s => s !== 'อื่นๆ');
      
      // หากเลือกอื่นๆ และกรอกค่า ให้เพิ่มเข้าอาเรย์
      if (selectedSports.includes('อื่นๆ') && customSportType.trim()) {
        sportsToRegister.push(customSportType.trim());
      }

      if (sportsToRegister.length === 0) {
        alert('กรุณาเลือกชนิดกีฬาอย่างน้อย 1 รายการค่ะ');
        return;
      }
    }

    if (!editingRegId) {
      const duplicates = sportsToRegister.filter(sport =>
        registrations.some(r => r.student_id === selectedStudent.id && r.sport_type === sport)
      );
      if (duplicates.length > 0) {
        alert(`นักเรียนคนนี้เคยลงทะเบียนในกีฬา "${duplicates.join(', ')}" เรียบร้อยแล้วค่ะ`);
        return;
      }
    }

    setSubmitting(true);
    try {
      let finalPhotoUrl = photoPreview || selectedStudent.photo_url || '';
      
      if (photoFile) {
        try {
          finalPhotoUrl = await compressAndGetBase64(photoFile);
        } catch (uploadErr) {
          console.warn('Local compression failed, trying legacy upload:', uploadErr);
          finalPhotoUrl = await uploadFile(photoFile, 'athletics_photos');
        }
      }

      const baseRegData = {
        student_id: selectedStudent.id,
        academic_year: selectedYear,
        prefix: selectedStudent.prefix,
        first_name: selectedStudent.first_name,
        last_name: selectedStudent.last_name,
        gender: selectedStudent.gender,
        birth_date: selectedStudent.birth_date,
        class_level: selectedStudent.class_level,
        room: selectedStudent.room,
        weight: selectedStudent.weight,
        height: selectedStudent.height,
        photo_url: finalPhotoUrl,
        citizen_id: citizenId,
        sport_id: sportId,
        age_group: finalAgeGroup,
        shirt_size: shirtSize,
        coach_name: coachName,
        coach_phone: coachPhone,
        is_substitute: isSubstitute,
        competition_type: 'local',
        registered_by: (await supabase.auth.getUser()).data.user?.id
      };

      if (editingRegId) {
        // 1. อัปเดตรายการที่กำลังแก้ไข
        const { error } = await supabase
          .from('athletics_registrations')
          .update({
            ...baseRegData,
            sport_type: sportsToRegister[0]
          })
          .eq('id', editingRegId);

        if (error) throw error;

        // 2. ซิงก์ข้อมูลสแนปช็อตรูปภาพ น้ำหนัก ส่วนสูง และผู้ฝึกสอน ไปยังรายการแข่งอื่นของเด็กคนนี้ในปีนี้
        const { error: batchError } = await supabase
          .from('athletics_registrations')
          .update({
            prefix: selectedStudent.prefix,
            first_name: selectedStudent.first_name,
            last_name: selectedStudent.last_name,
            gender: selectedStudent.gender,
            birth_date: selectedStudent.birth_date,
            class_level: selectedStudent.class_level,
            room: selectedStudent.room,
            weight: selectedStudent.weight,
            height: selectedStudent.height,
            photo_url: finalPhotoUrl,
            citizen_id: citizenId,
            sport_id: sportId,
            shirt_size: shirtSize,
            coach_name: coachName,
            coach_phone: coachPhone
          })
          .eq('student_id', selectedStudent.id)
          .eq('academic_year', selectedYear);

        if (batchError) {
          console.warn('⚠️ Batch sync failed, but primary update succeeded:', batchError.message);
        }
        
        alert('อัปเดตข้อมูลนักกีฬาเรียบร้อยแล้วค่ะ! (ข้อมูลส่วนตัวและรูปภาพในรายการอื่น ๆ ถูกซิงก์ให้อัตโนมัติแล้ว) 💾');
      } else {
        // แอดแบบ Bulk (หลายรายการแข่งพร้อมกัน)
        const regRows = sportsToRegister.map(sport => ({
          ...baseRegData,
          sport_type: sport
        }));

        const { error } = await supabase
          .from('athletics_registrations')
          .insert(regRows);

        if (error) throw error;
        alert(`ลงทะเบียนนักกีฬาเรียบร้อยแล้วค่ะ! (บันทึกสำเร็จ ${sportsToRegister.length} รายการแข่งขัน) 🎉`);
      }

      resetForm();
      fetchRegistrations();
      fetchCoachHistory();
    } catch (err: any) {
      console.error('Error registering athlete:', err);
      alert('เกิดข้อผิดพลาดในการลงทะเบียน: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (reg: Registration) => {
    setEditingRegId(reg.id);
    
    setSelectedStudent({
      id: reg.student_id,
      student_id: '', 
      prefix: reg.prefix,
      first_name: reg.first_name,
      last_name: reg.last_name,
      academic_year: reg.academic_year,
      gender: reg.gender,
      birth_date: reg.birth_date,
      class_level: reg.class_level,
      room: reg.room,
      weight: reg.weight,
      height: reg.height,
      photo_url: reg.photo_url,
      national_id: reg.citizen_id
    });
    
    setSearchQuery(`${reg.prefix}${reg.first_name} ${reg.last_name}`);
    setSportId(reg.sport_id || '');
    setCitizenId(reg.citizen_id || '');
    
    if (SPORT_TYPES.includes(reg.sport_type)) {
      setSportType(reg.sport_type);
      setCustomSportType('');
      setSelectedSports([reg.sport_type]);
    } else {
      setSportType('อื่นๆ');
      setCustomSportType(reg.sport_type);
      setSelectedSports([reg.sport_type]);
    }

    if (AGE_GROUPS.includes(reg.age_group)) {
      setAgeGroup(reg.age_group);
      setCustomAgeGroup('');
    } else {
      setAgeGroup('อื่นๆ');
      setCustomAgeGroup(reg.age_group);
    }

    setShirtSize(reg.shirt_size || 'M');
    setCoachName(reg.coach_name || '');
    setCoachPhone(reg.coach_phone || '');
    setPhotoFile(null);
    setPhotoPreview(reg.photo_url || null);
    setIsSubstitute(reg.is_substitute || false);
    setCoachFromTeacher('');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleImageError = (id: string) => {
    setBrokenImages(prev => ({ ...prev, [id]: true }));
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`คุณครูแน่ใจใช่ไหมคะที่จะลบรายชื่อนักกีฬา "${name}" ออกจากระบบ?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('athletics_registrations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setRegistrations(registrations.filter(r => r.id !== id));
      alert('ลบรายชื่อออกสำเร็จแล้วค่ะ');
    } catch (err: any) {
      console.error('Error deleting registration:', err);
      alert('ไม่สามารถลบข้อมูลได้: ' + err.message);
    }
  };

  // Age calculation helper
  const calculateAge = (birthDateStr: string) => {
    if (!birthDateStr) return '-';
    try {
      const birthDate = new Date(birthDateStr);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age + ' ปี';
    } catch (e) {
      return '-';
    }
  };

  const calculateAgeNumber = (birthDateStr: string): number => {
    if (!birthDateStr) return 0;
    try {
      const birthDate = new Date(birthDateStr);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    } catch (e) {
      return 0;
    }
  };

  // Filter & Search Logic
  const filteredRegs = registrations.filter(r => {
    const matchesSport = filterSport === 'all' || r.sport_type === filterSport;
    const matchesAge = filterAge === 'all' || r.age_group === filterAge;
    const fullName = `${r.prefix}${r.first_name} ${r.last_name}`;
    const matchesSearch = fullName.includes(searchTerm) || 
                          r.coach_name?.includes(searchTerm) ||
                          r.sport_type.includes(searchTerm) ||
                          r.citizen_id?.includes(searchTerm) ||
                          r.sport_id?.includes(searchTerm);
    return matchesSport && matchesAge && matchesSearch;
  });

  const uniqueSports = Array.from(new Set(registrations.map(r => r.sport_type))).sort();
  const uniqueAges = Array.from(new Set(registrations.map(r => r.age_group))).sort();

  // Helper for preloading image URLs to browser cache
  const preloadImage = (url: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!url) return resolve();
      const img = new Image();
      img.src = url;
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
  };

  // Print single card
  const handlePrintCard = async (reg: Registration) => {
    if (reg.photo_url) {
      await preloadImage(reg.photo_url);
    }
    setPrintQueue([reg]);
    setPrintType('cards');
    setIsPrintMode(true);
    setTimeout(() => {
      window.print();
      setIsPrintMode(false);
    }, 500);
  };

  // Print all filtered cards
  const handlePrintAllFiltered = async () => {
    if (filteredRegs.length === 0) {
      alert('ไม่มีรายชื่อตามเงื่อนไขที่เลือกในขณะนี้ค่ะ');
      return;
    }
    if (!window.confirm(`ยืนยันสั่งพิมพ์บัตรนักกีฬาทั้งหมดจำนวน ${filteredRegs.length} ใบ ใช่หรือไม่?`)) {
      return;
    }

    const photoUrls = filteredRegs.map(r => r.photo_url).filter(Boolean);
    if (photoUrls.length > 0) {
      await Promise.all(photoUrls.map(url => preloadImage(url)));
    }

    setPrintQueue(filteredRegs);
    setPrintType('cards');
    setIsPrintMode(true);
    setTimeout(() => {
      window.print();
      setIsPrintMode(false);
    }, 800);
  };

  // ----------------------------------------------------
  // OFFICIAL REPORTS GENERATORS (A1, A2, A3)
  // ----------------------------------------------------
  
  // กรองผู้ลงทะเบียนสำหรับรายงานเฉพาะรุ่นและเพศ
  const getReportParticipants = () => {
    return registrations.filter(r => {
      // ตรวจสอบรุ่นอายุ เช่น "รุ่นอายุไม่เกิน 12 ปี ชาย" ว่ามีตัวเลข 12 และเป็นเพศชาย
      const ageMatch = r.age_group.includes(`ไม่เกิน ${reportAgeGroup} ปี`);
      const genderMatch = reportGender === 'male' 
        ? r.gender === 'male' || r.gender === 'ชาย' || r.gender === 'ช' || r.age_group.includes('ชาย')
        : r.gender === 'female' || r.gender === 'หญิง' || r.gender === 'ญ' || r.age_group.includes('หญิง');
      return ageMatch && genderMatch;
    });
  };

  const getEventsForAge = () => {
    const defaultEvents = EVENT_MAP_DEFAULT[reportAgeGroup] || SPORT_TYPES.slice(0, 8);
    const customEvts = customEvents[reportAgeGroup] || [];
    return [...new Set([...defaultEvents, ...customEvts])];
  };

  // ค้นหานักกีฬาที่มีคุณสมบัติเหมาะสมสำหรับรุ่นอายุและเพศที่เลือก เพื่อให้เลือกจัดทีมเปตองได้ (ดึงเฉพาะคนที่ลงทะเบียนเปตองเป็นหลัก)
  const getPetanqueCandidates = () => {
    const allRegs = petanqueCompType === 'local' ? registrations : provRegistrations;
    const petanqueRegs = allRegs.filter(r => r.sport_type === 'เปตอง');
    
    const checkAgeMatch = (r: Registration) => {
      const isProvOrNoAgeGroup = !r.age_group || r.age_group === '-' || r.competition_type === 'provincial';
      if (!isProvOrNoAgeGroup) {
        return r.age_group.includes(`ไม่เกิน ${reportAgeGroup} ปี`);
      }
      const calculatedAge = calculateAgeFromBirthDate(r.birth_date);
      const reportAgeLimit = parseInt(reportAgeGroup, 10);
      return !isNaN(reportAgeLimit) ? calculatedAge <= reportAgeLimit : true;
    };

    const checkGenderMatch = (r: Registration) => {
      return reportGender === 'male' 
        ? r.gender === 'male' || r.gender === 'ชาย' || r.gender === 'ช' || r.age_group.includes('ชาย')
        : r.gender === 'female' || r.gender === 'หญิง' || r.gender === 'ญ' || r.age_group.includes('หญิง');
    };

    const filtered = petanqueRegs.filter(r => checkAgeMatch(r) && checkGenderMatch(r));
    
    // กรณีไม่มีข้อมูลคนลงเปตองในรุ่นนี้ ให้แสดงข้อมูลนักกีฬาในรุ่นทั้งหมดเป็นตัวเลือกสำรอง
    if (filtered.length === 0) {
      return allRegs.filter(r => checkAgeMatch(r) && checkGenderMatch(r));
    }
    return filtered;
  };

  const handleAutoFillPetanque = () => {
    const candidates = getPetanqueCandidates();
    if (petanqueCompType === 'local') {
      setPetanqueTeam1Local([
        candidates[0]?.id || '',
        candidates[1]?.id || '',
        candidates[2]?.id || '',
        candidates[3]?.id || '',
      ]);
      setPetanqueTeam2Local([
        candidates[4]?.id || '',
        candidates[5]?.id || '',
        candidates[6]?.id || '',
        candidates[7]?.id || '',
      ]);
    } else {
      setPetanqueTeam1([
        candidates[0]?.id || '',
        candidates[1]?.id || '',
        candidates[2]?.id || '',
        candidates[3]?.id || '',
      ]);
      setPetanqueTeam2([
        candidates[4]?.id || '',
        candidates[5]?.id || '',
        candidates[6]?.id || '',
        candidates[7]?.id || '',
      ]);
    }
  };

  // Reactive Auto-fill petanque team when age group, gender, report type, or competition type changes
  useEffect(() => {
    if (selectedReportType === 'PETANQUE') {
      handleAutoFillPetanque();
    }
  }, [reportAgeGroup, reportGender, selectedReportType, petanqueCompType, registrations, provRegistrations]);

  // ดึงนักกีฬาชายตามรุ่นอายุที่เลือก (ดึงเฉพาะคนที่ลงทะเบียนเปตองเป็นหลัก)
  const getPetanqueMixedMaleCandidates = () => {
    const allRegs = petanqueCompType === 'local' ? registrations : provRegistrations;
    const petanqueRegs = allRegs.filter(r => r.sport_type === 'เปตอง');

    const checkAgeMatch = (r: Registration) => {
      const isProvOrNoAgeGroup = !r.age_group || r.age_group === '-' || r.competition_type === 'provincial';
      if (!isProvOrNoAgeGroup) {
        return r.age_group.includes(`ไม่เกิน ${reportAgeGroup} ปี`);
      }
      const calculatedAge = calculateAgeFromBirthDate(r.birth_date);
      const reportAgeLimit = parseInt(reportAgeGroup, 10);
      return !isNaN(reportAgeLimit) ? calculatedAge <= reportAgeLimit : true;
    };

    const checkGenderMatch = (r: Registration) => {
      return r.gender === 'male' || r.gender === 'ชาย' || r.gender === 'ช' || r.age_group.includes('ชาย');
    };

    const filtered = petanqueRegs.filter(r => checkAgeMatch(r) && checkGenderMatch(r));
    
    if (filtered.length === 0) {
      return allRegs.filter(r => checkAgeMatch(r) && checkGenderMatch(r));
    }
    return filtered;
  };

  // ดึงนักกีฬาหญิงตามรุ่นอายุที่เลือก (ดึงเฉพาะคนที่ลงทะเบียนเปตองเป็นหลัก)
  const getPetanqueMixedFemaleCandidates = () => {
    const allRegs = petanqueCompType === 'local' ? registrations : provRegistrations;
    const petanqueRegs = allRegs.filter(r => r.sport_type === 'เปตอง');

    const checkAgeMatch = (r: Registration) => {
      const isProvOrNoAgeGroup = !r.age_group || r.age_group === '-' || r.competition_type === 'provincial';
      if (!isProvOrNoAgeGroup) {
        return r.age_group.includes(`ไม่เกิน ${reportAgeGroup} ปี`);
      }
      const calculatedAge = calculateAgeFromBirthDate(r.birth_date);
      const reportAgeLimit = parseInt(reportAgeGroup, 10);
      return !isNaN(reportAgeLimit) ? calculatedAge <= reportAgeLimit : true;
    };

    const checkGenderMatch = (r: Registration) => {
      return r.gender === 'female' || r.gender === 'หญิง' || r.gender === 'ญ' || r.age_group.includes('หญิง');
    };

    const filtered = petanqueRegs.filter(r => checkAgeMatch(r) && checkGenderMatch(r));
    
    if (filtered.length === 0) {
      return allRegs.filter(r => checkAgeMatch(r) && checkGenderMatch(r));
    }
    return filtered;
  };

  const handleAutoFillPetanqueMixed = () => {
    const males = getPetanqueMixedMaleCandidates();
    const females = getPetanqueMixedFemaleCandidates();

    if (petanqueCompType === 'local') {
      setPetanqueMixedTeamMaleLocal([
        males[0]?.id || '',
        males[1]?.id || '',
        males[2]?.id || '',
        males[3]?.id || '',
      ]);
      setPetanqueMixedTeamFemaleLocal([
        females[0]?.id || '',
        females[1]?.id || '',
        females[2]?.id || '',
        females[3]?.id || '',
      ]);
    } else {
      setPetanqueMixedTeamMale([
        males[0]?.id || '',
        males[1]?.id || '',
        males[2]?.id || '',
        males[3]?.id || '',
      ]);
      setPetanqueMixedTeamFemale([
        females[0]?.id || '',
        females[1]?.id || '',
        females[2]?.id || '',
        females[3]?.id || '',
      ]);
    }
  };

  // Reactive Auto-fill petanque mixed team when age group, report type, or competition type changes
  useEffect(() => {
    if (selectedReportType === 'PETANQUE_MIXED') {
      handleAutoFillPetanqueMixed();
    }
  }, [reportAgeGroup, selectedReportType, petanqueCompType, registrations, provRegistrations]);

  const handlePrintOfficialReport = async (type: 'A1' | 'A2' | 'A3' | 'CERT' | 'PETANQUE' | 'PETANQUE_MIXED') => {
    const isLocal = petanqueCompType === 'local';
    const team1 = isLocal ? petanqueTeam1Local : petanqueTeam1;
    const team2 = isLocal ? petanqueTeam2Local : petanqueTeam2;
    const mixedMale = isLocal ? petanqueMixedTeamMaleLocal : petanqueMixedTeamMale;
    const mixedFemale = isLocal ? petanqueMixedTeamFemaleLocal : petanqueMixedTeamFemale;

    if (type === 'PETANQUE_MIXED') {
      const selectedIds = [...mixedMale, ...mixedFemale].filter(Boolean);
      const allRegs = [...registrations, ...provRegistrations];
      const petData = allRegs.filter(r => selectedIds.includes(r.id));
      const photoUrls = petData.map(r => r.photo_url).filter(Boolean);
      if (photoUrls.length > 0) {
        await Promise.all(photoUrls.map(url => preloadImage(url)));
      }
      setPrintType('PETANQUE_MIXED');
      setIsPrintMode(true);
      setTimeout(() => {
        window.print();
        setIsPrintMode(false);
      }, 800);
      return;
    }

    if (type === 'PETANQUE') {
      const selectedIds = [...team1, ...team2].filter(Boolean);
      const allRegs = [...registrations, ...provRegistrations];
      const petData = allRegs.filter(r => selectedIds.includes(r.id));
      const photoUrls = petData.map(r => r.photo_url).filter(Boolean);
      if (photoUrls.length > 0) {
        await Promise.all(photoUrls.map(url => preloadImage(url)));
      }
      setPrintType('PETANQUE');
      setIsPrintMode(true);
      setTimeout(() => {
        window.print();
        setIsPrintMode(false);
      }, 800);
      return;
    }

    if (type === 'CERT') {
      // พิมพ์หนังสือรับรอง — ใช้รายชื่อที่เลือก
      const certRegs = registrations.filter(r => certSelectedRegs.includes(r.id));
      if (certRegs.length === 0) {
        alert('กรุณาเลือกนักกีฬาอย่างน้อย 1 คนเพื่อพิมพ์หนังสือรับรองค่ะ');
        return;
      }
      setPrintType('CERT');
      setIsPrintMode(true);
      setTimeout(() => {
        window.print();
        setIsPrintMode(false);
      }, 800);
      return;
    }

    const reportData = getReportParticipants();
    if (reportData.length === 0) {
      alert(`ไม่พบข้อมูลนักกีฬาใน รุ่นอายุไม่เกิน ${reportAgeGroup} ปี (${reportGender === 'male' ? 'ชาย' : 'หญิง'}) สำหรับออกรายงานนี้ค่ะ`);
      return;
    }

    if (type === 'A1') {
      // พรีโหลดรูปภาพทั้งหมดสำหรับแผง A1
      const photoUrls = reportData.map(r => r.photo_url).filter(Boolean);
      if (photoUrls.length > 0) {
        await Promise.all(photoUrls.map(url => preloadImage(url)));
      }
    }

    setPrintType(type);
    setIsPrintMode(true);
    setTimeout(() => {
      window.print();
      setIsPrintMode(false);
    }, 800);
  };

  // Helper: คำนวณอายุจากวันเกิด (ปัดเศษปี พ.ศ. ชนปี พ.ศ.)
  const calculateAgeFromBirthDate = (birthDateStr: string): number => {
    if (!birthDateStr) return 0;
    try {
      const birthDate = new Date(birthDateStr);
      const birthYearCE = birthDate.getFullYear();
      const birthYearBE = birthYearCE + 543;
      const compYear = parseInt(selectedYear, 10) || 2569;
      return compYear - birthYearBE;
    } catch {
      return 0;
    }
  };

  // Helper: แปลงคำนำหน้านามให้เป็นคำเต็ม
  const getFullPrefix = (prefix: string): string => {
    if (!prefix) return '';
    const p = prefix.trim();
    if (p === 'ด.ช.' || p === 'ดช.' || p === 'เด็กชาย') return 'เด็กชาย';
    if (p === 'ด.ญ.' || p === 'ดญ.' || p === 'เด็กหญิง') return 'เด็กหญิง';
    if (p === 'น.ส.' || p === 'นางสาว') return 'นางสาว';
    if (p === 'นาย') return 'นาย';
    return p;
  };

  // Helper: แปลงวันเกิดเป็นรูปแบบไทย (วันที่/เดือน/พ.ศ.)
  const formatThaiDateParts = (dateStr: string): { day: string; month: string; year: string } => {
    const empty = { day: '..........', month: '....................', year: '................' };
    if (!dateStr) return empty;
    try {
      const date = new Date(dateStr);
      const months = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
      ];
      return {
        day: String(date.getDate()),
        month: months[date.getMonth()],
        year: String(date.getFullYear() + 543)
      };
    } catch {
      return empty;
    }
  };

  // Convert Arabic numerals to Thai numerals (defined globally outside component)

  // Convert Date to Thai long format
  const formatThaiDateFull = (dateStr: string) => {
    if (!dateStr) return '..................................';
    try {
      const date = new Date(dateStr);
      const months = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
      ];
      return `${date.getDate()} ${months[date.getMonth()]} พ.ศ. ${date.getFullYear() + 543}`;
    } catch (e) {
      return dateStr;
    }
  };

  // If print mode, render printing layout
  if (isPrintMode) {
    return (
      <div className="print-mode-root bg-white min-h-screen p-0 m-0">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            /* ปลดล็อกโครงสร้าง Layout ทั้งหมดของแอปหลัก เพื่อให้เบราว์เซอร์ปริ้นต์เฉพาะหน้าบัตร */
            html, body, #root, #root > div, main, .custom-scrollbar, div[class*="overflow-y-auto"], div[class*="p-8"] {
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
              position: static !important;
              background: white !important;
              padding: 0 !important;
              margin: 0 !important;
              width: auto !important;
              box-shadow: none !important;
              font-family: "TH Sarabun PSK", "TH Sarabun New", "Sarabun", sans-serif !important;
            }
            
            /* ซ่อน Sidebar, Header, และส่วนควบคุมของแอป */
            aside, header, nav, button, .no-print, .IdentityFooter {
              display: none !important;
              width: 0 !important;
              height: 0 !important;
              opacity: 0 !important;
              visibility: hidden !important;
            }

            .print-page-break {
              page-break-after: always;
              break-after: page;
              height: 297mm; /* ขนาดความสูง A4 เต็มแผ่น */
              box-sizing: border-box;
              display: flex !important;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              padding: 10mm 15mm;
              margin: 0 !important;
              background-color: white !important;
            }
            
            /* ปรับแต่งสำหรับหน้าพิมพ์รายงานราชการ A1, A2, A3 */
            .official-page-break {
              page-break-after: always;
              break-after: page;
              width: 210mm;
              min-height: 297mm;
              box-sizing: border-box;
              padding: 15mm 20mm;
              background: white !important;
              color: black !important;
              font-family: "TH Sarabun PSK", "TH Sarabun New", "Sarabun", sans-serif !important;
            }
          }
          
          /* สไตล์หน้าจอพิมพ์การ์ด */
          .athlete-card-container {
            width: 180mm;
            height: 255mm;
            padding: 12mm 10mm 10mm 10mm;
            border: 3px solid #2e7d32;
            border-radius: 12px;
            background-color: #ffffff;
            box-shadow: 0 4px 15px rgba(0,0,0,0.15);
            box-sizing: border-box;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            font-family: "TH Sarabun PSK", "TH Sarabun New", "Sarabun", sans-serif !important;
            color: #000000;
            line-height: 1.25;
          }

          .athlete-card-header {
            text-align: center;
            margin-bottom: 4mm;
            border-bottom: 3px solid #2e7d32;
            padding-bottom: 3mm;
          }

          .card-main-title {
            font-size: 28pt;
            font-weight: 700;
            color: #1b5e20;
            margin-bottom: 2px;
          }

          .card-sub-title {
            font-size: 13pt;
            font-weight: 600;
            color: #333333;
          }

          .card-sub-title-year {
            font-size: 15pt;
            font-weight: 700;
            color: #1b5e20;
            margin-top: 2px;
          }

          .athlete-card-id-frame {
            border: 2px solid #777777;
            border-radius: 6px;
            width: 150mm;
            height: 95mm;
            margin: 0 auto 4mm auto;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;
            background-color: #f8fafc;
          }

          .athlete-card-id-img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }

          .athlete-card-id-placeholder {
            color: #666;
            font-size: 1.2rem;
            text-align: center;
          }

          .athlete-card-details {
            padding-left: 2mm;
            margin-bottom: 2mm;
          }

          .athlete-card-name {
            font-size: 22pt;
            font-weight: 700;
            text-align: center;
            margin-bottom: 3mm;
            border-bottom: 2px dashed #cccccc;
            padding-bottom: 2mm;
          }

          .athlete-card-info-table {
            display: flex;
            flex-direction: column;
            gap: 2mm;
          }

          .info-row {
            display: flex;
            font-size: 13.5pt;
          }

          .info-label {
            font-weight: bold;
            width: 55mm;
            color: #333333;
          }

          .info-value {
            font-weight: 600;
            color: #000000;
          }

          .athlete-card-events {
            padding-left: 2mm;
            margin-bottom: 3mm;
            flex-grow: 1;
          }

          .events-title {
            font-size: 14pt;
            font-weight: bold;
            margin-bottom: 2mm;
            color: #111;
          }

          .events-list {
            list-style: none;
            padding-left: 4mm;
          }

          .events-list li {
            display: flex;
            align-items: center;
            font-size: 14pt;
            margin-bottom: 1.5mm;
            font-weight: 600;
          }

          .pink-checkmark {
            color: #e91e63;
            font-weight: bold;
            font-size: 17pt;
            margin-right: 3mm;
            display: inline-block;
            width: 18px;
          }

          .athlete-card-footer {
            border-top: 3px solid #2e7d32;
            padding-top: 3mm;
            text-align: center;
            font-size: 13pt;
          }
          
          /* สไตล์สำหรับตารางทางการ */
          .official-table th, .official-table td {
            border: 1px solid black;
            padding: 6px;
          }
        `}} />

        {/* 1. PRINT ATHLETE CARDS (พิมพ์บัตรประจำตัวนักกีฬา) */}
        {printType === 'cards' && (() => {
          // Group printQueue by student to aggregate events on a single card
          const grouped: Record<string, Registration & { events: string[] }> = {};
          printQueue.forEach(r => {
            const key = r.citizen_id || r.student_id;
            if (!grouped[key]) {
              grouped[key] = {
                ...r,
                events: [r.sport_type]
              };
            } else {
              if (!grouped[key].events.includes(r.sport_type)) {
                grouped[key].events.push(r.sport_type);
              }
            }
          });
          const groupedQueue = Object.values(grouped);
          
          return groupedQueue.map((p, index) => {
            const isPhotoBroken = brokenImages[p.id] || !p.photo_url;
            const edNo = selectedYear ? parseInt(selectedYear) - 2548 : 21;
            
            return (
              <div key={p.id || index} className="print-page-break flex items-center justify-center">
                <div className="athlete-card-container">
                  {/* ส่วนหัวบัตร */}
                  <div className="athlete-card-header">
                    <div className="card-main-title">บัตรนักกีฬา</div>
                    <div className="card-sub-title">การแข่งขันกีฬา-กรีฑาเยาวชน ประชาชน ตำบลเขาชัยสน</div>
                    <div className="card-sub-title-year">ครั้งที่ {toThaiNumerals(edNo)} ประจำปี {toThaiNumerals(selectedYear)}</div>
                  </div>

                  {/* กล่องแสดงรูปถ่ายบัตรประชาชน/สูติบัตร */}
                  <div className="athlete-card-id-frame">
                    {!isPhotoBroken ? (
                      <img 
                        src={p.photo_url} 
                        alt="ID Photo" 
                        className={`athlete-card-id-img ${imageAspects[p.id] === 'landscape' ? 'object-contain p-0.5' : 'object-cover'}`} 
                        onLoad={(e) => handleImageLoad(p.id, e)}
                        onError={() => handleImageError(p.id)} 
                      />
                    ) : (
                      <div className="athlete-card-id-placeholder">ไม่มีรูปถ่ายหลักฐาน</div>
                    )}
                  </div>

                  {/* ข้อมูลตัวนักกีฬา */}
                  <div className="athlete-card-details">
                    <div className="athlete-card-name">{p.prefix}{p.first_name} {p.last_name}</div>
                    
                    <div className="athlete-card-info-table">
                      <div className="info-row">
                        <span className="info-label">รุ่นอายุ:</span>
                        <span className="info-value">{p.age_group.replace("รุ่นอายุ", "").replace("ไม่เกิน ", "")}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">เลขประจำตัวประชาชน:</span>
                        <span className="info-value font-mono">{p.citizen_id ? p.citizen_id.replace(/(\d{1})(\d{4})(\d{5})(\d{2})(\d{1})/, '$1 $2 $3 $4 $5') : '-'}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">หมายเลขหน่วยกีฬา:</span>
                        <span className="info-value">{p.sport_id || '-'}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">ทีม:</span>
                        <span className="info-value">{reportTeamName}</span>
                      </div>
                    </div>
                  </div>

                  {/* ประเภทการแข่งขัน */}
                  <div className="athlete-card-events">
                    <div className="events-title">ประเภทการแข่งขัน:</div>
                    <ul className="events-list">
                      {p.events.map((ev, evIdx) => (
                        <li key={evIdx}>
                          <span className="pink-checkmark">✔</span>
                          <span className="event-name">{ev}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* ข้อมูลผู้จัดการทีม ด้านล่างสุด */}
                  <div className="athlete-card-footer">
                    <div className="manager-info font-bold text-slate-800">
                      ผู้จัดการทีม: {p.coach_name || reportManagerName || '-'} โทร.{p.coach_phone || reportManagerPhone || '-'}
                    </div>
                  </div>
                </div>
              </div>
            );
          });
        })()}

        {/* 2. PRINT OFFICIAL REPORT A1 (แผงรูปภาพนักกีฬา หน้าละ 4 คน) */}
        {printType === 'A1' && (() => {
          const rawParticipants = getReportParticipants();
          const grouped: Record<string, Registration & { events: string[] }> = {};
          rawParticipants.forEach(r => {
            const key = r.citizen_id || r.student_id;
            if (!grouped[key]) {
              grouped[key] = {
                ...r,
                events: [r.sport_type]
              };
            } else {
              if (!grouped[key].events.includes(r.sport_type)) {
                grouped[key].events.push(r.sport_type);
              }
            }
          });
          const reportData = Object.values(grouped);
          const itemsPerPage = 4;
          const pageCount = Math.ceil(reportData.length / itemsPerPage);
          const edNo = selectedYear ? parseInt(selectedYear) - 2548 : 21;
          
          return Array(pageCount).fill(0).map((_, pageIdx) => {
            const pageItems = reportData.slice(pageIdx * itemsPerPage, (pageIdx + 1) * itemsPerPage);
            return (
              <div key={pageIdx} className="official-page-break flex flex-col justify-between py-10" style={{ pageBreakBefore: pageIdx > 0 ? 'always' : 'auto', fontSize: '16pt' }}>
                <div>
                  <div className="flex justify-between text-[14px] text-slate-500 mb-6">
                    <span>แบบ A 1</span>
                    <span>หน้า {pageIdx + 1}/{pageCount}</span>
                  </div>
                  
                  <h2 className="text-center font-bold" style={{ fontSize: '18pt' }}>แผงรูปถ่ายนักกรีฑา ( แบบ A 1 )</h2>
                  <p className="text-center font-bold mt-1" style={{ fontSize: '16pt' }}>การแข่งขันกรีฑา เด็ก เยาวชนและประชาชน ตำบลเขาชัยสน ครั้งที่ {edNo} ประจำปี {selectedYear}</p>
                  
                  <div style={{ fontSize: '15pt', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '8px 12px', marginBottom: '6px', borderBottom: '1px solid #ccc', paddingBottom: '3px', lineHeight: '1.1' }}>
                    <span>รุ่นอายุ ไม่เกิน {reportAgeGroup} ปี</span>
                    <span>เพศ {reportGender === 'male' ? 'ชาย' : 'หญิง'}</span>
                    <span>ทีม {reportTeamName}</span>
                    <span>หมายเลขหน่วยกีฬา {reportUnitCode}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-6 mt-8">
                    {pageItems.map((p, idx) => {
                      const isPhotoBroken = brokenImages[p.id] || !p.photo_url;
                      return (
                        <div key={p.id || idx} className="border border-black p-4 flex flex-col bg-white">
                          <div className="w-[150px] h-[190px] border border-slate-300 rounded-lg mx-auto overflow-hidden bg-slate-50 flex items-center justify-center shrink-0 shadow-xs mb-3">
                            {!isPhotoBroken ? (
                              <img 
                                src={p.photo_url} 
                                alt="pic" 
                                className={`w-full h-full ${imageAspects[p.id] === 'landscape' ? 'object-contain bg-slate-100 p-1' : 'object-cover'}`} 
                                onLoad={(e) => handleImageLoad(p.id, e)}
                                onError={() => handleImageError(p.id)} 
                              />
                            ) : (
                              <User size={48} className="text-slate-300" />
                            )}
                          </div>
                          <div className="text-[15px] font-normal text-center border-b border-dashed border-slate-200 pb-2 mb-2">
                            <span className="font-normal text-slate-800 block" style={{ fontSize: '16pt' }}>{p.prefix}{p.first_name} {p.last_name}</span>
                            <span className="text-slate-500 block mt-0.5" style={{ fontSize: '14pt' }}>เลขประจำตัวประชาชน: {p.citizen_id}</span>
                          </div>
                          <div className="font-normal text-slate-700" style={{ fontSize: '16pt' }}>
                            <p className="font-normal text-slate-900 mb-1">ประเภทการแข่งขัน:</p>
                            <ol className="list-decimal pl-5 text-[16pt] font-normal text-slate-800 leading-normal" style={{ fontSize: '16pt' }}>
                              {p.events.map((ev, evIdx) => (
                                <li key={evIdx}>{ev}</li>
                              ))}
                              {Array(Math.max(0, 5 - p.events.length)).fill(0).map((_, emptyIdx) => (
                                <li key={`empty-${emptyIdx}`}>{"\u00a0"}</li>
                              ))}
                            </ol>
                          </div>
                        </div>
                      );
                    })}
                    {pageItems.length < 4 ? Array(4 - pageItems.length).fill(0).map((_, emptyCardIdx) => (
                      <div key={`empty-card-${emptyCardIdx}`} className="border border-dashed border-slate-300 p-4 flex flex-col items-center justify-center h-[320px] bg-slate-50 rounded-lg">
                        <p className="text-slate-400 font-normal text-sm">ช่องว่างสำหรับนักกรีฑา</p>
                      </div>
                    )) : null}
                  </div>
                </div>
              </div>
            );
          });
        })()}


        {/* 3. PRINT OFFICIAL REPORT A2 (ฟอร์มสรุปรายชื่อลงแข่งในแต่ละรายการแบบสรุปช่อง) */}
        {printType === 'A2' && (() => {
          const rawParticipants = getReportParticipants();
          const grouped: Record<string, Registration & { events: string[] }> = {};
          rawParticipants.forEach(r => {
            const key = r.citizen_id || r.student_id;
            if (!grouped[key]) {
              grouped[key] = {
                ...r,
                events: [r.sport_type]
              };
            } else {
              if (!grouped[key].events.includes(r.sport_type)) {
                grouped[key].events.push(r.sport_type);
              }
            }
          });
          const reportData = Object.values(grouped);
          const events = getEventsForAge();
          const maxRows = Math.max(10, reportData.length);
          const edNo = selectedYear ? parseInt(selectedYear) - 2548 : 21;
          
          return (
            <div className="official-page-break flex flex-col justify-between py-10" style={{ fontSize: '16pt' }}>
              <div>
                <div className="text-[14px] text-slate-500 mb-4">แบบ A 2</div>
                <h2 className="text-center font-bold" style={{ fontSize: '18pt' }}>แบบฟอร์มรายชื่อแยกประเภท ( แบบ A 2 )</h2>
                <p className="text-center font-bold mt-1" style={{ fontSize: '16pt' }}>การแข่งขันกรีฑา เด็ก เยาวชนและประชาชน ตำบลเขาชัยสน ครั้งที่ {edNo} ประจำปี {selectedYear}</p>
                
                <div style={{ fontSize: '15pt', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '8px 12px', marginBottom: '6px', lineHeight: '1.1' }}>
                  <span>รุ่นอายุ ไม่เกิน {reportAgeGroup} ปี</span>
                  <span>เพศ {reportGender === 'male' ? 'ชาย' : 'หญิง'}</span>
                  <span>ทีม {reportTeamName}</span>
                  <span>หมายเลขหน่วยกีฬา {reportUnitCode}</span>
                </div>

                <table className="w-full font-normal border-collapse border border-black official-table" style={{ fontSize: '16pt' }}>
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="text-center border border-black py-2 w-10">ลำดับ</th>
                      <th className="text-center border border-black py-2 w-20">หมายเลขนักกีฬา</th>
                      <th className="border border-black py-2 px-3">ชื่อ - สกุล</th>
                      {events.map((ev, idx) => (
                        <th key={idx} className="text-center border border-black py-2 px-1 leading-tight w-10" style={{ fontSize: '13pt', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', width: '32px' }}>{ev}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array(maxRows).fill(0).map((_, i) => {
                      const p = reportData[i];
                      return (
                        <tr key={i} className="h-8">
                          <td className="text-center border border-black">{i + 1}</td>
                          <td className="text-center border border-black">{p ? p.sport_id : ''}</td>
                          <td className="border border-black px-3 font-normal text-slate-800">
                            {p ? `${p.prefix}${p.first_name} ${p.last_name}` : ''}
                          </td>
                          {events.map((ev, idx) => {
                            const hasRegistered = p && p.events.includes(ev);
                            const isReserve = p && p.events.includes(`${ev} (สำรอง)`);
                            return (
                              <td key={idx} className="text-center border border-black font-normal text-[16px] text-emerald-700">
                                {hasRegistered ? '/' : (isReserve ? '/ (สำรอง)' : '')}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div style={{ marginTop: '8px', fontSize: '16pt', lineHeight: '1.15', pageBreakInside: 'avoid' }}>
                  <p style={{ marginBottom: '1px' }}>ข้าพเจ้าขอรับรองนักกรีฑาที่มีรายชื่อดังกล่าวข้างต้น เป็นนักกรีฑาสังกัด <u>{"\u00a0\u00a0"}{reportTeamName}{"\u00a0\u00a0"}</u></p>
                  <p>หน่วยกีฬา <u>{"\u00a0\u00a0"}{reportUnitCode}{"\u00a0\u00a0"}</u> จริง และมีคุณสมบัติถูกต้องตามระเบียบการแข่งขันทุกประการ</p>
                </div>
              </div>

              <div className="flex justify-end mt-12">
                <table style={{ width: '100%', border: 'none', marginTop: '4px' }}>
                  <tbody>
                    <tr style={{ border: 'none' }}>
                      <td style={{ border: 'none', width: '50%' }}></td>
                      <td style={{ border: 'none', textAlign: 'center', width: '50%', fontSize: '16pt', lineHeight: '1.1', fontWeight: 'bold' }}>
                        <p>ลงชื่อ <span style={{ display: 'inline-block', width: '180px', borderBottom: '1px dotted #000' }}></span> ผู้จัดการทีม</p>
                        <p style={{ marginTop: '3px' }}>( <u>{"\u00a0\u00a0"}{reportManagerName || '........................................................'}{"\u00a0\u00a0"}</u> )</p>
                        <p style={{ marginTop: '3px' }}>............../.........................../ {selectedYear}</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}


        {/* 4. PRINT OFFICIAL REPORT A3 (รายชื่อแยกตามประเภทการวิ่ง/การลงแข่ง) */}
        {printType === 'A3' && (() => {
          const rawParticipants = getReportParticipants();
          const grouped: Record<string, Registration & { events: string[] }> = {};
          rawParticipants.forEach(r => {
            const key = r.citizen_id || r.student_id;
            if (!grouped[key]) {
              grouped[key] = {
                ...r,
                events: [r.sport_type]
              };
            } else {
              if (!grouped[key].events.includes(r.sport_type)) {
                grouped[key].events.push(r.sport_type);
              }
            }
          });
          const reportData = Object.values(grouped);
          const events = getEventsForAge();
          const edNo = selectedYear ? parseInt(selectedYear) - 2548 : 21;
          
          return (
            <div className="official-page-break flex flex-col justify-between py-10" style={{ fontSize: '16pt' }}>
              <div>
                <div className="text-[14px] text-slate-500 mb-4">แบบ A 3</div>
                <h2 className="text-center font-bold" style={{ fontSize: '18pt' }}>แบบฟอร์มรายชื่อแยกประเภท ( แบบ A 3 )</h2>
                <p className="text-center font-bold mt-1" style={{ fontSize: '16pt' }}>การแข่งขันกรีฑา เด็ก เยาวชนและประชาชน ตำบลเขาชัยสน ครั้งที่ {edNo} ประจำปี {selectedYear}</p>
                
                <div style={{ fontSize: '15pt', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '8px 12px', marginBottom: '6px', lineHeight: '1.1' }}>
                  <span>รุ่นอายุ ไม่เกิน {reportAgeGroup} ปี</span>
                  <span>เพศ {reportGender === 'male' ? 'ชาย' : 'หญิง'}</span>
                  <span>ทีม {reportTeamName}</span>
                  <span>หมายเลขหน่วยกีฬา {reportUnitCode}</span>
                </div>

                <table className="w-full font-normal border-collapse border border-black official-table" style={{ fontSize: '16pt' }}>
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="text-center border border-black py-2 w-44">ประเภทการแข่งขัน</th>
                      <th className="border border-black py-2 px-3">ชื่อ - สกุล ผู้เข้าแข่งขัน</th>
                      <th className="text-center border border-black py-2 w-48">วัน เดือน ปีเกิด</th>
                      <th className="text-center border border-black py-2 w-28">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((ev, evIdx) => {
                      const evParticipants = reportData.filter(p => p.events.includes(ev) || p.events.includes(`${ev} (สำรอง)`));
                      const isRelay = ev.includes('ผลัด') || ev.toLowerCase().includes('4x');
                      const rowCount = isRelay ? 5 : 2; // วิ่งผลัดมี 5 บรรทัด (จริง4+สำรอง1), ทั่วไปมี 2 บรรทัด
                      
                      return Array(rowCount).fill(0).map((_, i) => {
                        const p = evParticipants[i];
                        const showCategoryName = i === 0;
                        
                        return (
                          <tr key={`${evIdx}-${i}`} className="h-8">
                            {showCategoryName && (
                              <td rowSpan={rowCount} className="border border-black text-center font-normal p-2 bg-slate-50" style={{ whiteSpace: 'nowrap' }}>
                                {evIdx + 1}. {ev}
                              </td>
                            )}
                            <td className="border border-black px-3 font-normal text-slate-800">
                              {p ? `${i + 1}. ${p.prefix}${p.first_name} ${p.last_name}` : `${i + 1}. ........................................................................`}
                            </td>
                            <td className="border border-black text-center font-normal">
                              {p ? formatThaiDateFull(p.birth_date) : '...................................................'}
                            </td>
                            <td className="border border-black text-center">
                              {p && p.events.includes(`${ev} (สำรอง)`) ? 'ตัวสำรอง' : ''}
                            </td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end mt-12" style={{ marginTop: '8px', fontSize: '16pt', lineHeight: '1.15', pageBreakInside: 'avoid' }}>
                <table style={{ width: '100%', border: 'none', marginTop: '4px' }}>
                  <tbody>
                    <tr style={{ border: 'none' }}>
                      <td style={{ border: 'none', width: '50%' }}></td>
                      <td style={{ border: 'none', textAlign: 'center', width: '50%', fontSize: '16pt', lineHeight: '1.1' }}>
                        <p>ลงชื่อ <span style={{ display: 'inline-block', width: '180px', borderBottom: '1px dotted #000' }}></span> ผู้จัดการทีม</p>
                        <p style={{ marginTop: '3px' }}>( <u>{"\u00a0\u00a0"}{reportManagerName || '........................................................'}{"\u00a0\u00a0"}</u> )</p>
                        <p style={{ marginTop: '3px' }}>............../.........................../ {selectedYear}</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* 4. PRINT CERTIFICATE (หนังสือรับรองของสถานศึกษา) */}
        {printType === 'CERT' && (() => {
          const allRegs = [...registrations, ...provRegistrations];
          const certRegs = allRegs.filter(r => certSelectedRegs.includes(r.id));
          // จัดกลุ่มตามนักเรียน (รวมประเภทกีฬา)
          const grouped: Record<string, Registration & { events: string[] }> = {};
          certRegs.forEach(r => {
            const key = r.citizen_id || r.student_id;
            if (!grouped[key]) {
              grouped[key] = { ...r, events: [r.sport_type] };
            } else {
              if (!grouped[key].events.includes(r.sport_type)) {
                grouped[key].events.push(r.sport_type);
              }
            }
          });
          const certStudents = Object.values(grouped);

          return certStudents.map((student, index) => {
            const dateParts = formatThaiDateParts(student.birth_date);
            const studentAge = calculateAgeFromBirthDate(student.birth_date);
            
            // สร้างชื่อกีฬาจากรายการที่ลงทะเบียน หรือใช้ชื่อที่ตั้ง พร้อมตัดคำว่า "ในร่ม"
            let sportDisplayName = certSportName || student.events.join(', ');
            sportDisplayName = sportDisplayName.replace(/วอลเลย์บอลในร่ม/g, 'วอลเลย์บอล').replace(/วอลเลบอลในร่ม/g, 'วอลเลย์บอล');

            const schoolName = reportTeamName || '';
            const directorPosition = schoolName.startsWith('โรงเรียน') ? `ผู้อำนวยการ${schoolName}` : `ผู้อำนวยการโรงเรียน${schoolName}`;
            const normalizedPrefix = getFullPrefix(student.prefix);
            const classLevelAndRoom = student.class_level 
              ? (student.class_level.startsWith('ป.') || student.class_level.startsWith('ม.') 
                  ? student.class_level 
                  : `ป.${student.class_level}`) 
              : '.........................';
            const roomText = student.room ? `/${student.room}` : '';
            const classRoomThai = toThaiNumerals(classLevelAndRoom + roomText);

            return (
              <div key={student.id || index} className="official-page-break" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: '25mm', paddingBottom: '20mm', paddingLeft: '25mm', paddingRight: '25mm', fontSize: '16pt', lineHeight: '1.6', fontFamily: '"TH Sarabun PSK", "TH Sarabun New", "Sarabun", sans-serif' }}>
                <h2 style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '20pt', marginBottom: '24px' }}>หนังสือรับรองของสถานศึกษา</h2>
                
                <p style={{ textIndent: '80px', textAlign: 'left', margin: '0 0 12px 0', fontSize: '16pt' }}>
                  ข้าพเจ้า {reportManagerName || '.......................................................'} ตำแหน่ง {directorPosition} ขอรับรองว่า {normalizedPrefix} {student.first_name} {student.last_name} เกิดวันที่ {toThaiNumerals(dateParts.day)} เดือน {dateParts.month} พ.ศ. {toThaiNumerals(dateParts.year)} มีอายุ {studentAge ? toThaiNumerals(studentAge) : '.........'} ปี ปัจจุบันกำลังเรียนชั้น {classRoomThai} และเป็นผู้มีคุณสมบัติถูกต้องตามระเบียบการรับสมัคร เข้าแข่งขันกีฬา {sportDisplayName} นักเรียน นักศึกษา และประชาชนจังหวัดพัทลุง ครั้งที่ {compEditionThai} ประจำปี {compYearThai} ทุกประการ
                </p>

                {/* ส่วนลงนาม */}
                <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'flex-end', paddingRight: '40px' }}>
                  <div style={{ textAlign: 'center', lineHeight: '1.4', width: '350px', fontSize: '16pt' }}>
                    <p style={{ margin: '0', fontSize: '16pt' }}>(ลงชื่อ)...............................................................</p>
                    <p style={{ margin: '6px 0 0 0', fontSize: '16pt' }}>( {reportManagerName || '.........................................................'} )</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '16pt' }}>ตำแหน่ง {directorPosition}</p>
                    <p style={{ margin: '6px 0 0 0', fontSize: '13pt', color: '#666' }}>ประทับตราสถานศึกษารับรอง</p>
                  </div>
                </div>
              </div>
            );
          });
        })()}

        {/* 5. PRINT PETANQUE MIXED (ทะเบียนรูปนักกีฬาเปตอง รวมชายหญิง) */}
        {/* 5. PRINT PETANQUE MIXED (ทะเบียนรูปนักกีฬาเปตอง รวมชายหญิง) */}
        {printType === 'PETANQUE_MIXED' && (() => {
          const edNo = selectedYear ? parseInt(selectedYear) - 2492 : 77;
          const edThai = toThaiNumerals(edNo);
          const yearThai = toThaiNumerals(selectedYear || 2569);
          const allRegs = [...registrations, ...provRegistrations];
          const isLocal = petanqueCompType === 'local';
          const activeMixedTeamMale = isLocal ? petanqueMixedTeamMaleLocal : petanqueMixedTeamMale;
          const activeMixedTeamFemale = isLocal ? petanqueMixedTeamFemaleLocal : petanqueMixedTeamFemale;
          const activeMixedPhotos = isLocal ? petanqueMixedPhotosLocal : petanqueMixedPhotos;

          const renderTeamBlockPrint = (title: string, teamIds: string[], teamIndex: number) => {
            return (
              <div className="border border-black p-4 mb-4 bg-white" style={{ fontSize: '15pt', lineHeight: '1.25' }}>
                <p className="text-center font-bold mb-3" style={{ fontSize: '16pt' }}>
                  {title}
                </p>
                <div className="grid grid-cols-4 gap-3 justify-items-center">
                  {teamIds.map((id, idx) => {
                    const p = allRegs.find(r => r.id === id) || null;
                    const globalIdx = (teamIndex - 1) * 4 + idx;
                    const customPhoto = activeMixedPhotos[globalIdx];
                    const hasPhoto = customPhoto || (p && p.photo_url);
                    const isPhotoBroken = p ? (brokenImages[p.id] && !customPhoto) : !customPhoto;
                    return (
                      <div key={idx} className="flex flex-col items-center w-full">
                        <div className="w-[100px] h-[130px] border border-black flex items-center justify-center bg-slate-50 overflow-hidden relative">
                          {hasPhoto && !isPhotoBroken ? (
                            <img 
                              src={customPhoto || (p ? p.photo_url : '')} 
                              alt="pic" 
                              className="w-full h-full object-cover"
                              onLoad={(e) => p && handleImageLoad(p.id, e)}
                              onError={() => p && handleImageError(p.id)} 
                            />
                          ) : (
                            <span className="text-[10px] text-slate-400 text-center font-normal px-1">
                              รูปถ่าย<br/>{idx === 3 ? 'สำรอง' : `คนที่ ${idx + 1}`}
                            </span>
                          )}
                        </div>
                        <div className="text-center mt-2 w-full text-[14pt] leading-tight font-normal font-sans">
                          <div className="truncate">ชื่อ {p ? `${p.prefix || (teamIndex === 1 ? 'ด.ช.' : 'ด.ญ.')}${p.first_name}` : '.......................................'}</div>
                          <div className="truncate mt-1">นามสกุล {p ? p.last_name : '.......................................'}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          };

          const matchTitle = isLocal
            ? `การแข่งขันกีฬาเปตอง เด็ก เยาวชนและประชาชน ตำบลเขาชัยสน ครั้งที่ ${edThai} ประจำปี พ.ศ. ${yearThai}`
            : `การแข่งขันกีฬาเปตองกีฬานักเรียน นักศึกษา และประชาชนจังหวัดพัทลุง ครั้งที่ ${edThai} ประจำปี ${yearThai}`;

          return (
            <div className="official-page-break flex flex-col justify-between py-6" style={{ fontSize: '16pt', height: '297mm', boxSizing: 'border-box' }}>
              <div>
                <h2 className="text-center font-bold" style={{ fontSize: '18pt', marginBottom: '4px' }}>ทะเบียนรูปนักกีฬา</h2>
                <p className="text-center font-bold" style={{ fontSize: '16pt', marginBottom: '8px' }}>
                  {matchTitle}
                </p>
                <div className="mb-4 text-center font-bold" style={{ fontSize: '16pt' }}>
                  ชื่อหน่วยกีฬา <span style={{ borderBottom: '1px dotted #000', paddingLeft: '20px', paddingRight: '20px', display: 'inline-block', minWidth: '300px' }}>{reportTeamName || '.........................................................................'}</span>
                </div>

                {renderTeamBlockPrint(
                  `รุ่นอายุไม่เกิน ${toThaiNumerals(reportAgeGroup)} ปี เพศ ชาย ประเภททีม ๓ คน (นักกีฬาสำรอง ๑ คน)`,
                  activeMixedTeamMale,
                  1
                )}

                {renderTeamBlockPrint(
                  `รุ่นอายุไม่เกิน ${toThaiNumerals(reportAgeGroup)} ปี เพศ หญิง ประเภททีม ๓ คน (นักกีฬาสำรอง ๑ คน)`,
                  activeMixedTeamFemale,
                  2
                )}
              </div>

              <div className="mt-2" style={{ pageBreakInside: 'avoid' }}>
                <p className="text-center font-bold mb-4" style={{ fontSize: '15pt' }}>ขอรับรองคุณสมบัตินักกีฬาถูกต้องทุกประการ</p>
                <table style={{ width: '100%', border: 'none', marginTop: '4px' }}>
                  <tbody>
                    <tr style={{ border: 'none' }}>
                      <td style={{ border: 'none', width: '50%' }}></td>
                      <td style={{ border: 'none', textAlign: 'center', width: '50%', fontSize: '16pt', lineHeight: '1.2' }}>
                        <p>ลงชื่อ <span style={{ display: 'inline-block', width: '180px', borderBottom: '1px dotted #000' }}></span> หัวหน้าหน่วยกีฬา</p>
                        <p style={{ marginTop: '3px' }}>( <u>{"\u00a0\u00a0"}{reportManagerName || '........................................................'}{"\u00a0\u00a0"}</u> )</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}


        {/* 6. PRINT PETANQUE (ทะเบียนรูปนักกีฬาเปตอง) */}
        {printType === 'PETANQUE' && (() => {
          const edNo = selectedYear ? parseInt(selectedYear) - 2492 : 77;
          const edThai = toThaiNumerals(edNo);
          const yearThai = toThaiNumerals(selectedYear || 2569);
          const allRegs = [...registrations, ...provRegistrations];
          const isLocal = petanqueCompType === 'local';
          const activeTeam1 = isLocal ? petanqueTeam1Local : petanqueTeam1;
          const activeTeam2 = isLocal ? petanqueTeam2Local : petanqueTeam2;
          const activePhotos = isLocal ? petanqueTeamPhotosLocal : petanqueTeamPhotos;

          const renderTeamBlockPrint = (title: string, teamIds: string[], teamIndex: number) => {
            return (
              <div className="border border-black p-4 mb-4 bg-white" style={{ fontSize: '15pt', lineHeight: '1.25' }}>
                <p className="text-center font-bold mb-3" style={{ fontSize: '16pt' }}>
                  {title}
                </p>
                <div className="grid grid-cols-4 gap-3 justify-items-center">
                  {teamIds.map((id, idx) => {
                    const p = allRegs.find(r => r.id === id) || null;
                    const globalIdx = (teamIndex - 1) * 4 + idx;
                    const customPhoto = activePhotos[globalIdx];
                    const hasPhoto = customPhoto || (p && p.photo_url);
                    const isPhotoBroken = p ? (brokenImages[p.id] && !customPhoto) : !customPhoto;
                    return (
                      <div key={idx} className="flex flex-col items-center w-full">
                        <div className="w-[100px] h-[130px] border border-black flex items-center justify-center bg-slate-50 overflow-hidden relative">
                          {hasPhoto && !isPhotoBroken ? (
                            <img 
                              src={customPhoto || (p ? p.photo_url : '')} 
                              alt="pic" 
                              className="w-full h-full object-cover"
                              onLoad={(e) => p && handleImageLoad(p.id, e)}
                              onError={() => p && handleImageError(p.id)} 
                            />
                          ) : (
                            <span className="text-[10px] text-slate-400 text-center font-normal px-1">
                              รูปถ่าย<br/>{idx === 3 ? 'สำรอง' : `คนที่ ${idx + 1}`}
                            </span>
                          )}
                        </div>
                        <div className="text-center mt-2 w-full text-[14pt] leading-tight font-normal font-sans">
                          <div className="truncate">ชื่อ {p ? `${p.prefix || (reportGender === 'male' ? 'ด.ช.' : 'ด.ญ.')}${p.first_name}` : '.......................................'}</div>
                          <div className="truncate mt-1">นามสกุล {p ? p.last_name : '.......................................'}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          };

          const matchTitle = isLocal
            ? `การแข่งขันกีฬาเปตอง เด็ก เยาวชนและประชาชน ตำบลเขาชัยสน ครั้งที่ ${edThai} ประจำปี พ.ศ. ${yearThai}`
            : `การแข่งขันกีฬาเปตองกีฬานักเรียน นักศึกษา และประชาชนจังหวัดพัทลุง ครั้งที่ ${edThai} ประจำปี ${yearThai}`;

          return (
            <div className="official-page-break flex flex-col justify-between py-6" style={{ fontSize: '16pt', height: '297mm', boxSizing: 'border-box' }}>
              <div>
                <h2 className="text-center font-bold" style={{ fontSize: '18pt', marginBottom: '4px' }}>ทะเบียนรูปนักกีฬา</h2>
                <p className="text-center font-bold" style={{ fontSize: '16pt', marginBottom: '8px' }}>
                  {matchTitle}
                </p>
                <div className="mb-4 text-center font-bold" style={{ fontSize: '16pt' }}>
                  ชื่อหน่วยกีฬา <span style={{ borderBottom: '1px dotted #000', paddingLeft: '20px', paddingRight: '20px', display: 'inline-block', minWidth: '300px' }}>{reportTeamName || '.........................................................................'}</span>
                </div>

                {renderTeamBlockPrint(
                  `รุ่นอายุไม่เกิน ${toThaiNumerals(reportAgeGroup)} ปี เพศ ${reportGender === 'male' ? 'ชาย' : 'หญิง'} ประเภททีม ๓ คน (นักกีฬาสำรอง ๑ คน)`,
                  activeTeam1,
                  1
                )}

                {renderTeamBlockPrint(
                  `รุ่นอายุไม่เกิน ${toThaiNumerals(reportAgeGroup)} ปี เพศ ${reportGender === 'male' ? 'ชาย' : 'หญิง'} ประเภททีม ๓ คน (นักกีฬาสำรอง ๑ คน)`,
                  activeTeam2,
                  2
                )}
              </div>

              <div className="mt-2" style={{ pageBreakInside: 'avoid' }}>
                <p className="text-center font-bold mb-4" style={{ fontSize: '15pt' }}>ขอรับรองคุณสมบัตินักกีฬาถูกต้องทุกประการ</p>
                <table style={{ width: '100%', border: 'none', marginTop: '4px' }}>
                  <tbody>
                    <tr style={{ border: 'none' }}>
                      <td style={{ border: 'none', width: '50%' }}></td>
                      <td style={{ border: 'none', textAlign: 'center', width: '50%', fontSize: '16pt', lineHeight: '1.2' }}>
                        <p>ลงชื่อ <span style={{ display: 'inline-block', width: '180px', borderBottom: '1px dotted #000' }}></span> หัวหน้าหน่วยกีฬา</p>
                        <p style={{ marginTop: '3px' }}>( <u>{"\u00a0\u00a0"}{reportManagerName || '........................................................'}{"\u00a0\u00a0"}</u> )</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

      </div>
    );
  }


    // Regular Admin view
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Top Banner and Year Selection */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <Trophy size={32} className="text-emerald-600 animate-pulse" />
            งานลงทะเบียนนักกีฬา
          </h2>
          <p className="text-slate-400 font-bold mt-1 uppercase tracking-widest text-xs">
            Student Sports Registration & Athlete Cards Generator
          </p>
        </div>
        
        {/* Year Dropdown */}
        <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm shrink-0">
          <span className="text-xs font-black text-slate-400 uppercase tracking-wider pl-2">ปีการศึกษา</span>
          <div className="relative w-36">
            <select 
              value={selectedYear} 
              disabled={editingRegId !== null}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-black text-slate-700 appearance-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-hidden cursor-pointer disabled:opacity-50"
            >
              {academicYears.map(year => (
                <option key={year} value={year}>พ.ศ. {year}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>
        </div>
      </div>

      {/* Tabs Menu inside module */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('register')}
          className={`px-5 py-3 text-sm font-black transition-all whitespace-nowrap ${
            activeSubTab === 'register' 
              ? 'border-b-2 border-emerald-600 text-emerald-700 scale-102' 
              : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          📝 กรีฑาตำบล
        </button>
        <button
          onClick={() => setActiveSubTab('provincial')}
          className={`px-5 py-3 text-sm font-black transition-all whitespace-nowrap ${
            activeSubTab === 'provincial' 
              ? 'border-b-2 border-indigo-600 text-indigo-700 scale-102' 
              : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          ⚽ กีฬาจังหวัดพัทลุง
        </button>
        <button
          onClick={() => setActiveSubTab('reports')}
          className={`px-5 py-3 text-sm font-black transition-all whitespace-nowrap ${
            activeSubTab === 'reports' 
              ? 'border-b-2 border-emerald-600 text-emerald-700 scale-102' 
              : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          📋 รายงานกรีฑา (A1, A2, A3)
        </button>
      </div>

      {/* SUB TAB: REGISTER & LIST */}
      {activeSubTab === 'register' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Form Registration */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
              <h3 className="font-black text-slate-800 mb-6 flex items-center justify-between border-b border-slate-50 pb-4">
                <span className="flex items-center gap-2">
                  <UserPlus size={20} className="text-emerald-500" />
                  {editingRegId ? 'แก้ไขการลงทะเบียน' : 'ลงทะเบียนใหม่'}
                </span>
                {editingRegId && (
                  <button 
                    onClick={resetForm}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-black transition-colors"
                  >
                    ยกเลิกแก้ไข
                  </button>
                )}
              </h3>

              <form onSubmit={handleRegister} className="space-y-4">
                
                {/* Search Box */}
                <div className="space-y-1.5 relative" ref={suggestionRef}>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ค้นหานักเรียน</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      disabled={editingRegId !== null}
                      placeholder="พิมพ์ชื่อ สกุล หรือเลขประจำตัว..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-8 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all disabled:opacity-75"
                    />
                    {searchQuery && !editingRegId && (
                      <button 
                        type="button" 
                        onClick={() => { 
                          setSelectedStudent(null); 
                          setSearchQuery(''); 
                          setCitizenId('');
                          setSportId('');
                          setPhotoFile(null);
                          setPhotoPreview(null);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Suggestion list */}
                  {showSuggestions && !editingRegId && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-50">
                      {searchingStudents ? (
                        <div className="p-4 text-center text-xs text-slate-400 font-bold flex items-center justify-center gap-2">
                          <Loader2 className="animate-spin text-emerald-500" size={14} /> กำลังค้นหา...
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400 italic font-bold">ไม่พบรายชื่อนักเรียนในปีการศึกษานี้</div>
                      ) : (
                        searchResults.map(student => (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => handleSelectStudent(student)}
                            className="w-full text-left p-3 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                          >
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                              {student.photo_url ? (
                                <img src={student.photo_url} alt="pic" className="w-full h-full object-cover" />
                              ) : (
                                student.first_name.charAt(0)
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-black text-slate-800 truncate">
                                {student.prefix}{student.first_name} {student.last_name}
                              </p>
                              <p className="text-[9px] text-slate-400 font-bold">
                                ชั้น {student.class_level}/{student.room} | เลขประจำตัว {student.student_id}
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Student Detail Preview */}
                {selectedStudent && (
                  <div className="p-4 bg-emerald-50/30 border border-emerald-100 rounded-xl space-y-3 animate-in slide-in-from-top-4 duration-300">
                    <div className="flex gap-3 items-center">
                      <div className="w-12 h-16 border border-emerald-200 rounded-lg bg-white overflow-hidden shrink-0 flex items-center justify-center">
                        {photoPreview ? (
                          <img 
                            src={photoPreview} 
                            alt="Profile Preview" 
                            className={`w-full h-full ${imageAspects['preview'] === 'landscape' ? 'object-contain bg-slate-50 p-0.5' : 'object-cover'}`} 
                            onLoad={(e) => handleImageLoad('preview', e)}
                            onError={(e) => {
                              e.currentTarget.src = '';
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <User className="text-emerald-200" size={24} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-xs text-slate-600">
                        <p className="font-black text-emerald-800 text-sm truncate">
                          {selectedStudent.prefix}{selectedStudent.first_name} {selectedStudent.last_name}
                        </p>
                        <p className="font-extrabold mt-1">ชั้นเรียน: <span className="text-slate-900">ม. {selectedStudent.class_level}/{selectedStudent.room}</span></p>
                        <p className="font-extrabold">อายุ: <span className="text-slate-900">{calculateAge(selectedStudent.birth_date)}</span></p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Image Upload Option */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">รูปถ่ายหน้าตรงนักกีฬา (ใช้ติดบัตร/เอกสาร A1)</label>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 py-3 px-3 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl font-bold text-slate-600 text-xs flex items-center justify-center gap-1.5 transition-all animate-in fade-in"
                    >
                      <Upload size={14} /> เลือกรูปภาพ...
                    </button>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="flex-1 py-3 px-3 bg-emerald-50 hover:bg-emerald-100 border border-dashed border-emerald-200 text-emerald-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Camera size={14} /> ถ่ายรูปจากกล้อง...
                    </button>
                    {(photoFile || photoPreview) && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoFile(null);
                          setPhotoPreview(selectedStudent?.photo_url || null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="p-3 bg-red-50 hover:bg-red-100 border border-red-100 text-red-500 rounded-xl transition-all"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {photoFile && (
                    <p className="text-[9px] text-amber-600 font-extrabold mt-1">
                      * มีการเลือกไฟล์ภาพใหม่: {photoFile.name} (ระบบจะบีบอัดภาพเพื่อใช้ปริ้นต์และออก PDF ทันทีค่ะ)
                    </p>
                  )}
                </div>

                {/* Citizen ID */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">เลขประจำตัวประชาชน (13 หลัก)</label>
                  <input
                    type="text"
                    placeholder="ระบบจะดึงมาให้อัตโนมัติ"
                    value={citizenId}
                    onChange={(e) => setCitizenId(e.target.value)}
                    className="w-full px-3 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 text-xs outline-hidden focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500"
                  />
                </div>

                {/* Sport ID */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">หมายเลขประจำตัวนักกีฬา (Sport ID / หน่วยกีฬา)</label>
                  <input
                    type="text"
                    placeholder="ระบุหมายเลข เช่น 002"
                    value={sportId}
                    onChange={(e) => setSportId(e.target.value)}
                    className="w-full px-3 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 text-xs outline-hidden focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500"
                  />

                {/* สถานะตัวจริง/ตัวสำรอง */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">สถานะการลงทะเบียน</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsSubstitute(false)}
                      className={`py-2.5 rounded-xl font-black text-xs transition-all ${
                        !isSubstitute
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      ✅ ตัวจริง
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSubstitute(true)}
                      className={`py-2.5 rounded-xl font-black text-xs transition-all ${
                        isSubstitute
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      🔄 ตัวสำรอง
                    </button>
                  </div>
                  {isSubstitute && (
                    <p className="text-[9px] text-amber-600 font-extrabold mt-1">
                      * นักกีฬาคนนี้จะถูกบันทึกเป็นตัวสำรองสำหรับประเภทนี้ค่ะ
                    </p>
                  )}
                </div>
                </div>

                {/* Sport Type - แสดงตามรุ่นอายุที่เลือก */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                    ชนิด/ประเภทกีฬา {ageGroup ? (editingRegId ? '' : '(เลือกได้มากกว่า 1 รายการ)') : '(เลือกรุ่นอายุก่อน)'}
                  </label>
                  
                  {!editingRegId ? (
                    // โหมดลงทะเบียนใหม่: แสดง Multi-select Checkboxes
                    <div className="space-y-2">
                      <div className={`border border-slate-100 rounded-xl bg-slate-50 p-2.5 max-h-56 overflow-y-auto transition-all ${!ageGroup ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="grid grid-cols-1 gap-1.5">
                          {(ageGroup ? getSportTypesForAge(ageGroup) : SPORT_TYPES).map(st => {
                            const isChecked = selectedSports.includes(st);
                            return (
                              <div
                                key={st}
                                onClick={() => {
                                  if (!ageGroup) return;
                                  if (isChecked) {
                                    setSelectedSports(selectedSports.filter(s => s !== st));
                                  } else {
                                    setSelectedSports([...selectedSports, st]);
                                  }
                                }}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer select-none transition-all ${
                                  isChecked
                                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                                    : 'bg-white border-slate-100 text-slate-700 hover:bg-slate-50/50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  readOnly
                                  className="w-3.5 h-3.5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500/20 pointer-events-none"
                                />
                                <span className="text-xs font-bold">{st}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      {selectedSports.includes('อื่นๆ') && (
                        <input
                          type="text"
                          placeholder="ระบุชนิดกีฬาเพิ่มเติม..."
                          value={customSportType}
                          onChange={(e) => setCustomSportType(e.target.value)}
                          className="w-full px-3 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 text-xs outline-hidden focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 animate-in slide-in-from-top-1 duration-200"
                        />
                      )}
                    </div>
                  ) : (
                    // โหมดแก้ไข: แสดง Single select dropdown เหมือนเดิม เพื่อให้สามารถแก้ไขกีฬาแบบเจาะจงได้
                    <div className="space-y-2">
                      <div className="relative">
                        <select
                          value={sportType}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSportType(val);
                            setSelectedSports(val ? [val] : []);
                          }}
                          disabled={!ageGroup}
                          className="w-full pl-3 pr-10 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 appearance-none cursor-pointer outline-hidden disabled:opacity-50"
                        >
                          <option value="">-- เลือกชนิดกีฬา --</option>
                          {(ageGroup ? getSportTypesForAge(ageGroup) : SPORT_TYPES).map(st => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                      </div>
                      
                      {sportType === 'อื่นๆ' && (
                        <input
                          type="text"
                          placeholder="ระบุชนิดกีฬา..."
                          value={customSportType}
                          onChange={(e) => setCustomSportType(e.target.value)}
                          className="w-full px-3 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 text-xs outline-hidden focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500"
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Age Group */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">รุ่นอายุ</label>
                  <div className="relative">
                    <select
                      value={ageGroup}
                      onChange={(e) => setAgeGroup(e.target.value)}
                      className="w-full pl-3 pr-10 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 appearance-none cursor-pointer outline-hidden"
                    >
                      <option value="">-- เลือกรุ่นอายุ --</option>
                      {AGE_GROUPS.map(ag => (
                        <option key={ag} value={ag}>{ag}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                  </div>
                  {ageGroup === 'อื่นๆ' && (
                    <input
                      type="text"
                      placeholder="ระบุรุ่นอายุ..."
                      value={customAgeGroup}
                      onChange={(e) => setCustomAgeGroup(e.target.value)}
                      className="w-full px-3 py-3 mt-1.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 text-xs outline-hidden"
                    />
                  )}
                </div>

                {/* Shirt Size */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">ขนาดเสื้อ</label>
                  <div className="relative">
                    <select
                      value={shirtSize}
                      onChange={(e) => setShirtSize(e.target.value)}
                      className="w-full pl-3 pr-10 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 appearance-none cursor-pointer outline-hidden"
                    >
                      {SHIRT_SIZES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                  </div>
                </div>

                {/* Coach Name - ดึงจากรายชื่อครู หรือพิมพ์เอง */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">ผู้ฝึกสอน/ผู้ควบคุมประจำประเภทกีฬา</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select
                        value={coachFromTeacher}
                        onChange={(e) => {
                          setCoachFromTeacher(e.target.value);
                          if (e.target.value) {
                            const teacher = teachersList.find(t => t.id === e.target.value);
                            if (teacher) {
                              setCoachName(`${teacher.prefix}${teacher.first_name} ${teacher.last_name}`);
                              setCoachPhone(teacher.phone || '');
                            }
                          }
                        }}
                        className="w-full pl-3 pr-10 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 appearance-none cursor-pointer outline-hidden"
                      >
                        <option value="">-- เลือกจากรายชื่อครู หรือพิมพ์เอง --</option>
                        {teachersList.map(t => (
                          <option key={t.id} value={t.id}>{t.prefix}{t.first_name} {t.last_name} ({t.position || 'ครู'})</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="ชื่อผู้ฝึกสอน (พิมพ์เองได้)"
                    value={coachName}
                    onChange={(e) => setCoachName(e.target.value)}
                    className="w-full px-3 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 text-xs outline-hidden focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500"
                  />
                </div>

                {/* Coach Phone */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">เบอร์โทรผู้ฝึกสอน</label>
                  <input
                    type="text"
                    placeholder="เบอร์โทร"
                    value={coachPhone}
                    onChange={(e) => setCoachPhone(e.target.value)}
                    className="w-full px-3 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 text-xs outline-hidden focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className={`w-full mt-6 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg ${
                    editingRegId ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-100' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'
                  } disabled:opacity-50`}
                >
                  {submitting ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <>
                      {editingRegId ? (
                        <>
                          <Save size={16} /> บันทึกการแก้ไข
                        </>
                      ) : (
                        <>
                          <Plus size={16} /> บันทึกการลงทะเบียน
                        </>
                      )}
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>


          {/* Right Column: Registration Record List */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Filter Bar */}
            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อนักกีฬา/ผู้ฝึกสอน/เลขประชาชน..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 text-xs outline-hidden focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="flex flex-wrap gap-3 w-full md:w-auto justify-end">
                <div className="relative w-full sm:w-40">
                  <select
                    value={filterSport}
                    onChange={(e) => setFilterSport(e.target.value)}
                    className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-black text-slate-600 appearance-none outline-hidden cursor-pointer"
                  >
                    <option value="all">กีฬา: ทั้งหมด</option>
                    {uniqueSports.map(sport => (
                      <option key={sport} value={sport}>{sport}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
                </div>

                <div className="relative w-full sm:w-44">
                  <select
                    value={filterAge}
                    onChange={(e) => setFilterAge(e.target.value)}
                    className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-black text-slate-600 appearance-none outline-hidden cursor-pointer"
                  >
                    <option value="all">รุ่นอายุ: ทั้งหมด</option>
                    {uniqueAges.map(age => (
                      <option key={age} value={age}>{age}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
                </div>

                <button
                  onClick={handlePrintAllFiltered}
                  className="px-4 py-2.5 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center gap-2 shadow-md shadow-slate-200 cursor-pointer"
                >
                  <Printer size={14} /> พิมพ์บัตร / บันทึก PDF ({filteredRegs.length})
                </button>
              </div>
            </div>

            {/* List Table */}
            <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
              
              {/* PDF Export Banner */}
              <div className="bg-emerald-50 text-emerald-800 p-4 rounded-2xl border border-emerald-100 flex gap-3 text-xs font-bold leading-relaxed mb-6 animate-in fade-in">
                <Info className="shrink-0 text-emerald-600 mt-0.5" size={18} />
                <div>
                  <p className="font-black text-emerald-950">💡 คำแนะนำการส่งออกและบันทึกเป็นไฟล์ PDF:</p>
                  <p className="mt-1">
                    เมื่อกดปุ่ม <span className="font-black">"พิมพ์บัตร / บันทึก PDF"</span> หรือปุ่มเครื่องพิมพ์ของแต่ละคน หน้าต่างระบบพิมพ์จะปรากฏขึ้น ให้เลือกปลายทาง (Destination) เป็น <span className="font-black">"บันทึกเป็น PDF" (Save as PDF)</span> เพื่อเซฟไฟล์ลงเครื่องได้ทันทีค่ะ
                  </p>
                </div>
              </div>

              <h3 className="font-black text-slate-800 mb-6 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText size={20} className="text-emerald-500" />
                  รายชื่อผู้ลงทะเบียนรับบัตรนักกีฬา ({filteredRegs.length} รายการ)
                </span>
                <button 
                  onClick={fetchRegistrations}
                  className="p-2 bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <RefreshCw size={14} className={loadingRegs ? 'animate-spin' : ''} />
                </button>
              </h3>

              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="py-4 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">ข้อมูลนักเรียน</th>
                      <th className="py-4 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">ประเภทกีฬา / รุ่นอายุ</th>
                      <th className="py-4 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">เลขประชาชน / หมายเลข</th>
                      <th className="py-4 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">ผู้ฝึกสอนประจำ</th>
                      <th className="py-4 px-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">ขนาดเสื้อ</th>
                      <th className="py-4 px-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loadingRegs ? (
                      <tr>
                        <td colSpan={6} className="py-20 text-center">
                          <Loader2 className="animate-spin mx-auto text-emerald-500 mb-3" size={32} />
                          <span className="text-slate-400 font-bold text-xs">กำลังดึงข้อมูล...</span>
                        </td>
                      </tr>
                    ) : filteredRegs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-20 text-center text-slate-400 font-bold italic">
                          ไม่มีรายชื่อนักกีฬาลงทะเบียนตรงตามเงื่อนไขที่เลือก
                        </td>
                      </tr>
                    ) : (
                      filteredRegs.map(reg => {
                        const isPhotoBroken = brokenImages[reg.id] || !reg.photo_url;
                        return (
                          <tr key={reg.id} className="group hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-3">
                              <div className="flex items-center gap-3">
                                <div 
                                  onClick={() => {
                                    setQuickPhotoReg(reg);
                                    setQuickPhotoPreview(reg.photo_url || null);
                                    setQuickPhotoFile(null);
                                  }}
                                  className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer relative group/avatar transition-all hover:scale-105 active:scale-95"
                                  title="คลิกเพื่อเพิ่ม/เปลี่ยนรูปภาพนักกีฬา"
                                >
                                  {!isPhotoBroken ? (
                                    <img 
                                      src={reg.photo_url} 
                                      alt="Photo" 
                                      className={`w-full h-full ${imageAspects[reg.id] === 'landscape' ? 'object-contain bg-slate-100' : 'object-cover'} group-hover/avatar:opacity-40 transition-opacity`} 
                                      onLoad={(e) => handleImageLoad(reg.id, e)}
                                      onError={() => handleImageError(reg.id)} 
                                    />
                                  ) : (
                                    <div className="flex flex-col items-center justify-center text-slate-400 group-hover/avatar:text-emerald-600 transition-colors">
                                      <Camera size={14} className="stroke-[2.5]" />
                                      <span className="text-[7px] font-black mt-0.5">เพิ่มรูป</span>
                                    </div>
                                  )}
                                  
                                  {!isPhotoBroken && (
                                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center text-white transition-opacity">
                                      <Camera size={14} />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <p className="font-black text-slate-800 text-xs">{reg.prefix}{reg.first_name} {reg.last_name}</p>
                                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">ม. {reg.class_level}/{reg.room} | อายุ {calculateAge(reg.birth_date)}</p>
                                </div>
                              </div>
                            </td>

                            <td className="py-4 px-3">
                              <p className="font-extrabold text-slate-800 text-xs">{reg.sport_type}</p>
                              <span className="inline-block px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-black border border-emerald-100/50 mt-1">
                                {reg.age_group}
                              </span>
                              {reg.is_substitute && (
                                <span className="inline-block ml-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[9px] font-black border border-amber-100/50 mt-1">
                                  🔄 ตัวสำรอง
                                </span>
                              )}
                            </td>

                            <td className="py-4 px-3 text-xs">
                              <p className="font-mono text-slate-700 font-extrabold">{reg.citizen_id || '-'}</p>
                              <p className="text-[10px] text-slate-400 font-bold mt-0.5">หมายเลขนักกีฬา: <span className="font-extrabold text-emerald-700">{reg.sport_id || '-'}</span></p>
                            </td>

                            <td className="py-4 px-3 text-xs">
                              {reg.coach_name ? (
                                <>
                                  <p className="font-extrabold text-slate-700 leading-tight">{reg.coach_name}</p>
                                  {reg.coach_phone && (
                                    <p className="text-[10px] text-slate-400 font-bold mt-0.5 flex items-center gap-1"><Phone size={10} /> {reg.coach_phone}</p>
                                  )}
                                </>
                              ) : (
                                <span className="text-slate-400 italic">ไม่ระบุ</span>
                              )}
                            </td>

                            <td className="py-4 px-3 text-center font-black text-slate-700 text-xs">{reg.shirt_size}</td>

                            <td className="py-4 px-3">
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => handlePrintCard(reg)} className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 border border-emerald-100" title="พิมพ์บัตรนักกีฬา"><Printer size={14} /></button>
                                <button onClick={() => handleEdit(reg)} className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 border border-amber-100" title="แก้ไขข้อมูลลงทะเบียน"><Edit2 size={14} /></button>
                                <button onClick={() => handleDelete(reg.id, `${reg.prefix}${reg.first_name} ${reg.last_name}`)} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 border border-red-100" title="ลบรายชื่อ"><Trash2 size={14} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB: OFFICIAL REPORTS (A1, A2, A3) */}
      {activeSubTab === 'reports' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Report Controls */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
              <h3 className="font-black text-slate-800 border-b border-slate-50 pb-4 flex items-center gap-2">
                <FileText size={20} className="text-emerald-500" />
                ตั้งค่ารายงานราชการ
              </h3>

              {/* Report Type Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">ประเภทเอกสารรายงาน</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['A1', 'A2', 'A3', 'CERT', 'PETANQUE', 'PETANQUE_MIXED'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSelectedReportType(type)}
                      className={`py-2.5 rounded-xl font-black text-[9px] transition-all ${
                        selectedReportType === type
                          ? type === 'CERT' 
                            ? 'bg-indigo-600 text-white shadow-md' 
                            : type === 'PETANQUE' || type === 'PETANQUE_MIXED'
                              ? 'bg-amber-600 text-white shadow-md'
                              : 'bg-emerald-600 text-white shadow-md'
                          : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {type === 'CERT' 
                        ? '📜 รับรอง' 
                        : type === 'PETANQUE' 
                          ? '🏓 เปตอง (แยก)' 
                          : type === 'PETANQUE_MIXED'
                            ? '🏓 เปตอง (รวม)'
                            : `แบบ ${type}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* สำหรับเปตอง ให้เลือกประเภทการแข่งขัน (อบต. vs จังหวัด) */}
              {(selectedReportType === 'PETANQUE' || selectedReportType === 'PETANQUE_MIXED') && (
                <div className="space-y-1.5 p-3 bg-amber-50 rounded-xl border border-amber-100/60 animate-in slide-in-from-top-2">
                  <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest block">ระดับการแข่งขันเปตอง</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPetanqueCompType('local')}
                      className={`py-2 rounded-lg font-black text-xs transition-all ${
                        petanqueCompType === 'local'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-white text-amber-600 hover:bg-amber-50 border border-amber-200'
                      }`}
                    >
                      🏆 กีฬา อบต.
                    </button>
                    <button
                      type="button"
                      onClick={() => setPetanqueCompType('provincial')}
                      className={`py-2 rounded-lg font-black text-xs transition-all ${
                        petanqueCompType === 'provincial'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-white text-amber-600 hover:bg-amber-50 border border-amber-200'
                      }`}
                    >
                      ⚽ กีฬาจังหวัด
                    </button>
                  </div>
                </div>
              )}


              {/* Age Filter for Report */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">รุ่นอายุที่จะออกรายงาน</label>
                <div className="relative">
                  <select
                    value={reportAgeGroup}
                    onChange={(e) => setReportAgeGroup(e.target.value)}
                    className="w-full pl-3 pr-10 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 appearance-none cursor-pointer outline-hidden"
                  >
                    <option value="6">รุ่นอายุไม่เกิน 6 ปี</option>
                    <option value="8">รุ่นอายุไม่เกิน 8 ปี</option>
                    <option value="10">รุ่นอายุไม่เกิน 10 ปี</option>
                    <option value="12">รุ่นอายุไม่เกิน 12 ปี</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                </div>
              </div>

              {/* Gender Filter for Report */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">เพศนักกีฬา</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReportGender('male')}
                    className={`py-2.5 rounded-xl font-black text-xs transition-all ${
                      reportGender === 'male'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    ชาย
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportGender('female')}
                    className={`py-2.5 rounded-xl font-black text-xs transition-all ${
                      reportGender === 'female'
                        ? 'bg-rose-500 text-white shadow-xs'
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    หญิง
                  </button>
                </div>
              </div>

              {/* Unit Code (Sport ID Code) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">หมายเลขหน่วยกีฬา (รหัสย่อโรงเรียน)</label>
                <input
                  type="text"
                  placeholder="เช่น 002"
                  value={reportUnitCode}
                  onChange={(e) => setReportUnitCode(e.target.value)}
                  className="w-full px-3 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 text-xs outline-hidden"
                />
              </div>

              {/* School Team Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">ชื่อสังกัดทีม (โรงเรียน)</label>
                <input
                  type="text"
                  value={reportTeamName}
                  onChange={(e) => setReportTeamName(e.target.value)}
                  className="w-full px-3 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 text-xs outline-hidden"
                />
              </div>

              {/* Team Manager */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">ชื่อผู้จัดการทีม (ผอ.โรงเรียน)</label>
                <input
                  type="text"
                  placeholder="ระบุชื่อผู้จัดการทีม..."
                  value={reportManagerName}
                  onChange={(e) => setReportManagerName(e.target.value)}
                  className="w-full px-3 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 text-xs outline-hidden"
                />
              </div>

              {/* Manager Phone */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">เบอร์โทรผู้จัดการทีม</label>
                <input
                  type="text"
                  placeholder="ระบุเบอร์โทร..."
                  value={reportManagerPhone}
                  onChange={(e) => setReportManagerPhone(e.target.value)}
                  className="w-full px-3 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 text-xs outline-hidden"
                />
              </div>

              {/* Petanque Team Configuration Dropdowns */}
              {selectedReportType === 'PETANQUE' && (() => {
                const isLocal = petanqueCompType === 'local';
                const activeTeam1 = isLocal ? petanqueTeam1Local : petanqueTeam1;
                const activeTeam2 = isLocal ? petanqueTeam2Local : petanqueTeam2;
                const activePhotos = isLocal ? petanqueTeamPhotosLocal : petanqueTeamPhotos;
                
                return (
                  <div className="mt-4 p-4 bg-amber-50/40 border border-amber-200/60 rounded-2xl space-y-4 animate-in slide-in-from-top-2">
                    <div className="flex justify-between items-center border-b border-amber-200/50 pb-2">
                      <h4 className="font-black text-amber-800 text-xs uppercase tracking-widest">
                        จัดทีมเปตอง (3 คน สำรอง 1)
                      </h4>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleAutoFillPetanque}
                          className="text-[10px] font-black text-emerald-600 hover:text-emerald-800 transition-colors"
                        >
                          ⚡ ออโต้ฟิล
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (isLocal) {
                              setPetanqueTeam1Local(['', '', '', '']);
                              setPetanqueTeam2Local(['', '', '', '']);
                              setPetanqueTeamPhotosLocal(Array(8).fill(''));
                            } else {
                              setPetanqueTeam1(['', '', '', '']);
                              setPetanqueTeam2(['', '', '', '']);
                              setPetanqueTeamPhotos(Array(8).fill(''));
                            }
                          }}
                          className="text-[10px] font-black text-red-500 hover:text-red-700 transition-colors"
                        >
                          🗑️ ล้างทีม
                        </button>
                      </div>
                    </div>
                    
                    {/* ทีมที่ 1 */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-amber-900/60">ทีมที่ 1</p>
                      {[0, 1, 2, 3].map((pos) => {
                        const label = pos === 3 ? 'ตัวสำรอง' : `คนที่ ${pos + 1}`;
                        const globalIdx = pos;
                        const studentId = activeTeam1[pos];
                        const allRegs = [...registrations, ...provRegistrations];
                        const candidate = allRegs.find(r => r.id === studentId);
                        const displayPhoto = activePhotos[globalIdx] || (candidate ? candidate.photo_url : '');
                        
                        return (
                          <div key={pos} className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-bold w-12 shrink-0">{label}:</span>
                            <select
                              value={activeTeam1[pos]}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (isLocal) {
                                  setPetanqueTeam1Local(prev => {
                                    const next = [...prev];
                                    next[pos] = val;
                                    return next;
                                  });
                                } else {
                                  setPetanqueTeam1(prev => {
                                    const next = [...prev];
                                    next[pos] = val;
                                    return next;
                                  });
                                }
                              }}
                              className="flex-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 min-w-0"
                            >
                              <option value="">-- เลือกนักกีฬา (หรือปล่อยว่าง) --</option>
                              {getPetanqueCandidates().map(c => {
                                const isMale = c.gender === 'male' || c.gender === 'ชาย' || c.gender === 'ช' || c.age_group.includes('ชาย');
                                const displayPrefix = c.prefix || (isMale ? 'ด.ช.' : 'ด.ญ.');
                                return (
                                  <option key={c.id} value={c.id}>
                                    {displayPrefix}{c.first_name} {c.last_name} ({c.sport_type})
                                  </option>
                                );
                              })}
                            </select>

                            {/* อัปโหลดรูปภาพเฉพาะเปตอง */}
                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                type="file"
                                accept="image/*"
                                id={`pet-photo-${globalIdx}`}
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] || null;
                                  if (isLocal) {
                                    handlePetanquePhotoChangeLocal(globalIdx, file);
                                  } else {
                                    handlePetanquePhotoChange(globalIdx, file);
                                  }
                                }}
                              />
                              {displayPhoto ? (
                                <div className="relative group w-8 h-8 rounded border border-amber-300 overflow-hidden bg-slate-100 flex items-center justify-center">
                                  <img src={displayPhoto} className="w-full h-full object-cover" alt="prev" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isLocal) {
                                        handlePetanquePhotoChangeLocal(globalIdx, null);
                                      } else {
                                        handlePetanquePhotoChange(globalIdx, null);
                                      }
                                    }}
                                    className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    title={activePhotos[globalIdx] ? "ล้างรูปเฉพาะ (กลับไปใช้รูปหลัก)" : "มีรูปจากระบบหลักแล้ว"}
                                    disabled={!activePhotos[globalIdx]}
                                  >
                                    {activePhotos[globalIdx] ? <X size={10} /> : <Camera size={10} />}
                                  </button>
                                </div>
                              ) : (
                                <label
                                  htmlFor={`pet-photo-${globalIdx}`}
                                  className="w-8 h-8 rounded border border-slate-200 hover:border-amber-400 bg-white hover:bg-amber-50 text-slate-400 hover:text-amber-600 flex items-center justify-center cursor-pointer transition-colors"
                                  title="อัปโหลดรูปเฉพาะในใบนี้"
                                >
                                  <Camera size={14} />
                                </label>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* ทีมที่ 2 */}
                    <div className="space-y-2 pt-2 border-t border-amber-200/40">
                      <p className="text-[10px] font-black text-amber-900/60">ทีมที่ 2 (ส่งเพิ่ม/ตัวเลือก)</p>
                      {[0, 1, 2, 3].map((pos) => {
                        const label = pos === 3 ? 'ตัวสำรอง' : `คนที่ ${pos + 1}`;
                        const globalIdx = 4 + pos;
                        const studentId = activeTeam2[pos];
                        const allRegs = [...registrations, ...provRegistrations];
                        const candidate = allRegs.find(r => r.id === studentId);
                        const displayPhoto = activePhotos[globalIdx] || (candidate ? candidate.photo_url : '');
                        
                        return (
                          <div key={pos} className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-bold w-12 shrink-0">{label}:</span>
                            <select
                              value={activeTeam2[pos]}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (isLocal) {
                                  setPetanqueTeam2Local(prev => {
                                    const next = [...prev];
                                    next[pos] = val;
                                    return next;
                                  });
                                } else {
                                  setPetanqueTeam2(prev => {
                                    const next = [...prev];
                                    next[pos] = val;
                                    return next;
                                  });
                                }
                              }}
                              className="flex-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 min-w-0"
                            >
                              <option value="">-- เลือกนักกีฬา (หรือปล่อยว่าง) --</option>
                              {getPetanqueCandidates().map(c => {
                                const isMale = c.gender === 'male' || c.gender === 'ชาย' || c.gender === 'ช' || c.age_group.includes('ชาย');
                                const displayPrefix = c.prefix || (isMale ? 'ด.ช.' : 'ด.ญ.');
                                return (
                                  <option key={c.id} value={c.id}>
                                    {displayPrefix}{c.first_name} {c.last_name} ({c.sport_type})
                                  </option>
                                );
                              })}
                            </select>

                            {/* อัปโหลดรูปภาพเฉพาะเปตอง */}
                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                type="file"
                                accept="image/*"
                                id={`pet-photo-${globalIdx}`}
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] || null;
                                  if (isLocal) {
                                    handlePetanquePhotoChangeLocal(globalIdx, file);
                                  } else {
                                    handlePetanquePhotoChange(globalIdx, file);
                                  }
                                }}
                              />
                              {displayPhoto ? (
                                <div className="relative group w-8 h-8 rounded border border-amber-300 overflow-hidden bg-slate-100 flex items-center justify-center">
                                  <img src={displayPhoto} className="w-full h-full object-cover" alt="prev" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isLocal) {
                                        handlePetanquePhotoChangeLocal(globalIdx, null);
                                      } else {
                                        handlePetanquePhotoChange(globalIdx, null);
                                      }
                                    }}
                                    className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    title={activePhotos[globalIdx] ? "ล้างรูปเฉพาะ (กลับไปใช้รูปหลัก)" : "มีรูปจากระบบหลักแล้ว"}
                                    disabled={!activePhotos[globalIdx]}
                                  >
                                    {activePhotos[globalIdx] ? <X size={10} /> : <Camera size={10} />}
                                  </button>
                                </div>
                              ) : (
                                <label
                                  htmlFor={`pet-photo-${globalIdx}`}
                                  className="w-8 h-8 rounded border border-slate-200 hover:border-amber-400 bg-white hover:bg-amber-50 text-slate-400 hover:text-amber-600 flex items-center justify-center cursor-pointer transition-colors"
                                  title="อัปโหลดรูปเฉพาะในใบนี้"
                                >
                                  <Camera size={14} />
                                </label>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}


              {/* Petanque Mixed Team Configuration Dropdowns */}
              {selectedReportType === 'PETANQUE_MIXED' && (() => {
                const isLocal = petanqueCompType === 'local';
                const activeMixedTeamMale = isLocal ? petanqueMixedTeamMaleLocal : petanqueMixedTeamMale;
                const activeMixedTeamFemale = isLocal ? petanqueMixedTeamFemaleLocal : petanqueMixedTeamFemale;
                const activeMixedPhotos = isLocal ? petanqueMixedPhotosLocal : petanqueMixedPhotos;

                return (
                  <div className="mt-4 p-4 bg-purple-50/40 border border-purple-200/60 rounded-2xl space-y-4 animate-in slide-in-from-top-2">
                    <div className="flex justify-between items-center border-b border-purple-200/50 pb-2">
                      <h4 className="font-black text-purple-800 text-xs uppercase tracking-widest">
                        จัดทีมเปตอง รวม (ชาย-หญิง)
                      </h4>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleAutoFillPetanqueMixed}
                          className="text-[10px] font-black text-emerald-600 hover:text-emerald-800 transition-colors"
                        >
                          ⚡ ออโต้ฟิล
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (isLocal) {
                              setPetanqueMixedTeamMaleLocal(['', '', '', '']);
                              setPetanqueMixedTeamFemaleLocal(['', '', '', '']);
                              setPetanqueMixedPhotosLocal(Array(8).fill(''));
                            } else {
                              setPetanqueMixedTeamMale(['', '', '', '']);
                              setPetanqueMixedTeamFemale(['', '', '', '']);
                              setPetanqueMixedPhotos(Array(8).fill(''));
                            }
                          }}
                          className="text-[10px] font-black text-red-500 hover:text-red-700 transition-colors"
                        >
                          🗑️ ล้างทีม
                        </button>
                      </div>
                    </div>
                    
                    {/* ทีมชาย */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-purple-900/60">ทีมชาย (ครึ่งบน)</p>
                      {[0, 1, 2, 3].map((pos) => {
                        const label = pos === 3 ? 'ตัวสำรอง' : `คนที่ ${pos + 1}`;
                        const globalIdx = pos;
                        const studentId = activeMixedTeamMale[pos];
                        const allRegs = [...registrations, ...provRegistrations];
                        const candidate = allRegs.find(r => r.id === studentId);
                        const displayPhoto = activeMixedPhotos[globalIdx] || (candidate ? candidate.photo_url : '');
                        
                        return (
                          <div key={pos} className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-bold w-12 shrink-0">{label}:</span>
                            <select
                              value={activeMixedTeamMale[pos]}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (isLocal) {
                                  setPetanqueMixedTeamMaleLocal(prev => {
                                    const next = [...prev];
                                    next[pos] = val;
                                    return next;
                                  });
                                } else {
                                  setPetanqueMixedTeamMale(prev => {
                                    const next = [...prev];
                                    next[pos] = val;
                                    return next;
                                  });
                                }
                              }}
                              className="flex-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 min-w-0"
                            >
                              <option value="">-- เลือกนักกีฬา (ชาย) --</option>
                              {getPetanqueMixedMaleCandidates().map(c => {
                                const isMale = c.gender === 'male' || c.gender === 'ชาย' || c.gender === 'ช' || c.age_group.includes('ชาย');
                                const displayPrefix = c.prefix || (isMale ? 'ด.ช.' : 'ด.ญ.');
                                return (
                                  <option key={c.id} value={c.id}>
                                    {displayPrefix}{c.first_name} {c.last_name} ({c.sport_type})
                                  </option>
                                );
                              })}
                            </select>

                            {/* อัปโหลดรูปภาพเฉพาะเปตองแบบผสม */}
                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                type="file"
                                accept="image/*"
                                id={`pet-mix-photo-${globalIdx}`}
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] || null;
                                  if (isLocal) {
                                    handlePetanqueMixedPhotoChangeLocal(globalIdx, file);
                                  } else {
                                    handlePetanqueMixedPhotoChange(globalIdx, file);
                                  }
                                }}
                              />
                              {displayPhoto ? (
                                <div className="relative group w-8 h-8 rounded border border-purple-300 overflow-hidden bg-slate-100 flex items-center justify-center">
                                  <img src={displayPhoto} className="w-full h-full object-cover" alt="prev" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isLocal) {
                                        handlePetanqueMixedPhotoChangeLocal(globalIdx, null);
                                      } else {
                                        handlePetanqueMixedPhotoChange(globalIdx, null);
                                      }
                                    }}
                                    className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    title={activeMixedPhotos[globalIdx] ? "ล้างรูปเฉพาะ (กลับไปใช้รูปหลัก)" : "มีรูปจากระบบหลักแล้ว"}
                                    disabled={!activeMixedPhotos[globalIdx]}
                                  >
                                    {activeMixedPhotos[globalIdx] ? <X size={10} /> : <Camera size={10} />}
                                  </button>
                                </div>
                              ) : (
                                <label
                                  htmlFor={`pet-mix-photo-${globalIdx}`}
                                  className="w-8 h-8 rounded border border-slate-200 hover:border-purple-400 bg-white hover:bg-purple-50 text-slate-400 hover:text-purple-600 flex items-center justify-center cursor-pointer transition-colors"
                                  title="อัปโหลดรูปเฉพาะในใบนี้"
                                >
                                  <Camera size={14} />
                                </label>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* ทีมหญิง */}
                    <div className="space-y-2 pt-2 border-t border-purple-200/40">
                      <p className="text-[10px] font-black text-purple-900/60">ทีมหญิง (ครึ่งล่าง)</p>
                      {[0, 1, 2, 3].map((pos) => {
                        const label = pos === 3 ? 'ตัวสำรอง' : `คนที่ ${pos + 1}`;
                        const globalIdx = 4 + pos;
                        const studentId = activeMixedTeamFemale[pos];
                        const allRegs = [...registrations, ...provRegistrations];
                        const candidate = allRegs.find(r => r.id === studentId);
                        const displayPhoto = activeMixedPhotos[globalIdx] || (candidate ? candidate.photo_url : '');
                        
                        return (
                          <div key={pos} className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-bold w-12 shrink-0">{label}:</span>
                            <select
                              value={activeMixedTeamFemale[pos]}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (isLocal) {
                                  setPetanqueMixedTeamFemaleLocal(prev => {
                                    const next = [...prev];
                                    next[pos] = val;
                                    return next;
                                  });
                                } else {
                                  setPetanqueMixedTeamFemale(prev => {
                                    const next = [...prev];
                                    next[pos] = val;
                                    return next;
                                  });
                                }
                              }}
                              className="flex-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 min-w-0"
                            >
                              <option value="">-- เลือกนักกีฬา (หญิง) --</option>
                              {getPetanqueMixedFemaleCandidates().map(c => {
                                const isMale = c.gender === 'male' || c.gender === 'ชาย' || c.gender === 'ช' || c.age_group.includes('ชาย');
                                const displayPrefix = c.prefix || (isMale ? 'ด.ช.' : 'ด.ญ.');
                                return (
                                  <option key={c.id} value={c.id}>
                                    {displayPrefix}{c.first_name} {c.last_name} ({c.sport_type})
                                  </option>
                                );
                              })}
                            </select>

                            {/* อัปโหลดรูปภาพเฉพาะเปตองแบบผสม */}
                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                type="file"
                                accept="image/*"
                                id={`pet-mix-photo-${globalIdx}`}
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] || null;
                                  if (isLocal) {
                                    handlePetanqueMixedPhotoChangeLocal(globalIdx, file);
                                  } else {
                                    handlePetanqueMixedPhotoChange(globalIdx, file);
                                  }
                                }}
                              />
                              {displayPhoto ? (
                                <div className="relative group w-8 h-8 rounded border border-purple-300 overflow-hidden bg-slate-100 flex items-center justify-center">
                                  <img src={displayPhoto} className="w-full h-full object-cover" alt="prev" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isLocal) {
                                        handlePetanqueMixedPhotoChangeLocal(globalIdx, null);
                                      } else {
                                        handlePetanqueMixedPhotoChange(globalIdx, null);
                                      }
                                    }}
                                    className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    title={activeMixedPhotos[globalIdx] ? "ล้างรูปเฉพาะ (กลับไปใช้รูปหลัก)" : "มีรูปจากระบบหลักแล้ว"}
                                    disabled={!activeMixedPhotos[globalIdx]}
                                  >
                                    {activeMixedPhotos[globalIdx] ? <X size={10} /> : <Camera size={10} />}
                                  </button>
                                </div>
                              ) : (
                                <label
                                  htmlFor={`pet-mix-photo-${globalIdx}`}
                                  className="w-8 h-8 rounded border border-slate-200 hover:border-purple-400 bg-white hover:bg-amber-50 text-slate-400 hover:text-amber-600 flex items-center justify-center cursor-pointer transition-colors"
                                  title="อัปโหลดรูปเฉพาะในใบนี้"
                                >
                                  <Camera size={14} />
                                </label>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}


                            {/* Generate Report print trigger */}
              <button
                onClick={() => handlePrintOfficialReport(selectedReportType)}
                className={`w-full mt-6 ${
                  selectedReportType === 'CERT' 
                    ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100' 
                    : selectedReportType === 'PETANQUE' || selectedReportType === 'PETANQUE_MIXED'
                      ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-100'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'
                } text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg`}
              >
                <Printer size={16} /> {
                  selectedReportType === 'CERT' 
                    ? 'พิมพ์หนังสือรับรอง' 
                    : selectedReportType === 'PETANQUE'
                      ? 'พิมพ์ทะเบียนรูปนักกีฬาเปตอง (แยกเพศ)'
                      : selectedReportType === 'PETANQUE_MIXED'
                        ? 'พิมพ์ทะเบียนรูปนักกีฬาเปตอง (รวมชาย-หญิง)'
                        : `พิมพ์รายงาน / บันทึก PDF (แบบ ${selectedReportType})`
                }
              </button>

              {/* ส่วนตั้งค่ารายการแข่งขัน */}
              <button
                type="button"
                onClick={() => setShowEventSettings(!showEventSettings)}
                className="w-full mt-3 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                ⚙️ ตั้งค่ารายการแข่งขัน {showEventSettings ? '▲' : '▼'}
              </button>

              {showEventSettings && (
                <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 animate-in slide-in-from-top-2">
                  <h4 className="font-black text-slate-700 text-xs uppercase tracking-widest border-b border-slate-200 pb-2">
                    เพิ่ม/แก้ไขรายการแข่งขันตามรุ่นอายุ
                  </h4>
                  
                  <div className="flex gap-2">
                    <div className="relative w-28 shrink-0">
                      <select
                        value={newEventAgeGroup}
                        onChange={(e) => setNewEventAgeGroup(e.target.value)}
                        className="w-full pl-2 pr-6 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-600 appearance-none cursor-pointer outline-hidden"
                      >
                        <option value="6">รุ่น 6 ปี</option>
                        <option value="8">รุ่น 8 ปี</option>
                        <option value="10">รุ่น 10 ปี</option>
                        <option value="12">รุ่น 12 ปี</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={10} />
                    </div>
                    <input
                      type="text"
                      placeholder="ชื่อรายการแข่งขันใหม่..."
                      value={newEventName}
                      onChange={(e) => setNewEventName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomEvent())}
                      className="flex-1 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={addCustomEvent}
                      className="px-3 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-all shrink-0"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  {/* แสดงรายการที่เพิ่มเอง */}
                  {Object.entries(customEvents).map(([ageKey, events]) => (
                    events.length > 0 && (
                      <div key={ageKey} className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase">รายการเพิ่มเติม รุ่น {ageKey} ปี:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {events.map(ev => (
                            <span key={ev} className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold">
                              {ev}
                              <button
                                type="button"
                                onClick={() => removeCustomEvent(ageKey, ev)}
                                className="text-amber-500 hover:text-red-500 ml-0.5"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  ))}
                  
                  <p className="text-[9px] text-slate-400 font-bold leading-relaxed">
                    💡 รายการที่เพิ่มจะปรากฏในตัวเลือกกีฬาตามรุ่นอายุ ทั้งตอนลงทะเบียนและตอนออกรายงาน A2, A3
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Interactive Report Preview Card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-6 min-h-[500px]">
              <h3 className="font-black text-slate-800 border-b border-slate-50 pb-4 flex justify-between items-center">
                <span>👁️ ตัวอย่างเอกสารรายงาน (Preview) - แบบ {selectedReportType}</span>
                <span className="text-xs text-slate-400 font-extrabold">รุ่นอายุไม่เกิน {reportAgeGroup} ปี | เพศ {reportGender === 'male' ? 'ชาย' : 'หญิง'}</span>
              </h3>

              {/* RENDER DYNAMIC PREVIEW CORRESPONDING TO REPORT TYPE */}
              <div className="border border-slate-200 bg-slate-50 p-6 rounded-2xl overflow-x-auto">
                
                {/* 1. PREVIEW A1 */}
                {selectedReportType === 'A1' && (() => {
                  const reportData = getReportParticipants();
                  // จัดกลุ่มข้อมูล
                  const grouped: Record<string, Registration & { events: string[] }> = {};
                  reportData.forEach(r => {
                    const key = r.citizen_id || r.student_id;
                    if (!grouped[key]) {
                      grouped[key] = {
                        ...r,
                        events: [r.sport_type]
                      };
                    } else {
                      if (!grouped[key].events.includes(r.sport_type)) {
                        grouped[key].events.push(r.sport_type);
                      }
                    }
                  });
                  const groupedData = Object.values(grouped);
                  const edNo = selectedYear ? parseInt(selectedYear) - 2548 : 21;

                  return (
                    <div 
                      className="bg-white p-6 shadow-sm border border-slate-300 w-[180mm] min-h-[250mm] mx-auto text-[15px] text-slate-800 leading-normal"
                      style={{ fontFamily: '"TH Sarabun PSK", "TH Sarabun New", "Sarabun", sans-serif', fontSize: '16pt' }}
                    >
                      <div className="flex justify-between text-[13px] text-slate-400 mb-4">
                        <span>แบบ A 1</span>
                        <span>หน้า 1/1</span>
                      </div>
                      <h4 className="text-center font-bold" style={{ fontSize: '18pt' }}>แผงรูปถ่ายนักกรีฑา ( แบบ A 1 )</h4>
                      <p className="text-center font-bold" style={{ fontSize: '16pt' }}>การแข่งขันกรีฑา เด็ก เยาวชนและประชาชน ตำบลเขาชัยสน ครั้งที่ {edNo} ประจำปี {selectedYear}</p>
                      
                      <div style={{ fontSize: '14pt', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '6px 12px', marginBottom: '6px', borderBottom: '1px solid #ccc', paddingBottom: '3px', lineHeight: '1.1' }}>
                        <span>รุ่นอายุ ไม่เกิน {reportAgeGroup} ปี</span>
                        <span>เพศ {reportGender === 'male' ? 'ชาย' : 'หญิง'}</span>
                        <span>ทีม {reportTeamName}</span>
                        <span>หมายเลขหน่วยกีฬา {reportUnitCode}</span>
                      </div>

                      {groupedData.length === 0 ? (
                        <div className="py-20 text-center text-slate-400 italic">ไม่พบข้อมูลนักกรีฑาในรุ่นนี้ค่ะ</div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4 mt-6">
                          {groupedData.slice(0, 4).map((p, idx) => {
                            const isPhotoBroken = brokenImages[p.id] || !p.photo_url;
                            return (
                              <div key={p.id} className="border border-slate-400 p-3 flex flex-col items-center bg-white rounded-lg">
                                <div className="w-[110px] h-[140px] border border-slate-200 rounded bg-slate-50 flex items-center justify-center overflow-hidden mb-2">
                                  {!isPhotoBroken ? (
                                    <img 
                                      src={p.photo_url} 
                                      alt="pic" 
                                      className={`w-full h-full ${imageAspects[p.id] === 'landscape' ? 'object-contain bg-slate-100 p-0.5' : 'object-cover'}`} 
                                      onLoad={(e) => handleImageLoad(p.id, e)}
                                      onError={() => handleImageError(p.id)} 
                                    />
                                  ) : (
                                    <User size={32} className="text-slate-300" />
                                  )}
                                </div>
                                <p className="font-normal text-slate-800 text-center leading-tight" style={{ fontSize: '16pt' }}>{p.prefix}{p.first_name} {p.last_name}</p>
                                <p className="text-slate-500 font-normal mt-1" style={{ fontSize: '14pt' }}>เลขประชาชน: {p.citizen_id}</p>
                                <div className="text-slate-700 w-full mt-2 border-t border-dashed border-slate-100 pt-2" style={{ fontSize: '16pt' }}>
                                  <p className="font-normal text-slate-900 mb-1">ประเภทการแข่งขัน:</p>
                                  <ol className="list-decimal pl-5 font-normal text-slate-800 leading-normal" style={{ fontSize: '16pt' }}>
                                    {p.events.map((ev, evIdx) => (
                                      <li key={evIdx}>{ev}</li>
                                    ))}
                                    {Array(Math.max(0, 5 - p.events.length)).fill(0).map((_, emptyIdx) => (
                                      <li key={`empty-${emptyIdx}`}>{"\u00a0"}</li>
                                    ))}
                                  </ol>
                                </div>
                              </div>
                            );
                          })}
                          {groupedData.length < 4 ? Array(4 - groupedData.length).fill(0).map((_, emptyCardIdx) => (
                            <div key={`empty-card-${emptyCardIdx}`} className="border border-dashed border-slate-300 p-3 flex flex-col items-center justify-center h-[280px] bg-slate-50 rounded-lg">
                              <p className="text-slate-400 font-normal text-sm">ช่องว่างสำหรับนักกรีฑา</p>
                            </div>
                          )) : null}
                        </div>
                      )}
                    </div>
                  );
                })()}


                {/* 2. PREVIEW A2 */}
                {selectedReportType === 'A2' && (() => {
                  const reportData = getReportParticipants();
                  // จัดกลุ่มข้อมูล
                  const grouped: Record<string, Registration & { events: string[] }> = {};
                  reportData.forEach(r => {
                    const key = r.citizen_id || r.student_id;
                    if (!grouped[key]) {
                      grouped[key] = {
                        ...r,
                        events: [r.sport_type]
                      };
                    } else {
                      if (!grouped[key].events.includes(r.sport_type)) {
                        grouped[key].events.push(r.sport_type);
                      }
                    }
                  });
                  const reportDataGrouped = Object.values(grouped);
                  const events = getEventsForAge();
                  const maxRows = 10;
                  const edNo = selectedYear ? parseInt(selectedYear) - 2548 : 21;

                  return (
                    <div 
                      className="bg-white p-6 shadow-sm border border-slate-300 w-[180mm] min-h-[250mm] mx-auto text-[15px] text-slate-800 leading-normal flex flex-col justify-between"
                      style={{ fontFamily: '"TH Sarabun PSK", "TH Sarabun New", "Sarabun", sans-serif', fontSize: '16pt' }}
                    >
                      <div>
                        <div className="text-[13px] text-slate-400 mb-2">แบบ A 2</div>
                        <h4 className="text-center font-bold" style={{ fontSize: '18pt' }}>แบบฟอร์มรายชื่อแยกประเภท ( แบบ A 2 )</h4>
                        <p className="text-center font-bold" style={{ fontSize: '16pt' }}>การแข่งขันกรีฑา เด็ก เยาวชนและประชาชน ตำบลเขาชัยสน ครั้งที่ {edNo} ประจำปี {selectedYear}</p>
                        
                        <div style={{ fontSize: '14pt', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '6px 12px', marginBottom: '6px', borderBottom: '1px solid #ccc', paddingBottom: '3px', lineHeight: '1.1' }}>
                          <span>รุ่นอายุ ไม่เกิน {reportAgeGroup} ปี</span>
                          <span>เพศ {reportGender === 'male' ? 'ชาย' : 'หญิง'}</span>
                          <span>ทีม {reportTeamName}</span>
                          <span>หมายเลขหน่วยกีฬา {reportUnitCode}</span>
                        </div>

                        <table className="w-full border-collapse border border-slate-400" style={{ fontSize: '16pt' }}>
                          <thead>
                            <tr className="bg-slate-50 font-black">
                              <th className="border border-slate-400 py-1 text-center w-6">ลำดับ</th>
                              <th className="border border-slate-400 py-1 text-center w-12">หมายเลข</th>
                              <th className="border border-slate-400 py-1 px-2 text-left">ชื่อ - สกุล</th>
                              {events.map((ev, idx) => (
                                <th key={idx} className="border border-slate-400 py-1 text-center w-8" style={{ fontSize: '13pt', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', width: '28px' }}>{ev}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Array(maxRows).fill(0).map((_, i) => {
                              const p = reportDataGrouped[i];
                              return (
                                <tr key={i} className="h-6">
                                  <td className="border border-slate-400 text-center">{i + 1}</td>
                                  <td className="border border-slate-400 text-center">{p ? p.sport_id : ''}</td>
                                  <td className="border border-slate-400 px-2 font-normal">
                                    {p ? `${p.prefix}${p.first_name} ${p.last_name}` : ''}
                                  </td>
                                  {events.map((ev, idx) => {
                                    const hasRegistered = p && p.events.includes(ev);
                                    const isReserve = p && p.events.includes(`${ev} (สำรอง)`);
                                    return (
                                      <td key={idx} className="border border-slate-400 text-center font-normal text-[16px] text-emerald-700">
                                        {hasRegistered ? '/' : (isReserve ? '/ (สำรอง)' : '')}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        <div style={{ marginTop: '8px', fontSize: '16pt', lineHeight: '1.15', pageBreakInside: 'avoid' }}>
                          <p style={{ marginBottom: '1px' }}>ข้าพเจ้าขอรับรองนักกรีฑาที่มีรายชื่อดังกล่าวข้างต้น เป็นนักกรีฑาสังกัด <u>{"\u00a0\u00a0"}{reportTeamName}{"\u00a0\u00a0"}</u></p>
                          <p>หน่วยกีฬา <u>{"\u00a0\u00a0"}{reportUnitCode}{"\u00a0\u00a0"}</u> จริง และมีคุณสมบัติถูกต้องตามระเบียบการแข่งขันทุกประการ</p>
                        </div>
                      </div>

                      <div className="flex justify-end mt-6">
                        <table style={{ width: '100%', border: 'none', marginTop: '4px' }}>
                          <tbody>
                            <tr style={{ border: 'none' }}>
                              <td style={{ border: 'none', width: '50%' }}></td>
                              <td style={{ border: 'none', textAlign: 'center', width: '50%', fontSize: '16pt', lineHeight: '1.1' }}>
                                <p>ลงชื่อ <span style={{ display: 'inline-block', width: '180px', borderBottom: '1px dotted #000' }}></span> ผู้จัดการทีม</p>
                                <p style={{ marginTop: '3px' }}>( <u>{"\u00a0\u00a0"}{reportManagerName || '........................................................'}{"\u00a0\u00a0"}</u> )</p>
                                <p style={{ marginTop: '3px' }}>............../.........................../ {selectedYear}</p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}


                {/* 3. PREVIEW A3 */}
                {selectedReportType === 'A3' && (() => {
                  const reportData = getReportParticipants();
                  // จัดกลุ่มข้อมูล
                  const grouped: Record<string, Registration & { events: string[] }> = {};
                  reportData.forEach(r => {
                    const key = r.citizen_id || r.student_id;
                    if (!grouped[key]) {
                      grouped[key] = {
                        ...r,
                        events: [r.sport_type]
                      };
                    } else {
                      if (!grouped[key].events.includes(r.sport_type)) {
                        grouped[key].events.push(r.sport_type);
                      }
                    }
                  });
                  const reportDataGrouped = Object.values(grouped);
                  const events = getEventsForAge();
                  const edNo = selectedYear ? parseInt(selectedYear) - 2548 : 21;

                  return (
                    <div 
                      className="bg-white p-6 shadow-sm border border-slate-300 w-[180mm] min-h-[250mm] mx-auto text-[14px] text-slate-800 leading-normal flex flex-col justify-between"
                      style={{ fontFamily: '"TH Sarabun PSK", "TH Sarabun New", "Sarabun", sans-serif', fontSize: '16pt' }}
                    >
                      <div>
                        <div className="text-[13px] text-slate-400 mb-2">แบบ A 3</div>
                        <h4 className="text-center font-bold" style={{ fontSize: '18pt' }}>แบบฟอร์มรายชื่อแยกประเภท ( แบบ A 3 )</h4>
                        <p className="text-center font-bold" style={{ fontSize: '16pt' }}>การแข่งขันกรีฑา เด็ก เยาวชนและประชาชน ครั้งที่ {edNo} ประจำปี {selectedYear}</p>
                        
                        <div style={{ fontSize: '14pt', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '6px 12px', marginBottom: '6px', borderBottom: '1px solid #ccc', paddingBottom: '3px', lineHeight: '1.1' }}>
                          <span>รุ่นอายุ ไม่เกิน {reportAgeGroup} ปี</span>
                          <span>เพศ {reportGender === 'male' ? 'ชาย' : 'หญิง'}</span>
                          <span>ทีม {reportTeamName}</span>
                          <span>หมายเลขหน่วยกีฬา {reportUnitCode}</span>
                        </div>

                        <table className="w-full border-collapse border border-slate-400" style={{ fontSize: '16pt' }}>
                          <thead>
                            <tr className="bg-slate-50 font-black">
                              <th className="border border-slate-400 py-1 text-center w-28" style={{ whiteSpace: 'nowrap' }}>ประเภทการแข่งขัน</th>
                              <th className="border border-slate-400 py-1 px-2 text-left">ชื่อ - สกุล</th>
                              <th className="border border-slate-400 py-1 text-center w-28">วัน เดือน ปีเกิด</th>
                              <th className="border border-slate-400 py-1 text-center w-16">หมายเหตุ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {events.map((ev, evIdx) => {
                              const evParticipants = reportDataGrouped.filter(p => p.events.includes(ev) || p.events.includes(`${ev} (สำรอง)`));
                              const isRelay = ev.includes('ผลัด') || ev.toLowerCase().includes('4x');
                              const rowCount = isRelay ? 5 : 2;
                              
                              return Array(rowCount).fill(0).map((_, i) => {
                                const p = evParticipants[i];
                                const showCategoryName = i === 0;
                                return (
                                  <tr key={`${evIdx}-${i}`} className="h-6">
                                    {showCategoryName && (
                                      <td rowSpan={rowCount} className="border border-slate-400 text-center font-normal bg-slate-50/50" style={{ whiteSpace: 'nowrap' }}>
                                        {evIdx + 1}. {ev}
                                      </td>
                                    )}
                                    <td className="border border-slate-400 px-2 font-normal">
                                      {p ? `${i + 1}. ${p.prefix}${p.first_name} ${p.last_name}` : `${i + 1}. ....................................................`}
                                    </td>
                                    <td className="border border-slate-400 text-center">
                                      {p ? formatThaiDateFull(p.birth_date) : '.........................................'}
                                    </td>
                                    <td className="border border-slate-400 text-center">
                                      {p && p.events.includes(`${ev} (สำรอง)`) ? 'ตัวสำรอง' : ''}
                                    </td>
                                  </tr>
                                );
                              });
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex justify-end mt-6">
                        <table style={{ width: '100%', border: 'none', marginTop: '4px' }}>
                          <tbody>
                            <tr style={{ border: 'none' }}>
                              <td style={{ border: 'none', width: '50%' }}></td>
                              <td style={{ border: 'none', textAlign: 'center', width: '50%', fontSize: '16pt', lineHeight: '1.1' }}>
                                <p>ลงชื่อ <span style={{ display: 'inline-block', width: '180px', borderBottom: '1px dotted #000' }}></span> ผู้จัดการทีม</p>
                                <p style={{ marginTop: '3px' }}>( <u>{"\u00a0\u00a0"}{reportManagerName || '........................................................'}{"\u00a0\u00a0"}</u> )</p>
                                <p style={{ marginTop: '3px' }}>............../.........................../ {selectedYear}</p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}


                {/* 4. PREVIEW CERT (หนังสือรับรองของสถานศึกษา) */}
                {selectedReportType === 'CERT' && (() => {
                  // หา registrations ที่ตรงกับกีฬาที่เลือก
                  const certFilteredRegs = registrations.filter(r => {
                    if (certSportName && certSportName !== 'ทั้งหมด') {
                      return r.sport_type === certSportName;
                    }
                    return true;
                  });
                  // จัดกลุ่มตามนักเรียน
                  const grouped: Record<string, Registration & { events: string[] }> = {};
                  certFilteredRegs.forEach(r => {
                    const key = r.citizen_id || r.student_id;
                    if (!grouped[key]) {
                      grouped[key] = { ...r, events: [r.sport_type] };
                    } else {
                      if (!grouped[key].events.includes(r.sport_type)) {
                        grouped[key].events.push(r.sport_type);
                      }
                    }
                  });
                  const certStudents = Object.values(grouped);

                  return (
                    <div className="space-y-6">
                      {/* ตัวเลือกประเภทกีฬา */}
                      <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm space-y-4">
                        <h4 className="font-black text-indigo-800 flex items-center gap-2 text-sm">
                          <ShieldCheck size={18} className="text-indigo-500" />
                          หนังสือรับรองของสถานศึกษา
                        </h4>
                        <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                          📌 การแข่งขันกีฬานักเรียน นักศึกษา และประชาชน จังหวัดพัทลุง ครั้งที่ {compEditionThai} ประจำปี {compYearThai}
                        </p>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">เลือกประเภทกีฬา</label>
                          <select
                            value={certSportName}
                            onChange={(e) => {
                              setCertSportName(e.target.value);
                              setCertSelectedRegs([]);
                            }}
                            className="w-full px-3 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 text-xs outline-hidden"
                          >
                            <option value="ทั้งหมด">ทั้งหมด (แสดงทุกประเภทกีฬา)</option>
                            {uniqueSports.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>

                        {/* รายชื่อนักกีฬาเลือกพิมพ์ */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">เลือกนักกีฬา ({certSelectedRegs.length} คน)</label>
                            <button
                              type="button"
                              onClick={() => {
                                if (certSelectedRegs.length === certFilteredRegs.length) {
                                  setCertSelectedRegs([]);
                                } else {
                                  setCertSelectedRegs(certFilteredRegs.map(r => r.id));
                                }
                              }}
                              className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 transition-colors"
                            >
                              {certSelectedRegs.length === certFilteredRegs.length ? '❌ ยกเลิกทั้งหมด' : '✅ เลือกทั้งหมด'}
                            </button>
                          </div>

                          <div className="max-h-[300px] overflow-y-auto space-y-1.5 border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                            {certStudents.length === 0 ? (
                              <p className="text-center text-slate-400 text-xs py-6 italic">ไม่พบนักกีฬาที่ลงทะเบียนในประเภทกีฬานี้</p>
                            ) : (
                              certStudents.map(student => {
                                // ใช้ original reg IDs ที่มี
                                const studentRegIds = certFilteredRegs.filter(r => (r.citizen_id || r.student_id) === (student.citizen_id || student.student_id)).map(r => r.id);
                                const isSelected = studentRegIds.some(id => certSelectedRegs.includes(id));
                                return (
                                  <label
                                    key={student.id}
                                    className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                                      isSelected ? 'bg-indigo-50 border border-indigo-200' : 'bg-white border border-slate-100 hover:bg-slate-50'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {
                                        if (isSelected) {
                                          setCertSelectedRegs(prev => prev.filter(id => !studentRegIds.includes(id)));
                                        } else {
                                          setCertSelectedRegs(prev => [...prev, ...studentRegIds]);
                                        }
                                      }}
                                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-black text-slate-800 truncate">{student.prefix}{student.first_name} {student.last_name}</p>
                                      <p className="text-[10px] text-slate-400 font-bold">ชั้น {student.class_level}/{student.room} • {student.events.join(', ')}</p>
                                    </div>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${isSelected ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>
                                      {isSelected ? '✓' : ''}
                                    </span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>

                      {/* ตัวอย่างหนังสือรับรอง */}
                      {certSelectedRegs.length > 0 && (() => {
                        // แสดง preview คนแรก
                        const firstReg = registrations.find(r => certSelectedRegs.includes(r.id));
                        if (!firstReg) return null;
                        const dateParts = formatThaiDateParts(firstReg.birth_date);
                        const studentAge = calculateAgeFromBirthDate(firstReg.birth_date);
                        
                        let sportDisplayName = certSportName === 'ทั้งหมด' ? firstReg.sport_type : certSportName;
                        sportDisplayName = sportDisplayName.replace(/วอลเลย์บอลในร่ม/g, 'วอลเลย์บอล').replace(/วอลเลบอลในร่ม/g, 'วอลเลย์บอล');

                        const schoolName = reportTeamName || '';
                        const directorPosition = schoolName.startsWith('โรงเรียน') ? `ผู้อำนวยการ${schoolName}` : `ผู้อำนวยการโรงเรียน${schoolName}`;
                        const normalizedPrefix = getFullPrefix(firstReg.prefix);
                        const classLevelAndRoom = firstReg.class_level 
                          ? (firstReg.class_level.startsWith('ป.') || firstReg.class_level.startsWith('ม.') 
                              ? firstReg.class_level 
                              : `ป.${firstReg.class_level}`) 
                          : '.........................';
                        const roomText = firstReg.room ? `/${firstReg.room}` : '';
                        const classRoomThai = toThaiNumerals(classLevelAndRoom + roomText);

                        return (
                          <div
                            className="bg-white p-8 shadow-sm border border-slate-300 w-[180mm] min-h-[250mm] mx-auto flex flex-col justify-start"
                            style={{ fontFamily: '"TH Sarabun PSK", "TH Sarabun New", "Sarabun", sans-serif', fontSize: '16pt', lineHeight: '1.6', paddingTop: '25mm' }}
                          >
                            <h4 style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '20pt', marginBottom: '24px' }}>หนังสือรับรองของสถานศึกษา</h4>
                            
                            <p style={{ textIndent: '80px', textAlign: 'left', margin: '0 0 12px 0', fontSize: '16pt' }}>
                              ข้าพเจ้า {reportManagerName || '.......................................................'} ตำแหน่ง {directorPosition} ขอรับรองว่า {normalizedPrefix} {firstReg.first_name} {firstReg.last_name} เกิดวันที่ {toThaiNumerals(dateParts.day)} เดือน {dateParts.month} พ.ศ. {toThaiNumerals(dateParts.year)} มีอายุ {studentAge ? toThaiNumerals(studentAge) : '.........'} ปี ปัจจุบันกำลังเรียนชั้น {classRoomThai} และเป็นผู้มีคุณสมบัติถูกต้องตามระเบียบการรับสมัคร เข้าแข่งขันกีฬา {sportDisplayName} นักเรียน นักศึกษา และประชาชนจังหวัดพัทลุง ครั้งที่ {compEditionThai} ประจำปี {compYearThai} ทุกประการ
                            </p>

                            <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'flex-end', paddingRight: '30px' }}>
                              <div style={{ textAlign: 'center', lineHeight: '1.4', width: '320px', fontSize: '16pt' }}>
                                <p style={{ margin: '0', fontSize: '16pt' }}>(ลงชื่อ) ..............................................................</p>
                                <p style={{ margin: '6px 0 0 0', fontSize: '16pt' }}>( {reportManagerName || '.........................................................'} )</p>
                                <p style={{ margin: '4px 0 0 0', fontSize: '16pt' }}>ตำแหน่ง {directorPosition}</p>
                                <p style={{ margin: '6px 0 0 0', fontSize: '13pt', color: '#666' }}>ประทับตราสถานศึกษารับรอง</p>
                              </div>
                            </div>

                            {certSelectedRegs.length > 1 && (
                              <p className="text-xs text-center text-slate-400 font-bold mt-6 pt-4 border-t border-dashed border-slate-200">
                                📄 แสดงตัวอย่างคนแรก (จากทั้งหมด {certSelectedRegs.length} คน) — กดพิมพ์เพื่อพิมพ์ทุกคน
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}

                {/* 5. PREVIEW PETANQUE MIXED (ทะเบียนรูปนักกีฬาเปตอง รวมชายหญิง) */}
                {selectedReportType === 'PETANQUE_MIXED' && (() => {
                  const edNo = selectedYear ? parseInt(selectedYear) - 2492 : 77;
                  const edThai = toThaiNumerals(edNo);
                  const yearThai = toThaiNumerals(selectedYear || 2569);
                  const allRegs = [...registrations, ...provRegistrations];
                  const isLocal = petanqueCompType === 'local';
                  const activeMixedTeamMale = isLocal ? petanqueMixedTeamMaleLocal : petanqueMixedTeamMale;
                  const activeMixedTeamFemale = isLocal ? petanqueMixedTeamFemaleLocal : petanqueMixedTeamFemale;
                  const activeMixedPhotos = isLocal ? petanqueMixedPhotosLocal : petanqueMixedPhotos;

                  const renderTeamBlock = (title: string, teamIds: string[], teamIndex: number) => {
                    return (
                      <div className="border border-black p-4 mb-4 bg-white rounded-lg">
                        <p className="text-center font-bold mb-3" style={{ fontSize: '15pt' }}>
                          {title}
                        </p>
                        <div className="grid grid-cols-4 gap-3 justify-items-center">
                          {teamIds.map((id, idx) => {
                            const p = allRegs.find(r => r.id === id) || null;
                            const globalIdx = (teamIndex - 1) * 4 + idx;
                            const customPhoto = activeMixedPhotos[globalIdx];
                            const hasPhoto = customPhoto || (p && p.photo_url);
                            const isPhotoBroken = p ? (brokenImages[p.id] && !customPhoto) : !customPhoto;
                            return (
                              <div key={idx} className="flex flex-col items-center">
                                <div className="w-[90px] h-[120px] border border-black flex items-center justify-center bg-slate-50 overflow-hidden relative">
                                  {hasPhoto && !isPhotoBroken ? (
                                    <img 
                                      src={customPhoto || (p ? p.photo_url : '')} 
                                      alt="pic" 
                                      className="w-full h-full object-cover"
                                      onLoad={(e) => p && handleImageLoad(p.id, e)}
                                      onError={() => p && handleImageError(p.id)} 
                                    />
                                  ) : (
                                    <span className="text-[9px] text-slate-400 text-center font-normal px-1">
                                      รูปถ่าย<br/>{idx === 3 ? 'สำรอง' : `คนที่ ${idx + 1}`}
                                    </span>
                                  )}
                                </div>
                                <div className="text-center mt-2 w-full text-[13pt] leading-snug">
                                  <div className="truncate font-sans font-normal text-slate-700">ชื่อ {p ? `${p.prefix || (teamIndex === 1 ? 'ด.ช.' : 'ด.ญ.')}${p.first_name}` : '...........................'}</div>
                                  <div className="truncate mt-1 font-sans font-normal text-slate-700">นามสกุล {p ? p.last_name : '...........................'}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  };

                  const matchTitle = isLocal
                    ? `การแข่งขันกีฬาเปตอง เด็ก เยาวชนและประชาชน ตำบลเขาชัยสน ครั้งที่ ${edThai} ประจำปี พ.ศ. ${yearThai}`
                    : `การแข่งขันกีฬาเปตองกีฬานักเรียน นักศึกษา และประชาชนจังหวัดพัทลุง ครั้งที่ ${edThai} ประจำปี ${yearThai}`;

                  return (
                    <div 
                      className="bg-white p-8 shadow-sm border border-slate-300 w-[180mm] min-h-[250mm] mx-auto text-[15px] text-slate-800 leading-normal flex flex-col justify-between"
                      style={{ fontFamily: '"TH Sarabun PSK", "TH Sarabun New", "Sarabun", sans-serif', fontSize: '16pt' }}
                    >
                      <div>
                        <h4 className="text-center font-bold" style={{ fontSize: '18pt', marginBottom: '4px' }}>ทะเบียนรูปนักกีฬา</h4>
                        <p className="text-center font-bold" style={{ fontSize: '16pt', marginBottom: '6px' }}>
                          {matchTitle}
                        </p>
                        <div className="mb-4 text-center font-bold" style={{ fontSize: '16pt' }}>
                          ชื่อหน่วยกีฬา <span className="inline-block border-b border-dotted border-black px-4 min-w-[250px] text-center font-bold">{reportTeamName || '.........................................................................'}</span>
                        </div>

                        {renderTeamBlock(
                          `รุ่นอายุไม่เกิน ${toThaiNumerals(reportAgeGroup)} ปี เพศ ชาย ประเภททีม ๓ คน (นักกีฬาสำรอง ๑ คน)`,
                          activeMixedTeamMale,
                          1
                        )}

                        {renderTeamBlock(
                          `รุ่นอายุไม่เกิน ${toThaiNumerals(reportAgeGroup)} ปี เพศ หญิง ประเภททีม ๓ คน (นักกีฬาสำรอง ๑ คน)`,
                          activeMixedTeamFemale,
                          2
                        )}
                      </div>
                    </div>
                  );
                })()}


                {/* 6. PREVIEW PETANQUE (ทะเบียนรูปนักกีฬาเปตอง) */}
                {selectedReportType === 'PETANQUE' && (() => {
                  const edNo = selectedYear ? parseInt(selectedYear) - 2492 : 77;
                  const edThai = toThaiNumerals(edNo);
                  const yearThai = toThaiNumerals(selectedYear || 2569);
                  const allRegs = [...registrations, ...provRegistrations];
                  const isLocal = petanqueCompType === 'local';
                  const activeTeam1 = isLocal ? petanqueTeam1Local : petanqueTeam1;
                  const activeTeam2 = isLocal ? petanqueTeam2Local : petanqueTeam2;
                  const activePhotos = isLocal ? petanqueTeamPhotosLocal : petanqueTeamPhotos;

                  const renderTeamBlock = (title: string, teamIds: string[], teamIndex: number) => {
                    return (
                      <div className="border border-black p-4 mb-4 bg-white rounded-lg">
                        <p className="text-center font-bold mb-3" style={{ fontSize: '15pt' }}>
                          {title}
                        </p>
                        <div className="grid grid-cols-4 gap-3 justify-items-center">
                          {teamIds.map((id, idx) => {
                            const p = allRegs.find(r => r.id === id) || null;
                            const globalIdx = (teamIndex - 1) * 4 + idx;
                            const customPhoto = activePhotos[globalIdx];
                            const hasPhoto = customPhoto || (p && p.photo_url);
                            const isPhotoBroken = p ? (brokenImages[p.id] && !customPhoto) : !customPhoto;
                            return (
                              <div key={idx} className="flex flex-col items-center">
                                <div className="w-[90px] h-[120px] border border-black flex items-center justify-center bg-slate-50 overflow-hidden relative">
                                  {hasPhoto && !isPhotoBroken ? (
                                    <img 
                                      src={customPhoto || (p ? p.photo_url : '')} 
                                      alt="pic" 
                                      className="w-full h-full object-cover"
                                      onLoad={(e) => p && handleImageLoad(p.id, e)}
                                      onError={() => p && handleImageError(p.id)} 
                                    />
                                  ) : (
                                    <span className="text-[9px] text-slate-400 text-center font-normal px-1">
                                      รูปถ่าย<br/>{idx === 3 ? 'สำรอง' : `คนที่ ${idx + 1}`}
                                    </span>
                                  )}
                                </div>
                                <div className="text-center mt-2 w-full text-[13pt] leading-snug">
                                  <div className="truncate font-sans font-normal text-slate-700">ชื่อ {p ? `${p.prefix || (reportGender === 'male' ? 'ด.ช.' : 'ด.ญ.')}${p.first_name}` : '...........................'}</div>
                                  <div className="truncate mt-1 font-sans font-normal text-slate-700">นามสกุล {p ? p.last_name : '...........................'}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  };

                  const matchTitle = isLocal
                    ? `การแข่งขันกีฬาเปตอง เด็ก เยาวชนและประชาชน ตำบลเขาชัยสน ครั้งที่ ${edThai} ประจำปี พ.ศ. ${yearThai}`
                    : `การแข่งขันกีฬาเปตองกีฬานักเรียน นักศึกษา และประชาชนจังหวัดพัทลุง ครั้งที่ ${edThai} ประจำปี ${yearThai}`;

                  return (
                    <div 
                      className="bg-white p-8 shadow-sm border border-slate-300 w-[180mm] min-h-[250mm] mx-auto text-[15px] text-slate-800 leading-normal flex flex-col justify-between"
                      style={{ fontFamily: '"TH Sarabun PSK", "TH Sarabun New", "Sarabun", sans-serif', fontSize: '16pt' }}
                    >
                      <div>
                        <h4 className="text-center font-bold" style={{ fontSize: '18pt', marginBottom: '4px' }}>ทะเบียนรูปนักกีฬา</h4>
                        <p className="text-center font-bold" style={{ fontSize: '16pt', marginBottom: '6px' }}>
                          {matchTitle}
                        </p>
                        <div className="mb-4 text-center font-bold" style={{ fontSize: '16pt' }}>
                          ชื่อหน่วยกีฬา <span className="inline-block border-b border-dotted border-black px-4 min-w-[250px] text-center font-bold">{reportTeamName || '.........................................................................'}</span>
                        </div>

                        {renderTeamBlock(
                          `รุ่นอายุไม่เกิน ${toThaiNumerals(reportAgeGroup)} ปี เพศ ${reportGender === 'male' ? 'ชาย' : 'หญิง'} ประเภททีม ๓ คน (นักกีฬาสำรอง ๑ คน)`,
                          activeTeam1,
                          1
                        )}

                        {renderTeamBlock(
                          `รุ่นอายุไม่เกิน ${toThaiNumerals(reportAgeGroup)} ปี เพศ ${reportGender === 'male' ? 'ชาย' : 'หญิง'} ประเภททีม ๓ คน (นักกีฬาสำรอง ๑ คน)`,
                          activeTeam2,
                          2
                        )}
                      </div>
                    </div>
                  );
                })()}



              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB: PROVINCIAL COMPETITION (กีฬาจังหวัดพัทลุง ครั้งที่ 77) */}
      {activeSubTab === 'provincial' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 text-white p-6 rounded-[28px] shadow-xl shadow-indigo-200/40">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">⚽</span>
              <div>
                <h3 className="text-lg font-black tracking-tight">การแข่งขันกีฬานักเรียน นักศึกษา และประชาชน</h3>
                <p className="text-indigo-200 font-bold text-xs mt-0.5">จังหวัดพัทลุง ครั้งที่ {compEditionThai} ประจำปี {compYearThai}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {PROVINCIAL_SPORTS.map(sport => {
                const count = provRegistrations.filter(r => r.sport_type === sport).length;
                return (
                  <span key={sport} className="px-3 py-1 bg-white/15 rounded-full text-xs font-black backdrop-blur-xs">
                    {sport} ({count})
                  </span>
                );
              })}
              <span className="px-3 py-1 bg-white/25 rounded-full text-xs font-black backdrop-blur-xs">
                รวม {provRegistrations.length} คน
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Registration Form */}
            <div className="lg:col-span-1 space-y-5">
              {/* ฟอร์มลงทะเบียนนักเรียนตัวแทน */}
              <div className="bg-white p-6 rounded-[28px] border border-indigo-100 shadow-sm space-y-4">
                <h4 className="font-black text-indigo-800 flex items-center gap-2 text-sm border-b border-indigo-50 pb-3">
                  <UserPlus size={18} className="text-indigo-500" />
                  ลงทะเบียนนักเรียนตัวแทน
                </h4>

                {/* ค้นหานักเรียน */}
                <div className="space-y-1.5 relative" ref={provSuggestionRef}>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">ค้นหานักเรียน</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                    <input
                      type="text"
                      value={provSearchQuery}
                      onChange={async (e) => {
                        const q = e.target.value;
                        setProvSearchQuery(q);
                        if (q.length >= 2) {
                          setProvSearchingStudents(true);
                          setProvShowSuggestions(true);
                          const { data } = await supabase
                            .from('students')
                            .select('id, student_id, prefix, first_name, last_name, academic_year, gender, birth_date, class_level, room, weight, height, photo_url, national_id')
                            .eq('academic_year', selectedYear)
                            .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,student_id.ilike.%${q}%,national_id.ilike.%${q}%`)
                            .limit(10);
                          setProvSearchResults(data || []);
                          setProvSearchingStudents(false);
                        } else {
                          setProvShowSuggestions(false);
                          setProvSearchResults([]);
                        }
                      }}
                      placeholder="พิมพ์ชื่อ/รหัส/เลขบัตรประชาชน..."
                      className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-indigo-500/10"
                    />
                  </div>

                  {/* ผลค้นหา */}
                  {provShowSuggestions && (
                    <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl mt-1 max-h-[250px] overflow-y-auto">
                      {provSearchingStudents ? (
                        <div className="p-4 text-center text-slate-400 text-xs font-bold flex items-center justify-center gap-2">
                          <Loader2 className="animate-spin" size={14} /> กำลังค้นหา...
                        </div>
                      ) : provSearchResults.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-xs font-bold">ไม่พบนักเรียน</div>
                      ) : (
                        provSearchResults.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            className="w-full text-left p-3 hover:bg-indigo-50 transition-colors flex items-center gap-3 border-b border-slate-50 last:border-0"
                            onClick={() => {
                              setProvSelectedStudent(s);
                              setProvSearchQuery(`${s.prefix}${s.first_name} ${s.last_name}`);
                              setProvShowSuggestions(false);
                            }}
                          >
                            <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center shrink-0">
                              <User size={14} className="text-indigo-400" />
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-800">{s.prefix}{s.first_name} {s.last_name}</p>
                              <p className="text-[10px] text-slate-400 font-bold">ชั้น {s.class_level}/{s.room} • {s.gender === 'male' || s.gender === 'ชาย' || s.gender === 'ช' ? 'ชาย' : 'หญิง'}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* แสดงนักเรียนที่เลือก */}
                {provSelectedStudent && (
                  <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-indigo-900">{provSelectedStudent.prefix}{provSelectedStudent.first_name} {provSelectedStudent.last_name}</p>
                      <button onClick={() => { setProvSelectedStudent(null); setProvSearchQuery(''); }} className="text-slate-400 hover:text-red-500">
                        <X size={14} />
                      </button>
                    </div>
                    <p className="text-[10px] text-indigo-600/70 font-bold">
                      ชั้น {provSelectedStudent.class_level}/{provSelectedStudent.room} • {provSelectedStudent.gender === 'male' || provSelectedStudent.gender === 'ชาย' || provSelectedStudent.gender === 'ช' ? 'ชาย' : 'หญิง'} • เลขประชาชน: {provSelectedStudent.national_id || '-'}
                    </p>
                  </div>
                )}

                {/* เลือกประเภทกีฬา */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">ประเภทกีฬา</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {PROVINCIAL_SPORTS.map(sport => (
                      <button
                        key={sport}
                        type="button"
                        onClick={() => setProvSportType(sport)}
                        className={`py-2.5 px-3 rounded-xl font-black text-xs text-left transition-all ${
                          provSportType === sport
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
                        }`}
                      >
                        {sport === 'ฟุตบอล' ? '⚽' : sport === 'ฟุตซอล' ? '🥅' : sport.includes('วอลเลย์') ? '🏐' : '🎱'} {sport}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ปุ่มลงทะเบียน */}
                <button
                  onClick={async () => {
                    if (!provSelectedStudent) {
                      alert('กรุณาเลือกนักเรียนก่อนค่ะ');
                      return;
                    }
                    // ตรวจสอบซ้ำ
                    const duplicate = provRegistrations.some(r => r.student_id === provSelectedStudent.id && r.sport_type === provSportType);
                    if (duplicate) {
                      alert(`${provSelectedStudent.prefix}${provSelectedStudent.first_name} เคยลงทะเบียน "${provSportType}" แล้วค่ะ`);
                      return;
                    }

                    setProvSubmitting(true);
                    try {
                      const userId = (await supabase.auth.getUser()).data.user?.id;
                      const { error } = await supabase
                        .from('athletics_registrations')
                        .insert({
                          student_id: provSelectedStudent.id,
                          academic_year: selectedYear,
                          prefix: provSelectedStudent.prefix,
                          first_name: provSelectedStudent.first_name,
                          last_name: provSelectedStudent.last_name,
                          gender: provSelectedStudent.gender,
                          birth_date: provSelectedStudent.birth_date,
                          class_level: provSelectedStudent.class_level,
                          room: provSelectedStudent.room,
                          weight: provSelectedStudent.weight,
                          height: provSelectedStudent.height,
                          photo_url: provSelectedStudent.photo_url || '',
                          citizen_id: provSelectedStudent.national_id || '',
                          sport_type: provSportType,
                          age_group: '-',
                          shirt_size: '-',
                          competition_type: 'provincial',
                          registered_by: userId
                        });

                      if (error) throw error;
                      alert(`ลงทะเบียน ${provSelectedStudent.prefix}${provSelectedStudent.first_name} ในกีฬา "${provSportType}" สำเร็จ! 🎉`);
                      setProvSelectedStudent(null);
                      setProvSearchQuery('');
                      fetchRegistrations();
                    } catch (err: any) {
                      alert('เกิดข้อผิดพลาด: ' + err.message);
                    } finally {
                      setProvSubmitting(false);
                    }
                  }}
                  disabled={provSubmitting || !provSelectedStudent}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200/40 disabled:opacity-40"
                >
                  {provSubmitting ? (
                    <><Loader2 className="animate-spin" size={14} /> กำลังบันทึก...</>
                  ) : (
                    <><UserPlus size={14} /> ลงทะเบียนตัวแทน</>
                  )}
                </button>
              </div>

              {/* หนังสือรับรอง — เลือกและพิมพ์ */}
              <div className="bg-white p-6 rounded-[28px] border border-indigo-100 shadow-sm space-y-4">
                <h4 className="font-black text-indigo-800 flex items-center gap-2 text-sm border-b border-indigo-50 pb-3">
                  <ShieldCheck size={18} className="text-indigo-500" />
                  หนังสือรับรองของสถานศึกษา
                </h4>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">เลือกประเภทกีฬา</label>
                  <select
                    value={certSportName}
                    onChange={(e) => { setCertSportName(e.target.value); setProvCertSelectedRegs([]); }}
                    className="w-full px-3 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 text-xs outline-hidden"
                  >
                    <option value="ทั้งหมด">ทั้งหมด</option>
                    {PROVINCIAL_SPORTS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* รายชื่อ checkbox */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">เลือกพิมพ์ ({provCertSelectedRegs.length} คน)</label>
                    {(() => {
                      const certFiltered = provRegistrations.filter(r => certSportName === 'ทั้งหมด' || r.sport_type === certSportName);
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (provCertSelectedRegs.length === certFiltered.length) {
                              setProvCertSelectedRegs([]);
                            } else {
                              setProvCertSelectedRegs(certFiltered.map(r => r.id));
                            }
                          }}
                          className="text-[10px] font-black text-indigo-600 hover:text-indigo-800"
                        >
                          {provCertSelectedRegs.length === certFiltered.length ? '❌ ยกเลิก' : '✅ เลือกทั้งหมด'}
                        </button>
                      );
                    })()}
                  </div>

                  <div className="max-h-[250px] overflow-y-auto space-y-1 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                    {(() => {
                      const certFiltered = provRegistrations.filter(r => certSportName === 'ทั้งหมด' || r.sport_type === certSportName);
                      // Group by student
                      const grouped: Record<string, Registration & { events: string[] }> = {};
                      certFiltered.forEach(r => {
                        const key = r.citizen_id || r.student_id;
                        if (!grouped[key]) {
                          grouped[key] = { ...r, events: [r.sport_type] };
                        } else {
                          if (!grouped[key].events.includes(r.sport_type)) grouped[key].events.push(r.sport_type);
                        }
                      });
                      const students = Object.values(grouped);

                      return students.length === 0 ? (
                        <p className="text-center text-slate-400 text-xs py-4 italic">ไม่พบนักกีฬา</p>
                      ) : (
                        students.map(student => {
                          const regIds = certFiltered.filter(r => (r.citizen_id || r.student_id) === (student.citizen_id || student.student_id)).map(r => r.id);
                          const isSelected = regIds.some(id => provCertSelectedRegs.includes(id));
                          return (
                            <label
                              key={student.id}
                              className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-all text-xs ${
                                isSelected ? 'bg-indigo-50 border border-indigo-200' : 'bg-white border border-slate-50 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  if (isSelected) {
                                    setProvCertSelectedRegs(prev => prev.filter(id => !regIds.includes(id)));
                                  } else {
                                    setProvCertSelectedRegs(prev => [...prev, ...regIds]);
                                  }
                                }}
                                className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-black text-slate-800 truncate">{student.prefix}{student.first_name} {student.last_name}</p>
                                <p className="text-[9px] text-slate-400 font-bold">{student.events.join(', ')}</p>
                              </div>
                            </label>
                          );
                        })
                      );
                    })()}
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (provCertSelectedRegs.length === 0) {
                      alert('กรุณาเลือกนักกีฬาอย่างน้อย 1 คนค่ะ');
                      return;
                    }
                    // ใช้ provCertSelectedRegs สำหรับ CERT print
                    setCertSelectedRegs(provCertSelectedRegs);
                    setPrintType('CERT');
                    setIsPrintMode(true);
                    setTimeout(() => {
                      window.print();
                      setIsPrintMode(false);
                    }, 800);
                  }}
                  disabled={provCertSelectedRegs.length === 0}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200/40 disabled:opacity-40"
                >
                  <Printer size={14} /> พิมพ์หนังสือรับรอง ({provCertSelectedRegs.length} ฉบับ)
                </button>
              </div>
            </div>

            {/* Right Column: Registration List */}
            <div className="lg:col-span-2 space-y-5">
              <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                  <h4 className="font-black text-slate-800 flex items-center gap-2 text-sm">
                    <Award size={18} className="text-indigo-500" />
                    รายชื่อนักเรียนตัวแทน ({provRegistrations.length} คน)
                  </h4>
                  <div className="flex items-center gap-2">
                    {/* กรองกีฬา */}
                    <select
                      value={provFilterSport}
                      onChange={(e) => setProvFilterSport(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-hidden"
                    >
                      <option value="all">ทุกประเภท</option>
                      {PROVINCIAL_SPORTS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    {/* ค้นหา */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
                      <input
                        type="text"
                        value={provSearchTerm}
                        onChange={(e) => setProvSearchTerm(e.target.value)}
                        placeholder="ค้นหา..."
                        className="pl-8 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-hidden w-40"
                      />
                    </div>
                    <button
                      onClick={fetchProvincialRegistrations}
                      className="p-2 bg-slate-50 text-slate-500 rounded-xl hover:bg-slate-100 border border-slate-100"
                      title="โหลดใหม่"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>

                {provLoadingRegs ? (
                  <div className="py-20 text-center text-slate-400">
                    <Loader2 className="animate-spin mx-auto mb-3" size={28} />
                    <p className="text-xs font-black">กำลังโหลดข้อมูล...</p>
                  </div>
                ) : (() => {
                  const filtered = provRegistrations.filter(r => {
                    const matchSport = provFilterSport === 'all' || r.sport_type === provFilterSport;
                    const fullName = `${r.prefix}${r.first_name} ${r.last_name}`;
                    const matchSearch = fullName.includes(provSearchTerm) || r.sport_type.includes(provSearchTerm) || r.citizen_id?.includes(provSearchTerm);
                    return matchSport && matchSearch;
                  });

                  return filtered.length === 0 ? (
                    <div className="py-16 text-center text-slate-300">
                      <Trophy size={40} className="mx-auto mb-3 text-slate-200" />
                      <p className="font-black text-sm">ยังไม่มีนักเรียนตัวแทน</p>
                      <p className="text-xs text-slate-400 mt-1">เลือกนักเรียนจากฟอร์มด้านซ้ายเพื่อลงทะเบียน</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-100">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50/80 text-slate-500 font-black uppercase tracking-wider text-[10px]">
                            <th className="py-3 px-3 text-left">#</th>
                            <th className="py-3 px-3 text-left">ชื่อ - สกุล</th>
                            <th className="py-3 px-3 text-left">ชั้น</th>
                            <th className="py-3 px-3 text-left">ประเภทกีฬา</th>
                            <th className="py-3 px-3 text-left">เลขประชาชน</th>
                            <th className="py-3 px-3 text-center">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((reg, idx) => (
                            <tr key={reg.id} className="border-t border-slate-50 hover:bg-indigo-50/30 transition-colors">
                              <td className="py-3 px-3 font-bold text-slate-400">{idx + 1}</td>
                              <td className="py-3 px-3">
                                <p className="font-extrabold text-slate-800">{reg.prefix}{reg.first_name} {reg.last_name}</p>
                                <p className="text-[10px] text-slate-400 font-bold">{reg.gender === 'male' || reg.gender === 'ชาย' || reg.gender === 'ช' ? 'ชาย' : 'หญิง'}</p>
                              </td>
                              <td className="py-3 px-3 font-bold text-slate-600">{reg.class_level}/{reg.room}</td>
                              <td className="py-3 px-3">
                                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg font-black text-[10px] border border-indigo-100">
                                  {reg.sport_type}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-600 text-[11px]">{reg.citizen_id || '-'}</td>
                              <td className="py-3 px-3 text-center">
                                <button
                                  onClick={async () => {
                                    if (!window.confirm(`ลบ ${reg.prefix}${reg.first_name} ออกจากประเภท "${reg.sport_type}" ใช่หรือไม่?`)) return;
                                    try {
                                      const { error } = await supabase
                                        .from('athletics_registrations')
                                        .delete()
                                        .eq('id', reg.id);
                                      if (error) throw error;
                                      
                                      // Update local states immediately
                                      setProvRegistrations(prev => prev.filter(r => r.id !== reg.id));
                                      setProvCertSelectedRegs(prev => prev.filter(id => id !== reg.id));
                                      alert('ลบรายชื่อออกสำเร็จแล้วค่ะ');
                                      
                                      // Background sync
                                      fetchRegistrations();
                                    } catch (err: any) {
                                      console.error('Error deleting registration:', err);
                                      alert('ไม่สามารถลบข้อมูลได้: ' + err.message);
                                    }
                                  }}
                                  className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 border border-red-100"
                                  title="ลบ"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* Certificate Preview */}
              {provCertSelectedRegs.length > 0 && (() => {
                const firstReg = provRegistrations.find(r => provCertSelectedRegs.includes(r.id));
                if (!firstReg) return null;
                const dateParts = formatThaiDateParts(firstReg.birth_date);
                const studentAge = calculateAgeFromBirthDate(firstReg.birth_date);
                
                let sportDisplayName = certSportName === 'ทั้งหมด' ? firstReg.sport_type : certSportName;
                sportDisplayName = sportDisplayName.replace(/วอลเลย์บอลในร่ม/g, 'วอลเลย์บอล').replace(/วอลเลบอลในร่ม/g, 'วอลเลย์บอล');

                const schoolName = reportTeamName || '';
                const directorPosition = schoolName.startsWith('โรงเรียน') ? `ผู้อำนวยการ${schoolName}` : `ผู้อำนวยการโรงเรียน${schoolName}`;
                const normalizedPrefix = getFullPrefix(firstReg.prefix);
                const classLevelAndRoom = firstReg.class_level 
                  ? (firstReg.class_level.startsWith('ป.') || firstReg.class_level.startsWith('ม.') 
                      ? firstReg.class_level 
                      : `ป.${firstReg.class_level}`) 
                  : '.........................';
                const roomText = firstReg.room ? `/${firstReg.room}` : '';
                const classRoomThai = toThaiNumerals(classLevelAndRoom + roomText);

                return (
                  <div className="bg-white p-8 rounded-[28px] border border-indigo-100 shadow-sm">
                    <h4 className="font-black text-indigo-800 flex items-center gap-2 text-sm mb-5">
                      <FileText size={16} className="text-indigo-500" />
                      ตัวอย่างหนังสือรับรอง (Preview)
                    </h4>
                    <div
                      className="bg-white p-8 border border-slate-300 mx-auto"
                      style={{ fontFamily: '"TH Sarabun PSK", "TH Sarabun New", "Sarabun", sans-serif', fontSize: '16pt', lineHeight: '1.6', maxWidth: '700px' }}
                    >
                      <h4 style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '18pt', marginBottom: '16px' }}>หนังสือรับรองของสถานศึกษา</h4>
                      
                      <p style={{ textIndent: '60px', textAlign: 'left', margin: '0 0 12px 0', fontSize: '16pt' }}>
                        ข้าพเจ้า {reportManagerName || '.......'} ตำแหน่ง {directorPosition} ขอรับรองว่า {normalizedPrefix} {firstReg.first_name} {firstReg.last_name} เกิดวันที่ {toThaiNumerals(dateParts.day)} เดือน {dateParts.month} พ.ศ. {toThaiNumerals(dateParts.year)} มีอายุ {studentAge ? toThaiNumerals(studentAge) : '.........'} ปี ปัจจุบันกำลังเรียนชั้น {classRoomThai} และเป็นผู้มีคุณสมบัติถูกต้องตามระเบียบการรับสมัคร เข้าแข่งขันกีฬา {sportDisplayName} นักเรียน นักศึกษา และประชาชนจังหวัดพัทลุง ครั้งที่ {compEditionThai} ประจำปี {compYearThai} ทุกประการ
                      </p>

                      <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'flex-end', paddingRight: '20px' }}>
                        <div style={{ textAlign: 'center', lineHeight: '1.4', width: '300px', fontSize: '16pt' }}>
                          <p style={{ margin: '0', fontSize: '16pt' }}>(ลงชื่อ) ..............................................................</p>
                          <p style={{ margin: '6px 0 0 0', fontSize: '16pt' }}>( {reportManagerName || '.........'} )</p>
                          <p style={{ margin: '4px 0 0 0', fontSize: '16pt' }}>ตำแหน่ง {directorPosition}</p>
                          <p style={{ margin: '6px 0 0 0', fontSize: '13pt', color: '#888' }}>ประทับตราสถานศึกษารับรอง</p>
                        </div>
                      </div>

                      {provCertSelectedRegs.length > 1 && (
                        <p className="text-xs text-center text-slate-400 font-bold mt-4 pt-3 border-t border-dashed border-slate-200">
                          📄 แสดงตัวอย่างคนแรก (จากทั้งหมด {provCertSelectedRegs.length} คน)
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}


      {showCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] overflow-hidden shadow-2xl border border-slate-100 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h4 className="font-black text-slate-800 flex items-center gap-2">
                <Camera className="text-emerald-500" size={18} />
                ถ่ายภาพนักกีฬาหน้าตรง
              </h4>
              <button 
                onClick={stopCamera}
                className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 bg-slate-950 flex items-center justify-center relative aspect-[3/4] max-h-[360px] overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 border-2 border-dashed border-emerald-500/40 rounded-3xl aspect-[3/4] pointer-events-none" />
              <div className="absolute bottom-2 text-center text-[10px] text-slate-400 font-bold bg-slate-900/80 px-3 py-1 rounded-full pointer-events-none">
                จัดหน้าให้อยู่ในกรอบแนวตั้ง
              </div>
            </div>
            
            <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                type="button"
                onClick={stopCamera}
                className="flex-1 py-3 px-4 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl font-bold text-slate-600 text-xs transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-md shadow-emerald-500/20 hover:scale-102 active:scale-98 transition-all"
              >
                กดถ่ายภาพ 📸
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Photo Upload Modal */}
      {quickPhotoReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] overflow-hidden shadow-2xl border border-slate-100 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h4 className="font-black text-slate-800 flex items-center gap-2">
                <Camera className="text-emerald-500" size={18} />
                เพิ่ม/เปลี่ยนรูปภาพนักกีฬา (ด่วน)
              </h4>
              <button 
                onClick={() => {
                  setQuickPhotoReg(null);
                  setQuickPhotoFile(null);
                  setQuickPhotoPreview(null);
                }}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 shadow-xs transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="text-center">
                <p className="text-xs font-black text-slate-800">{quickPhotoReg.prefix}{quickPhotoReg.first_name} {quickPhotoReg.last_name}</p>
                <p className="text-[10px] text-slate-400 font-bold mt-1">ระดับชั้น ม. {quickPhotoReg.class_level}/{quickPhotoReg.room}</p>
              </div>

              {/* Picture Area */}
              <div className="flex justify-center">
                <div className="w-28 h-36 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden bg-slate-50 flex items-center justify-center relative">
                  {quickPhotoPreview ? (
                    <img 
                      src={quickPhotoPreview} 
                      alt="Preview" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="text-center p-3 text-slate-300">
                      <User size={36} className="mx-auto mb-2 text-slate-200" />
                      <span className="text-[9px] font-black block">ยังไม่มีรูปภาพ</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <input
                  type="file"
                  id="quick-file-input"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setQuickPhotoFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setQuickPhotoPreview(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('quick-file-input')?.click()}
                  className="flex-1 py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-600 text-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  <Upload size={13} /> อัปโหลดรูปภาพ
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await startCamera();
                  }}
                  className="flex-1 py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  <Camera size={13} /> ถ่ายจากกล้อง
                </button>
              </div>
            </div>

            <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setQuickPhotoReg(null);
                  setQuickPhotoFile(null);
                  setQuickPhotoPreview(null);
                }}
                className="flex-1 py-3 px-4 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl font-bold text-slate-600 text-xs transition-colors"
                disabled={submitting}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveQuickPhoto}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-md shadow-emerald-500/20 hover:scale-102 active:scale-98 transition-all flex items-center justify-center gap-2"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" size={13} />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>บันทึกรูปภาพ 💾</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
