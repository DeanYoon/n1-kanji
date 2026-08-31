"use strict";
// ===== N1 한자 학습 · Scriptable 껍데기 =====
// 먼저 n1-config 를 한 번 실행해 키를 저장해두세요.
// 각 스크립트(n1-generate / n1-day / n1-widget / n1-review / n1-watchday / n1-cloud)에 이
// 코드를 "그대로" 붙여넣고 스크립트 이름만 그렇게 지어두면 됩니다.
// 동작은 스크립트 이름에서 자동 판별하므로 코드는 한 글자도 수정하지 않습니다.

const CFG = {
  OPENROUTER_KEY: Keychain.contains("N1_OPENROUTER_KEY") ? Keychain.get("N1_OPENROUTER_KEY") : "",
  MODEL: Keychain.contains("N1_MODEL") ? Keychain.get("N1_MODEL") : "anthropic/claude-sonnet-5",
  GIST_ID: Keychain.contains("N1_GIST_ID") ? Keychain.get("N1_GIST_ID") : "",
  GIST_TOKEN: Keychain.contains("N1_GIST_TOKEN") ? Keychain.get("N1_GIST_TOKEN") : ""
  // 필요하면 여기에 추가로 넣기(선택, 안 넣으면 기본값 사용):
  // START_HOUR: 9, END_HOUR: 19, INTERVAL_MIN: 10, NEW_EVERY_MIN: 60, SCALE: 1.15, MINS: 0.4
};
const SRC = "https://raw.githubusercontent.com/DeanYoon/n1-kanji/main/n1.js";

// 스크립트 이름에서 동작을 자동 판별 — 이 파일을 그대로 붙여넣고 이름만
// n1-generate / n1-day / n1-widget / n1-review / n1-watchday / n1-cloud 로 지어두면 됩니다.
// "n1-" 접두사·대소문자·하이픈/언더바/공백은 무시. 못 알아보면 generate로 폴백.
const ACTION = (function(){
  var n = "";
  try { n = Script.name() || ""; } catch(e){}
  n = String(n).trim().toLowerCase().replace(/^n1[-_ ]*/, "").replace(/[-_ ]/g, "");
  var MAP = { generate: "generate", gen: "generate", day: "day", widget: "widget", review: "review", watchday: "watchDay", watch: "watchDay", cloud: "cloud", gist: "cloud" };
  return MAP[n] || "generate";
})();

// ---------- 아래는 모든 스크립트 공통, 안 건드림 ----------
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
  const _fn = _mod.exports && _mod.exports[ACTION];
  if(typeof _fn !== "function"){
    throw new Error("동작 '" + ACTION + "' 을(를) n1.js 에서 찾을 수 없습니다 — 스크립트 이름을 n1-generate / n1-day / n1-widget / n1-review / n1-watchday / n1-cloud 중 하나로 지어주세요.");
  }
  await _fn(CFG);
  Script.complete();
}
