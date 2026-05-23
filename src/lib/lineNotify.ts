import { supabase } from './supabase';

interface Attachment {
  label: string;
  url: string;
}

/**
 * ส่งการแจ้งเตือนผ่าน LINE Messaging API
 * รองรับข้อความธรรมดา และ Flex Message พร้อมปุ่มกด
 */
export async function sendLineNotification(message: string, specificToId?: string, attachments: Attachment[] = []) {
  try {
    const { data: settings } = await supabase
      .from('settings')
      .select('line_channel_access_token, line_group_id')
      .single();

    const channelAccessToken = settings?.line_channel_access_token;
    const groupId = settings?.line_group_id;

    if (!channelAccessToken) return;

    const targetId = specificToId || groupId;
    if (!targetId) return;

    let payloadObj: any;

    if (attachments.length > 0) {
      // --- สร้าง Flex Message หากมีไฟล์แนบ ---
      payloadObj = {
        to: targetId,
        messages: [{
          type: "flex",
          altText: "แจ้งเตือนระบบสารบรรณ",
          contents: {
            type: "bubble",
            body: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: "📢 แจ้งเตือนระบบงาน",
                  weight: "bold",
                  color: "#1DB446",
                  size: "sm"
                },
                {
                  type: "text",
                  text: message.trim(),
                  margin: "md",
                  wrap: true,
                  weight: "bold",
                  size: "md",
                  color: "#333333"
                }
              ]
            },
            footer: {
              type: "box",
              layout: "vertical",
              spacing: "sm",
              contents: attachments.map(att => ({
                type: "button",
                style: "primary",
                height: "sm",
                color: att.label.includes('ต้นฉบับ') || att.label.includes('สั่งการ') ? "#1DB446" : "#007AFF",
                action: {
                  type: "uri",
                  label: att.label,
                  uri: att.url
                }
              }))
            }
          }
        }]
      };
    } else {
      // --- ข้อความธรรมดา ---
      payloadObj = {
        to: targetId,
        messages: [{ type: 'text', text: message }]
      };
    }

    // ส่งข้อมูลไปประมวลผลที่ Vercel server (เพื่อ bypass CORS และใช้ Token ที่ถูกต้อง)
    const response = await fetch('https://school-admin-psi.vercel.app/api/line-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: payloadObj })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || errorData.message || 'Failed to send notification via Vercel');
    }

    return await response.json();
  } catch (error: any) {
    console.error('LINE Notification Error:', error);
    throw error;
  }
}
