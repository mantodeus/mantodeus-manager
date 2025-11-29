@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0generate_ec2_credentials.ps1"
pause

