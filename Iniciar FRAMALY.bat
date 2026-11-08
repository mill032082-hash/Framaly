@echo off
title FRAMALY Studio
cd /d "%~dp0"
set "IP="
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1).IPAddress"`) do set "IP=%%i"
echo.
echo   FRAMALY Studio
echo   ----------------------------------------------
echo   En este PC:      http://localhost:5577
if defined IP echo   En tu celular:   http://%IP%:5577   (misma red Wi-Fi)
echo   ----------------------------------------------
echo   Deja esta ventana abierta mientras usas la app.
echo   Si Windows pregunta por el firewall, pulsa "Permitir acceso".
echo.
start "" http://localhost:5577
where python >nul 2>nul && (python -m http.server 5577 & goto :eof)
where py >nul 2>nul && (py -m http.server 5577 & goto :eof)
where npx >nul 2>nul && (npx --yes http-server -p 5577 -c-1 & goto :eof)
echo No se encontro Python ni Node. Abre index.html directamente en Chrome.
pause
