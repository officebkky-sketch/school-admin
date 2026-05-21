import { createClient } from '@supabase/supabase-js';

declare const process: any;

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const LINE_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

export default async function handler(req: any, res: any) {
  console.log('Webhook Received - Method:', req.method);

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
    console.log('Events Count:', events.length);

    for (const event of events) {
      console.log('Event Type:', event.type);
      if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId;
        const userMessage = event.message.text.trim();
        console.log('Message from:', userId, 'Content:', userMessage);

        // 1. Check if user is already bound
        const { data: profile, error: dbError } = await supabase
          .from('profiles')
          .select('*')
          .eq('line_user_id', userId)
          .maybeSingle();

        if (dbError) console.error('Database Error:', dbError);

        if (profile) {
          console.log('User recognized:', profile.display_name);
          await replyToLine(event.replyToken, `สวัสดีครับคุณครู ${profile.display_name} มีอะไรให้ AI Cowork ช่วยไหมครับ? (ระบบกำลังพัฒนาระบบสอบถามข้อมูล)`);
        } else {
          console.log('Unrecognized user, checking for email...');
          // 2. Not bound yet. Check if the message is an email
          if (userMessage.includes('@')) {
            const { data: foundUser, error: findError } = await supabase
              .from('profiles')
              .select('*')
              .eq('email', userMessage)
              .maybeSingle();

            if (findError) console.error('Find User Error:', findError);

            if (foundUser) {
              console.log('Email matched! Binding user:', foundUser.display_name);
              const { error: updateError } = await supabase
                .from('profiles')
                .update({ line_user_id: userId })
                .eq('id', foundUser.id);

              if (updateError) {
                console.error('Update Error:', updateError);
                await replyToLine(event.replyToken, 'เกิดข้อผิดพลาดในการผูกบัญชี กรุณาลองใหม่อีกครั้งครับ');
              } else {
                await replyToLine(event.replyToken, `ยืนยันตัวตนสำเร็จ! ยินดีต้อนรับคุณครู ${foundUser.display_name} เข้าสู่ระบบ AI Cowork ครับ`);
              }
            } else {
              console.log('Email not found in database.');
              await replyToLine(event.replyToken, 'ขออภัยครับ ไม่พบอีเมลนี้ในระบบโรงเรียน กรุณาตรวจสอบอีเมลและส่งมาใหม่ครับ');
            }
          } else {
            console.log('Sending first-time greeting.');
            await replyToLine(event.replyToken, 'สวัสดีครับ ผม AI Cowork ผู้ช่วยอัจฉริยะ\n\nเพื่อเข้าถึงข้อมูลโรงเรียนได้อย่างปลอดภัย รบกวนคุณครูพิมพ์ **อีเมล** ที่ใช้ลงทะเบียนในระบบเพื่อยืนยันตัวตนก่อนครับ');
          }
        }
      }
    }
  } catch (err) {
    console.error('CRITICAL Webhook error:', err);
  }

  return res.status(200).json({ message: 'OK' });
}

async function replyToLine(replyToken: string, message: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.error('MISSING LINE_CHANNEL_ACCESS_TOKEN');
    return;
  }
  
  try {
    console.log('Replying to LINE...');
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

    const resData = await response.json();
    if (!response.ok) {
      console.error('LINE API Error:', resData);
    } else {
      console.log('LINE Reply Success');
    }
  } catch (e) {
    console.error('Fetch Error when replying to LINE:', e);
  }
}
