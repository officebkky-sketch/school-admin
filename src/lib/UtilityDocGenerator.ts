
export const toThaiDigits = (num: string | number) => {
  const thaiDigits = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
  return num.toString().split('').map(d => isNaN(parseInt(d)) ? d : thaiDigits[parseInt(d)]).join('');
};

export const formatThaiDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

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

export function generateUtilityMemoHtml(data: any, settings: any, garudaUrl: string) {
  const typeMap: any = {
    'electricity': 'ค่าไฟฟ้า',
    'water': 'ค่าน้ำประปา',
    'telephone': 'ค่าโทรศัพท์',
    'internet': 'ค่าบริการอินเทอร์เน็ต'
  };

  const typeLabel = typeMap[data.type] || data.type;
  const thaiAmount = numToThaiBaht(data.amount);
  const reportDate = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

  // Detail text for multiple bills
  const billDetails = data.utility_items?.map((item: any, idx: number) => {
    let text = `ลำดับที่ ${toThaiDigits(idx + 1)} `;
    if (item.meter_number) text += `หมายเลขมิเตอร์ ${toThaiDigits(item.meter_number)} `;
    if (item.book_number) text += `เล่มที่ ${toThaiDigits(item.book_number)} `;
    if (item.receipt_number) text += `เลขที่ ${toThaiDigits(item.receipt_number)} `;
    if (item.units_used) text += `จำนวนหน่วยที่ใช้ ${toThaiDigits(item.units_used)} หน่วย `;
    text += `เป็นเงิน ${toThaiDigits(item.amount.toLocaleString(undefined, {minimumFractionDigits: 2}))} บาท`;
    return text;
  }).join('<br/>') || '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>บันทึกข้อความขออนุมัติเบิกจ่าย</title>
      <style>
        @font-face {
          font-family: 'THSarabunNew';
          src: url('/fonts/THSarabunNew.ttf') format('truetype');
        }
        body { font-family: 'THSarabunNew', sans-serif; font-size: 16pt; line-height: 1.1; padding: 1.5cm 2cm; color: black; }
        .header { position: relative; margin-bottom: 0.3cm; text-align: center; min-height: 1.2cm; }
        .garuda { width: 1.5cm; height: auto; position: absolute; left: 0; top: -0.1cm; }
        .title { font-size: 20pt; font-weight: bold; margin-bottom: 0; display: block; text-align: center; line-height: 1; }
        .info-row { display: flex; margin-bottom: 0.05cm; align-items: baseline; }
        .info-label { font-weight: bold; min-width: 1.5cm; }
        .content { margin-top: 0.5cm; text-align: justify; text-indent: 2.5cm; }
        .signature-section { margin-top: 2cm; margin-left: 50%; text-align: center; }
        .footer-note { margin-top: 2cm; }
        @media print {
          @page { size: A4 portrait; margin: 1.5cm 2cm; }
          .no-print { display: none !important; }
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="position: sticky; top: 0; background: white; padding: 10px; border-bottom: 1px solid #ddd; margin-bottom: 20px; display: flex; gap: 10px; align-items: center;">
        <button onclick="window.print()" style="padding: 10px 20px; background: #22c55e; color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: bold;">🖨️ สั่งพิมพ์เอกสาร</button>
        <span style="font-size: 14px; color: #666;">(ตรวจสอบความถูกต้องก่อนพิมพ์ - ระบบบังคับแนวตั้งอัตโนมัติ)</span>
      </div>
      
      <div class="header">
        <img src="${garudaUrl}" class="garuda" />
        <span class="title">บันทึกข้อความ</span>
      </div>

      <div class="info-row">
        <div class="info-label" style="width: 2.2cm;">ส่วนราชการ</div>
        <div style="flex: 1; border-bottom: 1px dotted #ccc;">${settings?.school_name || 'โรงเรียนบ้านควนโคกยา'}</div>
      </div>
      <div class="info-row">
        <div style="width: 50%; display: flex;">
          <div class="info-label" style="width: 1cm;">ที่</div>
          <div style="flex: 1; border-bottom: 1px dotted #ccc;">${settings?.office_code || '.........'}/.........</div>
        </div>
        <div style="flex: 1; display: flex;">
          <div class="info-label" style="width: 1.2cm; margin-left: 0.5cm;">วันที่</div>
          <div style="flex: 1; border-bottom: 1px dotted #ccc;">${toThaiDigits(reportDate)}</div>
        </div>
      </div>
      <div class="info-row">
        <div class="info-label" style="width: 1.2cm;">เรื่อง</div>
        <div style="flex: 1; border-bottom: 1px dotted #ccc;">ขออนุมัติเบิกจ่ายเงินค่าสาธารณูปโภค ประเภท ${typeLabel} ประจำเดือน ${data.month} ปีการศึกษา ${toThaiDigits(data.academic_year)}</div>
      </div>

      <div style="margin-top: 0.8cm; font-weight: bold;">เรียน ผู้อำนวยการ${settings?.school_name || 'โรงเรียนบ้านควนโคกยา'}</div>

      <div class="content">
        ด้วย${settings?.school_name || 'โรงเรียนบ้านควนโคกยา'} ได้รับแจ้งหนี้ค่าสาธารณูปโภค ประเภท ${typeLabel} ประจำเดือน ${data.month} ปีการศึกษา ${toThaiDigits(data.academic_year)} โดยมีรายละเอียด ดังนี้
      </div>

      <div style="margin-top: 0.3cm; margin-left: 2.5cm;">
        ${billDetails}
      </div>

      <div class="content" style="margin-top: 0.3cm;">
        รวมเป็นเงินค่าสาธารณูปโภคที่ขออนุมัติเบิกจ่ายในครั้งนี้ เป็นเงินทั้งสิ้น ${toThaiDigits(data.amount.toLocaleString(undefined, {minimumFractionDigits: 2}))} บาท (${thaiAmount}) เพื่อนำไปจ่ายให้แก่หน่วยงานที่เกี่ยวข้องต่อไป
      </div>

      <div class="content" style="margin-top: 0.5cm;">
        จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ
      </div>

      <div class="signature-section">
        <br/>
        ( ${data.requester_name || settings?.finance_head_name || '....................................................'} )<br/>
        ${data.requester_position || settings?.teacher_role || 'หัวหน้าฝ่ายงบประมาณ'}
      </div>

      <div class="footer-note" style="border-top: 1px solid transparent;">
        <p style="font-weight: bold;">คำสั่ง/ความเห็นของผู้อำนวยการโรงเรียน</p>
        <p>( &nbsp; ) อนุมัติ &nbsp;&nbsp;&nbsp;&nbsp; ( &nbsp; ) ไม่อนุมัติ เนื่องจาก ........................................................</p>
        <br/>
        <div style="margin-left: 50%; text-align: center;">
          <br/>
          ( ${settings?.director_name || '....................................................'} )<br/>
          ผู้อำนวยการ${settings?.school_name || 'โรงเรียนบ้านควนโคกยา'}
        </div>
      </div>

      <!-- Page 2: Receipt Attachment -->
      <div style="page-break-before: always; padding-top: 0.5cm;">
        <div class="header" style="margin-bottom: 0.5cm;">
          <img src="${garudaUrl}" class="garuda" />
          <span class="title">ใบปะหน้าเอกสารประกอบการเบิกจ่าย</span>
          <div style="text-align: center; font-weight: bold; font-size: 18pt; margin-top: 0;">
            (สำหรับติดใบเสร็จรับเงิน / ใบแจ้งหนี้)
          </div>
        </div>

        <div style="margin-top: 0.5cm; padding: 1cm; border: 1px solid #000; min-height: 15cm; position: relative;">
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.1; font-size: 40pt; font-weight: bold; width: 100%; text-align: center;">
            พื้นที่สำหรับติดใบเสร็จ
          </div>
          
          <div style="font-weight: bold; margin-bottom: 0.5cm;">รายละเอียดประกอบการเบิกจ่าย:</div>
          <div style="margin-left: 1cm; line-height: 1.5;">
            - ประเภท: ${typeLabel}<br/>
            - ประจำเดือน: ${data.month}<br/>
            - ปีการศึกษา: ${toThaiDigits(data.academic_year)}<br/>
            - จำนวนบิลรวม: ${toThaiDigits(data.utility_items?.length || 0)} ใบ<br/>
            - จำนวนหน่วยรวม: ${toThaiDigits(data.units_used || 0)} หน่วย<br/>
            - จำนวนเงินรวมทั้งสิ้น: ${toThaiDigits(data.amount.toLocaleString(undefined, {minimumFractionDigits: 2}))} บาท<br/>
            - ตัวอักษร: (${thaiAmount})
          </div>
        </div>

        <div style="margin-top: 1cm; display: flex; justify-content: flex-end;">
          <div style="text-align: center; width: 8cm;">
            ลงชื่อ..........................................................ผู้เบิก<br/>
            ( ${data.requester_name || settings?.finance_head_name || '..........................................................'} )<br/>
            วันที่........./........../..........
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}
