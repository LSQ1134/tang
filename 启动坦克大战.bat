@echo off
setlocal
cd /d "%~dp0"
start "坦克大战服务器" /min py -m http.server 8000
timeout /t 1 /nobreak >nul
start "坦克大战" "http://127.0.0.1:8000/index.html"
endlocal
