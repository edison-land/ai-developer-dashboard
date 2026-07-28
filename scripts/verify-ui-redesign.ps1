$ErrorActionPreference = "Stop"

function Invoke-PnpmStep {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Label,
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  Write-Host ""
  Write-Host "[$Label] pnpm $($Arguments -join ' ')" -ForegroundColor Cyan
  & pnpm @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE"
  }
  Write-Host "[$Label] PASS" -ForegroundColor Green
}

Invoke-PnpmStep -Label "TYPECHECK" -Arguments @("typecheck")
Invoke-PnpmStep -Label "TEST" -Arguments @("test")
Invoke-PnpmStep -Label "BUILD" -Arguments @("build:ui")

Write-Host ""
Write-Host "UI REDESIGN ACCEPTANCE: PASS" -ForegroundColor Green
