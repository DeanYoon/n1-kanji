"use strict";
// ===== N1 한자 학습 · Scriptable 껍데기 (스크립트 1개) =====
// 이 스크립트 하나로 위젯 · 자동화 · 수동 실행을 전부 처리합니다.
// 채울 곳은 OPENROUTER_KEY 하나. 나머지는 그대로.
// 로직은 GitHub(DeanYoon/n1-kanji · n1.js)에 있고, 실행 때마다 최신본을 읽어옵니다.

const CFG = {
  OPENROUTER_KEY: "여기에_OPENROUTER_KEY",              // openrouter.ai/keys  (sk-or-...)
  MODEL: "anthropic/claude-sonnet-5",                   // 또는 "google/gemini-2.5-flash"
  HOURS: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], // day 알림 시각
  SCALE: 1.15,                                          // 위젯 글자 배율
  MINS: 0.4                                             // 위젯 최소 축소율(작을수록 안 잘림)
};
const SRC = "https://raw.githubusercontent.com/DeanYoon/n1-kanji/main/n1.js";

// ---------- 아래는 안 건드림 ----------
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
await _mod.exports.run(CFG);
Script.complete();
