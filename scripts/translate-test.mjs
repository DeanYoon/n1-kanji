#!/usr/bin/env node
// ===== 번역 모델 bake-off — 일본어 단어의 영어 뜻 → 한국어 짧은 뜻 =====
//
// 목적: "영어 gloss 를 사전 표제어 스타일의 짧은 한국어 뜻으로 옮기는" 작업에서
//       어느 OpenRouter 모델이 쓸 만한지 로그만 보고 눈으로 판단할 수 있게 한다.
//
// 이 스크립트는 GitHub Actions 의 workflow_dispatch 로만 돈다 (translate-test.yml).
// OPENROUTER_KEY 는 Actions secret 에만 있고 로컬엔 없다 → 결과는 Actions 로그로 확인.
//
// 하는 일:
//   1) Gist 의 n1-weak.json 을 공개 raw URL 로 읽어 unknown 앞에서 COUNT 개를 뽑는다.
//      각 항목의 words[0] 를 대상 단어로 삼는다.
//   2) 대상 단어의 영어 뜻은 n1-weak.json 에 없다 → kanjiapi.dev/v1/words/<한자> 로
//      가져와 그 표기(words[0].w)의 gloss 를 찾는다. (무료·토큰 불필요)
//   3) OpenRouter 모델 목록을 조회해 요청된 모델 ID 가 실제로 있는지 확인. 없으면
//      비슷한 후보를 로그에 찍고 그 모델은 건너뛴다 (잘못된 ID 로 조용히 실패 방지).
//   4) 살아남은 각 모델에 "동일한 프롬프트로" 1회 호출.
//   5) 자동 검증(키 누락·빈 값·영문 잔존·과장) + 모델별 통과/실패 집계.
//   6) 단어·읽기·영어뜻·각 모델의 한국어뜻을 나란히 놓은 비교표를 로그로 출력.
//      모델별 소요 시간·토큰 사용량·검증 통과율도 함께.
//   7) 한 모델이 실패해도 나머지는 계속.
//
// 환경변수:
//   OPENROUTER_KEY   (모델 호출에만 필요. 없으면 프롬프트 조립까지만 하고 종료)
//   MODELS           쉼표 구분 모델 ID 목록. 미지정 시 DEFAULT_MODELS.
//   COUNT            번역할 단어 수 (기본 10)
//   WEAK_RAW_URL     n1-weak.json 공개 raw URL 오버라이드 (기본: DeanYoon gist)
//
// 로컬 검증(키 없이 도달 가능한 데까지):
//   node scripts/translate-test.mjs            → gist 로드 · gloss 수집 · 프롬프트 출력
//   node --check scripts/translate-test.mjs    → 문법 체크

const DEFAULT_MODELS = [
  "openai/gpt-5.6-luna",
  "google/gemini-3.7-flash",
  "deepseek/deepseek-v4-flash-0731",
];

const WEAK_RAW_URL = process.env.WEAK_RAW_URL
  || "https://gist.githubusercontent.com/DeanYoon/3c7a0d99f309aa0dfea3861a7df296d4/raw/n1-weak.json";

const OPENROUTER_KEY = process.env.OPENROUTER_KEY || "";
const COUNT = (() => {
  const n = parseInt(process.env.COUNT || "10", 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
})();
const MODELS = (process.env.MODELS || DEFAULT_MODELS.join(","))
  .split(",").map((s) => s.trim()).filter(Boolean);

const MAX_KR_LEN = 30;   // 이보다 길면 "설명문" 으로 보고 검증 실패 처리

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function die(msg) { console.error("✗ " + msg); process.exit(1); }

// ---------- 1) 약점 데이터 로드 ----------
async function loadWeak() {
  const res = await fetch(WEAK_RAW_URL, { headers: { "User-Agent": "n1-translate-test" } });
  if (!res.ok) throw new Error(`n1-weak.json GET HTTP ${res.status}`);
  const data = await res.json();
  const unknown = Array.isArray(data.unknown) ? data.unknown : [];
  if (!unknown.length) throw new Error("n1-weak.json 에 unknown 배열이 비어 있음");
  return { data, unknown };
}

// ---------- 2) kanjiapi.dev 로 영어 gloss 수집 ----------
const kanjiWordsCache = new Map();

async function fetchKanjiWords(k) {
  if (kanjiWordsCache.has(k)) return kanjiWordsCache.get(k);
  let out = [];
  try {
    const res = await fetch(`https://kanjiapi.dev/v1/words/${encodeURIComponent(k)}`, {
      headers: { "User-Agent": "n1-translate-test" },
    });
    if (res.ok) {
      const j = await res.json();
      if (Array.isArray(j)) out = j;
    } else if (res.status !== 404) {
      console.warn(`  · kanjiapi words/${k} HTTP ${res.status}`);
    }
  } catch (e) {
    console.warn(`  · kanjiapi words/${k} 실패: ${e.message}`);
  }
  kanjiWordsCache.set(k, out);
  return out;
}

// 표기(written)로 우선 매칭, 없으면 읽기(pronounced)로. 모든 meaning 의 gloss 를 평탄화.
function glossFor(words, written, pronounced) {
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

// unknown 앞에서부터 스캔하며 "gloss 가 있는" 항목을 COUNT 개 모은다.
// gloss 를 못 구한 항목은 건너뛰되 로그에 남긴다 (모델 입력에 영어가 꼭 있어야 하므로).
async function collectTargets(unknown, count) {
  const targets = [];
  const skipped = [];
  for (const u of unknown) {
    if (targets.length >= count) break;
    const w0 = Array.isArray(u.words) ? u.words[0] : null;
    if (!u || typeof u.k !== "string" || !w0 || typeof w0.w !== "string") {
      skipped.push({ k: u && u.k, reason: "words[0] 없음" });
      continue;
    }
    const words = await fetchKanjiWords(u.k);
    const { en, matched } = glossFor(words, w0.w, w0.wr);
    if (!en) {
      skipped.push({ k: u.k, w: w0.w, reason: "kanjiapi gloss 없음" });
      continue;
    }
    targets.push({
      k: u.k, word: w0.w, reading: w0.wr || u.r || "", type: u.type || "",
      en, matched,
    });
  }
  return { targets, skipped };
}

// ---------- 프롬프트 조립 ----------
function buildPrompt(targets) {
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

// ---------- 3) OpenRouter 모델 목록 검증 ----------
async function fetchModelIds() {
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { "User-Agent": "n1-translate-test" },
  });
  if (!res.ok) throw new Error(`models 조회 HTTP ${res.status}`);
  const j = await res.json();
  return (Array.isArray(j.data) ? j.data : []).map((m) => m.id);
}

function similarIds(want, allIds) {
  const provider = want.includes("/") ? want.split("/")[0] : "";
  const stem = (want.includes("/") ? want.split("/")[1] : want).split(/[-:]/)[0].toLowerCase();
  return allIds
    .filter((id) => (provider ? id.startsWith(provider + "/") : true))
    .filter((id) => id.toLowerCase().includes(stem))
    .slice(0, 12);
}

// ---------- 4) 모델 1회 호출 ----------
async function callModel(model, prompt) {
  const started = Date.now();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + OPENROUTER_KEY,
      "Content-Type": "application/json",
      "X-Title": "N1 Translate Test",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 4000,
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

// ---------- 5) 자동 검증 ----------
const hasLatin = (s) => /[A-Za-z]/.test(s);

function validate(parsed, targets) {
  const rows = [];
  let pass = 0;
  for (const t of targets) {
    const v = parsed[t.word];
    const issues = [];
    if (v === undefined) issues.push("키 없음");
    else if (typeof v !== "string" || !v.trim()) issues.push("빈 값");
    else {
      if (hasLatin(v)) issues.push("영문 잔존");
      if ([...v].length > MAX_KR_LEN) issues.push(`${[...v].length}자(>${MAX_KR_LEN})`);
    }
    const ok = issues.length === 0;
    if (ok) pass++;
    rows.push({ word: t.word, value: typeof v === "string" ? v : "", ok, issues });
  }
  const extra = Object.keys(parsed).filter((k) => !targets.some((t) => t.word === k));
  return { rows, pass, total: targets.length, extra };
}

// ---------- 출력 ----------
function pad(s, n) {
  s = String(s == null ? "" : s);
  let w = 0;
  for (const ch of s) w += ch.codePointAt(0) > 0x1100 ? 2 : 1;   // CJK 대략 2폭
  return s + " ".repeat(Math.max(0, n - w));
}

function printComparison(targets, results) {
  const live = MODELS.map((m) => m).filter((m) => results[m] && results[m].parsed);
  console.log("\n══════ 번역 비교표 ══════════════════════════════════════════════");
  for (const t of targets) {
    console.log(`\n【${t.word}】 ${t.reading}${t.type ? ` (${t.type})` : ""}`);
    console.log(`  EN : ${t.en}`);
    for (const m of live) {
      const v = results[m].parsed[t.word];
      const val = typeof v === "string" ? v : (v === undefined ? "‹키 없음›" : JSON.stringify(v));
      console.log(`  ${pad(shortModel(m), 22)} ${val}`);
    }
  }
  console.log("\n══════════════════════════════════════════════════════════════");
}

const shortModel = (m) => m.length > 20 ? "…" + m.slice(-19) : m;

function printScoreboard(results) {
  console.log("\n══════ 모델별 요약 ══════════════════════════════════════════════");
  console.log(pad("모델", 34) + pad("결과", 10) + pad("검증통과", 12) + pad("시간", 9) + "토큰(prompt/completion)");
  console.log("─".repeat(90));
  for (const m of MODELS) {
    const r = results[m];
    if (!r) { console.log(pad(m, 34) + "건너뜀 (ID 확인 실패)"); continue; }
    if (r.error) { console.log(pad(m, 34) + pad("실패", 10) + r.error.slice(0, 80)); continue; }
    const u = r.usage || {};
    const tok = u.prompt_tokens != null ? `${u.prompt_tokens}/${u.completion_tokens ?? "?"}` : "?";
    const rate = `${r.pass}/${r.total} (${Math.round((r.pass / r.total) * 100)}%)`;
    console.log(
      pad(m, 34) + pad("성공", 10) + pad(rate, 12) + pad(`${(r.ms / 1000).toFixed(1)}s`, 9) + tok
    );
    if (r.extra && r.extra.length) console.log(`  · 여분 키: ${r.extra.join(", ")}`);
    const bad = r.rows.filter((x) => !x.ok);
    for (const b of bad) console.log(`  · ⚠ ${b.word}: "${b.value}" — ${b.issues.join(", ")}`);
  }
  console.log("══════════════════════════════════════════════════════════════");
}

// ---------- 메인 ----------
async function main() {
  console.log(`번역 모델 bake-off · COUNT=${COUNT} · 모델 ${MODELS.length}개`);
  console.log(`요청 모델: ${MODELS.join(", ")}`);

  // 1) 약점 데이터
  console.log(`\n── 1) n1-weak.json 로드 ── ${WEAK_RAW_URL}`);
  const { data, unknown } = await loadWeak();
  console.log(`  scope=${data.scope} · generatedAt=${data.generatedAt} · unknown ${unknown.length}개`);

  // 2) gloss 수집
  console.log(`\n── 2) kanjiapi.dev 영어 gloss 수집 ──`);
  const { targets, skipped } = await collectTargets(unknown, COUNT);
  for (const t of targets) {
    console.log(`  ✓ ${pad(t.word, 12)} ${pad(t.reading, 14)} [${t.matched}] ${t.en}`);
  }
  for (const s of skipped) {
    console.log(`  – 건너뜀 ${s.k || ""}${s.w ? "/" + s.w : ""} — ${s.reason}`);
  }
  if (!targets.length) die("gloss 를 구한 대상 단어가 0개입니다.");
  if (targets.length < COUNT) {
    console.log(`  ⚠ 요청 ${COUNT}개 중 ${targets.length}개만 gloss 확보 (나머지는 위 '건너뜀')`);
  }

  // 프롬프트 조립
  const prompt = buildPrompt(targets);
  console.log(`\n── 3) 조립된 프롬프트 (모든 모델에 동일) ──────────────────────`);
  console.log(prompt);
  console.log(`──────────────────────────────────────────────────────────────`);

  // 4) 모델 ID 검증
  console.log(`\n── 4) OpenRouter 모델 ID 확인 ──`);
  let allIds = [];
  try {
    allIds = await fetchModelIds();
    console.log(`  모델 목록 ${allIds.length}개 조회됨`);
  } catch (e) {
    console.warn(`  ⚠ 모델 목록 조회 실패 (${e.message}) → ID 검증 생략, 요청대로 진행`);
  }
  const results = {};
  const runnable = [];
  for (const m of MODELS) {
    if (allIds.length && !allIds.includes(m)) {
      const cands = similarIds(m, allIds);
      console.log(`  ✗ "${m}" 없음. 비슷한 후보: ${cands.length ? cands.join(", ") : "(없음)"}`);
      results[m] = null;   // 건너뜀 표시
      continue;
    }
    console.log(`  ✓ ${m}`);
    runnable.push(m);
  }

  // 키 없으면 여기까지
  if (!OPENROUTER_KEY) {
    console.log(`\nOPENROUTER_KEY 없음 → 모델 호출은 생략합니다. (프롬프트 조립까지 검증 완료)`);
    return;
  }
  if (!runnable.length) die("실행 가능한 모델이 0개입니다.");

  // 5) 모델 호출
  console.log(`\n── 5) 모델 호출 (${runnable.length}개) ──`);
  for (const m of runnable) {
    process.stdout.write(`  ${m} … `);
    try {
      const { parsed, ms, usage } = await callModel(m, prompt);
      const v = validate(parsed, targets);
      results[m] = { parsed, ms, usage, ...v, error: null };
      console.log(`성공 (${(ms / 1000).toFixed(1)}s · 검증 ${v.pass}/${v.total})`);
    } catch (e) {
      results[m] = { error: e.message };
      console.log(`실패 — ${e.message}`);
    }
    await sleep(300);
  }

  // 6) 출력
  printComparison(targets, results);
  printScoreboard(results);
}

main().catch((e) => die(e && e.stack ? e.stack : String(e)));
