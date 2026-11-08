@echo off
title FRAMALY Studio
cd /d "%~dp0"
echo.
echo   FRAMALY Studio - http://localhost:5577
echo   Deja esta ventana abierta mientras usas la app.
echo.
start "" http://localhost:5577
where python >nul 2>nul && (python -m http.server 5577 & goto :eof)
where py >nul 2>nul && (py -m http.server 5577 & goto :eof)
where npx >nul 2>nul && (npx --yes http-server -p 5577 -c-1 & goto :eof)
echo No se encontro Python ni Node. Abre index.html directamente en Chrome.
pause
