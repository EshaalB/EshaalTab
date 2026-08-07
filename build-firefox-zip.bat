@echo off
setlocal
cd /d "%~dp0"

set "RELEASE_DIR=release-zips"
set "DEST=EshaalTab-Firefox-v2.0.82.zip"
if not exist "%RELEASE_DIR%" mkdir "%RELEASE_DIR%"
del /q "%RELEASE_DIR%\EshaalTab-Firefox-v*.zip" >nul 2>&1

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "$rootDir = (Get-Location).Path;" ^
  "$destPath = Join-Path (Join-Path $rootDir '%RELEASE_DIR%') '%DEST%';" ^
  "if (Test-Path $destPath) { Remove-Item $destPath -Force };" ^
  "Add-Type -AssemblyName 'System.IO.Compression';" ^
  "Add-Type -AssemblyName 'System.IO.Compression.FileSystem';" ^
  "$zipStream = [System.IO.File]::Open($destPath, [System.IO.FileMode]::Create);" ^
  "$archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create);" ^
  "[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $rootDir 'manifest.firefox.json'), 'manifest.json') | Out-Null;" ^
  "$excludeDirs = @('.git', '.github', '.claude', '.impeccable', '.vscode', 'node_modules', 'dev', 'release-zips');" ^
  "$excludeFiles = @('.gitignore', '.DS_Store', 'Thumbs.db', 'manifest.json', 'manifest.firefox.json', 'build-zip.bat', 'build-firefox-zip.bat');" ^
  "$shipped = 1;" ^
  "Get-ChildItem -Path $rootDir -Recurse -File | ForEach-Object {" ^
  "  $file = $_; $relPath = $file.FullName.Substring($rootDir.Length + 1).Replace('\', '/');" ^
  "  $segments = $relPath -split '/'; $skip = $false;" ^
  "  foreach ($d in $excludeDirs) { if ($segments -contains $d) { $skip = $true; break } };" ^
  "  if (-not $skip) { foreach ($f in $excludeFiles) { if ($file.Name -eq $f) { $skip = $true; break } } };" ^
  "  if (-not $skip -and ($file.Name -like '*.zip' -or $file.Name -like '*.md')) { $skip = $true };" ^
  "  if (-not $skip) { [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relPath) | Out-Null; $shipped++ };" ^
  "};" ^
  "$archive.Dispose(); $zipStream.Dispose();" ^
  "Write-Host ('Successfully built %DEST% -- ' + $shipped + ' files packaged');"

endlocal
