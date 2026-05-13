import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export async function generateProcurementDoc(data: any) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  
  // Load Thai Font (Assuming it's available in public/fonts)
  const fontUrl = '/fonts/THSarabunNew.ttf';
  const fontBytes = await fetch(fontUrl).then(res => res.arrayBuffer());
  const customFont = await pdfDoc.embedFont(fontBytes);

  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  page.drawText('บันทึกข้อความ', {
    x: width / 2 - 50,
    y: height - 50,
    size: 24,
    font: customFont,
    color: rgb(0, 0, 0),
  });

  page.drawText(`ส่วนราชการ: ${data.schoolName || 'โรงเรียนบ้านควนโคกยา'}`, { x: 50, y: height - 100, size: 16, font: customFont });
  page.drawText(`ที่: ${data.docNumber || '-'}`, { x: 50, y: height - 120, size: 16, font: customFont });
  page.drawText(`เรื่อง: ขออนุมัติซื้อ/จ้าง...`, { x: 50, y: height - 140, size: 16, font: customFont });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
}
