import { createClient } from '@supabase/supabase-js';

declare const process: any;

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const LINE_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const events = req.body.events;

  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const userId = event.source.userId;
      const userMessage = event.message.text.trim();

      // 1. Check if user is already bound
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('line_user_id', userId)
        .maybeSingle();

      if (profile) {
        // --- AI QUERY LOGIC (Placeholder for now) ---
        await replyToLine(event.replyToken, `สวัสดีครับคุณครู ${profile.display_name} มีอะไรให้ AI Cowork ช่วยไหมครับ? (ระบบกำลังพัฒนาระบบสอบถามข้อมูล)`);
      } else {
        // 2. Not bound yet. Check if the message is an email
        if (userMessage.includes('@')) {
          const { data: foundUser, error: findError } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', userMessage)
            .maybeSingle();

          if (foundUser) {
            // Bind the user
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ line_user_id: userId })
              .eq('id', foundUser.id);

            if (updateError) {
              await replyToLine(event.replyToken, 'เกิดข้อผิดพลาดในการผูกบัญชี กรุณาลองใหม่อีกครั้ง หรือติดต่อแอดมินครับ');
            } else {
              await replyToLine(event.replyToken, `ยืนยันตัวตนสำเร็จ! ยินดีต้อนรับคุณครู ${foundUser.display_name} เข้าสู่ระบบ AI Cowork ครับ`);
            }
          } else {
            await replyToLine(event.replyToken, 'ขออภัยครับ ไม่พบอีเมลนี้ในระบบโรงเรียน กรุณาตรวจสอบอีเมลและพิมพ์ส่งมาใหม่อีกครั้งครับ');
          }
        } else {
          // Greeting for new user
          await replyToLine(event.replyToken, 'สวัสดีครับ ผม AI Cowork ผู้ช่วยอัจฉริยะ\n\nเพื่อเข้าถึงข้อมูลโรงเรียนได้อย่างปลอดภัย รบกวนคุณครูพิมพ์ **อีเมล** ที่ใช้ลงทะเบียนในระบบเพื่อยืนยันตัวตนก่อนครับ');
        }
      }
    }
  }

  return res.status(200).json({ message: 'OK' });
}

async function replyToLine(replyToken: string, message: string) {
  if (!LINE_ACCESS_TOKEN) return;
  
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: 'text', text: message }]
    })
  });
}
