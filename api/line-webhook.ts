import { createClient } from '@supabase/supabase-js';

declare const process: any;

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    return res.status(200).json({ 
      message: 'AI Cowork LINE Webhook is ONLINE',
      status: 'ready',
      env_check: {
        has_token: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
        has_url: !!process.env.VITE_SUPABASE_URL,
        has_key: !!process.env.VITE_SUPABASE_ANON_KEY
      },
      time: new Date().toISOString()
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const events = req.body.events || [];

    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId;
        const userMessage = event.message.text.trim();

        // 1. Check if user is already bound
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('line_user_id', userId)
          .maybeSingle();

        if (profile) {
          // --- AI BRAIN LOGIC ---
          await handleAIQuery(event.replyToken, userMessage, profile);
        } else {
          // 2. Not bound yet. Check if the message is an email
          if (userMessage.includes('@')) {
            const incomingEmail = userMessage.toLowerCase().trim();
            const { data: foundUser } = await supabase
              .from('profiles')
              .select('*')
              .eq('email', incomingEmail)
              .maybeSingle();

            if (foundUser) {
              await supabase.from('profiles').update({ line_user_id: userId }).eq('id', foundUser.id);
              await replyToLine(event.replyToken, `ยืนยันตัวตนสำเร็จ! ยินดีต้อนรับคุณครู ${foundUser.display_name} เข้าสู่ระบบ AI Cowork ครับ\n\nตอนนี้คุณครูสามารถพิมพ์ถามข้อมูลโรงเรียนได้เลยครับ เช่น "จำนวนนักเรียนปีนี้" หรือ "สรุปศาสนา ป.1"`);
            } else {
              await replyToLine(event.replyToken, 'ขออภัยครับ ไม่พบอีเมลนี้ในระบบโรงเรียน กรุณาตรวจสอบอีเมลและส่งมาใหม่ครับ');
            }
          } else {
            await replyToLine(event.replyToken, 'สวัสดีครับ ผม AI Cowork ผู้ช่วยอัจฉริยะ\n\nเพื่อความปลอดภัย รบกวนคุณครูพิมพ์ **อีเมล** ที่ใช้ลงทะเบียนในระบบเพื่อยืนยันตัวตนก่อนครับ');
          }
        }
      }
    }
  } catch (err) {
    console.error('Webhook error:', err);
  }

  return res.status(200).json({ message: 'OK' });
}

async function handleAIQuery(replyToken: string, message: string, profile: any) {
  try {
    // 1. Fetch Context Data
    const { data: sets, error: setsErr } = await supabase.from('settings').select('*').maybeSingle();
    if (setsErr) throw new Error(`Settings DB Error: ${setsErr.message}`);

    const currentYear = sets?.current_academic_year || '2569';
    
    const { data: students, error: stdErr } = await supabase
      .from('students')
      .select('class_level, gender, religion, prefix')
      .eq('academic_year', currentYear)
      .eq('graduation_status', 'ปกติ');
    if (stdErr) throw new Error(`Students DB Error: ${stdErr.message}`);

    const { count: teacherCount, error: teachErr } = await supabase
      .from('teachers')
      .select('*', { count: 'exact', head: true });
    if (teachErr) throw new Error(`Teachers DB Error: ${teachErr.message}`);

    const { data: recentDocs, error: docsErr } = await supabase
      .from('incoming_docs')
      .select('subject, doc_number, doc_date')
      .order('created_at', { ascending: false })
      .limit(5);
    if (docsErr) throw new Error(`Docs DB Error: ${docsErr.message}`);

    // 2. Prepare Statistics
    const religionStats: any = {};
    const classStats: any = {};
    students?.forEach(s => {
      const rel = s.religion || 'ไม่ระบุ';
      religionStats[rel] = (religionStats[rel] || 0) + 1;
      const lv = s.class_level || 'ไม่ระบุ';
      if (!classStats[lv]) classStats[lv] = { total: 0, male: 0, female: 0 };
      classStats[lv].total++;
      if (s.gender === 'ชาย' || s.gender === 'Male' || s.prefix?.includes('ด.ช.')) classStats[lv].male++;
      else if (s.gender === 'หญิง' || s.gender === 'Female' || s.prefix?.includes('ด.ญ.')) classStats[lv].female++;
    });

    const context = `คุณคือ AI Cowork ผู้ช่วยอัจฉริยะของ${sets?.school_name || 'โรงเรียน'} 
    ข้อมูลปัจจุบัน (ปี ${currentYear}):
    - จำนวนนักเรียนทั้งหมด: ${students?.length || 0} คน
    - สรุปศาสนา: ${Object.entries(religionStats).map(([r, c]) => `${r} ${c} คน`).join(', ')}
    - สรุปรายชั้น: ${Object.entries(classStats).map(([lv, s]: any) => `ชั้น ${lv} ${s.total} คน (ช ${s.male} ญ ${s.female})`).join('\n    ')}
    - จำนวนครู: ${teacherCount || 0} คน
    - หนังสือรับล่าสุด: ${recentDocs?.map(d => `${d.doc_number}: ${d.subject}`).join('\n    ')}

    ผู้ถาม: คุณครู ${profile.display_name} (สิทธิ์: ${profile.role})
    คำถาม: ${message}

    คำแนะนำในการตอบ:
    1. ตอบให้กระชับ เหมาะกับการอ่านใน LINE
    2. ใช้ Emoji ตกแต่งให้น่ารัก
    3. หากถามข้อมูลที่ไม่มี ให้บอกว่ายังไม่มีข้อมูลส่วนนี้ในระบบ
    4. ใช้ภาษาไทยที่สุภาพเป็นกันเอง`;

    // 3. Call Gemini (Manual Fetch with Fallback)
    const apiKey = sets?.gemini_api_key;
    if (!apiKey) {
      await replyToLine(replyToken, '❌ ระบบยังไม่ได้ตั้งค่า Gemini API Key ในหน้าการตั้งค่าครับ');
      return;
    }

    const modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-latest"];
    const versions = ["v1beta", "v1"];
    let finalAnswer = "";

    for (const model of modelsToTry) {
      if (finalAnswer) break;
      for (const ver of versions) {
        try {
          const url = `https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent?key=${apiKey}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: context }] }]
            })
          });

          if (response.ok) {
            const data = await response.json();
            finalAnswer = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (finalAnswer) break;
          }
        } catch (e) {
          console.warn(`Failed with ${model} ${ver}:`, e);
        }
      }
    }

    if (finalAnswer) {
      await replyToLine(replyToken, finalAnswer);
    } else {
      throw new Error('ไม่สามารถดึงข้อมูลจาก AI ได้ทุกเวอร์ชัน');
    }

  } catch (err: any) {
    console.error('AI Query Error:', err);
    await replyToLine(replyToken, `⚠️ เกิดข้อผิดพลาด: ${err.message || 'ไม่ทราบสาเหตุ'}\nกรุณาแจ้งแอดมินเพื่อตรวจสอบครับ`);
  }
}

async function replyToLine(replyToken: string, message: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return;
  
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        replyToken: replyToken,
        messages: [{ type: 'text', text: message }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('LINE API Error:', errorData);
    }
  } catch (e) {
    console.error('Fetch Error:', e);
  }
}
