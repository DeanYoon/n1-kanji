// ===== 번역 공용 로직 (translate-lib.mjs) =====
// translate-test.mjs (모델 bake-off) 와 translate-words.mjs (전량 번역) 가 함께 쓴다.
//
// 여기 모으는 것:
//   · n1-weak.json 로드 (공개 raw URL)
//   · kanjiapi.dev 로 일본어 단어의 영어 gloss 수집 + 표기/읽기 매칭
//   · 검증된 프롬프트 조립 (키 기반 JSON 출력)
//   · OpenRouter 1회 호출 (response_format json_object)
//   · 한국어 값 검증 규칙 (빈 값 · 영문 잔존 · 길이 초과)
//   · 폭 계산 pad / sleep

export const MAX_KR_LEN = 30;   // 이보다 길면 "설명문" 으로 보고 검증 실패 처리

export const DEFAULT_GIST_ID = "3c7a0d99f309aa0dfea3861a7df296d4";
export const DEFAULT_GIST_OWNER = "DeanYoon";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// gist raw URL (토큰 없이 읽기). name 미지정 시 n1-weak.json.
export function weakRawUrl(name = "n1-weak.json", owner = DEFAULT_GIST_OWNER, gistId = DEFAULT_GIST_ID) {
  return `https://gist.githubusercontent.com/${owner}/${gistId}/raw/${name}`;
}

// ---------- n1-weak.json 로드 ----------
export async function loadWeak(url = weakRawUrl()) {
  const res = await fetch(url, { headers: { "User-Agent": "n1-translate" } });
  if (!res.ok) throw new Error(`n1-weak.json GET HTTP ${res.status}`);
  const data = await res.json();
  const unknown = Array.isArray(data.unknown) ? data.unknown : [];
  if (!unknown.length) throw new Error("n1-weak.json 에 unknown 배열이 비어 있음");
  return { data, unknown };
}

// ---------- kanjiapi.dev 로 영어 gloss 수집 ----------
const kanjiWordsCache = new Map();

// 한 한자에 대한 kanjiapi words 응답. 실패 시 재시도(retries)회. 결과는 캐시.
export async function fetchKanjiWords(k, retries = 1) {
  if (kanjiWordsCache.has(k)) return kanjiWordsCache.get(k);
  let out = [];
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`https://kanjiapi.dev/v1/words/${encodeURIComponent(k)}`, {
        headers: { "User-Agent": "n1-translate" },
      });
      if (res.ok) {
        const j = await res.json();
        if (Array.isArray(j)) out = j;
        break;
      }
      if (res.status === 404) break;                      // 그 한자에 등재 단어 없음 — 재시도 무의미
      if (attempt === retries) console.warn(`  · kanjiapi words/${k} HTTP ${res.status}`);
    } catch (e) {
      if (attempt === retries) console.warn(`  · kanjiapi words/${k} 실패: ${e.message}`);
    }
    if (attempt < retries) await sleep(400);
  }
  kanjiWordsCache.set(k, out);
  return out;
}

// 표기(written)로 우선 매칭, 없으면 읽기(pronounced)로. 모든 meaning 의 gloss 를 평탄화.
export function glossFor(words, written, pronounced) {
  const hasVar = (w, pred) => Array.isArray(w.variants) && w.variants.some(pred);
  // 표기+읽기 둘 다 일치 > 표기만 > 읽기만  (같은 표기에 읽기가 여럿인 항목 구분)
  const exact = pronounced
    ? words.find((w) => hasVar(w, (v) => v.written === written && v.pronounced === pronounced))
    : null;
  const byWritten = exact || words.find((w) => hasVar(w, (v) => v.written === written));
  const byPron = !byWritten && pronounced
    ? words.find((w) => hasVar(w, (v) => v.pronounced === pronounced))
    : null;
  const hit = byWritten || byPron;
  if (!hit || !Array.isArray(hit.meanings)) return { en: "", matched: null };
  const glosses = [];
  for (const m of hit.meanings) {
    for (const g of (Array.isArray(m.glosses) ? m.glosses : [])) {
      if (typeof g === "string" && g.trim()) glosses.push(g.trim());
    }
  }
  return { en: glosses.join(", "), matched: byWritten ? "written" : "pronounced" };
}

// 한 단어의 gloss 를 구한다. lookupKanji 후보들을 차례로 kanjiapi 조회.
// 반환: { en, matched } — en 이 "" 이면 실패.
export async function glossForWord(word, reading, lookupKanji, retries = 1) {
  for (const k of lookupKanji) {
    if (!k) continue;
    const words = await fetchKanjiWords(k, retries);
    const { en, matched } = glossFor(words, word, reading);
    if (en) return { en, matched };
  }
  return { en: "", matched: null };
}

// ---------- 검증된 프롬프트 조립 (translate-test.mjs 원본 그대로) ----------
// targets: [{ word, reading, en }]
export function buildPrompt(targets) {
  const input = {};
  for (const t of targets) input[t.word] = { reading: t.reading, en: t.en };
  const inputJSON = JSON.stringify(input, null, 2);
  return [
    "당신은 일본어-한국어 사전 편집자입니다.",
    "아래는 일본어 단어들입니다. 각 단어에 대해 reading(읽기)과 en(영어 뜻)이 주어집니다.",
    "각 단어의 한국어 뜻을 붙이세요.",
    "",
    "규칙:",
    "- 사전 표제어 스타일로 짧게. 설명문·완결된 문장 금지.",
    "- 영어를 그대로 음차하지 말 것 (예: \"nod\" → \"노드\" 금지).",
    "- 뜻이 여러 개면 \", \" 로 구분해 최대 2개까지만.",
    "- 각 값은 30자 이내.",
    "",
    "출력 형식:",
    "- 반드시 JSON 객체 하나. 키는 입력의 일본어 단어, 값은 한국어 뜻 문자열.",
    "- 배열 금지. 입력에 있는 모든 단어를 키로 포함할 것.",
    '- 예: {"会釈":"목례, 가볍게 인사함"}',
    "",
    "입력:",
    inputJSON,
  ].join("\n");
}

// ---------- OpenRouter 1회 호출 ----------
export async function callModel(model, prompt, { key, maxTokens = 4000, title = "N1 Translate" } = {}) {
  if (!key) throw new Error("OPENROUTER_KEY 없음");
  const started = Date.now();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      "X-Title": title,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: maxTokens,
      temperature: 0,
    }),
  });
  const text = await res.text();
  const ms = Date.now() - started;
  let body;
  try { body = JSON.parse(text); }
  catch { throw new Error(`응답이 JSON 이 아님 (HTTP ${res.status}): ${text.slice(0, 200)}`); }
  if (!res.ok || body.error) {
    throw new Error(`HTTP ${res.status}: ${(body.error && body.error.message) || text.slice(0, 200)}`);
  }
  const content = body.choices && body.choices[0] && body.choices[0].message
    && body.choices[0].message.content;
  if (!content) throw new Error("응답 content 가 비어 있음");
  let parsed;
  try { parsed = JSON.parse(content); }
  catch { throw new Error(`content 가 JSON 객체가 아님: ${String(content).slice(0, 200)}`); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("출력이 객체가 아님 (배열/스칼라)");
  }
  return { parsed, ms, usage: body.usage || null };
}

// ---------- 한국어 값 검증 ----------
export const hasLatin = (s) => /[A-Za-z]/.test(s);

// 한 값의 문제점을 배열로. 빈 배열이면 통과.
export function checkKoValue(v) {
  const issues = [];
  if (v === undefined) { issues.push("키 없음"); return issues; }
  if (typeof v !== "string" || !v.trim()) { issues.push("빈 값"); return issues; }
  if (hasLatin(v)) issues.push("영문 잔존");
  if ([...v].length > MAX_KR_LEN) issues.push(`${[...v].length}자(>${MAX_KR_LEN})`);
  return issues;
}

// ---------- 출력 폭 맞추기 (CJK 대략 2폭) ----------
export function pad(s, n) {
  s = String(s == null ? "" : s);
  let w = 0;
  for (const ch of s) w += ch.codePointAt(0) > 0x1100 ? 2 : 1;
  return s + " ".repeat(Math.max(0, n - w));
}

// ---------- 토큰/비용 추정 (dry-run 용 · tiktoken 없이 어림) ----------
// CJK·가나·한글은 토큰 밀도가 높다(글자당 ~1.6), ASCII 는 낮다(~4글자/토큰).
export function estTokens(s) {
  let cjk = 0, other = 0;
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    const isCJK = (c >= 0x3000 && c <= 0x9fff)   // 가나 + CJK 통합한자
      || (c >= 0xac00 && c <= 0xd7a3)             // 한글 음절
      || (c >= 0xff00 && c <= 0xffef);            // 전각
    if (isCJK) cjk++; else other++;
  }
  return Math.ceil(cjk * 1.6 + other / 4);
}

// 입력 $0.20 / M, 출력 $1.20 / M (openai/gpt-5.6-luna).
export const PRICE_IN_PER_M = 0.20;
export const PRICE_OUT_PER_M = 1.20;
export function estCost(promptTokens, completionTokens) {
  return (promptTokens / 1e6) * PRICE_IN_PER_M + (completionTokens / 1e6) * PRICE_OUT_PER_M;
}
