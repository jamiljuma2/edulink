param(
  [Parameter(Mandatory = $true)]
  [string]$ManifestUrl,

  [string]$ApplicationId = "com.edulinkwriters.twa",
  [string]$AppName = "EduLink Writers",
  [string]$LauncherName = "EduLink"
)

$ErrorActionPreference = "Stop"

$androidDir = Join-Path $PSScriptRoot "android"
$twaManifestPath = Join-Path $androidDir "twa-manifest.json"

Write-Host "Using manifest: $ManifestUrl"
Write-Host "Application ID: $ApplicationId"

try {
  $manifestResponse = Invoke-WebRequest -Uri $ManifestUrl -UseBasicParsing -Method GET
  if ($manifestResponse.StatusCode -lt 200 -or $manifestResponse.StatusCode -ge 300) {
    throw "Manifest URL returned status $($manifestResponse.StatusCode)."
  }

  try {
    $null = $manifestResponse.Content | ConvertFrom-Json
  }
  catch {
    throw "Manifest URL did not return valid JSON."
  }
}
catch {
  throw "Failed to fetch manifest at '$ManifestUrl'. Ensure your latest PWA deployment is live and accessible. Details: $($_.Exception.Message)"
}

if (-not (Test-Path $androidDir) -or -not (Test-Path $twaManifestPath)) {
  Write-Host "Initializing Trusted Web Activity project..."
  if (Test-Path $androidDir) {
    Write-Host "Found incomplete TWA directory. Recreating..."
    Remove-Item -Recurse -Force $androidDir
  }
  npx @bubblewrap/cli init `
    --manifest $ManifestUrl `
    --directory $androidDir `
    --packageId $ApplicationId `
    --name $AppName `
    --launcherName $LauncherName
  if ($LASTEXITCODE -ne 0) {
    throw "Bubblewrap init failed with exit code $LASTEXITCODE"
  }
}

Push-Location $androidDir
try {
  Write-Host "Updating TWA project..."
  npx @bubblewrap/cli update
  if ($LASTEXITCODE -ne 0) {
    throw "Bubblewrap update failed with exit code $LASTEXITCODE"
  }

  Write-Host "Building APK and AAB..."
  npx @bubblewrap/cli build
  if ($LASTEXITCODE -ne 0) {
    throw "Bubblewrap build failed with exit code $LASTEXITCODE"
  }

  Write-Host "Build complete. Check: $androidDir\\app\\build\\outputs"
}
finally {
  Pop-Location
}
