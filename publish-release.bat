@echo off
title School Admin Release Publisher
echo ==========================================================
echo   [School Admin] Preparing to Publish v1.1.17 to GitHub...
echo ==========================================================
cd /d "C:\Users\bkky9\OneDrive\Desktop\school-admin-multischool"

echo.
echo [1/2] Pushing latest code commits to GitHub (multischool)...
echo ==========================================================
git push origin multischool

echo.
echo [2/2] Packaging & Publishing Setup v1.1.17 to GitHub Releases...
echo ==========================================================
echo * Note: This will build and upload assets (*.exe, *.blockmap, latest.yml)
echo * If Windows prompts for GitHub login, please sign in to grant access.
call npm run build
call npx electron-builder --publish always

echo.
echo ==========================================================
echo   [School Admin] Publish process completed!
echo ==========================================================
pause
