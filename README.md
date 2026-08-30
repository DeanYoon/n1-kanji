# n1-kanji

JLPT N2·N1 한자 학습 — 아이폰 온디바이스 (Scriptable).

- **`n1.js`** — 로직 전체 (커리큘럼 706자, 예문 생성, 위젯, 이력, 문법 설명).
  Scriptable 껍데기가 이 파일을 원격에서 읽어 실행. `module.exports = { run, generate, day, widget, review }`.
- **`stub.js`** — Scriptable에 넣을 껍데기. **스크립트 1개면 충분** — `run` 이 실행 맥락(위젯 / 자동화 파라미터 / 앱 탭)을 감지해 분기.

## 최신 코드 URL

```
https://raw.githubusercontent.com/DeanYoon/n1-kanji/main/n1.js
```

껍데기가 매 실행 때 fetch → `n1-kanji/n1.code.js` 로 캐시. `n1.js` 수정·커밋 시 다음 실행부터 자동 반영. (오프라인이면 마지막 성공 캐시 사용)

## 쓰는 법

Scriptable에 스크립트 1개(`n1`) 만들고 `stub.js` 붙여넣기 → `OPENROUTER_KEY` 채우기.

- **위젯**: 홈/잠금 화면 위젯의 Script를 `n1` 으로 → `run` 이 위젯 렌더
- **자동화**: 단축어 시각 자동화(아침) → Run Script `n1`, **Parameter = `day`** → 그날 알림 일괄 예약
- **수동**: Scriptable에서 `n1` 탭 → 메뉴(generate / day / review)

## 상태 파일

진도·이력은 기기 안 `Scriptable/n1-kanji/n1_state.json`. 레포엔 코드만.
