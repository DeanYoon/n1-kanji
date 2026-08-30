// ===== N1 한자 학습 · 통합 모듈 (n1.js) =====
// Scriptable 껍데기 스크립트가 이 파일을 원격에서 불러 실행합니다.
// 로직 수정은 전부 여기서만. 껍데기는 다시 안 건드려도 됩니다.
// VERSION 2026-08-30i

var DIR_NAME = "n1-kanji", FILE_NAME = "n1_state.json";

function getFM(){
  try { var g = FileManager.iCloud(); g.documentsDirectory(); return g; }
  catch(e){ return FileManager.local(); }
}
function stateDir(fm){
  var d = fm.joinPath(fm.documentsDirectory(), DIR_NAME);
  if(!fm.fileExists(d)) fm.createDirectory(d, true);
  return d;
}
function statePath(fm){ return fm.joinPath(stateDir(fm), FILE_NAME); }
async function readState(){
  var fm = getFM(), p = statePath(fm);
  if(!fm.fileExists(p)) return null;
  try { if(fm.isFileStoredIniCloud(p) && !fm.isFileDownloaded(p)) await fm.downloadFileFromiCloud(p); } catch(e){}
  try { return JSON.parse(fm.readString(p)); } catch(e){ return null; }
}
function writeState(s){ var fm = getFM(); fm.writeString(statePath(fm), JSON.stringify(s)); }

function nowISO(){ return new Date().toISOString().replace(/\.\d{3}Z$/, "Z"); }
function dateJST(){ return new Date(Date.now() + 9*3600*1000).toISOString().slice(0,10); }
function slotT(e){ return Date.parse(e.lastSlotAt || e.lastShownAt || e.id) || 0; }

// ---------- 커리큘럼: N2 고빈도 → N1 고빈도 (706자) ----------
var SEED = {
  kanjiList: "丈介伸依偉偶傾叫含咲喫埋域塗墨奥姓委娘封岸巡彼御怒怖恋恐恥悩憎戻押捜据掃掘掛昇曇柔殿沸泊泥涙涼渡湿準濃爆猫甘疲皆眠磨祈突籍粒緊締縫繁繰缶罰羅翼耐聴肌胃脚腕膚膜膨致舞舟舶芝菊薄融衝袋裂裕裸褒覆触訂託訟訴診詐詩詰詳誇誓誘請譲豚豪貢販賛賠賢購贈超趣距跳踏躍軒軟軸輩込迅迎迫途逮遅遣遭遷遺避郊郎酢銘銭鋭鎖闘陣陰陳隔隠隻雅雇雷需霜霧露響頻頼顧飢飾餓駄駆騎騒騰驚髪鬼魂魅魔麗仁仮仰企伊伏伐伯伴価侵促俊保修俳倉倫偏健偽傍傑催債傷僕僚僧儀充克免典兼冒冠准凝凡凶刀刃刑削剛剣創功劣励勘勧勲匠匿升卑卓博即却厳又及叔句司吉后吐哀哲唆唯唱啓善喚喪嘆嘉器囚坑坪垂執培基堅堤塁塊塑塾墓墜墳壁壇壊士壮奇奈奉奔奏契奪奮奴如妙妨姫姿威婆媒嫁嫌孔孤宗宙宜宣宮宰宴密寛寧審寮寸射尋尚就尺尼尽尾屈展属履岐岳峠峡峰崇崩嵐巣巧己帆帝帳幕幣幹幻幽序庶康庸廃廊廉廷弁弓弔弦弧張弾彩彫影往征径徐従微徳徴徹忌忍志応忠怠怪恒恨恩恵悔悟悦惑惜惨惰愁愚慈態慎慕慢慮慰慶憂憤憩憲憶懇懸我戒房扇扶批把抑抗択披抵抽拍拒拓拘拠拡括挑挙振授掌排推措掲描提揚握揮援揺搬搭携摂摘摩撃撤撮擁操攻故敏救敢整敵敷斉斜施旗既旨旬旭昆昭是晶暁暑暇暖暦暫曹朗朱朴朽杉李条松析架柄染柳栗株核栽桃案桑桜梅梨棄棋棚棟検概標模樹欄欺款歓殊殖殴殻氏汁江汽沖没沢沼沿泡泣泰洞津洪派浄浜浦浩浪浸涯淡添渇渉渋渓渦湧滋滞源溝滅滑滝漂漆漏漠漫漬潔潜潤潮澄激濁瀬災炉炊炎為烈焦煮煩熊熟黙牧狂狩独狭猛猟献猶猿獄獣獲玄率琴環甚甲畔異疫疾症痘痢痴癒癖皇盆益盛盟監盤盲盾眉看眺眼督睡瞬瞳矛矢矯砕砲硝硫碑磁礁礎祥票視禅禍秀秘租秩称稚稲稼稿穀穂穏穴窃窒窮窯竜端笛第筋策節箇範篤粋粗粘糖糧系糾紀紋納級紛素紡索紫累紳紺結絞統絹継維綱網".split(""),
  progressIndex: 0, cycle: 1, runCounter: 0,
  history: []
};

// ---------- 예문 생성 (OpenRouter) ----------
async function compose(cfg, kanji){
  var prompt =
"당신은 JLPT 일본어 예문 작성기입니다. 목표 한자: 「" + kanji + "」\n\n" +
"「" + kanji + "」를 사용한 자연스럽고 짧은(약 10~25자) 일본어 문장 1개를 만드세요. " +
"목표 한자는 실제로 자주 쓰이는 용법으로, 문장의 나머지 어휘는 JLPT N2 중심(필요하면 N1)으로 구성하세요. " +
"너무 쉬운 N4/N5 남발도, 너무 마이너한 어휘도 피하세요.\n\n" +
"다음 JSON 객체 하나만 출력하세요. 코드블록·설명·그 외 텍스트 금지:\n" +
'{"sentenceJP":"...","readingHiragana":"문장 전체를 히라가나로","translationKR":"자연스러운 한국어 번역","kanjiNotes":[{"word":"...","reading":"...","meaningKR":"..."}],"grammarNotes":[{"point":"...","meaningKR":"..."}]}\n\n' +
"kanjiNotes: 문장 속 핵심 단어 2~4개(word·reading·meaningKR). 「" + kanji + "」가 들어간 단어를 반드시 하나 넣으세요.\n" +
"grammarNotes: 이 문장에 쓰인 문법·표현 1~3개. point=문형, meaningKR=쓰임과 뜻을 한 줄로. 기초 조사나 너무 뻔한 건 빼고, 중급 이상 학습자가 헷갈릴 만한 것 위주. 별도 표시는 붙이지 마세요.";

  var res = await callOpenRouter(cfg, prompt, true);
  // 일부 모델(예: Gemini 3.1 Pro)은 reasoning 끄기 자체를 거부(400) — 그때만 켜서 재시도
  if(res && res.error && /reasoning/i.test(JSON.stringify(res.error))){
    res = await callOpenRouter(cfg, prompt, false);
  }
  if(res && res.error) throw new Error("API: " + (res.error.message || JSON.stringify(res.error)));
  var msg = res && res.choices && res.choices[0] && res.choices[0].message;
  if(!msg || !msg.content) throw new Error("API 응답 형식 오류: " + JSON.stringify(res).slice(0, 300));
  var t = String(msg.content).trim();
  var a = t.indexOf("{"), b = t.lastIndexOf("}");
  if(a >= 0 && b > a) t = t.slice(a, b + 1);
  try {
    return JSON.parse(t);
  } catch(e){
    throw new Error("모델이 JSON 형식을 안 지킴: " + t.slice(0, 200));
  }
}

// max_tokens를 넉넉히 잡고(추론형 모델도 안 잘리게), 이 작업엔 깊은 추론이 불필요하므로
// 기본은 reasoning 끔(속도·비용 절약). 끄기 자체를 거부하는 모델만 compose()에서 재시도.
async function callOpenRouter(cfg, prompt, disableReasoning){
  var req = new Request("https://openrouter.ai/api/v1/chat/completions");
  req.method = "POST";
  req.headers = {
    "Authorization": "Bearer " + cfg.OPENROUTER_KEY,
    "Content-Type": "application/json",
    "X-Title": "N1 Kanji"
  };
  var body = {
    model: cfg.MODEL || "anthropic/claude-sonnet-5",
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  };
  if(disableReasoning) body.reasoning = { enabled: false };
  req.body = JSON.stringify(body);
  return await req.loadJSON();
}

function pickReview(history){
  var fresh = history.filter(function(e){ return !e.reviewed; });
  var pool = fresh.length ? fresh : history;
  return pool.reduce(function(a, b){ return (a.lastShownAt <= b.lastShownAt ? a : b); });
}

// 가중 랜덤 복습 선택: 적게 노출됐을수록, "외웠음" 아직 안 됐을수록 뽑힐 확률이 높음.
// 완전 랜덤이 아니라 "장기적으로 모든 문장이 비슷한 빈도로 노출"되도록 역빈도 가중.
// sessionBumps: 아직 저장은 안 됐지만 "이번 하루치 빌드에서 이미 뽑았다"는 걸 반영해
//               같은 배치 안에서 같은 문장이 연달아 뽑히지 않게 하는 임시(메모리) 가중치.
function pickWeightedReview(history, sessionBumps){
  if(!history.length) return null;
  var weights = [], total = 0, i;
  for(i = 0; i < history.length; i++){
    var e = history[i];
    var extra = (sessionBumps && sessionBumps[e.id]) || 0;
    var w = 1 / ((e.showCount || 1) + extra + 1);
    if(e.reviewed) w *= 0.4;   // 이미 외운 건 완전히 빼진 않고 가끔만
    weights.push(w);
    total += w;
  }
  var r = Math.random() * total;
  for(i = 0; i < history.length; i++){
    r -= weights[i];
    if(r <= 0) return history[i];
  }
  return history[history.length - 1];
}
function pad2(n){ return (n < 10 ? "0" : "") + n; }

// 예약만 해두고 아직 실제 노출 시각이 안 지난 복습은 showCount를 올리지 않다가,
// 시각이 지나면(=실제로 알림이 떴을 시점) 그제서야 반영. "만들기만 했는데 복습 횟수가
// 벌써 올라가 있는" 문제를 막기 위함. generate/day/widget/review 시작할 때마다 호출.
function reconcile(s){
  if(!Array.isArray(s.pending) || !s.pending.length) return;
  var now = Date.now(), remain = [];
  for(var i = 0; i < s.pending.length; i++){
    var p = s.pending[i];
    if(Date.parse(p.slotISO) <= now){
      for(var j = 0; j < s.history.length; j++){
        if(s.history[j].id === p.id){
          var e = s.history[j];
          e.showCount = (e.showCount || 1) + 1;
          e.lastShownAt = p.slotISO;
          e.lastSlotAt = p.slotISO;
          e.mode = "review";
          break;
        }
      }
    } else {
      remain.push(p);
    }
  }
  s.pending = remain;
}

function current(s){
  var h = s.history || [];
  if(!h.length) return null;
  var now = Date.now(), best = null, bt = -1;
  for(var i = 0; i < h.length; i++){
    var tt = slotT(h[i]);
    if(tt <= now && tt > bt){ bt = tt; best = h[i]; }
  }
  if(best) return best;
  return h.reduce(function(a, b){ return (slotT(a) <= slotT(b) ? a : b); });
}

async function notify(id, title, body, triggerDate){
  var n = new Notification();
  n.identifier = id;
  n.threadIdentifier = "n1-kanji";
  n.title = title;
  n.body = body;
  n.sound = "default";
  if(triggerDate) n.setTriggerDate(triggerDate);
  await n.schedule();
}

// 한 칸 진행(신규/복습). s 를 그 자리에서 수정하고 {cur, mode} 반환.
async function advanceOne(cfg, s, slotISO){
  if(!Array.isArray(s.history)) s.history = [];
  var mode = (s.runCounter % 2 === 1 && s.history.length > 0) ? "review" : "new";
  var cur;
  if(mode === "new"){
    var kanji = s.kanjiList[s.progressIndex];
    var c = await compose(cfg, kanji);
    cur = {
      id: slotISO + "#" + s.runCounter, date: dateJST(), targetKanji: kanji,
      sentenceJP: c.sentenceJP, readingHiragana: c.readingHiragana, translationKR: c.translationKR,
      kanjiNotes: Array.isArray(c.kanjiNotes) ? c.kanjiNotes : [],
      grammarNotes: Array.isArray(c.grammarNotes) ? c.grammarNotes : [],
      reviewed: false, lastShownAt: slotISO, lastSlotAt: slotISO, showCount: 1, mode: "new"
    };
    s.history.unshift(cur);
    s.progressIndex += 1;
    if(s.progressIndex >= s.kanjiList.length){ s.progressIndex = 0; s.cycle += 1; }
  } else {
    cur = pickReview(s.history);
    cur.showCount = (cur.showCount || 1) + 1;
    cur.lastShownAt = slotISO;
    cur.lastSlotAt = slotISO;
    cur.mode = "review";
  }
  s.runCounter += 1;
  return { cur: cur, mode: mode };
}

function pushTitle(mode, cur, s){
  return (mode === "review" ? "[복습] " : "[신규] ") + cur.targetKanji + "   " + s.progressIndex + " / " + s.kanjiList.length;
}
function pushBody(cur){
  return cur.sentenceJP + "\n" + cur.readingHiragana + "\n" + cur.translationKR;
}

// ---------- generate: 1회 = 한자 1개 ----------
async function generate(cfg){
  try {
    var s = await readState();
    if(!s) s = JSON.parse(JSON.stringify(SEED));
    if(!Array.isArray(s.history)) s.history = [];
    reconcile(s);   // 예약해뒀던 복습 중 시각이 지난 게 있으면 먼저 반영
    var iso = nowISO();
    var r = await advanceOne(cfg, s, iso);
    s.lastCurrentId = r.cur.id;
    s.updatedAt = iso;
    writeState(s);
    try { await Notification.removeDelivered(["n1-current"]); } catch(e){}
    try { await Notification.removePending(["n1-current"]); } catch(e){}
    await notify("n1-current", pushTitle(r.mode, r.cur, s), pushBody(r.cur), null);
    console.log("OK generate " + r.mode + " " + r.cur.targetKanji);
  } catch(e){
    await notify("n1-err-" + Date.now(), "N1 생성 실패", String(e && e.message ? e.message : e));
    throw e;
  }
}

// ---------- day: 하루치 슬롯을 일괄 예약 ----------
// 기본: 09:00~23:00, 15분 간격(57칸), 정시(매시 :00)만 신규 생성 · 나머지는 가중 랜덤 복습.
// cfg 로 조절: INTERVAL_MIN(간격,분) · NEW_EVERY_MIN(신규 주기,분) · START_HOUR · END_HOUR
// ※ iOS는 앱당 예약 가능한 로컬 알림이 최대 64개라 기본값이 57개(여유 7개)로 잡혀 있음.
//   범위를 늘릴 땐 (END_HOUR-START_HOUR)*60/INTERVAL_MIN + 1 이 64를 넘지 않게.
async function day(cfg){
  try {
    var s = await readState();
    if(!s || !Array.isArray(s.kanjiList) || !s.kanjiList.length){
      await notify("n1-err-day", "N1 갱신 실패", "먼저 n1-generate 를 한 번 실행해 상태 파일을 만드세요.");
      return;
    }
    if(!Array.isArray(s.history)) s.history = [];
    reconcile(s);   // 지난 배치에서 예약해둔 것 중 시각이 지난 게 있으면 먼저 반영

    // 마이그레이션: 구버전(시간 단위, "n1-slot-9" 형식) 예약이 남아있으면 정리 —
    // 신버전(15분 단위, 최대 57개)과 합쳐져 iOS 64개 제한을 넘는 걸 방지.
    if(!s.migratedSlotIds){
      var legacy = [];
      for(var lh = 0; lh < 24; lh++) legacy.push("n1-slot-" + lh);
      try { await Notification.removePending(legacy); } catch(e){}
      s.migratedSlotIds = true;
    }

    var today = dateJST();
    if(!s.builtSlots || typeof s.builtSlots !== "object") s.builtSlots = {};
    // 오늘 것만 남기고 지난 날짜 기록은 정리
    var dk = Object.keys(s.builtSlots);
    for(var di = 0; di < dk.length; di++){ if(dk[di] !== today) delete s.builtSlots[dk[di]]; }
    if(!Array.isArray(s.builtSlots[today])) s.builtSlots[today] = [];
    var already = s.builtSlots[today];

    var STEP = cfg.INTERVAL_MIN || 15;
    var NEWEVERY = cfg.NEW_EVERY_MIN || 60;
    var startH = (cfg.START_HOUR != null) ? cfg.START_HOUR : 9;
    var endH = (cfg.END_HOUR != null) ? cfg.END_HOUR : 23;
    var startMin = startH * 60, endMin = endH * 60;
    var now = new Date();

    // 이 구간에서 아직 처리 안 한 슬롯만 골라내기 (재실행·2차 자동화와 안전하게 공존)
    var todo = [];
    for(var m = startMin; m <= endMin; m += STEP){
      var hh = Math.floor(m / 60), mm = m % 60;
      var key = pad2(hh) + ":" + pad2(mm);
      if(already.indexOf(key) === -1){
        todo.push({ h: hh, min: mm, key: key, isNew: (m % NEWEVERY === 0) });
      }
    }
    if(!todo.length){ console.log("이 구간은 이미 처리됨(" + today + ")"); return; }

    // 1단계: 메모리에서 전부 생성 (도중 실패하면 저장 안 함 → 안전 재시도)
    var plan = [];
    var pending = [];       // 이번에 예약하는 복습들 — 저장은 아래 2단계에서 s.pending에 합침
    var sessionBumps = {};  // 이 배치 안에서만 쓰는 임시 가중치(연속 중복 방지)
    for(var i = 0; i < todo.length; i++){
      var slot = todo[i];
      var slotDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), slot.h, slot.min, 0, 0);
      var slotISO = slotDate.toISOString();
      var cur, mode;

      if(slot.isNew || s.history.length === 0){
        mode = "new";
        var kanji = s.kanjiList[s.progressIndex];
        var c = await compose(cfg, kanji);
        cur = {
          id: slotISO + "#" + slot.key, date: today, targetKanji: kanji,
          sentenceJP: c.sentenceJP, readingHiragana: c.readingHiragana, translationKR: c.translationKR,
          kanjiNotes: Array.isArray(c.kanjiNotes) ? c.kanjiNotes : [],
          grammarNotes: Array.isArray(c.grammarNotes) ? c.grammarNotes : [],
          reviewed: false, lastShownAt: slotISO, lastSlotAt: slotISO, showCount: 1, mode: "new"
        };
        s.history.unshift(cur);
        s.progressIndex += 1;
        if(s.progressIndex >= s.kanjiList.length){ s.progressIndex = 0; s.cycle += 1; }
      } else {
        mode = "review";
        cur = pickWeightedReview(s.history, sessionBumps);
        // 아직 그 시각이 안 지났으니 showCount는 여기서 안 올림 — reconcile()이 나중에 처리.
        // sessionBumps는 오늘치를 만드는 이 배치 안에서만 같은 문장이 연달아 안 뽑히게 하는 임시 가중치.
        sessionBumps[cur.id] = (sessionBumps[cur.id] || 0) + 1;
        pending.push({ id: cur.id, slotISO: slotISO });
      }
      plan.push({ key: slot.key, slotDate: slotDate, title: pushTitle(mode, cur, s), body: pushBody(cur) });
    }

    // 2단계: 알림 예약 + 저장 (전부 성공했을 때만)
    for(var j = 0; j < plan.length; j++){
      var p = plan[j];
      if(p.slotDate.getTime() > Date.now() + 5000){
        await notify("n1-slot-" + today + "-" + p.key.replace(":", ""), p.title, p.body, p.slotDate);
      }
      already.push(p.key);
    }
    if(!Array.isArray(s.pending)) s.pending = [];
    s.pending = s.pending.concat(pending);
    reconcile(s);   // 이 중 이미 지난 시각이 있으면(과거로 예약된 경우 등) 바로 반영
    s.lastCurrentId = s.history[0] ? s.history[0].id : s.lastCurrentId;
    s.updatedAt = nowISO();
    writeState(s);
    console.log("OK day " + plan.length + "칸(" + today + " " + todo[0].key + "~" + todo[todo.length - 1].key + ") 처리");
  } catch(e){
    await notify("n1-err-day", "N1 갱신 실패", (e && e.message ? e.message : e) + " · 다시 실행하면 남은 구간만 이어서 처리");
    throw e;
  }
}

// ---------- widget: 잠금/홈 위젯 ----------
async function widget(cfg){
  var SCALE = cfg.SCALE || 1.15;
  var MINS = (typeof cfg.MINS === "number") ? cfg.MINS : 0.4;
  function f(px){ return Math.round(px * SCALE); }
  function jpBold(px){ return Font.boldSystemFont(f(px)); }
  function jpSemi(px){ return Font.semiboldSystemFont(f(px)); }

  var fam = config.widgetFamily || "medium";
  var s = await readState();
  if(s && Array.isArray(s.history)) reconcile(s);
  var cur = s ? current(s) : null;
  var total = (s && s.kanjiList) ? s.kanjiList.length : 706;
  var isReview = cur && (cur.mode === "review" || (cur.showCount || 1) > 1);
  var w = new ListWidget();

  if(fam.indexOf("accessory") === 0){
    if(!cur){ w.addText("N1 · n1-generate 실행"); }
    else if(fam === "accessoryInline"){ w.addText("N1 " + cur.targetKanji + "  " + cur.sentenceJP); }
    else if(fam === "accessoryCircular"){
      var rr = w.addStack(); rr.addSpacer();
      var cc = rr.addStack(); rr.addSpacer();
      cc.layoutVertically(); cc.addSpacer();
      var kk = cc.addText(cur.targetKanji); kk.font = Font.boldSystemFont(26); cc.addSpacer();
    } else {
      var l1 = w.addText((isReview ? "복습" : "신규") + " · " + cur.targetKanji + "  " + s.progressIndex + "/" + total);
      l1.font = Font.semiboldSystemFont(13); l1.lineLimit = 1;
      w.addSpacer(2);
      var l2 = w.addText(cur.sentenceJP); l2.font = Font.semiboldSystemFont(14); l2.lineLimit = 1;
      var l3 = w.addText(cur.translationKR); l3.font = Font.systemFont(12); l3.lineLimit = 1;
    }
    w.refreshAfterDate = new Date(Date.now() + 10 * 60 * 1000);
    Script.setWidget(w);
    if(!config.runsInWidget){ try { w.presentSmall(); } catch(e){} }
    return;
  }

  var dark = Device.isUsingDarkAppearance();
  var c = dark
    ? { bg:"#17181a", ink:"#f2efe3", soft:"#c3bfad", faint:"#8f8c79", indigo:"#a7b3da", seal:"#e58a7d" }
    : { bg:"#efece2", ink:"#1f1e18", soft:"#4c4a3d", faint:"#7c7a67", indigo:"#243257", seal:"#9a352f" };
  w.backgroundColor = new Color(c.bg);
  w.setPadding(f(14), f(15), f(14), f(15));

  if(!cur){
    var t0 = w.addText("데이터 없음 — n1-generate 를\n한 번 실행하세요");
    t0.font = Font.systemFont(f(13)); t0.textColor = new Color(c.soft);
    Script.setWidget(w);
    if(!config.runsInWidget){ try { w.presentLarge(); } catch(e){} }
    return;
  }

  var big = fam === "large";
  var head = w.addStack(); head.centerAlignContent();
  var tag = head.addText(isReview ? "복습" : "신규");
  tag.font = Font.heavySystemFont(f(big ? 13 : 11));
  tag.textColor = new Color(isReview ? c.indigo : c.seal);
  if(fam !== "small"){
    head.addSpacer(f(7));
    var kt = head.addText(cur.targetKanji);
    kt.font = Font.boldSystemFont(f(big ? 18 : 15));
    kt.textColor = new Color(c.ink);
  }
  head.addSpacer();
  var pg = head.addText(s.progressIndex + " / " + total);
  pg.font = Font.semiboldSystemFont(f(big ? 12 : 10)); pg.textColor = new Color(c.soft);

  w.addSpacer(f(fam === "small" ? 6 : 11));

  if(fam === "small"){
    var ks = w.addText(cur.targetKanji);
    ks.font = jpBold(50); ks.textColor = new Color(c.ink);
    w.addSpacer(f(5));
    var trs = w.addText(cur.translationKR);
    trs.font = Font.mediumSystemFont(f(11)); trs.textColor = new Color(c.soft);
    trs.minimumScaleFactor = MINS;
  } else {
    var sj = w.addText(cur.sentenceJP);
    sj.font = jpSemi(big ? 25 : 18); sj.textColor = new Color(c.ink);
    sj.minimumScaleFactor = MINS;
    w.addSpacer(f(4));
    var rd = w.addText(cur.readingHiragana);
    rd.font = Font.systemFont(f(big ? 14 : 12)); rd.textColor = new Color(c.soft);
    rd.minimumScaleFactor = MINS;
    w.addSpacer(f(big ? 10 : 8));
    var tr = w.addText(cur.translationKR);
    tr.font = Font.mediumSystemFont(f(big ? 17 : 14)); tr.textColor = new Color(c.ink);
    tr.minimumScaleFactor = MINS;

    if(big){
      w.addSpacer(f(10));
      var vn = (cur.kanjiNotes || []).slice(0, 2);
      for(var vi = 0; vi < vn.length; vi++){
        var nt = vn[vi];
        var lv = w.addText("語  " + nt.word + "  " + nt.reading + "  " + nt.meaningKR);
        lv.font = Font.systemFont(f(13)); lv.textColor = new Color(c.soft);
        lv.minimumScaleFactor = MINS; w.addSpacer(f(3));
      }
      var gn = (cur.grammarNotes || []).slice(0, 3);
      for(var gi = 0; gi < gn.length; gi++){
        var g = gn[gi];
        var lg = w.addText("文  " + g.point + "  " + g.meaningKR);
        lg.font = Font.systemFont(f(13)); lg.textColor = new Color(c.indigo);
        lg.minimumScaleFactor = MINS; w.addSpacer(f(3));
      }
    }
  }

  w.addSpacer();
  var foot = w.addText(cur.date + (cur.showCount > 1 ? "   ·   복습 " + (cur.showCount - 1) + "회" : ""));
  foot.font = Font.systemFont(f(big ? 11 : 9)); foot.textColor = new Color(c.faint);

  w.refreshAfterDate = new Date(Date.now() + 10 * 60 * 1000);
  Script.setWidget(w);
  if(!config.runsInWidget){ try { w.presentLarge(); } catch(e){} }
}

// ---------- review: 이력 목록 + 외웠음 체크 + 단어/문법 ----------
async function review(cfg){
  var s = await readState();
  if(!s || !Array.isArray(s.history) || s.history.length === 0){
    var a0 = new Alert();
    a0.title = "이력 없음"; a0.message = "먼저 n1-generate 를 한 번 실행하세요."; a0.addAction("확인");
    await a0.present();
    return;
  }
  reconcile(s);   // 예약해둔 복습 중 시각이 지난 게 있으면 목록에 반영
  var total = s.kanjiList ? s.kanjiList.length : 706;
  var table = new UITable();
  table.showSeparators = true;

  function draw(){
    table.removeAllRows();
    var hist = s.history;
    var done = hist.filter(function(e){ return e.reviewed; }).length;
    var head = new UITableRow();
    head.isHeader = true;
    head.addText("진도 " + s.progressIndex + " / " + total,
                 "외운 표시 " + done + " / " + hist.length + "   ·   " + s.cycle + "회차");
    table.addRow(head);

    for(var i = 0; i < hist.length; i++){
      var e = hist[i];
      var row = new UITableRow();
      row.height = 60;
      var main = row.addText(
        e.targetKanji + "   " + e.sentenceJP,
        e.translationKR + (e.showCount > 1 ? "   ·   복습 " + (e.showCount - 1) + "회" : "")
      );
      main.widthWeight = 82;
      main.titleFont = Font.mediumSystemFont(15);
      main.subtitleFont = Font.systemFont(12);
      main.subtitleColor = Color.gray();
      var mark = row.addText(e.reviewed ? "✓" : "○");
      mark.widthWeight = 18;
      mark.titleFont = Font.boldSystemFont(19);
      mark.titleColor = e.reviewed ? new Color("#a63a34") : Color.gray();
      mark.centerAligned();
      row.dismissOnSelect = false;
      (function(e){
        row.onSelect = async function(){
          var a = new Alert();
          a.title = e.targetKanji + "   ·   " + e.date;
          var msg = e.sentenceJP + "\n" + e.readingHiragana + "\n" + e.translationKR;
          if(Array.isArray(e.kanjiNotes) && e.kanjiNotes.length){
            msg += "\n\n[단어]\n" + e.kanjiNotes.map(function(n){
              return "· " + n.word + " (" + n.reading + ") " + n.meaningKR;
            }).join("\n");
          }
          if(Array.isArray(e.grammarNotes) && e.grammarNotes.length){
            msg += "\n\n[문법]\n" + e.grammarNotes.map(function(g){
              return "· " + g.point + " — " + g.meaningKR;
            }).join("\n");
          }
          a.message = msg;
          a.addAction(e.reviewed ? "외웠음 해제" : "외웠음 표시");
          a.addCancelAction("닫기");
          var pick = await a.present();
          if(pick === 0){ e.reviewed = !e.reviewed; writeState(s); draw(); table.reload(); }
        };
      })(e);
      table.addRow(row);
    }
  }

  draw();
  await table.present(true);
}

module.exports = { generate: generate, day: day, widget: widget, review: review, VERSION: "2026-08-30i" };
