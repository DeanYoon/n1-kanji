"use strict";
// ===== N1 한자 학습 · Scriptable 껍데기 =====
// Scriptable에 이 껍데기로 스크립트 4개를 만들고, 아래 3가지만 채우세요.
// 로직은 GitHub(n1.js)에 있고, 실행 때마다 최신본을 읽어옵니다.

const CFG = {
  OPENROUTER_KEY: "여기에_OPENROUTER_KEY",   // openrouter.ai/keys  (sk-or-...)  — 4개 모두 동일
  MODEL: "anthropic/claude-sonnet-5",        // 또는 "google/gemini-2.5-flash"
  START_HOUR: 9,                             // n1-day: 알림 시작 시각
  END_HOUR: 19,                              // n1-day: 알림 끝 시각 (iOS 알림 최대 64개 제약으로 20시 대신 19시)
  INTERVAL_MIN: 10,                          // n1-day: 알림 간격(분) — 10분마다 노출
  NEW_EVERY_MIN: 60,                         // n1-day: 신규 한자는 몇 분마다(60=매시 정각마다 1개, 나머지는 복습)
  SCALE: 1.15,                               // 위젯 글자 배율
  MINS: 0.4                                  // 위젯 최소 축소율(작을수록 안 잘림)
};
const SRC = "https://raw.githubusercontent.com/DeanYoon/n1-kanji/main/n1.js";
const ACTION = "generate";   // ← 스크립트마다 다르게:  n1-generate→"generate"  n1-day→"day"  n1-widget→"widget"  n1-review→"review"

// ---------- 아래는 4개 모두 동일, 안 건드림 ----------
const _fm = (function(){ try { var g = FileManager.iCloud(); g.documentsDirectory(); return g; } catch(e){ return FileManager.local(); } })();
const _dir = _fm.joinPath(_fm.documentsDirectory(), "n1-kanji");
if(!_fm.fileExists(_dir)) _fm.createDirectory(_dir, true);
const _cache = _fm.joinPath(_dir, "n1.code.js");

let _code = null;
try {
  _code = await new Request(SRC).loadString();
  if(_code && _code.indexOf("module.exports") >= 0) _fm.writeString(_cache, _code);
  else if(_fm.fileExists(_cache)) _code = _fm.readString(_cache);
} catch(e){
  if(_fm.fileExists(_cache)) _code = _fm.readString(_cache);
}
if(!_code) throw new Error("n1.js 를 불러올 수 없습니다 — SRC URL·네트워크 확인");

const _mod = {};
new Function("module", _code)(_mod);
await _mod.exports[ACTION](CFG);
Script.complete();
