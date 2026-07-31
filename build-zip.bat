@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "NAME=EshaalTab"

REM --- delete old zips ---
del /q "%NAME%-v*.zip" >nul 2>&1

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$path = 'manifest.json';" ^
  "$raw = Get-Content $path -Raw -Encoding UTF8;" ^
  "if ($raw -match '\"version\"\s*:\s*\"(\d+)\.(\d+)\.(\d+)\"') {" ^
  "  $ver = '{0}.{1}.{2}' -f $Matches[1], $Matches[2], ([int]$Matches[3] + 1);" ^
  "  $out = [Regex]::Replace($raw, '(\"version\"\s*:\s*\")\d+\.\d+\.\d+(\")', ('${1}' + $ver + '${2}'), 1);" ^
  "  [IO.File]::WriteAllText($path, $out, [Text.UTF8Encoding]::new($false));" ^
  "  $dest = '%NAME%-v' + $ver + '.zip';" ^
  "  if (Test-Path $dest) { Remove-Item $dest -Force };" ^
  "  $exclude = @('.git','.github','.claude','.gitignore','node_modules','dev', $dest, '*.zip', 'build-zip.bat','*.md');" ^
  "  $items = Get-ChildItem -Force | Where-Object { $ex = $_.Name; -not ($exclude | Where-Object { $ex -like $_ }) };" ^
  "  Compress-Archive -Path $items.FullName -DestinationPath $dest -Force;" ^
  "  Write-Host ('Successfully built ' + $dest + ' (version ' + $ver + ')');" ^
  "}"
endlocal
