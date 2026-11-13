$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$executablePath = Join-Path $projectRoot "src-tauri\target\release\skill_demo.exe"
if (-not (Test-Path -LiteralPath $executablePath -PathType Leaf)) {
    throw "Release EXE not found: $executablePath. Run npm run tauri:exe first."
}

$desktopPath = [Environment]::GetFolderPath("Desktop")
if (-not (Test-Path -LiteralPath $desktopPath -PathType Container)) {
    throw "Desktop directory not found: $desktopPath"
}

$shortcutPath = Join-Path $desktopPath "SkillFlow Demo.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $executablePath
$shortcut.WorkingDirectory = Split-Path -Parent $executablePath
$shortcut.IconLocation = "$executablePath,0"
$shortcut.Description = "Launch SkillFlow Demo"
$shortcut.Save()

Write-Output "已创建快捷方式：$shortcutPath"
