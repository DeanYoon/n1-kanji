#!/usr/bin/env node
// ===== N1 단어 학습 데이터 · 1회성 생성기 =====
// 기존의 "706자 한자 커리큘럼 + 매일 클라우드가 조금씩 새 예문 생성" 구조를 버리고,
// jlpt-word-list 의 N1 단어(2698개) 전체에 대해 예문까지 한 번에 다 만들어서 고정 파일로
// 저장한다. 이후로는 매일 도는 배치가 필요 없다 — 이 스크립트를 한 번만 실행하면 끝.
//
// 결과 필드(요청받은 것만 — 그 외 필드 없음):
//   word          단어 원문(일본어)
//   reading       단어 읽기(히라가나) — jlpt-word-list CSV 값 그대로 사용(AI로 재생성 안 함)
//   meaningKR     단어 뜻(한국어) — meaning(영어)을 AI가 번역
//   sentenceJP    그 단어를 사용한 예문(일본어)
//   sentenceReading  예문 전체 읽기(히라가나)
//   sentenceKR    예문 한국어 번역
//
// 하는 일:
//   1) https://raw.githubusercontent.com/elzup/jlpt-word-list/master/src/n1.csv 다운로드
//   2) 단어를 CHUNK_SIZE(기본 15)개씩 묶어 OpenRouter에 "뜻 번역 + 예문 생성"을 한 번에 요청
//   3) 실패한 청크는 최대 3회 재시도, 그래도 실패하면 그 단어들은 sentence 관련 필드를
//      null로 남기고 failedWords 목록에 기록 — 스크립트 전체를 죽이지 않고 계속 진행
//   4) data/n1-words.json 에 최종 결과 저장 (배열 + 메타데이터)
//
// 환경변수:
//   OPENROUTER_KEY   (필수)
//   MODEL            기본 openai/gpt-5.6-sol
//   CHUNK_SIZE       기본 15 (한 번의 OpenRouter 호출에 담을 단어 수)
//   LIMIT            테스트용 — 앞에서부터 N개만 처리(전체 2698개 다 안 돌리고 싶을 때)

const SOURCE_CSV_URL = "https://raw.githubusercontent.com/elzup/jlpt-word-list/master/src/n1.csv";
const MODEL = process.env.MODEL || "openai/gpt-5.6-sol";
const OPENROUTER_KEY = process.env.OPENROUTER_KEY || "";
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || "15", 10);
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : 0;

const fs = await import("node:fs/promises");
const path = await import("node:path");
const { fileURLToPath } = await import("node:url");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const OUT_JSON_PATH = path.join(REPO_ROOT, "data", "n1-words.json");

function die(msg) {
  console.error("✗ " + msg);
  process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 1) CSV 파싱 ----------
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else field += c;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function fetchWordList() {
  const res = await fetch(SOURCE_CSV_URL);
  if (!res.ok) die(`CSV 다운로드 실패 HTTP ${res.status}`);
  const text = await res.text();
  const rows = parseCSV(text);
  const header = rows[0];
  const idx = {
    expression: header.indexOf("expression"),
    reading: header.indexOf("reading"),
    meaning: header.indexOf("meaning"),
  };
  if (idx.expression < 0 || idx.reading < 0 || idx.meaning < 0) {
    die("CSV 헤더가 예상과 다름: " + header.join(","));
  }
  const words = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[idx.expression]) continue;
    words.push({
      word: r[idx.expression].trim(),
      reading: (r[idx.reading] || "").trim(),
      meaningEN: (r[idx.meaning] || "").trim(),
    });
  }
  return LIMIT > 0 ? words.slice(0, LIMIT) : words;
}

// ---------- 2) 청크 단위로 "뜻 번역 + 예문 생성" 동시 요청 ----------
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function processChunk(items) {
  const numbered = items
    .map((w, i) => `${i}. ${w.word}（${w.reading}）: ${w.meaningEN}`)
    .join("\n");
  const prompt =
    "다음은 JLPT N1 일본어 단어 목록입니다(번호. 단어（읽기）: 영어 뜻). 각 단어마다:\n" +
    "1) meaningKR: 영어 뜻을 자연스러운 한국어 단어/짧은 구로 번역\n" +
    "2) sentenceJP: 그 단어를 실제로 사용한 자연스럽고 짧은(약 10~25자) 일본어 예문 1개\n" +
    "3) sentenceReading: 그 예문 전체를 히라가나로 (한자 없이 처음부터 끝까지)\n" +
    "4) sentenceKR: 그 예문의 자연스러운 한국어 번역\n\n" +
    "번호와 순서를 정확히 유지하고, 반드시 아래 JSON 형식 하나만 출력하세요. 코드블록·설명 금지:\n" +
    '{"items":[{"meaningKR":"...","sentenceJP":"...","sentenceReading":"...","sentenceKR":"..."}, ...]}\n\n' +
    "목록:\n" + numbered;

  // 단어당 출력 ~200토큰 + JSON 문법 오버헤드를 감안해 청크 크기에 비례해서 늘림 —
  // 고정값이면 CHUNK_SIZE를 키울 때(예: 30개) 한도에 걸려 응답이 잘리는 문제가 생김.
  const maxTokens = Math.min(16000, Math.max(3000, items.length * 350));
  const body = {
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: maxTokens,
  };
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + OPENROUTER_KEY,
      "Content-Type": "application/json",
      "X-Title": "N1 Kanji · build word list",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); }
  catch (e) { throw new Error("OpenRouter 응답이 JSON 아님(HTTP " + res.status + "): " + text.slice(0, 200)); }
  if (json.error) throw new Error("OpenRouter 오류: " + JSON.stringify(json.error).slice(0, 200));
  const content = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
  if (!content) throw new Error("빈 응답");
  let parsed;
  try {
    const t = String(content).trim();
    const a = t.indexOf("{"), b = t.lastIndexOf("}");
    parsed = JSON.parse(a >= 0 && b > a ? t.slice(a, b + 1) : t);
  } catch (e) { throw new Error("응답 JSON 파싱 실패: " + String(content).slice(0, 200)); }
  if (!Array.isArray(parsed.items) || parsed.items.length !== items.length) {
    throw new Error(`결과 개수 불일치(요청 ${items.length} / 응답 ${parsed.items ? parsed.items.length : "?"})`);
  }
  return parsed.items;
}

async function buildAll(words) {
  const chunks = chunk(words, CHUNK_SIZE);
  const result = [];
  const failedWords = [];
  for (let ci = 0; ci < chunks.length; ci++) {
    const items = chunks[ci];
    let generated = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        generated = await processChunk(items);
        break;
      } catch (e) {
        console.warn(`  · 청크 ${ci + 1}/${chunks.length} 실패(시도 ${attempt}/3): ${e.message}`);
        if (attempt < 3) await sleep(1000 * 2 ** (attempt - 1));
      }
    }
    for (let i = 0; i < items.length; i++) {
      const g = generated ? generated[i] : null;
      if (!g) failedWords.push(items[i].word);
      result.push({
        word: items[i].word,
        reading: items[i].reading,
        meaningKR: g ? (g.meaningKR || items[i].meaningEN) : items[i].meaningEN,
        sentenceJP: g ? (g.sentenceJP || null) : null,
        sentenceReading: g ? (g.sentenceReading || null) : null,
        sentenceKR: g ? (g.sentenceKR || null) : null,
      });
    }
    console.log(`  · 진행 ${result.length}/${words.length} (실패 누적 ${failedWords.length})`);
  }
  return { result, failedWords };
}

// ---------- 메인 ----------
async function main() {
  if (!OPENROUTER_KEY) die("OPENROUTER_KEY 환경변수가 없습니다.");

  console.log("1) CSV 다운로드: " + SOURCE_CSV_URL);
  const words = await fetchWordList();
  console.log(`   ${words.length}개 단어 파싱됨` + (LIMIT > 0 ? ` (LIMIT=${LIMIT} 적용)` : ""));

  console.log(`2) 단어+예문 생성 시작 (청크 크기 ${CHUNK_SIZE}, 총 ${Math.ceil(words.length / CHUNK_SIZE)}청크)`);
  const { result, failedWords } = await buildAll(words);

  console.log("3) data/n1-words.json 저장");
  await fs.mkdir(path.dirname(OUT_JSON_PATH), { recursive: true });
  await fs.writeFile(
    OUT_JSON_PATH,
    JSON.stringify({ generatedAt: new Date().toISOString(), count: result.length, failedWords, words: result }, null, 2),
    "utf8"
  );

  console.log("");
  console.log("── 완료 ──────────────────────────────");
  console.log(`총 단어      ${result.length}개`);
  console.log(`생성 실패    ${failedWords.length}개` + (failedWords.length ? `: ${failedWords.slice(0, 20).join(", ")}${failedWords.length > 20 ? " ..." : ""}` : ""));
  console.log("data/n1-words.json 갱신됨 — 워크플로우가 커밋합니다.");
  console.log("──────────────────────────────────────");
}

main().catch((e) => die(e && e.stack ? e.stack : String(e)));
