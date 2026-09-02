// ===== N1 한자 학습 · 통합 모듈 (n1.js) =====
// Scriptable 껍데기 스크립트가 이 파일을 원격에서 불러 실행합니다.
// 로직 수정은 전부 여기서만. 껍데기는 다시 안 건드려도 됩니다.
// VERSION 2026-09-01j

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
  return await requestSentence(cfg, buildComposePrompt(kanji, priorWords));
}

// compose() 가 OpenRouter 로 보내는 프롬프트 문자열을 조립한다. compose() 본체에서 떼어낸
// 이유: 클라우드 dry-run(API 미호출)이나 테스트에서 "프롬프트가 스펙대로 조립되는지"를
// 육안으로 검증할 수 있도록 — n1.buildComposePrompt(kanji) 를 그냥 console.log 하면 됨.
function buildComposePrompt(kanji, priorWords){
  var avoidLine = "";
  if(Array.isArray(priorWords) && priorWords.length){
    avoidLine = "이 한자로 이미 다음 단어를 예문에 썼습니다 — 이번엔 가능하면 다른 단어·다른 문형으로 만드세요: " +
      priorWords.join(", ") + "\n\n";
  }
  return (
"당신은 JLPT 일본어 예문 작성기입니다. 목표 한자: 「" + kanji + "」\n\n" + avoidLine +
"「" + kanji + "」를 사용한 자연스럽고 짧은(약 10~25자) 일본어 문장 1개를 만드세요. " +
"목표 한자는 실제로 자주 쓰이는 용법으로, 문장의 나머지 어휘는 JLPT N2 중심(필요하면 N1)으로 구성하세요. " +
"너무 쉬운 N4/N5 남발도, 너무 마이너한 어휘도 피하세요.\n\n" +
"다음 JSON 객체 하나만 출력하세요. 코드블록·설명·그 외 텍스트 금지:\n" +
'{"sentenceJP":"...","readingHiragana":"문장 전체를 히라가나로","translationKR":"자연스러운 한국어 번역","furigana":[{"t":"세그먼트 원문","r":"그 세그먼트 읽기(히라가나)"}],"kanjiNotes":[{"word":"...","reading":"...","meaningKR":"..."}],"grammarNotes":[{"point":"...","meaningShort":"...","meaningKR":"..."}]}\n\n' +
"furigana: sentenceJP를 처음부터 끝까지 빠짐없이 순서대로 잘라 배열로 나열하세요 — 모든 원소의 t를 순서대로 이어붙이면 sentenceJP와 완전히 동일해야 합니다(한 글자도 빠지거나 겹치면 안 됨, 공백도 그대로 포함). " +
"한자가 하나라도 포함된 연속 구간은 하나의 세그먼트로 묶고 그 부분 전체의 읽기를 r에 히라가나로 넣으세요. " +
"가나·구두점·숫자·알파벳만 있는 구간은 한자와 같은 세그먼트로 섞지 말고 별도 세그먼트로 분리하고, 그 경우 r은 빈 문자열로 두세요.\n\n" +
"kanjiNotes: 문장 속 핵심 단어 2~4개(word·reading·meaningKR). 「" + kanji + "」가 들어간 단어를 반드시 하나 넣으세요.\n\n" +

"grammarNotes: 이 문장에 쓰인 문법·표현 1~3개. 기초 조사나 너무 뻔한 건 빼고, 중급 이상 학습자가 헷갈릴 만한 것 위주. " +
"이 노트를 보는 사람은 '수동형·사역형·사전형·て형' 같은 일본어 문법 용어를 전혀 모릅니다 — 用語(용어) 이름은 어떤 필드에서도 절대 쓰지 마세요. " +
"각 노트는 point · meaningShort · meaningKR 세 필드를 모두 채웁니다(빈 문자열 금지).\n\n" +

"[point 필드 규칙]\n" +
"1) 한자가 하나라도 들어간 문형이면, 그 한자 바로 뒤 괄호에 히라가나 읽기를 반드시 붙입니다. 한 point 안의 모든 한자에 빠짐없이. 예: 〜に値(あたい)する, 〜を踏(ふ)まえて.\n" +
"2) 문장에서 단어의 활용형이 바뀐 경우에는 '원형 → 문장 속 모양' 화살표로 보여주고, 뒤에 붙은 조사·표현이 있으면 이어붙입니다. 읽기 괄호는 화살표 양쪽 모두에 붙입니다. 예: 怖(おそ)れる → 怖(おそ)れられて.\n" +
"3) 활용 변화가 아니라 고정된 문형·관용 표현이면 화살표 없이 그 표현만 적되, 읽기 괄호는 똑같이 붙입니다. 예: 〜に値(あたい)する.\n\n" +

"[meaningShort 필드 규칙]\n" +
"한국어로 옮긴 짧고 직관적인 뜻 한 구절. 마침표로 끝내지 않습니다. 예: ~할 만한 가치가 있다\n\n" +

"[meaningKR 필드 규칙]\n" +
"언제·어떤 뉘앙스로 쓰는지 용어 없이 쉬운 말로 설명하는 한 줄. meaningShort 를 여기에 다시 적지 마세요(' — ' 로 이어 붙이지도 않음). " +
"활용형이 바뀐 경우면 왜 그 모양이 됐는지도 여기에 넣습니다(예: 누군가에게 그런 취급을 당했다는 뜻이 됨).\n\n" +

"[좋은 예]\n" +
'{"point":"〜に値(あたい)する","meaningShort":"~할 만한 가치가 있다","meaningKR":"어떤 행동이나 평가를 받을 자격이 충분함을 나타낸다."}\n' +
'{"point":"怖(おそ)れる → 怖(おそ)れられて","meaningShort":"~당할까 봐 두렵다","meaningKR":"남이 나에게 그런 행동을 하는 것을 걱정한다는 뜻이 됨."}\n' +
'{"point":"〜を踏(ふ)まえて","meaningShort":"~을 바탕으로 하여","meaningKR":"앞의 사실이나 상황을 근거로 삼아 다음 판단·행동을 한다."}\n\n' +

"[나쁜 예 — 읽기 괄호도 없고 meaningShort 는 비었고 meaningKR 에 짧은 뜻을 ' — ' 로 이어 붙여서 안 됨]\n" +
'{"point":"〜に値する","meaningShort":"","meaningKR":"~할 만한 가치가 있다 — 어떤 행동이나 평가를 할 만한 가치가 있음을 나타낸다."}\n\n' +

"별도 표시(*, ** 등)는 붙이지 마세요."
  );
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

// ---------- day(): 클라우드 전용 읽기 경로 ----------
// day() 는 더 이상 폰에서 직접 예문을 만들지 않는다(OpenRouter 호출 금지). 새벽에 클라우드
// (scripts/generate-day.mjs)가 미리 만들어 올려둔 n1-today.json / n1-state.json 을 그대로
// 읽어와 알림만 예약한다. GET 한 번으로 두 파일을 같이 가져온다(cloud() 의 조회 로직과 동일 패턴).
// 반환: { date, slots:[{key,title,body}], stateRaw } 또는 { err: "설명" }.
async function fetchCloudBundle(cfg){
  if(!cfg || !cfg.GIST_ID) return { err: "GIST_ID 미설정" };
  try {
    var req = new Request("https://api.github.com/gists/" + cfg.GIST_ID);
    req.method = "GET";
    var headers = { "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Cache-Control": "no-cache" };
    if(cfg.GIST_TOKEN) headers["Authorization"] = "Bearer " + cfg.GIST_TOKEN;
    req.headers = headers;
    var meta = await req.loadJSON();
    var status = (req.response && req.response.statusCode) || 0;
    if(status === 401) return { err: "인증 실패(401) — GIST_TOKEN 만료/오류" };
    if(status === 403) return { err: "요청 거부(403) — 레이트리밋/권한 부족" };
    if(status === 404) return { err: "Gist 를 찾을 수 없음(404) — GIST_ID 확인" };
    if(meta && meta.message && !meta.files) return { err: "GitHub 오류: " + meta.message };

    var file = meta && meta.files && meta.files["n1-today.json"];
    if(!file) return { err: "n1-today.json 없음 — 클라우드가 아직 안 돌았을 수 있음" };
    var raw = (file.truncated && file.raw_url) ? await new Request(file.raw_url).loadString() : file.content;
    if(raw == null || String(raw).trim() === "") return { err: "n1-today.json 비어 있음" };
    var data;
    try { data = JSON.parse(raw); }
    catch(pe){ return { err: "n1-today.json 파싱 실패: " + String(pe && pe.message ? pe.message : pe) }; }

    var stateRaw = null;
    var sfile = meta && meta.files && meta.files["n1-state.json"];
    if(sfile){
      stateRaw = (sfile.truncated && sfile.raw_url) ? await new Request(sfile.raw_url).loadString() : sfile.content;
    }
    return { date: data.date || null, slots: Array.isArray(data.slots) ? data.slots : [], stateRaw: stateRaw };
  } catch(e){
    return { err: "네트워크/조회 실패: " + String(e && e.message ? e.message : e) };
  }
}

// 원격 n1-state.json(클라우드가 만든 진도·이력)을 로컬 상태 s 에 그대로 반영한다.
// 클라우드가 이제 진도의 유일한 생성 주체이므로 kanjiList/progressIndex/cycle/history/
// pending 은 원격이 정답 — 통째로 갈아끼운다. 단, "외웠음"(reviewed)은 로컬(기기)에서만
// 매길 수 있는 값이라 원격에는 없다 — id 기준으로 로컬에 표시돼 있던 reviewed 를 새
// history 로 이식해서 유실을 막는다. 성공하면 true, 원격 상태가 없거나 손상됐으면
// 아무것도 바꾸지 않고 false.
function adoptRemoteState(s, remoteStateRaw){
  if(remoteStateRaw == null || String(remoteStateRaw).trim() === "") return false;
  var rs;
  try { rs = JSON.parse(remoteStateRaw); }
  catch(e){ return false; }
  if(!rs || !Array.isArray(rs.kanjiList) || !rs.kanjiList.length) return false;
  if(!Array.isArray(rs.history)) rs.history = [];

  var localReviewed = {};
  if(Array.isArray(s.history)){
    for(var i = 0; i < s.history.length; i++){
      var e = s.history[i];
      if(e && e.id && e.reviewed) localReviewed[e.id] = true;
    }
  }
  for(var j = 0; j < rs.history.length; j++){
    var re = rs.history[j];
    if(re && re.id && localReviewed[re.id]) re.reviewed = true;
  }

  s.kanjiList = rs.kanjiList;
  if(typeof rs.progressIndex === "number") s.progressIndex = rs.progressIndex;
  if(typeof rs.cycle === "number") s.cycle = rs.cycle;
  if(typeof rs.runCounter === "number") s.runCounter = rs.runCounter;
  s.history = rs.history;
  s.pending = Array.isArray(rs.pending) ? rs.pending : [];
  s.lastCurrentId = rs.history[0] ? rs.history[0].id : s.lastCurrentId;
  return true;
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
// key/title/body/mode/grammarTitle/grammarBody/id/원본 상세 필드까지 남겨 정규화 —
// n1-today.json 이 그날의 완결된 스냅샷이 되도록(윈도우 알림 등 title/body 요약만으로는
// 부족한 소비자, 그리고 문법 알림을 바로 띄우려는 소비자를 위해).
// (중복 제거는 하지 않음 — mergeSlots/upsertSlot 이 담당)
function sortSlots(arr){
  var a = (Array.isArray(arr) ? arr : []).filter(function(x){ return x && x.key; })
    .map(function(x){
      return {
        key: x.key, title: x.title || "", body: x.body || "", mode: x.mode || "",
        grammarTitle: x.grammarTitle || null, grammarBody: x.grammarBody || null,
        id: x.id || null, targetKanji: x.targetKanji || "",
        sentenceJP: x.sentenceJP || "", readingHiragana: x.readingHiragana || "", translationKR: x.translationKR || "",
        kanjiNotes: Array.isArray(x.kanjiNotes) ? x.kanjiNotes : [],
        grammarNotes: Array.isArray(x.grammarNotes) ? x.grammarNotes : []
      };
    });
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
// cfg.REPS_PER_KANJI(기본 2)에 달림: 이 값만큼 같은 한자로 반복 생성한 뒤에야
// progressIndex가 전진함(REPS_PER_KANJI=2이면 한 한자당 예문 2개 만들고서야 다음 한자로).
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

  var reps = (cfg.REPS_PER_KANJI != null) ? cfg.REPS_PER_KANJI : 2;   // 기본값: 한자당 예문 2개
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
// 단어 알림 본문 — 문장 통째로 넣으면 알림 배너에서 길이 제한으로 잘려서 그걸로는 학습이
// 안 된다는 피드백으로, 워치 알림과 동일하게 "단어 / 후리가나 / 한글번역" 3줄로 줄임.
// 문법은 여기 붙이지 않고 pushGrammarTitle()/pushGrammarBody() 로 별도 알림을 띄운다 —
// 단어 알림과 문법 알림이 각각 3줄 구조로 통일됨.
// 알림을 탭하면(openURL, notify() 호출부에서 reviewURL(cfg) 넘김) n1-review 가 열리고,
// review() 는 시작하자마자 current() 항목 전체를 모달로 띄우므로 탭 한 번으로 문장·문법
// 노트까지 다 볼 수 있음.
function pushBody(cur){
  var hw = pickHeadword(cur);
  return hw ? (hw.word + "\n" + hw.reading + "\n" + hw.meaningKR)
            : (cur.sentenceJP + "\n" + cur.readingHiragana + "\n" + cur.translationKR);   // 옛 항목 폴백
}
// 문법 알림 제목 — pushTitle() 과 같은 틀이되 접두사만 "[문법]"(단어 알림의 [신규]/[복습]
// 과 구분). 신규/복습 구분은 문법 알림엔 의미 없어 mode 인자 없음.
function pushGrammarTitle(cur, s){
  return "[문법] " + cur.targetKanji + "   " + s.progressIndex + " / " + s.kanjiList.length;
}
// 문법 알림 본문 — 첫 번째 grammarNote 만: point / meaningShort / meaningKR 3줄.
// meaningShort 가 없는 옛 항목이면 point / meaningKR 2줄로 폴백.
// grammarNotes 가 없거나 첫 항목에 point 가 없으면 null 을 반환 — 호출부가 "이 항목은
// 문법 알림을 만들 수 없다"를 판단할 수 있게.
function pushGrammarBody(cur){
  var gn = (cur && Array.isArray(cur.grammarNotes)) ? cur.grammarNotes : [];
  var g = gn[0];
  if(!g || !g.point) return null;
  var lines = [g.point];
  if(g.meaningShort) lines.push(g.meaningShort);
  if(g.meaningKR) lines.push(g.meaningKR);
  return lines.join("\n");
}
// 알림을 탭했을 때 n1-review를 열게 하는 URL. 스크립트 이름이 기본값("n1-review")과
// 다르면 cfg.REVIEW_SCRIPT_NAME으로 맞춰 쓸 수 있음.
function reviewURL(cfg){
  return "scriptable:///run/" + encodeURIComponent((cfg && cfg.REVIEW_SCRIPT_NAME) || "n1-review");
}

// 신규 도입을 끊을 날짜 — 지금 페이스로 커리큘럼(706자) 한 바퀴가 대략 끝나는 시점.
// 페이스 산출:
//   · 신규는 평일이면서 일본 공휴일이 아닌 날만(주말·공휴일은 generate-day.mjs 가
//     cfg.PAUSE_NEW 로 전량 복습),
//   · 하루 신규 29칸, 한자당 REPS_PER_KANJI(기본 2)회독 → 하루 29/2 ≈ 14~15자 전진.
// ⚠️ 공휴일 스킵 반영 후 재계산 (2026-09-02 기준 Gist 상태 progressIndex 47 · kanjiRepCount 1):
//   남은 reps (706−47)×2−1 = 1317 → 필요 생성일 ceil(1317/29) = 46.
//   2026-09-03 ~ 2026-11-12(컷오프 당일 신규 OFF) 사이 평일−공휴일 = 45 (평일 공휴일 5일
//   제외: 09-21·09-22·09-23·10-12·11-03). 45 < 46 → 하루(약 12 reps) 부족.
//   → 권장: 이 기본값을 "2026-11-17" 로 이동 (여유 1일 + API 실패 대비). 최소치 2026-11-13.
//   사용자 확인 전까지는 2026-11-12 유지 (README 페이스 섹션 참고).
// 그 날짜부터는 신규 생성 없이 순수 복습만(시험 전 마지막 몇 주는 새 걸 우겨넣기보다
// 복습이 기억에 더 유리하다는 스페이싱 효과 근거). cfg.NEW_CUTOFF_DATE로 덮어쓸 수 있고,
// 아예 신규를 안 끊고 싶으면 cfg.NEW_CUTOFF_DATE: null 로 넣으면 됨(무기한 계속 신규 생성).
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
  var every = (cfg.NEW_EVERY_MIN != null) ? cfg.NEW_EVERY_MIN : 30;   // 30분마다 = 하루 신규 29칸(REPS_PER_KANJI=2와 맞춰 평일 하루 약 14~15자 전진)
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
    // generate() 는 폰에서 더 이상 OpenRouter 를 호출하지 않는다 — 신규 예문은 새벽에
    // 클라우드(scripts/generate-day.mjs)만 만든다. 여기서는 기존 이력 중에서 가중 랜덤
    // 복습 1건을 보여주는 것만 한다(advanceOne/composeNewEntry 는 클라우드 전용으로 남김).
    if(!s.history.length){
      await reportRun("N1 생성 실패", [
        "로컬에 학습 이력이 없습니다.",
        "n1-cloud 를 먼저 실행해 클라우드 데이터를 받아오세요.",
        "(이 스크립트는 더 이상 직접 예문을 생성하지 않습니다)"
      ], true);
      return;
    }
    var picked = pickTapReview(s, current(s));
    if(!picked){
      await reportRun("N1 생성 — 표시할 것 없음", [
        "복습으로 보여줄 이력이 없습니다.",
        "n1-day 를 실행해 오늘치를 먼저 예약하세요."
      ], false);
      return;
    }
    var r = { cur: picked, mode: "review" };
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
//   · 컷오프     — isPastNewCutoff(cfg) 또는 cfg.PAUSE_NEW 면 전량 복습(신규 0).
//                 PAUSE_NEW 는 "이번 실행에서는 신규 만들지 마라"는 범용 스위치 —
//                 요일 판정 같은 달력 정책은 호출부(generate-day.mjs)가 세팅한다.
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
  var pastCutoff = isPastNewCutoff(cfg) || !!cfg.PAUSE_NEW;

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
    var gBody = pushGrammarBody(cur);
    plan.push({
      key: slot.key, slotDate: slotDate, slotISO: slotISO,
      title: pushTitle(mode, cur, s), body: pushBody(cur), mode: mode,
      // 단어 알림과 별개로 띄우는 문법 알림의 제목/본문(3줄). 문법 노트가 없으면 둘 다 null —
      // 윈도우·폰이 조립 로직을 중복 구현하지 않도록 n1-today.json 슬롯에 그대로 실어둔다.
      grammarTitle: gBody ? pushGrammarTitle(cur, s) : null,
      grammarBody: gBody,
      // 알림용 title/body 는 요약(단어 1개)이라 윈도우 알림처럼 문장/문법까지 다 보여줘야
      // 하는 소비자를 위해 원본 필드도 그대로 실어둔다 — n1-today.json 이 그날의 완결된
      // 스냅샷이 되도록. id 는 history 매칭(리뷰 상세, pending 등)에 계속 쓰인다.
      id: cur.id, targetKanji: cur.targetKanji,
      sentenceJP: cur.sentenceJP, readingHiragana: cur.readingHiragana, translationKR: cur.translationKR,
      kanjiNotes: Array.isArray(cur.kanjiNotes) ? cur.kanjiNotes : [],
      grammarNotes: Array.isArray(cur.grammarNotes) ? cur.grammarNotes : []
    });
  }
  return { todo: todo, plan: plan, pending: pending, newCount: newCount, reviewCount: plan.length - newCount };
}

// ---------- day: 하루치 슬롯을 일괄 예약 (클라우드 전용, OpenRouter 호출 없음) ----------
// 기본: 09:00~23:00, 15분 간격(57칸). 이 함수는 더 이상 스스로 예문을 만들지 않는다 —
// 새벽에 GitHub Actions(scripts/generate-day.mjs)가 미리 만들어 올린 n1-today.json /
// n1-state.json 을 Gist 에서 읽어와 그대로 iOS 로컬 알림으로 예약만 한다.
// GIST_ID/GIST_TOKEN 이 없거나, 오늘치 클라우드 데이터가 아직 없으면(새벽 배치가 아직
// 안 돌았거나 네트워크 문제) 조용히 넘어가지 않고 명확히 실패를 알린다 — 절대로 로컬에서
// 대신 생성하지 않는다(그게 이 함수의 존재 이유).
// ※ iOS는 앱당 예약 가능한 로컬 알림이 최대 64개라 기본값이 57개(여유 7개)로 잡혀 있음.
async function day(cfg){
  var cloudOn = !!(cfg && cfg.GIST_ID && cfg.GIST_TOKEN);
  console.log("[n1] day() 시작 · cloud=" + (cloudOn ? "on" : "off"));
  if(!cloudOn){
    await reportRun("N1 갱신 실패", [
      "클라우드(GIST_ID/GIST_TOKEN)가 설정돼 있지 않습니다.",
      "n1-day 는 클라우드 데이터만 읽습니다 — n1-config 에서 먼저 설정하세요."
    ], true);
    return;
  }
  try {
    var s = await readState();
    if(!s || !Array.isArray(s.kanjiList) || !s.kanjiList.length){
      console.log("[n1] day() 중단 · 상태 파일 없음/손상");
      await reportRun("N1 갱신 실패", [
        "로컬 상태 파일이 없습니다.",
        "n1-cloud 를 한 번 실행해 클라우드 데이터를 먼저 받으세요."
      ], true);
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
    var dk = Object.keys(s.builtSlots);
    for(var di = 0; di < dk.length; di++){ if(dk[di] !== today) delete s.builtSlots[dk[di]]; }
    if(!Array.isArray(s.builtSlots[today])) s.builtSlots[today] = [];
    var already = s.builtSlots[today];

    // 오늘 그리드(09:00~23:00, 15분 간격) 중 아직 처리 안 한 시각만 — planDay() 와 동일한
    // 규칙이지만 신규/복습 판정은 필요 없다(클라우드가 이미 정해서 title/body 로 보냄).
    var STEP = cfg.INTERVAL_MIN || 15;
    var startH = (cfg.START_HOUR != null) ? cfg.START_HOUR : 9;
    var endH = (cfg.END_HOUR != null) ? cfg.END_HOUR : 23;
    var todo = [];
    for(var mnt = startH * 60; mnt <= endH * 60; mnt += STEP){
      var hh = Math.floor(mnt / 60), mm = mnt % 60;
      var key = pad2(hh) + ":" + pad2(mm);
      if(already.indexOf(key) === -1) todo.push({ h: hh, min: mm, key: key });
    }
    console.log("[n1] day() · 이번 구간 처리 대상 " + todo.length + "칸");
    if(!todo.length){
      console.log("[n1] day() 종료 · 예약할 슬롯 없음(이미 오늘치 완료)");
      await reportRun("N1 갱신 — 예약할 것 없음", [
        "이미 오늘 예약 완료 — 신규 0칸",
        "오늘 전체 슬롯 " + already.length + "칸 (" + today + ")"
      ], false);
      return;
    }

    var bundle = await fetchCloudBundle(cfg);
    if(bundle.err){
      console.log("[n1] day() 중단 · 클라우드 조회 실패: " + bundle.err);
      await reportRun("N1 갱신 실패 — 클라우드 조회 실패", [
        bundle.err,
        "잠시 후 다시 시도하세요. (로컬 생성으로 대체하지 않습니다)"
      ], true);
      return;
    }
    if(bundle.date !== today || !bundle.slots.length){
      console.log("[n1] day() 중단 · 클라우드에 오늘(" + today + ") 데이터 없음(원격 date=" + bundle.date + ")");
      await reportRun("N1 갱신 실패 — 오늘치 클라우드 데이터 없음", [
        "Gist 의 n1-today.json 이 아직 오늘(" + today + ") 자로 갱신되지 않았습니다.",
        "GitHub Actions(generate-day)가 새벽에 실행됐는지 확인 후 다시 시도하세요."
      ], true);
      return;
    }

    var slotMap = {};
    for(var bi = 0; bi < bundle.slots.length; bi++){
      var bs = bundle.slots[bi];
      if(bs && bs.key) slotMap[bs.key] = bs;
    }
    var missing = [];
    for(var ti = 0; ti < todo.length; ti++){ if(!slotMap[todo[ti].key]) missing.push(todo[ti].key); }
    if(missing.length){
      console.log("[n1] day() 중단 · 클라우드 데이터가 일부 시각을 안 채움: " + missing.join(","));
      await reportRun("N1 갱신 실패 — 클라우드 데이터 불완전", [
        "다음 시각이 클라우드에 없습니다: " + missing.join(", "),
        "클라우드 생성이 덜 끝났을 수 있습니다 — 잠시 후 다시 시도하세요."
      ], true);
      return;
    }

    // 진도(kanjiList/progressIndex/history/pending)를 원격으로 통째로 갈아끼움 — 클라우드가
    // 유일한 생성 주체이므로 여기가 정답. 로컬 "외웠음" 표시는 id 기준으로 이식되어 보존됨.
    var adopted = adoptRemoteState(s, bundle.stateRaw);
    if(!adopted){
      console.log("[n1] day() 중단 · 원격 n1-state.json 없음/손상");
      await reportRun("N1 갱신 실패 — 클라우드 진도 정보 없음", [
        "n1-state.json 을 읽지 못했습니다.",
        "GitHub Actions 실행 로그를 확인하세요."
      ], true);
      return;
    }

    // 그날 전체 그리드(startH~endH, STEP 간격) 기준의 "고정" 인덱스로 종류를 교대한다 —
    // 짝수 인덱스 칸은 단어 알림, 홀수 인덱스 칸은 문법 알림. todo 배열 순서가 아니라 슬롯
    // 시각으로부터 결정적으로 계산하므로, day() 가 하루에 여러 구간으로 나눠 실행돼도 같은
    // 시각은 항상 같은 종류가 된다.
    // 폴백: 문법 차례인데 그 슬롯에 문법 노트가 없으면(grammarTitle/grammarBody 가 null)
    // 단어 알림으로 대체한다 — 칸을 비우지 않는다. 시각당 알림은 여전히 1개(총 57개).
    var plan = [];
    for(var pi = 0; pi < todo.length; pi++){
      var t = todo[pi];
      var found = slotMap[t.key];
      var slotDate = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), t.h, t.min, 0, 0);
      var gridIdx = Math.round((t.h * 60 + t.min - startH * 60) / STEP);
      var wantGrammar = (gridIdx % 2) === 1;
      var hasGrammar = !!(found.grammarTitle && found.grammarBody);
      var kind, nTitle, nBody, fallback = false;
      if(wantGrammar && hasGrammar){
        kind = "grammar"; nTitle = found.grammarTitle; nBody = found.grammarBody;
      } else {
        kind = "word"; nTitle = found.title || ""; nBody = found.body || "";
        if(wantGrammar) fallback = true;   // 문법 차례였지만 노트가 없어 단어로 대체
      }
      plan.push({ key: t.key, slotDate: slotDate, title: nTitle, body: nBody, kind: kind, fallback: fallback });
    }

    // 알림 예약 + 저장. SKIP_PUSH: true 면 진도/이력 갱신은 평소처럼 하되 실제 알림만 안 쏨.
    // identifier 는 시각당 1개뿐이라(종류가 달라도 중복 예약 없음) 기존 형식 그대로 유지.
    var newCount = 0, reviewCount = 0, wordCount = 0, grammarCount = 0, fallbackCount = 0;
    for(var j = 0; j < plan.length; j++){
      var p = plan[j];
      if(p.kind === "grammar"){
        grammarCount++;
      } else {
        wordCount++;
        if(p.fallback) fallbackCount++;
        if(p.title.indexOf("[신규]") === 0) newCount++;
        else if(p.title.indexOf("[복습]") === 0) reviewCount++;
      }
      if(!cfg.SKIP_PUSH && p.slotDate.getTime() > Date.now() + 5000){
        await notify("n1-slot-" + today + "-" + p.key.replace(":", ""), p.title, p.body, p.slotDate, reviewURL(cfg));
      }
      already.push(p.key);
    }
    reconcile(s);   // pending 중 이미 지난 시각이 있으면(과거로 예약된 경우 등) 바로 반영
    if(!s.cloudSlots || typeof s.cloudSlots !== "object") s.cloudSlots = {};
    s.cloudSlots[today] = bundle.slots.slice();
    s.updatedAt = nowISO();
    writeState(s);
    console.log("[n1] day() · 클라우드 데이터로 " + plan.length + "칸 예약 완료(" + todo[0].key + "~" + todo[todo.length - 1].key + ") · OpenRouter 호출 0회");

    await reportRun("N1 갱신 완료(클라우드)", [
      "이번 실행: " + plan.length + "칸 예약 — 단어 " + wordCount + " · 문법 " + grammarCount + " · 문법→단어 폴백 " + fallbackCount,
      "단어 중 신규 " + newCount + " · 복습 " + reviewCount,
      "구간 " + todo[0].key + "~" + todo[todo.length - 1].key + " · 진도 " + s.progressIndex + " / " + s.kanjiList.length,
      "오늘 전체 슬롯 " + already.length + "칸 (" + today + ")"
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
      var parts = [g.point];
      if(g.meaningShort) parts.push(g.meaningShort);
      if(g.meaningKR) parts.push(g.meaningKR);
      return "· " + parts.join("\n  ");
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
        var lg = w.addText("文  " + g.point + "  " + (g.meaningShort || g.meaningKR));
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
    a0.title = "이력 없음"; a0.message = "먼저 n1-cloud 를 한 번 실행해 클라우드 데이터를 받으세요."; a0.addAction("확인");
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
    if(toggled){
      // "외웠음" 토글은 로컬에서만 일어나는 변경이라, updatedAt 을 여기서 직접 갱신해야
      // n1-cloud(저녁 동기화)가 "로컬이 더 최신"으로 판단해 클라우드로 올려준다 — 이걸
      // 안 하면 토글 자체는 저장되지만 클라우드에 영영 반영이 안 된다.
      s.updatedAt = nowISO();
      writeState(s);
      draw();
      table.reload();
    }
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
      await notify("n1-watch-err", "워치 단어 알림 예약 실패", "먼저 n1-cloud 를 한 번 실행해 클라우드 데이터를 받으세요.");
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

// ---------- cloud: 로컬 상태(주로 "외웠음" 표시)를 클라우드로 올림 ----------
// 예전 cloud() 는 "폰이 오늘치 슬롯의 원본"이라는 전제로 로컬 history 에서 슬롯을
// 재구성해 클라우드와 병합했다. 지금은 그 전제가 깨졌다 — 슬롯은 새벽에 클라우드
// (scripts/generate-day.mjs) 혼자 만들고, day() 는 그걸 읽기만 한다. 그런데 그 재구성
// (restoreTodaySlots)이 "지금" 진도 번호로 제목을 다시 만들다 보니, 하루 동안 진도가
// 오르며 제목이 조금씩 달라졌던 진짜 슬롯들과 달라 보여서 같은 시각인데 "다른 슬롯"으로
// 계속 중복 누적되는 버그가 있었다(57칸이 110칸까지 불어남). 그 재구성/병합/업로드를
// 통째로 없앴다 — 이제 슬롯은 클라우드→폰 단방향(day() 담당)이고, cloud() 는 반대
// 방향(폰→클라우드)만 맡는다: 로컬에서만 바뀌는 값(review 의 "외웠음" 표시 등)이 담긴
// n1-state.json 을 필요할 때만 올린다. planStateUpload() 의 "로컬이 원격보다 최신일
// 때만 업로드"(안 그러면 클라우드가 그날 밤 만든 새 진도를 되돌려 씀) 규칙은 그대로.
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
  var s = null;
  try { s = await readState(); }
  catch(e){ return show("로컬 상태 조회 실패", "state 파일을 읽지 못했습니다: " + String(e && e.message ? e.message : e)); }
  if(!s || !Array.isArray(s.kanjiList)){
    return show("로컬 상태 없음", "로컬 state 파일이 없거나 손상됐습니다 — 먼저 n1-day 를 한 번 실행하세요.");
  }
  var localStateUpdatedAt = s.updatedAt;   // planStateUpload 가 s.updatedAt 을 안 건드리지만, 의도 명시.

  var bundle = await fetchCloudBundle(cfg);
  if(bundle.err){
    return show("클라우드 조회 실패", bundle.err + "\n\n데이터 유실 방지를 위해 업로드하지 않았습니다.");
  }

  var statePlan;
  try {
    statePlan = planStateUpload(s, localStateUpdatedAt, bundle.stateRaw);
  } catch(e){
    statePlan = { upload: false, json: null,
      line: "상태: 업로드 실패 — 판단 중 오류: " + String(e && e.message ? e.message : e) };
  }

  var uploaded = false, uploadErr = null;
  if(statePlan.upload){
    try {
      var res = await pushCloudState(cfg, statePlan.json);
      if(res && res.ok) uploaded = true; else uploadErr = (res && res.reason) || "알 수 없음";
    } catch(e){ uploadErr = String(e && e.message ? e.message : e); }
  }
  var stateLine = statePlan.upload
    ? (uploaded ? statePlan.line : ("상태: 업로드 실패 — " + (uploadErr || "알 수 없음")))
    : statePlan.line;
  console.log("[n1] cloud() · " + stateLine);

  var todayCount = (bundle.date === today) ? bundle.slots.length : 0;
  var slotLine = (bundle.date === today)
    ? ("클라우드 오늘(" + today + ") 슬롯: " + todayCount + "칸")
    : ("클라우드에 오늘(" + today + ") 자 슬롯이 아직 없음(원격 날짜: " + (bundle.date || "없음") + ")");

  var header = stateLine + "\n" + slotLine;
  await show(statePlan.upload ? "클라우드 동기화" : "클라우드 상태 확인", header);
}

module.exports = {
  // 폰(Scriptable 껍데기)이 Script.name() 으로 호출하는 액션들 — 기존 그대로.
  generate: generate, day: day, widget: widget, review: review, watchDay: watchDay, cloud: cloud,
  VERSION: "2026-09-01j",
  // ↓ 클라우드 생성기(scripts/generate-day.mjs)가 재사용하는 순수 로직. 폰에서는 안 쓰이며
  //   추가돼도 껍데기 동작(module.exports[ACTION])에는 영향 없음.
  SEED: SEED,
  planDay: planDay,
  composeNewEntry: composeNewEntry,
  commitNewEntry: commitNewEntry,
  compose: compose,
  buildComposePrompt: buildComposePrompt,
  reconcile: reconcile,
  pickWeightedReview: pickWeightedReview,
  pushTitle: pushTitle,
  pushBody: pushBody,
  pushGrammarTitle: pushGrammarTitle,
  pushGrammarBody: pushGrammarBody,
  pickHeadword: pickHeadword,
  sortSlots: sortSlots,
  slotSig: slotSig,
  isPastNewCutoff: isPastNewCutoff,
  dateJST: dateJST,
  nowISO: nowISO,
  pad2: pad2
};
