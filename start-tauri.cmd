@echo off
setlocal
cd /d "%~dp0SkillDemo" || exit /b 1
if not exist "node_modules\@m969\game-skillflow\src\index.js" (
    echo SkillFlow dependency is missing. Installing npm dependencies...
    call npm install
    if errorlevel 1 exit /b 1
)
call npm run tauri:dev
