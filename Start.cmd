@echo off
cd /d "%~dp0"
start "" "http://localhost:3000"
node --env-file=.env server.mjs
pause
