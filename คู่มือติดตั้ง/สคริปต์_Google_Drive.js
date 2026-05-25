/**
 * Google Apps Script (GAS) Web App Code
 * สำหรับระบบบริหารจัดการข้อมูลโรงเรียน (School Admin System)
 * ใช้สำหรับบันทึกไฟล์สแกนหนังสือราชการเข้าสู่ Google Drive ของโรงเรียน และตั้งสิทธิ์แชร์ให้อ่านได้อัตโนมัติ
 */

function doPost(e) {
  try {
    // 1. แปลงข้อมูล JSON ที่ส่งมาจากแอปพลิเคชัน
    var data = JSON.parse(e.postData.contents);
    
    // --- กรณีสั่ง ลบไฟล์ (Delete Action) ---
    if (data.action === 'delete') {
      var fileId = data.fileId;
      if (!fileId) {
        return createJsonResponse({
          status: 'error',
          message: 'กรุณาระบุ fileId ที่ต้องการลบ'
        });
      }
      
      var file = DriveApp.getFileById(fileId);
      file.setTrashed(true); // ย้ายลงถังขยะ
      
      return createJsonResponse({
        status: 'success',
        message: 'ย้ายไฟล์ลงถังขยะเรียบร้อยแล้ว'
      });
    }
    
    // --- กรณีสั่ง อัปโหลดไฟล์ (Upload Action) ---
    var base64Data = data.base64;
    var filename = data.filename;
    var mimeType = data.mimeType;
    var folderName = data.folder || 'SchoolAdminDocs'; // ชื่อโฟลเดอร์ปลายทาง
    
    if (!base64Data || !filename || !mimeType) {
      return createJsonResponse({
        status: 'error',
        message: 'ข้อมูลไม่ครบถ้วน (ต้องการ base64, filename, mimeType)'
      });
    }
    
    // 2. ถอดรหัสไฟล์จาก Base64 เป็น Binary Blob
    var decoded = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decoded, mimeType, filename);
    
    // 3. ค้นหาหรือสร้างโฟลเดอร์ใน Google Drive ของโรงเรียน
    var folders = DriveApp.getFoldersByName(folderName);
    var folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    
    // 4. บันทึกไฟล์ลงในโฟลเดอร์ และตั้งสิทธิ์แชร์ "ทุกคนที่มีลิงก์สามารถอ่านได้" (สำหรับเปิด PDF และส่งไลน์)
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // 5. ส่งลิงก์ไฟล์กลับไปยังแอป
    var fileUrl = file.getUrl();
    
    return createJsonResponse({
      status: 'success',
      url: fileUrl,
      fileId: file.getId()
    });
    
  } catch (error) {
    return createJsonResponse({
      status: 'error',
      message: 'GAS Error: ' + error.toString()
    });
  }
}

// ฟังก์ชันสร้างตัวตอบกลับ JSON ของ Google Apps Script
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
