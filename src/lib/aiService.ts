import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { supabase } from './supabase';

// Set worker source for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function extractProjectsFromKnowledge(apiKey: string, academicYear: string = '2569') {
  try {
    // 1. ใช้ Hybrid Search (Vector + Text) เพื่อดึงข้อมูลโครงการให้ครอบคลุมที่สุด
    const vectorQuery = `รายการโครงการและงบประมาณของปีการศึกษา ${academicYear}`;
    const vectorMatches = await searchKnowledge(vectorQuery, apiKey, 25); // เพิ่ม limit
    
    const thaiYear = academicYear.replace(/0/g, '๐').replace(/1/g, '๑').replace(/2/g, '๒').replace(/3/g, '๓').replace(/4/g, '๔').replace(/5/g, '๕').replace(/6/g, '๖').replace(/7/g, '๗').replace(/8/g, '๘').replace(/9/g, '๙');
    const { data: textMatches } = await supabase
      .from('school_knowledge')
      .select('document_name, chunk_text')
      .or(`chunk_text.ilike.%โครงการ%,chunk_text.ilike.%งบประมาณ%,chunk_text.ilike.%${academicYear}%,chunk_text.ilike.%${thaiYear}%`)
      .limit(60);

    const allMatches = [...(vectorMatches || []), ...(textMatches || [])];
    const uniqueChunks = allMatches.filter((v, i, a) => a.findIndex(t => (t.chunk_text === v.chunk_text)) === i);
    
    if (uniqueChunks.length === 0) return [];

    const context = uniqueChunks.map(m => `[ไฟล์: ${m.document_name}]\n${m.chunk_text}`).join('\n---\n');

    // 2. ระบบหมุนเวียน Model และ API Version เพื่อความเสถียร
    let modelsToTry = await getAvailableModels(apiKey);
    if (modelsToTry.length === 0) {
      modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash"];
    }
    const apiVersions = ["v1beta", "v1"];

    const prompt = `ภารกิจ: คุณเป็นผู้เชี่ยวชาญด้านงานพัสดุและงบประมาณโรงเรียน หน้าที่ของคุณคือสกัด "รายชื่อโครงการ" และ "วงเงินงบประมาณที่ได้รับ" จากข้อมูลที่พบในคลังความรู้ โดยเน้นเฉพาะปีการศึกษา ${academicYear}
            
    ข้อมูลจากคลังความรู้:
    ${context}
    
    กฎเหล็ก:
    1. ตอบกลับเป็น JSON Array ของ Object เท่านั้น ห้ามมีคำอธิบายอื่น
    2. ฟิลด์ที่ต้องมี: project_name (ชื่อโครงการ), planned_amount (จำนวนเงินเป็นตัวเลข), budget_type (แหล่งเงิน เช่น งบอุดหนุน, งบรายได้)
    3. หากเป็นตัวเลขไทย ให้แปลงเป็นเลขอารบิก
    4. ห้ามใส่หน่วย "บาท" หรือเครื่องหมายคอมม่าใน planned_amount
    5. สกัดเฉพาะโครงการที่มีการระบุวงเงินชัดเจนเท่านั้น
    
    รูปแบบคำตอบ:
    [{"project_name": "...", "planned_amount": 0, "budget_type": "..."}]`;

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
                response_mime_type: "application/json",
                temperature: 0.1
              }
            })
          });

          if (response.ok) {
            const data = await response.json();
            let aiText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (!aiText) continue;

            aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(aiText);
            return Array.isArray(parsed) ? parsed : [];
          }
        } catch (err) {
          console.warn(`Extraction failed with ${modelName} ${version}:`, err);
        }
      }
    }
    
    return [];
  } catch (err) {
    console.error('Project extraction overall error:', err);
    return [];
  }
}

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
      return data.models
        ?.map((m: any) => m.name.replace('models/', ''))
        .filter((name: string) => name.includes('gemini'))
        .sort((a: string, b: string) => {
          if (a.includes('flash') && !b.includes('flash')) return -1;
          if (!a.includes('flash') && b.includes('flash')) return 1;
          return b.localeCompare(a);
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
          // Silent fail
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
        // Silent fail
      }
    }
  }

  throw new Error('AI ไม่สามารถร่างข้อความได้ในขณะนี้ กรุณาลองใหม่ภายหลัง');
}

export async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  try {
    // ใช้ gemini-embedding-2 เป็นค่ามาตรฐานเพื่อความเข้ากันได้ของข้อมูลเดิม (3072 dim)
    const targetModel = "models/gemini-embedding-2"; 
    const versions = ['v1beta', 'v1'];
    let lastError = "";

    for (const version of versions) {
      try {
        const url = `https://generativelanguage.googleapis.com/${version}/${targetModel}:embedContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: targetModel,
            content: { parts: [{ text }] }
          })
        });

        const data = await response.json();
        if (response.ok) {
          return data.embedding?.values || [];
        }
        lastError = data.error?.message || 'Unknown error';
      } catch (err: any) {
        lastError = err.message;
      }
    }

    throw new Error(lastError);
  } catch (err: any) {
    console.error('Embedding error:', err);
    throw new Error(`ไม่พบโมเดลสร้างความรู้ที่รองรับ: ${err.message}`);
  }
}

export async function processDocumentToKnowledge(
  pdfBuffer: ArrayBuffer, 
  fileName: string, 
  apiKey: string,
  onProgress?: (current: number, total: number) => void
) {
  const bufferCopy = pdfBuffer.slice(0);
  const loadingTask = pdfjsLib.getDocument({ data: bufferCopy });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;

  const chunks = [];
  const chunkSize = 1000;
  const chunkOverlap = 200;

  // 1. สกัดข้อความและแบ่ง Chunk
  for (let i = 1; i <= totalPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      
      let start = 0;
      while (start < pageText.length) {
        const end = start + chunkSize;
        const text = pageText.substring(start, end).trim();
        if (text.length > 50) {
          chunks.push({ text, page_number: i });
        }
        start += (chunkSize - chunkOverlap);
      }
      if (onProgress) onProgress(i, totalPages);
    } catch (e) {
      console.warn(`Error reading page ${i}:`, e);
    }
  }

  // Fallback: หากไม่พบข้อความ (อาจเป็นไฟล์สแกน) ให้ใช้ Gemini OCR แบบทีละหน้า
  if (chunks.length === 0) {
    try {
      // 1. ค้นหาโมเดล Vision ที่รองรับจริง (อัปเดตให้รองรับรุ่นใหม่)
      let visionModel = "gemini-2.0-flash"; 
      try {
        const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (listResponse.ok) {
          const listData = await listResponse.json();
          const found = listData.models?.find((m: any) => 
            m.supportedGenerationMethods?.includes('generateContent') && 
            (m.name.includes('gemini-2.0-flash') || m.name.includes('gemini-1.5-flash'))
          );
          if (found) visionModel = found.name.replace('models/', '');
        }
      } catch (e) {
        console.warn("OCR: Failed to list models, using default...");
      }

      // 2. ประมวลผลทีละ 1 หน้า เพื่อความเสถียรสูงสุด (รองรับโควตา 15 RPM)
      const apiVersions = ["v1beta", "v1"];
      
      for (let p = 1; p <= totalPages; p++) {
        let successPage = false;
        let retryCount = 0;
        const maxRetries = 3;

        // หน่วงเวลา 5 วินาที
        if (p > 1) await new Promise(r => setTimeout(r, 5000));

        while (!successPage && retryCount < maxRetries) {
          try {
            const page = await pdf.getPage(p);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({ canvasContext: context!, viewport, canvas }).promise;
            const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
            
            let pageResponseText = "";
            let pageSuccess = false;

            for (const version of apiVersions) {
              if (pageSuccess) break;
              try {
                const url = `https://generativelanguage.googleapis.com/${version}/models/${visionModel}:generateContent?key=${apiKey}`;
                const response = await fetch(url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{
                      parts: [
                        { inline_data: { mime_type: "image/jpeg", data: base64Image } },
                        { text: `จงสกัดข้อความภาษาไทยทั้งหมดจากรูปภาพหน้านี้ (หน้า ${p}) ออกมาเป็น Plain Text ห้ามสรุปความ` }
                      ]
                    }]
                  })
                });

                const resData = await response.json();
                if (response.ok) {
                  pageResponseText = resData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
                  pageSuccess = true;
                } else if (response.status === 429) {
                  throw new Error('429');
                }
              } catch (e: any) {
                if (e.message === '429') throw e;
              }
            }

            if (pageSuccess && pageResponseText.length > 5) {
              let start = 0;
              while (start < pageResponseText.length) {
                const end = start + chunkSize;
                const chunk = pageResponseText.substring(start, end).trim();
                if (chunk.length > 5) {
                  chunks.push({ text: chunk, page_number: p });
                }
                start += (chunkSize - chunkOverlap);
              }
              successPage = true;
            } else {
              retryCount++;
            }
          } catch (err: any) {
            if (err.message === '429') {
              retryCount++;
              await new Promise(r => setTimeout(r, 60000));
            } else {
              retryCount++;
              if (retryCount >= maxRetries) throw err;
              await new Promise(r => setTimeout(r, 5000));
            }
          }
        }
        if (onProgress) onProgress(p, totalPages);
      }
    } catch (ocrErr: any) {
      console.error('OCR Fallback failed:', ocrErr);
      throw new Error(`ระบบ OCR ขัดข้อง: ${ocrErr.message}`);
    }
  }

  if (chunks.length === 0) throw new Error('ไม่พบเนื้อหาที่เป็นข้อความในไฟล์นี้');

  // 2. ดึง User ครั้งเดียว
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('กรุณาเข้าสู่ระบบก่อนดำเนินการ');

  // 3. บันทึก
  const batchSize = 3;
  let successCount = 0;
  let lastError = "";

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const promises = batch.map(async (chunk) => {
      try {
        const embedding = await generateEmbedding(chunk.text, apiKey);
        const { error } = await supabase.from('school_knowledge').insert([{
          document_name: fileName,
          page_number: chunk.page_number,
          chunk_text: chunk.text,
          embedding: embedding,
          created_by: user.id
        }]);
        if (!error) successCount++;
        else lastError = error.message;
      } catch (err: any) { lastError = err.message; }
    });
    await Promise.all(promises);
    await new Promise(r => setTimeout(r, 1000));
  }

  if (successCount === 0) throw new Error(`ไม่สามารถจดจำข้อมูลได้: ${lastError}`);
  return successCount;
}

export async function searchKnowledge(query: string, apiKey: string, limit: number = 8) {
  try {
    const queryEmbedding = await generateEmbedding(query, apiKey);

    const { data, error } = await supabase.rpc('match_knowledge', {
      query_embedding: queryEmbedding,
      match_threshold: 0.2, // ปรับลดจาก 0.3 เพื่อเพิ่มโอกาสในการค้นพบ
      match_count: limit
    });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Knowledge search error:', err);
    return [];
  }
}

export async function extractTextFromImage(imageBuffer: ArrayBuffer, apiKey: string): Promise<string> {
  try {
    const base64Image = toBase64(imageBuffer);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: "image/jpeg", data: base64Image } },
            { text: "สกัดข้อความทั้งหมดจากภาพนี้ออกมาเป็นข้อความธรรมดา (Plain Text) หากเป็นหนังสือราชการให้คงรูปแบบลำดับเนื้อหาไว้" }
          ]
        }]
      })
    });

    const data = await response.json();
    if (response.ok) {
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    }
    return "";
  } catch (err) {
    console.error('Image OCR error:', err);
    return "";
  }
}
