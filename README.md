# n1-kanji

JLPT N2·N1 한자 학습 — 예문 생성은 클라우드(GitHub Actions), 알림·위젯·복습은 아이폰(Scriptable).

- **`n1.js`** — 로직 전체 (커리큘럼 706자, 예문 생성, 위젯, 이력). 폰 껍데기가 이 파일을 원격에서 읽어 실행하고, 클라우드 생성기도 이 파일의 순수 함수(`planDay` / `composeNewEntry` / `compose` …)를 그대로 재사용한다. 단일 파일이며, `typeof FileManager` 유무로 폰/Node 를 구분해 HTTP 전송 계층만 갈아끼운다 (빌드 단계·추가 fetch 없음, 오프라인 캐시 그대로).
- **`scripts/generate-day.mjs`** — 클라우드 하루치 생성기 (Node 20+, 의존성 없음). Gist 에서 상태를 읽어 `n1.planDay()` 로 그날 슬롯을 계획하고, 신규 한자는 OpenRouter 로 예문 생성, 결과를 Gist 의 `n1-today.json` 에, 전진된 상태를 `n1-state.json` 에 올린다. → [아래 "클라우드 생성" 참고](#클라우드-생성-github-actions).
- **`.github/workflows/generate-day.yml`** — 위 스크립트를 매일 한국시간 새벽 5시에 실행. 수동 실행(`workflow_dispatch`, `dry_run`/`force` 옵션)도 가능.
- **`n1-config.js`** — Scriptable에서 **한 번만** 실행. `OPENROUTER_KEY`/`MODEL`/`GIST_ID`/`GIST_TOKEN`을 Keychain(기기 안 보관함)에 저장.
- **`stub.js`** — Scriptable에 넣을 껍데기 템플릿. 각 스크립트(`n1-generate` / `n1-day` / `n1-widget` / `n1-review` / `n1-watchday` / `n1-cloud`)에 **똑같은 코드**를 붙여넣고 **스크립트 이름만** 다르게 지으면 됨 — 동작(`ACTION`)은 `Script.name()`(스크립트 파일명)에서 자동 판별. `n1-` 접두사·대소문자·구분자는 무시하고, 못 알아보면 `generate`로 폴백. 키는 Keychain에서 자동으로 읽어오므로 스크립트마다 따로 넣지 않음.
- **`n1-cloud`** — 폰 로컬과 Gist 를 탭 한 번에 맞춘다. ① 오늘치 슬롯(`n1-today.json`)을 양방향 동기화하고 `UITable`로 목록(시각·제목·단어)을 보여줌(행 탭 → 본문 전문). ② **폰 전체 상태를 Gist 의 `n1-state.json` 으로 올린다** — 원격에 없으면 시드, 있으면 로컬 `updatedAt` 이 더 최신일 때만(원격이 더 최신이면 덮어쓰지 않고 알림). 즉 **n1-cloud 를 한 번 실행하면 폰 진도가 Gist 에 올라가므로, 클라우드 첫 실행 전에 수동으로 상태를 붙여넣을 필요가 없다.** `GIST_ID` + `GIST_TOKEN`(상태 업로드는 쓰기 권한 필요)이 있어야 동작.

## 클라우드 생성 (GitHub Actions)

**목표:** 폰이 꺼져 있거나 인터넷이 없어도, 그날치(09:00~23:00) 슬롯이 미리 만들어져 Gist 에 올라가 있게 하는 것.

**흐름**

1. 매일 20:00 UTC(= 05:00 KST)에 `generate-day` 워크플로가 돈다.
2. `scripts/generate-day.mjs` 가 Gist(`n1-state.json`)에서 클라우드 상태를 읽는다. 없으면 레포 커리큘럼(`n1.SEED`)으로 초기화 (`INIT_PROGRESS_INDEX` 로 시작 진도 지정 가능). — 이 `n1-state.json` 은 폰에서 **n1-cloud 를 한 번 실행하면** 폰 상태가 그대로 올라가므로, 손으로 만들 필요 없다.
3. `n1.planDay()` — **폰의 `n1-day` 와 완전히 같은 함수·규칙** — 으로 그날 슬롯을 계획한다. 정시·30분마다 신규 한자 1개, 나머지는 가중 랜덤 복습.
4. 신규 한자는 OpenRouter(`n1.compose`)로 예문 생성. 실패 시 지수 백오프 3회 재시도, 그래도 안 되면 그 칸은 복습으로 대체.
5. `{date, slots:[{key,title,body}], updatedAt}` 을 Gist 의 `n1-today.json` 에, 전진된 상태를 `n1-state.json` 에 PATCH.

**필요한 secrets** (레포 Settings → Secrets and variables → Actions)

| 이름 | 용도 |
| --- | --- |
| `OPENROUTER_KEY` | OpenRouter API 키 (`sk-or-…`) |
| `GIST_TOKEN` | `gist` scope 만 있는 GitHub PAT — `n1-today.json` / `n1-state.json` 쓰기용 |

`GIST_ID` 는 기본값(`3c7a0d99f309aa0dfea3861a7df296d4`)을 쓰며, 바꾸려면 워크플로 `env:` 에 `GIST_ID` 를 추가한다. `MODEL` 기본값은 `anthropic/claude-sonnet-5`.

**수동 실행 / 로컬 확인**

- GitHub: Actions 탭 → `generate-day` → **Run workflow** (`dry_run` 체크 시 API·PATCH 없이 계획만).
- 로컬: `node scripts/generate-day.mjs --dry-run` (토큰 없이 계획만 확인). 특정 상태로 확인하려면 `FIXTURE_STATE=path/to/state.json node scripts/generate-day.mjs --dry-run`.
- 같은 날 두 번 돌면 커리큘럼이 두 번 전진하지 않도록 자동으로 건너뛴다 (`--force` 로 무시).

**아직 폰이 담당하는 것** (다음 단계에서 이전 예정)

- `n1-review` "외웠음" 체크 등 **상태 쓰기**. 폰은 여전히 로컬 `n1_state.json` 을 쓴다.
- 로컬 알림 예약(`n1-day`), 위젯(`n1-widget`), 애플워치 알림(`n1-watchday`).
- 즉, 지금은 **클라우드가 자기 상태(Gist `n1-state.json`)를 따로 들고** 하루치를 만들고, 폰은 기존대로 동작한다. 두 상태의 통합은 다음 단계 — 다만 폰에서 **n1-cloud** 를 돌리면 폰 진도가 `n1-state.json` 으로 단방향 업로드되므로(로컬이 더 최신일 때만), 클라우드가 폰 진도를 이어받는 흐름은 이미 가능하다.

## 최신 코드 URL

```
https://raw.githubusercontent.com/DeanYoon/n1-kanji/main/n1.js
```

껍데기가 매 실행 때 이 URL을 fetch → `n1-kanji/n1.code.js` 로 캐시. `n1.js` 를 수정·커밋하면 다음 실행부터 자동 반영. (오프라인이면 마지막 성공 캐시 사용)

## 상태 파일

- **폰**: 진도·이력은 기기 안 `Scriptable/n1-kanji/n1_state.json`.
- **클라우드**: Gist 의 `n1-state.json`. 폰 상태와 동일한 스키마이며, **n1-cloud** 실행 시 폰 상태가 이 파일로 업로드된다(원격이 더 최신이면 보존). 하루치 산출물은 Gist 의 `n1-today.json`.

레포엔 코드만.

## n1-day 노출 방식

기본값: 09:00~23:00, **15분 간격**(57칸). 매 정시(9:00, 10:00 …)는 **신규 한자 1개** 생성(API 호출), 나머지 슬롯은 이력에서 **가중 랜덤 복습** — 적게 노출됐거나 아직 "외웠음" 체크 안 된 문장일수록 뽑힐 확률이 높아서, 장기적으로 모든 문장이 비슷한 빈도로 노출됩니다. 신규 생성 빈도(=API 호출 수)는 시간당 1개로 그대로라 비용은 안 늘어남. (10분 간격으로 하려면 iOS 64개 제한 때문에 19:30까지밖에 못 감 — 23시까지 커버하려고 15분으로 조정)

범위·간격은 `CFG.START_HOUR` / `END_HOUR` / `INTERVAL_MIN` / `NEW_EVERY_MIN` 으로 조절. 단, iOS는 앱당 로컬 알림을 최대 64개까지만 예약 가능하므로 `(END_HOUR-START_HOUR)*60/INTERVAL_MIN + 1` 이 64를 넘지 않게(기본값은 57).
