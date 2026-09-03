#!/usr/bin/env node
// ===== JLPT 문법 데이터셋 한국어 번역기 (translate-grammar.mjs) =====
//
// build-grammar.mjs 가 Gist 에 올린 n1-grammar.json 을 읽어 항목마다 한국어를 붙이고
// Gist 의 n1-grammar-ko.json 에 저장한다.
//
// 항목당 번역하는 문자열 4개:
//   · formation_ko  — 접속(활용) 규칙의 한국어. 일본어 문법 용어(ます형·て형 등)는
//                     한국어로, 일본어 조사·어미(う·が·ば 등)는 그대로 남긴다.
//   · short_ko      — 짧은 한국어 뜻 (사전 표제어 스타일).
//   · ex_ko[2]      — 예문 2개를 "일본어 원문(jp)에서 직접" 한국어로. 영어(en)는 참고만
//                     하고 중역하지 않는다.
//
// 공용 로직(OpenRouter 호출 · 검증 헬퍼 · 토큰/비용 추정)은 translate-lib.mjs 재사용.
// 이 스크립트는 GitHub Actions 의 workflow_dispatch 로만 돈다 (grammar.yml).
//
// 하는 일:
//   1) Gist 에서 n1-grammar.json 로드. 이미 n1-grammar-ko.json 이 있으면 로드해서
//      번역이 끝난 id 는 건너뛴다 (재실행·중단 후 이어하기).
//   2) BATCH 개씩 묶어 OpenRouter 호출 (id 기반 JSON 출력).
//   3) 검증: 요청한 모든 id 존재 / 각 필드 비어있지 않음 / ex_ko 가 정확히 2개 /
//      한국어(한글)가 있고 영어 문장이 통째로 남지 않았는지. 실패한 id 만 최대 2회 재요청.
//   4) SAVE_EVERY(기본 5)배치마다 Gist 중간 저장. 마지막에 최종 저장.
//   5) 요약을 stdout + $GITHUB_STEP_SUMMARY 양쪽에. 번역 샘플 10개 포함.
//
// 플래그 / 환경변수:
//   --dry-run        OpenRouter 호출 없이 대상 수 · 배치 수 · 예상 비용만.
//                    (DRY_RUN=1 / DRY_RUN=true 도 동일)
//   OPENROUTER_KEY   (필수, --dry-run 이면 불필요)
//   GIST_TOKEN       (필수, --dry-run 이면 불필요) — gist scope PAT
//   GIST_ID          기본 3c7a0d99f309aa0dfea3861a7df296d4
//   MODEL            기본 openai/gpt-5.6-luna
//   BATCH            한 번에 번역할 항목 수 (기본 20 — 항목당 문자열 4개라 단어보다 무겁다)
//   LIMIT            대상 항목 상한 (기본 0 = 전부)
//   SAVE_EVERY       몇 배치마다 Gist 중간 저장 (기본 5)
//   GRAMMAR_SRC      n1-grammar.json 을 로컬 파일에서 읽기 (dry-run 검증용)
//   GITHUB_STEP_SUMMARY  (Actions 가 세팅) 있으면 요약을 여기에도 쓴다.
//
// 로컬 검증:
//   node --check scripts/translate-grammar.mjs
//   node scripts/translate-grammar.mjs --dry-run --grammar-src /tmp/n1-grammar.json

import { appendFileSync, readFileSync } from "node:fs";
import {
  sleep, pad, callModel, hasLatin, estTokens,
  PRICE_IN_PER_M, PRICE_OUT_PER_M, DEFAULT_GIST_ID, DEFAULT_GIST_OWNER,
} from "./translate-lib.mjs";

// ---------- 설정 ----------
const DRY_RUN = process.argv.includes("--dry-run")
  || process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

const OPENROUTER_KEY = process.env.OPENROUTER_KEY || "";
const GIST_TOKEN = process.env.GIST_TOKEN || "";
const GIST_ID = process.env.GIST_ID || DEFAULT_GIST_ID;
const MODEL = process.env.MODEL || "openai/gpt-5.6-luna";
const BATCH = (() => {
  const n = parseInt(process.env.BATCH || "20", 10);
  return Number.isFinite(n) && n > 0 ? n : 20;
})();
const LIMIT = (() => {
  const n = parseInt(process.env.LIMIT || "0", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
})();
const SAVE_EVERY = (() => {
  const n = parseInt(process.env.SAVE_EVERY || "5", 10);
  return Number.isFinite(n) && n > 0 ? n : 5;
})();
const GRAMMAR_SRC = (() => {
  const i = process.argv.indexOf("--grammar-src");
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return process.env.GRAMMAR_SRC || "";
})();

const GRAMMAR_FILE = "n1-grammar.json";
const KO_FILE = "n1-grammar-ko.json";
const GH = "https://api.github.com/gists/" + GIST_ID;
const MAX_ATTEMPTS = 3;   // 최초 1 + 재요청 2

function die(msg) { console.error("✗ " + msg); process.exit(1); }

// ---------- run 요약 ($GITHUB_STEP_SUMMARY) ----------
const summaryLines = [];
function sum(line = "") { summaryLines.push(line); }
function flushSummary() {
  const path = process.env.GITHUB_STEP_SUMMARY;
  if (!path || !summaryLines.length) return;
  try { appendFileSync(path, summaryLines.join("\n") + "\n"); }
  catch (e) { console.warn(`  · STEP_SUMMARY 쓰기 실패: ${e.message}`); }
}

// ---------- Gist I/O ----------
function ghHeaders() {
  const h = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "n1-translate-grammar",
  };
  if (GIST_TOKEN) h.Authorization = "Bearer " + GIST_TOKEN;
  return h;
}

function grammarRawUrl(name) {
  return `https://gist.githubusercontent.com/${DEFAULT_GIST_OWNER}/${GIST_ID}/raw/${name}`;
}

// 토큰 있으면 Gist API, 없으면 공개 raw URL. GRAMMAR_SRC 지정 시 로컬 파일.
async function loadInputs() {
  if (GRAMMAR_SRC) {
    const grammar = JSON.parse(readFileSync(GRAMMAR_SRC, "utf8"));
    return { grammar, ko: null };
  }
  if (!GIST_TOKEN) {
    const gRes = await fetch(grammarRawUrl(GRAMMAR_FILE), { headers: { "User-Agent": "n1-translate-grammar" } });
    if (!gRes.ok) throw new Error(`${GRAMMAR_FILE} GET HTTP ${gRes.status} — build 단계를 먼저 실행했는지 확인`);
    const grammar = await gRes.json();
    let ko = null;
    try {
      const kRes = await fetch(grammarRawUrl(KO_FILE), { headers: { "User-Agent": "n1-translate-grammar" } });
      if (kRes.ok) ko = await kRes.json();
    } catch { /* 아직 없음 — 정상 */ }
    return { grammar, ko };
  }
  const res = await fetch(GH, { headers: ghHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gist GET HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const meta = await res.json();
  const readFile = async (name) => {
    const f = meta.files && meta.files[name];
    if (!f) return null;
    const txt = f.truncated && f.raw_url
      ? await (await fetch(f.raw_url, { headers: ghHeaders() })).text()
      : f.content;
    try { return JSON.parse(txt); }
    catch (e) { throw new Error(`${name} 파싱 실패: ${e.message}`); }
  };
  const grammar = await readFile(GRAMMAR_FILE);
  if (!grammar || !Array.isArray(grammar.items)) throw new Error(`${GRAMMAR_FILE} 없음/손상 — build 단계를 먼저 실행`);
  const ko = await readFile(KO_FILE);
  return { grammar, ko };
}

async function gistPatchKo(payload) {
  const res = await fetch(GH, {
    method: "PATCH",
    headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ files: { [KO_FILE]: { content: JSON.stringify(payload, null, 2) } } }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gist PATCH HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
}

// ---------- 프롬프트 (문법 항목용) ----------
function buildGrammarPrompt(items) {
  const input = {};
  for (const it of items) {
    input[it.id] = {
      title: it.title,
      formation: it.formation,
      short: it.short,
      examples: it.examples.map((e) => ({ jp: e.jp, en: e.en })),
    };
  }
  return [
    "당신은 일본어-한국어 문법 교재 편집자입니다.",
    "아래는 JLPT 문법 항목들입니다. 각 항목에는 title(문법 형태), formation(접속 규칙·영어),",
    "short(짧은 뜻·영어), examples(예문 2개: jp=일본어 원문, en=영어 번역)이 있습니다.",
    "",
    "각 항목에 대해 다음 한국어를 만드세요:",
    "- formation_ko: 접속 규칙을 한국어로. 일본어 문법 용어(예: ます형·て형·사전형·의지형·",
    "  명사·동사·い형용사·な형용사)는 한국어로 쓰되, 일본어 조사·어미·표현(う·が·ば·ても·",
    "  わけ 등)은 일본어 그대로 남길 것.",
    "- short_ko: 짧은 한국어 뜻. 사전 표제어 스타일, 완결된 설명문 금지. 예: \"~하든 ~하든 상관없이\".",
    "- ex_ko: 예문 2개를 한국어로 번역. 반드시 일본어 원문(jp)에서 직접 번역할 것.",
    "  영어(en)는 뜻 참고용일 뿐, 영어를 다시 옮기지 말 것. 자연스러운 한국어 문장으로.",
    "",
    "규칙:",
    "- 영어 단어를 그대로 음차하지 말 것.",
    "- 모든 값은 한국어로. 영어 문장을 그대로 두지 말 것.",
    "- ex_ko 는 정확히 2개.",
    "",
    "출력 형식:",
    "- 반드시 JSON 객체 하나. 키는 입력의 id.",
    '- 값은 {"formation_ko":"...","short_ko":"...","ex_ko":["...","..."]}.',
    "- 최상위 배열 금지. 입력에 있는 모든 id 를 키로 포함할 것.",
    "",
    "입력:",
    JSON.stringify(input, null, 2),
  ].join("\n");
}

// ---------- 검증 ----------
const hasHangul = (s) => /[가-힣]/.test(s);
// 라틴 단어(2자 이상)가 4개 넘게 연달아 있으면 "영어 문장이 통째로 남음" 으로 본다.
const looksEnglish = (s) => /[A-Za-z]{2,}(?:[ ,'’-]+[A-Za-z]{2,}){3,}/.test(s);

function fieldIssues(label, v) {
  if (typeof v !== "string" || !v.trim()) return [`${label} 빈 값`];
  const issues = [];
  if (!hasHangul(v)) issues.push(`${label} 한글 없음`);
  if (looksEnglish(v)) issues.push(`${label} 영어 문장 잔존`);
  return issues;
}

// 한 항목의 번역값 검증. 빈 배열이면 통과.
function checkItem(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return ["값이 객체가 아님"];
  const issues = [];
  issues.push(...fieldIssues("formation_ko", v.formation_ko));
  issues.push(...fieldIssues("short_ko", v.short_ko));
  if (!Array.isArray(v.ex_ko)) issues.push("ex_ko 배열 아님");
  else if (v.ex_ko.length !== 2) issues.push(`ex_ko ${v.ex_ko.length}개(≠2)`);
  else v.ex_ko.forEach((e, i) => issues.push(...fieldIssues(`ex_ko[${i}]`, e)));
  return issues;
}

function normalizeItem(v) {
  return {
    formation_ko: v.formation_ko.trim(),
    short_ko: v.short_ko.trim(),
    ex_ko: v.ex_ko.map((e) => e.trim()),
  };
}

// ---------- 배치 번역 (검증 + 재요청) ----------
// batch: [{ id, title, formation, short, examples }]
// 반환: { ok: {id: normalized}, failed: [{id, issues}], usage }
async function translateBatch(batch) {
  const okMap = {};
  let pending = batch.slice();
  const usageAcc = { prompt_tokens: 0, completion_tokens: 0 };
  let lastIssues = new Map();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && pending.length; attempt++) {
    const prompt = buildGrammarPrompt(pending);
    let parsed, usage;
    try {
      ({ parsed, usage } = await callModel(MODEL, prompt, {
        key: OPENROUTER_KEY,
        maxTokens: Math.max(4000, pending.length * 260),
        title: "N1 Translate Grammar",
      }));
    } catch (e) {
      console.warn(`    · 배치 호출 실패 (시도 ${attempt}/${MAX_ATTEMPTS}): ${e.message}`);
      if (attempt < MAX_ATTEMPTS) { await sleep(1000 * 2 ** (attempt - 1)); continue; }
      break;
    }
    if (usage) {
      usageAcc.prompt_tokens += usage.prompt_tokens || 0;
      usageAcc.completion_tokens += usage.completion_tokens || 0;
    }
    const stillPending = [];
    lastIssues = new Map();
    for (const t of pending) {
      const v = parsed[t.id];
      const issues = v === undefined ? ["id 없음"] : checkItem(v);
      if (issues.length === 0) okMap[t.id] = normalizeItem(v);
      else { stillPending.push(t); lastIssues.set(t.id, issues); }
    }
    pending = stillPending;
    if (pending.length && attempt < MAX_ATTEMPTS) {
      console.warn(`    · ${pending.length}개 검증 실패 → 재요청 (${pending.map((t) => t.id).join(", ")})`);
      await sleep(500);
    }
  }

  const failed = pending.map((t) => ({ id: t.id, issues: lastIssues.get(t.id) || ["재요청 후에도 실패"] }));
  return { ok: okMap, failed, usage: usageAcc };
}

// ---------- 이어하기: 이미 번역된 id ----------
function isDone(entry) {
  return entry && typeof entry === "object"
    && typeof entry.formation_ko === "string" && entry.formation_ko.trim()
    && typeof entry.short_ko === "string" && entry.short_ko.trim()
    && Array.isArray(entry.ex_ko) && entry.ex_ko.length === 2
    && entry.ex_ko.every((e) => typeof e === "string" && e.trim());
}

// ---------- 비용 ----------
function fmtCost(usdIn, usdOut) {
  const total = usdIn + usdOut;
  return `$${total.toFixed(4)} (입력 $${usdIn.toFixed(4)} + 출력 $${usdOut.toFixed(4)})`;
}

// ---------- 메인 ----------
async function main() {
  const startedAt = Date.now();
  console.log(`문법 항목 한국어 번역 · MODEL=${MODEL} · BATCH=${BATCH} · LIMIT=${LIMIT || "전부"}${DRY_RUN ? " · DRY-RUN" : ""}`);

  if (!DRY_RUN) {
    if (!OPENROUTER_KEY) die("OPENROUTER_KEY 환경변수가 없습니다.");
    if (!GIST_TOKEN) die("GIST_TOKEN 환경변수가 없습니다.");
  }

  // ---- 1) 입력 로드 ----
  const srcLabel = GRAMMAR_SRC ? `로컬 ${GRAMMAR_SRC}` : (GIST_TOKEN ? "Gist API" : "공개 raw");
  console.log(`\n── 1) ${GRAMMAR_FILE} 로드 (${srcLabel}) ──`);
  const { grammar, ko } = await loadInputs();
  if (!grammar || !Array.isArray(grammar.items)) die(`${GRAMMAR_FILE} 에 items 배열이 없습니다.`);
  const items = grammar.items;
  console.log(`  ${GRAMMAR_FILE} · version=${grammar.version} · builtAt=${grammar.builtAt} · items ${items.length}개`);
  if (grammar.counts) console.log(`  counts: ${JSON.stringify(grammar.counts)}`);

  const existing = (ko && ko.items && typeof ko.items === "object") ? ko.items : {};
  const existingCount = Object.keys(existing).filter((id) => isDone(existing[id])).length;
  console.log(`  ${KO_FILE} · ${ko ? `기존 ${existingCount}개 번역됨` : "없음 (처음부터)"}`);

  // ---- 2) 대상 목록 ----
  let targets = items.slice();
  if (LIMIT && targets.length > LIMIT) {
    targets = targets.slice(0, LIMIT);
    console.log(`  LIMIT=${LIMIT} 적용 → ${targets.length}개`);
  }
  const need = targets.filter((it) => !isDone(existing[it.id]));
  const alreadyDone = targets.length - need.length;
  console.log(`\n── 2) 대상 ──`);
  console.log(`  대상 ${targets.length}개 · 이미 번역됨 ${alreadyDone}개 · 이번에 처리 ${need.length}개`);

  const batchCount = Math.ceil(need.length / BATCH);

  if (!need.length) {
    console.log("\n처리할 항목이 없습니다 — 모두 번역 완료 상태입니다.");
    sum(`## 문법 항목 번역 — 변경 없음`);
    sum(`- 대상 ${targets.length}개 전부 이미 \`${KO_FILE}\` 에 있음.`);
    return;
  }

  // ---- dry-run: 배치·비용 추정 ----
  if (DRY_RUN) {
    let estPrompt = 0, estCompletion = 0;
    for (let i = 0; i < need.length; i += BATCH) {
      const slice = need.slice(i, i + BATCH);
      estPrompt += estTokens(buildGrammarPrompt(slice));
      // 항목당 출력: formation_ko + short_ko + ex_ko 2개 ≈ 한국어 ~160자 ≈ ~260토큰
      estCompletion += slice.length * 260;
    }
    const usdIn = (estPrompt / 1e6) * PRICE_IN_PER_M;
    const usdOut = (estCompletion / 1e6) * PRICE_OUT_PER_M;

    console.log(`\n── DRY-RUN 추정 ──`);
    console.log(`  총 항목           ${items.length}개`);
    console.log(`  이미 번역됨        ${alreadyDone}개`);
    console.log(`  이번에 번역        ${need.length}개`);
    console.log(`  배치 수            ${batchCount}개 (BATCH=${BATCH})`);
    console.log(`  추정 토큰          입력 ~${estPrompt.toLocaleString()} · 출력 ~${estCompletion.toLocaleString()}`);
    console.log(`  추정 비용          ${fmtCost(usdIn, usdOut)}`);
    console.log(`\n  ※ 재요청·프롬프트 변동은 미반영 — 실제 비용은 이 값 근처에서 변동.`);

    sum(`## 문법 항목 번역 (DRY-RUN)`);
    sum(`| 항목 | 값 |`);
    sum(`| --- | --- |`);
    sum(`| 모델 | \`${MODEL}\` |`);
    sum(`| 총 항목 | ${items.length} |`);
    sum(`| 이미 번역됨 | ${alreadyDone} |`);
    sum(`| 이번에 번역 | ${need.length} |`);
    sum(`| 배치 수 (BATCH=${BATCH}) | ${batchCount} |`);
    sum(`| 추정 토큰 (입력/출력) | ~${estPrompt.toLocaleString()} / ~${estCompletion.toLocaleString()} |`);
    sum(`| 추정 비용 | ${fmtCost(usdIn, usdOut)} |`);
    return;
  }

  // ---- 3) 배치 번역 ----
  const batches = [];
  for (let i = 0; i < need.length; i += BATCH) batches.push(need.slice(i, i + BATCH));
  console.log(`\n── 3) 번역 (${batches.length}배치 · BATCH=${BATCH}) ──`);

  const resultItems = { ...existing };
  const failedAll = [];
  const usageTotal = { prompt_tokens: 0, completion_tokens: 0 };
  let newCount = 0;

  const buildPayload = () => ({
    version: 1,
    model: MODEL,
    updatedAt: new Date().toISOString(),
    items: resultItems,
  });

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    process.stdout.write(`  배치 ${b + 1}/${batches.length} (${batch.length}개) … `);
    const { ok, failed, usage } = await translateBatch(batch);
    usageTotal.prompt_tokens += usage.prompt_tokens;
    usageTotal.completion_tokens += usage.completion_tokens;
    for (const t of batch) {
      if (ok[t.id]) { resultItems[t.id] = ok[t.id]; newCount++; }
    }
    for (const f of failed) failedAll.push(f);
    console.log(`완료 (성공 ${Object.keys(ok).length} · 실패 ${failed.length})`);

    if ((b + 1) % SAVE_EVERY === 0 && b + 1 < batches.length) {
      try {
        await gistPatchKo(buildPayload());
        console.log(`    · 중간 저장 (${Object.keys(resultItems).length}개)`);
      } catch (e) {
        console.warn(`    · 중간 저장 실패 (계속): ${e.message}`);
      }
    }
    await sleep(300);
  }

  // ---- 최종 저장 ----
  await gistPatchKo(buildPayload());
  console.log(`\n✓ ${KO_FILE} 최종 저장 · 총 ${Object.keys(resultItems).length}개`);

  // ---- 요약 ----
  const elapsed = ((Date.now() - startedAt) / 1000);
  const usdIn = (usageTotal.prompt_tokens / 1e6) * PRICE_IN_PER_M;
  const usdOut = (usageTotal.completion_tokens / 1e6) * PRICE_OUT_PER_M;

  console.log(`\n── 실행 요약 ──────────────────────────────`);
  console.log(`총 항목                 ${items.length}개`);
  console.log(`이번 대상               ${targets.length}개`);
  console.log(`신규 번역               ${newCount}개`);
  console.log(`건너뜀(이미 있음)       ${alreadyDone}개`);
  console.log(`검증 실패(제외)         ${failedAll.length}개`);
  console.log(`배치 수                 ${batches.length}개`);
  console.log(`소요 시간               ${elapsed.toFixed(1)}s`);
  console.log(`누적 토큰               입력 ${usageTotal.prompt_tokens.toLocaleString()} · 출력 ${usageTotal.completion_tokens.toLocaleString()}`);
  console.log(`추정 비용               ${fmtCost(usdIn, usdOut)}`);
  console.log(`──────────────────────────────────────────`);
  if (failedAll.length) {
    console.log(`검증 실패 id:`);
    for (const f of failedAll) console.log(`  · ${f.id} — ${f.issues.join(", ")}`);
  }

  // ---- $GITHUB_STEP_SUMMARY ----
  sum(`## 문법 항목 한국어 번역`);
  sum(`| 항목 | 값 |`);
  sum(`| --- | --- |`);
  sum(`| 모델 | \`${MODEL}\` |`);
  sum(`| 총 항목 | ${items.length} |`);
  sum(`| 이번 대상 | ${targets.length} |`);
  sum(`| 신규 번역 | ${newCount} |`);
  sum(`| 건너뜀 (이미 있음) | ${alreadyDone} |`);
  sum(`| 검증 실패 (제외) | ${failedAll.length} |`);
  sum(`| 배치 수 (BATCH=${BATCH}) | ${batches.length} |`);
  sum(`| 소요 시간 | ${elapsed.toFixed(1)}s |`);
  sum(`| 누적 토큰 (입력/출력) | ${usageTotal.prompt_tokens.toLocaleString()} / ${usageTotal.completion_tokens.toLocaleString()} |`);
  sum(`| 추정 비용 | ${fmtCost(usdIn, usdOut)} |`);
  sum(`| \`${KO_FILE}\` 총 항목 수 | ${Object.keys(resultItems).length} |`);
  sum("");

  const byId = new Map(items.map((it) => [it.id, it]));
  const samples = Object.keys(resultItems)
    .filter((id) => need.some((t) => t.id === id))
    .slice(0, 10);
  if (samples.length) {
    sum(`### 번역 샘플 10개`);
    for (const id of samples) {
      const src = byId.get(id) || {};
      const v = resultItems[id];
      sum(`**${id}** · ${src.title || ""}`);
      sum("");
      sum(`| 필드 | 원본 | 한국어 |`);
      sum(`| --- | --- | --- |`);
      sum(`| formation | ${String(src.formation || "").replace(/\|/g, "/")} | ${v.formation_ko.replace(/\|/g, "/")} |`);
      sum(`| short | ${String(src.short || "").replace(/\|/g, "/")} | ${v.short_ko.replace(/\|/g, "/")} |`);
      (src.examples || []).forEach((e, i) => {
        sum(`| ex${i + 1} | ${String(e.jp || "").replace(/\|/g, "/")} | ${String(v.ex_ko[i] || "").replace(/\|/g, "/")} |`);
      });
      sum("");
    }
  }
  if (failedAll.length) {
    sum(`<details><summary>검증 실패 ${failedAll.length}개 (결과에서 제외)</summary>`);
    sum("");
    for (const f of failedAll) sum(`- **${f.id}** — ${f.issues.join(", ")}`);
    sum("");
    sum(`</details>`);
  }
}

main()
  .then(flushSummary)
  .catch((e) => { flushSummary(); die(e && e.stack ? e.stack : String(e)); });
