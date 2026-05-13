import { app, BrowserWindow, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
    title: "ระบบบริหารจัดการข้อมูลโรงเรียน",
    icon: path.join(__dirname, 'public/logo.png')
  });

  // Hide default menu
  mainWindow.setMenu(null);

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  // เผื่อไว้ดีบักหน้าจอขาวในตัวติดตั้ง (ปิดไว้สำหรับเวอร์ชันเสถียร)
  // mainWindow.webContents.openDevTools();
}

// --- Auto Updater Logic ---
autoUpdater.autoDownload = false; // ปิดการโหลดอัตโนมัติ เพื่อขออนุญาตผู้ใช้ก่อน

autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'พบการอัปเดตใหม่',
    message: 'พบเวอร์ชันใหม่ของระบบบริหารจัดการข้อมูลโรงเรียน คุณต้องการดาวน์โหลดตอนนี้เลยหรือไม่?',
    buttons: ['ดาวน์โหลด', 'ไว้ทีหลัง']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.downloadUpdate();
    }
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'ดาวน์โหลดเสร็จสิ้น',
    message: 'ดาวน์โหลดเวอร์ชันใหม่เรียบร้อยแล้ว ระบบจะทำการติดตั้งและเริ่มแอปใหม่ทันที',
    buttons: ['ตกลง']
  }).then(() => {
    autoUpdater.quitAndInstall();
  });
});

autoUpdater.on('error', (error) => {
  console.error('Update error:', error);
});

app.whenReady().then(() => {
  createWindow();

  // ตรวจสอบการอัปเดตเมื่อแอปเริ่มทำงาน (เฉพาะตอนที่เป็นแอปที่ติดตั้งแล้ว)
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
