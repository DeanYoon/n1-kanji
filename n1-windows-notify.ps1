# ===== N1 한자 학습 · 윈도우 알림 (클라우드 동기화) =====
# 폰(Scriptable)이 GitHub Gist에 올려둔 "오늘의 슬롯"을 읽어와, 지금 시각에 해당하는
# 항목이 새로 나타났을 때만 윈도우 알림(풍선)을 띄웁니다. 같은 슬롯을 중복으로 띄우지
# 않도록 마지막으로 띄운 슬롯 키를 파일에 저장해둡니다.
#
# 작업 스케줄러에 등록해 INTERVAL_MIN(기본 15분)마다 실행하면, 폰과 거의 같은 타이밍에
# 같은 내용의 알림이 윈도우에도 뜹니다. 네트워크 실패·오늘자 데이터 없음 등은 전부
# 조용히 스킵(창 안 뜸, 에러 안 남김) — 다음 폴링 때 자동으로 다시 시도됩니다.

$ErrorActionPreference = "SilentlyContinue"

$GistRawUrl = "https://gist.githubusercontent.com/DeanYoon/3c7a0d99f309aa0dfea3861a7df296d4/raw/n1-today.json"
# secret gist라 인증 없이 GET 가능. 혹시 401/404가 뜨면 아래 주석 해제하고 토큰 사용:
# $GistToken = "ghp_..."

$StateDir = "$env:LOCALAPPDATA\n1-kanji"
$StateFile = Join-Path $StateDir "last_key.txt"
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

try {
    $headers = @{ "Cache-Control" = "no-cache" }
    if ($GistToken) { $headers["Authorization"] = "Bearer $GistToken" }
    $resp = Invoke-RestMethod -Uri "$GistRawUrl`?nocache=$(Get-Random)" -Headers $headers -TimeoutSec 15
} catch {
    exit 0   # 네트워크 실패 등 — 조용히 종료, 다음 폴링 때 재시도
}

if (-not $resp -or -not $resp.slots) { exit 0 }

$now = Get-Date
$todayKey = $now.ToString("yyyy-MM-dd")
if ($resp.date -ne $todayKey) { exit 0 }   # 폰이 아직 오늘자 day()를 안 돌렸으면 스킵

$nowHHmm = $now.ToString("HH:mm")
$current = $resp.slots | Where-Object { $_.key -le $nowHHmm } | Sort-Object key | Select-Object -Last 1
if (-not $current) { exit 0 }

$lastShown = ""
if (Test-Path $StateFile) { $lastShown = (Get-Content $StateFile -Raw).Trim() }
if ($current.key -eq $lastShown) { exit 0 }   # 이미 이 슬롯은 띄웠음 — 중복 방지

Add-Type -AssemblyName System.Windows.Forms
$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon = [System.Drawing.SystemIcons]::Information
$notify.Visible = $true
$notify.ShowBalloonTip(8000, $current.title, $current.body, [System.Windows.Forms.ToolTipIcon]::Info)
Start-Sleep -Seconds 9
$notify.Dispose()

Set-Content -Path $StateFile -Value $current.key
