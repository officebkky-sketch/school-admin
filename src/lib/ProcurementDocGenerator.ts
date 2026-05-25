import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const THAI_NUMERALS = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];

/**
 * แปลงตัวเลขอารบิกเป็นตัวเลขไทย
 */
export function toThaiNumerals(num: string | number): string {
  if (num === null || num === undefined) return '';
  return num.toString().replace(/[0-9]/g, (digit) => THAI_NUMERALS[parseInt(digit)]);
}

/**
 * รูปแบบวันที่ไทยแบบเต็ม (พ.ศ.) พร้อมตัวเลขไทย
 */
export function formatThaiDateFull(dateStr: string): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "-";
  const d = date.getDate();
  const monthNames = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  const m = monthNames[date.getMonth()];
  const y = date.getFullYear() + 543;
  return `${toThaiNumerals(d)} ${m} ${toThaiNumerals(y)}`;
}

/**
 * แปลงจำนวนเงินเป็นตัวอักษรไทย (Baht Text)
 */
export function numToThaiBaht(num: number): string {
  if (num === 0) return 'ศูนย์บาทถ้วน';
  
  const digits = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
  
  let [integerPart, decimalPart] = num.toFixed(2).split('.');
  
  const convert = (s: string) => {
    let result = '';
    const len = s.length;
    for (let i = 0; i < len; i++) {
      let d = parseInt(s[i]);
      if (d !== 0) {
        if (i === len - 1 && d === 1 && len > 1) result += 'เอ็ด';
        else if (i === len - 2 && d === 2) result += 'ยี่สิบ';
        else if (i === len - 2 && d === 1) result += 'สิบ';
        else result += digits[d] + positions[len - i - 1];
      }
    }
    return result;
  };
  
  let thaiText = convert(integerPart) + 'บาท';
  if (parseInt(decimalPart) === 0) {
    thaiText += 'ถ้วน';
  } else {
    thaiText += convert(decimalPart) + 'สตางค์';
  }
  return thaiText;
}

/**
 * ตัดคำและจัดบรรทัดสำหรับภาษาไทย (Word Wrap)
 */
export function wrapThaiText(text: string, maxWidth: number, font: any, fontSize: number) {
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
      const lineWidth = font ? font.widthOfTextAtSize(testLine, fontSize) : testLine.length * (fontSize * 0.5);
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
    const margin = 54; // ขยายขอบกระดาษเป็น 0.75 นิ้ว (54pt) เพื่อพิมพ์ได้เนื้อหามากขึ้น
    const contentWidth = width - (margin * 2);
    const lineSpacing = 15; // กระชับระยะบรรทัดเพื่อป้องกันการล้นหน้ากระดาษ

    const garudaUrl = '/src/assets/saraban/garuda-1.5cm.png';
    const garudaBytes = await fetch(garudaUrl).then(res => res.arrayBuffer());
    const garudaImage = await pdfDoc.embedPng(garudaBytes);

    if (docId === 'request') {
      page.drawImage(garudaImage, { x: 50, y: height - 60, width: 40, height: 40 });
      page.drawText('บันทึกข้อความ', { x: width / 2 - 50, y: height - 48, size: 24, font: sarabunBold });
      let currentY = height - 80;
      page.drawText('ส่วนราชการ', { x: 50, y: currentY, size: 15, font: sarabunBold });
      page.drawText(`โรงเรียนบ้านควนโคกยา (งานพัสดุ)`, { x: 110, y: currentY, size: 15, font: sarabunFont });
      for (let i = 265; i < width - margin; i += 5) { page.drawText('.', { x: i, y: currentY, size: 10, font: sarabunFont, color: rgb(0.7,0.7,0.7) }); }
      currentY -= 18;
      page.drawText('ที่', { x: 50, y: currentY, size: 15, font: sarabunBold });
      page.drawText(toThaiNumerals(data.doc_number || '-'), { x: 65, y: currentY, size: 15, font: sarabunFont });
      for (let i = 80; i < width / 2 - 20; i += 5) { page.drawText('.', { x: i, y: currentY, size: 10, font: sarabunFont, color: rgb(0.7,0.7,0.7) }); }
      page.drawText('วันที่', { x: width / 2, y: currentY, size: 15, font: sarabunBold });
      page.drawText(formatThaiDateFull(data.order_date), { x: width / 2 + 30, y: currentY, size: 15, font: sarabunFont });
      for (let i = width / 2 + 100; i < width - margin; i += 5) { page.drawText('.', { x: i, y: currentY, size: 10, font: sarabunFont, color: rgb(0.7,0.7,0.7) }); }
      currentY -= 18;
      page.drawText('เรื่อง', { x: 50, y: currentY, size: 15, font: sarabunBold });
      const isHire = data.procurement_type === 'จ้าง';
      const titleText = `รายงานขอ${isHire ? 'จ้าง' : 'ซื้อ'}พัสดุ (${data.project_name})`;
      page.drawText(titleText, { x: 85, y: currentY, size: 15, font: sarabunFont });
      for (let i = 85 + sarabunFont.widthOfTextAtSize(titleText, 15); i < width - margin; i += 5) { page.drawText('.', { x: i, y: currentY, size: 10, font: sarabunFont, color: rgb(0.7,0.7,0.7) }); }
      currentY -= 22;
      page.drawText('เรียน  ผู้อำนวยการโรงเรียนบ้านควนโคกยา', { x: 50, y: currentY, size: 15, font: sarabunFont });
      currentY -= 25;
      
      const amountThai = toThaiNumerals(Number(data.total_amount).toLocaleString());
      const rawReason = (data.necessity_reason || 'ใช้ในการจัดการเรียนการสอน').replace(/\n/g, ' ').replace(/\r/g, '').trim();
      const cleanReason = rawReason.replace(/^เพื่อ\s*/, '');
      const line1 = `ด้วยงานพัสดุ มีความประสงค์จะขอ${isHire ? 'จ้าง' : 'ซื้อ'} ${data.project_name} จำนวน ${toThaiNumerals(data.items?.length || 1)} รายการ`;
      page.drawText(line1, { x: 80, y: currentY, size: 15, font: sarabunFont });
      currentY -= lineSpacing;
      const line2 = `เพื่อ ${cleanReason} ซึ่งได้รับอนุมัติเงินจากแผนงาน/โครงการ ${data.school_projects?.project_name || '-'}`;
      const line2Wrapped = wrapThaiText(line2, contentWidth - 30, sarabunFont, 15);
      let isFirstLine = true;
      for (const l of line2Wrapped) {
        if (currentY < 90) { page = pdfDoc.addPage([595.28, 841.89]); currentY = height - margin; }
        page.drawText(l.trim(), { x: isFirstLine ? 80 : 50, y: currentY, size: 15, font: sarabunFont });
        currentY -= lineSpacing;
        isFirstLine = false;
      }
      const line3 = `จำนวนเงิน ${amountThai} บาท รายละเอียดดังแนบ`;
      page.drawText(line3, { x: 80, y: currentY, size: 15, font: sarabunFont });
      currentY -= 18;
      const bodyIntro = `งานพัสดุได้ตรวจสอบแล้วเห็นควรจัด${isHire ? 'จ้าง' : 'ซื้อ'}ตามเสนอ และเพื่อให้เป็นไปตามพระราชบัญญัติการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐ ข้อ ๕๖ วรรคหนึ่ง (๒) (ข) และระเบียบกระทรวงการคลังฯ พ.ศ. ๒๕๖๐ จึงขอรายงานขอ${isHire ? 'จ้าง' : 'ซื้อ'} ดังนี้`;
      const bodyIntroLines = wrapThaiText(bodyIntro, contentWidth - 30, sarabunFont, 15);
      isFirstLine = true;
      for (const line of bodyIntroLines) {
        if (currentY < 90) { page = pdfDoc.addPage([595.28, 841.89]); currentY = height - margin; }
        page.drawText(line.trim(), { x: isFirstLine ? 80 : 50, y: currentY, size: 15, font: sarabunFont });
        currentY -= lineSpacing;
        isFirstLine = false;
      }
      const listItems = [
        `๑. เหตุผลและความจำเป็นที่ต้อง${isHire ? 'จ้าง' : 'ซื้อ'} คือ ${rawReason}`,
        `๒. รายละเอียดและงานที่จะ${isHire ? 'จ้าง' : 'ซื้อ'} คือ ตามรายละเอียดที่แนบมาพร้อมนี้`,
        `๓. ราคากลางของทางราชการเป็นเงิน ${amountThai} บาท`,
        `๔. วงเงินที่จะขอ${isHire ? 'จ้าง' : 'ซื้อ'}ครั้งนี้ ${amountThai} บาท`,
        `๕. 定กำหนดเวลาทำงานแล้วเสร็จภายใน ${toThaiNumerals(data.delivery_days || 15)} วัน นับถัดจากวันลงนามในสัญญา`,
        `๖. ${isHire ? 'จ้าง' : 'ซื้อ'}โดยวิธีเฉพาะเจาะจง เนื่องจากมีวงเงินในการจัดซื้อจัดจ้างครั้งหนึ่งไม่เกิน ๕๐๐,๐๐๐ บาท ที่กำหนดในกฎกระทรวง`,
        `๗. หลักเกณฑ์การพิจารณาคัดเลือกข้อเสนอ โดยใช้${data.evaluation_criteria || 'เกณฑ์ราคา'}`,
        `๘. ข้อเสนออื่น ๆ เห็นควรแต่งตั้งคณะกรรมการตรวจรับพัสดุ ตามเสนอ`
      ];
      for (const item of listItems) {
        if (currentY < 100) { page = pdfDoc.addPage([595.28, 841.89]); currentY = height - margin; }
        const itemLines = wrapThaiText(item, contentWidth - 50, sarabunFont, 15);
        let firstLine = true;
        for (const line of itemLines) {
          page.drawText(line.trim(), { x: firstLine ? 65 : 75, y: currentY, size: 15, font: sarabunFont });
          currentY -= lineSpacing;
          firstLine = false;
        }
      }
      currentY -= 6;
      page.drawText('จึงเรียนมาเพื่อโปรดพิจารณา', { x: 65, y: currentY, size: 15, font: sarabunFont });
      currentY -= 15;
      page.drawText(`๑. เห็นชอบในรายงานขอ${isHire ? 'จ้าง' : 'ซื้อ'}ดังกล่าวข้างต้น`, { x: 80, y: currentY, size: 15, font: sarabunFont });
      currentY -= 15;
      page.drawText(`๒. อนุมัติแต่งตั้งคณะกรรมการตรวจรับพัสดุตามที่เสนอ`, { x: 80, y: currentY, size: 15, font: sarabunFont });
      if (currentY < 140) { page = pdfDoc.addPage([595.28, 841.89]); currentY = height - margin; }
      currentY -= 25;
      page.drawText('ลงชื่อ................................................เจ้าหน้าที่', { x: 70, y: currentY, size: 15, font: sarabunFont });
      page.drawText('ลงชื่อ................................................หัวหน้าเจ้าหน้าที่', { x: width - 250, y: currentY, size: 15, font: sarabunFont });
      currentY -= 16;
      page.drawText(`(${data.officerName || '................................................'})`, { x: 90, y: currentY, size: 15, font: sarabunFont });
      page.drawText(`(${data.headOfficerName || '................................................'})`, { x: width - 225, y: currentY, size: 15, font: sarabunFont });
      currentY -= 30;
      page.drawText('เห็นชอบ / อนุมัติ', { x: width / 2 - 40, y: currentY, size: 15, font: sarabunBold });
      currentY -= 30;
      page.drawText('ลงชื่อ................................................................', { x: width / 2 - 80, y: currentY, size: 15, font: sarabunFont });
      currentY -= 16;
      page.drawText(`(${data.directorName})`, { x: width / 2 - 70, y: currentY, size: 15, font: sarabunFont });
      page.drawText('ผู้อำนวยการโรงเรียนบ้านควนโคกยา', { x: width / 2 - 75, y: currentY - 16, size: 15, font: sarabunFont });
    } 
    
    else if (docId === 'appointment') {
      page.drawImage(garudaImage, { x: width / 2 - 25, y: height - 70, width: 50, height: 50 });
      let currentY = height - 105;
      page.drawText('คำสั่งโรงเรียนบ้านควนโคกยา', { x: width / 2 - (sarabunBold.widthOfTextAtSize('คำสั่งโรงเรียนบ้านควนโคกยา', 20)/2), y: currentY, size: 20, font: sarabunBold });
      currentY -= 20;
      const orderNo = `ที่ ${toThaiNumerals(data.order_number || '...../.....')}`;
      page.drawText(orderNo, { x: width / 2 - (sarabunFont.widthOfTextAtSize(orderNo, 15)/2), y: currentY, size: 15, font: sarabunFont });
      
      currentY -= 22;
      const memberCount = (data.committees || []).length;
      const roleTitle = memberCount >= 3 ? 'คณะกรรมการตรวจรับพัสดุ' : 'ผู้ตรวจรับพัสดุ';
      
      const appointmentWidth = contentWidth - 40; // ลดความกว้างลง 40pt เพื่อเพิ่มระยะขอบซ้ายขวาให้สวยงาม
      const subjectText = `เรื่อง แต่งตั้ง${roleTitle} สำหรับการ${data.procurement_type === 'ซื้อ' ? 'ซื้อ' : 'จ้าง'}${data.project_name}`;
      const subjectLines = wrapThaiText(subjectText, appointmentWidth, sarabunBold, 15);
      for (const line of subjectLines) {
        const w = sarabunBold.widthOfTextAtSize(line.trim(), 15);
        page.drawText(line.trim(), { x: (width - w) / 2, y: currentY, size: 15, font: sarabunBold });
        currentY -= lineSpacing;
      }

      currentY -= 18;
      const intro = `ด้วยโรงเรียนบ้านควนโคกยา มีความประสงค์จะ${data.procurement_type === 'ซื้อ' ? 'ซื้อ' : 'จ้าง'}${data.project_name} จำนวน ${toThaiNumerals(data.items?.length || 1)} รายการ โดยวิธีเฉพาะเจาะจง และเพื่อให้เป็นไปตามระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐`;
      const introLines = wrapThaiText(intro, appointmentWidth, sarabunFont, 15);
      let isFirst = true;
      for (const line of introLines) {
        page.drawText(line.trim(), { x: isFirst ? 120 : 80, y: currentY, size: 15, font: sarabunFont });
        currentY -= lineSpacing;
        isFirst = false;
      }

      currentY -= 8;
      const body = `อาศัยอำนาจตามความในระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐ จึงขอแต่งตั้ง${roleTitle} ดังนี้`;
      const bodyLines = wrapThaiText(body, appointmentWidth, sarabunFont, 15);
      isFirst = true;
      for (const line of bodyLines) {
        page.drawText(line.trim(), { x: isFirst ? 120 : 80, y: currentY, size: 15, font: sarabunFont });
        currentY -= lineSpacing;
        isFirst = false;
      }

      currentY -= 10;
      data.committees.forEach((c: any, idx: number) => {
        if (currentY < 100) { page = pdfDoc.addPage([595.28, 841.89]); currentY = height - margin; }
        page.drawText(`${toThaiNumerals(idx + 1)}. ${c.name}`, { x: 120, y: currentY, size: 15, font: sarabunFont });
        
        let displayRole = c.role;
        if (memberCount === 1) displayRole = 'ผู้ตรวจรับพัสดุ';
        else if (idx === 0) displayRole = 'ประธานกรรมการ';
        else displayRole = 'กรรมการ';

        page.drawText(displayRole, { x: width - 210, y: currentY, size: 15, font: sarabunFont });
        currentY -= lineSpacing;
      });

      currentY -= 10;
      const closing = `ให้ผู้ที่ได้รับการแต่งตั้งปฏิบัติหน้าที่ให้เป็นไปตามระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐ โดยเคร่งครัด`;
      const closingLines = wrapThaiText(closing, appointmentWidth, sarabunFont, 15);
      isFirst = true;
      for (const line of closingLines) {
        if (currentY < 100) { page = pdfDoc.addPage([595.28, 841.89]); currentY = height - margin; }
        page.drawText(line.trim(), { x: isFirst ? 120 : 80, y: currentY, size: 15, font: sarabunFont });
        currentY -= lineSpacing;
        isFirst = false;
      }

      currentY -= 10;
      page.drawText(`ทั้งนี้ ตั้งแต่วันที่ ${formatThaiDateFull(data.order_date)} เป็นต้นไป`, { x: 120, y: currentY, size: 15, font: sarabunFont });
      currentY -= 20;
      page.drawText(`สั่ง ณ วันที่ ${formatThaiDateFull(data.order_date)}`, { x: width / 2 - 20, y: currentY, size: 15, font: sarabunFont });

      if (currentY < 120) { page = pdfDoc.addPage([595.28, 841.89]); currentY = height - margin; }
      currentY -= 35;
      page.drawText('ลงชื่อ................................................................', { x: width / 2, y: currentY, size: 15, font: sarabunFont });
      currentY -= 18;
      page.drawText(`(${data.directorName})`, { x: width / 2 + 10, y: currentY, size: 15, font: sarabunFont });
      currentY -= 18;
      page.drawText('ผู้อำนวยการโรงเรียนบ้านควนโคกยา', { x: width / 2 + 5, y: currentY, size: 15, font: sarabunFont });
    } 
    
    else if (docId === 'notice_winner') {
      page.drawImage(garudaImage, { x: width / 2 - 25, y: height - 70, width: 50, height: 50 });
      let currentY = height - 105;
      page.drawText('ประกาศโรงเรียนบ้านควนโคกยา', { x: width / 2 - (sarabunBold.widthOfTextAtSize('ประกาศโรงเรียนบ้านควนโคกยา', 17)/2), y: currentY, size: 17, font: sarabunBold });
      currentY -= 20;
      
      const winnerWidth = contentWidth - 40; // เพิ่มระยะขอบซ้ายขวา
      const isHire = data.procurement_type === 'จ้าง';
      const winnerSubject = `เรื่อง ประกาศผู้ชนะการเสนอราคาสำหรับการจัด${isHire ? 'จ้าง' : 'ซื้อ'}${data.project_name}`;
      const winnerSubjectLines = wrapThaiText(winnerSubject, winnerWidth, sarabunBold, 15);
      for (const line of winnerSubjectLines) {
        const w = sarabunBold.widthOfTextAtSize(line.trim(), 15);
        page.drawText(line.trim(), { x: (width - w) / 2, y: currentY, size: 15, font: sarabunBold });
        currentY -= lineSpacing;
      }
      currentY -= 15;
      const introText = `ตามที่ โรงเรียนบ้านควนโคกยา ได้มีโครงการ จัด${isHire ? 'ซื้อ' : 'จ้าง'}${data.project_name} โดยวิธีเฉพาะเจาะจง นั้น`;
      const introLines = wrapThaiText(introText, winnerWidth, sarabunFont, 15);
      let isFirst = true;
      for (const line of introLines) {
        page.drawText(line.trim(), { x: isFirst ? 120 : 80, y: currentY, size: 15, font: sarabunFont });
        currentY -= lineSpacing;
        isFirst = false;
      }
      currentY -= 8;
      const vendorName = data.vendor_info?.name || '................................................';
      const totalAmountVal = Number(data.total_amount) || 0;
      const totalText = numToThaiBaht(totalAmountVal);
      const itemsCountText = toThaiNumerals(data.items?.length || 1);
      const detailText = `การจัด${isHire ? 'ซื้อ' : 'จ้าง'}พัสดุจำนวน ${itemsCountText} รายการ ผู้ได้รับการคัดเลือก ได้แก่ ${vendorName} โดยเสนอราคาเป็นเงินทั้งสิ้น ${toThaiNumerals(totalAmountVal.toLocaleString())} บาท (${totalText}) รวมภาษีมูลค่าเพิ่มและภาษีอื่น ค่าขนส่ง ค่าจดทะเบียน และค่าใช้จ่ายอื่นๆ ทั้งปวง`;
      const detailLines = wrapThaiText(detailText, winnerWidth, sarabunFont, 15);
      isFirst = true;
      for (const line of detailLines) {
        if (currentY < 100) { page = pdfDoc.addPage([595.28, 841.89]); currentY = height - margin; }
        page.drawText(line.trim(), { x: isFirst ? 120 : 80, y: currentY, size: 15, font: sarabunFont });
        currentY -= lineSpacing;
        isFirst = false;
      }
      currentY -= 20;
      const dateText = `ประกาศ ณ วันที่ ${formatThaiDateFull(data.order_date)}`;
      const wDate = sarabunFont.widthOfTextAtSize(dateText, 15);
      page.drawText(dateText, { x: (width - wDate) / 2, y: currentY, size: 15, font: sarabunFont });
      
      if (currentY < 120) { page = pdfDoc.addPage([595.28, 841.89]); currentY = height - margin; }
      currentY -= 35;
      page.drawText('ลงชื่อ................................................................', { x: width / 2, y: currentY, size: 15, font: sarabunFont });
      currentY -= 18;
      page.drawText(`(${data.directorName})`, { x: width / 2 + 10, y: currentY, size: 15, font: sarabunFont });
      currentY -= 18;
      page.drawText('ผู้อำนวยการโรงเรียนบ้านควนโคกยา', { x: width / 2 + 5, y: currentY, size: 15, font: sarabunFont });
    }

    else if (docId === 'po') {
      page.drawImage(garudaImage, { x: width / 2 - 25, y: height - 70, width: 50, height: 50 });
      const isHire = data.procurement_type === 'จ้าง';
      const poTitle = isHire ? 'ใบสั่งจ้าง' : 'ใบสั่งซื้อ';
      page.drawText(poTitle, { x: width / 2 - (sarabunBold.widthOfTextAtSize(poTitle, 18)/2), y: height - 105, size: 18, font: sarabunBold });
      let currentY = height - 130;
      page.drawText(`โรงเรียนบ้านควนโคกยา`, { x: 50, y: currentY, size: 14, font: sarabunBold });
      page.drawText(`เลขที่: ${toThaiNumerals(data.po_number || '...../.....')}`, { x: width - 200, y: currentY, size: 14, font: sarabunFont });
      currentY -= 16;
      page.drawText(`ตำบลควนโคกยา อำเภอควนขนุน จังหวัดพัทลุง`, { x: 50, y: currentY, size: 12, font: sarabunFont });
      page.drawText(`วันที่: ${formatThaiDateFull(data.po_date || data.order_date)}`, { x: width - 200, y: currentY, size: 14, font: sarabunFont });
      currentY -= 22;
      
      const vendorName = data.vendor_info?.name || '................................................';
      const vendorAddress = data.vendor_info?.address || '................................................';
      const vendorTax = data.vendor_info?.tax_id || '................................................';
      page.drawText(`ถึง (ผู้${isHire ? 'รับจ้าง' : 'ขาย'}): ${vendorName}`, { x: 50, y: currentY, size: 14, font: sarabunBold });
      currentY -= 16;
      page.drawText(`ที่อยู่: ${vendorAddress}`, { x: 50, y: currentY, size: 12, font: sarabunFont });
      currentY -= 16;
      page.drawText(`เลขประจำตัวผู้เสียภาษี: ${toThaiNumerals(vendorTax)}`, { x: 50, y: currentY, size: 12, font: sarabunFont });
      currentY -= 20;
      
      const introText = `โรงเรียนบ้านควนโคกยาตกลงสั่ง${isHire ? 'จ้าง' : 'ซื้อ'}พัสดุตามรายการต่อไปนี้ ภายใต้เงื่อนไขข้อตกลงที่กำหนดไว้ท้ายใบสั่งนี้`;
      page.drawText(introText, { x: 50, y: currentY, size: 12, font: sarabunFont });
      currentY -= 18;

      const tableTop = currentY;
      page.drawRectangle({ x: 50, y: tableTop - 18, width: width - 100, height: 18, color: rgb(0.96,0.96,0.96), borderColor: rgb(0,0,0), borderWidth: 0.8 });
      page.drawText('ลำดับ', { x: 55, y: tableTop - 13, size: 10, font: sarabunBold });
      page.drawText('รายการสินค้า / รายละเอียด', { x: 90, y: tableTop - 13, size: 10, font: sarabunBold });
      page.drawText('จำนวน', { x: width - 260, y: tableTop - 13, size: 10, font: sarabunBold });
      page.drawText('หน่วย', { x: width - 210, y: tableTop - 13, size: 10, font: sarabunBold });
      page.drawText('ราคา/หน่วย', { x: width - 170, y: tableTop - 13, size: 10, font: sarabunBold });
      page.drawText('จำนวนเงิน', { x: width - 110, y: tableTop - 13, size: 10, font: sarabunBold });
      
      currentY = tableTop - 18;
      const items = data.items || [];
      items.forEach((item: any, idx: number) => {
        if (currentY < 120) { page = pdfDoc.addPage([595.28, 841.89]); currentY = height - margin; }
        page.drawRectangle({ x: 50, y: currentY - 18, width: width - 100, height: 18, borderColor: rgb(0,0,0), borderWidth: 0.8 });
        
        page.drawText(toThaiNumerals(idx + 1), { x: 60, y: currentY - 13, size: 10, font: sarabunFont });
        page.drawText(item.item_name, { x: 90, y: currentY - 13, size: 10, font: sarabunFont });
        page.drawText(toThaiNumerals(item.quantity), { x: width - 250, y: currentY - 13, size: 10, font: sarabunFont });
        page.drawText(item.unit || 'หน่วย', { x: width - 210, y: currentY - 13, size: 10, font: sarabunFont });
        page.drawText(toThaiNumerals(Number(item.price_per_unit).toLocaleString()), { x: width - 165, y: currentY - 13, size: 10, font: sarabunFont });
        page.drawText(toThaiNumerals(Number(item.total_price).toLocaleString()), { x: width - 105, y: currentY - 13, size: 10, font: sarabunFont });
        
        currentY -= 18;
      });

      page.drawRectangle({ x: 50, y: currentY - 18, width: width - 100, height: 18, borderColor: rgb(0,0,0), borderWidth: 0.8 });
      const totalAmountVal = Number(data.total_amount) || 0;
      const thaiText = numToThaiBaht(totalAmountVal);
      page.drawText(`รวมเงินตัวอักษร (${thaiText})`, { x: 60, y: currentY - 13, size: 10, font: sarabunBold });
      page.drawText(`รวมทั้งสิ้น`, { x: width - 170, y: currentY - 13, size: 10, font: sarabunBold });
      page.drawText(toThaiNumerals(totalAmountVal.toLocaleString()) + ' บาท', { x: width - 115, y: currentY - 13, size: 10, font: sarabunBold });
      
      currentY -= 25;
      if (currentY < 130) { page = pdfDoc.addPage([595.28, 841.89]); currentY = height - margin; }
      
      const deliveryText = `เกณฑ์การส่งมอบ: กำหนดส่งของภายใน ${toThaiNumerals(data.delivery_days || 15)} วัน นับถัดจากวันที่ได้รับใบสั่งนี้`;
      const deliveryLines = wrapThaiText(deliveryText, contentWidth, sarabunFont, 10);
      for (const line of deliveryLines) {
        page.drawText(line.trim(), { x: 50, y: currentY, size: 10, font: sarabunFont });
        currentY -= 12;
      }
      
      const penaltyText = `ค่าปรับ: หากพ้นกำหนดส่งมอบ โรงเรียนสงวนสิทธิ์ในการปรับรายวันในอัตราร้อยละ ๐.๒ ของราคาสิ่งของที่ยังไม่ได้รับมอบ`;
      const penaltyLines = wrapThaiText(penaltyText, contentWidth, sarabunFont, 10);
      for (const line of penaltyLines) {
        page.drawText(line.trim(), { x: 50, y: currentY, size: 10, font: sarabunFont });
        currentY -= 12;
      }
      
      currentY -= 18;
      if (currentY < 130) { page = pdfDoc.addPage([595.28, 841.89]); currentY = height - margin; }
      
      page.drawText(`ลงชื่อ................................................ผู้สั่ง${isHire ? 'จ้าง' : 'ซื้อ'}`, { x: 50, y: currentY, size: 13, font: sarabunFont });
      page.drawText(`ลงชื่อ................................................ผู้รับใบสั่ง/ผู้${isHire ? 'รับจ้าง' : 'ขาย'}`, { x: width - 250, y: currentY, size: 13, font: sarabunFont });
      currentY -= 16;
      page.drawText(`(${data.directorName})`, { x: 75, y: currentY, size: 13, font: sarabunFont });
      page.drawText(`(${vendorName})`, { x: width - 225, y: currentY, size: 13, font: sarabunFont });
      currentY -= 16;
      page.drawText('ผู้อำนวยการโรงเรียนบ้านควนโคกยา', { x: 65, y: currentY, size: 13, font: sarabunFont });
      page.drawText('วันที่................/................/................', { x: width - 230, y: currentY, size: 13, font: sarabunFont });
    }

    else if (docId === 'delivery') {
      let currentY = height - 80;
      const vendorName = data.vendor_info?.name || '................................................';
      const isHire = data.procurement_type === 'จ้าง';
      const deliveryTitle = isHire ? 'ใบส่งมอบงาน' : 'ใบส่งมอบพัสดุ';
      page.drawText(deliveryTitle, { x: width / 2 - (sarabunBold.widthOfTextAtSize(deliveryTitle, 18)/2), y: currentY, size: 18, font: sarabunBold });
      currentY -= 25;
      page.drawText(`เขียนที่: ${vendorName}`, { x: width - 250, y: currentY, size: 14, font: sarabunFont });
      currentY -= 18;
      page.drawText(`วันที่: ${formatThaiDateFull(data.delivery_date || data.order_date)}`, { x: width - 250, y: currentY, size: 14, font: sarabunFont });
      currentY -= 25;
      
      page.drawText(`เรื่อง  ส่งมอบ${isHire ? 'งาน' : 'พัสดุ'}`, { x: 50, y: currentY, size: 15, font: sarabunBold });
      currentY -= 20;
      page.drawText('เรียน  ผู้อำนวยการโรงเรียนบ้านควนโคกยา', { x: 50, y: currentY, size: 15, font: sarabunFont });
      currentY -= 25;
      
      const introText = `ตามที่ โรงเรียนบ้านควนโคกยา ได้มีใบสั่ง${isHire ? 'จ้าง' : 'ซื้อ'} เลขที่ ${toThaiNumerals(data.po_number || '...../.....')} ลงวันที่ ${formatThaiDateFull(data.po_date || data.order_date)} ตกลงให้ ${vendorName} ${isHire ? 'จัดทำ' : 'จัดหา'} ${data.project_name} เป็นเงินทั้งสิ้น ${toThaiNumerals(Number(data.total_amount).toLocaleString())} บาท นั้น`;
      const introLines = wrapThaiText(introText, contentWidth, sarabunFont, 15);
      let isFirst = true;
      for (const line of introLines) {
        page.drawText(line.trim(), { x: isFirst ? 90 : 50, y: currentY, size: 15, font: sarabunFont });
        currentY -= lineSpacing;
        isFirst = false;
      }
      currentY -= 12;
      
      const vendorRef = isHire ? 'ผู้รับจ้าง' : 'ผู้ขาย';
      const bodyText = `บัดนี้ ${vendorRef} ได้ดำเนินการ${isHire ? 'จัดทำ' : 'จัดหา'}และส่งมอบสิ่งของดังกล่าวเสร็จสิ้นเรียบร้อยแล้ว ตรงตามเงื่อนไขรายละเอียดทุกประการ จึงเรียนมาเพื่อโปรดดำเนินการตรวจรับและเบิกจ่ายเงินงบประมาณให้กับ${vendorRef}ต่อไป`;
      const bodyLines = wrapThaiText(bodyText, contentWidth, sarabunFont, 15);
      isFirst = true;
      for (const line of bodyLines) {
        page.drawText(line.trim(), { x: isFirst ? 90 : 50, y: currentY, size: 15, font: sarabunFont });
        currentY -= lineSpacing;
        isFirst = false;
      }
      
      currentY -= 35;
      if (currentY < 120) { page = pdfDoc.addPage([595.28, 841.89]); currentY = height - margin; }
      page.drawText('ลงชื่อ................................................ผู้ส่งมอบ', { x: width - 250, y: currentY, size: 15, font: sarabunFont });
      currentY -= 18;
      page.drawText(`(${vendorName})`, { x: width - 225, y: currentY, size: 15, font: sarabunFont });
    }

    else if (docId === 'inspection') {
      page.drawImage(garudaImage, { x: 50, y: height - 60, width: 40, height: 40 });
      page.drawText('ใบตรวจรับพัสดุ', { x: width / 2 - 35, y: height - 52, size: 20, font: sarabunBold });
      let currentY = height - 80;
      page.drawText('เขียนที่ โรงเรียนบ้านควนโคกยา', { x: width - 220, y: currentY, size: 14, font: sarabunFont });
      currentY -= 18;
      page.drawText(`วันที่: ${formatThaiDateFull(data.inspection_date || data.order_date)}`, { x: width - 220, y: currentY, size: 14, font: sarabunFont });
      currentY -= 25;
      
      const isHire = data.procurement_type === 'จ้าง';
      const vendorName = data.vendor_info?.name || '................................................';
      const vendorRef = isHire ? 'ผู้รับจ้าง' : 'ผู้ขาย';
      const introText = `ตามที่ โรงเรียนบ้านควนโคกยา ได้ตกลงจัด${isHire ? 'จ้าง' : 'ซื้อ'} ${data.project_name} จาก${vendorRef}คือ ${vendorName} ตามใบสั่ง${isHire ? 'จ้าง' : 'ซื้อ'} เลขที่ ${toThaiNumerals(data.po_number || '...../.....')} ลงวันที่ ${formatThaiDateFull(data.po_date || data.order_date)} เป็นเงินทั้งสิ้น ${toThaiNumerals(Number(data.total_amount).toLocaleString())} บาท นั้น`;
      const introLines = wrapThaiText(introText, contentWidth, sarabunFont, 15);
      let isFirst = true;
      for (const line of introLines) {
        page.drawText(line.trim(), { x: isFirst ? 90 : 50, y: currentY, size: 15, font: sarabunFont });
        currentY -= lineSpacing;
        isFirst = false;
      }
      currentY -= 12;
      
      const bodyText = `บัดนี้ คณะกรรมการตรวจรับพัสดุได้ดำเนินการตรวจรับของแล้ว ปรากฏว่า ผลการตรวจรับสิ่งของถูกต้องครบถ้วนสมบูรณ์ตามรายละเอียดและตรงตามเวลาสัญญาที่ตกลงไว้ทุกประการ และเจ้าหน้าที่พัสดุได้รับมอบพัสดุดังกล่าวเข้าคลังโรงเรียนเรียบร้อยแล้ว`;
      const bodyLines = wrapThaiText(bodyText, contentWidth, sarabunFont, 15);
      isFirst = true;
      for (const line of bodyLines) {
        page.drawText(line.trim(), { x: isFirst ? 90 : 50, y: currentY, size: 15, font: sarabunFont });
        currentY -= lineSpacing;
        isFirst = false;
      }
      currentY -= 10;
      page.drawText('จึงทำใบตรวจรับนี้ไว้เพื่อเสนอรายงานต่อไป', { x: 90, y: currentY, size: 15, font: sarabunFont });
      
      currentY -= 22;
      const memberCount = (data.committees || []).length;
      page.drawText('คณะกรรมการตรวจรับพัสดุ / ผู้ตรวจรับพัสดุ:', { x: 50, y: currentY, size: 15, font: sarabunBold });
      currentY -= 18;
      
      data.committees.forEach((c: any, idx: number) => {
        if (currentY < 100) { page = pdfDoc.addPage([595.28, 841.89]); currentY = height - margin; }
        page.drawText(`ลงชื่อ................................................${idx === 0 && memberCount >= 3 ? 'ประธานกรรมการ' : 'กรรมการ'}`, { x: 70, y: currentY, size: 15, font: sarabunFont });
        currentY -= 15;
        page.drawText(`(${c.name})`, { x: 95, y: currentY, size: 15, font: sarabunFont });
        currentY -= 18;
      });
      
      if (currentY < 120) { page = pdfDoc.addPage([595.28, 841.89]); currentY = height - margin; }
      currentY -= 8;
      page.drawText('ได้รับมอบพัสดุตามใบตรวจรับนี้ไว้ถูกต้องแล้ว', { x: 50, y: currentY, size: 13, font: sarabunBold });
      currentY -= 18;
      page.drawText('ลงชื่อ................................................เจ้าหน้าที่พัสดุผู้รับของ', { x: 50, y: currentY, size: 15, font: sarabunFont });
      currentY -= 15;
      page.drawText(`(${data.officerName || '................................................'})`, { x: 75, y: currentY, size: 15, font: sarabunFont });
    }

    else if (docId === 'report_inspection') {
      page.drawImage(garudaImage, { x: 50, y: height - 55, width: 35, height: 35 });
      page.drawText('บันทึกข้อความ', { x: width / 2 - 45, y: height - 48, size: 24, font: sarabunBold });
      let currentY = height - 80;
      page.drawText('ส่วนราชการ', { x: 50, y: currentY, size: 15, font: sarabunBold });
      page.drawText(`โรงเรียนบ้านควนโคกยา (งานพัสดุ)`, { x: 110, y: currentY, size: 15, font: sarabunFont });
      for (let i = 265; i < width - margin; i += 5) { page.drawText('.', { x: i, y: currentY, size: 10, font: sarabunFont, color: rgb(0.7,0.7,0.7) }); }
      currentY -= 18;
      page.drawText('ที่', { x: 50, y: currentY, size: 15, font: sarabunBold });
      page.drawText(toThaiNumerals(data.doc_number || '-'), { x: 65, y: currentY, size: 15, font: sarabunFont });
      for (let i = 80; i < width / 2 - 20; i += 5) { page.drawText('.', { x: i, y: currentY, size: 10, font: sarabunFont, color: rgb(0.7,0.7,0.7) }); }
      page.drawText('วันที่', { x: width / 2, y: currentY, size: 15, font: sarabunBold });
      page.drawText(formatThaiDateFull(data.inspection_date || data.order_date), { x: width / 2 + 30, y: currentY, size: 15, font: sarabunFont });
      for (let i = width / 2 + 100; i < width - margin; i += 5) { page.drawText('.', { x: i, y: currentY, size: 10, font: sarabunFont, color: rgb(0.7,0.7,0.7) }); }
      currentY -= 18;
      page.drawText('เรื่อง', { x: 50, y: currentY, size: 15, font: sarabunBold });
      page.drawText(`รายงานผลการตรวจรับพัสดุและขออนุมัติเบิกจ่ายเงิน`, { x: 85, y: currentY, size: 15, font: sarabunFont });
      for (let i = 85 + sarabunFont.widthOfTextAtSize(`รายงานผลการตรวจรับพัสดุและขออนุมัติเบิกจ่ายเงิน`, 15); i < width - margin; i += 5) { page.drawText('.', { x: i, y: currentY, size: 10, font: sarabunFont, color: rgb(0.7,0.7,0.7) }); }
      currentY -= 22;
      page.drawText('เรียน  ผู้อำนวยการโรงเรียนบ้านควนโคกยา', { x: 50, y: currentY, size: 15, font: sarabunFont });
      currentY -= 25;
      
      const isHire = data.procurement_type === 'จ้าง';
      const vendorRef = isHire ? 'ผู้รับจ้าง' : 'ผู้ขาย';
      const vendorName = data.vendor_info?.name || '................................................';
      const totalAmountVal = Number(data.total_amount) || 0;
      const amountThai = toThaiNumerals(totalAmountVal.toLocaleString());
      
      const line1 = `ตามที่ โรงเรียนบ้านควนโคกยา ได้อนุมัติให้จัด${isHire ? 'จ้าง' : 'ซื้อ'} ${data.project_name} จาก${vendorRef}คือ ${vendorName} เป็นเงินทั้งสิ้น ${amountThai} บาท และได้จัดตั้งคณะกรรมการตรวจรับพัสดุไปแล้วนั้น`;
      const line1Wrapped = wrapThaiText(line1, contentWidth - 35, sarabunFont, 15);
      let isFirstLine = true;
      for (const l of line1Wrapped) {
        page.drawText(l.trim(), { x: isFirstLine ? 90 : 50, y: currentY, size: 15, font: sarabunFont });
        currentY -= lineSpacing;
        isFirstLine = false;
      }
      currentY -= 8;
      
      const line2 = `บัดนี้ คณะกรรมการตรวจรับพัสดุได้ทำการตรวจรับพัสดุดังกล่าวเรียบร้อยแล้ว ในวันที่ ${formatThaiDateFull(data.inspection_date || data.order_date)} ปรากฏว่าถูกต้องครบถ้วนตามเงื่อนไขสัญญาไม่มีข้อชำรุดบกพร่องใดๆ เห็นควรเบิกจ่ายเงินงบประมาณให้กับ${vendorRef}จำนวนดังกล่าวต่อไป`;
      const line2Wrapped = wrapThaiText(line2, contentWidth - 35, sarabunFont, 15);
      isFirstLine = true;
      for (const l of line2Wrapped) {
        page.drawText(l.trim(), { x: isFirstLine ? 90 : 50, y: currentY, size: 15, font: sarabunFont });
        currentY -= lineSpacing;
        isFirstLine = false;
      }
      
      currentY -= 10;
      page.drawText('จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติเบิกจ่ายเงินต่อไป', { x: 90, y: currentY, size: 15, font: sarabunFont });
      
      if (currentY < 150) { page = pdfDoc.addPage([595.28, 841.89]); currentY = height - margin; }
      currentY -= 30;
      page.drawText('ลงชื่อ................................................เจ้าหน้าที่', { x: 50, y: currentY, size: 15, font: sarabunFont });
      page.drawText('ลงชื่อ................................................หัวหน้าเจ้าหน้าที่', { x: width - 250, y: currentY, size: 15, font: sarabunFont });
      currentY -= 16;
      page.drawText(`(${data.officerName || '................................................'})`, { x: 75, y: currentY, size: 15, font: sarabunFont });
      page.drawText(`(${data.headOfficerName || '................................................'})`, { x: width - 225, y: currentY, size: 15, font: sarabunFont });
      
      currentY -= 30;
      page.drawText(`คำอนุมัติ:  ( / ) อนุมัติเบิกจ่ายเงินตามเสนอ ณ วันที่ ${formatThaiDateFull(data.payment_approval_date || data.order_date)}`, { x: width / 2 - 120, y: currentY, size: 15, font: sarabunBold });
      currentY -= 30;
      page.drawText('ลงชื่อ................................................................', { x: width / 2 - 80, y: currentY, size: 15, font: sarabunFont });
      currentY -= 16;
      page.drawText(`(${data.directorName})`, { x: width / 2 - 70, y: currentY, size: 15, font: sarabunFont });
      page.drawText('ผู้อำนวยการโรงเรียนบ้านควนโคกยา', { x: width / 2 - 75, y: currentY - 16, size: 15, font: sarabunFont });
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
