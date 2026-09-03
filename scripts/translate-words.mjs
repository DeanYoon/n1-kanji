#!/usr/bin/env node
// ===== 진단 약점 단어 전량 한국어 뜻 생성기 (translate-words.mjs) =====
//
// 진단(self-check) 결과인 Gist 의 n1-weak.json 안 unknown 항목들이 가진 words(단어)를
// 전부 모아 중복 제거하고, 각 단어의 짧은 한국어 뜻을 OpenRouter 로 한 번에 만들어
// Gist 의 n1-weak-ko.json 에 저장한다.
//
// 이 스크립트는 GitHub Actions 의 workflow_dispatch 로만 돈다 (translate-words.yml).
// 공용 로직(gist 로드 · kanjiapi gloss · 프롬프트 · 호출 · 검증)은 translate-lib.mjs.
//
// 하는 일:
//   1) Gist 에서 n1-weak.json 로드. 이미 n1-weak-ko.json 이 있으면 로드해서
//      번역된 단어는 건너뛴다 (재실행·중단 후 이어하기 가능).
//   2) 번역 대상 단어 목록 만들고 중복 제거. 각 단어의 영어 gloss 를 kanjiapi 로
//      수집(동시 5개, 실패 시 1회 재시도). gloss 없는 단어는 건너뛰고 목록에 기록.
//   3) batch 개씩 묶어 OpenRouter 호출 (키 기반 JSON 출력).
//   4) 검증: 키 존재 · 빈 값 · 영문 잔존 · 30자 초과. 실패한 키만 모아 최대 2회 재요청.
//      그래도 실패면 그 단어는 결과에서 빼고 목록에 남긴다.
//   5) 5배치마다 진행 상황을 Gist 에 저장. 마지막에 최종 저장.
//   6) 실행 요약 (stdout + $GITHUB_STEP_SUMMARY): 총 대상 / 신규 / 건너뜀 / gloss 없음 /
//      검증 실패 / 배치 수 / 소요 시간 / 누적 토큰 · 추정 비용. 번역 샘플 20개.
//
// 플래그:
//   --dry-run         OpenRouter 호출 없이 대상 수 · 배치 수 · 예상 비용만 출력.
//                     (DRY_RUN=1 / DRY_RUN=true 환경변수도 동일)
//   --gloss-sample N  dry-run 중 kanjiapi gloss 수집을 앞 N개만 실제로 돌려 성공률 확인.
//
// 환경변수:
//   OPENROUTER_KEY   (필수, --dry-run 이면 불필요)
//   GIST_TOKEN       (필수, --dry-run 이면 불필요) — gist scope PAT
//   GIST_ID          기본 3c7a0d99f309aa0dfea3861a7df296d4
//   MODEL            기본 openai/gpt-5.6-luna
//   BATCH            한 번에 번역할 단어 수 (기본 40)
//   LIMIT            대상 단어 상한 (기본 0 = 전부)
//   SAVE_EVERY       몇 배치마다 Gist 에 중간 저장할지 (기본 5)
//   GITHUB_STEP_SUMMARY  (Actions 가 세팅) 있으면 요약을 여기에도 쓴다.
//
// 로컬 검증(키 없이 도달 가능한 데까지):
//   node --check scripts/translate-words.mjs
//   node scripts/translate-words.mjs --dry-run
//   node scripts/translate-words.mjs --dry-run --gloss-sample 20

import { appendFileSync } from "node:fs";
import {
  sleep, pad, weakRawUrl, loadWeak, glossForWord, buildPrompt, callModel,
  checkKoValue, estTokens, estCost, PRICE_IN_PER_M, PRICE_OUT_PER_M,
  DEFAULT_GIST_ID,
} from "./translate-lib.mjs";

// ---------- 설정 ----------
const DRY_RUN = process.argv.includes("--dry-run")
  || process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
const GLOSS_SAMPLE = (() => {
  const i = process.argv.indexOf("--gloss-sample");
  if (i < 0) return 0;
  const n = parseInt(process.argv[i + 1] || "0", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
})();

const OPENROUTER_KEY = process.env.OPENROUTER_KEY || "";
const GIST_TOKEN = process.env.GIST_TOKEN || "";
const GIST_ID = process.env.GIST_ID || DEFAULT_GIST_ID;
const MODEL = process.env.MODEL || "openai/gpt-5.6-luna";
const BATCH = (() => {
  const n = parseInt(process.env.BATCH || "40", 10);
  return Number.isFinite(n) && n > 0 ? n : 40;
})();
const LIMIT = (() => {
  const n = parseInt(process.env.LIMIT || "0", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
})();
const SAVE_EVERY = (() => {
  const n = parseInt(process.env.SAVE_EVERY || "5", 10);
  return Number.isFinite(n) && n > 0 ? n : 5;
})();

const WEAK_FILE = "n1-weak.json";
const KO_FILE = "n1-weak-ko.json";
const GH = "https://api.github.com/gists/" + GIST_ID;
const GLOSS_CONCURRENCY = 5;
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
    "User-Agent": "n1-translate-words",
  };
  if (GIST_TOKEN) h.Authorization = "Bearer " + GIST_TOKEN;
  return h;
}

// 토큰 있으면 Gist API 로, 없으면(로컬 dry-run) 공개 raw URL 로.
async function loadInputs() {
  if (!GIST_TOKEN) {
    const { data } = await loadWeak(weakRawUrl(WEAK_FILE, undefined, GIST_ID));
    let ko = null;
    try {
      const res = await fetch(weakRawUrl(KO_FILE, undefined, GIST_ID), { headers: { "User-Agent": "n1-translate-words" } });
      if (res.ok) ko = await res.json();
    } catch { /* 아직 없음 — 정상 */ }
    return { weak: data, ko };
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
  const weak = await readFile(WEAK_FILE);
  if (!weak || !Array.isArray(weak.unknown)) throw new Error(`${WEAK_FILE} 없음/손상`);
  const ko = await readFile(KO_FILE);
  return { weak, ko };
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

// ---------- 대상 단어 목록 (중복 제거) ----------
// unknown 을 순서대로 훑어 words 를 모은다. 같은 단어가 여러 항목에서 나오면
// lookupKanji 후보만 늘리고 항목은 하나로 유지.
function collectWordList(unknown) {
  const map = new Map();   // word -> { word, wr, lookupKanji:Set }
  for (const u of unknown) {
    if (!u || typeof u.k !== "string") continue;
    const words = Array.isArray(u.words) ? u.words : [];
    for (const w of words) {
      if (!w || typeof w.w !== "string" || !w.w) continue;
      let e = map.get(w.w);
      if (!e) { e = { word: w.w, wr: typeof w.wr === "string" ? w.wr : "", lookupKanji: new Set() }; map.set(w.w, e); }
      e.lookupKanji.add(u.k);
      // 단어 자체에 든 한자도 후보에 (예: "会釈" → 会, 釈)
      for (const ch of w.w) if (/\p{Script=Han}/u.test(ch)) e.lookupKanji.add(ch);
      if (!e.wr && w.wr) e.wr = w.wr;
    }
  }
  return [...map.values()].map((e) => ({ word: e.word, wr: e.wr, lookupKanji: [...e.lookupKanji] }));
}

// ---------- 동시 5개 gloss 수집 ----------
async function collectGlosses(targets, onProgress) {
  const withGloss = [];
  const noGloss = [];
  let idx = 0, done = 0;
  async function worker() {
    while (idx < targets.length) {
      const t = targets[idx++];
      const { en } = await glossForWord(t.word, t.wr, t.lookupKanji, 1);
      if (en) withGloss.push({ word: t.word, reading: t.wr, en });
      else noGloss.push(t.word);
      done++;
      if (onProgress && done % 50 === 0) onProgress(done, targets.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(GLOSS_CONCURRENCY, targets.length) }, worker));
  // 입력 순서 보존
  const order = new Map(targets.map((t, i) => [t.word, i]));
  withGloss.sort((a, b) => order.get(a.word) - order.get(b.word));
  return { withGloss, noGloss };
}

// ---------- 배치 번역 (검증 + 재요청) ----------
// batch: [{ word, reading, en }]. 반환: { ok: {word: ko}, failed: [{word, issues}], usage }
async function translateBatch(batch) {
  const okMap = {};
  let pending = batch.slice();
  const usageAcc = { prompt_tokens: 0, completion_tokens: 0 };
  let lastIssues = new Map();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && pending.length; attempt++) {
    const prompt = buildPrompt(pending);
    let parsed, usage;
    try {
      ({ parsed, usage } = await callModel(MODEL, prompt, {
        key: OPENROUTER_KEY,
        maxTokens: Math.max(2000, pending.length * 90),
        title: "N1 Translate Words",
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
      const v = parsed[t.word];
      const issues = checkKoValue(v);
      if (issues.length === 0) okMap[t.word] = v.trim();
      else { stillPending.push(t); lastIssues.set(t.word, issues); }
    }
    pending = stillPending;
    if (pending.length && attempt < MAX_ATTEMPTS) {
      console.warn(`    · ${pending.length}개 검증 실패 → 재요청 (${pending.map((t) => t.word).join(", ")})`);
      await sleep(500);
    }
  }

  const failed = pending.map((t) => ({ word: t.word, issues: lastIssues.get(t.word) || ["재요청 후에도 실패"] }));
  return { ok: okMap, failed, usage: usageAcc };
}

// ---------- 요약 ----------
function fmtCost(usdIn, usdOut) {
  const total = usdIn + usdOut;
  return `$${total.toFixed(4)} (입력 $${usdIn.toFixed(4)} + 출력 $${usdOut.toFixed(4)})`;
}

// ---------- 메인 ----------
async function main() {
  const startedAt = Date.now();
  console.log(`약점 단어 전량 번역 · MODEL=${MODEL} · BATCH=${BATCH} · LIMIT=${LIMIT || "전부"}${DRY_RUN ? " · DRY-RUN" : ""}`);

  if (!DRY_RUN) {
    if (!OPENROUTER_KEY) die("OPENROUTER_KEY 환경변수가 없습니다.");
    if (!GIST_TOKEN) die("GIST_TOKEN 환경변수가 없습니다.");
  }

  // ---- 1) 입력 로드 ----
  console.log(`\n── 1) Gist 로드 (${GIST_TOKEN ? "API" : "공개 raw"}) ──`);
  const { weak, ko } = await loadInputs();
  const unknown = weak.unknown;
  console.log(`  n1-weak.json · scope=${weak.scope} · generatedAt=${weak.generatedAt} · unknown ${unknown.length}개`);

  const existing = (ko && ko.words && typeof ko.words === "object") ? ko.words : {};
  const existingCount = Object.keys(existing).length;
  console.log(`  n1-weak-ko.json · ${ko ? `기존 ${existingCount}개 번역됨` : "없음 (처음부터)"}`);

  // ---- 2) 대상 목록 + 중복 제거 ----
  let wordList = collectWordList(unknown);
  const totalUnique = wordList.length;
  const rawSlots = unknown.reduce((n, u) => n + (Array.isArray(u.words) ? u.words.filter((w) => w && w.w).length : 0), 0);
  console.log(`\n── 2) 대상 단어 ──`);
  console.log(`  단어 슬롯 ${rawSlots}개 → 중복 제거 후 ${totalUnique}개`);

  if (LIMIT && wordList.length > LIMIT) {
    wordList = wordList.slice(0, LIMIT);
    console.log(`  LIMIT=${LIMIT} 적용 → ${wordList.length}개`);
  }

  const alreadyDone = wordList.filter((t) => {
    const e = existing[t.word];
    return e && typeof e.ko === "string" && e.ko.trim();
  });
  const need = wordList.filter((t) => !(existing[t.word] && typeof existing[t.word].ko === "string" && existing[t.word].ko.trim()));
  console.log(`  대상 ${wordList.length}개 · 이미 번역됨 ${alreadyDone.length}개 · 이번에 처리 ${need.length}개`);

  if (!need.length) {
    console.log("\n처리할 단어가 없습니다 — 모두 번역 완료 상태입니다.");
    sum(`## 약점 단어 번역 — 변경 없음`);
    sum(`- 대상 ${wordList.length}개 전부 이미 \`${KO_FILE}\` 에 있음 (${existingCount}개).`);
    return;
  }

  // ---- dry-run: gloss 없이 배치·비용 추정 ----
  if (DRY_RUN) {
    let glossReport = "";
    let lastGlossSample = null;
    if (GLOSS_SAMPLE) {
      const sample = need.slice(0, GLOSS_SAMPLE);
      console.log(`\n── (gloss-sample) 앞 ${sample.length}개 kanjiapi 실측 ──`);
      const { withGloss, noGloss } = await collectGlosses(sample);
      lastGlossSample = withGloss;
      for (const g of withGloss) console.log(`  ✓ ${pad(g.word, 12)} ${pad(g.reading, 12)} ${g.en}`);
      for (const w of noGloss) console.log(`  – gloss 없음: ${w}`);
      const rate = Math.round((withGloss.length / sample.length) * 100);
      glossReport = `${withGloss.length}/${sample.length} (${rate}%)`;
      console.log(`  gloss 성공률: ${glossReport}`);
    }

    // 비용 추정: gloss 를 아직 안 구했으므로 평균 gloss 길이(60자 ascii)로 대입.
    // gloss-sample 을 돌렸다면 그 실측 평균 길이를 쓴다.
    let avgEnLen = 60;
    if (GLOSS_SAMPLE && lastGlossSample && lastGlossSample.length) {
      avgEnLen = Math.round(lastGlossSample.reduce((n, g) => n + g.en.length, 0) / lastGlossSample.length);
    }
    const PLACEHOLDER_EN = "x".repeat(avgEnLen);
    const batches = Math.ceil(need.length / BATCH);
    let estPrompt = 0, estCompletion = 0;
    for (let i = 0; i < need.length; i += BATCH) {
      const slice = need.slice(i, i + BATCH).map((t) => ({ word: t.word, reading: t.wr, en: PLACEHOLDER_EN }));
      estPrompt += estTokens(buildPrompt(slice));
      estCompletion += slice.length * 32;   // "단어":"한국어뜻" 어림 (최대 30자)
    }
    const usdIn = (estPrompt / 1e6) * PRICE_IN_PER_M;
    const usdOut = (estCompletion / 1e6) * PRICE_OUT_PER_M;

    console.log(`\n── DRY-RUN 추정 ──`);
    console.log(`  총 대상 단어      ${totalUnique}개 (중복 제거 후)`);
    console.log(`  이미 번역됨       ${alreadyDone.length}개`);
    console.log(`  이번에 번역       ${need.length}개`);
    console.log(`  배치 수           ${batches}개 (BATCH=${BATCH})`);
    console.log(`  추정 토큰         입력 ~${estPrompt.toLocaleString()} · 출력 ~${estCompletion.toLocaleString()}`);
    console.log(`  추정 비용         ${fmtCost(usdIn, usdOut)}`);
    if (glossReport) console.log(`  gloss 표본 성공률 ${glossReport}`);
    console.log(`\n  ※ gloss 미수집분·재요청은 미반영 — 실제 비용은 이 값 근처에서 변동.`);

    sum(`## 약점 단어 번역 (DRY-RUN)`);
    sum(`| 항목 | 값 |`);
    sum(`| --- | --- |`);
    sum(`| 총 대상 단어 (중복 제거) | ${totalUnique} |`);
    sum(`| 이미 번역됨 | ${alreadyDone.length} |`);
    sum(`| 이번에 번역 | ${need.length} |`);
    sum(`| 배치 수 (BATCH=${BATCH}) | ${batches} |`);
    sum(`| 추정 토큰 (입력/출력) | ~${estPrompt.toLocaleString()} / ~${estCompletion.toLocaleString()} |`);
    sum(`| 추정 비용 | ${fmtCost(usdIn, usdOut)} |`);
    if (glossReport) sum(`| gloss 표본 성공률 | ${glossReport} |`);
    return;
  }

  // ---- 2b) gloss 수집 ----
  console.log(`\n── 3) kanjiapi.dev gloss 수집 (동시 ${GLOSS_CONCURRENCY}) ──`);
  const { withGloss, noGloss } = await collectGlosses(need, (d, tot) => {
    process.stdout.write(`\r  ${d}/${tot} …`);
  });
  process.stdout.write("\r");
  console.log(`  gloss 확보 ${withGloss.length}개 · gloss 없음 ${noGloss.length}개`);
  if (noGloss.length) console.log(`  (gloss 없음: ${noGloss.slice(0, 30).join(", ")}${noGloss.length > 30 ? " …" : ""})`);
  if (!withGloss.length) die("gloss 를 구한 단어가 0개입니다 — 중단합니다.");

  // ---- 3~5) 배치 번역 ----
  const batches = [];
  for (let i = 0; i < withGloss.length; i += BATCH) batches.push(withGloss.slice(i, i + BATCH));
  console.log(`\n── 4) 번역 (${batches.length}배치 · BATCH=${BATCH}) ──`);

  const resultWords = { ...existing };
  const failedAll = [];
  const usageTotal = { prompt_tokens: 0, completion_tokens: 0 };
  let newCount = 0;

  const buildPayload = () => ({
    version: 1,
    model: MODEL,
    updatedAt: new Date().toISOString(),
    words: resultWords,
  });

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    process.stdout.write(`  배치 ${b + 1}/${batches.length} (${batch.length}개) … `);
    const { ok, failed, usage } = await translateBatch(batch);
    usageTotal.prompt_tokens += usage.prompt_tokens;
    usageTotal.completion_tokens += usage.completion_tokens;
    for (const t of batch) {
      if (ok[t.word] != null) {
        resultWords[t.word] = { wr: t.reading, en: t.en, ko: ok[t.word] };
        newCount++;
      }
    }
    for (const f of failed) failedAll.push(f);
    console.log(`완료 (성공 ${Object.keys(ok).length} · 실패 ${failed.length})`);

    if ((b + 1) % SAVE_EVERY === 0 && b + 1 < batches.length) {
      try {
        await gistPatchKo(buildPayload());
        console.log(`    · 중간 저장 (${Object.keys(resultWords).length}개)`);
      } catch (e) {
        console.warn(`    · 중간 저장 실패 (계속): ${e.message}`);
      }
    }
    await sleep(300);
  }

  // ---- 최종 저장 ----
  await gistPatchKo(buildPayload());
  console.log(`\n✓ ${KO_FILE} 최종 저장 · 총 ${Object.keys(resultWords).length}개`);

  // ---- 요약 ----
  const elapsed = ((Date.now() - startedAt) / 1000);
  const usdIn = (usageTotal.prompt_tokens / 1e6) * PRICE_IN_PER_M;
  const usdOut = (usageTotal.completion_tokens / 1e6) * PRICE_OUT_PER_M;

  console.log(`\n── 실행 요약 ──────────────────────────────`);
  console.log(`총 대상 단어(중복 제거)  ${totalUnique}개`);
  console.log(`이번 대상               ${wordList.length}개`);
  console.log(`신규 번역               ${newCount}개`);
  console.log(`건너뜀(이미 있음)       ${alreadyDone.length}개`);
  console.log(`gloss 없음              ${noGloss.length}개`);
  console.log(`검증 실패(제외)         ${failedAll.length}개`);
  console.log(`배치 수                 ${batches.length}개`);
  console.log(`소요 시간               ${elapsed.toFixed(1)}s`);
  console.log(`누적 토큰               입력 ${usageTotal.prompt_tokens.toLocaleString()} · 출력 ${usageTotal.completion_tokens.toLocaleString()}`);
  console.log(`추정 비용               ${fmtCost(usdIn, usdOut)}`);
  console.log(`──────────────────────────────────────────`);
  if (noGloss.length) console.log(`gloss 없음 단어: ${noGloss.join(", ")}`);
  if (failedAll.length) {
    console.log(`검증 실패 단어:`);
    for (const f of failedAll) console.log(`  · ${f.word} — ${f.issues.join(", ")}`);
  }

  // ---- $GITHUB_STEP_SUMMARY ----
  sum(`## 약점 단어 한국어 뜻 생성`);
  sum(`| 항목 | 값 |`);
  sum(`| --- | --- |`);
  sum(`| 모델 | \`${MODEL}\` |`);
  sum(`| 총 대상 단어 (중복 제거) | ${totalUnique} |`);
  sum(`| 이번 대상 | ${wordList.length} |`);
  sum(`| 신규 번역 | ${newCount} |`);
  sum(`| 건너뜀 (이미 있음) | ${alreadyDone.length} |`);
  sum(`| gloss 없음 | ${noGloss.length} |`);
  sum(`| 검증 실패 (제외) | ${failedAll.length} |`);
  sum(`| 배치 수 (BATCH=${BATCH}) | ${batches.length} |`);
  sum(`| 소요 시간 | ${elapsed.toFixed(1)}s |`);
  sum(`| 누적 토큰 (입력/출력) | ${usageTotal.prompt_tokens.toLocaleString()} / ${usageTotal.completion_tokens.toLocaleString()} |`);
  sum(`| 추정 비용 | ${fmtCost(usdIn, usdOut)} |`);
  sum(`| \`${KO_FILE}\` 총 단어 수 | ${Object.keys(resultWords).length} |`);
  sum("");

  const samples = Object.entries(resultWords)
    .filter(([w]) => withGloss.some((g) => g.word === w))
    .slice(0, 20);
  if (samples.length) {
    sum(`### 번역 샘플 20개`);
    sum(`| 단어 | 읽기 | EN | KO |`);
    sum(`| --- | --- | --- | --- |`);
    for (const [w, v] of samples) {
      sum(`| ${w} | ${v.wr || ""} | ${String(v.en || "").replace(/\|/g, "/")} | ${String(v.ko || "").replace(/\|/g, "/")} |`);
    }
    sum("");
  }
  if (noGloss.length) {
    sum(`<details><summary>gloss 없음 ${noGloss.length}개</summary>`);
    sum("");
    sum(noGloss.join(", "));
    sum("");
    sum(`</details>`);
  }
  if (failedAll.length) {
    sum(`<details><summary>검증 실패 ${failedAll.length}개 (결과에서 제외)</summary>`);
    sum("");
    for (const f of failedAll) sum(`- **${f.word}** — ${f.issues.join(", ")}`);
    sum("");
    sum(`</details>`);
  }
}

main()
  .then(flushSummary)
  .catch((e) => { flushSummary(); die(e && e.stack ? e.stack : String(e)); });
