param(
  [string]$InstallerPath = "dist/v1.1.0/AI-Developer-Dashboard-v1.1.0-setup-x64.exe",
  [Parameter(Mandatory = $true)]
  [string]$UpgradeInstallerPath,
  [string]$PortablePath = "dist/v1.0.0/AI-Developer-Dashboard-v1.0.0-portable-x64.exe",
  [switch]$KeepArtifacts
)

$ErrorActionPreference = "Stop"
$resolvedInstaller = (Resolve-Path -LiteralPath $InstallerPath).Path
$resolvedUpgradeInstaller = (Resolve-Path -LiteralPath $UpgradeInstallerPath).Path
$resolvedPortable = (Resolve-Path -LiteralPath $PortablePath).Path
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$testRoot = Join-Path $tempRoot ("ai-dashboard-installer-" + [guid]::NewGuid().ToString("N"))
$installRoot = Join-Path $testRoot "installed"
$legacyData = Join-Path $testRoot "legacy-cli-portable-data"
$managedUserData = Join-Path $testRoot "electron-user-data"
$codexHome = Join-Path $testRoot "codex"
$fixtureProjectsRoot = Join-Path $testRoot "fixture-projects"
$projectPaths = @(
  (Join-Path $fixtureProjectsRoot "stage-cache"),
  (Join-Path $fixtureProjectsRoot "archived"),
  (Join-Path $fixtureProjectsRoot "today-focus")
)
$localDate = (Get-Date).ToString("yyyy-MM-dd")
$debugLog = Join-Path $testRoot "desktop-startup.log"
$installedExe = Join-Path $installRoot "AI Developer Dashboard.exe"
$managedData = Join-Path $managedUserData "data"
$legacyDb = Join-Path $legacyData "dashboard.db"
$managedDb = Join-Path $managedData "dashboard.db"
$trackedProcessIds = [Collections.Generic.HashSet[int]]::new()
$environmentKeys = @(
  "AI_DASHBOARD_DATA_DIR",
  "AI_DASHBOARD_LEGACY_DATA_DIR",
  "AI_DASHBOARD_DESKTOP_USER_DATA_DIR",
  "AI_DASHBOARD_DESKTOP_DEBUG_LOG",
  "CODEX_HOME",
  "CLAUDE_CONFIG_DIR"
)
$previousEnvironment = @{}
foreach ($key in $environmentKeys) {
  $previousEnvironment[$key] = [Environment]::GetEnvironmentVariable($key, "Process")
}

function Wait-ForResult {
  param(
    [scriptblock]$Probe,
    [string]$Description,
    [int]$TimeoutSeconds = 45
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $value = & $Probe
    if ($value) { return $value }
    Start-Sleep -Milliseconds 250
  } while ((Get-Date) -lt $deadline)
  throw "Timed out waiting for $Description"
}

function Invoke-Installer {
  param([string]$PackagePath)
  $process = Start-Process -FilePath $PackagePath -ArgumentList @("/S", "/D=$installRoot") -Wait -PassThru
  if ($process.ExitCode -ne 0) {
    throw "Installer exited with code $($process.ExitCode)"
  }
  if (-not (Test-Path -LiteralPath $installedExe)) {
    throw "Installed executable was not found at $installedExe"
  }
}

function Get-DesktopMainProcesses {
  param([datetime]$CreatedAfter = [datetime]::MinValue)
  @(Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq "AI Developer Dashboard.exe" -and
    $_.CommandLine -notlike "*--type=*" -and
    $_.CreationDate -ge $CreatedAfter
  })
}

function Get-Json {
  param([string]$Url)
  Invoke-RestMethod -Uri $Url -UseBasicParsing
}

function Start-VerifiedDesktop {
  $startedAt = (Get-Date).AddSeconds(-1)
  $launcher = Start-Process -FilePath $installedExe -WorkingDirectory $installRoot -PassThru
  [void]$trackedProcessIds.Add($launcher.Id)
  $main = Wait-ForResult -Description "installed desktop main process" -Probe {
    Get-DesktopMainProcesses $startedAt | Select-Object -First 1
  }
  [void]$trackedProcessIds.Add([int]$main.ProcessId)
  $process = Wait-ForResult -Description "installed desktop window" -Probe {
    $candidate = Get-Process -Id $main.ProcessId -ErrorAction SilentlyContinue
    if ($candidate -and $candidate.MainWindowHandle -ne 0) { $candidate }
  }
  $listener = Wait-ForResult -Description "installed private local backend" -Probe {
    Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
      Where-Object { $_.OwningProcess -eq $main.ProcessId -and $_.LocalAddress -eq "127.0.0.1" } |
      Select-Object -First 1
  }
  $baseUrl = "http://127.0.0.1:$($listener.LocalPort)"
  $health = Get-Json "$baseUrl/api/health"
  $projects = Get-Json "$baseUrl/api/projects?includeArchived=true"
  $settings = Get-Json "$baseUrl/api/settings"
  $focus = Get-Json "$baseUrl/api/focus-preferences?localDate=$localDate"
  Wait-ForResult -Description "non-empty rendered UI" -Probe {
    if ((Select-String -LiteralPath $debugLog -Pattern "window shown" -ErrorAction SilentlyContinue).Count -gt 0) { $true }
  } | Out-Null
  [pscustomobject]@{
    Launcher = $launcher
    Main = $main
    Process = $process
    Port = [int]$listener.LocalPort
    Health = $health
    Projects = $projects
    Settings = $settings
    Focus = $focus
  }
}

function Start-PortableFixtureProbe {
  $startedAt = (Get-Date).AddSeconds(-1)
  $launcher = Start-Process -FilePath $resolvedPortable -PassThru
  [void]$trackedProcessIds.Add($launcher.Id)
  $main = Wait-ForResult -Description "v1.0 portable main process" -Probe {
    Get-DesktopMainProcesses $startedAt | Select-Object -First 1
  }
  [void]$trackedProcessIds.Add([int]$main.ProcessId)
  $process = Wait-ForResult -Description "v1.0 portable window" -Probe {
    $candidate = Get-Process -Id $main.ProcessId -ErrorAction SilentlyContinue
    if ($candidate -and $candidate.MainWindowHandle -ne 0) { $candidate }
  }
  $listener = Wait-ForResult -Description "v1.0 portable private local backend" -Probe {
    Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
      Where-Object { $_.OwningProcess -eq $main.ProcessId -and $_.LocalAddress -eq "127.0.0.1" } |
      Select-Object -First 1
  }
  $baseUrl = "http://127.0.0.1:$($listener.LocalPort)"
  $health = Get-Json "$baseUrl/api/health"
  $projects = Get-Json "$baseUrl/api/projects?includeArchived=true"
  if (-not $health.ok -or [IO.Path]::GetFullPath($health.dataRoot) -ne [IO.Path]::GetFullPath($legacyData)) {
    throw "v1.0 portable did not read the seeded legacy data directory"
  }
  if (@($projects.projects).Count -lt 3) { throw "v1.0 portable did not read the fixture projects" }
  [pscustomobject]@{
    Launcher = $launcher
    Main = $main
    Process = $process
    Port = [int]$listener.LocalPort
    Health = $health
    Projects = $projects
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

function Find-ShortcutTarget {
  param([string]$Root)
  if (-not (Test-Path -LiteralPath $Root)) { return $null }
  $shell = New-Object -ComObject WScript.Shell
  foreach ($shortcut in Get-ChildItem -LiteralPath $Root -Recurse -Filter "*.lnk" -File -ErrorAction SilentlyContinue) {
    $target = $shell.CreateShortcut($shortcut.FullName).TargetPath
    if ($target -and [IO.Path]::GetFullPath($target) -eq [IO.Path]::GetFullPath($installedExe)) {
      return $shortcut.FullName
    }
  }
  return $null
}

function ConvertTo-CanonicalPathKey {
  param([string]$Value)
  $resolved = [IO.Path]::GetFullPath($Value)
  $resolved.Replace([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar).ToLowerInvariant()
}

function Assert-ApiContinuity {
  param($Run, [string]$Label)
  $dataRoot = [IO.Path]::GetFullPath($Run.Health.dataRoot)
  if ($dataRoot -ne [IO.Path]::GetFullPath($managedData)) {
    throw "$Label used unexpected data directory: $dataRoot"
  }
  $projectList = @($Run.Projects.projects)
  if ($projectList.Count -lt 3) { throw "$Label lost fixture projects" }
  $stageKey = ConvertTo-CanonicalPathKey $projectPaths[0]
  $archiveKey = ConvertTo-CanonicalPathKey $projectPaths[1]
  $stageProject = $projectList | Where-Object { $_.canonicalPath.ToLowerInvariant() -eq $stageKey }
  $archivedProject = $projectList | Where-Object { $_.canonicalPath.ToLowerInvariant() -eq $archiveKey }
  if (-not $stageProject -or $stageProject.stage -ne "verifying") { throw "$Label lost stage override" }
  if (-not $archivedProject -or -not $archivedProject.archivedAtMs) { throw "$Label lost archive state" }
  if ($Run.Focus.pinnedPaths.Count -ne 1) { throw "$Label lost today's focus" }
  if ($Run.Settings.provider -ne "openai" -or $Run.Settings.model -ne "fixture-model" -or
      $Run.Settings.requestUrl -ne "https://fixture.invalid/v1/" -or
      -not $Run.Settings.hasApiKey -or $Run.Settings.autoRefreshMins -ne 15 -or
      -not $Run.Settings.synthOnRefresh) {
    throw "$Label lost model configuration"
  }
}

function Assert-DatabaseContinuity {
  param(
    [string]$Label,
    [string]$DatabasePath = $managedDb
  )
  $json = & node scripts/inspect-desktop-installer-data.mjs $DatabasePath $localDate $projectPaths[0] $projectPaths[1] $projectPaths[2]
  if ($LASTEXITCODE -ne 0) { throw "$Label database inspection failed" }
  $snapshot = $json | ConvertFrom-Json
  if ($snapshot.settings.provider -ne "openai" -or $snapshot.settings.openai_api_key -ne "fixture-secret" -or
      $snapshot.settings.model -ne "fixture-model") { throw "$Label lost raw model configuration" }
  if ($snapshot.stage.stage -ne "verifying") { throw "$Label lost stage row" }
  if (-not $snapshot.archived.archived_at_ms) { throw "$Label lost archive row" }
  if ($snapshot.focus.canonical_path -ne (ConvertTo-CanonicalPathKey $projectPaths[2])) {
    throw "$Label lost focus row"
  }
  if ($null -eq $snapshot.synth) { throw ("{0} lost synthesis cache" -f $Label) }
  if ($snapshot.synth.result.summary -ne "fixture cached summary") {
    throw ("{0} lost synthesis cache" -f $Label)
  }
}

New-Item -ItemType Directory -Path $testRoot | Out-Null
$env:AI_DASHBOARD_DATA_DIR = $null
$env:AI_DASHBOARD_LEGACY_DATA_DIR = $legacyData
$env:AI_DASHBOARD_DESKTOP_USER_DATA_DIR = $managedUserData
$env:AI_DASHBOARD_DESKTOP_DEBUG_LOG = $debugLog
$env:CODEX_HOME = $codexHome
$env:CLAUDE_CONFIG_DIR = Join-Path $testRoot "claude"

$first = $null
$portableProbe = $null
$upgrade = $null
$reinstalled = $null
try {
  $version = (Get-Item -LiteralPath $resolvedInstaller).VersionInfo.ProductVersion
  $upgradeVersion = (Get-Item -LiteralPath $resolvedUpgradeInstaller).VersionInfo.ProductVersion
  $portableVersion = (Get-Item -LiteralPath $resolvedPortable).VersionInfo.ProductVersion
  if ($version -notlike "1.1.0*") { throw "Installer ProductVersion is not v1.1.0: $version" }
  if ($portableVersion -notlike "1.0.0*") { throw "Portable ProductVersion is not v1.0.0: $portableVersion" }
  if ($upgradeVersion -notlike "1.1.1*") {
    throw "Upgrade installer ProductVersion is not the expected test version: $upgradeVersion"
  }

  & node scripts/seed-desktop-installer-data.mjs $legacyData $codexHome $localDate $projectPaths[0] $projectPaths[1] $projectPaths[2] | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not seed the legacy CLI/portable fixture" }
  if (-not (Test-Path -LiteralPath $legacyDb)) { throw "Legacy fixture database was not created" }

  Write-Host "[portable] read legacy fixture"
  $env:AI_DASHBOARD_DATA_DIR = $legacyData
  $portableProbe = Start-PortableFixtureProbe
  Close-VerifiedDesktop $portableProbe
  $env:AI_DASHBOARD_DATA_DIR = $null

  Write-Host "[installer] first install"
  Invoke-Installer $resolvedInstaller
  $desktopRoot = [Environment]::GetFolderPath("Desktop")
  $startMenuRoot = Join-Path ([Environment]::GetFolderPath("ApplicationData")) "Microsoft\Windows\Start Menu\Programs"
  if (-not (Find-ShortcutTarget $desktopRoot)) { throw "Desktop shortcut was not created" }
  if (-not (Find-ShortcutTarget $startMenuRoot)) { throw "Start menu shortcut was not created" }

  Write-Host "[installer] first launch and legacy migration"
  $first = Start-VerifiedDesktop
  Assert-ApiContinuity $first "first launch"
  Close-VerifiedDesktop $first
  Assert-DatabaseContinuity "first launch"
  if (-not (Test-Path -LiteralPath $legacyDb)) { throw "Legacy data was deleted during migration" }
  $backupDirs = @(Get-ChildItem -LiteralPath (Join-Path $managedData "migration-backups") -Directory)
  if ($backupDirs.Count -ne 1) { throw "Expected one migration backup, found $($backupDirs.Count)" }
  $backupDb = Join-Path $backupDirs[0].FullName "source\dashboard.db"
  $manifest = Join-Path $backupDirs[0].FullName "manifest.json"
  if (-not (Test-Path -LiteralPath $backupDb) -or -not (Test-Path -LiteralPath $manifest)) {
    throw "Migration backup or manifest is missing"
  }
  $recoveryRoot = Join-Path $testRoot "recovered-from-migration-backup"
  New-Item -ItemType Directory -Path $recoveryRoot | Out-Null
  $backupSource = Split-Path -Parent $backupDb
  foreach ($backupFile in Get-ChildItem -LiteralPath $backupSource -File) {
    Copy-Item -LiteralPath $backupFile.FullName -Destination $recoveryRoot -Force
  }
  $recoveredDb = Join-Path $recoveryRoot "dashboard.db"
  Assert-DatabaseContinuity "migration backup restore" $recoveredDb

  Write-Host "[installer] covered upgrade"
  Invoke-Installer $resolvedUpgradeInstaller
  $upgrade = Start-VerifiedDesktop
  Assert-ApiContinuity $upgrade "covered upgrade"
  Close-VerifiedDesktop $upgrade
  Assert-DatabaseContinuity "covered upgrade"

  Write-Host "[installer] uninstall with data retention"
  $uninstaller = Join-Path $installRoot "Uninstall AI Developer Dashboard.exe"
  if (-not (Test-Path -LiteralPath $uninstaller)) { throw "Uninstaller was not created" }
  $uninstall = Start-Process -FilePath $uninstaller -ArgumentList "/S" -Wait -PassThru
  if ($uninstall.ExitCode -ne 0) { throw "Uninstaller exited with code $($uninstall.ExitCode)" }
  if (Test-Path -LiteralPath $installedExe) { throw "Installed executable remains after uninstall" }
  if (-not (Test-Path -LiteralPath $managedDb)) { throw "Uninstall deleted managed personal data" }
  if (-not (Test-Path -LiteralPath $backupDb)) { throw "Uninstall deleted migration backup" }

  Write-Host "[installer] reinstall and restore"
  Invoke-Installer $resolvedInstaller
  $reinstalled = Start-VerifiedDesktop
  Assert-ApiContinuity $reinstalled "reinstall"
  Close-VerifiedDesktop $reinstalled
  Assert-DatabaseContinuity "reinstall"

  [pscustomobject]@{
    Result = "PASS"
    Installer = $resolvedInstaller
    InstallerProductVersion = $version
    Portable = $resolvedPortable
    PortableProductVersion = $portableVersion
    UpgradeInstaller = $resolvedUpgradeInstaller
    UpgradeInstallerProductVersion = $upgradeVersion
    InstallRoot = $installRoot
    ManagedDataRoot = $managedData
    LegacyDataRoot = $legacyData
    MigrationBackup = $backupDb
    RecoveredDatabase = $recoveredDb
    FirstLaunchProjectCount = @($first.Projects.projects).Count
    PortableProjectCount = @($portableProbe.Projects.projects).Count
    FirstLaunchPort = $first.Port
    UpgradePort = $upgrade.Port
    ReinstallPort = $reinstalled.Port
    DesktopShortcut = (Find-ShortcutTarget $desktopRoot)
    StartMenuShortcut = (Find-ShortcutTarget $startMenuRoot)
    LegacyDataStillPresent = (Test-Path -LiteralPath $legacyDb)
    ManagedDataStillPresent = (Test-Path -LiteralPath $managedDb)
  } | ConvertTo-Json
}
catch {
  if (Test-Path -LiteralPath $debugLog) {
    Write-Host "[installer] startup log"
    Get-Content -Raw -LiteralPath $debugLog
  }
  throw
}
finally {
  foreach ($processId in @($trackedProcessIds)) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
  foreach ($key in $environmentKeys) {
    [Environment]::SetEnvironmentVariable($key, $previousEnvironment[$key], "Process")
  }
  $fullTestRoot = [IO.Path]::GetFullPath($testRoot)
  $leaf = Split-Path -Leaf $fullTestRoot
  if (-not $KeepArtifacts -and
      $fullTestRoot.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and
      $leaf.StartsWith("ai-dashboard-installer-")) {
    Remove-Item -LiteralPath $fullTestRoot -Recurse -Force -ErrorAction SilentlyContinue
  } elseif ($KeepArtifacts) {
    Write-Host "Artifacts retained at $fullTestRoot"
  }
}
