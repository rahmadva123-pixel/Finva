Param(
    [Parameter(Mandatory=$true)]
    [string]$JsonPath
)

if (-not (Test-Path $JsonPath)) {
    Write-Error "JSON file not found: $JsonPath"
    exit 1
}

try {
    $json = Get-Content -Raw $JsonPath | ConvertFrom-Json
} catch {
    Write-Error "Failed to parse JSON: $_"
    exit 2
}

$proj  = $json.project_id
$email = $json.client_email
$key   = $json.private_key -replace "`r?`n","\\n"

if (-not $proj -or -not $email -or -not $key) {
    Write-Error "Missing expected fields in JSON (project_id, client_email, private_key)"
    exit 3
}

Write-Host "NOTE: This repository must not contain private keys or service-account JSON files."
Write-Host "The automated upload of private keys has been disabled to avoid accidental exposure."

Write-Host "Manual steps to add required Vercel environment variables:"
Write-Host "1. Open your Vercel Project → Settings → Environment Variables."
Write-Host "2. Add the following variables (use the Vercel UI or a secure secrets manager):"
Write-Host "   - FIREBASE_ADMIN_PROJECT_ID"
Write-Host "   - FIREBASE_ADMIN_CLIENT_EMAIL"
Write-Host "   - FIREBASE_ADMIN_PRIVATE_KEY  (paste PEM text in the UI; do NOT commit this file)"
Write-Host "3. For local development, set these variables in your local environment (e.g., .env.local but do NOT commit it)."

Write-Host "If you still want an automated flow, run the Vercel CLI commands manually from a secure environment—do not pipe secrets in CI or store them in the repo."
