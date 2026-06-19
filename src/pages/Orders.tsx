import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { uploadFile, deleteFileFromDrive } from '../lib/storage';
import { useAuth } from '../contexts/AuthContext';
import { sendLineNotification, sendInteractiveFlexMessage } from '../lib/lineNotify';
import { generateAIDraft } from '../lib/aiService';
import Modal from '../components/Modal';
import { 
  Search, 
  ExternalLink,
  Loader2,
  Save,
  Book,
  Trash2,
  Printer,
  FileText,
  Plus,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Bot,
  Sparkles
} from 'lucide-react';
import garuda3cm from '../assets/saraban/garuda-3cm.png';

export default function Orders() {
  const { user, profile } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const currentYearBE = new Date().getFullYear() + 543;
  const [selectedYear, setSelectedYear] = useState<number | null>(currentYearBE);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [selectedOrderForApproval, setSelectedOrderForApproval] = useState<any>(null);
  const [directorDecision, setDirectorDecision] = useState<'อนุมัติ' | 'ทราบ'>('อนุมัติ');
  const [directorOpinion, setDirectorOpinion] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  const [formData, setFormData] = useState({
    order_number: '',
    subject: '',
    issuer: 'โรงเรียนบ้านควนโคกยา',
    order_date: new Date().toISOString().split('T')[0],
    content: '',
    sign_name: '',
    sign_position: 'ผู้อำนวยการโรงเรียนบ้านควนโคกยา',
    committees: [{ teacher_id: '', role: 'ประธานกรรมการ', duty: '' }] as any[],
    legal_refs: [] as string[],
    show_director_opinion: false
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => { 
    fetchDocs(); 
    fetchSettings();
    fetchTeachers();
  }, []);

  async function fetchTeachers() {
    const { data } = await supabase.from('teachers').select('id, prefix, first_name, last_name, position').eq('status', 'active');
    setTeachers(data || []);
  }

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

  async function fetchDocs(yearToFetch = selectedYear) {
    setLoading(true);
    try {
      let query = supabase.from('orders').select('*');
      if (yearToFetch) {
        query = query.eq('doc_year', yearToFetch);
      }
      const { data } = await query.order('created_at', { ascending: false });
      setDocs(data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  function addCommitteeMember() {
    setFormData(prev => ({
      ...prev,
      committees: [...prev.committees, { teacher_id: '', role: 'กรรมการ', duty: '', group_name: '' }]
    }));
  }

  function updateCommitteeMember(index: number, field: string, value: string) {
    const next = [...formData.committees];
    next[index] = { ...next[index], [field]: value };
    setFormData(prev => ({ ...prev, committees: next }));
  }

  function removeCommitteeMember(index: number) {
    const next = [...formData.committees];
    next.splice(index, 1);
    setFormData(prev => ({ ...prev, committees: next }));
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

    const resolvedCommittees = (data.committees || []).map((c: any) => {
      const teach = teachers.find(t => t.id === c.teacher_id);
      const prefix = teach?.prefix || '';
      const firstName = teach?.first_name || '';
      const lastName = teach?.last_name || '';
      const fullName = teach ? `${prefix}${firstName} ${lastName}` : '................................................';
      return { ...c, fullName };
    });

    const formatGroupName = (name: string) => {
      const trimName = name?.trim() || '';
      if (!trimName) return '';
      if (trimName.startsWith('ฝ่าย') || trimName.startsWith('คณะ') || trimName.startsWith('กลุ่ม')) {
        return trimName;
      }
      return `ฝ่าย${trimName}`;
    };

    const polishDuty = (dutyText: string, groupName: string, subject: string) => {
      const text = dutyText?.trim() || '';
      const gName = groupName || '';
      const subj = subject || '';
      
      if (!text) return '';
      
      // ตรวจจับคำสั้นๆ และแปลงเป็นรูปประโยคทางการ
      if (text === 'ให้คำปรึกษา' || text === 'ที่ปรึกษา' || text === 'ที่ปรึกษาคณะทำงาน' || text === 'ให้คำปรึกษาแนะนำ') {
        return `ให้คำปรึกษา แนะนำ และอำนวยความสะดวกในการจัดดำเนินงาน${subj}ให้เป็นไปด้วยความเรียบร้อย`;
      }
      if (text === 'จัดสถานที่ประชุม' || text === 'จัดสถานที่' || text === 'เตรียมสถานที่') {
        return `จัดเตรียมสถานที่ โต๊ะ เก้าอี้ และระบบโสตทัศนูปกรณ์สำหรับการจัด${subj}ให้เรียบร้อยและพร้อมใช้งาน`;
      }
      if (text === 'ประสานงาน' || text === 'ผู้ประสานงาน') {
        return `ประสานงานกับครูประจำชั้นและฝ่ายที่เกี่ยวข้องในการรวบรวมข้อมูลและรายละเอียดสำหรับการดำเนินงาน${subj}`;
      }
      if (text === 'สรุปผล' || text === 'รายงานผล' || text === 'สรุปและรายงานผล') {
        return `ดำเนินการรวบรวมข้อมูล สรุปผลการดำเนินงาน และรายงานผลต่อผู้บริหารสถานศึกษาเพื่อนำไปพัฒนางานต่อไป`;
      }
      if (text === 'จัดเตรียมเอกสาร' || text === 'เตรียมเอกสาร' || text === 'เอกสารประกอบ') {
        return `จัดเตรียมวัสดุ อุปกรณ์ เอกสารประกอบการประชุม และแบบประเมินผลสำหรับการดำเนินงาน${subj}`;
      }
      if (text === 'ต้อนรับ' || text === 'ปฏิคม') {
        return `ดูแลต้อนรับผู้ปกครองและผู้เข้าร่วมประชุม อำนวยความสะดวกในด้านจุดลงทะเบียนและด้านต่างๆ`;
      }
      if (text === 'อาหารและเครื่องดื่ม' || text === 'สวัสดิการ') {
        return `จัดเตรียมอาหารว่าง เครื่องดื่ม และสวัสดิการสำหรับผู้เข้าร่วมประชุมและคณะทำงาน`;
      }
      
      // เพิ่มเติมกรณีทั่วไปที่กรอกมาสั้นๆ (น้อยกว่า 15 ตัวอักษร)
      if (text.length < 15) {
        if (gName.includes('อำนวยการ')) {
          return `${text} และอำนวยการจัดงานให้สำเร็จลุล่วงตามวัตถุประสงค์`;
        }
        if (gName.includes('สถานที่')) {
          return `${text} และจัดระบบโสตทัศนูปกรณ์ให้มีความพร้อมในการจัดกิจกรรม`;
        }
        if (gName.includes('เอกสาร') || gName.includes('วิชาการ')) {
          return `${text} และสรุปข้อมูลรายงานให้เรียบร้อย`;
        }
        return `ปฏิบัติหน้าที่${text} และประสานการทำงานร่วมกับฝ่ายต่างๆ เพื่อให้งานดำเนินไปด้วยความเรียบร้อย`;
      }
      
      return text;
    };

    const getAutomaticDutiesForGroup = (groupName: string, subject: string) => {
      const gName = groupName || '';
      const subj = subject || '';
      
      if (gName.includes('อำนวยการ')) {
        return [
          `วางแผน ดำเนินการ และอำนวยการจัด${subj}ให้เป็นไปด้วยความเรียบร้อยและสอดคล้องกับนโยบายของโรงเรียน`,
          `ให้คำปรึกษา เสนอแนะ และแก้ไขปัญหาอุปสรรคในการปฏิบัติงานของทุกฝ่ายเพื่อให้งานเกิดประสิทธิภาพสูงสุด`,
          `ดำเนินการสรุปผลการจัดงานและรายงานผลต่อผู้บริหารสถานศึกษาทราบในลำดับต่อไป`
        ];
      }
      if (gName.includes('สถานที่') || gName.includes('พัสดุ')) {
        return [
          `จัดเตรียมสถานที่ประชุม โต๊ะ เก้าอี้ และระบบโสตทัศนูปกรณ์ที่จำเป็นสำหรับการจัด${subj}`,
          `ดูแลรักษาความสะอาด ความเป็นระเบียบเรียบร้อย และความปลอดภัยของสถานที่ปฏิบัติงานทั้งก่อนและหลังเสร็จสิ้นกิจกรรม`
        ];
      }
      if (gName.includes('ประสานงาน') || gName.includes('ประชาสัมพันธ์')) {
        return [
          `ประสานงานกับครูประจำชั้น คณะครู และผู้เกี่ยวข้องในการรวบรวมข้อมูลและแจ้งกำหนดการจัด${subj}`,
          `ประชาสัมพันธ์ข่าวสารและข้อมูลต่างๆ เพื่อสร้างความเข้าใจและความร่วมมือในการเข้าร่วมกิจกรรมอย่างทั่วถึง`
        ];
      }
      if (gName.includes('วิชาการ') || gName.includes('ทะเบียน') || gName.includes('เอกสาร')) {
        return [
          `จัดเตรียมข้อมูลการเรียน พฤติกรรมนักเรียน และจัดทำเอกสารประกอบการจัด${subj}`,
          `รวบรวมแบบประเมินความพึงพอใจและแบบสำรวจข้อมูลจากการดำเนินงานเพื่อส่งมอบให้ฝ่ายสรุปรายงาน`
        ];
      }
      if (gName.includes('ปฏิคม') || gName.includes('ต้อนรับ') || gName.includes('สวัสดิการ')) {
        return [
          `ต้อนรับผู้เข้าประชุมและแขกผู้มีเกียรติ พร้อมทั้งอำนวยความสะดวกในจุดลงทะเบียนและจุดบริการข้อมูล`,
          `จัดเตรียมเครื่องดื่ม อาหารว่าง และสวัสดิการที่จำเป็นสำหรับการปฏิบัติงานของคณะครูและผู้เข้าร่วมประชุม`
        ];
      }
      
      return [
        `ปฏิบัติหน้าที่ในส่วนงานที่รับผิดชอบตามที่ประธานคณะทำงานหรือฝ่ายอำนวยการมอบหมาย`,
        `ประสานความร่วมมือกับทุกฝ่ายเพื่อแก้ไขปัญหาอุปสรรคและช่วยให้งานบรรลุเป้าหมายตามเกณฑ์มาตรฐาน`
      ];
    };

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
              margin: 10mm auto; padding: 1.5cm 2cm 2cm 3cm;
              box-sizing: border-box; position: relative;
              font-size: 16pt; line-height: 1.25; color: black;
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
              margin-top: 1.5cm;
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

            ${resolvedCommittees.length > 0 ? `
            <div style="margin-top: 0.5cm; font-size: 16pt; line-height: 1.25; text-align: justify; word-break: break-word;">
              ${(() => {
                const groups: { [key: string]: any[] } = {};
                resolvedCommittees.forEach((c: any) => {
                  let gName = c.group_name?.trim() || '';
                  if (gName) {
                    gName = formatGroupName(gName);
                  } else {
                    gName = 'คณะทำงานดำเนินงาน';
                  }
                  if (!groups[gName]) {
                    groups[gName] = [];
                  }
                  groups[gName].push(c);
                });

                const groupKeys = Object.keys(groups);
                const hasSubGroups = groupKeys.length > 1 || (groupKeys.length === 1 && groupKeys[0] !== 'คณะทำงานดำเนินงาน');

                // ไดนามิกหัวข้อข้อ 1
                const section1Header = (() => {
                  const subj = data.subject || '';
                  if (subj.startsWith('แต่งตั้ง')) {
                    return `๑. ${subj} ประกอบด้วย`;
                  }
                  return `๑. แต่งตั้งคณะทำงาน${subj} ประกอบด้วย`;
                })();

                // 1. แต่งตั้งคณะทำงาน ประกอบด้วย (ใช้ตารางเพื่อความตรงแนวของชือและบทบาท)
                const section1 = `
                  <div style="font-weight: bold; margin-top: 0.5cm; font-size: 16pt;">${toThaiNumerals(section1Header)}</div>
                  <div style="padding-left: 0.8cm; margin-top: 0.2cm;">
                    ${hasSubGroups ? 
                      groupKeys.map((gName, gIdx) => {
                        const members = groups[gName];
                        const thaiGIdx = toThaiNumerals((gIdx + 1).toString());
                        return `
                          <div style="font-weight: bold; margin-top: 0.3cm; font-size: 16pt; page-break-inside: avoid;">๑.${thaiGIdx} ${gName} ประกอบด้วย</div>
                          <table style="width: 100%; border-collapse: collapse; margin-top: 0.15cm;">
                            <tbody>
                              ${members.map((c: any, mIdx: number) => {
                                const thaiMIdx = toThaiNumerals((mIdx + 1).toString());
                                const hasRole = c.role?.trim();
                                return `
                                  <tr style="page-break-inside: avoid; font-size: 16pt; line-height: 1.25;">
                                    <td style="width: ${hasRole ? '50%' : '100%'}; padding: 3px 0; vertical-align: top; text-align: left;">
                                      &nbsp;&nbsp;&nbsp;&nbsp;๑.${thaiGIdx}.${thaiMIdx} ${c.fullName}
                                    </td>
                                    ${hasRole ? `
                                    <td style="width: 20%; padding: 3px 0; vertical-align: top; text-align: left; white-space: nowrap; color: #333;">
                                      ทำหน้าที่เป็น
                                    </td>
                                    <td style="width: 30%; padding: 3px 0; vertical-align: top; text-align: left; font-weight: bold;">
                                      ${c.role}
                                    </td>
                                    ` : ''}
                                  </tr>
                                `;
                              }).join('')}
                            </tbody>
                          </table>
                        `;
                      }).join('')
                      :
                      `<table style="width: 100%; border-collapse: collapse; margin-top: 0.15cm;">
                        <tbody>
                          ${groups[groupKeys[0]].map((c: any, mIdx: number) => {
                            const thaiMIdx = toThaiNumerals((mIdx + 1).toString());
                            const hasRole = c.role?.trim();
                            return `
                              <tr style="page-break-inside: avoid; font-size: 16pt; line-height: 1.25;">
                                <td style="width: ${hasRole ? '50%' : '100%'}; padding: 3px 0; vertical-align: top; text-align: left;">
                                  ๑.${thaiMIdx} ${c.fullName}
                                </td>
                                ${hasRole ? `
                                <td style="width: 20%; padding: 3px 0; vertical-align: top; text-align: left; white-space: nowrap; color: #333;">
                                  ทำหน้าที่เป็น
                                </td>
                                <td style="width: 30%; padding: 3px 0; vertical-align: top; text-align: left; font-weight: bold;">
                                  ${c.role}
                                </td>
                                ` : ''}
                              </tr>
                            `;
                          }).join('')}
                        </tbody>
                      </table>`
                    }
                  </div>
                `;

                // 2. หน้าที่และความรับผิดชอบ (ใช้ Flex เพื่อความเยื้องและเป็นระเบียบเรียบร้อย)
                const section2 = `
                  <div style="font-weight: bold; margin-top: 0.7cm; page-break-inside: avoid; font-size: 16pt;">๒. หน้าที่และความรับผิดชอบ</div>
                  <div style="padding-left: 0.8cm; margin-top: 0.2cm;">
                    ${hasSubGroups ?
                      groupKeys.map((gName, gIdx) => {
                        const members = groups[gName];
                        const thaiGIdx = toThaiNumerals((gIdx + 1).toString());
                        
                        let duties: string[] = [];
                        members.forEach((c: any) => {
                          const rawDuty = c.duty?.trim();
                          if (rawDuty) {
                            const polished = polishDuty(rawDuty, gName, data.subject);
                            if (polished && !duties.includes(polished)) {
                              duties.push(polished);
                            }
                          }
                        });
                        
                        if (duties.length === 0) {
                          duties = getAutomaticDutiesForGroup(gName, data.subject);
                        }

                        return `
                          <div style="font-weight: bold; margin-top: 0.3cm; page-break-inside: avoid; font-size: 16pt;">๒.${thaiGIdx} ${gName} มีหน้าที่และความรับผิดชอบ ดังนี้</div>
                          <div style="margin-top: 0.15cm; padding-left: 0.5cm;">
                            ${duties.map((d, dIdx) => {
                              const thaiDIdx = toThaiNumerals((dIdx + 1).toString());
                              return `
                                <div style="display: flex; margin-bottom: 0.15cm; text-align: justify; page-break-inside: avoid; line-height: 1.25; font-size: 16pt;">
                                  <div style="width: 0.8cm; flex-shrink: 0; text-align: left;">${thaiDIdx})</div>
                                  <div style="flex: 1;">${d}</div>
                                </div>
                              `;
                            }).join('')}
                          </div>
                        `;
                      }).join('')
                      :
                      (() => {
                        let duties: string[] = [];
                        groups[groupKeys[0]].forEach((c: any) => {
                          const rawDuty = c.duty?.trim();
                          if (rawDuty) {
                            const polished = polishDuty(rawDuty, groupKeys[0], data.subject);
                            if (polished && !duties.includes(polished)) {
                              duties.push(polished);
                            }
                          }
                        });
                        if (duties.length === 0) {
                          duties = getAutomaticDutiesForGroup(groupKeys[0], data.subject);
                        }
                        return duties.map((d, dIdx) => {
                          const thaiDIdx = toThaiNumerals((dIdx + 1).toString());
                          return `
                            <div style="display: flex; margin-bottom: 0.15cm; text-align: justify; page-break-inside: avoid; line-height: 1.25; font-size: 16pt;">
                              <div style="width: 0.8cm; flex-shrink: 0; text-align: left;">๒.${thaiDIdx}</div>
                              <div style="flex: 1;">${d}</div>
                            </div>
                          `;
                        }).join('');
                      })()
                    }
                  </div>
                `;

                return section1 + section2;
              })()}
            </div>
            ` : ''}
            
            <div class="footer-date-block">
              <div class="footer-date-content">
                ${toThaiNumerals(fullDate)}
              </div>
            </div>

            <div class="sig-block">
              <div class="sig-name-block" style="position: relative;">
                ${(data.status === 'approved' && settings?.director_signature_url) ? `
                  <div style="position: absolute; left: calc(50% + 0.5cm); transform: translateX(-50%); top: -0.9cm; width: 3.5cm; height: 1.2cm; z-index: 10; pointer-events: none;">
                    <img src="${settings.director_signature_url}" style="width: 100%; height: 100%; object-fit: contain;" />
                  </div>
                ` : ''}
                (ลงชื่อ).......................................................<br/>
                ( ${data.sign_name || settings?.director_name || '................................................'} )<br/>
                ตำแหน่ง ${data.sign_position || `ผู้อำนวยการ${settings?.school_name || 'โรงเรียนบ้านควนโคกยา'}`}
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
        sign_position: formData.sign_position,
        committees: formData.committees.filter(c => c.teacher_id !== ''),
        legal_refs: formData.legal_refs,
        show_director_opinion: formData.show_director_opinion
      };

      const orderDateObj = new Date(formData.order_date);
      const docYear = orderDateObj.getFullYear() + 543;

      const { data: insertedDocs, error } = await supabase.from('orders').insert([{ 
        order_number: formData.order_number || 'รออนุมัติ',
        subject: formData.subject,
        issuer: formData.issuer,
        order_date: formData.order_date,
        remark: JSON.stringify(extraData),
        file_url, 
        status: 'pending',
        created_by: user?.id,
        doc_year: docYear
      }]).select();

      if (error) throw new Error(`บันทึกข้อมูลไม่สำเร็จ: ${error.message}`);
      const insertedDoc = insertedDocs?.[0];

      // ดึงไลน์ ผอ. เพื่อเสนอตรง
      const { data: dirProfile } = await supabase
        .from('profiles')
        .select('line_user_id')
        .eq('role', 'director')
        .maybeSingle();

      const lineMessage = `เรื่อง: ${formData.subject}\nผู้เสนอ: ${profile?.display_name || ''}`;
      const lineActions: any[] = [
        { label: '✅ อนุมัติลงนาม', type: 'postback', data: `action=approve_doc&type=order&id=${insertedDoc?.id || ''}`, color: '#1DB446' },
        { label: '❌ ส่งกลับแก้ไข', type: 'postback', data: `action=reject_doc&type=order&id=${insertedDoc?.id || ''}`, color: '#FF3B30' }
      ];
      if (file_url) {
        lineActions.unshift({ label: '📄 ดูร่างคำสั่ง', type: 'uri', uri: file_url });
      }
      await sendInteractiveFlexMessage(
        dirProfile?.line_user_id || undefined,
        '⏳ เสนออนุมัติคำสั่งแต่งตั้ง',
        lineMessage,
        lineActions
      );

      setIsModalOpen(false);
      resetForm();
      fetchDocs();
      alert('บันทึกร่างคำสั่งเสนออนุมัติเรียบร้อยแล้ว');
    } catch (err: any) {
      console.error(err);
      alert(`ไม่สามารถบันทึกได้: ${err.message}`);
    } finally { setIsSaving(false); }
  }

  async function handleApprovalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrderForApproval) return;
    setIsSaving(true);
    try {
      let extraData: any = {};
      try {
        if (selectedOrderForApproval.remark && selectedOrderForApproval.remark.startsWith('{')) {
          extraData = JSON.parse(selectedOrderForApproval.remark);
        }
      } catch (err) {}

      const todayThai = new Date().toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      const updatedExtraData = {
        ...extraData,
        director_decision: directorDecision,
        director_opinion: directorOpinion,
        approved_date: todayThai,
        show_director_opinion: true
      };

      // ออกเลขคำสั่งรันต่อเนื่องอัตโนมัติ (หากเป็นค่า 'รออนุมัติ')
      let finalOrderNumber = selectedOrderForApproval.order_number;
      const orderDateObj = new Date(selectedOrderForApproval.order_date || new Date());
      const docYear = orderDateObj.getFullYear() + 543;
      let docSeq: number | null = selectedOrderForApproval.doc_sequence || null;

      if (finalOrderNumber === 'รออนุมัติ' || !finalOrderNumber) {
        // ค้นหา sequence ถัดไปของปีปัจจุบันของคำสั่ง ณ จังหวะอนุมัติ
        const { data: seqDocs } = await supabase
          .from('orders')
          .select('doc_sequence')
          .eq('doc_year', docYear)
          .order('doc_sequence', { ascending: false })
          .limit(1);
          
        docSeq = (seqDocs && seqDocs.length > 0) ? (Number(seqDocs[0].doc_sequence) + 1) : 1;
        finalOrderNumber = `${docSeq}/${docYear}`;
      }

      const { error } = await supabase.from('orders').update({ 
        status: 'approved',
        order_number: finalOrderNumber,
        remark: JSON.stringify(updatedExtraData),
        doc_year: docYear,
        doc_sequence: docSeq
      }).eq('id', selectedOrderForApproval.id);

      if (error) throw error;

      // ระบบแจ้งเตือน LINE หาคณะกรรมการรายบุคคล
      const committees = extraData.committees || [];
      if (committees.length > 0) {
        for (const member of committees) {
          if (member.teacher_id) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('line_user_id, display_name')
              .eq('id', member.teacher_id)
              .maybeSingle();

            if (prof?.line_user_id) {
              const memberName = prof.display_name;
              const personalMsg = `\n📢 แจ้งเตือนคำสั่งแต่งตั้งใหม่\nเรียน คุณครู ${memberName}\n\nท่านได้รับการแต่งตั้งในคำสั่งโรงเรียนบ้านควนโคกยา ที่ ${finalOrderNumber}\nเรื่อง: ${selectedOrderForApproval.subject}\nบทบาทหน้าที่ของท่าน: ${member.role} ${member.duty ? `(${member.duty})` : ''}\n\nกรุณาเข้าตรวจสอบหน้าที่และเปิดดูไฟล์คำสั่งฉบับเต็มได้ในระบบสารบรรณค่ะ`;
              
              await sendLineNotification(personalMsg, prof.line_user_id);
            }
          }
        }
      }

      alert('อนุมัติและออกเลขที่คำสั่งเรียบร้อยแล้ว');
      setIsApprovalModalOpen(false);
      fetchDocs();
    } catch (err: any) {
      alert('ไม่สามารถอนุมัติได้: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleApprovalReject() {
    if (!selectedOrderForApproval) return;
    setIsSaving(true);
    try {
      let extraData: any = {};
      try {
        if (selectedOrderForApproval.remark && selectedOrderForApproval.remark.startsWith('{')) {
          extraData = JSON.parse(selectedOrderForApproval.remark);
        }
      } catch (err) {}

      const updatedExtraData = {
        ...extraData,
        director_decision: 'ส่งกลับแก้ไข',
        director_opinion: directorOpinion,
        show_director_opinion: true
      };

      const { error } = await supabase.from('orders').update({ 
        status: 'rejected',
        remark: JSON.stringify(updatedExtraData)
      }).eq('id', selectedOrderForApproval.id);

      if (error) throw error;

      alert('บันทึกคำสั่งส่งกลับแก้ไขเรียบร้อยแล้ว');
      setIsApprovalModalOpen(false);
      fetchDocs();
    } catch (err: any) {
      alert('ล้มเหลว: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  const handleAISuggest = async () => {
    if (!formData.subject) {
      alert('กรุณากรอกชื่อเรื่องคำสั่งก่อนให้ AI ช่วยร่างค่ะ');
      return;
    }
    setIsDrafting(true);
    try {
      // ดึงรายชื่อฝ่ายที่มีการระบุในฟอร์ม (กรองค่าว่างออกและตัดค่าซ้ำ)
      const groups = Array.from(new Set(
        formData.committees
          .map(c => c.group_name?.trim())
          .filter(g => g)
      ));

      let prompt = '';
      if (groups.length > 0) {
        prompt = `คุณคือ AI ผู้เชี่ยวชาญด้านงานสารบรรณโรงเรียนและคำสั่งราชการไทย
กรุณาช่วยร่างคำสั่งโรงเรียนตามข้อมูลด้านล่างนี้:

เรื่องคำสั่ง: "${formData.subject}"
ฝ่าย/กลุ่มงานย่อยที่แต่งตั้งในคำสั่งนี้: ${groups.map(g => `"${g}"`).join(', ')}

เงื่อนไขการร่างและส่งผลลัพธ์กลับมา:
1. ร่างเนื้อหาหลักของคำสั่ง (คำนำ เหตุผลอ้างกฎหมาย และบทยกสั่งการ) ให้มีความเป็นทางการ ถูกต้องตามระเบียบงานสารบรรณไทย ห้ามพิมพ์หัวคำสั่ง เช่น "คำสั่ง..." หรือ "เรื่อง..." และห้ามพิมพ์วันที่สั่งการหรือคำลงท้ายเด็ดขาด ให้เริ่มด้วยเนื้อหาบรรยายและฐานอำนาจโดยตรง
2. ร่างหน้าที่และความรับผิดชอบสำหรับแต่ละฝ่ายที่ระบุข้างต้น ให้สอดคล้องกับประเภทงานและประเภทฝ่ายอย่างมืออาชีพ ยืดหยุ่น และเป็นประโยคข้อความภาษาทางการราชการที่สละสลวย โดยแต่ละหน้าที่ควรแยกเป็นข้อๆ (ห้ามมีเลขข้อนำหน้า เช่น 1, 2 ให้คั่นด้วยการขึ้นบรรทัดใหม่ธรรมดา)

กรุณาส่งคำตอบกลับมาในรูปแบบ XML tags ต่อไปนี้เท่านั้น (ห้ามส่งคำทักทาย อธิบาย หรือข้อความคุยเล่นใดๆ นอกเหนือจาก XML tag เด็ดขาด):
<content>
[พิมพ์เนื้อหาคำสั่งตรงนี้]
</content>
<duties>
${groups.map(g => `<duty name="${g}">
[พิมพ์หน้าที่รับผิดชอบข้อที่ 1 ของฝ่าย${g}]
[พิมพ์หน้าที่รับผิดชอบข้อที่ 2 ของฝ่าย${g}]
</duty>`).join('\n')}
</duties>`;
      } else {
        // กรณีไม่มีฝ่ายย่อย ร่างเฉพาะข้อความเนื้อหาปกติ
        prompt = `เขียนเนื้อหาคำสั่งโรงเรียนภาษาทางการ เรื่อง "${formData.subject}" โดยอ้างอิงข้อกฎหมายราชการไทยที่ถูกต้อง เหมาะสมกับเนื้อหา พร้อมทั้งร่างคำนำเหตุผลและบทยกสั่งการ ห้ามใส่คำลงท้าย (เช่น สั่ง ณ วันที่) และห้ามใส่ส่วนลงลายมือชื่อ ผอ. ท้ายคำสั่งเด็ดขาด เนื่องจากระบบจัดทำส่วนนี้แยกไว้แล้ว และห้ามพิมพ์หัวคำสั่ง เช่น 'คำสั่ง...' หรือ 'ที่...' มาในผลลัพธ์เด็ดขาด ให้เริ่มเนื้อความบรรยายที่เป็นคำนำและฐานอำนาจโดยตรง`;
      }

      const draft = await generateAIDraft(prompt);
      if (draft) {
        if (groups.length > 0) {
          // แกะค่า XML content
          const contentMatch = draft.match(/<content>([\s\S]*?)<\/content>/i);
          let content = contentMatch ? contentMatch[1].trim() : draft;
          
          // คลีนเนื้อหาเพื่อความปลอดภัย
          content = content.replace(/^(คำสั่ง|ที่|เรื่อง).*\n?/gim, '');
          content = content.replace(/สั่ง ณ วันที่.*/g, '');

          // แกะค่าหน้าที่ความรับผิดชอบของแต่ละฝ่าย
          const dutiesMap: { [key: string]: string } = {};
          
          // วนลูปสกัดด้วย Regex
          const dutyRegex = /<duty\s+name="([^"]+)">([\s\S]*?)<\/duty>/gi;
          let match;
          while ((match = dutyRegex.exec(draft)) !== null) {
            dutiesMap[match[1].trim()] = match[2].trim();
          }

          // อัปเดตข้อมูลลงใน committees ของ formData
          const updatedCommittees = formData.committees.map(c => {
            const gName = c.group_name?.trim() || '';
            if (gName && dutiesMap[gName]) {
              // ล้างช่องว่างและบรรทัดว่าง และแปลงรายข้อหน้าที่ให้เหมาะสม
              const rawDuties = dutiesMap[gName]
                .split('\n')
                .map(line => line.replace(/^[-*•\s\d.)]+\s*/, '').trim()) // ลบ bullet หรือ ตัวเลขนำหน้าออก
                .filter(line => line);
              
              return {
                ...c,
                duty: rawDuties.join('\n')
              };
            }
            return c;
          });

          setFormData(prev => ({
            ...prev,
            content,
            committees: updatedCommittees
          }));
          alert('AI ได้ช่วยร่างเนื้อหาและแนะนำหน้าที่ของแต่ละฝ่ายอัปเดตลงในตารางเรียบร้อยแล้วค่ะ! คุณสามารถตรวจสอบและแก้ไขเพิ่มเติมได้ตามต้องการ');
        } else {
          // กรณีไม่มีฝ่ายย่อย ทำแบบเดิม
          let cleanDraft = draft.trim();
          cleanDraft = cleanDraft.replace(/^(คำสั่ง|ที่|เรื่อง).*\n?/gim, '');
          cleanDraft = cleanDraft.replace(/สั่ง ณ วันที่.*/g, '');
          setFormData(prev => ({ ...prev, content: cleanDraft }));
          alert('AI ได้ร่างเนื้อความคำสั่งเรียบร้อยแล้วค่ะ');
        }
      }
    } catch (err: any) {
      alert('AI Draft Error: ' + err.message);
    } finally {
      setIsDrafting(false);
    }
  };

  function resetForm() {
    setFormData({ 
      order_number: '', 
      subject: '', 
      issuer: settings?.school_name || 'โรงเรียนบ้านควนโคกยา', 
      order_date: new Date().toISOString().split('T')[0], 
      content: '',
      sign_name: settings?.director_name || '',
      sign_position: `ผู้อำนวยการ${settings?.school_name || 'โรงเรียนบ้านควนโคกยา'}`,
      committees: [{ teacher_id: '', role: 'ประธานกรรมการ', duty: '' }] as any[],
      legal_refs: [] as string[],
      show_director_opinion: false
    });
    setSelectedFile(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div className="relative flex-1 max-w-2xl flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
            <input type="text" placeholder="ค้นหาคำสั่ง..." className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-hidden shadow-xs" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>

          <select 
            value={selectedYear || ''} 
            onChange={(e) => {
              const val = e.target.value ? parseInt(e.target.value) : null;
              setSelectedYear(val);
              fetchDocs(val);
            }}
            className="p-3 bg-white border border-slate-200 rounded-2xl outline-hidden shadow-xs font-bold text-slate-700 text-sm h-[48px]"
          >
            <option value="">ดูทั้งหมด</option>
            <option value={currentYearBE}>{currentYearBE}</option>
            <option value={currentYearBE - 1}>{currentYearBE - 1}</option>
            <option value={currentYearBE - 2}>{currentYearBE - 2}</option>
          </select>
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
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">สถานะ</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={4} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-brand-primary" /></td></tr>
            ) : docs.length === 0 ? (
              <tr><td colSpan={4} className="py-20 text-center text-slate-400 italic">ไม่พบข้อมูลคำสั่ง</td></tr>
            ) : (
              docs.filter(d => d.subject.includes(searchTerm)).map(doc => (
                <tr key={doc.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800 text-sm">{doc.order_number}</div>
                    <div className="text-[10px] text-slate-400">{doc.order_date}</div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-700">{doc.subject}</td>
                  <td className="px-6 py-4 text-center">
                    {doc.status === 'approved' ? (
                      <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-black uppercase inline-flex items-center gap-1"><CheckCircle size={12} /> อนุมัติแล้ว</span>
                    ) : doc.status === 'rejected' ? (
                      <span className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase inline-flex items-center gap-1"><XCircle size={12} /> ส่งกลับแก้ไข</span>
                    ) : (
                      <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase inline-flex items-center gap-1"><Clock size={12} /> รออนุมัติ</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(profile?.role === 'director' || profile?.role === 'admin') && doc.status === 'pending' && (
                        <button onClick={() => { setSelectedOrderForApproval(doc); setDirectorDecision('อนุมัติ'); setDirectorOpinion(''); setIsApprovalModalOpen(true); }} className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition-colors" title="พิจารณาอนุมัติ"><CheckCircle size={18} /></button>
                      )}
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
                <label className="text-[10px] font-bold text-slate-500 ml-1">เลขที่คำสั่ง (ว่างไว้เพื่อรันอัตโนมัติ)</label>
                <input type="text" placeholder="เช่น 12/2569" className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold" value={formData.order_number} onChange={e => setFormData({...formData, order_number: e.target.value})} />
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

          {/* AI แนะนำและร่างข้อความอ้างอิงกฎหมาย */}
          <div className="bg-slate-50 p-4 rounded-2xl space-y-3 border border-slate-100">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Bot size={14} className="text-brand-primary" /> ระบบช่วยร่างและแนะนำกฎหมาย</h4>
              <button 
                type="button" 
                onClick={handleAISuggest} 
                disabled={isDrafting}
                className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1 shadow-sm transition-all"
              >
                {isDrafting ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} className="text-yellow-400" />} ให้ AI ช่วยร่างคำสั่ง
              </button>
            </div>
            
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight ml-1">กฎหมายที่ใช้บ่อย:</div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "พ.ร.บ.ศึกษาธิการ ม.39", text: "อาศัยอำนาจตามความในมาตรา ๓๙ แห่งพระราชบัญญัติระเบียบบริหารราชการกระทรวงศึกษาธิการ พ.ศ. ๒๕๔๖" },
                { label: "พ.ร.บ.ข้าราชการครู ม.27", text: "และมาตรา ๒๗ แห่งพระราชบัญญัติระเบียบข้าราชการครูและบุคลากรทางการศึกษา พ.ศ. ๒๕๔๗" },
                { label: "พ.ร.บ.จัดซื้อจัดจ้าง 2560", text: "พระราชบัญญัติการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐" },
                { label: "ระเบียบกระทรวงการคลัง 2560", text: "ระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐" }
              ].map((law, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    const currentText = formData.content;
                    const separator = currentText ? '\n' : '';
                    setFormData({ ...formData, content: currentText + separator + law.text });
                  }}
                  className="bg-white border border-slate-200 text-slate-600 px-2.5 py-1 rounded-lg text-[9px] font-bold hover:bg-slate-100 hover:border-slate-300 transition-all active:scale-95"
                >
                  + {law.label}
                </button>
              ))}
            </div>
          </div>

          {/* จัดการรายชื่อคณะกรรมการ */}
          <div className="bg-slate-50 p-4 rounded-2xl space-y-4 border border-slate-100">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users size={14} /> รายชื่อคณะกรรมการแต่งตั้ง</h4>
              <button 
                type="button" 
                onClick={addCommitteeMember} 
                className="text-[9px] font-black text-brand-primary hover:text-green-700 bg-green-50 px-3 py-1 rounded-full"
              >
                + เพิ่มกรรมการ
              </button>
            </div>
            
            {formData.committees.length === 0 ? (
              <div className="text-[10px] text-slate-400 italic text-center py-4">ไม่มีรายชื่อคณะกรรมการที่ระบุ (ข้อมูลจะแสดงเป็นข้อความบรรยายคำสั่งปกติ)</div>
            ) : (
              <div className="space-y-3">
                {formData.committees.map((member, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-white p-3 rounded-xl border border-slate-200 shadow-xs relative group/item">
                    <div className="text-[10px] font-bold text-slate-400 shrink-0 w-4">{idx + 1}.</div>
                    
                    <input 
                      type="text" 
                      placeholder="ฝ่าย/กลุ่มงาน (ถ้ามี)" 
                      className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 w-36 outline-hidden"
                      value={member.group_name || ''}
                      onChange={e => updateCommitteeMember(idx, 'group_name', e.target.value)}
                    />

                    <select 
                      className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 flex-1 outline-hidden"
                      value={member.teacher_id}
                      onChange={e => updateCommitteeMember(idx, 'teacher_id', e.target.value)}
                    >
                      <option value="">-- เลือกคุณครู --</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.prefix}{t.first_name} {t.last_name}</option>
                      ))}
                    </select>

                    <input 
                      type="text" 
                      placeholder="บทบาท (ถ้ามี)" 
                      className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 w-32 outline-hidden"
                      value={member.role || ''}
                      onChange={e => updateCommitteeMember(idx, 'role', e.target.value)}
                    />

                    <input 
                      type="text" 
                      placeholder="หน้าที่รับผิดชอบ (ถ้ามี)" 
                      className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 flex-1 outline-hidden"
                      value={member.duty || ''}
                      onChange={e => updateCommitteeMember(idx, 'duty', e.target.value)}
                    />

                    {formData.committees.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => removeCommitteeMember(idx)} 
                        className="p-2 text-red-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 ml-1">เนื้อหาคำสั่ง (กด Enter เพื่อขึ้นย่อหน้าใหม่)</label>
            <textarea placeholder="พิมพ์เนื้อหาคำสั่งที่นี่..." className="w-full p-4 bg-white border border-slate-200 rounded-xl font-medium" rows={8} value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} />
          </div>

          {/* สวิตช์แสดงความเห็น ผอ. */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-slate-700">แสดงส่วนความเห็น ผอ. ท้ายเอกสาร</h4>
              <p className="text-[10px] text-slate-400">สำหรับคำสั่งออนไลน์ที่ต้องการให้ ผอ. ลงบันทึกความเห็น/สั่งการในระบบ</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className={`w-10 h-6 rounded-full transition-all relative ${formData.show_director_opinion ? 'bg-brand-primary' : 'bg-slate-200'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.show_director_opinion ? 'left-5' : 'left-1'}`}></div>
              </div>
              <input 
                type="checkbox" 
                className="hidden" 
                checked={formData.show_director_opinion} 
                onChange={e => setFormData({ ...formData, show_director_opinion: e.target.checked })} 
              />
            </label>
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
            {isSaving ? <Loader2 className="animate-spin" /> : <Save />} บันทึกข้อมูลและเสนออนุมัติ
          </button>
        </form>
      </Modal>

      {/* ผอ. Approval Modal */}
      <Modal isOpen={isApprovalModalOpen} onClose={() => setIsApprovalModalOpen(false)} title="พิจารณาอนุมัติและลงนามคำสั่งโรงเรียน">
        <form onSubmit={handleApprovalSubmit} className="space-y-6">
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4 text-slate-700">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FileText className="text-brand-primary" size={18} />
              ข้อมูลคำสั่งที่เสนอ: {selectedOrderForApproval?.subject}
            </h4>
            <div className="text-xs font-bold text-slate-500 ml-1">
              วันที่เสนอ: {selectedOrderForApproval?.order_date} | เลขที่ร่าง: {selectedOrderForApproval?.order_number}
            </div>
          </div>

          <div className="bg-slate-50 p-5 rounded-3xl space-y-4 border border-slate-100 text-slate-700">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users size={14} /> ผลการพิจารณา ผอ.</h4>
            <div className="grid grid-cols-2 gap-3">
              {(['อนุมัติ', 'ทราบ'] as const).map((decision) => (
                <button
                  key={decision}
                  type="button"
                  onClick={() => setDirectorDecision(decision)}
                  className={`p-4 text-sm font-black rounded-2xl border-2 transition-all ${
                    directorDecision === decision 
                      ? 'bg-brand-primary border-brand-primary text-white shadow-lg shadow-green-100' 
                      : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'
                  }`}
                >
                  {decision === 'อนุมัติ' ? '✓ อนุมัติการแต่งตั้ง' : '✓ ทราบ'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 text-slate-700">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">หมายเหตุ / คำสั่งเพิ่มเติม ผอ. (สำหรับให้อาจารย์อ่านประกอบ)</label>
            <textarea 
              placeholder="ระบุข้อความสั่งการเพิ่มเติม..." 
              className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-brand-primary/10 outline-none transition-all" 
              rows={4} 
              value={directorOpinion} 
              onChange={e => setDirectorOpinion(e.target.value)} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button 
              type="button" 
              onClick={handleApprovalReject} 
              disabled={isSaving}
              className="w-full bg-red-50 text-red-500 py-4 rounded-2xl font-black text-sm hover:bg-red-100 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              ✕ ส่งกลับให้ครูแก้ไข
            </button>
            <button 
              type="submit" 
              disabled={isSaving}
              className="w-full bg-brand-primary text-white py-4 rounded-2xl font-black text-sm hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-xl shadow-green-100"
            >
              {isSaving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />} อนุมัติและลงลายเซ็น
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
