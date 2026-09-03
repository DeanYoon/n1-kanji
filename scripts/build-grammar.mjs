#!/usr/bin/env node
// ===== JLPT 문법 데이터셋 빌더 (build-grammar.mjs) =====
//
// 소스: tristcoil/hanabira.org (MIT) 의 레벨별 문법 JSON.
//   https://raw.githubusercontent.com/tristcoil/hanabira.org/main/backend/express/json_data/grammar_ja_JLPT_<LEVEL>_0001.json
// 실측 개수: N1 245 / N2 191 / N3 132 = 568.
//
// 하는 일:
//   1) N1·N2·N3 원본 JSON 을 받아 배열로 읽는다.
//   2) 카드에 쓸 필드만 남겨 가볍게 정리한다:
//        · id      = "<레벨>-<3자리 순번>" (레벨 안 원본 순서 유지). N3 에 동일 title 이
//                    있으므로 title 을 키로 쓰지 않는다.
//        · title   = 뒤에 붙은 "로마자 괄호" 제거. 예 "A うが B うが (A uga B uga)" → "A うが B うが".
//                    괄호 안에 일본어(가나·한자)가 있거나 로마자 글자가 하나도 없거나
//                    형태가 다르면(중첩 괄호 등) 원문 유지.
//        · formation, short(=short_explanation)
//        · examples = 앞에서 2개만. 각 { jp, en }.
//   3) 버리는 것 (의도적):
//        · examples[].romaji, examples[].grammar_audio — 용량만 먹고 카드에서 안 씀.
//        · long_explanation — 카드에 안 쓰고, 2단계 한국어 번역 비용만 키운다.
//        · p_tag, s_tag — 이 데이터셋에서 안 씀.
//   4) 정리 결과를 n1-grammar.json 형태로 만들어 Gist 에 저장(토큰 있을 때)하거나
//      stdout 요약만 출력(토큰 없음 / --dry-run).
//
// 이 스크립트는 AI 를 전혀 쓰지 않는다 (OPENROUTER_KEY 불필요).
//
// 플래그 / 환경변수:
//   --dry-run          Gist 쓰기 없이 요약만 (GIST_TOKEN 이 없어도 자동 dry-run).
//   --emit <path>      정리된 JSON 전체를 로컬 파일로도 저장 (검증용).
//   GIST_TOKEN         (Gist 쓰기에 필요) gist scope PAT.
//   GIST_ID            기본 3c7a0d99f309aa0dfea3861a7df296d4
//   GRAMMAR_SOURCE_TMPL  소스 URL 템플릿 오버라이드 (<LEVEL> 치환).
//
// 로컬 검증:
//   node --check scripts/build-grammar.mjs
//   node scripts/build-grammar.mjs --dry-run --emit /tmp/n1-grammar.json

import { appendFileSync, writeFileSync } from "node:fs";
import { DEFAULT_GIST_ID } from "./translate-lib.mjs";

const LEVELS = ["N1", "N2", "N3"];
const EXPECTED = { N1: 245, N2: 191, N3: 132 };

const SOURCE_TMPL = process.env.GRAMMAR_SOURCE_TMPL
  || "https://raw.githubusercontent.com/tristcoil/hanabira.org/main/backend/express/json_data/grammar_ja_JLPT_<LEVEL>_0001.json";
const SOURCE_LABEL = "tristcoil/hanabira.org (MIT)";

const GIST_TOKEN = process.env.GIST_TOKEN || "";
const GIST_ID = process.env.GIST_ID || DEFAULT_GIST_ID;
const GRAMMAR_FILE = "n1-grammar.json";
const GH = "https://api.github.com/gists/" + GIST_ID;

const DRY_RUN = process.argv.includes("--dry-run") || !GIST_TOKEN;
const EMIT_PATH = (() => {
  const i = process.argv.indexOf("--emit");
  return i >= 0 ? process.argv[i + 1] || "" : "";
})();

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

// ---------- title 로마자 괄호 제거 ----------
// 가나(U+3040–U+30FF) · CJK 한자(U+4E00–U+9FFF) · 반각가나(U+FF66–U+FF9F)
const CJK_RE = /[぀-ヿ㐀-鿿ｦ-ﾟ]/;

// 뒤에 붙은 (…) 또는 （…） 한 덩어리를, 그 안이 "로마자"일 때만 떼어낸다.
// 로마자 = 가나·한자 없음 + 라틴 글자 최소 1개. 중첩 괄호는 형태가 다르므로 건드리지 않음.
function stripRomajiParen(title) {
  const m = String(title).match(/^(.*?)\s*[(（]([^()（）]*)[)）]\s*$/);
  if (!m) return { title, stripped: false };
  const inner = m[2];
  if (CJK_RE.test(inner) || !/[A-Za-z]/.test(inner)) return { title, stripped: false };
  return { title: m[1].trim(), stripped: true };
}

// ---------- 소스 로드 ----------
async function fetchLevel(level, retries = 2) {
  const url = SOURCE_TMPL.replace("<LEVEL>", level);
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "n1-build-grammar" } });
      if (res.ok) {
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error("응답이 배열이 아님");
        return data;
      }
      if (attempt === retries) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      if (attempt === retries) throw new Error(`${level} 로드 실패 (${url}): ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }
}

// ---------- 정리 ----------
function buildItems(level, raw, report) {
  const items = [];
  raw.forEach((src, i) => {
    const id = `${level}-${String(i + 1).padStart(3, "0")}`;
    const rawTitle = src.title || "";
    const { title, stripped } = stripRomajiParen(rawTitle);
    if (stripped) report.stripped[level]++;
    if (i === 0) report.titleSamples.push({ id, from: rawTitle, to: title });

    const exSrc = Array.isArray(src.examples) ? src.examples : [];
    report.srcExDist[Math.min(exSrc.length, 4)]++;
    const examples = exSrc.slice(0, 2).map((e) => ({
      jp: String(e && e.jp || "").trim(),
      en: String(e && e.en || "").trim(),
    }));
    report.builtExDist[examples.length] = (report.builtExDist[examples.length] || 0) + 1;
    if (examples.length !== 2) report.thinExamples.push(id);

    items.push({
      id,
      level,
      title,
      formation: String(src.formation || "").trim(),
      short: String(src.short_explanation || "").trim(),
      examples,
    });
  });
  return items;
}

// ---------- Gist I/O ----------
function ghHeaders() {
  const h = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "n1-build-grammar",
  };
  if (GIST_TOKEN) h.Authorization = "Bearer " + GIST_TOKEN;
  return h;
}

async function gistPatch(payload) {
  const res = await fetch(GH, {
    method: "PATCH",
    headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ files: { [GRAMMAR_FILE]: { content: JSON.stringify(payload, null, 2) } } }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gist PATCH HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
}

// ---------- 메인 ----------
async function main() {
  console.log(`JLPT 문법 데이터셋 빌드${DRY_RUN ? " · DRY-RUN (Gist 쓰기 없음)" : ""}`);
  console.log(`소스: ${SOURCE_LABEL}`);

  const report = {
    stripped: { N1: 0, N2: 0, N3: 0 },
    srcExDist: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },   // 원본 예문 개수 분포
    builtExDist: {},                                // 정리 후 예문 개수 분포
    thinExamples: [],
    titleSamples: [],                               // 레벨별 첫 항목의 title 원본→정리
  };

  const allItems = [];
  const counts = {};
  for (const level of LEVELS) {
    process.stdout.write(`  ${level} 로드 … `);
    const raw = await fetchLevel(level);
    console.log(`${raw.length}개`);
    if (raw.length !== EXPECTED[level]) {
      console.warn(`    ⚠ 예상 ${EXPECTED[level]}개와 다름 (${raw.length}개) — 계속 진행`);
    }
    const items = buildItems(level, raw, report);
    counts[level] = items.length;
    allItems.push(...items);
  }
  counts.total = allItems.length;

  // ---- 검증: id 중복 ----
  const idSet = new Set();
  const dupIds = [];
  for (const it of allItems) {
    if (idSet.has(it.id)) dupIds.push(it.id);
    idSet.add(it.id);
  }

  const payload = {
    version: 1,
    source: SOURCE_LABEL,
    builtAt: new Date().toISOString(),
    counts,
    items: allItems,
  };

  if (EMIT_PATH) {
    writeFileSync(EMIT_PATH, JSON.stringify(payload, null, 2));
    console.log(`\n  · 로컬 저장: ${EMIT_PATH}`);
  }

  // ---- 요약 ----
  const strippedTotal = report.stripped.N1 + report.stripped.N2 + report.stripped.N3;
  const exOk = report.thinExamples.length === 0
    && report.builtExDist[2] === counts.total;

  console.log(`\n── 빌드 요약 ──────────────────────────────`);
  console.log(`개수            N1 ${counts.N1} · N2 ${counts.N2} · N3 ${counts.N3} · 합계 ${counts.total}`);
  console.log(`로마자 괄호 제거  ${strippedTotal}건 (N1 ${report.stripped.N1} · N2 ${report.stripped.N2} · N3 ${report.stripped.N3})`);
  console.log(`예문 원본 분포   ${JSON.stringify(report.srcExDist)} (원본은 문법당 4개)`);
  console.log(`정리 후 예문 분포 ${JSON.stringify(report.builtExDist)}`);
  console.log(`정리 후 예문     전부 2개: ${exOk ? "예" : "아니오"}${report.thinExamples.length ? ` (2개 아님: ${report.thinExamples.join(", ")})` : ""}`);
  console.log(`id 중복          ${dupIds.length ? dupIds.join(", ") : "없음"}`);
  console.log(`──────────────────────────────────────────`);

  // 샘플: title 원본 → 정리 (레벨별 첫 항목) + 정리된 항목 전체 2개
  console.log(`\n── title 정리 샘플 ──`);
  for (const t of report.titleSamples) {
    console.log(`  ${t.id}  ${JSON.stringify(t.from)}  →  ${JSON.stringify(t.to)}`);
  }
  console.log(`\n── 정리된 항목 샘플 2개 ──`);
  const samples = [allItems[0], allItems[counts.N1 + counts.N2]]; // N1 첫 항목 + N3 첫 항목
  for (const s of samples) {
    console.log(JSON.stringify(s, null, 2));
  }

  sum(`## JLPT 문법 데이터셋 빌드${DRY_RUN ? " (DRY-RUN)" : ""}`);
  sum(`| 항목 | 값 |`);
  sum(`| --- | --- |`);
  sum(`| 소스 | ${SOURCE_LABEL} |`);
  sum(`| 개수 | N1 ${counts.N1} · N2 ${counts.N2} · N3 ${counts.N3} · 합계 **${counts.total}** |`);
  sum(`| 로마자 괄호 제거 | ${strippedTotal}건 (N1 ${report.stripped.N1} / N2 ${report.stripped.N2} / N3 ${report.stripped.N3}) |`);
  sum(`| 정리 후 예문 2개 | ${exOk ? "예" : `아니오 (${report.thinExamples.join(", ")})`} |`);
  sum(`| id 중복 | ${dupIds.length ? dupIds.join(", ") : "없음"} |`);
  sum("");
  sum(`### title 정리 샘플`);
  for (const t of report.titleSamples) sum(`- \`${t.id}\` \`${t.from}\` → \`${t.to}\``);
  sum("");
  sum(`### 정리된 항목 샘플`);
  for (const s of samples) {
    sum("```json");
    sum(JSON.stringify(s, null, 2));
    sum("```");
  }

  if (dupIds.length) die(`id 중복 발견: ${dupIds.join(", ")}`);

  // ---- Gist 저장 ----
  if (DRY_RUN) {
    console.log(`\nDRY-RUN — Gist(${GRAMMAR_FILE}) 쓰기 생략.`);
    return;
  }
  await gistPatch(payload);
  console.log(`\n✓ Gist ${GRAMMAR_FILE} 저장 · ${counts.total}개 항목`);
  sum("");
  sum(`✓ Gist \`${GRAMMAR_FILE}\` 저장 완료 (${counts.total}개).`);
}

main()
  .then(flushSummary)
  .catch((e) => { flushSummary(); die(e && e.stack ? e.stack : String(e)); });
