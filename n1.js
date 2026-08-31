// ===== N1 한자 학습 · 통합 모듈 (n1.js) =====
// Scriptable 껍데기 스크립트가 이 파일을 원격에서 불러 실행합니다.
// 로직 수정은 전부 여기서만. 껍데기는 다시 안 건드려도 됩니다.
// VERSION 2026-08-31h

var DIR_NAME = "n1-kanji", FILE_NAME = "n1_state.json";

// "예전 데이터가 계속 불려온다" 같은 문제를 실기기에서 못 열어보고는 진단할 방법이 없어서,
// 실제로 어떤 저장소(iCloud/로컬)의 어느 경로를 읽고 있는지, 그 경로에 파일이 있다고
// 판단했는지를 매번 console.log로 남김. Scriptable에서 스크립트를 수동 실행(▶)하면
// 화면 하단 콘솔에서 이 로그를 바로 볼 수 있음 — Files 앱에서 지운 파일이 실제로 이
// 경로와 같은지 대조하는 데 씀.
function getFM(){
  try {
    var g = FileManager.iCloud(); g.documentsDirectory();
    console.log("[n1] FileManager: iCloud");
    return g;
  } catch(e){
    console.log("[n1] FileManager: local (iCloud 사용 불가: " + e + ")");
    return FileManager.local();
  }
}
function stateDir(fm){
  var d = fm.joinPath(fm.documentsDirectory(), DIR_NAME);
  if(!fm.fileExists(d)) fm.createDirectory(d, true);
  return d;
}
function statePath(fm){ return fm.joinPath(stateDir(fm), FILE_NAME); }
async function readState(){
  var fm = getFM(), p = statePath(fm);
  var exists = fm.fileExists(p);
  console.log("[n1] state 경로: " + p + " · 존재: " + exists);
  if(!exists) return null;
  try { if(fm.isFileStoredIniCloud(p) && !fm.isFileDownloaded(p)) await fm.downloadFileFromiCloud(p); } catch(e){}
  try {
    var parsed = JSON.parse(fm.readString(p));
    console.log("[n1] state 로드됨 · history " + ((parsed.history && parsed.history.length) || 0) + "건 · progressIndex " + parsed.progressIndex + " · updatedAt " + parsed.updatedAt);
    return parsed;
  } catch(e){ return null; }
}
function writeState(s){ var fm = getFM(); fm.writeString(statePath(fm), JSON.stringify(s)); }

function nowISO(){ return new Date().toISOString().replace(/\.\d{3}Z$/, "Z"); }
function dateJST(){ return new Date(Date.now() + 9*3600*1000).toISOString().slice(0,10); }
function slotT(e){ return Date.parse(e.lastSlotAt || e.lastShownAt || e.id) || 0; }

// ---------- 커리큘럼: N2 고빈도 → N1 고빈도 (706자) ----------
var SEED = {
  kanjiList: "丈介伸依偉偶傾叫含咲喫埋域塗墨奥姓委娘封岸巡彼御怒怖恋恐恥悩憎戻押捜据掃掘掛昇曇柔殿沸泊泥涙涼渡湿準濃爆猫甘疲皆眠磨祈突籍粒緊締縫繁繰缶罰羅翼耐聴肌胃脚腕膚膜膨致舞舟舶芝菊薄融衝袋裂裕裸褒覆触訂託訟訴診詐詩詰詳誇誓誘請譲豚豪貢販賛賠賢購贈超趣距跳踏躍軒軟軸輩込迅迎迫途逮遅遣遭遷遺避郊郎酢銘銭鋭鎖闘陣陰陳隔隠隻雅雇雷需霜霧露響頻頼顧飢飾餓駄駆騎騒騰驚髪鬼魂魅魔麗仁仮仰企伊伏伐伯伴価侵促俊保修俳倉倫偏健偽傍傑催債傷僕僚僧儀充克免典兼冒冠准凝凡凶刀刃刑削剛剣創功劣励勘勧勲匠匿升卑卓博即却厳又及叔句司吉后吐哀哲唆唯唱啓善喚喪嘆嘉器囚坑坪垂執培基堅堤塁塊塑塾墓墜墳壁壇壊士壮奇奈奉奔奏契奪奮奴如妙妨姫姿威婆媒嫁嫌孔孤宗宙宜宣宮宰宴密寛寧審寮寸射尋尚就尺尼尽尾屈展属履岐岳峠峡峰崇崩嵐巣巧己帆帝帳幕幣幹幻幽序庶康庸廃廊廉廷弁弓弔弦弧張弾彩彫影往征径徐従微徳徴徹忌忍志応忠怠怪恒恨恩恵悔悟悦惑惜惨惰愁愚慈態慎慕慢慮慰慶憂憤憩憲憶懇懸我戒房扇扶批把抑抗択披抵抽拍拒拓拘拠拡括挑挙振授掌排推措掲描提揚握揮援揺搬搭携摂摘摩撃撤撮擁操攻故敏救敢整敵敷斉斜施旗既旨旬旭昆昭是晶暁暑暇暖暦暫曹朗朱朴朽杉李条松析架柄染柳栗株核栽桃案桑桜梅梨棄棋棚棟検概標模樹欄欺款歓殊殖殴殻氏汁江汽沖没沢沼沿泡泣泰洞津洪派浄浜浦浩浪浸涯淡添渇渉渋渓渦湧滋滞源溝滅滑滝漂漆漏漠漫漬潔潜潤潮澄激濁瀬災炉炊炎為烈焦煮煩熊熟黙牧狂狩独狭猛猟献猶猿獄獣獲玄率琴環甚甲畔異疫疾症痘痢痴癒癖皇盆益盛盟監盤盲盾眉看眺眼督睡瞬瞳矛矢矯砕砲硝硫碑磁礁礎祥票視禅禍秀秘租秩称稚稲稼稿穀穂穏穴窃窒窮窯竜端笛第筋策節箇範篤粋粗粘糖糧系糾紀紋納級紛素紡索紫累紳紺結絞統絹継維綱網".split(""),
  progressIndex: 0, cycle: 1, runCounter: 0, kanjiRepCount: 0,
  history: []
};

// ---------- 예문 생성 (OpenRouter) ----------
// priorWords: 이 한자로 이미 예문에 썼던 단어들(REPS_PER_KANJI>1일 때, 같은 한자를
// 여러 번 생성하면서 매번 똑같은 단어만 나오는 걸 막기 위한 힌트) — 없으면 그냥 생략.
async function compose(cfg, kanji, priorWords){
  var avoidLine = "";
  if(Array.isArray(priorWords) && priorWords.length){
    avoidLine = "이 한자로 이미 다음 단어를 예문에 썼습니다 — 이번엔 가능하면 다른 단어·다른 문형으로 만드세요: " +
      priorWords.join(", ") + "\n\n";
  }
  var prompt =
"당신은 JLPT 일본어 예문 작성기입니다. 목표 한자: 「" + kanji + "」\n\n" + avoidLine +
"「" + kanji + "」를 사용한 자연스럽고 짧은(약 10~25자) 일본어 문장 1개를 만드세요. " +
"목표 한자는 실제로 자주 쓰이는 용법으로, 문장의 나머지 어휘는 JLPT N2 중심(필요하면 N1)으로 구성하세요. " +
"너무 쉬운 N4/N5 남발도, 너무 마이너한 어휘도 피하세요.\n\n" +
"다음 JSON 객체 하나만 출력하세요. 코드블록·설명·그 외 텍스트 금지:\n" +
'{"sentenceJP":"...","readingHiragana":"문장 전체를 히라가나로","translationKR":"자연스러운 한국어 번역","furigana":[{"t":"세그먼트 원문","r":"그 세그먼트 읽기(히라가나)"}],"kanjiNotes":[{"word":"...","reading":"...","meaningKR":"..."}],"grammarNotes":[{"point":"...","meaningKR":"..."}]}\n\n' +
"furigana: sentenceJP를 처음부터 끝까지 빠짐없이 순서대로 잘라 배열로 나열하세요 — 모든 원소의 t를 순서대로 이어붙이면 sentenceJP와 완전히 동일해야 합니다(한 글자도 빠지거나 겹치면 안 됨, 공백도 그대로 포함). " +
"한자가 하나라도 포함된 연속 구간은 하나의 세그먼트로 묶고 그 부분 전체의 읽기를 r에 히라가나로 넣으세요. " +
"가나·구두점·숫자·알파벳만 있는 구간은 한자와 같은 세그먼트로 섞지 말고 별도 세그먼트로 분리하고, 그 경우 r은 빈 문자열로 두세요.\n\n" +
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
    max_tokens: 1500,   // furigana 필드가 추가돼서 응답이 좀 더 길어짐
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  };
  if(disableReasoning) body.reasoning = { enabled: false };
  req.body = JSON.stringify(body);
  return await req.loadJSON();
}

// compose()가 만든 furigana 배열이 실제로 sentenceJP와 한 글자도 안 틀리고 맞는지 검증.
// 모델이 실수로 글자를 빠뜨리거나 순서를 바꾸면 위젯에 이상하게 그려지므로, 안 맞으면
// null 반환 — 위젯 쪽에서 null이면 기존 두 줄(문장/히라가나) 방식으로 자동 폴백.
function validateFurigana(sentenceJP, furi){
  if(!Array.isArray(furi) || !furi.length) return null;
  var joined = "";
  for(var i = 0; i < furi.length; i++){
    if(!furi[i] || typeof furi[i].t !== "string") return null;
    joined += furi[i].t;
  }
  return (joined === sentenceJP) ? furi : null;
}

// furigana 세그먼트를 이미지로 그려서 위젯에 넣을 수 있게 만듦(한자 위에 작은 읽기).
// Scriptable DrawContext에는 텍스트 폭을 재는 API가 없어서, "글자 수 × 폰트 크기 비율"로
// 세그먼트 폭을 추정해서 칸을 나눈다 — 실기기 폰트에 따라 살짝 밀릴 수 있음, 그럴 땐
// CHAR_W_RATIO를 조절.
// drawTextInRect()는 추정 폭이 실제보다 좁으면 글자를 "다음 줄로 밀어서 감춰버리는"
// 문제가 있었음(예: "変わる"의 "る"가 통째로 사라짐) — 그래서 drawText(text, point)로
// 바꿈. drawText는 rect 제약이 없어 절대 글자를 숨기지 않고, 추정이 살짝 빗나가도
// 인접 세그먼트와 조금 겹치는 정도로만 그침(훨씬 안전한 실패 방식).
// opts: {fontSize, inkColor, softColor, maxWidth, maxLines, maxHeight}
//   maxWidth: 한 줄의 폭 예산(pt). maxLines>1이면 이 폭을 넘길 것 같은 세그먼트부터
//             다음 줄로 넘김(줄바꿈).
//   maxHeight: 전체 이미지 높이 예산(pt) — 줄바꿈으로 몇 줄이 되든 이 높이는 절대 못
//              넘도록 강제 축소. (이전 버그: 폭만 맞추고 높이는 안 재서, 2줄로 감싸질 때
//              위젯 레이아웃 전체를 밀어내고 잘라버림. maxHeight로 그 사고를 막음 —
//              대신 긴 문장은 2줄로 나뉜 만큼 "같은 총 높이 안에서" 한 줄일 때보다
//              글자가 커질 수 있는 게 이 줄바꿈 기능의 실질적 이득.)
function buildFuriganaImage(segments, opts){
  var sz = opts.fontSize;
  var fz = Math.max(9, Math.round(sz * 0.42));
  var CHAR_W_RATIO = 1.05;   // drawText는 추정이 넉넉해도(=조금 남는 정도) 안전하므로 넉넉하게
  var cw = sz * CHAR_W_RATIO;
  var fcw = fz * CHAR_W_RATIO;
  var mainH = Math.round(sz * 1.25);
  var furiH = Math.round(fz * 1.35);
  var pad = Math.max(2, Math.round(sz * 0.06));   // 글씨 커진 만큼 세그먼트 간격도 비례
  var lineGap = Math.max(1, Math.round(sz * 0.08));
  var rowH = furiH + mainH;
  var maxLines = Math.max(1, opts.maxLines || 1);
  var maxWidth = opts.maxWidth || Infinity;

  var segs = [], i;
  for(i = 0; i < segments.length; i++){
    var seg = segments[i];
    var mainW = seg.t.length * cw;
    var furiW = seg.r ? seg.r.length * fcw : 0;
    segs.push({ t: seg.t, r: seg.r, mainW: mainW, furiW: furiW, segW: Math.max(mainW, furiW) + pad });
  }

  // 줄 채우기: 폭이 넘칠 것 같으면 다음 줄로(단, maxLines 넘어가면 마지막 줄에 계속 이어붙임)
  var lines = [[]], lineWidths = [0];
  for(i = 0; i < segs.length; i++){
    var s = segs[i];
    var li = lines.length - 1;
    if(lineWidths[li] > 0 && (lineWidths[li] + s.segW) > maxWidth && lines.length < maxLines){
      lines.push([]); lineWidths.push(0); li++;
    }
    lines[li].push(s);
    lineWidths[li] += s.segW;
  }

  var maxLineW = 0;
  for(i = 0; i < lineWidths.length; i++){ if(lineWidths[i] > maxLineW) maxLineW = lineWidths[i]; }
  var totalH = rowH * lines.length + lineGap * (lines.length - 1);

  // 폭 제약과 높이 제약을 각각 계산해서 더 강하게 줄여야 하는 쪽에 맞춤(폭이든 높이든
  // 절대 넘지 않도록) — 두 스케일 중 작은 쪽을 씀. 가로세로 같은 비율로 줄어서 글자가
  // 찌그러지지 않음.
  var scaleW = (opts.maxWidth && maxLineW > opts.maxWidth) ? (opts.maxWidth / maxLineW) : 1;
  var scaleH = (opts.maxHeight && totalH > opts.maxHeight) ? (opts.maxHeight / totalH) : 1;
  var scale = Math.min(scaleW, scaleH);

  var W = Math.max(1, Math.round(maxLineW * scale));
  var H = Math.max(1, Math.round(totalH * scale));

  var ctx = new DrawContext();
  ctx.size = new Size(W, H);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  var mainFont = Font.semiboldSystemFont(Math.max(8, Math.round(sz * scale)));
  var furiFont = Font.systemFont(Math.max(7, Math.round(fz * scale)));

  var y = 0;
  for(var li2 = 0; li2 < lines.length; li2++){
    var line = lines[li2];
    var x = 0;
    for(i = 0; i < line.length; i++){
      var s2 = line[i];
      var w0 = s2.segW * scale;
      if(s2.r){
        ctx.setFont(furiFont);
        ctx.setTextColor(opts.softColor);
        var furiW0 = s2.furiW * scale;
        ctx.drawText(s2.r, new Point(x + (w0 - furiW0) / 2, y));
      }
      ctx.setFont(mainFont);
      ctx.setTextColor(opts.inkColor);
      var mainW0 = s2.mainW * scale;
      ctx.drawText(s2.t, new Point(x + (w0 - mainW0) / 2, y + furiH * scale));
      x += w0;
    }
    y += (rowH + lineGap) * scale;
  }
  return { image: ctx.getImage(), width: W, height: H };
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

// ---------- 클라우드 동기화(GitHub Gist) ----------
// 윈도우 등 다른 기기에서 "폰이 지금 보여주는 것과 동일한" 단어를 알림으로 띄울 수 있도록,
// day() 가 그 날 예약한 슬롯(시각·제목·본문)을 그대로 Gist 하나에 올려둠. cfg.GIST_ID /
// cfg.GIST_TOKEN 이 없으면(=설정 안 했으면) 조용히 스킵 — 클라우드 동기화는 완전히 선택
// 사항이고, 실패해도 로컬 알림/위젯 동작에는 전혀 영향 없음(항상 try/catch로 무시).
// 반환값(호출부가 실행 요약에 그대로 반영):
//   { ok:true, count:N }        — N칸 업로드 성공
//   { ok:false, reason:"..." }  — 네트워크/권한 등으로 실패(로컬 동작엔 영향 없음)
//   { skipped:true, reason:"GIST 미설정" } — 클라우드 동기화 자체를 안 켬
async function pushCloud(cfg, today, slots){
  if(!cfg.GIST_ID || !cfg.GIST_TOKEN) return { skipped: true, reason: "GIST 미설정" };
  try {
    var sorted = slots.slice().sort(function(a, b){ return a.key < b.key ? -1 : a.key > b.key ? 1 : 0; });
    var payload = { date: today, slots: sorted, updatedAt: nowISO() };
    var req = new Request("https://api.github.com/gists/" + cfg.GIST_ID);
    req.method = "PATCH";
    req.headers = {
      "Authorization": "Bearer " + cfg.GIST_TOKEN,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
    req.body = JSON.stringify({ files: { "n1-today.json": { content: JSON.stringify(payload) } } });
    var resp = await req.loadJSON();
    // loadJSON 은 HTTP 에러여도 예외를 안 던지고 GitHub 에러 본문({message,...})을 그대로 줌 —
    // 그런 경우도 실패로 잡아냄.
    if(resp && resp.message && !resp.files){
      console.log("[n1] 클라우드 동기화 실패(무시): " + resp.message);
      return { ok: false, reason: resp.message };
    }
    console.log("[n1] 클라우드 동기화 OK · " + sorted.length + "칸");
    return { ok: true, count: sorted.length };
  } catch(e){
    var msg = String(e && e.message ? e.message : e);
    console.log("[n1] 클라우드 동기화 실패(무시): " + msg);
    return { ok: false, reason: msg };
  }
}

// day()/generate() 실행 결과를 사용자에게 "보이게" 만든다.
//   · config.runsInApp(앱에서 ▶ 로 수동 실행)  → Alert 로 즉시 표시
//   · 그 외(자동화·알림·위젯 컨텍스트)          → 조용한 성공은 console.log 만,
//                                                실패(isError)일 때만 Notification
// 어느 경우든 console.log 에는 항상 남긴다.
async function reportRun(title, lines, isError){
  var body = lines.filter(function(x){ return x != null && x !== ""; }).join("\n");
  console.log("[n1] " + title + "\n" + body);
  var inApp = false;
  try { inApp = (typeof config !== "undefined") && config.runsInApp; } catch(e){}
  if(inApp){
    try {
      var a = new Alert();
      a.title = title;
      a.message = body;
      a.addAction("확인");
      await a.present();
    } catch(e){}
    return;
  }
  if(isError){
    try { await notify("n1-run-" + Date.now(), title, body); } catch(e){}
  }
}

// pushCloud() 반환값을 요약 한 줄로.
function cloudResultLine(res){
  if(!res) return "클라우드: 결과 없음";
  if(res.skipped) return "클라우드: 꺼짐(" + (res.reason || "GIST 미설정") + ")";
  if(res.ok) return "클라우드: 동기화 OK · " + res.count + "칸";
  return "클라우드: 실패 — " + (res.reason || "알 수 없음");
}

// 같은 key 슬롯이 이미 있으면 덮어쓰고(중복 제거), 없으면 추가 — day()/generate() 가
// 하루에 여러 번 불려도 s.cloudSlots[today] 에 같은 시각 슬롯이 중복 누적되지 않게.
function upsertSlot(arr, slot){
  if(!Array.isArray(arr) || !slot) return;   // 방어: 배열 아닌 값·undefined 가 넘어와도 죽지 않게
  for(var i = 0; i < arr.length; i++){
    if(arr[i] && arr[i].key === slot.key){ arr[i] = slot; return; }
  }
  arr.push(slot);
}

// s.cloudSlots[today] 가 비었거나 없을 때(= pushCloud 기능이 생기기 전에 오늘 day()가
// 이미 돌아서, 예약은 다 됐지만 클라우드엔 아무것도 안 올라간 경우) 기존 상태에서
// 오늘치 슬롯 목록을 최대한 복원해 [{key,title,body}] 로 돌려줌.
// 근거로 삼는 데이터:
//   (1) 이미 예약돼 있는 로컬 알림(identifier "n1-slot-<today>-HHMM") — 제목·본문이
//       그 시점 pushTitle()/pushBody() 포맷 그대로 박제돼 있어 가장 정확.
//   (2) 그걸로 못 채운 시각은 s.history(오늘 date) + s.pending(예약된 복습)에서
//       pushTitle()/pushBody() 를 다시 돌려 동일 포맷으로 재구성.
// 시각(key)은 예약/노출 시각(lastSlotAt/lastShownAt/slotISO) 우선, 없으면 항목
// 타임스탬프(id 앞부분)에서 HH:mm 추출. 중복 key 는 하나로 합침. 정말 복원할 게
// 하나도 없으면 [] 반환 → 호출부에서 gist 를 빈 데이터로 덮어쓰지 않도록 스킵.
async function restoreTodaySlots(s, today){
  var byKey = {};

  // Notification.allPending() 는 Promise 를 반환하는 비동기 API — 반드시 await.
  // 위젯/알림 컨텍스트에서 미묘하게 실패할 수 있으므로 통째로 try/catch, 실패해도
  // 아래 history/pending 기반 재구성으로 계속 진행.
  try {
    var pend = await Notification.allPending();
    var prefix = "n1-slot-" + today + "-";
    for(var i = 0; i < pend.length; i++){
      var n = pend[i];
      if(!n || !n.identifier || n.identifier.indexOf(prefix) !== 0) continue;
      var hhmm = n.identifier.slice(prefix.length);
      if(!/^\d{4}$/.test(hhmm)) continue;
      if(!n.title) continue;
      var nk = hhmm.slice(0, 2) + ":" + hhmm.slice(2);
      byKey[nk] = { key: nk, title: n.title, body: n.body || "" };
    }
  } catch(e){ console.log("[n1] restore · allPending 조회 실패(무시): " + e); }

  function keyFromISO(iso){
    var d = new Date(iso);
    if(isNaN(d.getTime())) return null;
    return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  var hist = Array.isArray(s.history) ? s.history : [];
  for(var h = 0; h < hist.length; h++){
    var e = hist[h];
    if(!e || e.date !== today) continue;
    var iso = e.lastSlotAt || e.lastShownAt || (typeof e.id === "string" ? e.id.split("#")[0] : null);
    var ek = keyFromISO(iso);
    if(!ek || byKey[ek]) continue;
    // pushTitle()/pushBody() 가 옛/손상 항목에서 던지더라도 그 한 칸만 건너뛰고 계속.
    try {
      var mode = ((e.showCount || 1) > 1 || e.mode === "review") ? "review" : "new";
      byKey[ek] = { key: ek, title: pushTitle(mode, e, s), body: pushBody(e) };
    } catch(te){ console.log("[n1] restore · history 항목 스킵: " + te); }
  }

  var pendArr = Array.isArray(s.pending) ? s.pending : [];
  for(var p = 0; p < pendArr.length; p++){
    var it = pendArr[p];
    var pk = keyFromISO(it && it.slotISO);
    if(!pk || byKey[pk]) continue;
    var ent = null;
    for(var q = 0; q < hist.length; q++){ if(hist[q] && hist[q].id === it.id){ ent = hist[q]; break; } }
    if(!ent) continue;
    try {
      byKey[pk] = { key: pk, title: pushTitle("review", ent, s), body: pushBody(ent) };
    } catch(pe){ console.log("[n1] restore · pending 항목 스킵: " + pe); }
  }

  var keys = Object.keys(byKey).sort();
  var out = [];
  for(var k = 0; k < keys.length; k++) out.push(byKey[keys[k]]);
  return out;
}

async function notify(id, title, body, triggerDate, openURL){
  var n = new Notification();
  n.identifier = id;
  n.threadIdentifier = "n1-kanji";
  n.title = title;
  n.body = body;
  n.sound = "default";
  if(openURL) n.openURL = openURL;   // 탭하면 이 URL로 이동(주로 n1-review 열어서 전체 내용 보여줌)
  if(triggerDate) n.setTriggerDate(triggerDate);
  await n.schedule();
}

// 한 칸 진행(신규/복습). s 를 그 자리에서 수정하고 {cur, mode} 반환.
// forceMode 를 주면 그 모드로 강제(생략 시 옛 runCounter 홀짝 교대 — 지금은 generate() 가
// isDueForNew() 로 항상 forceMode 를 넘기므로 실질적으로 안 쓰임, 다른 호출부 대비 유지).
// 한 한자에 대해 새 예문 1개를 만들어 history에 추가 — 진짜로 "다음 한자로 넘어갈지"는
// cfg.REPS_PER_KANJI(기본 1)에 달림: 이 값만큼 같은 한자로 반복 생성한 뒤에야
// progressIndex가 전진함(REPS_PER_KANJI=3이면 한 한자당 예문 3개 만들고서야 다음 한자로).
// 반복 생성할 때 매번 똑같은 단어만 나오지 않도록, 이 한자로 이미 나온 단어들을
// compose()에 힌트로 넘김. advanceOne()과 day()의 신규 분기가 이 함수로 통일돼있어서
// REPS_PER_KANJI가 둘 다에 똑같이 적용됨.
async function composeNewEntry(cfg, s, slotISO, idSuffix){
  if(!Array.isArray(s.history)) s.history = [];
  var kanji = s.kanjiList[s.progressIndex];
  var priorWords = [];
  for(var i = 0; i < s.history.length; i++){
    if(s.history[i].targetKanji === kanji){
      var hw = pickHeadword(s.history[i]);
      if(hw && hw.word && priorWords.indexOf(hw.word) < 0) priorWords.push(hw.word);
    }
  }
  var c = await compose(cfg, kanji, priorWords);
  var cur = {
    id: slotISO + "#" + idSuffix, date: dateJST(), targetKanji: kanji,
    sentenceJP: c.sentenceJP, readingHiragana: c.readingHiragana, translationKR: c.translationKR,
    furigana: validateFurigana(c.sentenceJP, c.furigana),
    kanjiNotes: Array.isArray(c.kanjiNotes) ? c.kanjiNotes : [],
    grammarNotes: Array.isArray(c.grammarNotes) ? c.grammarNotes : [],
    reviewed: false, lastShownAt: slotISO, lastSlotAt: slotISO, showCount: 1, mode: "new"
  };
  s.history.unshift(cur);

  var reps = (cfg.REPS_PER_KANJI != null) ? cfg.REPS_PER_KANJI : 3;   // 기본값: 한자당 예문 3개
  s.kanjiRepCount = (s.kanjiRepCount || 0) + 1;
  if(s.kanjiRepCount >= reps){
    s.progressIndex += 1;
    if(s.progressIndex >= s.kanjiList.length){ s.progressIndex = 0; s.cycle += 1; }
    s.kanjiRepCount = 0;
  }
  s.lastNewAt = slotISO;   // isDueForNew() 판단용 — 마지막 신규 생성 시각
  return cur;
}

async function advanceOne(cfg, s, slotISO, forceMode){
  if(!Array.isArray(s.history)) s.history = [];
  var mode = forceMode || ((s.runCounter % 2 === 1 && s.history.length > 0) ? "review" : "new");
  var cur;
  if(mode === "new"){
    cur = await composeNewEntry(cfg, s, slotISO, s.runCounter);
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
// cur.kanjiNotes 중 목표 한자(cur.targetKanji)가 들어간 단어를 고름 — 프롬프트가
// "「한자」가 들어간 단어를 반드시 하나 넣으라"고 강제하므로 거의 항상 있음. 없으면(옛
// 항목 등) kanjiNotes 첫 항목, 그것도 없으면 null(호출부에서 문장 폴백으로 처리).
function pickHeadword(cur){
  var notes = Array.isArray(cur.kanjiNotes) ? cur.kanjiNotes : [];
  for(var i = 0; i < notes.length; i++){
    if(notes[i] && notes[i].word && cur.targetKanji && notes[i].word.indexOf(cur.targetKanji) >= 0) return notes[i];
  }
  return notes[0] || null;
}
// 알림 본문 — 문장 통째로 넣으면 알림 배너에서 길이 제한으로 잘려서 그걸로는 학습이
// 안 된다는 피드백으로, 워치 알림과 동일하게 "단어 / 후리가나 / 한글번역" 3줄로 줄임.
// 대신 알림을 탭하면(openURL, notify() 호출부에서 reviewURL(cfg) 넘김) n1-review 가
// 열리는데, review()는 시작하자마자 current() 항목(=지금 이 알림이 보여준 것과 동일한
// 항목) 전체 내용을 모달로 먼저 띄우므로 탭 한 번으로 문장·문법 노트까지 다 볼 수 있음.
function pushBody(cur){
  var hw = pickHeadword(cur);
  if(hw) return hw.word + "\n" + hw.reading + "\n" + hw.meaningKR;
  return cur.sentenceJP + "\n" + cur.readingHiragana + "\n" + cur.translationKR;   // 옛 항목 폴백
}
// 알림을 탭했을 때 n1-review를 열게 하는 URL. 스크립트 이름이 기본값("n1-review")과
// 다르면 cfg.REVIEW_SCRIPT_NAME으로 맞춰 쓸 수 있음.
function reviewURL(cfg){
  return "scriptable:///run/" + encodeURIComponent((cfg && cfg.REVIEW_SCRIPT_NAME) || "n1-review");
}

// 신규 도입을 끊을 날짜 — 706자 × REPS_PER_KANJI(기본 3) 한 바퀴가 지금 페이스(하루 약
// 29개 신규)로 대략 끝나는 시점(2026-11-12)을 기본값으로 잡아둠. 그 날짜부터는 신규
// 생성 없이 순수 복습만(시험 전 마지막 몇 주는 새 걸 우겨넣기보다 복습이 기억에 더
// 유리하다는 스페이싱 효과 근거). cfg.NEW_CUTOFF_DATE로 덮어쓸 수 있고, 아예 신규를
// 안 끊고 싶으면 cfg.NEW_CUTOFF_DATE: null 로 넣으면 됨(그럼 무기한 계속 신규 생성).
// generate()(isDueForNew)와 day() 둘 다 여기(isPastNewCutoff)로 통일해서 씀.
function isPastNewCutoff(cfg){
  var cutoffStr = (cfg && cfg.NEW_CUTOFF_DATE !== undefined) ? cfg.NEW_CUTOFF_DATE : "2026-11-12";
  if(!cutoffStr) return false;
  var cutoff = Date.parse(cutoffStr);
  return !isNaN(cutoff) && Date.now() >= cutoff;
}

// n1-generate 가 몇 번이든, 언제(불규칙하게라도) 불리든 상관없이 신규 생성 빈도를
// "시간당 대략 1개"로 유지하기 위한 판단 — 정각/그리드가 아니라 마지막 신규 생성(s.lastNewAt)
// 이후 실제로 지난 시간으로 판단. NEW_EVERY_MIN(기본 30분) 안 지났으면 아직 신규 낼 때가
// 아니라는 뜻 — 그 호출은 API 호출 없이 기존 이력 중 복습 횟수 적은 걸 복습으로만 반영
// (day()와 같은 가중 랜덤 공식. pickTapReview 재사용).
function isDueForNew(cfg, s){
  if(isPastNewCutoff(cfg)) return false;
  // NEW_EVERY_MIN: 0 을 CFG에 넣으면 "항상 신규" 테스트 모드가 되도록 명시적 null 체크
  // (예전엔 `|| 60`이라 0을 넣어도 falsy라서 60으로 되돌아가는 버그가 있었음).
  var every = (cfg.NEW_EVERY_MIN != null) ? cfg.NEW_EVERY_MIN : 30;   // REPS_PER_KANJI=3 기본값과 맞춰 하루 생성량 보정
  if(!s.lastNewAt) return true;
  return (Date.now() - Date.parse(s.lastNewAt)) / 60000 >= every;
}

// ---------- generate: 1회 = 한자 1개(신규가 밀렸을 때) 또는 기존 문장 복습 1건(그 사이 호출) ----------
async function generate(cfg){
  try {
    var s = await readState();
    var freshStart = !s;
    if(!s) s = JSON.parse(JSON.stringify(SEED));
    if(freshStart){
      // state 파일이 없어서(=지워서) 새로 시작하는 경우 — day()가 예전에 미리 예약해둔
      // 로컬 알림들은 그때 문장 내용이 이미 텍스트로 박제되어 있어서, state를 지워도
      // 알아서 사라지지 않고 원래 예약 시각마다(예: 15분 간격) 계속 옛날 내용 그대로
      // 뜸. "지웠는데 계속 옛날 데이터가 보인다"는 증상은 새 state가 아니라 십중팔구
      // 이 남아있던 예약 알림들 — 그래서 진짜 리셋일 때는 예약된 알림도 싹 같이 정리.
      try { await Notification.removeAllPending(); } catch(e){}
    }
    if(!Array.isArray(s.history)) s.history = [];
    reconcile(s);   // 예약해뒀던 복습 중 시각이 지난 게 있으면 먼저 반영
    var iso = nowISO();
    var r;
    if(isDueForNew(cfg, s) || s.history.length === 0){
      r = await advanceOne(cfg, s, iso, "new");   // 신규 낼 때: API 호출로 새 문장 생성
    } else {
      var picked = pickTapReview(s, current(s));   // 아직 신규 아닐 때: API 호출 없이 복습만 반영
      r = picked ? { cur: picked, mode: "review" } : await advanceOne(cfg, s, iso, "new");
    }
    s.lastCurrentId = r.cur.id;
    s.updatedAt = iso;
    // 핵심 상태부터 확정 저장 — 아래 클라우드 작업이 실패해도 진도/이력은 이미 안전.
    writeState(s);
    try { await Notification.removeDelivered(["n1-current"]); } catch(e){}
    try { await Notification.removePending(["n1-current"]); } catch(e){}
    await notify("n1-current", pushTitle(r.mode, r.cur, s), pushBody(r.cur), null, reviewURL(cfg));
    // day()와 같은 방식으로 "지금" 항목도 클라우드에 한 칸 올려둠(주로 day() 자동화를
    // 안 쓰고 generate()만 수동/주기 실행하는 경우 대비). 완전히 선택적 — 자체 try/catch.
    var cloudRes = { skipped: true, reason: "GIST 미설정" };
    if(cfg && cfg.GIST_ID && cfg.GIST_TOKEN){
      try {
        var gToday = dateJST(), gNow = new Date();
        var gKey = pad2(gNow.getHours()) + ":" + pad2(gNow.getMinutes());
        if(!s.cloudSlots || typeof s.cloudSlots !== "object") s.cloudSlots = {};
        var gdk = Object.keys(s.cloudSlots);
        for(var gdi = 0; gdi < gdk.length; gdi++){ if(gdk[gdi] !== gToday) delete s.cloudSlots[gdk[gdi]]; }
        if(!Array.isArray(s.cloudSlots[gToday])) s.cloudSlots[gToday] = [];
        upsertSlot(s.cloudSlots[gToday], { key: gKey, title: pushTitle(r.mode, r.cur, s), body: pushBody(r.cur) });
        writeState(s);
        cloudRes = await pushCloud(cfg, gToday, s.cloudSlots[gToday]);
      } catch(ce){
        cloudRes = { ok: false, reason: String(ce && ce.message ? ce.message : ce) };
        console.log("[n1] generate 클라우드 동기화 실패(무시): " + (ce && ce.stack ? ce.stack : ce));
      }
    }
    console.log("OK generate " + r.mode + " " + r.cur.targetKanji);
    await reportRun("N1 생성 완료", [
      (r.mode === "review" ? "복습" : "신규") + " · " + r.cur.targetKanji +
        "   진도 " + s.progressIndex + " / " + s.kanjiList.length,
      "이력 " + s.history.length + "건",
      cloudResultLine(cloudRes)
    ], false);
  } catch(e){
    console.log("[n1] generate() 실패: " + (e && e.stack ? e.stack : (e && e.message ? e.message : e)));
    await reportRun("N1 생성 실패", [String(e && e.message ? e.message : e)], true);
    throw e;
  }
}

// ---------- day: 하루치 슬롯을 일괄 예약 ----------
// 기본: 09:00~23:00, 15분 간격(57칸), 정시(매시 :00)만 신규 생성 · 나머지는 가중 랜덤 복습.
// cfg 로 조절: INTERVAL_MIN(간격,분) · NEW_EVERY_MIN(신규 주기,분) · START_HOUR · END_HOUR
// ※ iOS는 앱당 예약 가능한 로컬 알림이 최대 64개라 기본값이 57개(여유 7개)로 잡혀 있음.
//   범위를 늘릴 땐 (END_HOUR-START_HOUR)*60/INTERVAL_MIN + 1 이 64를 넘지 않게.
async function day(cfg){
  // 클라우드 동기화는 GIST_ID·GIST_TOKEN 둘 다 있을 때만. 없으면 관련 코드(복원·업로드,
  // Notification.allPending 조회 포함)를 통째로 건너뜀 — day() 본연의 알림 예약과 완전히 분리.
  var cloudOn = !!(cfg && cfg.GIST_ID && cfg.GIST_TOKEN);
  console.log("[n1] day() 시작 · cloud=" + (cloudOn ? "on" : "off"));
  try {
    var s = await readState();
    if(!s || !Array.isArray(s.kanjiList) || !s.kanjiList.length){
      console.log("[n1] day() 중단 · 상태 파일 없음/손상 — n1-generate 먼저 실행 필요");
      await reportRun("N1 갱신 실패", ["상태 파일이 없습니다.", "먼저 n1-generate 를 한 번 실행하세요."], true);
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
    // 기본 30분(15분 그리드에 맞춰 15의 배수여야 정확히 작동 — 아무 값이나 넣으면 그리드와
    // 안 맞아떨어져 의도와 다르게 동작할 수 있음). 60→30으로 낮춰서 "새 슬롯" 개수를
    // 09~23시 기준 약 15개/일 → 약 29개/일로 올림. REPS_PER_KANJI 기본값(3)과 나누면
    // 하루 약 9~10개 "한자" 진도(=29÷3) — 706자를 12월 초 시험 전에 다 돌기 위해 잡았던
    // "하루 약 10개 신규 한자" 페이스를, 한자당 예문이 3개로 늘어난 만큼 보정한 값.
    var NEWEVERY = cfg.NEW_EVERY_MIN || 30;
    var startH = (cfg.START_HOUR != null) ? cfg.START_HOUR : 9;
    var endH = (cfg.END_HOUR != null) ? cfg.END_HOUR : 23;
    var startMin = startH * 60, endMin = endH * 60;
    var now = new Date();

    // 이 구간에서 아직 처리 안 한 슬롯만 골라내기 (재실행·2차 자동화와 안전하게 공존)
    // pastCutoff면(isPastNewCutoff, 기본 2026-11-12) 모든 슬롯을 복습으로 — 신규 생성 없음.
    var pastCutoff = isPastNewCutoff(cfg);
    var todo = [];
    for(var m = startMin; m <= endMin; m += STEP){
      var hh = Math.floor(m / 60), mm = m % 60;
      var key = pad2(hh) + ":" + pad2(mm);
      if(already.indexOf(key) === -1){
        todo.push({ h: hh, min: mm, key: key, isNew: !pastCutoff && (m % NEWEVERY === 0) });
      }
    }
    console.log("[n1] day() · 이번 구간 처리 대상 " + todo.length + "칸");
    if(!todo.length){
      // 이 구간은 이미 예약이 끝났음 — 예약할 게 없어도, 클라우드가 켜져 있으면 오늘치를
      // 한 번 더 올려둔다(새 코드로 처음 실행되는 경우 대비). 클라우드 관련 작업은
      // 전부 아래 한 블록 안에서 자체 try/catch — 실패해도 day() 는 정상 종료.
      console.log("이 구간은 이미 처리됨(" + today + ")");
      var erCloud = { skipped: true, reason: "GIST 미설정" };
      if(cloudOn){
        try {
          if(!s.cloudSlots || typeof s.cloudSlots !== "object") s.cloudSlots = {};
          var edk = Object.keys(s.cloudSlots);
          for(var edi = 0; edi < edk.length; edi++){ if(edk[edi] !== today) delete s.cloudSlots[edk[edi]]; }
          var todaySlots = (Array.isArray(s.cloudSlots[today]) && s.cloudSlots[today].length) ? s.cloudSlots[today] : null;
          if(!todaySlots){
            // pushCloud 생기기 전 오늘 day()가 이미 돈 경우 — 기존 상태에서 복원
            var restored = await restoreTodaySlots(s, today);
            if(restored.length){
              s.cloudSlots[today] = restored;
              todaySlots = restored;
              s.updatedAt = nowISO();
              writeState(s);
              console.log("[n1] 오늘치 슬롯 " + restored.length + "칸 복원");
            }
          }
          if(todaySlots && todaySlots.length){
            erCloud = await pushCloud(cfg, today, todaySlots);
          } else {
            erCloud = { ok: false, reason: "복원할 오늘치 슬롯 없음" };
            console.log("[n1] 복원할 오늘치 슬롯이 없어 클라우드 업데이트 스킵");
          }
        } catch(ce){
          erCloud = { ok: false, reason: String(ce && ce.message ? ce.message : ce) };
          console.log("[n1] 클라우드 동기화(복원 경로) 실패(무시): " + (ce && ce.stack ? ce.stack : ce));
        }
      } else {
        console.log("[n1] cloud off · 복원/업로드 스킵");
      }
      console.log("[n1] day() 종료 · 예약할 슬롯 없음");
      await reportRun("N1 갱신 — 예약할 것 없음", [
        "이미 오늘 예약 완료 — 신규 0칸",
        "오늘 전체 슬롯 " + already.length + "칸 (" + today + ")",
        cloudResultLine(erCloud)
      ], false);
      return;
    }

    // 1단계: 메모리에서 전부 생성 (도중 실패하면 저장 안 함 → 안전 재시도)
    var plan = [];
    var pending = [];       // 이번에 예약하는 복습들 — 저장은 아래 2단계에서 s.pending에 합침
    var sessionBumps = {};  // 이 배치 안에서만 쓰는 임시 가중치(연속 중복 방지)
    var newCount = 0;       // 이번 실행에서 새로 만든 신규 예문 수(요약용)
    for(var i = 0; i < todo.length; i++){
      var slot = todo[i];
      var slotDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), slot.h, slot.min, 0, 0);
      var slotISO = slotDate.toISOString();
      var cur, mode;

      if(slot.isNew || s.history.length === 0){
        mode = "new";
        cur = await composeNewEntry(cfg, s, slotISO, slot.key);
        newCount++;
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
    console.log("[n1] day() · plan " + plan.length + "칸 생성 완료(신규 API 호출 포함) · 예약 시작");

    // 2단계: 알림 예약 + 저장 (전부 성공했을 때만)
    // SKIP_PUSH: true 면 신규 생성·진도(progressIndex)·복습 예약(pending)은 평소처럼 다
    // 하되, 실제 알림(Notification)만 안 쏨 — watchDay 가 64개 알림 한도를 다 쓰도록
    // 문장 쪽 알림만 끄고 싶을 때 씀(커리큘럼 진행 자체는 안 끊김).
    for(var j = 0; j < plan.length; j++){
      var p = plan[j];
      if(!cfg.SKIP_PUSH && p.slotDate.getTime() > Date.now() + 5000){
        await notify("n1-slot-" + today + "-" + p.key.replace(":", ""), p.title, p.body, p.slotDate, reviewURL(cfg));
      }
      already.push(p.key);
    }
    if(!Array.isArray(s.pending)) s.pending = [];
    s.pending = s.pending.concat(pending);
    reconcile(s);   // 이 중 이미 지난 시각이 있으면(과거로 예약된 경우 등) 바로 반영
    s.lastCurrentId = s.history[0] ? s.history[0].id : s.lastCurrentId;
    s.updatedAt = nowISO();
    // 핵심(알림 예약·진도·pending)은 먼저 확정 저장 — 이 뒤의 클라우드 작업이 무슨 일이
    // 있어도 예약 결과를 되돌리거나 막지 못하게.
    writeState(s);
    console.log("[n1] day() · 상태 저장 완료 · " + plan.length + "칸 예약(" + todo[0].key + "~" + todo[todo.length - 1].key + ")");

    // 오늘치 슬롯(시각·제목·본문)을 누적 저장 후 클라우드에 통째로 올림 — day()가 하루에
    // 여러 번(구간별로) 불려도 이전에 이미 올린 슬롯이 안 지워지도록 병합. 클라우드는
    // 완전히 선택적: 아래 전체를 자체 try/catch 로 감싸 실패해도 로그만 남기고 계속.
    var dayCloud = { skipped: true, reason: "GIST 미설정" };
    if(cloudOn){
      try {
        if(!s.cloudSlots || typeof s.cloudSlots !== "object") s.cloudSlots = {};
        var cdk = Object.keys(s.cloudSlots);
        for(var cdi = 0; cdi < cdk.length; cdi++){ if(cdk[cdi] !== today) delete s.cloudSlots[cdk[cdi]]; }
        if(!Array.isArray(s.cloudSlots[today])) s.cloudSlots[today] = [];
        for(var pk = 0; pk < plan.length; pk++){
          upsertSlot(s.cloudSlots[today], { key: plan[pk].key, title: plan[pk].title, body: plan[pk].body });
        }
        writeState(s);
        dayCloud = await pushCloud(cfg, today, s.cloudSlots[today]);
      } catch(ce){
        dayCloud = { ok: false, reason: String(ce && ce.message ? ce.message : ce) };
        console.log("[n1] 클라우드 동기화 실패(무시): " + (ce && ce.stack ? ce.stack : ce));
      }
    } else {
      console.log("[n1] cloud off · 클라우드 업로드 스킵");
    }
    console.log("OK day " + plan.length + "칸(" + today + " " + todo[0].key + "~" + todo[todo.length - 1].key + ") 처리");
    await reportRun("N1 갱신 완료", [
      "이번 실행: " + plan.length + "칸 예약(신규 " + newCount + " · 복습 " + (plan.length - newCount) + ")",
      "구간 " + todo[0].key + "~" + todo[todo.length - 1].key + " · 진도 " + s.progressIndex + " / " + s.kanjiList.length,
      "오늘 전체 슬롯 " + already.length + "칸 (" + today + ")",
      cloudResultLine(dayCloud)
    ], false);
  } catch(e){
    console.log("[n1] day() 실패: " + (e && e.stack ? e.stack : (e && e.message ? e.message : e)));
    await reportRun("N1 갱신 실패", [
      String(e && e.message ? e.message : e),
      "다시 실행하면 남은 구간만 이어서 처리됩니다."
    ], true);
    throw e;
  }
}

// 항목 하나를 사람이 읽을 상세 텍스트로.
function detailText(e){
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
  return msg;
}

// 항목 하나의 상세 팝업(+ 외웠음 토글). widget 탭, review 목록 양쪽에서 공용으로 사용.
// reviewed 를 토글했으면 true 를 반환 — 호출 쪽에서 writeState() 하도록.
async function presentDetail(e){
  var a = new Alert();
  a.title = e.targetKanji + "   ·   " + e.date;
  a.message = detailText(e);
  a.addAction(e.reviewed ? "외웠음 해제" : "외웠음 표시");
  a.addCancelAction("닫기");
  var pick = await a.present();
  if(pick === 0){ e.reviewed = !e.reviewed; return true; }
  return false;
}

// 위젯을 탭했을 때 보여줄 항목 고르기: 지금 위젯에 뜬 것(cur)과는 다른 걸,
// day()와 동일한 가중 랜덤(복습 적은/안 외운 것 우선)으로 이력에서 골라 노출 1회로 반영.
function pickTapReview(s, cur){
  if(!s || !Array.isArray(s.history) || !s.history.length) return null;
  var pool = s.history;
  if(cur && cur.id && pool.length > 1){
    var filtered = pool.filter(function(e){ return e.id !== cur.id; });
    if(filtered.length) pool = filtered;
  }
  var picked = pickWeightedReview(pool, null);
  if(!picked) return null;
  picked.showCount = (picked.showCount || 1) + 1;
  var iso = nowISO();
  picked.lastShownAt = iso;
  picked.lastSlotAt = iso;
  picked.mode = "review";
  return picked;
}

// 위젯 탭 팝업 전용: "외웠음" 토글 없이 닫기/다음만 제공(위젯에서는 외웠음 처리 불가).
// "다음"을 누르면 pickTapReview()로 다른 항목(가중 랜덤, 방금 본 것 제외)을 뽑아 계속 보여줌 —
// 뽑힐 때마다 실제 노출로 반영(showCount 증가)하고 바로 저장.
async function presentWidgetLoop(s, first){
  var e = first;
  while(e){
    var a = new Alert();
    a.title = e.targetKanji + "   ·   " + e.date;
    a.message = detailText(e);
    a.addAction("다음");
    a.addCancelAction("닫기");
    var pick = await a.present();
    if(pick !== 0) break;   // 닫기
    var nxt = pickTapReview(s, e);
    if(!nxt) break;
    writeState(s);
    e = nxt;
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
    w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);
    Script.setWidget(w);
    if(!config.runsInWidget){
      // 탭해서 열린 경우: 미리보기 대신 지금 위젯에 뜬 항목을 팝업으로(닫기/다음만, 외웠음 불가).
      try {
        if(cur){ await presentWidgetLoop(s, cur); writeState(s); }
        else { w.presentSmall(); }
      } catch(e){}
    }
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
    var sentPx = big ? 48 : 34;   // 한자 문장 기본 크기 — 아래 maxHeight가 실제 상한을 강제하므로
                                   // 여긴 "목표치"일 뿐, 안 맞으면 자동으로 줄어듦
    var drewFuri = false;
    if(Array.isArray(cur.furigana) && cur.furigana.length){
      // 한자 위에 작은 읽기(후리가나)를 이미지로 그려서 붙임 — furigana 데이터 있는
      // (이 기능 추가 이후 생성된) 항목만 해당. 실패하면 아래 폴백으로 자동 전환.
      try {
        var fi = buildFuriganaImage(cur.furigana, {
          fontSize: f(sentPx), inkColor: new Color(c.ink), softColor: new Color(c.soft),
          // 위젯 실제 물리 폭(패딩 뺀 콘텐츠 폭)에 대한 근사치(pt) — large/medium 위젯
          // 실측 폭은 기기 불문 대략 300pt 안팎이라 290이 안전한 값(예전에 실기기로
          // 확인했던 값). ※ 지난번에 "1.5배 키워달라"는 요청을 글자 크기뿐 아니라 이
          // 물리 폭 상수에도 잘못 적용해서 435로 올렸었는데, 이 값은 폰트 크기와 무관하게
          // 위젯의 실제 하드웨어 폭이라 절대 그렇게 같이 늘리면 안 됐음 — 그게 폭 오버플로우
          // (좌우로 잘려 보이던 증상)의 직접 원인. 다시 290으로 되돌림.
          maxWidth: 290,
          // large는 최대 2줄까지 감싸서(줄바꿈) 긴 문장의 글자를 덜 축소시킴 —
          // medium은 세로 공간이 빠듯해 1줄 유지.
          maxLines: big ? 2 : 1,
          // 실측 레이아웃(위/아래 여백 + 헤더 + 번역 + 단어/문법 노트 + 하단 날짜)을 뺀
          // 실제 남는 세로 공간의 근사치. 몇 줄로 감싸지든 이 높이는 절대 못 넘게 강제 —
          // 이전 버그(폭만 맞추고 높이는 무제한으로 커져서 아래 내용을 다 밀어내고 잘림)
          // 재발 방지. 문장이 길어서 2줄이 되면 "이 높이 안에서" 나눠 쓰는 거라 1줄일 때
          // 보다 글자가 작아질 수 있음 — 세로 공간이 그만큼 빠듯하다는 뜻.
          maxHeight: big ? 100 : 72
        });
        var fimg = w.addImage(fi.image);
        fimg.imageSize = new Size(fi.width, fi.height);
        fimg.leftAlignImage();
        drewFuri = true;
      } catch(furiErr){ drewFuri = false; }
    }
    if(!drewFuri){
      // furigana 데이터 없는(옛) 항목이거나 렌더 실패 시: 기존 두 줄(문장 / 히라가나) 방식
      var sj = w.addText(cur.sentenceJP);
      sj.font = jpSemi(sentPx); sj.textColor = new Color(c.ink);
      sj.minimumScaleFactor = MINS;
      w.addSpacer(f(4));
      var rd = w.addText(cur.readingHiragana);
      rd.font = Font.systemFont(f(big ? 26 : 21)); rd.textColor = new Color(c.soft);
      rd.minimumScaleFactor = MINS;
    }
    w.addSpacer(f(big ? 10 : 8));
    var tr = w.addText(cur.translationKR);
    tr.font = Font.mediumSystemFont(f(big ? 17 : 14)); tr.textColor = new Color(c.ink);
    tr.minimumScaleFactor = MINS;

    if(big){
      w.addSpacer(f(10));
      // 생성 시 단어는 2~4개 저장되는데 여기선 2개만 잘라서 보여주고 있었음 — 저장된 건
      // 다 보이게 4개까지 늘림(그만큼 문법은 2개로 줄이고 폰트/줄간격도 살짝 줄여서
      // 세로 공간 총량은 비슷하게 유지 — 안 그러면 furigana 문장 영역이 다시 밀려 잘림).
      var vn = (cur.kanjiNotes || []).slice(0, 4);
      for(var vi = 0; vi < vn.length; vi++){
        var nt = vn[vi];
        var lv = w.addText("語  " + nt.word + "  " + nt.reading + "  " + nt.meaningKR);
        lv.font = Font.systemFont(f(12)); lv.textColor = new Color(c.soft);
        lv.minimumScaleFactor = MINS; w.addSpacer(f(2));
      }
      var gn = (cur.grammarNotes || []).slice(0, 2);
      for(var gi = 0; gi < gn.length; gi++){
        var g = gn[gi];
        var lg = w.addText("文  " + g.point + "  " + g.meaningKR);
        lg.font = Font.systemFont(f(12)); lg.textColor = new Color(c.indigo);
        lg.minimumScaleFactor = MINS; w.addSpacer(f(2));
      }
    }
  }

  w.addSpacer();
  var foot = w.addText(cur.date + (cur.showCount > 1 ? "   ·   복습 " + (cur.showCount - 1) + "회" : ""));
  foot.font = Font.systemFont(f(big ? 11 : 9)); foot.textColor = new Color(c.faint);

  w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);
  Script.setWidget(w);
  if(!config.runsInWidget){
    // 탭해서 열린 경우: 미리보기 대신 지금 위젯에 뜬 항목을 팝업으로(닫기/다음만, 외웠음 불가).
    try {
      if(cur){ await presentWidgetLoop(s, cur); writeState(s); }
      else { w.presentLarge(); }
    } catch(e){}
  }
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

  // row 탭 시 상세 팝업(공용 presentDetail 사용) 후 토글 반영.
  async function showDetail(e){
    var toggled = await presentDetail(e);
    if(toggled){ writeState(s); draw(); table.reload(); }
  }

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
        row.onSelect = function(){ showDetail(e); };
      })(e);
      table.addRow(row);
    }
  }

  draw();

  // n1-review 를 여는 방식(위젯 탭이든 수동 실행이든)과 상관없이, 지금 위젯이 보여주는 것과
  // 동일한 항목(current())을 목록보다 먼저 모달로 바로 띄움 — 리스트에서 찾을 필요 없게.
  try {
    var top = current(s);
    if(top) await showDetail(top);
  } catch(e){}

  await table.present(true);
}

// ---------- watchDay: 애플워치 단어 알림을 하루치 미리 예약 (n1-day처럼 하루 1회 실행) ----------
// generate()/day()와 완전히 격리: state는 읽기만 하고 writeState()를 아예 호출 안 함 —
// API 호출 없음, history/progressIndex/lastNewAt/showCount 등 아무것도 안 건드림(그래서
// 이걸 몇 번을 다시 실행해도 신규·복습 판단·진도에는 0% 영향).
//
// iOS 로컬 알림은 앱(=Scriptable) 하나당 최대 64개까지만 예약 가능 — n1-day 의 문장
// 알림(최대 57개)과 합치면 바로 초과라서, 문장 알림은 끄고(=n1-day 자동화 중지) 이
// watchDay 하나만 쓰는 걸 전제로 함. WATCH_START_HOUR~WATCH_END_HOUR 구간을
// WATCH_INTERVAL_MIN(기본 10분) 간격으로 채우되, 64개를 넘기지 않도록 기본 구간을
// 9~19시(10시간·61개)로 좁혀둠 — 더 넓히고 싶으면 간격을 늘리거나 구간을 줄여야 함.
//
// 각 슬롯마다 가중 랜덤(pickWeightedReview, day()/generate()와 같은 공식 — 덜 노출됐거나
// "외웠음" 아직 안 된 문장 위주)으로 이력 하나를 골라, 그 안의 목표 한자가 포함된
// 단어(kanjiNotes)를 뽑아 "단어 / 후리가나 / 한글번역"으로 알림 예약. 아이폰 알림은
// 페어링된 애플워치로 자동 미러링되므로(기기의 Watch 앱 > Notifications 에서 Scriptable
// 미러링이 켜져 있어야 함) 그 시각에 손목 들면 바로 보임 — Scriptable 자체엔 워치 전용
// API가 없어서 알림 미러링이 유일한 경로.
async function watchDay(cfg){
  try {
    var s = await readState();
    if(!s || !Array.isArray(s.history) || !s.history.length){
      await notify("n1-watch-err", "워치 단어 알림 예약 실패", "먼저 n1-generate 를 한 번 실행해 이력을 만드세요.");
      return;
    }
    var STEP = cfg.WATCH_INTERVAL_MIN || 10;
    var startH = (cfg.WATCH_START_HOUR != null) ? cfg.WATCH_START_HOUR : 9;
    var endH = (cfg.WATCH_END_HOUR != null) ? cfg.WATCH_END_HOUR : 19;
    var startMin = startH * 60, endMin = endH * 60;
    var slotCount = Math.floor((endMin - startMin) / STEP) + 1;
    if(slotCount > 64){
      await notify("n1-watch-err", "워치 단어 알림 설정 오류",
        slotCount + "개 필요(64개 초과) — WATCH_START_HOUR~WATCH_END_HOUR 구간을 줄이거나 WATCH_INTERVAL_MIN을 늘리세요.");
      return;
    }

    var now = new Date(), today = dateJST();
    var sessionBumps = {}, count = 0;
    for(var m = startMin; m <= endMin; m += STEP){
      var hh = Math.floor(m / 60), mm = m % 60, key = pad2(hh) + ":" + pad2(mm);
      var slotDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
      if(slotDate.getTime() <= Date.now() + 5000) continue;   // 이미 지난 시각은 건너뜀

      var picked = pickWeightedReview(s.history, sessionBumps);
      if(!picked) continue;
      sessionBumps[picked.id] = (sessionBumps[picked.id] || 0) + 1;

      var hw = pickHeadword(picked);
      var title, body;
      if(hw){ title = hw.word; body = hw.reading + "\n" + hw.meaningKR; }
      else { title = picked.targetKanji; body = picked.readingHiragana + "\n" + picked.translationKR; }   // 옛 항목 폴백

      await notify("n1-watch-" + today + "-" + key.replace(":", ""), title, body, slotDate);
      count++;
    }
    console.log("OK watchDay " + count + "칸 예약(" + today + " " + pad2(startH) + ":00~" + pad2(endH) + ":00, " + STEP + "분 간격)");
  } catch(e){
    await notify("n1-watch-err", "워치 단어 알림 예약 실패", String(e && e.message ? e.message : e));
    throw e;
  }
}

// ---------- cloud: 지금 Gist 에 올라가 있는 오늘치 데이터를 눈으로 확인 ----------
// day()/generate() 가 클라우드에 올린 그 데이터(다른 기기가 읽어가는 것)를 폰에서 탭 한 번으로
// 확인하기 위한 읽기 전용 액션 — state 파일·진도·알림 아무것도 안 건드림.
//   · cfg.GIST_TOKEN 있으면  https://api.github.com/gists/<GIST_ID> 인증 GET(secret gist 대응)
//   · 토큰 없으면            같은 엔드포인트를 비인증 GET 으로 폴백(public gist 만, 레이트리밋 있음)
//     ※ gist "raw" 호스트(gist.githubusercontent.com)는 URL 에 계정명이 필요한데 그 값을 저장해
//       두지 않으므로, 계정명 없이도 확실히 동작하는 비인증 API 경로를 폴백으로 씀.
//   · cfg.GIST_ID 자체가 없으면 안내만 하고 종료.
async function cloud(cfg){
  var inApp = false;
  try { inApp = (typeof config !== "undefined") && config.runsInApp; } catch(e){}

  async function show(title, msg){
    console.log("[n1] cloud() · " + title + "\n" + msg);
    if(inApp){
      try { var a = new Alert(); a.title = title; a.message = msg; a.addAction("확인"); await a.present(); } catch(e){}
    } else {
      try { await notify("n1-cloud-" + Date.now(), title, msg); } catch(e){}
    }
  }

  if(!cfg || !cfg.GIST_ID){
    return show("클라우드 미설정", "클라우드 동기화가 설정되지 않았습니다.\nn1-config 에서 GIST_ID / GIST_TOKEN 을 채운 뒤 다시 실행하세요.");
  }

  // ---- 1) Gist 에서 n1-today.json 읽기 ----
  var raw = null, via = cfg.GIST_TOKEN ? "API(인증)" : "API(비인증)";
  try {
    var req = new Request("https://api.github.com/gists/" + cfg.GIST_ID);
    req.method = "GET";
    var headers = { "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Cache-Control": "no-cache" };
    if(cfg.GIST_TOKEN) headers["Authorization"] = "Bearer " + cfg.GIST_TOKEN;
    req.headers = headers;
    var meta = await req.loadJSON();
    var status = (req.response && req.response.statusCode) || 0;
    if(status === 401) return show("클라우드 확인 실패", "인증 실패(401) — GIST_TOKEN 이 만료됐거나 잘못됐습니다.");
    if(status === 403) return show("클라우드 확인 실패", "요청이 거부됨(403) — API 레이트리밋이거나 토큰 권한 부족.\n잠시 후 다시 시도하세요.");
    if(status === 404) return show("클라우드 확인 실패", "Gist 를 찾을 수 없습니다(404) — GIST_ID 를 확인하세요.\n(secret gist 는 GIST_TOKEN 이 필요합니다.)");
    if(meta && meta.message && !meta.files) return show("클라우드 확인 실패", "GitHub 오류: " + meta.message);
    var file = meta && meta.files && meta.files["n1-today.json"];
    if(!file) return show("클라우드 데이터 없음", "Gist 안에 n1-today.json 이 아직 없습니다 — n1-day 를 한 번 실행하세요.");
    raw = (file.truncated && file.raw_url) ? await new Request(file.raw_url).loadString() : file.content;
  } catch(e){
    return show("클라우드 확인 실패", "네트워크/조회 실패: " + String(e && e.message ? e.message : e));
  }

  if(raw == null || String(raw).trim() === "") return show("클라우드 확인 실패", "받아온 데이터가 비어 있습니다.");

  var data;
  try { data = JSON.parse(raw); }
  catch(e){ return show("클라우드 확인 실패", "JSON 파싱 실패: " + String(e && e.message ? e.message : e) + "\n\n원문 일부:\n" + String(raw).slice(0, 200)); }

  var slots = (data && Array.isArray(data.slots)) ? data.slots.slice() : [];
  if(!slots.length) return show("클라우드 데이터 없음", "아직 업로드된 데이터가 없습니다 — n1-day 를 실행하세요.");

  slots.sort(function(a, b){ var ak = a.key || "", bk = b.key || ""; return ak < bk ? -1 : ak > bk ? 1 : 0; });

  // ---- 2) 표시 ----
  var today = dateJST();
  var match = (data.date === today);
  var updatedLocal = "";
  try {
    var u = new Date(data.updatedAt);
    if(!isNaN(u.getTime())){
      updatedLocal = pad2(u.getMonth() + 1) + "/" + pad2(u.getDate()) + " " + pad2(u.getHours()) + ":" + pad2(u.getMinutes());
    }
  } catch(e){}

  var header =
    "날짜: " + (data.date || "?") + (match ? "   ✓ 오늘과 일치" : "   ⚠︎ 오늘(" + today + ")과 다름") + "\n" +
    "업데이트: " + (updatedLocal || data.updatedAt || "?") + "\n" +
    "슬롯 " + slots.length + "칸 · 조회: " + via;

  console.log("[n1] cloud()\n" + header);

  if(!inApp){
    try { await notify("n1-cloud-" + Date.now(), "클라우드 오늘치 · " + slots.length + "칸", header); } catch(e){}
    return;
  }

  var table = new UITable();
  table.showSeparators = true;
  var hr = new UITableRow();
  hr.isHeader = true;
  hr.addText("클라우드 오늘치 · " + slots.length + "칸", header.replace(/\n/g, "   ·   "));
  table.addRow(hr);
  for(var i = 0; i < slots.length; i++){
    (function(sl){
      var row = new UITableRow();
      row.height = 52;
      var bodyFirst = String(sl.body || "").split("\n")[0];
      var main = row.addText((sl.key || "??:??") + "   " + (sl.title || ""), bodyFirst);
      main.titleFont = Font.mediumSystemFont(14);
      main.subtitleFont = Font.systemFont(12);
      main.subtitleColor = Color.gray();
      row.dismissOnSelect = false;
      row.onSelect = function(){
        var a = new Alert();
        a.title = (sl.key || "") + "   " + (sl.title || "");
        a.message = String(sl.body || "(본문 없음)");
        a.addAction("확인");
        a.present();
      };
      table.addRow(row);
    })(slots[i]);
  }
  await table.present(false);
}

module.exports = { generate: generate, day: day, widget: widget, review: review, watchDay: watchDay, cloud: cloud, VERSION: "2026-08-31h" };
