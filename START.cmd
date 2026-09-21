@echo off
cd /d "%~dp0"
where dotnet >nul 2>nul
if %errorlevel% equ 0 (
  dotnet run --project MelodyGarden.csproj
) else (
  echo Install the .NET 10 SDK from https://dotnet.microsoft.com/download
  echo Then open a new terminal and run this file again.
)
pause
