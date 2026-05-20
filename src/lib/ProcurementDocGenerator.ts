import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const THAI_NUMERALS = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];

function toThaiNumerals(num: string | number): string {
  return num.toString().replace(/[0-9]/g, (digit) => THAI_NUMERALS[parseInt(digit)]);
}

function formatThaiDateFull(dateStr: string): string {
  const date = new Date(dateStr);
  const d = date.getDate();
  const monthNames = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  const m = monthNames[date.getMonth()];
  const y = date.getFullYear() + 543;
  return `${toThaiNumerals(d)} ${m} ${toThaiNumerals(y)}`;
}

function wrapThaiText(text: string, maxWidth: number, font: any, fontSize: number) {
  if (!text) return [];
  const paragraphs = text.split('\n');
  const lines: string[] = [];
  const segmenter = new (Intl as any).Segmenter('th', { granularity: 'word' });

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }
    const segments = segmenter.segment(paragraph);
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
  }
  return lines;
}

export async function generateProcurementDoc(docId: string, data: any, _aiDraftContent: string) {
  try {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const fontUrl = '/fonts/THSarabunNew.ttf';
    const fontBytes = await fetch(fontUrl).then(res => res.arrayBuffer());
    const sarabunFont = await pdfDoc.embedFont(fontBytes);
    
    const boldUrl = '/fonts/THSarabunNew-Bold.ttf';
    const sarabunBold = await fetch(boldUrl)
      .then(res => res.arrayBuffer())
      .then(bytes => pdfDoc.embedFont(bytes))
      .catch(() => sarabunFont);

    let page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    const margin = 72;
    const contentWidth = width - (margin * 1.5);
    const lineSpacing = 17; // ลดระยะห่างให้กระชับขึ้นตามคำแนะนำ

    const garudaUrl = '/src/assets/saraban/garuda-1.5cm.png';
    const garudaBytes = await fetch(garudaUrl).then(res => res.arrayBuffer());
    const garudaImage = await pdfDoc.embedPng(garudaBytes);

    if (docId === 'request') {
      // (Request logic remains but spacing updated via lineSpacing variable)
      page.drawImage(garudaImage, { x: 50, y: height - 70, width: 45, height: 45 });
      page.drawText('บันทึกข้อความ', { x: width / 2 - 45, y: height - 55, size: 26, font: sarabunBold });
      let currentY = height - 95;
      page.drawText('ส่วนราชการ', { x: 50, y: currentY, size: 16, font: sarabunBold });
      page.drawText(`โรงเรียนบ้านควนโคกยา (งานพัสดุ)`, { x: 110, y: currentY, size: 16, font: sarabunFont });
      for (let i = 265; i < width - margin; i += 5) { page.drawText('.', { x: i, y: currentY, size: 10, font: sarabunFont, color: rgb(0.7,0.7,0.7) }); }
      currentY -= 22;
      page.drawText('ที่', { x: 50, y: currentY, size: 16, font: sarabunBold });
      page.drawText(toThaiNumerals(data.docNumber || '-'), { x: 65, y: currentY, size: 16, font: sarabunFont });
      for (let i = 80; i < width / 2 - 20; i += 5) { page.drawText('.', { x: i, y: currentY, size: 10, font: sarabunFont, color: rgb(0.7,0.7,0.7) }); }
      page.drawText('วันที่', { x: width / 2, y: currentY, size: 16, font: sarabunBold });
      page.drawText(formatThaiDateFull(data.order_date), { x: width / 2 + 30, y: currentY, size: 16, font: sarabunFont });
      for (let i = width / 2 + 100; i < width - margin; i += 5) { page.drawText('.', { x: i, y: currentY, size: 10, font: sarabunFont, color: rgb(0.7,0.7,0.7) }); }
      currentY -= 22;
      page.drawText('เรื่อง', { x: 50, y: currentY, size: 16, font: sarabunBold });
      const isHire = data.procurement_type === 'จ้าง';
      const titleText = `รายงานขอ${isHire ? 'จ้าง' : 'ซื้อ'}พัสดุ (${data.project_name})`;
      page.drawText(titleText, { x: 85, y: currentY, size: 16, font: sarabunFont });
      for (let i = 85 + sarabunFont.widthOfTextAtSize(titleText, 16); i < width - margin; i += 5) { page.drawText('.', { x: i, y: currentY, size: 10, font: sarabunFont, color: rgb(0.7,0.7,0.7) }); }
      currentY -= 30;
      page.drawText('เรียน  ผู้อำนวยการโรงเรียนบ้านควนโคกยา', { x: 50, y: currentY, size: 16, font: sarabunFont });
      currentY -= 35;
      const amountThai = toThaiNumerals(Number(data.total_amount).toLocaleString());
      const rawReason = (data.necessity_reason || 'ใช้ในการจัดการเรียนการสอน').replace(/\n/g, ' ').replace(/\r/g, '').trim();
      const cleanReason = rawReason.replace(/^เพื่อ\s*/, '');
      const line1 = `ด้วยงานพัสดุ มีความประสงค์จะขอ${isHire ? 'จ้าง' : 'ซื้อ'} ${data.project_name} จำนวน ${toThaiNumerals(data.items?.length || 1)} รายการ`;
      page.drawText(line1, { x: 90, y: currentY, size: 16, font: sarabunFont });
      currentY -= lineSpacing;
      const line2 = `เพื่อ ${cleanReason} ซึ่งได้รับอนุมัติเงินจากแผนงาน/โครงการ ${data.school_projects?.project_name || '-'}`;
      const line2Wrapped = wrapThaiText(line2, contentWidth - 40, sarabunFont, 16);
      let isFirstLine = true;
      for (const l of line2Wrapped) {
        if (currentY < 100) { page = pdfDoc.addPage([595.28, 841.89]); currentY = height - margin; }
        page.drawText(l.trim(), { x: isFirstLine ? 90 : 50, y: currentY, size: 16, font: sarabunFont });
        currentY -= lineSpacing;
        isFirstLine = false;
      }
      const line3 = `จำนวนเงิน ${amountThai} บาท รายละเอียดดังแนบ`;
      page.drawText(line3, { x: 90, y: currentY, size: 16, font: sarabunFont });
      currentY -= 25;
      const bodyIntro = `งานพัสดุได้ตรวจสอบแล้วเห็นควรจัด${isHire ? 'จ้าง' : 'ซื้อ'}ตามเสนอ และเพื่อให้เป็นไปตามพระราชบัญญัติการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐ ข้อ ๕๖ วรรคหนึ่ง (๒) (ข) และระเบียบกระทรวงการคลังฯ พ.ศ. ๒๕๖๐ จึงขอรายงานขอ${isHire ? 'จ้าง' : 'ซื้อ'} ดังนี้`;
      const bodyIntroLines = wrapThaiText(bodyIntro, contentWidth - 40, sarabunFont, 16);
      isFirstLine = true;
      for (const line of bodyIntroLines) {
        if (currentY < 100) { page = pdfDoc.addPage([595.28, 841.89]); currentY = height - margin; }
        page.drawText(line.trim(), { x: isFirstLine ? 90 : 50, y: currentY, size: 16, font: sarabunFont });
        currentY -= lineSpacing;
        isFirstLine = false;
      }
      const listItems = [
        `๑. เหตุผลและความจำเป็นที่ต้อง${isHire ? 'จ้าง' : 'ซื้อ'} คือ ${rawReason}`,
        `๒. รายละเอียดและงานที่จะ${isHire ? 'จ้าง' : 'ซื้อ'} คือ ตามรายละเอียดที่แนบมาพร้อมนี้`,
        `๓. ราคากลางของทางราชการเป็นเงิน ${amountThai} บาท`,
        `๔. วงเงินที่จะขอ${isHire ? 'จ้าง' : 'ซื้อ'}ครั้งนี้ ${amountThai} บาท`,
        `๕. กำหนดเวลาทำงานแล้วเสร็จภายใน ${toThaiNumerals(data.delivery_days || 15)} วัน นับถัดจากวันลงนามในสัญญา`,
        `๖. ${isHire ? 'จ้าง' : 'ซื้อ'}โดยวิธีเฉพาะเจาะจง เนื่องจากมีวงเงินในการจัดซื้อจัดจ้างครั้งหนึ่งไม่เกิน ๕๐๐,๐๐๐ บาท ที่กำหนดในกฎกระทรวง`,
        `๗. หลักเกณฑ์การพิจารณาคัดเลือกข้อเสนอ โดยใช้${data.evaluation_criteria || 'เกณฑ์ราคา'}`,
        `๘. ข้อเสนออื่น ๆ เห็นควรแต่งตั้งคณะกรรมการตรวจรับพัสดุ ตามเสนอ`
      ];
      for (const item of listItems) {
        if (currentY < 120) { page = pdfDoc.addPage([595.28, 841.89]); currentY = height - margin; }
        const itemLines = wrapThaiText(item, contentWidth - 70, sarabunFont, 16);
        let firstLine = true;
        for (const line of itemLines) {
          page.drawText(line.trim(), { x: firstLine ? 70 : 85, y: currentY, size: 16, font: sarabunFont });
          currentY -= lineSpacing;
          firstLine = false;
        }
      }
      currentY -= 10;
      page.drawText('จึงเรียนมาเพื่อโปรดพิจารณา', { x: 70, y: currentY, size: 16, font: sarabunFont });
      currentY -= 18;
      page.drawText(`๑. เห็นชอบในรายงานขอ${isHire ? 'จ้าง' : 'ซื้อ'}ดังกล่าวข้างต้น`, { x: 85, y: currentY, size: 16, font: sarabunFont });
      currentY -= 18;
      page.drawText(`๒. อนุมัติแต่งตั้งคณะกรรมการตรวจรับพัสดุตามที่เสนอ`, { x: 85, y: currentY, size: 16, font: sarabunFont });
      if (currentY < 200) { page = pdfDoc.addPage([595.28, 841.89]); currentY = height - margin; }
      currentY -= 40;
      page.drawText('ลงชื่อ................................................เจ้าหน้าที่', { x: 70, y: currentY, size: 16, font: sarabunFont });
      page.drawText('ลงชื่อ................................................หัวหน้าเจ้าหน้าที่', { x: width - 260, y: currentY, size: 16, font: sarabunFont });
      currentY -= 20;
      page.drawText(`(${data.officerName || '................................................'})`, { x: 95, y: currentY, size: 16, font: sarabunFont });
      page.drawText(`(${data.headOfficerName || '................................................'})`, { x: width - 235, y: currentY, size: 16, font: sarabunFont });
      currentY -= 45;
      page.drawText('เห็นชอบ', { x: width / 2 - 20, y: currentY, size: 16, font: sarabunBold });
      currentY -= 20;
      page.drawText('อนุมัติ', { x: width / 2 - 15, y: currentY, size: 16, font: sarabunBold });
      currentY -= 45;
      page.drawText('ลงชื่อ................................................................', { x: width / 2 - 80, y: currentY, size: 16, font: sarabunFont });
      currentY -= 20;
      page.drawText(`(${data.directorName})`, { x: width / 2 - 70, y: currentY, size: 16, font: sarabunFont });
      page.drawText('ผู้อำนวยการโรงเรียนบ้านควนโคกยา', { x: width / 2 - 75, y: currentY - 20, size: 16, font: sarabunFont });
    } 
    
    else if (docId === 'appointment') {
      // 1. ตราครุฑ ตรงกลาง
      page.drawImage(garudaImage, { x: width / 2 - 30, y: height - 80, width: 60, height: 60 });

      // 2. หัวคำสั่ง
      let currentY = height - 110;
      page.drawText('คำสั่งโรงเรียนบ้านควนโคกยา', { x: width / 2 - (sarabunBold.widthOfTextAtSize('คำสั่งโรงเรียนบ้านควนโคกยา', 22)/2), y: currentY, size: 22, font: sarabunBold });
      currentY -= 25;
      const orderNo = `ที่ ${toThaiNumerals(data.order_number || '...../.....')}`;
      page.drawText(orderNo, { x: width / 2 - (sarabunFont.widthOfTextAtSize(orderNo, 16)/2), y: currentY, size: 16, font: sarabunFont });
      
      currentY -= 30;
      // เช็คจำนวนคนเพื่อกำหนดชื่อเรียก (1 คน = ผู้ตรวจรับ, 3 คนขึ้นไป = คณะกรรมการ)
      const memberCount = (data.committees || []).length;
      const roleTitle = memberCount >= 3 ? 'คณะกรรมการตรวจรับพัสดุ' : 'ผู้ตรวจรับพัสดุ';
      
      const subjectText = `เรื่อง แต่งตั้ง${roleTitle} สำหรับการ${data.procurement_type === 'ซื้อ' ? 'ซื้อ' : 'จ้าง'}${data.project_name}`;
      const subjectLines = wrapThaiText(subjectText, contentWidth, sarabunBold, 16);
      for (const line of subjectLines) {
        const lineWidth = sarabunBold.widthOfTextAtSize(line.trim(), 16);
        page.drawText(line.trim(), { x: (width - lineWidth) / 2, y: currentY, size: 16, font: sarabunBold });
        currentY -= lineSpacing;
      }

      // 3. เนื้อความ
      currentY -= 25;
      const intro = `ด้วยโรงเรียนบ้านควนโคกยา มีความประสงค์จะ${data.procurement_type === 'ซื้อ' ? 'ซื้อ' : 'จ้าง'}${data.project_name} จำนวน ${toThaiNumerals(data.items?.length || 1)} รายการ โดยวิธีเฉพาะเจาะจง และเพื่อให้เป็นไปตามระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐`;
      const introLines = wrapThaiText(intro, contentWidth, sarabunFont, 16);
      let isFirst = true;
      for (const line of introLines) {
        page.drawText(line.trim(), { x: isFirst ? 110 : 70, y: currentY, size: 16, font: sarabunFont });
        currentY -= lineSpacing;
        isFirst = false;
      }

      currentY -= 10;
      const body = `อาศัยอำนาจตามความในระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐ จึงขอแต่งตั้ง${roleTitle} ดังนี้`;
      const bodyLines = wrapThaiText(body, contentWidth, sarabunFont, 16);
      isFirst = true;
      for (const line of bodyLines) {
        page.drawText(line.trim(), { x: isFirst ? 110 : 70, y: currentY, size: 16, font: sarabunFont });
        currentY -= lineSpacing;
        isFirst = false;
      }

      // 4. รายชื่อกรรมการ
      currentY -= 15;
      data.committees.forEach((c: any, idx: number) => {
        if (currentY < 120) { page = pdfDoc.addPage([595.28, 841.89]); currentY = height - margin; }
        page.drawText(`${toThaiNumerals(idx + 1)}. ${c.name}`, { x: 110, y: currentY, size: 16, font: sarabunFont });
        
        // ถ้าคนเดียวเป็น ผู้ตรวจรับพัสดุ, ถ้าหลายคน คนแรกเป็นประธาน ที่เหลือเป็นกรรมการ
        let displayRole = c.role;
        if (memberCount === 1) displayRole = 'ผู้ตรวจรับพัสดุ';
        else if (idx === 0) displayRole = 'ประธานกรรมการ';
        else displayRole = 'กรรมการ';

        page.drawText(displayRole, { x: width - 200, y: currentY, size: 16, font: sarabunFont });
        currentY -= lineSpacing;
      });

      currentY -= 15;
      const closing = `ให้ผู้ที่ได้รับการแต่งตั้งปฏิบัติหน้าที่ให้เป็นไปตามระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐ โดยเคร่งครัด`;
      const closingLines = wrapThaiText(closing, contentWidth, sarabunFont, 16);
      isFirst = true;
      for (const line of closingLines) {
        if (currentY < 120) { page = pdfDoc.addPage([595.28, 841.89]); currentY = height - margin; }
        page.drawText(line.trim(), { x: isFirst ? 110 : 70, y: currentY, size: 16, font: sarabunFont });
        currentY -= lineSpacing;
        isFirst = false;
      }

      currentY -= 15;
      page.drawText(`ทั้งนี้ ตั้งแต่วันที่ ${formatThaiDateFull(data.order_date)} เป็นต้นไป`, { x: 110, y: currentY, size: 16, font: sarabunFont });

      currentY -= 35;
      page.drawText(`สั่ง ณ วันที่ ${formatThaiDateFull(data.order_date)}`, { x: width / 2 - 20, y: currentY, size: 16, font: sarabunFont });

      // Signature
      if (currentY < 150) { page = pdfDoc.addPage([595.28, 841.89]); currentY = height - margin; }
      currentY -= 60;
      page.drawText('ลงชื่อ................................................................', { x: width / 2, y: currentY, size: 16, font: sarabunFont });
      currentY -= 25;
      page.drawText(`(${data.directorName})`, { x: width / 2 + 10, y: currentY, size: 16, font: sarabunFont });
      currentY -= 25;
      page.drawText('ผู้อำนวยการโรงเรียนบ้านควนโคกยา', { x: width / 2 + 5, y: currentY, size: 16, font: sarabunFont });
    }

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes as any], { type: 'application/pdf' });
  } catch (err) {
    console.error('PDF Generation Error:', err);
    throw err;
  }
}

export async function generateProcurementMemo(data: any, _aiDraftContent: string) {
  return generateProcurementDoc('request', data, _aiDraftContent);
}
