declare const process: any;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { lineUserId, message } = req.body;
  if (!lineUserId || !message) {
    return res.status(400).json({ message: 'Missing lineUserId or message' });
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    return res.status(500).json({ message: 'LINE Channel Access Token not configured on server' });
  }

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: 'text', text: message.substring(0, 5000) }]
      })
    });

    if (response.ok) {
      return res.status(200).json({ success: true, message: 'Notification sent successfully' });
    } else {
      const errData = await response.json();
      console.error('[LINE PUSH ERROR DETAIL]', errData);
      return res.status(response.status).json({ success: false, error: errData });
    }
  } catch (err: any) {
    console.error('[LINE PUSH SYSTEM ERROR]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
