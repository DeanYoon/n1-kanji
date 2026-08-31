"use strict";
const OPENROUTER_KEY = "여기에_OPENROUTER_KEY";
const MODEL = "anthropic/claude-sonnet-5";
const GIST_ID = "";
const GIST_TOKEN = "";

Keychain.set("N1_OPENROUTER_KEY", OPENROUTER_KEY);
Keychain.set("N1_MODEL", MODEL);
Keychain.set("N1_GIST_ID", GIST_ID);
Keychain.set("N1_GIST_TOKEN", GIST_TOKEN);

const a = new Alert();
a.title = "저장 완료";
a.message = "설정을 이 기기에 저장했습니다.\n이제 n1-generate·n1-day·n1-widget·n1-review 가 자동으로 읽어갑니다." +
  (GIST_ID && GIST_TOKEN ? "\n\n클라우드 동기화(Gist) 켜짐." : "\n\n클라우드 동기화(Gist)는 비워둬서 꺼짐 — 나중에 켜려면 이 스크립트를 다시 열어 GIST_ID/GIST_TOKEN을 채우고 재실행.");
a.addAction("확인");
await a.present();
Script.complete();
