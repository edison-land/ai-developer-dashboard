param(
  [string]$ExePath = "dist/v1.0.0/AI-Developer-Dashboard-v1.0.0-portable-x64.exe",
  [switch]$VerifyExistingData
)

$ErrorActionPreference = "Stop"
$resolvedExe = (Resolve-Path -LiteralPath $ExePath).Path
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$tempData = Join-Path $tempRoot ("ai-dashboard-v1-smoke-" + [guid]::NewGuid().ToString("N"))
$previousDataDir = $env:AI_DASHBOARD_DATA_DIR
$previousDebugLog = $env:AI_DASHBOARD_DESKTOP_DEBUG_LOG
$trackedProcessIds = [Collections.Generic.HashSet[int]]::new()

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class DesktopWindowState {
  [DllImport("user32.dll")]
  public static extern bool IsIconic(IntPtr window);
  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr window, int command);
}
"@
$initialProductProcessIds = @(
  Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq "AI Developer Dashboard.exe" -or
    $_.ExecutablePath -eq $resolvedExe
  } | ForEach-Object { [int]$_.ProcessId }
)

function Wait-ForResult {
  param(
    [scriptblock]$Probe,
    [string]$Description,
    [int]$TimeoutSeconds = 30
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $value = & $Probe
    if ($value) { return $value }
    Start-Sleep -Milliseconds 250
  } while ((Get-Date) -lt $deadline)
  throw "Timed out waiting for $Description"
}

function Get-DesktopMainProcesses {
  @(Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq "AI Developer Dashboard.exe" -and $_.CommandLine -notlike "*--type=*"
  })
}

if (@(Get-DesktopMainProcesses).Count -gt 0) {
  throw "Close the currently running AI Developer Dashboard before verification"
}

function Start-VerifiedDesktop {
  param([string]$ExpectedDataRoot = $tempData)
  $startedAt = (Get-Date).AddSeconds(-1)
  $shownBefore = @(
    if (Test-Path -LiteralPath $env:AI_DASHBOARD_DESKTOP_DEBUG_LOG) {
      Select-String -LiteralPath $env:AI_DASHBOARD_DESKTOP_DEBUG_LOG -Pattern "window shown"
    }
  ).Count
  $launcher = Start-Process -FilePath $resolvedExe -PassThru
  [void]$trackedProcessIds.Add($launcher.Id)
  $main = Wait-ForResult -Description "desktop main process" -Probe {
    Get-DesktopMainProcesses |
      Where-Object { $_.CreationDate -ge $startedAt } |
      Select-Object -First 1
  }
  [void]$trackedProcessIds.Add([int]$main.ProcessId)
  $process = Wait-ForResult -Description "desktop window" -Probe {
    $candidate = Get-Process -Id $main.ProcessId -ErrorAction SilentlyContinue
    if ($candidate -and $candidate.MainWindowHandle -ne 0) { $candidate }
  }
  $listener = Wait-ForResult -Description "private local backend" -Probe {
    Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
      Where-Object { $_.OwningProcess -eq $main.ProcessId -and $_.LocalAddress -eq "127.0.0.1" } |
      Select-Object -First 1
  }
  $health = Invoke-RestMethod -Uri ("http://127.0.0.1:{0}/api/health" -f $listener.LocalPort)
  $projects = Invoke-RestMethod -Uri ("http://127.0.0.1:{0}/api/projects?includeArchived=true" -f $listener.LocalPort)
  $settings = Invoke-RestMethod -Uri ("http://127.0.0.1:{0}/api/settings" -f $listener.LocalPort)
  if (-not $health.ok) { throw "Desktop health endpoint did not report ok" }
  if ([IO.Path]::GetFullPath($health.dataRoot) -ne [IO.Path]::GetFullPath($ExpectedDataRoot)) {
    throw "Desktop did not use the requested data directory"
  }
  Wait-ForResult -Description "non-empty rendered UI" -Probe {
    $shownNow = @(
      Select-String -LiteralPath $env:AI_DASHBOARD_DESKTOP_DEBUG_LOG -Pattern "window shown" -ErrorAction SilentlyContinue
    ).Count
    if ($shownNow -gt $shownBefore) { $true }
  } | Out-Null
  [pscustomobject]@{
    Launcher = $launcher
    Main = $main
    Process = $process
    Port = [int]$listener.LocalPort
    Health = $health
    Projects = $projects
    Settings = $settings
  }
}

function Close-VerifiedDesktop {
  param($Run)
  if (-not $Run.Process.CloseMainWindow()) {
    throw "Windows could not send the normal close action to the desktop window"
  }
  Wait-ForResult -Description "desktop process exit" -Probe {
    if (-not (Get-Process -Id $Run.Main.ProcessId -ErrorAction SilentlyContinue)) { $true }
  } | Out-Null
  Wait-ForResult -Description "desktop backend exit" -Probe {
    $stillListening = Get-NetTCPConnection -State Listen -LocalPort $Run.Port -ErrorAction SilentlyContinue
    if (-not $stillListening) { $true }
  } | Out-Null
}

New-Item -ItemType Directory -Path $tempData | Out-Null
$env:AI_DASHBOARD_DATA_DIR = $tempData
$env:AI_DASHBOARD_DESKTOP_DEBUG_LOG = Join-Path $tempData "desktop-startup.log"

try {
  Write-Host "[desktop] first launch"
  $first = Start-VerifiedDesktop

  Write-Host "[desktop] second launch"
  [void][DesktopWindowState]::ShowWindow($first.Process.MainWindowHandle, 6)
  Wait-ForResult -Description "desktop window to minimize" -Probe {
    if ([DesktopWindowState]::IsIconic($first.Process.MainWindowHandle)) { $true }
  } | Out-Null
  $secondLauncher = Start-Process -FilePath $resolvedExe -PassThru
  [void]$trackedProcessIds.Add($secondLauncher.Id)
  Wait-ForResult -Description "second portable launch to return to the existing instance" -TimeoutSeconds 45 -Probe {
    if (-not (Get-Process -Id $secondLauncher.Id -ErrorAction SilentlyContinue)) { $true }
  } | Out-Null
  Wait-ForResult -Description "existing window to restore after second launch" -Probe {
    if (-not [DesktopWindowState]::IsIconic($first.Process.MainWindowHandle)) { $true }
  } | Out-Null
  $mainProcessesAfterSecondLaunch = @(Get-DesktopMainProcesses)
  if ($mainProcessesAfterSecondLaunch.Count -ne 1) {
    throw "Second launch created another desktop main process"
  }
  $listenersAfterSecondLaunch = @(
    Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
      Where-Object { $_.OwningProcess -eq $first.Main.ProcessId -and $_.LocalAddress -eq "127.0.0.1" }
  )
  if ($listenersAfterSecondLaunch.Count -ne 1) {
    throw "Second launch changed the number of desktop backends"
  }

  Write-Host "[desktop] close"
  Close-VerifiedDesktop $first
  Write-Host "[desktop] restart"
  $restart = Start-VerifiedDesktop
  if ($restart.Main.ProcessId -eq $first.Main.ProcessId) {
    throw "Desktop restart reused a process that should have exited"
  }
  Close-VerifiedDesktop $restart

  $existing = $null
  if ($VerifyExistingData) {
    Write-Host "[desktop] existing data"
    $env:AI_DASHBOARD_DATA_DIR = $previousDataDir
    $existingDataRoot = if ($previousDataDir) {
      [IO.Path]::GetFullPath($previousDataDir)
    } else {
      Join-Path ([Environment]::GetFolderPath("UserProfile")) ".ai-dashboard"
    }
    $existingDbPath = Join-Path $existingDataRoot "dashboard.db"
    if (-not (Test-Path -LiteralPath $existingDbPath)) {
      throw "Existing dashboard database was not found at $existingDbPath"
    }
    $existing = Start-VerifiedDesktop -ExpectedDataRoot $existingDataRoot
    Close-VerifiedDesktop $existing
  }

  [pscustomobject]@{
    Result = "PASS"
    Exe = $resolvedExe
    FirstMainProcessId = [int]$first.Main.ProcessId
    FirstPort = $first.Port
    ProjectCount = @($first.Projects.projects).Count
    SingleInstanceMainCount = $mainProcessesAfterSecondLaunch.Count
    SingleInstanceBackendCount = $listenersAfterSecondLaunch.Count
    RestartMainProcessId = [int]$restart.Main.ProcessId
    RestartPort = $restart.Port
    DataRoot = $first.Health.dataRoot
    ExistingDataRoot = if ($existing) { $existing.Health.dataRoot } else { $null }
    ExistingProjectCount = if ($existing) { @($existing.Projects.projects).Count } else { $null }
    ExistingProvider = if ($existing) { $existing.Settings.provider } else { $null }
    ExistingHasApiKey = if ($existing) { [bool]$existing.Settings.hasApiKey } else { $null }
  } | ConvertTo-Json
}
catch {
  if (Test-Path -LiteralPath $env:AI_DASHBOARD_DESKTOP_DEBUG_LOG) {
    Write-Host "[desktop] startup log"
    Get-Content -Raw -LiteralPath $env:AI_DASHBOARD_DESKTOP_DEBUG_LOG
  }
  throw
}
finally {
  $newProductProcessIds = @(
    Get-CimInstance Win32_Process | Where-Object {
      ($_.Name -eq "AI Developer Dashboard.exe" -or $_.ExecutablePath -eq $resolvedExe) -and
      $initialProductProcessIds -notcontains [int]$_.ProcessId
    } | ForEach-Object { [int]$_.ProcessId }
  )
  foreach ($processId in @($trackedProcessIds) + $newProductProcessIds) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
  $env:AI_DASHBOARD_DATA_DIR = $previousDataDir
  $env:AI_DASHBOARD_DESKTOP_DEBUG_LOG = $previousDebugLog
  $fullTempData = [IO.Path]::GetFullPath($tempData)
  if ($fullTempData.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and
      (Split-Path -Leaf $fullTempData).StartsWith("ai-dashboard-v1-smoke-")) {
    Remove-Item -LiteralPath $fullTempData -Recurse -Force -ErrorAction SilentlyContinue
  }
}
