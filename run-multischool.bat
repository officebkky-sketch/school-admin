@echo off
title School Admin Multischool Runner
echo ==========================================
echo   [School Admin] Clearing old processes...
echo ==========================================
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM electron.exe >nul 2>&1

echo ==========================================
echo   [School Admin] Starting application...
echo ==========================================
cd /d "C:\Users\bkky9\OneDrive\Desktop\school-admin-multischool"
npm run start
pause
