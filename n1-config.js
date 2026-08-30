"use strict";
// ===== N1 한자 학습 · 키 설정 (한 번만 실행) =====
// 아래 두 값을 채우고 하단 ▶ 로 딱 한 번 실행하세요.
// Keychain(이 기기 안의 보관함)에 저장되고, 이후 n1-generate / n1-day / n1-widget / n1-review
// 4개가 전부 여기서 자동으로 읽어갑니다 — 그 스크립트들엔 키를 안 넣어도 됩니다.
// 값을 바꾸고 싶으면 여기 고치고 다시 실행하면 덮어써집니다. 실행 후 이 스크립트는 지워도 되고 남겨둬도 됩니다.

const OPENROUTER_KEY = "여기에_OPENROUTER_KEY";   // openrouter.ai/keys  (sk-or-...)
const MODEL = "anthropic/claude-sonnet-5";        // 또는 "google/gemini-2.5-flash"

Keychain.set("N1_OPENROUTER_KEY", OPENROUTER_KEY);
Keychain.set("N1_MODEL", MODEL);

const a = new Alert();
a.title = "저장 완료";
a.message = "OPENROUTER_KEY / MODEL 을 이 기기에 저장했습니다.\n이제 n1-generate·n1-day·n1-widget·n1-review 가 자동으로 읽어갑니다.";
a.addAction("확인");
await a.present();
Script.complete();
