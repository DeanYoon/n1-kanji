"use strict";
// ===== N1 한자 학습 · Scriptable 껍데기 =====
// 먼저 n1-config 를 한 번 실행해 키를 저장해두세요.
// 이 껍데기는 4개 스크립트(n1-generate/n1-day/n1-widget/n1-review) 전부 동일 —
// 바꿀 건 ACTION 한 줄뿐입니다.

const CFG = {
  OPENROUTER_KEY: Keychain.contains("N1_OPENROUTER_KEY") ? Keychain.get("N1_OPENROUTER_KEY") : "",
  MODEL: Keychain.contains("N1_MODEL") ? Keychain.get("N1_MODEL") : "anthropic/claude-sonnet-5",
  GIST_ID: Keychain.contains("N1_GIST_ID") ? Keychain.get("N1_GIST_ID") : "",
  GIST_TOKEN: Keychain.contains("N1_GIST_TOKEN") ? Keychain.get("N1_GIST_TOKEN") : ""
  // 필요하면 여기에 추가로 넣기(선택, 안 넣으면 기본값 사용):
  // START_HOUR: 9, END_HOUR: 19, INTERVAL_MIN: 10, NEW_EVERY_MIN: 60, SCALE: 1.15, MINS: 0.4
};
const SRC = "https://raw.githubusercontent.com/DeanYoon/n1-kanji/main/n1.js";
const ACTION = "generate";   // ← 스크립트마다 다르게:  n1-generate→"generate"  n1-day→"day"  n1-widget→"widget"  n1-review→"review"

// ---------- 아래는 4개 모두 동일, 안 건드림 ----------
if(!CFG.OPENROUTER_KEY){
  const n = new Notification();
  n.title = "N1 설정 필요";
  n.body = "n1-config 스크립트를 먼저 한 번 실행해 키를 저장하세요.";
  await n.schedule();
  Script.complete();
} else {
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
}
