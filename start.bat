@echo off
echo =====================================================================
echo  Starting AeroCast UK (Backend + Frontend)
echo =====================================================================

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python not found on PATH. Attempting Anaconda Python...
    if exist "C:\Users\divya\anaconda3\python.exe" (
        set PYTHON_CMD="C:\Users\divya\anaconda3\python.exe"
    ) else (
        echo Error: Python not found. Please install Python 3.10+
        pause
        exit /b 1
    )
) else (
    set PYTHON_CMD=python
)

echo Starting FastAPI server at http://localhost:8000 ...
cd backend
%PYTHON_CMD% -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
