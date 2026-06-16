@echo off
title School Admin Release Publisher
echo ==========================================================
echo   [School Admin] Preparing to Publish v1.1.12 to GitHub...
echo ==========================================================
cd /d "C:\Users\bkky9\OneDrive\Desktop\school-admin-multischool"

echo [1/3] Terminating any frozen git/node processes...
taskkill /F /IM git.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM electron.exe >nul 2>&1
del /f .git\index.lock >nul 2>&1

echo.
echo [2/3] Pushing latest code commits to GitHub (multischool)...
echo ==========================================================
git push origin multischool

echo.
echo [3/3] Packaging & Publishing Setup v1.1.12 to GitHub Releases...
echo ==========================================================
echo * Note: This will build and upload assets (*.exe, *.blockmap, latest.yml)
echo * If Windows prompts for GitHub login, please sign in to grant access.
call npm run build
npx electron-builder --publish always

echo.
echo ==========================================================
echo   [School Admin] Publish process completed!
echo ==========================================================
pause
