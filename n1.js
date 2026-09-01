// ===== N1 한자 학습 · 통합 모듈 (n1.js) =====
// Scriptable 껍데기 스크립트가 이 파일을 원격에서 불러 실행합니다.
// 로직 수정은 전부 여기서만. 껍데기는 다시 안 건드려도 됩니다.
// VERSION 2026-09-01c

// ---------- 실행 환경 감지 (폰 Scriptable vs 클라우드 Node) ----------
// 이 파일은 두 곳에서 로드된다:
//   1) 폰 — Scriptable 껍데기(stub.js)가 raw URL 에서 통째로 fetch 해 실행. 기존과 동일.
//   2) 클라우드 — scripts/generate-day.mjs 가 require() 로 이 모듈의 "순수 로직"만 재사용
//      (planDay / composeNewEntry / compose / pushTitle …). GitHub Actions 에서 하루치
//      슬롯을 미리 만들어 Gist 에 올리는 용도.
// 파일을 쪼개지 않고(=단일 파일 유지, 껍데기는 여전히 한 파일만 fetch, 빌드 단계 없음,
// 오프라인 캐시도 그대로) 환경만 감지해서 HTTP 전송 계층만 갈아끼운다. Scriptable 에는
// FileManager 전역이 항상 존재하므로 그 유무로 판별.
var IS_NODE = (typeof FileManager === "undefined");

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
// 임의 시각의 JST 벽시계 HH:mm(2자리 0패딩). 슬롯 key 는 예약 시각(JST) 기준이므로
// 기기 로컬 타임존과 무관하게 UTC+9 로 고정 변환. 못 읽으면 null.
function jstHM(t){
  var ms = (typeof t === "number") ? t : Date.parse(String(t));
  if(isNaN(ms)) return null;
  var d = new Date(ms + 9*3600*1000);
  return pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes());
}
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

  return await requestSentence(cfg, prompt);
}

// OpenRouter 호출을 감싸며 "모델 계열별 파라미터 차이"를 방어한다. 폰·클라우드 공용(n1.js) —
// 양쪽 다 이 폴백 사다리의 혜택을 받는다. 폴백이 발동하면 반드시 console.log 로 남긴다:
//   (1) reasoning 끄기를 거부(400) → reasoning 켜서 재시도
//        (예: 일부 Gemini 계열, 일부 OpenAI 추론 모델)
//   (2) max_tokens 를 거부하고 max_completion_tokens 를 요구(400) → 파라미터 키를 바꿔 재시도
//        (OpenAI GPT-5 계열에서 흔함 — 400 응답 본문에 "max_completion_tokens" 가 들어옴)
//   (3) 응답이 비었거나 JSON 파싱 실패 → 추론형 모델이 토큰 예산을 추론에 다 써서
//        content 가 안 왔을 수 있음 → max_tokens 를 4000 으로 올려 딱 1회 재시도
async function requestSentence(cfg, prompt){
  var opts = { disableReasoning: true, maxTokens: 1500, tokenParam: "max_tokens" };
  var res = await callOpenRouter(cfg, prompt, opts);

  if(isApiError(res) && /reasoning/i.test(JSON.stringify(res.error))){
    console.log("[n1] 폴백(1): 모델이 reasoning 끄기를 거부 → reasoning 켜서 재시도");
    opts.disableReasoning = false;
    res = await callOpenRouter(cfg, prompt, opts);
  }

  if(isApiError(res) && /max_completion_tokens/i.test(JSON.stringify(res.error))){
    console.log("[n1] 폴백(2): 모델이 max_tokens 를 거부 → max_completion_tokens 로 바꿔 재시도");
    opts.tokenParam = "max_completion_tokens";
    res = await callOpenRouter(cfg, prompt, opts);
  }

  if(isApiError(res)) throw new Error("API: " + (res.error.message || JSON.stringify(res.error)));

  var obj = parseSentenceJSON(pickContent(res));
  if(obj === null){
    console.log("[n1] 폴백(3): 응답이 비었거나 JSON 파싱 실패 → max_tokens 1500→4000 으로 올려 1회 재시도");
    opts.maxTokens = 4000;
    res = await callOpenRouter(cfg, prompt, opts);
    if(isApiError(res)) throw new Error("API: " + (res.error.message || JSON.stringify(res.error)));
    obj = parseSentenceJSON(pickContent(res));
  }

  if(obj === null){
    var content = pickContent(res);
    throw new Error(content
      ? "모델이 JSON 형식을 안 지킴: " + content.slice(0, 200)
      : "API 응답 형식 오류: " + JSON.stringify(res).slice(0, 300));
  }
  return obj;
}

function isApiError(res){ return !!(res && res.error); }

function pickContent(res){
  var msg = res && res.choices && res.choices[0] && res.choices[0].message;
  return (msg && typeof msg.content === "string") ? msg.content : "";
}

// content 에서 첫 '{' ~ 마지막 '}' 구간만 잘라 JSON.parse. 실패·빈 문자열이면 null.
function parseSentenceJSON(content){
  var t = String(content || "").trim();
  if(!t) return null;
  var a = t.indexOf("{"), b = t.lastIndexOf("}");
  if(a >= 0 && b > a) t = t.slice(a, b + 1);
  try { return JSON.parse(t); } catch(e){ return null; }
}

// 이 작업엔 깊은 추론이 불필요하므로 기본은 reasoning 끔(속도·비용 절약). 모델 계열별
// 파라미터 차이(max_tokens vs max_completion_tokens, reasoning 끄기 거부)와 빈 응답 대응은
// requestSentence() 가 폴백으로 처리하고, 이 함수는 opts 대로 한 번만 쏜다.
// opts: { disableReasoning:bool, maxTokens:number, tokenParam:"max_tokens"|"max_completion_tokens" }
async function callOpenRouter(cfg, prompt, opts){
  opts = opts || {};
  var tokenParam = opts.tokenParam || "max_tokens";
  var maxTokens = opts.maxTokens || 1500;   // furigana 필드가 추가돼서 응답이 좀 더 길어짐
  var headers = {
    "Authorization": "Bearer " + cfg.OPENROUTER_KEY,
    "Content-Type": "application/json",
    "X-Title": "N1 Kanji"
  };
  var body = {
    model: cfg.MODEL || "openai/gpt-5.6-sol",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  };
  body[tokenParam] = maxTokens;
  if(opts.disableReasoning) body.reasoning = { enabled: false };
  var url = "https://openrouter.ai/api/v1/chat/completions";
  // 폰(Scriptable)은 Request, 클라우드(Node 20+)는 내장 fetch — 어느 쪽이든 반환 계약은
  // "파싱된 JSON 객체"(성공 응답이든 {error:...} 든)로 동일하게 맞춘다.
  if(!IS_NODE){
    var req = new Request(url);
    req.method = "POST";
    req.headers = headers;
    req.body = JSON.stringify(body);
    return await req.loadJSON();
  }
  var res = await fetch(url, { method: "POST", headers: headers, body: JSON.stringify(body) });
  var text = await res.text();
  try { return JSON.parse(text); }
  catch(e){ return { error: { message: "OpenRouter 응답이 JSON 이 아님(HTTP " + res.status + "): " + String(text).slice(0, 200) } }; }
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
//
// extraFiles: { "파일명": "문자열 내용" } — 넘기면 같은 PATCH 요청에 함께 실어 올린다.
//   cloud() 가 n1-today.json 과 n1-state.json 을 한 번의 API 호출로 올리는 데 씀.
async function pushCloud(cfg, today, slots, extraFiles){
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
    var files = { "n1-today.json": { content: JSON.stringify(payload) } };
    if(extraFiles && typeof extraFiles === "object"){
      for(var fk in extraFiles){
        if(Object.prototype.hasOwnProperty.call(extraFiles, fk) && typeof extraFiles[fk] === "string"){
          files[fk] = { content: extraFiles[fk] };
        }
      }
    }
    req.body = JSON.stringify({ files: files });
    var resp = await req.loadJSON();
    // loadJSON 은 HTTP 에러여도 예외를 안 던지고 GitHub 에러 본문({message,...})을 그대로 줌 —
    // 그런 경우도 실패로 잡아냄.
    if(resp && resp.message && !resp.files){
      console.log("[n1] 클라우드 동기화 실패(무시): " + resp.message);
      return { ok: false, reason: resp.message };
    }
    console.log("[n1] 클라우드 동기화 OK · " + sorted.length + "칸" +
      (extraFiles ? " (+" + Object.keys(extraFiles).join(",") + ")" : ""));
    return { ok: true, count: sorted.length };
  } catch(e){
    var msg = String(e && e.message ? e.message : e);
    console.log("[n1] 클라우드 동기화 실패(무시): " + msg);
    return { ok: false, reason: msg };
  }
}

// n1-state.json 만 단독으로 PATCH — cloud() 에서 슬롯이 이미 원격과 동일해 n1-today.json
// PATCH 를 건너뛰는 경우에만 쓴다(평소엔 pushCloud 의 extraFiles 로 한 번에 올림).
async function pushCloudState(cfg, stateJSON){
  if(!cfg || !cfg.GIST_ID || !cfg.GIST_TOKEN) return { skipped: true, reason: "GIST 미설정" };
  try {
    var req = new Request("https://api.github.com/gists/" + cfg.GIST_ID);
    req.method = "PATCH";
    req.headers = {
      "Authorization": "Bearer " + cfg.GIST_TOKEN,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
    req.body = JSON.stringify({ files: { "n1-state.json": { content: stateJSON } } });
    var resp = await req.loadJSON();
    if(resp && resp.message && !resp.files) return { ok: false, reason: resp.message };
    return { ok: true };
  } catch(e){
    return { ok: false, reason: String(e && e.message ? e.message : e) };
  }
}

// UTF-8 바이트 길이 (Scriptable·Node 양쪽). Gist 파일 크기 한도 경고·표시에 씀.
function byteLen(str){
  var s = String(str == null ? "" : str);
  try { if(typeof Buffer !== "undefined" && Buffer.byteLength) return Buffer.byteLength(s, "utf8"); } catch(e){}
  var n = 0;
  for(var i = 0; i < s.length; i++){
    var c = s.charCodeAt(i);
    if(c < 0x80) n += 1;
    else if(c < 0x800) n += 2;
    else if(c >= 0xD800 && c <= 0xDBFF){ n += 4; i++; }   // surrogate pair
    else n += 3;
  }
  return n;
}

// cloud() 보조: 폰 전체 상태(s)를 Gist 의 n1-state.json 으로 올릴지 판단한다.
// generate-day.mjs 가 읽는 스키마와 동일 — 폰 상태 객체는 그 상위집합이라 그대로 올리면
// 됨(normalizeState 가 kanjiList/history/pending/progressIndex/cycle/updatedAt 만 봄).
// 반환: { upload:bool, json:string|null, line:string } — line 은 cloud() 헤더에 그대로
//        들어갈 "상태: …" 한 줄.
// 안전제일: 조금이라도 애매하면 upload=false (빈/오래된 상태로 클라우드 진도를 덮지 않음).
function planStateUpload(s, localUpdatedAt, remoteStateRaw){
  var no = function(line){ return { upload: false, json: null, line: "상태: " + line }; };

  // 로컬 상태 온전성 — 하나라도 이상하면 업로드 금지.
  if(!s || typeof s !== "object") return no("업로드 생략 — 로컬 상태 없음");
  if(!Array.isArray(s.kanjiList) || !s.kanjiList.length) return no("업로드 생략 — kanjiList 비어 있음");
  if(!Array.isArray(s.history) || !s.history.length) return no("업로드 생략 — history 비어 있음 (진도 보호)");

  // JSON 직렬화가 정상인지(왕복 파싱까지) 확인.
  var json;
  try {
    json = JSON.stringify(s);
    if(!json || json.charAt(0) !== "{") throw new Error("객체 JSON 이 아님");
    JSON.parse(json);
  } catch(e){
    return no("업로드 실패 — JSON 직렬화 오류: " + String(e && e.message ? e.message : e));
  }

  var bytes = byteLen(json);
  if(bytes > 1024 * 1024){
    console.log("[n1] cloud() · ⚠️ n1-state.json " + bytes + "바이트 (>1MB) — Gist 파일 크기 한도에 근접");
  }

  var prog = (typeof s.progressIndex === "number" ? s.progressIndex : "?") + "/" + s.kanjiList.length;
  var yes = function(){
    return { upload: true, json: json,
      line: "상태: 업로드 OK (" + bytes + "바이트 · history " + s.history.length + "건 · 진도 " + prog + ")" };
  };

  // 원격에 n1-state.json 이 없으면 → 로컬을 그대로 시드 업로드.
  var raw = (remoteStateRaw == null) ? "" : String(remoteStateRaw).trim();
  if(raw === "") return yes();

  // 원격 상태 파싱 실패 → 덮어쓰기 위험, 업로드 안 함.
  var remote;
  try { remote = JSON.parse(raw); }
  catch(e){ return no("업로드 안 함 — 원격 상태 파싱 불가 (덮어쓰기 위험)"); }

  // updatedAt 비교 — 파싱 불가면 안전하게 업로드 안 함.
  var remoteUpdatedAt = (remote && remote.updatedAt != null) ? remote.updatedAt : "";
  var lp = Date.parse(localUpdatedAt == null ? "" : localUpdatedAt);
  var rp = Date.parse(remoteUpdatedAt);
  if(isNaN(lp) || isNaN(rp)){
    return no("업로드 안 함 — updatedAt 파싱 불가 (로컬 " + (localUpdatedAt || "없음") +
      " / 원격 " + (remoteUpdatedAt || "없음") + ")");
  }
  if(lp > rp) return yes();
  if(rp > lp){
    return no("클라우드가 더 최신 — 업로드 안 함 (원격 " + remote.updatedAt + " / 로컬 " + localUpdatedAt + ")");
  }
  return no("최신 — 업로드 생략");
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

// 슬롯 동일성 판정 기준: key 단독이 아니라 (key, title, body) 3개 조합.
// 같은 분(minute)에 서로 다른 단어가 2개 이상 생성되는 건 정상이므로, key 만으로
// 중복 제거하면 서로 다른 항목이 사라진다(문제 2). 3개 값을 JSON 배열로 직렬화해 서명.
function slotSig(sl){
  return JSON.stringify([sl && sl.key || "", sl && sl.title || "", sl && sl.body || ""]);
}

// (key,title,body) 가 완전히 같은 슬롯이 이미 있으면 추가하지 않고, 없으면 추가.
// day()/generate() 가 하루에 여러 번 불려도 정확히 같은 슬롯은 중복 누적되지 않되,
// 같은 시각의 다른 단어는 각각 보존된다.
function upsertSlot(arr, slot){
  if(!Array.isArray(arr) || !slot || !slot.key) return;   // 방어: 배열 아닌 값·undefined·key 없음
  var sig = slotSig(slot);
  for(var i = 0; i < arr.length; i++){
    if(arr[i] && slotSig(arr[i]) === sig) return;   // 이미 동일 — 중복 추가 안 함
  }
  arr.push({ key: slot.key, title: slot.title || "", body: slot.body || "" });
}

// 슬롯 배열을 정렬한 "새" 배열로(원본 불변). key 오름차순이 1차, 같으면 title → body 순.
// key/title/body 만 남겨 정규화 — gist 에서 온 슬롯에 잡다한 필드가 붙어 있어도 비교/
// 업로드가 안정적이게. (중복 제거는 하지 않음 — mergeSlots/upsertSlot 이 담당)
function sortSlots(arr){
  var a = (Array.isArray(arr) ? arr : []).filter(function(x){ return x && x.key; })
    .map(function(x){ return { key: x.key, title: x.title || "", body: x.body || "" }; });
  a.sort(function(p, q){
    if(p.key !== q.key) return p.key < q.key ? -1 : 1;
    if(p.title !== q.title) return p.title < q.title ? -1 : 1;
    if(p.body !== q.body) return p.body < q.body ? -1 : 1;
    return 0;
  });
  return a;
}

// 정렬 후 (key,title,body) 까지 완전히 같은지(깊은 비교) — 병합 결과가 원격과 똑같으면
// 굳이 PATCH 안 해서 불필요한 API 호출·Gist 리비전을 막는 데 씀.
function slotsEqual(a, b){
  var x = sortSlots(a), y = sortSlots(b);
  if(x.length !== y.length) return false;
  for(var i = 0; i < x.length; i++){
    if(x[i].key !== y[i].key || x[i].title !== y[i].title || x[i].body !== y[i].body) return false;
  }
  return true;
}

// (key,title,body) 기준 합집합. 같은 key 라도 title/body 가 다르면 둘 다 보존(문제 2).
// 원격 먼저 넣고 로컬로 덮어써서, 완전히 같은 슬롯이 양쪽에 있을 때 로컬 값을 우선.
// 결과 정렬은 호출부(sortSlots)에 맡김.
function mergeSlots(localSlots, remoteSlots){
  var bySig = {}, order = [], i;
  function add(sl){
    if(!sl || !sl.key) return;
    var norm = { key: sl.key, title: sl.title || "", body: sl.body || "" };
    var sig = slotSig(norm);
    if(!bySig[sig]) order.push(sig);
    bySig[sig] = norm;
  }
  for(i = 0; i < (remoteSlots || []).length; i++) add(remoteSlots[i]);
  for(i = 0; i < (localSlots || []).length; i++) add(localSlots[i]);
  var out = [];
  for(i = 0; i < order.length; i++) out.push(bySig[order[i]]);
  return out;
}

// 기존 상태에서 오늘치 슬롯 목록을 [{key,title,body}] 로 복원. cloud() 는 s.cloudSlots[today]
// 유무와 상관없이 항상 이걸 부르고 그 결과를 기존 cloudSlots 와 합집합한다.
// 실제 n1_state.json 스키마 기준(2026-08-31j):
//   (A) s.history — e.date === today 인 항목 전부. key 는:
//        1) id 의 "#" 뒤가 HH:mm 형식이면 그것(= 그 항목의 예정 슬롯 시각, JST).
//           예: "2026-08-31T14:00:00.000Z#23:00" → "23:00"
//        2) 아니면(숫자 인덱스 등) lastSlotAt(없으면 lastShownAt)을 JST(UTC+9) HH:mm 로.
//        3) 둘 다 없으면 스킵.
//       title/body 는 pushTitle(mode, e, s) / pushBody(e) 재사용. mode 없으면
//       showCount>1 ? "review" : "new".
//   (B) s.pending — 앞으로 예약된 복습. slotISO 를 JST HH:mm 로 key, id 로 history 에서
//       원본 항목을 찾아 pushTitle("review", ent, s) / pushBody(ent). 못 찾으면 스킵.
//   (C) 예약된 로컬 알림(Notification.allPending, id "n1-slot-<today>-HHMM") — 보조.
//       없어도 A·B 만으로 충분.
// A+B+C 를 (key,title,body) 3개 조합 기준 합집합 — 같은 key 라도 title/body 가 다르면
// 둘 다 보존(같은 분에 두 단어 있어도 유실 금지). 복원할 게 없으면 [] 반환.
async function restoreTodaySlots(s, today){
  var out = [], seen = {};
  function push(slot){
    if(!slot || !slot.key) return false;
    var norm = { key: slot.key, title: slot.title || "", body: slot.body || "" };
    var sig = slotSig(norm);
    if(seen[sig]) return false;
    seen[sig] = 1;
    out.push(norm);
    return true;
  }
  var cHist = 0, cPend = 0, cNotif = 0;

  // "9:15" → "09:15" 로 정규화. HH:mm 형식이 아니면 null.
  function normHM(str){
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(str || "").trim());
    if(!m) return null;
    var hh = parseInt(m[1], 10), mm = parseInt(m[2], 10);
    if(hh > 23 || mm > 59) return null;
    return pad2(hh) + ":" + pad2(mm);
  }
  // id "…#접미사" 에서 접미사만.
  function idSuffix(id){
    if(typeof id !== "string") return null;
    var i = id.indexOf("#");
    return i < 0 ? null : id.slice(i + 1);
  }

  var hist = Array.isArray(s.history) ? s.history : [];

  // ---- (A) history (오늘 항목 전부) ----
  for(var h = 0; h < hist.length; h++){
    var e = hist[h];
    if(!e || e.date !== today) continue;
    var ek = normHM(idSuffix(e.id))                       // 1) id 접미사가 HH:mm
          || jstHM(e.lastSlotAt || e.lastShownAt);        // 2) 예약/노출 시각 → JST HH:mm
    if(!ek) continue;                                     // 3) 스킵
    // pushTitle()/pushBody() 가 옛/손상 항목에서 던지더라도 그 한 칸만 건너뛰고 계속.
    try {
      var mode = e.mode || ((e.showCount || 1) > 1 ? "review" : "new");
      if(push({ key: ek, title: pushTitle(mode, e, s), body: pushBody(e) })) cHist++;
    } catch(te){ console.log("[n1] restore · history 항목 스킵: " + te); }
  }

  // ---- (B) s.pending (앞으로 예약된 복습) ----
  var pendArr = Array.isArray(s.pending) ? s.pending : [];
  for(var p = 0; p < pendArr.length; p++){
    var it = pendArr[p];
    if(!it || !it.slotISO) continue;
    var pk = jstHM(it.slotISO);
    if(!pk) continue;
    var ent = null;
    for(var q = 0; q < hist.length; q++){ if(hist[q] && hist[q].id === it.id){ ent = hist[q]; break; } }
    if(!ent) continue;
    try {
      if(push({ key: pk, title: pushTitle("review", ent, s), body: pushBody(ent) })) cPend++;
    } catch(pe){ console.log("[n1] restore · pending 항목 스킵: " + pe); }
  }

  // ---- (C) 예약된 로컬 알림 (보조) ----
  // allPending() 은 비동기 API(반드시 await), 위젯/알림 컨텍스트에서 실패할 수 있어 try/catch.
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
      if(push({ key: nk, title: n.title, body: n.body || "" })) cNotif++;
    }
  } catch(e){ console.log("[n1] restore · allPending 조회 실패(무시): " + e); }

  out = sortSlots(out);
  console.log("[n1] 복원: history " + cHist + " · pending " + cPend + " · 알림 " + cNotif +
    " → 병합 후 " + out.length + "칸");
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
  return commitNewEntry(cfg, s, slotISO, idSuffix, kanji, c);
}

// compose() 가 만든 예문 객체(c)를 history 에 넣고 커리큘럼 진도를 전진시킨다.
// composeNewEntry() 에서 분리한 이유: 클라우드 dry-run(예문 생성 없이 계획만 확인)에서도
// 진도 전진 규칙(REPS_PER_KANJI · cycle 넘김 · lastNewAt)을 똑같이 태우기 위함 —
// dry-run 은 c 자리에 가짜 예문만 넣고 이 함수를 부른다. 진도 규칙은 여기 한 곳에만.
function commitNewEntry(cfg, s, slotISO, idSuffix, kanji, c){
  if(!Array.isArray(s.history)) s.history = [];
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

// ---------- planDay: 하루치 슬롯 계획 (순수 로직 · 폰/클라우드 공용) ----------
// day()(폰) 와 scripts/generate-day.mjs(클라우드) 가 공유하는 유일한 계획 경로.
// 여기 한 곳에만 있는 규칙:
//   · 그리드     — START_HOUR~END_HOUR 를 INTERVAL_MIN 간격(기본 09:00~23:00 / 15분).
//   · 신규 주기  — 슬롯 분(分)이 NEW_EVERY_MIN 의 배수면 신규(기본 30분마다), 나머지는 복습.
//   · 컷오프     — isPastNewCutoff(cfg) 면 전량 복습(신규 0).
//   · 복습 선택  — pickWeightedReview(가중 랜덤) + sessionBumps(이 배치 내 연속중복 방지).
// s 를 그 자리에서 수정: 신규 슬롯마다 composeNewEntry() 가 history 에 unshift 하고
// progressIndex/kanjiRepCount/cycle/lastNewAt 를 전진. 복습 슬롯은 pending 에 쌓임.
//
// opts:
//   now              Date      "오늘"의 기준(슬롯 Date 구성). 기본 new Date().
//   alreadyKeys      string[]  이미 처리된 slot key(재실행 시 건너뜀). 기본 [].
//   compose          fn        신규 예문 생성기 (cfg,s,slotISO,idSuffix)=>entry.
//                              기본 composeNewEntry. dry-run 은 API 안 부르는 stub 주입.
//   newErrorFallback bool      신규 생성 실패 시 그 칸을 복습으로 대체하고 계속할지.
//                              기본 false(예외 전파 = 기존 day() 동작). 클라우드가 true.
//   onNewError       fn        newErrorFallback 시 (err, slot) 로 실패 보고.
// 반환: { todo, plan:[{key,slotDate,slotISO,title,body,mode}], pending:[{id,slotISO}],
//        newCount, reviewCount }
async function planDay(cfg, s, opts){
  opts = opts || {};
  var now = opts.now || new Date();
  var makeNew = opts.compose || composeNewEntry;
  var alreadyKeys = opts.alreadyKeys || [];
  if(!Array.isArray(s.history)) s.history = [];

  var STEP = cfg.INTERVAL_MIN || 15;
  var NEWEVERY = cfg.NEW_EVERY_MIN || 30;
  var startH = (cfg.START_HOUR != null) ? cfg.START_HOUR : 9;
  var endH = (cfg.END_HOUR != null) ? cfg.END_HOUR : 23;
  var startMin = startH * 60, endMin = endH * 60;
  var pastCutoff = isPastNewCutoff(cfg);

  var todo = [];
  for(var mnt = startMin; mnt <= endMin; mnt += STEP){
    var hh = Math.floor(mnt / 60), mm = mnt % 60;
    var key = pad2(hh) + ":" + pad2(mm);
    if(alreadyKeys.indexOf(key) === -1){
      todo.push({ h: hh, min: mm, key: key, isNew: !pastCutoff && (mnt % NEWEVERY === 0) });
    }
  }

  var plan = [], pending = [], sessionBumps = {}, newCount = 0;
  for(var i = 0; i < todo.length; i++){
    var slot = todo[i];
    var slotDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), slot.h, slot.min, 0, 0);
    var slotISO = slotDate.toISOString();
    var cur, mode;

    if(slot.isNew || s.history.length === 0){
      try {
        cur = await makeNew(cfg, s, slotISO, slot.key);
        mode = "new";
        newCount++;
      } catch(newErr){
        // 첫 예문(history 0건)도 못 만들면 계획 자체가 불가능 — 그건 항상 던진다.
        if(!opts.newErrorFallback || s.history.length === 0) throw newErr;
        if(typeof opts.onNewError === "function") opts.onNewError(newErr, slot);
        mode = "review";
        cur = pickWeightedReview(s.history, sessionBumps);
        sessionBumps[cur.id] = (sessionBumps[cur.id] || 0) + 1;
        pending.push({ id: cur.id, slotISO: slotISO });
      }
    } else {
      mode = "review";
      cur = pickWeightedReview(s.history, sessionBumps);
      // 아직 그 시각이 안 지났으니 showCount는 여기서 안 올림 — reconcile()이 나중에 처리.
      sessionBumps[cur.id] = (sessionBumps[cur.id] || 0) + 1;
      pending.push({ id: cur.id, slotISO: slotISO });
    }
    plan.push({
      key: slot.key, slotDate: slotDate, slotISO: slotISO,
      title: pushTitle(mode, cur, s), body: pushBody(cur), mode: mode
    });
  }
  return { todo: todo, plan: plan, pending: pending, newCount: newCount, reviewCount: plan.length - newCount };
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

    // 슬롯 계획(그리드·신규/복습 규칙·가중 랜덤 복습·배치 내 연속중복 방지)은 planDay()
    // 한 곳에만 있다 — 클라우드 생성기(scripts/generate-day.mjs)도 같은 함수를 부른다.
    // 신규 슬롯은 planDay() 안에서 composeNewEntry() 로 실제 API 호출까지 끝냄. 도중
    // 실패하면 여기 도달 전에 예외로 빠져 저장이 안 되므로 안전 재시도 성질은 그대로.
    var planned = await planDay(cfg, s, { now: new Date(), alreadyKeys: already });
    var todo = planned.todo;
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

    // 1단계 완료: planDay() 가 메모리에서 plan/pending 을 만들었고(신규는 API 호출까지),
    // s.history/progressIndex/lastNewAt 도 그 안에서 전진됨. 아직 writeState() 전.
    var plan = planned.plan;             // [{key,slotDate,slotISO,title,body,mode}]
    var pending = planned.pending;       // [{id,slotISO}] — 아래 2단계에서 s.pending에 합침
    var newCount = planned.newCount;     // 이번 실행에서 새로 만든 신규 예문 수(요약용)
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

// ---------- cloud: 폰 로컬 상태와 Gist 를 "같아지도록" 맞춤(동기화) ----------
// 예전 cloud() 는 Gist 를 읽어서 보여주기만 했음. 이제는: 폰(iOS) 로컬에 쌓인 오늘치
// 슬롯이 원본(source of truth)이고 Gist 는 그 사본이라는 전제로, 탭 한 번에 양쪽을
// 같게 만든다. day()/generate() 가 이미 쓰는 pushCloud() · restoreTodaySlots() 를 그대로
// 재사용하므로 업로드 포맷·복원 로직이 완전히 일치.
//
// 흐름:
//   1) 로컬 오늘치 슬롯 구성 — 항상 restoreTodaySlots() 를 돌리고 그 결과와 기존
//      s.cloudSlots[today] 를 (key,title,body) 합집합으로 병합해 s.cloudSlots[today] 에 저장.
//   2) 원격(Gist) 조회 — 예전 cloud() 와 동일한 인증/비인증 GET.
//   3) 병합 — 원격 date 가 오늘과 다르면 로컬로 통째 교체, 같으면 (key,title,body) 합집합
//      (로컬 우선). 같은 key 라도 title/body 가 다르면 둘 다 보존.
//   3b) 폰 전체 상태(s) 를 Gist 의 n1-state.json 으로 올릴지 판단(planStateUpload) —
//      원격에 없으면 시드, 있으면 로컬 updatedAt 이 원격보다 최신일 때만. 클라우드
//      생성기(scripts/generate-day.mjs)가 이 파일로 진도를 이어가므로 수동 붙여넣기가
//      더는 필요 없다. 슬롯 동기화와 완전히 독립(개별 try/catch·각각 결과 보고).
//   4) 차이 있을 때만 pushCloud() 로 업로드(정렬 후 key/title/body 깊은 비교). 상태도
//      올릴 게 있으면 같은 PATCH 요청에 n1-state.json 을 함께 실어 API 호출 1회로.
//      (슬롯이 이미 원격과 동일해 PATCH 를 건너뛰는 경우엔 pushCloudState() 단독 PATCH.)
//   5) 결과 표시 — inApp 이면 UITable(행마다 +/~/무표시로 출처 구분), 자동 실행이면 Notification 요약.
//      헤더에 "상태: …" 한 줄(업로드 OK / 최신·생략 / 클라우드가 더 최신 / 업로드 실패).
//
// 안전장치:
//   · 로컬이 0칸으로 복원되면 절대 업로드 안 함(빈 데이터로 Gist 덮어쓰기 방지).
//   · 원격 조회 실패 시 병합 자체를 안 함(덮어쓰기로 인한 데이터 유실 방지).
//   · 상태 업로드는 history 가 비었거나 kanjiList 가 비면 안 함(빈 상태로 클라우드
//     진도를 덮으면 유실). JSON 직렬화 왕복 확인, 1MB 초과 시 경고 로그.
//   · updatedAt 을 파싱 못 하거나 원격이 더 최신이면 업로드하지 않고 그 사실을 알림.
//   · 모든 단계 개별 try/catch — 조용히 죽지 않게.
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

  var today = dateJST();

  // ---- 1) 로컬 오늘치 슬롯 구성 ----
  var s = null;
  try { s = await readState(); }
  catch(e){ return show("로컬 상태 조회 실패", "state 파일을 읽지 못했습니다: " + String(e && e.message ? e.message : e)); }
  if(!s || !Array.isArray(s.kanjiList)){
    return show("로컬 상태 없음", "로컬 state 파일이 없거나 손상됐습니다 — 먼저 n1-generate 를 한 번 실행하세요.");
  }
  // ⚠️ s.updatedAt 을 아래 슬롯 구성에서 nowISO() 로 덮어쓰므로, 원격 상태와 비교할
  // "진짜" 로컬 갱신 시각은 지금 캡처해 둔다. (cloud() 는 진도·history 는 안 건드림)
  var localStateUpdatedAt = s.updatedAt;

  // 항상 restoreTodaySlots() 를 돌리고, 그 결과와 기존 s.cloudSlots[today] 를 (key,title,body)
  // 합집합으로 병합해 로컬 슬롯을 구성한다. 예전엔 s.cloudSlots[today] 가 비었을 때만
  // 복원 경로를 탔는데, generate() 가 올린 몇 칸만 들어 있으면 그 앞의 예약분(알림·history)이
  // 통째로 누락됐다(문제 1). 둘 중 하나가 비어도 동작.
  var restoredCount = 0, existingCount = 0;
  var localSlots = [];
  try {
    var existing = (s.cloudSlots && typeof s.cloudSlots === "object" && Array.isArray(s.cloudSlots[today]))
      ? s.cloudSlots[today] : [];
    existingCount = sortSlots(existing).length;

    var restored = [];
    try { restored = await restoreTodaySlots(s, today); }
    catch(re){ console.log("[n1] cloud() · restoreTodaySlots 실패(무시): " + re); }
    restoredCount = (restored && restored.length) ? restored.length : 0;

    localSlots = sortSlots(mergeSlots(sortSlots(restored || []), sortSlots(existing)));

    if(localSlots.length){
      try {
        if(!s.cloudSlots || typeof s.cloudSlots !== "object") s.cloudSlots = {};
        s.cloudSlots[today] = localSlots.slice();
        s.updatedAt = nowISO();
        writeState(s);
        console.log("[n1] cloud() · 로컬 오늘치 슬롯 구성 " + localSlots.length +
          "칸 (복원 " + restoredCount + " · 기존 " + existingCount + ") 저장");
      } catch(we){ console.log("[n1] cloud() · 로컬 슬롯 저장 실패(무시): " + we); }
    }
  } catch(e){
    console.log("[n1] cloud() · 로컬 슬롯 구성 실패(무시): " + e);
  }
  localSlots = sortSlots(localSlots);

  // 안전장치: 로컬이 0칸이면 여기서 중단 — 빈 데이터로 Gist 를 절대 덮어쓰지 않는다.
  if(!localSlots.length){
    return show("로컬에 오늘치 데이터가 없습니다",
      "로컬에서 오늘치(" + today + ") 슬롯을 하나도 찾지 못했습니다.\n" +
      "빈 데이터로 클라우드를 덮어쓰지 않도록 동기화를 중단합니다.\n" +
      "먼저 n1-generate / n1-day 를 실행하세요.");
  }

  // ---- 2) 원격(Gist) 조회 ---- (예전 cloud() 와 동일한 방식)
  var via = cfg.GIST_TOKEN ? "API(인증)" : "API(비인증)";
  var remote = null, fetchErr = null, remoteStateRaw = null;
  try {
    var req = new Request("https://api.github.com/gists/" + cfg.GIST_ID);
    req.method = "GET";
    var headers = { "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Cache-Control": "no-cache" };
    if(cfg.GIST_TOKEN) headers["Authorization"] = "Bearer " + cfg.GIST_TOKEN;
    req.headers = headers;
    var meta = await req.loadJSON();
    var status = (req.response && req.response.statusCode) || 0;
    if(status === 401) fetchErr = "인증 실패(401) — GIST_TOKEN 이 만료됐거나 잘못됐습니다.";
    else if(status === 403) fetchErr = "요청 거부(403) — API 레이트리밋이거나 토큰 권한 부족.";
    else if(status === 404) fetchErr = "Gist 를 찾을 수 없습니다(404) — GIST_ID 를 확인하세요.";
    else if(meta && meta.message && !meta.files) fetchErr = "GitHub 오류: " + meta.message;
    else {
      var file = meta && meta.files && meta.files["n1-today.json"];
      if(!file){
        remote = { date: null, slots: [], missing: true };   // 원격에 아직 파일 없음 = 빈 원격
      } else {
        var raw = (file.truncated && file.raw_url) ? await new Request(file.raw_url).loadString() : file.content;
        if(raw == null || String(raw).trim() === ""){
          remote = { date: null, slots: [], missing: true };
        } else {
          var data = JSON.parse(raw);
          remote = { date: data.date || null, slots: Array.isArray(data.slots) ? data.slots : [], updatedAt: data.updatedAt };
        }
      }
      // 같은 GET 응답에서 원격 상태(n1-state.json)도 꺼내 둔다 — 추가 API 호출 없음.
      try {
        var sfile = meta && meta.files && meta.files["n1-state.json"];
        if(sfile){
          remoteStateRaw = (sfile.truncated && sfile.raw_url)
            ? await new Request(sfile.raw_url).loadString()
            : sfile.content;
        }
      } catch(se){ console.log("[n1] cloud() · 원격 n1-state.json 읽기 실패(무시): " + se); }
    }
  } catch(e){
    fetchErr = "네트워크/조회/파싱 실패: " + String(e && e.message ? e.message : e);
  }

  // 안전장치: 원격 조회 실패 시 병합·업로드 안 함(덮어쓰기로 데이터 유실 방지).
  if(fetchErr || !remote){
    return show("클라우드 조회 실패 — 동기화 중단",
      (fetchErr || "원격 데이터를 가져오지 못했습니다.") + "\n\n" +
      "데이터 유실 방지를 위해 병합/업로드를 하지 않았습니다.\n" +
      "로컬 오늘치: " + localSlots.length + "칸 (그대로 유지)");
  }

  // ---- 3) 병합 ----
  var remoteSlots = sortSlots(remote.slots);
  var remoteMatch = (remote.date === today);
  var merged, replaced = false;
  try {
    if(remoteMatch){
      merged = mergeSlots(localSlots, remoteSlots);          // (key,title,body) 합집합, 로컬 우선
    } else {
      merged = localSlots.slice();                            // 어제 데이터 등 → 로컬로 통째 교체
      replaced = true;
    }
  } catch(e){
    return show("병합 실패", "슬롯 병합 중 오류: " + String(e && e.message ? e.message : e));
  }
  merged = sortSlots(merged);

  // 각 슬롯이 원격 대비 어떤 상태인지: same(원격에 똑같은 key,title,body 있음) ·
  // upd(같은 key 는 있으나 내용 다름) · new(그 key 자체가 원격에 없음)
  var remoteKeys = {}, remoteSigs = {};
  for(var ri = 0; ri < remoteSlots.length; ri++){
    remoteKeys[remoteSlots[ri].key] = 1;
    remoteSigs[slotSig(remoteSlots[ri])] = 1;
  }
  function slotState(sl){
    if(remoteSigs[slotSig(sl)]) return "same";
    if(remoteKeys[sl.key]) return "upd";
    return "new";
  }
  var newCount = 0, updCount = 0;
  for(var mi = 0; mi < merged.length; mi++){
    var st0 = slotState(merged[mi]);
    if(st0 === "new") newCount++;
    else if(st0 === "upd") updCount++;
  }
  var changedCount = newCount + updCount;

  // ---- 3b) 폰 전체 상태 업로드 판단 (슬롯 동기화와 완전히 독립) ----
  // 여기서 던지는 예외가 슬롯 동기화를 무효화하지 않도록 통째로 try/catch.
  var statePlan;
  try {
    statePlan = planStateUpload(s, localStateUpdatedAt, remoteStateRaw);
  } catch(e){
    statePlan = { upload: false, json: null,
      line: "상태: 업로드 실패 — 판단 중 오류: " + String(e && e.message ? e.message : e) };
  }
  console.log("[n1] cloud() · " + statePlan.line + (statePlan.upload ? " (예정)" : ""));

  // ---- 4) 차이 있을 때만 업로드 ----
  // 원격 date 가 오늘과 같고 슬롯 내용까지 동일하면 PATCH 스킵. date 가 다르면(어제 등)
  // 슬롯이 우연히 같아도 date 를 오늘로 고쳐야 하므로 업로드.
  // 상태(n1-state.json)를 올려야 하면 가능한 한 슬롯 PATCH 에 함께 실어 API 호출 1회로.
  var identical = remoteMatch && slotsEqual(merged, remoteSlots);
  var stateExtra = statePlan.upload ? { "n1-state.json": statePlan.json } : null;
  var stateUploaded = false, stateUploadErr = null;
  var uploadRes;
  if(identical){
    uploadRes = { skipped: true, reason: "이미 동일" };
    console.log("[n1] cloud() · 병합 결과가 원격과 동일 — 슬롯 업로드 스킵(" + merged.length + "칸)");
    // 슬롯 PATCH 는 건너뛰지만 상태는 올려야 할 수 있음 → n1-state.json 단독 PATCH.
    if(stateExtra){
      try {
        var sres = await pushCloudState(cfg, statePlan.json);
        if(sres && sres.ok) stateUploaded = true;
        else stateUploadErr = (sres && sres.reason) || "알 수 없음";
      } catch(e){ stateUploadErr = String(e && e.message ? e.message : e); }
    }
  } else {
    try { uploadRes = await pushCloud(cfg, today, merged, stateExtra); }
    catch(e){ uploadRes = { ok: false, reason: String(e && e.message ? e.message : e) }; }
    if(uploadRes && uploadRes.ok){
      if(stateExtra) stateUploaded = true;   // 같은 PATCH 로 함께 올라감
      try {
        if(!s.cloudSlots || typeof s.cloudSlots !== "object") s.cloudSlots = {};
        s.cloudSlots[today] = merged.slice();
        s.updatedAt = nowISO();
        writeState(s);
      } catch(we){ console.log("[n1] cloud() · 병합 결과 로컬 반영 실패(무시): " + we); }
    } else if(stateExtra){
      stateUploadErr = (uploadRes && uploadRes.reason) || "슬롯 PATCH 실패";
    }
  }

  // 상태 업로드 결과를 헤더용 한 줄로 확정.
  var stateLine;
  if(statePlan.upload){
    stateLine = stateUploaded ? statePlan.line : ("상태: 업로드 실패 — " + (stateUploadErr || "알 수 없음"));
  } else {
    stateLine = statePlan.line;   // 생략 / 최신 / 클라우드가 더 최신 / 직렬화 오류 등
  }
  console.log("[n1] cloud() · " + stateLine);

  // ---- 5) 결과 표시 ----
  // 로컬이 몇 칸인지(복원/기존 내역 포함) 항상 명확히 보이게 — 진단에 필요(문제 3).
  var localLine = "로컬 " + localSlots.length + "칸(복원 " + restoredCount + " · 기존 " + existingCount + ")" +
    " · 클라우드 " + remoteSlots.length + "칸 → 결과 " + merged.length + "칸";
  var summaryLine;
  if(identical){
    summaryLine = localLine + " · 이미 동일(업로드 스킵)";
  } else if(uploadRes && uploadRes.ok){
    summaryLine = localLine + " · 최신화 " + changedCount + "칸 업로드";
  } else {
    summaryLine = localLine + " · 업로드 실패: " + ((uploadRes && uploadRes.reason) || "알 수 없음");
  }
  var modeLine = replaced
    ? (remote.missing
        ? ("원격에 데이터 없음 → 로컬 " + merged.length + "칸 전체 업로드")
        : ("원격 날짜(" + (remote.date || "?") + ")가 오늘과 달라 로컬로 통째 교체 · 결과 " + merged.length + "칸"))
    : ("병합: (key,title,body) 합집합(로컬 우선) · 결과 " + merged.length + "칸 (신규 " + newCount + " · 갱신 " + updCount + ")");
  var header = summaryLine + "\n" + modeLine + "\n" + stateLine + "\n조회: " + via;
  console.log("[n1] cloud()\n" + header);

  if(!inApp){
    try { await notify("n1-cloud-" + Date.now(), "클라우드 동기화 · " + merged.length + "칸", header); } catch(e){}
    return;
  }

  var table = new UITable();
  table.showSeparators = true;
  var hr = new UITableRow();
  hr.isHeader = true;
  hr.addText("클라우드 동기화 · " + merged.length + "칸", header.replace(/\n/g, "   ·   "));
  table.addRow(hr);
  for(var i = 0; i < merged.length; i++){
    (function(sl){
      var st = slotState(sl);
      var mark = st === "new" ? "+ " : st === "upd" ? "~ " : "";
      var row = new UITableRow();
      row.height = 52;
      var bodyFirst = String(sl.body || "").split("\n")[0];
      var main = row.addText(mark + (sl.key || "??:??") + "   " + (sl.title || ""), bodyFirst);
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
    })(merged[i]);
  }
  await table.present(false);
}

module.exports = {
  // 폰(Scriptable 껍데기)이 Script.name() 으로 호출하는 액션들 — 기존 그대로.
  generate: generate, day: day, widget: widget, review: review, watchDay: watchDay, cloud: cloud,
  VERSION: "2026-09-01c",
  // ↓ 클라우드 생성기(scripts/generate-day.mjs)가 재사용하는 순수 로직. 폰에서는 안 쓰이며
  //   추가돼도 껍데기 동작(module.exports[ACTION])에는 영향 없음.
  SEED: SEED,
  planDay: planDay,
  composeNewEntry: composeNewEntry,
  commitNewEntry: commitNewEntry,
  compose: compose,
  reconcile: reconcile,
  pickWeightedReview: pickWeightedReview,
  pushTitle: pushTitle,
  pushBody: pushBody,
  pickHeadword: pickHeadword,
  sortSlots: sortSlots,
  slotSig: slotSig,
  isPastNewCutoff: isPastNewCutoff,
  dateJST: dateJST,
  nowISO: nowISO,
  pad2: pad2
};
