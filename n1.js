// ===== N1 한자 학습 · 통합 모듈 (n1.js) =====
// Scriptable 껍데기 스크립트가 이 파일을 원격에서 불러 실행합니다.
// 로직 수정은 전부 여기서만. 껍데기는 다시 안 건드려도 됩니다.
// VERSION 2026-08-30d

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

  var req = new Request("https://openrouter.ai/api/v1/chat/completions");
  req.method = "POST";
  req.headers = {
    "Authorization": "Bearer " + cfg.OPENROUTER_KEY,
    "Content-Type": "application/json",
    "X-Title": "N1 Kanji"
  };
  req.body = JSON.stringify({
    model: cfg.MODEL || "anthropic/claude-sonnet-5",
    max_tokens: 700,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  });
  var res = await req.loadJSON();
  if(res && res.error) throw new Error("API: " + (res.error.message || JSON.stringify(res.error)));
  var msg = res && res.choices && res.choices[0] && res.choices[0].message;
  if(!msg || !msg.content) throw new Error("API 응답 형식 오류: " + JSON.stringify(res).slice(0, 300));
  var t = String(msg.content).trim();
  var a = t.indexOf("{"), b = t.lastIndexOf("}");
  if(a >= 0 && b > a) t = t.slice(a, b + 1);
  return JSON.parse(t);
}

function pickReview(history){
  var fresh = history.filter(function(e){ return !e.reviewed; });
  var pool = fresh.length ? fresh : history;
  return pool.reduce(function(a, b){ return (a.lastShownAt <= b.lastShownAt ? a : b); });
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

// ---------- day: 1회 = 그날 HOURS 시각에 알림 일괄 예약 ----------
async function day(cfg){
  try {
    var s = await readState();
    if(!s || !Array.isArray(s.kanjiList) || !s.kanjiList.length){
      await notify("n1-err-day", "N1 하루치 실패", "먼저 n1-generate 를 한 번 실행해 상태 파일을 만드세요.");
      return;
    }
    var today = dateJST();
    if(s.builtDay === today){ console.log("이미 오늘치 예약됨"); return; }
    var HOURS = (cfg.HOURS && cfg.HOURS.length) ? cfg.HOURS : [9,10,11,12,13,14,15,16,17,18,19,20];
    var now = new Date();

    // 1단계: 메모리에서 전부 생성 (실패 시 저장 안 함 → 안전 재시도)
    var plan = [];
    for(var i = 0; i < HOURS.length; i++){
      var h = HOURS[i];
      var slot = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 0, 0, 0);
      var r = await advanceOne(cfg, s, slot.toISOString());
      plan.push({ h: h, slot: slot, title: pushTitle(r.mode, r.cur, s), body: pushBody(r.cur) });
    }
    // 2단계: 예약 + 저장
    for(var j = 0; j < plan.length; j++){
      var p = plan[j];
      if(p.slot.getTime() > Date.now() + 5000) await notify("n1-slot-" + p.h, p.title, p.body, p.slot);
    }
    s.builtDay = today;
    s.lastCurrentId = s.history[0] ? s.history[0].id : s.lastCurrentId;
    s.updatedAt = nowISO();
    writeState(s);
    console.log("OK day " + plan.length + "칸 " + today);
  } catch(e){
    await notify("n1-err-day", "N1 하루치 실패", (e && e.message ? e.message : e) + " · 다시 실행하면 처음부터 재시도");
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

module.exports = { generate: generate, day: day, widget: widget, review: review, VERSION: "2026-08-30d" };
