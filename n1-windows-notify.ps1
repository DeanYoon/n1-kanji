# ===== N1 한자 학습 · 윈도우 알림 (5분 간격, 단어 5번 + 문장 1번 순환) =====
# 완전 읽기 전용 — Gist(n1-today.json)를 GET만 하고 POST/PATCH는 절대 안 합니다.
# 폰이나 클라우드 어느 쪽 데이터도 건드리지 않습니다.
#
# 동작(폰의 n1-day와 같은 방식):
#   - 날짜가 바뀌었거나 로컬 캐시가 없으면, 그날 딱 한 번만 Gist의 n1-today.json(그날
#     클라우드가 미리 짜놓은 09:00~23:00 스케줄 — 신규/복습 섞여 있음, 단어·문장·문법
#     노트까지 전체 포함)을 통째로 받아와 로컬 파일에 저장합니다. 그 이후로는 그날 안에는
#     재요청하지 않고 이 로컬 캐시만 씁니다(아직 클라우드가 새벽 생성을 안 돌렸으면 목록이
#     비어있고, 비어있는 동안은 5분마다 계속 재시도).
#   - n1-today.json 안에 같은 항목(id)이 여러 슬롯에 걸쳐 반복 등장할 수 있어(복습이라
#     하루에 여러 번 나올 수 있음) id 기준으로 중복 제거해 후보 목록을 만듭니다.
#   - 각 항목이 몇 번 노출됐는지(showCount)를 로컬 파일에 같이 기록해두고, 매번
#     "가장 적게 본 항목들" 중에서 무작위로 하나 골라 보여줍니다(동률이면 랜덤) —
#     폰의 복습 선택 로직(가중 랜덤, 적게 본 것 우선)과 같은 원리.
#   - 단어 알림 문구는 클라우드가 만들어둔 title/body(폰 알림과 완전히 동일한 문구)를
#     그대로 씁니다. 5번은 "단어"(헤드워드·읽기·뜻), 6번째는 방금 고른 단어의 "문장"
#     전체(sentenceJP/translationKR)를 보여주고 사이클이 다시 처음부터 반복됩니다.
#
# 로컬 캐시 파일(직접 열어서 확인 가능):
#   %LOCALAPPDATA%\n1-kanji\windows_today.json
#     { date, cyclePos, lastShownId, items: [{ id, targetKanji, title, body,
#       sentenceJP, translationKR, showCount }] }
#
# 작업 스케줄러에 5분 간격으로 등록해서 쓰세요(등록 명령은 파일 맨 아래 주석 참고).

$ErrorActionPreference = "SilentlyContinue"

$GistId = "3c7a0d99f309aa0dfea3861a7df296d4"
$GistRawUrl = "https://gist.githubusercontent.com/DeanYoon/$GistId/raw/n1-today.json"
# secret gist라 인증 없이 GET 가능. 401/404 뜨면 아래 주석 해제하고 토큰 채우기:
# $GistToken = "ghp_..."

$WordDurationMs = 10000        # 단어 알림 지속시간(밀리초)
$SentenceDurationMs = 20000    # 문장 알림 지속시간(밀리초)

$StateDir = "$env:LOCALAPPDATA\n1-kanji"
$CacheFile = Join-Path $StateDir "windows_today.json"
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

# JST/KST(UTC+9) 기준 오늘 날짜 — 폰/클라우드와 동일 기준으로 맞춤.
$todayKey = (Get-Date).ToUniversalTime().AddHours(9).ToString("yyyy-MM-dd")

# ---- 로컬 캐시 로드 ----
$cache = $null
if (Test-Path $CacheFile) {
    try {
        $loaded = Get-Content $CacheFile -Raw | ConvertFrom-Json
        if ($loaded.date -eq $todayKey -and $loaded.items -and $loaded.items.Count -gt 0) {
            $cache = $loaded
        }
    } catch {}
}

# ---- 캐시가 없거나(날짜 바뀜/최초 실행) 오늘치가 비어있으면 Gist에서 새로 받아옴 ----
if (-not $cache) {
    try {
        $client = New-Object System.Net.WebClient
        $client.Encoding = [System.Text.Encoding]::UTF8
        $client.Headers.Add("Cache-Control", "no-cache")
        if ($GistToken) { $client.Headers.Add("Authorization", "Bearer $GistToken") }
        $jsonText = $client.DownloadString("$GistRawUrl`?nocache=$(Get-Random)")
        $resp = $jsonText | ConvertFrom-Json
    } catch {
        exit 0   # 네트워크 실패 — 조용히 종료, 5분 뒤 자동 재시도
    }
    if (-not $resp -or -not $resp.slots) { exit 0 }
    if ($resp.date -ne $todayKey) { exit 0 }   # 아직 오늘자 클라우드 생성 전 — 다음 폴링 때 재시도

    # id 기준 중복 제거(복습 슬롯은 같은 항목이 하루에 여러 번 나올 수 있음), 처음 등장한
    # 순서를 유지.
    $seen = @{}
    $items = @()
    foreach ($sl in $resp.slots) {
        if (-not $sl.id -or $seen.ContainsKey($sl.id)) { continue }
        $seen[$sl.id] = $true
        $items += [PSCustomObject]@{
            id            = $sl.id
            targetKanji   = $sl.targetKanji
            title         = $sl.title
            body          = $sl.body
            sentenceJP    = $sl.sentenceJP
            translationKR = $sl.translationKR
            showCount     = 0
        }
    }
    if ($items.Count -eq 0) { exit 0 }

    $cache = [PSCustomObject]@{
        date        = $todayKey
        fetchedAt   = (Get-Date).ToString("o")
        cyclePos    = 0
        lastShownId = $null
        items       = $items
    }
    Write-Host "[n1] 오늘치 $($items.Count)건(중복 제거 후) 신규 로드 · $CacheFile 에 저장"
}

# ---- 다음에 보여줄 항목 고르기 ----
$title = ""; $body = ""; $durationMs = $WordDurationMs

if ($cache.cyclePos -lt 5) {
    # ---- 단어 알림: 노출 횟수가 가장 적은 항목들 중에서 무작위로 하나 ----
    $minCount = ($cache.items | Measure-Object -Property showCount -Minimum).Minimum
    $candidates = @($cache.items | Where-Object { $_.showCount -eq $minCount })
    $entry = $candidates[(Get-Random -Maximum $candidates.Count)]
    $entry.showCount = $entry.showCount + 1

    $title = $entry.title
    $body = $entry.body

    $cache.lastShownId = $entry.id
    $cache.cyclePos = $cache.cyclePos + 1
    $durationMs = $WordDurationMs
} else {
    # ---- 문장 알림: 방금 보여준 단어와 같은 항목의 전체 예문 ----
    $sentEntry = $cache.items | Where-Object { $_.id -eq $cache.lastShownId } | Select-Object -First 1
    if (-not $sentEntry) { $sentEntry = $cache.items[0] }   # 방어적 폴백(이론상 안 옴)

    $title = "[문장] " + $sentEntry.targetKanji
    $body = $sentEntry.sentenceJP + "`n" + $sentEntry.translationKR

    $cache.cyclePos = 0
    $durationMs = $SentenceDurationMs
}

# 캐시는 알림을 띄우기 "전에" 먼저 저장 — 대기(Start-Sleep) 중에 스크립트를 또 실행하거나
# 강제 종료해도 다음 실행이 이어서 진행되도록(같은 항목이 반복되는 것 방지).
$cache | ConvertTo-Json -Depth 6 | Set-Content -Path $CacheFile

Add-Type -AssemblyName System.Windows.Forms
$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon = [System.Drawing.SystemIcons]::Information
$notify.Visible = $true
# Windows 10/11 은 접근성 정책상 이 값보다 시스템 설정(설정→접근성→표시→알림 표시 시간)을
# 우선할 수 있음 — 실제 지속시간을 확실히 맞추려면 그 시스템 설정도 같이 조절할 것.
$notify.ShowBalloonTip($durationMs, $title, $body, [System.Windows.Forms.ToolTipIcon]::Info)
Start-Sleep -Milliseconds ($durationMs + 1000)
$notify.Dispose()

# ===== 작업 스케줄러 등록(5분 간격) =====
# $Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument '-ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\Users\<사용자>\n1-kanji\n1-windows-notify.ps1"'
# $Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
# $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
# Register-ScheduledTask -TaskName "N1KanjiNotify" -Action $Action -Trigger $Trigger -Settings $Settings -Force
