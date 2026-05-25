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
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  // เผื่อไว้ดีบักหน้าจอขาวในตัวติดตั้ง (ปิดไว้สำหรับเวอร์ชันเสถียร)
  // mainWindow.webContents.openDevTools();
}

// --- Auto Updater Logic ---
autoUpdater.autoDownload = true; // ให้โหลดอัตโนมัติแล้วเราค่อยแสดง Progress ใน UI

autoUpdater.on('checking-for-update', () => {
  mainWindow?.webContents.send('update-status', { type: 'checking', message: 'กำลังตรวจสอบเวอร์ชันใหม่...' });
});

autoUpdater.on('update-available', (info) => {
  mainWindow?.webContents.send('update-status', { 
    type: 'available', 
    version: info.version,
    message: `พบเวอร์ชันใหม่ ${info.version} กำลังเริ่มดาวน์โหลด...` 
  });
});

autoUpdater.on('update-not-available', () => {
  mainWindow?.webContents.send('update-status', { type: 'not-available', message: 'คุณใช้เวอร์ชันล่าสุดแล้ว' });
});

autoUpdater.on('download-progress', (progressObj) => {
  mainWindow?.webContents.send('update-progress', {
    percent: progressObj.percent,
    bytesPerSecond: progressObj.bytesPerSecond,
    transferred: progressObj.transferred,
    total: progressObj.total
  });
});

autoUpdater.on('update-downloaded', (info) => {
  mainWindow?.webContents.send('update-status', { 
    type: 'downloaded', 
    version: info.version,
    message: 'ดาวน์โหลดเสร็จแล้ว พร้อมติดตั้ง' 
  });
});

autoUpdater.on('error', (err) => {
  mainWindow?.webContents.send('update-status', { type: 'error', message: 'เกิดข้อผิดพลาดในการอัปเดต: ' + err.message });
});

// รับคำสั่งจาก UI เพื่อสั่ง Restart และติดตั้ง
import { ipcMain } from 'electron';
ipcMain.on('restart-app', () => {
  autoUpdater.quitAndInstall();
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
