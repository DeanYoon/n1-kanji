# n1-kanji

JLPT N2·N1 한자 학습 — 아이폰 온디바이스 (Scriptable).

- **`n1.js`** — 로직 전체 (커리큘럼 706자, 예문 생성, 위젯, 이력). Scriptable 껍데기가 이 파일을 원격에서 읽어 실행.
- **`stub.js`** — Scriptable에 넣을 껍데기 템플릿. 4개 스크립트(`n1-generate` / `n1-day` / `n1-widget` / `n1-review`)가 이 껍데기를 공유하고 `ACTION` 값만 다르게.

## 최신 코드 URL

```
https://raw.githubusercontent.com/DeanYoon/n1-kanji/main/n1.js
```

껍데기가 매 실행 때 이 URL을 fetch → `n1-kanji/n1.code.js` 로 캐시. `n1.js` 를 수정·커밋하면 다음 실행부터 자동 반영. (오프라인이면 마지막 성공 캐시 사용)

## 상태 파일

진도·이력은 기기 안 `Scriptable/n1-kanji/n1_state.json`. 여기(레포)엔 코드만.

## n1-day 노출 방식

기본값: 09:00~19:00, **10분 간격**(61칸). 매 정시(9:00, 10:00 …)는 **신규 한자 1개** 생성(API 호출), 나머지 슬롯은 이력에서 **가중 랜덤 복습** — 적게 노출됐거나 아직 "외웠음" 체크 안 된 문장일수록 뽑힐 확률이 높아서, 장기적으로 모든 문장이 비슷한 빈도로 노출됩니다. 신규 생성 빈도(=API 호출 수)는 시간당 1개로 그대로라 비용은 안 늘어남.

범위·간격은 `CFG.START_HOUR` / `END_HOUR` / `INTERVAL_MIN` / `NEW_EVERY_MIN` 으로 조절. 단, iOS는 앱당 로컬 알림을 최대 64개까지만 예약 가능하므로 `(END_HOUR-START_HOUR)*60/INTERVAL_MIN + 1` 이 64를 넘지 않게(기본값은 61).
