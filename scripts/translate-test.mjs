#!/usr/bin/env node
// ===== 번역 모델 bake-off — 일본어 단어의 영어 뜻 → 한국어 짧은 뜻 =====
//
// 목적: "영어 gloss 를 사전 표제어 스타일의 짧은 한국어 뜻으로 옮기는" 작업에서
//       어느 OpenRouter 모델이 쓸 만한지 로그만 보고 눈으로 판단할 수 있게 한다.
//
// 이 스크립트는 GitHub Actions 의 workflow_dispatch 로만 돈다 (translate-test.yml).
// OPENROUTER_KEY 는 Actions secret 에만 있고 로컬엔 없다 → 결과는 Actions 로그 +
// run 요약($GITHUB_STEP_SUMMARY) 으로 확인.
//
// 공용 로직(gist 로드 · kanjiapi gloss · 프롬프트 · 호출 · 검증)은 translate-lib.mjs.
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
//   GITHUB_STEP_SUMMARY  (Actions 가 세팅) 있으면 요약표를 여기에도 쓴다.
//
// 로컬 검증(키 없이 도달 가능한 데까지):
//   node scripts/translate-test.mjs            → gist 로드 · gloss 수집 · 프롬프트 출력
//   node --check scripts/translate-test.mjs    → 문법 체크

import { appendFileSync } from "node:fs";
import {
  sleep, pad, weakRawUrl, loadWeak, fetchKanjiWords, glossFor, buildPrompt,
  callModel, checkKoValue,
} from "./translate-lib.mjs";

const DEFAULT_MODELS = [
  "openai/gpt-5.6-luna",
  "google/gemini-3.7-flash",
  "deepseek/deepseek-v4-flash-0731",
];

const WEAK_RAW_URL = process.env.WEAK_RAW_URL || weakRawUrl();

const OPENROUTER_KEY = process.env.OPENROUTER_KEY || "";
const COUNT = (() => {
  const n = parseInt(process.env.COUNT || "10", 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
})();
const MODELS = (process.env.MODELS || DEFAULT_MODELS.join(","))
  .split(",").map((s) => s.trim()).filter(Boolean);

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

// unknown 앞에서부터 스캔하며 "gloss 가 있는" 항목을 COUNT 개 모은다.
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

// ---------- 5) 자동 검증 ----------
function validate(parsed, targets) {
  const rows = [];
  let pass = 0;
  for (const t of targets) {
    const v = parsed[t.word];
    const issues = checkKoValue(v);
    const ok = issues.length === 0;
    if (ok) pass++;
    rows.push({ word: t.word, value: typeof v === "string" ? v : "", ok, issues });
  }
  const extra = Object.keys(parsed).filter((k) => !targets.some((t) => t.word === k));
  return { rows, pass, total: targets.length, extra };
}

const shortModel = (m) => m.length > 20 ? "…" + m.slice(-19) : m;

function printComparison(targets, results) {
  const live = MODELS.filter((m) => results[m] && results[m].parsed);
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

// run 요약 페이지용 마크다운.
function writeSummary(targets, results) {
  sum(`## 번역 모델 bake-off`);
  sum(`- 대상 단어: **${targets.length}개** · 모델 ${MODELS.length}개`);
  sum(`- 소스: \`${WEAK_RAW_URL}\``);
  sum("");
  sum(`### 모델별 결과`);
  sum(`| 모델 | 결과 | 검증 통과 | 시간 | 토큰 (in/out) |`);
  sum(`| --- | --- | --- | --- | --- |`);
  for (const m of MODELS) {
    const r = results[m];
    if (!r) { sum(`| \`${m}\` | 건너뜀 (ID 확인 실패) | – | – | – |`); continue; }
    if (r.error) { sum(`| \`${m}\` | ❌ 실패 | – | – | ${String(r.error).slice(0, 60).replace(/\|/g, "/")} |`); continue; }
    const u = r.usage || {};
    const tok = u.prompt_tokens != null ? `${u.prompt_tokens} / ${u.completion_tokens ?? "?"}` : "?";
    sum(`| \`${m}\` | ✅ 성공 | ${r.pass}/${r.total} (${Math.round((r.pass / r.total) * 100)}%) | ${(r.ms / 1000).toFixed(1)}s | ${tok} |`);
  }
  sum("");
  const live = MODELS.filter((m) => results[m] && results[m].parsed);
  sum(`### 번역 비교 (${targets.length}개)`);
  sum(`| 단어 | 읽기 | EN | ${live.map((m) => `\`${shortModel(m)}\``).join(" | ")} |`);
  sum(`| --- | --- | --- | ${live.map(() => "---").join(" | ")} |`);
  for (const t of targets) {
    const cells = live.map((m) => {
      const v = results[m].parsed[t.word];
      return (typeof v === "string" ? v : v === undefined ? "‹키 없음›" : JSON.stringify(v)).replace(/\|/g, "/");
    });
    sum(`| ${t.word} | ${t.reading} | ${String(t.en).replace(/\|/g, "/")} | ${cells.join(" | ")} |`);
  }
  sum("");
  // 검증 실패 상세
  const anyBad = MODELS.some((m) => results[m] && results[m].rows && results[m].rows.some((x) => !x.ok));
  if (anyBad) {
    sum(`### 검증 실패 상세`);
    for (const m of MODELS) {
      const r = results[m];
      if (!r || !r.rows) continue;
      const bad = r.rows.filter((x) => !x.ok);
      for (const b of bad) sum(`- \`${m}\` · **${b.word}**: "${b.value}" — ${b.issues.join(", ")}`);
    }
  }
}

// ---------- 메인 ----------
async function main() {
  console.log(`번역 모델 bake-off · COUNT=${COUNT} · 모델 ${MODELS.length}개`);
  console.log(`요청 모델: ${MODELS.join(", ")}`);

  // 1) 약점 데이터
  console.log(`\n── 1) n1-weak.json 로드 ── ${WEAK_RAW_URL}`);
  const { data, unknown } = await loadWeak(WEAK_RAW_URL);
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
      results[m] = null;
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
      const { parsed, ms, usage } = await callModel(m, prompt, { key: OPENROUTER_KEY, title: "N1 Translate Test" });
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
  writeSummary(targets, results);
}

main()
  .then(flushSummary)
  .catch((e) => { flushSummary(); die(e && e.stack ? e.stack : String(e)); });
