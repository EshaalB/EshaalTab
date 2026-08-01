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
  "  $destPath = Join-Path (Get-Location) $dest;" ^
  "  if (Test-Path $destPath) { Remove-Item $destPath -Force };" ^
  "  Add-Type -AssemblyName 'System.IO.Compression';" ^
  "  Add-Type -AssemblyName 'System.IO.Compression.FileSystem';" ^
  "  $zipStream = [System.IO.File]::Open($destPath, [System.IO.FileMode]::Create);" ^
  "  $archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create);" ^
  "  $rootDir = (Get-Location).Path;" ^
  "  $excludePatterns = @('.git', '.github', '.claude', '.gitignore', 'node_modules', 'dev', '*.zip', 'build-zip.bat', '*.md');" ^
  "  Get-ChildItem -Path $rootDir -Recurse -File | ForEach-Object {" ^
  "    $file = $_;" ^
  "    $relPath = $file.FullName.Substring($rootDir.Length + 1).Replace('\', '/');" ^
  "    $skip = $false;" ^
  "    foreach ($pat in $excludePatterns) {" ^
  "      if ($relPath -like $pat -or $relPath -like ('*/' + $pat) -or $file.Name -like $pat) { $skip = $true; break; }" ^
  "    }" ^
  "    if (-not $skip) {" ^
  "      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relPath) | Out-Null;" ^
  "    }" ^
  "  };" ^
  "  $archive.Dispose();" ^
  "  $zipStream.Dispose();" ^
  "  Write-Host ('Successfully built ' + $dest + ' with POSIX forward-slashes for Firefox & Chrome (version ' + $ver + ')');" ^
  "}"
endlocal
