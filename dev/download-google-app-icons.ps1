$ErrorActionPreference = 'Stop'

$source = Get-Content 'js/ui/workspace-tasks.js' -Raw -Encoding UTF8
$block = [regex]::Match($source, 'const APPS = \[(?<body>[\s\S]*?)\n  \];').Groups['body'].Value
$matches = [regex]::Matches($block, "\['(?<name>[^']+)',\s*'(?<url>https://[^']+)'\]")
$iconBlock = [regex]::Match($source, 'const APP_ICONS = \{(?<body>[\s\S]*?)\n  \};').Groups['body'].Value
$iconMatches = [regex]::Matches($iconBlock, "'(?<name>[^']+)':\s*'(?<url>https://[^']+)'" )
$originals = @{}
foreach ($iconMatch in $iconMatches) { $originals[$iconMatch.Groups['name'].Value] = $iconMatch.Groups['url'].Value }
$destination = Join-Path (Get-Location) 'icons\google-apps'
New-Item -ItemType Directory -Path $destination -Force | Out-Null

foreach ($match in $matches) {
  $name = $match.Groups['name'].Value
  $appUrl = $match.Groups['url'].Value
  $slug = ($name.ToLowerInvariant() -replace '[^a-z0-9]+', '-').Trim('-')
  $target = Join-Path $destination ($slug + '.png')
  $url = $originals[$name]
  if ($url) {
    try { Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $target -ErrorAction Stop }
    catch { $url = $null }
  }
  if (-not $url) {
    $faviconUrl = 'https://www.google.com/s2/favicons?domain_url=' + [uri]::EscapeDataString($appUrl) + '&sz=128'
    Invoke-WebRequest -UseBasicParsing -Uri $faviconUrl -OutFile $target
  }
  Write-Host ($name + ' -> ' + (Split-Path $target -Leaf))
}
