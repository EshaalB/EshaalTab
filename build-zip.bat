@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "NAME=EshaalTab"
set "RELEASE_DIR=release-zips"
if not exist "%RELEASE_DIR%" mkdir "%RELEASE_DIR%"

REM --- delete old zips ---
del /q "%NAME%-v*.zip" >nul 2>&1
del /q "%RELEASE_DIR%\%NAME%-v*.zip" >nul 2>&1

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$path = 'manifest.json';" ^
  "$raw = Get-Content $path -Raw -Encoding UTF8;" ^
  "if ($raw -match '\"version\"\s*:\s*\"(\d+)\.(\d+)\.(\d+)\"') {" ^
  "  $ver = '{0}.{1}.{2}' -f $Matches[1], $Matches[2], ([int]$Matches[3] + 1);" ^
  "  $out = [Regex]::Replace($raw, '(\"version\"\s*:\s*\")\d+\.\d+\.\d+(\")', ('${1}' + $ver + '${2}'), 1);" ^
  "  [IO.File]::WriteAllText($path, $out, [Text.UTF8Encoding]::new($false));" ^
  "  $dest = '%NAME%-v' + $ver + '.zip';" ^
  "  $destPath = Join-Path (Join-Path (Get-Location) '%RELEASE_DIR%') $dest;" ^
  "  if (Test-Path $destPath) { Remove-Item $destPath -Force };" ^
  "  Add-Type -AssemblyName 'System.IO.Compression';" ^
  "  Add-Type -AssemblyName 'System.IO.Compression.FileSystem';" ^
  "  $zipStream = [System.IO.File]::Open($destPath, [System.IO.FileMode]::Create);" ^
  "  $archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create);" ^
  "  $rootDir = (Get-Location).Path;" ^
  "  $excludeDirs = @('.git', '.github', '.claude', '.impeccable', '.vscode', 'node_modules', 'dev', 'release-zips');" ^
  "  $excludeFiles = @('.gitignore', '.DS_Store', 'Thumbs.db', 'build-zip.bat', 'build-firefox-zip.bat', 'manifest.firefox.json');" ^
  "  $excludeGlobs = @('*.zip', '*.md');" ^
  "  $shipped = 0; $skipped = 0;" ^
  "  Get-ChildItem -Path $rootDir -Recurse -File | ForEach-Object {" ^
  "    $file = $_;" ^
  "    $relPath = $file.FullName.Substring($rootDir.Length + 1).Replace('\', '/');" ^
  "    $segments = $relPath -split '/';" ^
  "    $skip = $false;" ^
  "    foreach ($d in $excludeDirs) { if ($segments -contains $d) { $skip = $true; break } };" ^
  "    if (-not $skip) { foreach ($f in $excludeFiles) { if ($file.Name -eq $f) { $skip = $true; break } } };" ^
  "    if (-not $skip) { foreach ($g in $excludeGlobs) { if ($file.Name -like $g) { $skip = $true; break } } };" ^
  "    if ($skip) { $skipped++ } else {" ^
  "      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relPath) | Out-Null;" ^
  "      $shipped++;" ^
  "    }" ^
  "  };" ^
  "  $archive.Dispose();" ^
  "  $zipStream.Dispose();" ^
  "  Write-Host ('Successfully built ' + $dest + ' -- ' + $shipped + ' files packaged, ' + $skipped + ' dev/meta files excluded (version ' + $ver + ')');" ^
  "}"
endlocal
