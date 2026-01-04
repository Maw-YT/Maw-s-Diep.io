@echo off

:: Open ngrok in a new cmd window to avoid npm never running..
start "TempSite" cmd /k "@echo off && ngrok http 4040"

:: Wait a second for ngrok to start
timeout /t 2 /nobreak > nul

:: Start the server
npm run server