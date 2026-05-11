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

    const payload = JSON.stringify(payloadObj);
    const isElectron = typeof window !== 'undefined' && window.process && (window.process as any).type === 'renderer';

    if (isElectron) {
      return new Promise((resolve, reject) => {
        try {
          const https = (window as any).require('https');
          const options = {
            hostname: 'api.line.me',
            port: 443,
            path: '/v2/bot/message/push',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${channelAccessToken}`,
              'Content-Length': Buffer.byteLength(payload)
            }
          };

          const req = https.request(options, (res: any) => {
            let data = '';
            res.on('data', (chunk: any) => data += chunk);
            res.on('end', () => {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve(JSON.parse(data));
              } else {
                reject(new Error(`LINE API Error: ${res.statusCode}`));
              }
            });
          });

          req.on('error', (e: any) => reject(e));
          req.write(payload);
          req.end();
        } catch (nodeErr) {
          doFetch(channelAccessToken, payload).then(resolve).catch(reject);
        }
      });
    } else {
      return await doFetch(channelAccessToken, payload);
    }
  } catch (error: any) {
    console.error('LINE Notification Error:', error);
  }
}

async function doFetch(token: string, body: string) {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: body,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to send via Fetch');
  }

  return await response.json();
}
