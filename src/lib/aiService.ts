import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { supabase } from './supabase';

// Set worker source for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function extractTextFromPdf(pdfBuffer: ArrayBuffer): Promise<string> {
  try {
    const bufferCopy = pdfBuffer.slice(0);
    const loadingTask = pdfjsLib.getDocument({ data: bufferCopy });
    const pdf = await loadingTask.promise;
    let fullText = '';

    const numPages = Math.min(pdf.numPages, 5);
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  } catch (err) {
    console.error('Text extraction error:', err);
    return "";
  }
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function getAvailableModels(apiKey: string): Promise<string[]> {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (response.ok) {
      const data = await response.json();
      // Filter for gemini models and sort by version (flash first)
      return data.models
        ?.map((m: any) => m.name.replace('models/', ''))
        .filter((name: string) => name.includes('gemini'))
        .sort((a: string, b: string) => {
          if (a.includes('flash') && !b.includes('flash')) return -1;
          if (!a.includes('flash') && b.includes('flash')) return 1;
          return b.localeCompare(a); // Sort descending to get newer versions first
        }) || [];
    }
  } catch (e) {
    console.error('List models error:', e);
  }
  return [];
}

export interface DocumentInfo {
  summary: string;
  doc_number?: string;
  doc_date?: string;
  from_agency?: string;
  subject?: string;
}

export async function summarizeDocument(pdfBuffer: ArrayBuffer, apiKey?: string): Promise<DocumentInfo> {
  const extractedText = await extractTextFromPdf(pdfBuffer);
  const hasExtractedText = extractedText.trim().length > 100;

  if (apiKey) {
    let modelsToTry = await getAvailableModels(apiKey);
    if (modelsToTry.length === 0) {
      modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash"];
    }

    const apiVersions = ["v1beta", "v1"];

    const prompt = `วิเคราะห์หนังสือราชการนี้และตอบกลับเป็น JSON format เท่านั้น โดยมีฟิลด์ดังนี้:
    {
      "summary": "สรุปใจความสำคัญสั้นๆ 1-2 บรรทัด",
      "doc_number": "เลขที่หนังสือที่ปรากฏในต้นฉบับ (เช่น ศธ 04xxx/xxx)",
      "doc_date": "วันที่ในหนังสือต้นฉบับในรูปแบบ YYYY-MM-DD (ค.ศ.)",
      "from_agency": "ชื่อหน่วยงานเจ้าของหนังสือ",
      "subject": "ชื่อเรื่องของหนังสือ"
    }
    หากหาข้อมูลใดไม่พบให้ใส่เป็น null หรือ string ว่าง`;

    for (const modelName of modelsToTry) {
      for (const version of apiVersions) {
        try {
          const url = `https://generativelanguage.googleapis.com/${version}/models/${modelName}:generateContent?key=${apiKey}`;
          
          let contents: any[] = [];
          if (hasExtractedText) {
            contents = [{ parts: [{ text: `${prompt}\n\nเนื้อหาหนังสือ:\n${extractedText}` }] }];
          } else {
            const base64Pdf = toBase64(pdfBuffer);
            contents = [{
              parts: [
                { inline_data: { mime_type: "application/pdf", data: base64Pdf } },
                { text: prompt }
              ]
            }];
          }

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              contents,
              generationConfig: { response_mime_type: "application/json" }
            })
          });

          const data = await response.json();
          if (response.ok) {
            const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (aiText) {
              try {
                return JSON.parse(aiText);
              } catch (parseErr) {
                console.warn('AI returned non-JSON, trying to fix...', aiText);
                const jsonMatch = aiText.match(/\{[\s\S]*\}/);
                if (jsonMatch) return JSON.parse(jsonMatch[0]);
              }
            }
          }
        } catch (err: any) {
          // Silent fail to try next version/model
        }
      }
    }
  }

  if (extractedText.trim().length > 0) {
    const cleanText = extractedText.replace(/\s+/g, ' ').trim();
    return { summary: cleanText.slice(0, 150) + (cleanText.length > 150 ? '...' : '') };
  }

  return { summary: 'ไม่สามารถสรุปเนื้อหาได้' };
}

export async function generateAIDraft(prompt: string, apiKey?: string): Promise<string> {
  if (!apiKey) {
    // Try to fetch from settings if not provided
    const { data } = await supabase.from('settings').select('gemini_api_key').maybeSingle();
    apiKey = data?.gemini_api_key;
  }

  if (!apiKey) throw new Error('กรุณาตั้งค่า Gemini API Key ในหน้าตั้งค่าระบบก่อนใช้งาน AI');

  let modelsToTry = await getAvailableModels(apiKey);
  if (modelsToTry.length === 0) {
    modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash"];
  }

  const apiVersions = ["v1beta", "v1"];

  for (const modelName of modelsToTry) {
    for (const version of apiVersions) {
      try {
        const url = `https://generativelanguage.googleapis.com/${version}/models/${modelName}:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 2048,
            }
          })
        });

        const data = await response.json();
        if (response.ok) {
          return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        }
      } catch (err) {
        // Silent fail to try next model/version
      }
    }
  }

  throw new Error('AI ไม่สามารถร่างข้อความได้ในขณะนี้ กรุณาลองใหม่ภายหลัง');
}

