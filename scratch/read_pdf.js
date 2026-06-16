import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function run() {
  const pdfPath = 'C:\\Users\\bkky9\\Downloads\\ตัวอย่างแบบฟอร์มการสรรหาและเลือกคณะกรรมการสถานศึกษาขั้นพื้นฐาน.pdf';
  console.log('Loading PDF from:', pdfPath);
  
  try {
    const loadingTask = pdfjsLib.getDocument({
      url: pdfPath,
      useSystemFonts: true
    });
    const pdf = await loadingTask.promise;
    console.log(`Total Pages: ${pdf.numPages}`);
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map(item => item.str).join(' ');
      
      const hasSample = text.includes('ตัวอย่าง') || text.includes('ตั ว อ ย่ า ง');
      const sampleCount = (text.match(/ตัวอย่าง/g) || []).length + (text.match(/ตั ว อ ย่ า ง/g) || []).length;
      
      console.log(`Page ${i}: Length ${text.length} | Contains "ตัวอย่าง": ${hasSample} (${sampleCount} times)`);
      if (hasSample) {
        console.log(`  Snippet: ${text.substring(0, 200)}...`);
      }
    }
  } catch (err) {
    console.error('Error reading PDF:', err);
  }
}

run();
