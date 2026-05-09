@echo off
echo === Talony Herbaty - Start ===
where node >nul 2>&1 || (echo BLAD: Node.js nie jest zainstalowany! Pobierz z https://nodejs.org && pause && exit)
echo Uruchamiam serwer...
node server.js
pause
