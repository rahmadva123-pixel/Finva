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

Write-Host "Adding Vercel envs for project: $proj"

Write-Host "-- Adding to preview"
vercel env add FIREBASE_ADMIN_PROJECT_ID $proj preview --yes
vercel env add FIREBASE_ADMIN_CLIENT_EMAIL $email preview --yes

# Write private key to a temp file and pipe it to the Vercel CLI to avoid
# the CLI interpreting leading dashes in the PEM as options.
$tmp = Join-Path $env:TEMP ([System.IO.Path]::GetRandomFileName())
Set-Content -Path $tmp -Value ($key -replace '\\n', "`n") -NoNewline -Encoding utf8
Get-Content -Raw $tmp | vercel env add FIREBASE_ADMIN_PRIVATE_KEY preview --yes
Remove-Item -Force $tmp

Write-Host "-- Adding to production"
vercel env add FIREBASE_ADMIN_PROJECT_ID $proj production --yes
vercel env add FIREBASE_ADMIN_CLIENT_EMAIL $email production --yes
$tmp = Join-Path $env:TEMP ([System.IO.Path]::GetRandomFileName())
Set-Content -Path $tmp -Value ($key -replace '\\n', "`n") -NoNewline -Encoding utf8
Get-Content -Raw $tmp | vercel env add FIREBASE_ADMIN_PRIVATE_KEY production --yes
Remove-Item -Force $tmp

Write-Host "Finished adding envs. Redeploy preview and test the admin features."
