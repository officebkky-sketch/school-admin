import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const THAI_NUMERALS = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];

export function toThaiNumerals(num: string | number): string {
  return num.toString().replace(/[0-9]/g, (digit) => THAI_NUMERALS[parseInt(digit)]);
}

export function formatThaiDate(dateStr: string): string {
  const date = new Date(dateStr);
  const d = date.getDate();
  const monthAbbr = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."][date.getMonth()];
  const y = date.getFullYear() + 543; // Convert to B.E.
  return `${d}/${monthAbbr}/${y}`;
}

/**
 * แยกคำภาษาไทยและตัดบรรทัดให้พอดีกับความกว้าง (ใช้วิธีจาก GitHub + Intl.Segmenter)
 */
function wrapThaiText(text: string, maxWidth: number, font: any, fontSize: number) {
  if (!text) return [];
  
  // ใช้ Intl.Segmenter เพื่อแยกคำภาษาไทยตามหลักพจนานุกรม
  const segmenter = new (Intl as any).Segmenter('th', { granularity: 'word' });
  const segments = segmenter.segment(text);
  
  const lines = [];
  let currentLine = '';

  for (const { segment } of segments) {
    const testLine = currentLine + segment;
    const lineWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (lineWidth > maxWidth && currentLine !== '') {
      lines.push(currentLine);
      currentLine = segment;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) lines.push(currentLine);
  return lines;
}

export async function applyDigitalStamps(
  pdfBuffer: ArrayBuffer,
  receiptData: {
    docNumber: string;
    date: string;
    time: string;
  },
  proposalData: {
    summary: string;
    proposal: string;
    signer: string;
    date: string;
    signatureUrl?: string; // เพิ่มลายเซ็นผู้เสนอ
  },
  directorData?: {
    order: string;
    signer: string;
    date: string;
    position?: string;
    signatureUrl?: string;
  }
) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    pdfDoc.registerFontkit(fontkit);

    // ปรับ Path ฟอนต์ให้รองรับทั้ง Dev และ Production (Electron)
    let fontUrl = 'fonts/THSarabunNew.ttf'; 
    
    const fontBytes = await fetch(fontUrl)
      .then(res => res.ok ? res : fetch('/fonts/THSarabunNew.ttf')) // Fallback สำหรับบางกรณี
      .then(res => {
        if (!res.ok) throw new Error(`ไม่สามารถโหลดฟอนต์ได้จาก ${fontUrl}`);
        return res.arrayBuffer();
      });
    const customFont = await pdfDoc.embedFont(fontBytes);

    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    // Color: Official Blue
    const stampColor = rgb(0.1, 0.2, 0.7);
    const fontSize = 15;
    const lineSpacing = 17;

    // --- 1. Receipt Stamp (Top Right) ---
    const receiptBoxWidth = 140;
    const receiptBoxHeight = 60;
    const receiptX = width - receiptBoxWidth - 30;
    const receiptY = height - receiptBoxHeight - 30;

    firstPage.drawRectangle({
      x: receiptX,
      y: receiptY,
      width: receiptBoxWidth,
      height: receiptBoxHeight,
      borderColor: stampColor,
      borderWidth: 1,
    });

    firstPage.drawText(`เลขรับ: ${toThaiNumerals(receiptData.docNumber)}`, {
      x: receiptX + 10,
      y: receiptY + receiptBoxHeight - 18,
      size: fontSize,
      font: customFont,
      color: stampColor,
    });
    firstPage.drawText(`วันที่: ${toThaiNumerals(formatThaiDate(receiptData.date))}`, {
      x: receiptX + 10,
      y: receiptY + receiptBoxHeight - 18 - lineSpacing,
      size: fontSize,
      font: customFont,
      color: stampColor,
    });
    firstPage.drawText(`เวลา: ${toThaiNumerals(receiptData.time)}`, {
      x: receiptX + 10,
      y: receiptY + receiptBoxHeight - 18 - lineSpacing * 2,
      size: fontSize,
      font: customFont,
      color: stampColor,
    });

    // --- 2. Retirement Stamp (Bottom Left) ---
    const propX = 50;
    const propY = 140; // ขยับขึ้นจาก 120 เพื่อเพิ่มพื้นที่ด้านล่าง
    const maxRetirementWidth = width / 2.3;

    firstPage.drawText(`เรียน ผู้อำนวยการโรงเรียนบ้านควนโคกยา`, {
      x: propX,
      y: propY + 115,
      size: fontSize + 1,
      font: customFont,
      color: stampColor,
    });

    const summaryLines = wrapThaiText(`สรุป: ${proposalData.summary}`, maxRetirementWidth, customFont, fontSize);
    let currentY = propY + 98;
    for (const line of summaryLines) {
      firstPage.drawText(line, { x: propX + 10, y: currentY, size: fontSize, font: customFont, color: stampColor });
      currentY -= 18; // เพิ่มระยะห่างบรรทัดจาก 16 เป็น 18
    }

    // ขยับข้อเสนอลงมาตามจำนวนบรรทัดของสรุป
    const proposalY = currentY - 5;
    firstPage.drawText(`ข้อเสนอ: ${proposalData.proposal}`, {
      x: propX + 10,
      y: proposalY,
      size: fontSize,
      font: customFont,
      color: stampColor,
    });

    const signerY = proposalY - 35; // ตำแหน่งเซ็นชื่ออ้างอิงจากบรรทัดข้อเสนอ

    firstPage.drawText(`(ลงชื่อ) ........................................`, { x: propX + 30, y: signerY, size: fontSize, font: customFont, color: stampColor });

    // --- EMBED PROPOSER SIGNATURE (Draw after text to be on top) ---
    if (proposalData.signatureUrl) {
      try {
        const sigRes = await fetch(proposalData.signatureUrl);
        if (sigRes.ok) {
          const sigBytes = await sigRes.arrayBuffer();
          const isPng = proposalData.signatureUrl.toLowerCase().includes('.png');
          const sigImage = isPng ? await pdfDoc.embedPng(sigBytes) : await pdfDoc.embedJpg(sigBytes);
          const sigDims = sigImage.scale(0.45); // เพิ่มขนาดจาก 0.30 เป็น 0.45
          firstPage.drawImage(sigImage, {
            x: propX + 85, // ขยับซ้ายลงเล็กน้อยจาก 100 เป็น 85 (ประมาณ 3 สเปซบาร์)
            y: signerY + 12, 
            width: sigDims.width,
            height: sigDims.height,
          });
        }
      } catch (e) { console.error('Proposer sig error:', e); }
    }

    firstPage.drawText(`(${proposalData.signer})`, { x: propX + 55, y: signerY - 17, size: fontSize, font: customFont, color: stampColor });
    firstPage.drawText(`วันที่: ${toThaiNumerals(formatThaiDate(proposalData.date))}`, { x: propX + 60, y: signerY - 34, size: fontSize, font: customFont, color: stampColor });

    // --- 3. Director's Order Stamp (Bottom Right - Restored & Aligned) ---
    if (directorData) {
      // ปรับตำแหน่ง X ให้ตรงกับ stamp เลขรับด้านบน (width - receiptBoxWidth - 30)
      const receiptBoxWidth = 140;
      const rightMargin = 30;
      const startX = width - receiptBoxWidth - rightMargin;
      const effectiveWidth = receiptBoxWidth; 

      // ใช้ตำแหน่งความสูงเดียวกับฝั่งซ้าย (ขอบล่าง)
      const dirY = 140; 

      firstPage.drawText(`คำสั่ง / การปฏิบัติ`, {
        x: startX, 
        y: dirY + 115,
        size: fontSize + 1,
        font: customFont,
        color: stampColor,
      });

      const orderLines = wrapThaiText(directorData.order, effectiveWidth, customFont, fontSize);
      let dCurrentY = dirY + 98;
      for (const line of orderLines) {
        firstPage.drawText(line, { x: startX, y: dCurrentY, size: fontSize, font: customFont, color: stampColor });
        dCurrentY -= 18; 
      }

      const dirSignerY = dCurrentY - 35;

      // --- EMBED DIRECTOR SIGNATURE IMAGE ---
      if (directorData.signatureUrl) {
        try {
          const sigRes = await fetch(directorData.signatureUrl);
          if (sigRes.ok) {
            const sigBytes = await sigRes.arrayBuffer();
            const isPng = directorData.signatureUrl.toLowerCase().includes('.png') || directorData.signatureUrl.toLowerCase().includes('image/png');
            const sigImage = isPng ? await pdfDoc.embedPng(sigBytes) : await pdfDoc.embedJpg(sigBytes);
            
            const sigDims = sigImage.scale(0.50); // เพิ่มขนาดจาก 0.35 เป็น 0.50
            firstPage.drawImage(sigImage, {
              x: startX + 60, // ขยับไปทางขวาให้พ้นคำว่า (ลงชื่อ)
              y: dirSignerY + 10, // ขยับขึ้นให้พ้นเส้นประและตัวหนังสือ
              width: sigDims.width,
              height: sigDims.height,
            });
          }
        } catch (imgErr) {
          console.error('Signature image embed error:', imgErr);
        }
      }

      firstPage.drawText(`(ลงชื่อ) ........................................`, { x: startX - 10, y: dirSignerY, size: fontSize, font: customFont, color: stampColor });
      firstPage.drawText(`(${directorData.signer})`, { x: startX + 15, y: dirSignerY - 17, size: fontSize, font: customFont, color: stampColor });

      if (directorData.position) {
        firstPage.drawText(`${directorData.position}`, { x: startX - 5, y: dirSignerY - 34, size: fontSize, font: customFont, color: stampColor });
      }

      firstPage.drawText(`วันที่: ${toThaiNumerals(formatThaiDate(directorData.date))}`, {
        x: startX + 20,
        y: dirSignerY - (directorData.position ? 51 : 34),
        size: fontSize,
        font: customFont,
        color: stampColor,
      });
    }

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
  } catch (err: any) {
    console.error('Digital Stamp error:', err);
    throw new Error('การประทับตราล้มเหลว: ' + err.message);
  }
}
