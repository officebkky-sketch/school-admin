import { supabase, getActiveSchoolProfile } from './supabase';

interface Attachment {
  label: string;
  url: string;
}

function getWebhookUrl(): string {
  let vercelBaseUrl = '';
  const isWebUrl = typeof window !== 'undefined' && 
                    window.location && 
                    window.location.origin && 
                    window.location.protocol.startsWith('http') &&
                    !window.location.origin.includes('localhost') && 
                    !window.location.origin.includes('127.0.0.1');

  if (isWebUrl) {
    vercelBaseUrl = window.location.origin;
  } else {
    const profile = getActiveSchoolProfile();
    vercelBaseUrl = profile?.vercelUrl || 'https://school-admin-psi.vercel.app';
  }

  if (!vercelBaseUrl || vercelBaseUrl.includes('localhost') || vercelBaseUrl.includes('127.0.0.1')) {
    vercelBaseUrl = 'https://school-admin-psi.vercel.app';
  }

  if (vercelBaseUrl && !vercelBaseUrl.startsWith('http://') && !vercelBaseUrl.startsWith('https://')) {
    vercelBaseUrl = `https://${vercelBaseUrl}`;
  }
  if (vercelBaseUrl.endsWith('/')) {
    vercelBaseUrl = vercelBaseUrl.slice(0, -1);
  }
  return `${vercelBaseUrl}/api/line-webhook`;
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

    const channelAccessToken = settings?.line_channel_access_token || undefined;
    const groupId = settings?.line_group_id;

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

    const webhookUrl = getWebhookUrl();

    // ส่งข้อมูลไปประมวลผลที่ Vercel server (เพื่อ bypass CORS และใช้ Token ที่ถูกต้อง)
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        payload: payloadObj,
        token: channelAccessToken
      })
    });

    let resData: any;
    try {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        resData = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text.substring(0, 150) || "Empty Response");
      }
    } catch (parseErr: any) {
      throw new Error(`Server Response Error (URL: ${webhookUrl} | Status ${response.status}): ${parseErr.message}`);
    }

    if (!response.ok) {
      const detail = resData?.error?.message || resData?.message || JSON.stringify(resData);
      throw new Error(`Vercel Webhook Error (URL: ${webhookUrl}): ${response.status} - ${detail}`);
    }

    if (resData.success === false) {
      const detail = resData.error?.message || JSON.stringify(resData.error);
      throw new Error(`LINE API Error: ${detail}`);
    }
    return resData;

  } catch (error: any) {
    console.error('LINE Notification Error:', error);
    throw error;
  }
}

interface ActionItem {
  label: string;
  type: 'uri' | 'postback';
  uri?: string;
  data?: string;
  color?: string;
}

/**
 * ส่ง Flex Message พร้อมปุ่มโต้ตอบโต้กลับ (Postback) หรือเปิดลิงก์ (URI)
 */
export async function sendInteractiveFlexMessage(
  specificToId: string | undefined,
  title: string,
  message: string,
  actions: ActionItem[] = []
) {
  try {
    const { data: settings } = await supabase
      .from('settings')
      .select('line_channel_access_token, line_group_id')
      .single();

    const channelAccessToken = settings?.line_channel_access_token || undefined;
    const groupId = settings?.line_group_id;

    const targetId = specificToId || groupId;
    if (!targetId) return;

    const payloadObj = {
      to: targetId,
      messages: [{
        type: "flex",
        altText: title,
        contents: {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: title,
                weight: "bold",
                color: "#9C27B0", // สีม่วงพรีเมียม
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
          footer: actions.length > 0 ? {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: actions.map(act => {
              if (act.type === 'uri' && !act.uri) return null;
              if (act.type === 'postback' && !act.data) return null;

              const buttonAction: any = {
                type: act.type,
                label: act.label
              };
              if (act.type === 'uri') {
                buttonAction.uri = act.uri;
              } else if (act.type === 'postback') {
                buttonAction.data = act.data;
              }
              return {
                type: "button",
                style: "primary",
                height: "sm",
                color: act.color || "#1DB446",
                action: buttonAction
              };
            }).filter(Boolean) as any[]
          } : undefined
        }
      }]
    };

    const webhookUrl = getWebhookUrl();

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        payload: payloadObj,
        token: channelAccessToken
      })
    });

    let resData: any;
    try {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        resData = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text.substring(0, 150) || "Empty Response");
      }
    } catch (parseErr: any) {
      throw new Error(`Server Response Error (URL: ${webhookUrl} | Status ${response.status}): ${parseErr.message}`);
    }

    if (!response.ok) {
      const detail = resData?.error?.message || resData?.message || JSON.stringify(resData);
      throw new Error(`Vercel Webhook Error (URL: ${webhookUrl}): ${response.status} - ${detail}`);
    }

    if (resData.success === false) {
      const detail = resData.error?.message || JSON.stringify(resData.error);
      throw new Error(`LINE API Error: ${detail}`);
    }
    return resData;

  } catch (error: any) {
    console.error('LINE Interactive Flex Error:', error);
    throw error;
  }
}

export interface CarouselItem {
  id: string;
  subject: string;
  from_agency: string;
  doc_number: string;
  file_url: string;
  attachment_urls?: string[];
}

/**
 * ส่งหนังสือรับหลายฉบับพร้อมกันในรูปแบบ Flex Message Carousel ไปยังผู้รับ (ผอ. หรือไลน์กลุ่ม)
 */
export async function sendBulkFlexCarousel(
  specificToId: string | undefined,
  title: string,
  items: CarouselItem[]
) {
  try {
    const { data: settings } = await supabase
      .from('settings')
      .select('line_channel_access_token, line_group_id')
      .single();

    const channelAccessToken = settings?.line_channel_access_token || undefined;
    const groupId = settings?.line_group_id;

    const targetId = specificToId || groupId;
    if (!targetId) return;

    if (items.length === 0) return;

    const bubbles = items.map((item, index) => {
      let documentUrl = item.file_url || '';
      return {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: `📥 เสนอหนังสือรอเกษียณ (${index + 1}/${items.length})`,
              weight: "bold",
              color: "#9C27B0",
              size: "xs"
            },
            {
              type: "text",
              text: item.subject,
              weight: "bold",
              size: "sm",
              wrap: true,
              margin: "md",
              color: "#333333"
            },
            {
              type: "box",
              layout: "vertical",
              margin: "md",
              spacing: "xs",
              contents: [
                {
                  type: "text",
                  text: `จาก: ${item.from_agency}`,
                  size: "xxs",
                  color: "#666666",
                  wrap: true
                },
                {
                  type: "text",
                  text: `เลขรับ: ${item.doc_number}`,
                  size: "xxs",
                  color: "#666666"
                }
              ]
            }
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            {
              type: "button",
              style: "primary",
              height: "sm",
              color: "#007AFF",
              action: {
                type: "uri",
                label: "📄 ดูต้นฉบับหนังสือ",
                uri: documentUrl
              }
            },
            // ไฟล์แนบเพิ่มเติม (ถ้ามี)
            ...(Array.isArray(item.attachment_urls) ? item.attachment_urls.map((url, idx) => ({
              type: "button",
              style: "primary",
              height: "sm",
              color: "#3F51B5",
              action: {
                type: "uri",
                label: `📎 ไฟล์แนบที่ ${idx + 1}`,
                uri: url
              }
            })) : []),
            {
              type: "button",
              style: "primary",
              height: "sm",
              color: "#1DB446",
              action: {
                type: "postback",
                label: "✍️ เกษียณสั่งการ",
                data: `action=start_assign&id=${item.id}`
              }
            }
          ]
        }
      };
    });

    const payloadObj = {
      to: targetId,
      messages: [{
        type: "flex",
        altText: title,
        contents: {
          type: "carousel",
          contents: bubbles
        }
      }]
    };

    const webhookUrl = getWebhookUrl();

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        payload: payloadObj,
        token: channelAccessToken
      })
    });

    let resData: any;
    try {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        resData = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text.substring(0, 150) || "Empty Response");
      }
    } catch (parseErr: any) {
      throw new Error(`Server Response Error (URL: ${webhookUrl} | Status ${response.status}): ${parseErr.message}`);
    }

    if (!response.ok) {
      const detail = resData?.error?.message || resData?.message || JSON.stringify(resData);
      throw new Error(`Vercel Webhook Error (URL: ${webhookUrl}): ${response.status} - ${detail}`);
    }

    if (resData.success === false) {
      const detail = resData.error?.message || JSON.stringify(resData.error);
      throw new Error(`LINE API Error: ${detail}`);
    }
    return resData;

  } catch (error: any) {
    console.error('LINE Bulk Flex Carousel Error:', error);
    throw error;
  }
}

