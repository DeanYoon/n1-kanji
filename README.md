# n1-kanji

JLPT N2·N1 한자 학습 시스템. 예문 생성(OpenRouter 호출)은 **GitHub Actions 새벽 배치 한 곳에서만** 일어나고, 아이폰과 윈도우는 그 결과를 **읽기만** 한다.

## 하드 룰

- OpenRouter 호출은 **GitHub Actions(`scripts/generate-day.mjs`) 한 곳에서만** 한다.
- 아이폰 Scriptable 스크립트도, 윈도우 PowerShell 스크립트도 **OpenRouter 를 절대 호출하지 않는다.** 클라우드 데이터(Gist)가 없으면 명확히 실패하고, 로컬에서 대신 생성하지 않는다.
- 레포는 public 이다. 토큰(`ghp_…` / `sk-or-…` / `sk-…`)을 커밋하지 않는다. `n1-config.js` 는 플레이스홀더 버전만 올라간다.

## 데이터 흐름

```
GitHub Actions  (매일 05:00 KST, cron "0 20 * * *")
  └─ scripts/generate-day.mjs
       ├─ Gist:n1-state.json  읽기 → n1.planDay() → 신규 한자는 OpenRouter 로 예문 생성
       ├─ Gist:n1-today.json  ← 그날치 슬롯(09:00~23:00)
       └─ Gist:n1-state.json  ← 전진된 진도/이력
                    │
        ┌───────────┴────────────┐
   아이폰 (읽기)              윈도우 (읽기)
   n1-day  : 오늘치 슬롯을      n1-windows-notify.ps1:
             iOS 로컬 알림으로   n1-today.json 만 GET,
             예약               5분마다 토스트 알림
   n1-cloud: "외웠음" 등 로컬
             변경만 state 로
             단방향 업로드
```

아이폰·윈도우 어느 쪽도 예문을 만들지 않는다. 클라우드가 진도(`n1-state.json`)의 유일한 생성 주체이고, 아이폰 `n1-day` 는 실행할 때마다 원격 진도를 로컬에 통째로 반영한다(로컬의 "외웠음" 표시는 id 기준으로 보존).

## 파일

- **`n1.js`** — 로직 전체(커리큘럼 706자, 예문 생성, 위젯, 이력, Gist I/O). 단일 파일. `typeof FileManager` 유무로 폰(Scriptable) / 클라우드(Node)를 구분해 HTTP 전송 계층만 갈아끼운다(빌드 단계 없음, 오프라인 캐시 그대로). 폰 껍데기가 이 파일을 raw URL 에서 통째로 fetch 해 실행하고, 클라우드 생성기는 `require()` 로 순수 함수(`planDay` / `compose` / `commitNewEntry` …)만 재사용한다.
- **`scripts/generate-day.mjs`** — 클라우드 하루치 생성기(Node 20+, 의존성 없음).
- **`.github/workflows/generate-day.yml`** — 위 스크립트를 매일 05:00 KST 에 실행. 수동 실행(`workflow_dispatch`, `dry_run` / `force` 옵션)도 가능.
- **`stub.js`** — Scriptable 껍데기 템플릿. 6개 스크립트에 똑같이 붙여넣고 이름만 다르게 짓는다.
- **`n1-config.js`** — Scriptable 에서 한 번만 실행. 키를 Keychain 에 저장. **레포엔 플레이스홀더 버전만.**
- **`n1-windows-notify.ps1`** — 윈도우 읽기 전용 알림 스크립트.

## Gist 두 파일

기본 Gist ID: `3c7a0d99f309aa0dfea3861a7df296d4` (secret gist — 읽기는 인증 불필요, 쓰기는 `gist` scope 토큰 필요).

### `n1-state.json` — 누적 이력·진도

`kanjiList`(706자) · `progressIndex` · `cycle` · `kanjiRepCount` · `history[]` · `pending[]` · `updatedAt`.

클라우드가 만들어 올리고, 아이폰 `n1-day` 가 읽어 로컬 진도를 통째로 갈아끼운다. 아이폰에서 `n1-cloud` 를 실행하면 로컬 `n1_state.json`(주로 "외웠음" 표시)이 **로컬이 더 최신일 때만** 이 파일로 단방향 업로드된다.

### `n1-today.json` — 그날 하루치 슬롯

```
{ date, updatedAt, slots: [
    { key, title, body, mode, id, targetKanji,
      sentenceJP, readingHiragana, translationKR, kanjiNotes[], grammarNotes[] }
] }
```

- `key` = 예약 시각 `"HH:MM"`(JST). `title` / `body` 는 알림 배너용 요약(단어·읽기·뜻 + 문법 노트 1줄).
- 각 슬롯이 알림용 요약뿐 아니라 **문장 원본(`sentenceJP` / `readingHiragana` / `translationKR` / `kanjiNotes` / `grammarNotes`)까지** 담는다 — 윈도우가 이 파일 하나만으로 문장 알림까지 띄울 수 있게 하기 위함.

## 클라우드 생성 (GitHub Actions)

**스케줄:** `cron: "0 20 * * *"` — 20:00 UTC = **05:00 KST/JST**(KST·JST 둘 다 UTC+9, 서머타임 없음). 그날 첫 슬롯(09:00)보다 충분히 앞서 하루치를 만들어 둔다. ⚠️ GitHub Actions 의 schedule 은 정시를 보장하지 않는다 — 러너가 붐비면 수 분~1시간 늦거나 아예 건너뛸 수 있다. 다운스트림(폰 알림 예약 등)은 여유를 두고 실행할 것.

**하는 일** (`scripts/generate-day.mjs`)

1. Gist `n1-state.json` 을 읽는다. 없으면 레포 커리큘럼(`n1.SEED`)으로 초기화(`INIT_PROGRESS_INDEX` 로 시작 진도 지정 가능).
2. `n1.planDay()` — 아이폰과 공유하는 순수 함수 — 로 그날 슬롯을 계획한다.
3. 신규 한자는 `n1.compose()` 로 OpenRouter 호출. 실패 시 지수 백오프 3회 재시도(1s→2s→4s), 그래도 안 되면 그 칸은 복습으로 대체하고 계속.
4. `n1-today.json`(사용자에게 보이는 산출물) → `n1-state.json`(전진된 상태) 순으로 Gist 에 PATCH.
5. 같은 날 두 번 돌면 진도가 두 번 전진하지 않도록 건너뛴다(`s.lastPlannedDate` 가드, `--force` 로 무시).

**수동 실행 / 로컬 확인**

- GitHub: Actions 탭 → `generate-day` → Run workflow (`dry_run` 체크 시 API·PATCH 없이 계획만).
- 로컬: `node scripts/generate-day.mjs --dry-run` (토큰 없이 계획만). 특정 상태로 확인하려면 `FIXTURE_STATE=path/to/state.json node scripts/generate-day.mjs --dry-run`.

## 슬롯 계획 규칙 (planDay · 코드 기본값)

| 항목 | 값 | 오버라이드 키 |
| --- | --- | --- |
| 커리큘럼 | 706자 (N2 고빈도 → N1 고빈도) | `n1.SEED.kanjiList` |
| 슬롯 그리드 | 09:00 ~ 23:00, 15분 간격 → **57칸** | `START_HOUR` / `END_HOUR` / `INTERVAL_MIN` |
| 신규/복습 | 슬롯 분(分)이 30의 배수면 신규 → **신규 29칸 / 복습 28칸** | `NEW_EVERY_MIN` |
| 한자당 예문 수 | 예문 3개를 만든 뒤에야 다음 한자로 전진 | `REPS_PER_KANJI` |
| 신규 중단일 | `2026-11-12` 이후로는 신규 0, 순수 복습만 (스페이싱 효과) | `NEW_CUTOFF_DATE` (`null` 이면 무기한 신규) |
| 복습 선택 | 가중 랜덤 — 적게 노출됐거나 "외웠음" 안 된 문장일수록 뽑힐 확률↑ | — |

이 키들은 `scripts/generate-day.mjs` 의 `cfg` 나 아이폰 `stub.js` 의 `CFG` 에서 덮어쓸 수 있다(현재는 양쪽 다 전부 기본값).

## 아이폰 (Scriptable)

### 설치

1. `n1-config.js` 를 Scriptable 스크립트로 만들고 상단 상수에 실제 값을 채운 뒤 **한 번** 실행 → Keychain 에 저장된다:
   `N1_OPENROUTER_KEY` · `N1_MODEL` · `N1_GIST_ID` · `N1_GIST_TOKEN`.
   (아이폰은 OpenRouter 를 호출하지 않지만 키는 config 스키마에 남아 있다. Gist 업로드(`n1-cloud`)에는 `N1_GIST_TOKEN` 이 필요하다.)
2. `stub.js` 내용을 스크립트 6개에 **똑같이** 붙여넣고 **이름만** 다르게 짓는다:
   `n1-generate` / `n1-day` / `n1-widget` / `n1-review` / `n1-watchday` / `n1-cloud`.
   - 동작은 `Script.name()` 에서 자동 판별한다(`n1-` 접두사·대소문자·구분자 무시). 매핑에 없는 이름은 `generate` 로 폴백되니 **오타 주의.**
   - 로직(`n1.js`)은 매 실행 때 raw URL 에서 fetch 하므로 **GitHub 에 푸시하면 폰에 자동 반영된다.** 폰에서 다시 붙여넣어야 하는 건 `stub.js` 자체가 바뀔 때뿐이다.
   - raw URL: `https://raw.githubusercontent.com/DeanYoon/n1-kanji/main/n1.js` → `Scriptable/n1-kanji/n1.code.js` 로 캐시. 오프라인이면 마지막 성공 캐시를 쓴다.

### 스크립트별 역할

| 스크립트 | 하는 일 | OpenRouter | state 쓰기 |
| --- | --- | --- | --- |
| `n1-day` | Gist(`n1-today.json` + `n1-state.json`)를 읽어 오늘치를 iOS 로컬 알림으로 예약. 원격 진도를 로컬에 통째로 반영. 클라우드 데이터가 없으면 **명확히 실패**하고 로컬 생성 폴백은 **안 한다.** `N1_GIST_ID` + `N1_GIST_TOKEN` 필수. | 안 함 | 함 |
| `n1-generate` | 이력에서 가중 랜덤 복습 1건을 알림으로 표시. **AI 생성 없음.** 이력이 없으면 "n1-cloud 를 먼저 실행" 안내. (Gist 설정 시 그 1칸을 `n1-today.json` 에 미러링) | 안 함 | 함 |
| `n1-widget` | 잠금/홈 위젯. 현재 항목을 문장·후리가나·번역·단어/문법으로 렌더. 탭하면 상세 팝업(닫기/다음). | 안 함 | 탭 시 showCount만 |
| `n1-review` | 이력 전체 목록(UITable) + "외웠음" 토글 + 단어/문법. 열면 현재 항목을 먼저 모달로. 토글 시 `updatedAt` 을 갱신해 `n1-cloud` 가 업로드하도록 한다. | 안 함 | 함 |
| `n1-watchday` | 애플워치용 단어 알림을 하루치 예약(아이폰 알림이 워치로 미러링됨). state 는 읽기만 하고 **쓰기를 전혀 안 한다** — 진도·복습 판정에 0% 영향. 기본 09:00~19:00, 10분 간격 = 61칸. | 안 함 | 안 함 |
| `n1-cloud` | 로컬에서만 바뀌는 값("외웠음" 등)을 담은 `n1-state.json` 을 **필요할 때만 단방향 업로드**(로컬 `updatedAt` 이 원격보다 최신일 때만; 원격이 더 최신이면 덮어쓰지 않고 알림). **슬롯은 안 건드린다.** | 안 함 | 안 함(업로드만) |

### iOS 알림 64개 제한

iOS 는 앱당 로컬 알림을 최대 64개까지만 예약한다. `n1-day`(최대 57칸)와 `n1-watchday`(기본 61칸)를 **동시에 자동화하면 초과한다** — 둘 중 하나만 쓸 것. `n1-watchday` 를 쓰려면 `n1-day` 자동화를 끈다.

### 상태 파일

아이폰: `Scriptable/n1-kanji/n1_state.json`(기기 안). iCloud 사용 가능하면 iCloud, 아니면 로컬 FileManager.

## 윈도우

`n1-windows-notify.ps1` — **완전 읽기 전용.** Gist 의 `n1-today.json` 만 GET 하고 POST/PATCH 는 절대 안 한다. 폰·클라우드 어느 쪽 데이터도 건드리지 않는다.

- **로컬 캐시:** `%LOCALAPPDATA%\n1-kanji\windows_today.json`
  `{ date, cyclePos, lastShownId, items: [{ id, targetKanji, title, body, sentenceJP, translationKR, showCount }] }`
  날짜(JST 기준)가 바뀌었거나 캐시가 비었을 때만 Gist 를 새로 받아오고, 그날 안에는 이 캐시만 쓴다. 아직 오늘치 클라우드 생성 전이면 목록이 비어 있고, 비어 있는 동안은 5분마다 계속 재시도한다.
- **단어/문장 순환:** `n1-today.json` 의 슬롯을 id 기준으로 중복 제거해 후보 목록을 만들고, 노출 횟수(`showCount`)가 가장 적은 후보들 중 무작위로 하나 고른다. **단어 알림 5번(클라우드가 만든 `title`/`body` 그대로) → 방금 고른 항목의 문장 알림 1번(`sentenceJP` + `translationKR`)**, 그리고 사이클 반복. 단어 10초, 문장 20초.
- **작업 스케줄러 등록**(스크립트 하단 주석) — 5분 간격:
  ```powershell
  $Action  = New-ScheduledTaskAction -Execute "powershell.exe" -Argument '-ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\Users\<사용자>\n1-kanji\n1-windows-notify.ps1"'
  $Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
  $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
  Register-ScheduledTask -TaskName "N1KanjiNotify" -Action $Action -Trigger $Trigger -Settings $Settings -Force
  ```

## 설정 요약

### GitHub Actions secrets (레포 Settings → Secrets and variables → Actions)

| 이름 | 용도 |
| --- | --- |
| `OPENROUTER_KEY` | OpenRouter API 키 (`sk-or-…`) |
| `GIST_TOKEN` | `gist` scope 만 있는 GitHub PAT — `n1-today.json` / `n1-state.json` 쓰기용 |

`GIST_ID` 는 워크플로 `env:` 에 없으면 `scripts/generate-day.mjs` 의 기본값(`3c7a0d99…`)을 쓴다. 바꾸려면 워크플로 `env:` 에 `GIST_ID` 를 추가한다.

### 아이폰 Keychain (`n1-config.js` 로 저장)

`N1_OPENROUTER_KEY` · `N1_MODEL` · `N1_GIST_ID` · `N1_GIST_TOKEN`

### 모델

현재 값: `openai/gpt-5.6-sol` (워크플로 `env.MODEL`, `n1.js` / `stub.js` / `n1-config.js` / `scripts/generate-day.mjs` 코드 기본값 모두 동일).

**워크플로 `env.MODEL` 과 아이폰 Keychain `N1_MODEL` 은 각각 따로 설정되며 자동 동기화되지 않는다** — 모델을 바꿀 때는 양쪽 다 손봐야 클라우드·폰이 어긋나지 않는다. (실제 OpenRouter 호출은 클라우드만 하므로 실질 영향은 워크플로 쪽이지만, 폰 Keychain 값도 관례상 맞춰 둔다.)

## 주의

레포는 public 이다. 실제 토큰(`ghp_…` / `sk-or-…` / `sk-…`)을 커밋하지 않는다. `n1-config.js` 는 플레이스홀더 버전만 올린다 — 실제 키는 각 기기에서 로컬로 채워 실행한다.
