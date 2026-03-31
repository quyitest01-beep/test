@echo off
cd /d D:\cursor
echo Splitting test folder...
for /f %%i in ('git subtree split --prefix=test') do set SPLIT_SHA=%%i
echo Split SHA: %SPLIT_SHA%
echo Pushing to GitHub...
git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push test-repo %SPLIT_SHA%:main --force
echo Done!
pause
