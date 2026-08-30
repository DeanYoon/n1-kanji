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
