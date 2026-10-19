@echo off
setlocal enabledelayedexpansion
set FAIL=0
for %%f in ("%~dp0*.test.mjs") do (
  echo === Running %%~nxf ===
  node "%%~ff"
  if errorlevel 1 set FAIL=1
)
if !FAIL! neq 0 (
  echo.
  echo SOME TESTS FAILED
  exit /b 1
)
echo.
echo ALL TESTS PASSED
exit /b 0
