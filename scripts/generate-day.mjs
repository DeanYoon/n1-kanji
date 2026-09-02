#!/usr/bin/env node
// ===== N1 한자 학습 · 클라우드 하루치 생성기 =====
// GitHub Actions(또는 아무 Node 20+ 환경)에서 하루 한 번 실행. 폰이 꺼져 있거나
// 인터넷이 없어도, 그날 09:00~23:00 슬롯이 미리 만들어져 Gist 에 올라가 있게 한다.
//
// 이 스크립트가 하는 일 (= "생성"만):
//   1) Gist 에서 상태(n1-state.json) 를 읽는다. 없으면 레포 커리큘럼(n1.SEED)으로 초기화.
//   2) n1.planDay() 로 오늘치 슬롯 계획을 세운다 — 폰의 day() 와 "완전히 같은" 규칙·함수.
//   3) 신규 한자는 OpenRouter 로 예문 생성(n1.compose). 실패 시 지수 백오프 3회 재시도,
//      그래도 안 되면 그 칸은 복습으로 대체하고 계속.
//   4) 결과를 {date, slots:[{key,title,body}], updatedAt} 로 Gist 의 n1-today.json 에 PATCH.
//   5) 전진된 상태를 Gist 의 n1-state.json 에 PATCH.
//
// 아직 폰이 담당하는 것: review "외웠음" 체크 등 상태 쓰기, 로컬 알림 예약, 위젯.
// (상태 이전은 다음 단계 — 지금은 클라우드가 자기 상태를 Gist 에 따로 들고 간다.)
//
// 주말(KST 토·일)에는 신규 생성을 하지 않는다 — AI 호출 0회, 진도 0 전진, 전량 복습.
// 배치 자체는 매일 돌린다(크론은 그대로 매일). 주말에도 알림은 평소대로 와야 하므로,
// n1.planDay() 에 cfg.PAUSE_NEW 를 세워 그날 57칸을 전부 복습으로 채운다.
// 요일은 process.env.TZ=Asia/Seoul 이 보장되므로 new Date().getDay() 를 그대로 쓴다
// (0=일 … 6=토). 테스트용으로 FORCE_DOW 환경변수(0~6)로 요일을 주입할 수 있다.
//
// 플래그:
//   --dry-run       API 호출·PATCH 없이 계획만 출력 (슬롯 그리드·신규/복습 배치 확인용).
//   --force         오늘 이미 계획했더라도 다시 만든다 (기본은 중복 실행 시 건너뜀).
//   --new-anyway    주말이라도 신규 생성을 강행한다 (주말 스킵 무시). IGNORE_WEEKEND=1 도 동일.
//
// 환경변수:
//   OPENROUTER_KEY        (필수, --dry-run 이면 불필요)
//   GIST_TOKEN            (필수, --dry-run 이면 불필요) — gist scope PAT
//   GIST_ID              기본 3c7a0d99f309aa0dfea3861a7df296d4
//   MODEL                기본 openai/gpt-5.6-sol
//   TZ                   기본 Asia/Seoul
//   INIT_PROGRESS_INDEX  상태가 아예 없을 때의 시작 진도 (기본 0)
//   IGNORE_WEEKEND       "1" 이면 주말 신규 스킵을 무시 (--new-anyway 와 동일)
//   FORCE_DOW            테스트 전용 — 0~6 으로 요일을 주입 (미지정 시 실제 KST 요일)

process.env.TZ = process.env.TZ || "Asia/Seoul";

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const n1 = require("../n1.js");   // 폰과 같은 로직 모듈 (CJS). 순수 함수만 재사용.

// ---------- 설정 ----------
const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const NEW_ANYWAY = process.argv.includes("--new-anyway") || process.env.IGNORE_WEEKEND === "1";
const DEFAULT_GIST_ID = "3c7a0d99f309aa0dfea3861a7df296d4";

// KST 요일 (0=일 … 6=토). TZ=Asia/Seoul 이 위에서 보장됨. 테스트는 FORCE_DOW 로 주입.
const DOW = (process.env.FORCE_DOW != null && process.env.FORCE_DOW !== "")
  ? parseInt(process.env.FORCE_DOW, 10)
  : new Date().getDay();
const IS_WEEKEND = DOW === 0 || DOW === 6;
const PAUSE_NEW = IS_WEEKEND && !NEW_ANYWAY;
const DOW_KR = ["일", "월", "화", "수", "목", "금", "토"][DOW] || "?";

const cfg = {
  OPENROUTER_KEY: process.env.OPENROUTER_KEY || "",
  GIST_TOKEN: process.env.GIST_TOKEN || "",
  GIST_ID: process.env.GIST_ID || DEFAULT_GIST_ID,
  MODEL: process.env.MODEL || "openai/gpt-5.6-sol",
  // 폰의 day() 기본값과 동일 (planDay 가 읽는 키): START_HOUR 9 · END_HOUR 23 ·
  // INTERVAL_MIN 15 · NEW_EVERY_MIN 30 · REPS_PER_KANJI 2. 필요하면 여기서 덮어쓰기.
  // PAUSE_NEW: 주말이면 planDay() 가 신규 0 · 전량 복습으로 계획하게 한다.
  PAUSE_NEW: PAUSE_NEW,
};

const STATE_FILE = "n1-state.json";
const TODAY_FILE = "n1-today.json";
const GH = "https://api.github.com/gists/" + cfg.GIST_ID;

function die(msg) {
  console.error("✗ " + msg);
  process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Gist I/O (Node 전용 — 폰은 n1.js 안에 자체 경로가 있음) ----------
async function gistGet() {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "n1-kanji-generate-day",
  };
  if (cfg.GIST_TOKEN) headers.Authorization = "Bearer " + cfg.GIST_TOKEN;
  const res = await fetch(GH, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gist GET HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const meta = await res.json();
  const out = {};
  for (const name of [STATE_FILE, TODAY_FILE]) {
    const f = meta.files && meta.files[name];
    if (!f) { out[name] = null; continue; }
    out[name] = f.truncated && f.raw_url
      ? await (await fetch(f.raw_url, { headers })).text()
      : f.content;
  }
  return out;
}

async function gistPatch(files) {
  const fileObj = {};
  for (const [k, v] of Object.entries(files)) fileObj[k] = { content: v };
  const res = await fetch(GH, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer " + cfg.GIST_TOKEN,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "n1-kanji-generate-day",
    },
    body: JSON.stringify({ files: fileObj }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gist PATCH HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
}

// ---------- 상태 준비 ----------
function freshState() {
  const s = JSON.parse(JSON.stringify(n1.SEED));
  const p = parseInt(process.env.INIT_PROGRESS_INDEX || "0", 10);
  s.progressIndex = Number.isFinite(p) && p >= 0 ? p : 0;
  s.history = [];
  s.pending = [];
  return s;
}

function normalizeState(raw) {
  let s;
  try { s = JSON.parse(raw); }
  catch (e) { throw new Error("n1-state.json 파싱 실패: " + e.message); }
  if (!s || !Array.isArray(s.kanjiList) || !s.kanjiList.length) {
    throw new Error("n1-state.json 에 kanjiList 가 없음 — 손상된 상태");
  }
  if (!Array.isArray(s.history)) s.history = [];
  if (!Array.isArray(s.pending)) s.pending = [];
  if (typeof s.progressIndex !== "number") s.progressIndex = 0;
  if (typeof s.cycle !== "number") s.cycle = 1;
  if (typeof s.kanjiRepCount !== "number") s.kanjiRepCount = 0;
  return s;
}

// ---------- 신규 예문 생성기 (planDay 에 주입) ----------
const stats = { apiCalls: 0, apiFails: 0, fallbackSlots: 0 };
const newKanji = [];

// dry-run: OpenRouter 를 안 부르고 가짜 예문으로 커리큘럼만 전진 (n1.commitNewEntry 재사용).
function dryComposer(c, s, slotISO, idSuffix) {
  const kanji = s.kanjiList[s.progressIndex];
  const cur = n1.commitNewEntry(c, s, slotISO, idSuffix, kanji, {
    sentenceJP: `「${kanji}」を使った例文（dry-run）`,
    readingHiragana: "",
    translationKR: "(dry-run · 예문 미생성)",
    furigana: null,
    kanjiNotes: [{ word: kanji, reading: "", meaningKR: "(dry-run)" }],
    grammarNotes: [],
  });
  newKanji.push(cur.targetKanji);
  return cur;
}

// 실제: n1.composeNewEntry(= compose + commit) 를 지수 백오프 3회 재시도로 감쌈.
async function realComposer(c, s, slotISO, idSuffix) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    stats.apiCalls++;
    try {
      const cur = await n1.composeNewEntry(c, s, slotISO, idSuffix);
      newKanji.push(cur.targetKanji);
      return cur;
    } catch (e) {
      lastErr = e;
      stats.apiFails++;
      console.warn(`  · 예문 생성 실패 (시도 ${attempt}/3): ${e.message}`);
      if (attempt < 3) await sleep(1000 * 2 ** (attempt - 1)); // 1s → 2s
    }
  }
  throw lastErr;
}

// ---------- 메인 ----------
async function main() {
  const today = n1.dateJST();
  console.log(`N1 클라우드 생성기 · ${today}(${DOW_KR}) · TZ=${process.env.TZ}${DRY_RUN ? " · DRY-RUN" : ""}`);
  if (PAUSE_NEW) {
    console.log(`주말(${DOW_KR}) — 신규 생성 건너뜀(전량 복습). API 0회 · 진도 0 전진.`);
  } else if (IS_WEEKEND && NEW_ANYWAY) {
    console.log(`주말(${DOW_KR})이지만 --new-anyway/IGNORE_WEEKEND=1 → 신규 생성 강행.`);
  }

  if (!DRY_RUN) {
    if (!cfg.OPENROUTER_KEY) die("OPENROUTER_KEY 환경변수가 없습니다.");
    if (!cfg.GIST_TOKEN) die("GIST_TOKEN 환경변수가 없습니다.");
  }

  // ---- 1) 상태 로드 ----
  let remoteFiles = { [STATE_FILE]: null, [TODAY_FILE]: null };
  if (DRY_RUN && !cfg.GIST_TOKEN && !process.env.FIXTURE_STATE) {
    console.log("dry-run · Gist 토큰 없음 → 새 상태(SEED)로 계획만 확인합니다.");
  } else if (process.env.FIXTURE_STATE) {
    // 검증용: 로컬 픽스처 파일을 상태로 사용 (실제 Gist 안 건드림).
    const fs = require("node:fs");
    remoteFiles[STATE_FILE] = fs.readFileSync(process.env.FIXTURE_STATE, "utf8");
    console.log(`픽스처 상태 사용: ${process.env.FIXTURE_STATE}`);
  } else {
    try {
      remoteFiles = await gistGet();
    } catch (e) {
      // Gist 읽기 실패 → 쓰기 시도 금지.
      die("Gist 읽기 실패 — 쓰기를 시도하지 않습니다. " + e.message);
    }
  }

  const isFresh = !remoteFiles[STATE_FILE];
  const s = isFresh ? freshState() : normalizeState(remoteFiles[STATE_FILE]);
  console.log(
    `상태: ${isFresh ? "신규(SEED)" : "기존"} · progressIndex ${s.progressIndex}` +
    ` · cycle ${s.cycle} · history ${s.history.length}건`
  );

  // 중복 실행 가드 (수동 재실행 시 커리큘럼이 두 번 전진하는 사고 방지).
  if (!DRY_RUN && !FORCE && s.lastPlannedDate === today) {
    console.log(`이미 오늘(${today}) 계획 완료 — 아무것도 바꾸지 않습니다. 다시 만들려면 --force.`);
    process.exit(0);
  }

  // ---- 2) 지난 예약 반영 + 슬롯 계획 ----
  n1.reconcile(s);
  const planned = await n1.planDay(cfg, s, {
    now: new Date(),
    alreadyKeys: [],
    compose: DRY_RUN ? dryComposer : realComposer,
    newErrorFallback: true,
    onNewError: (err, slot) => {
      stats.fallbackSlots++;
      console.warn(`  · ${slot.key} 신규 생성 최종 실패 → 복습으로 대체: ${err.message}`);
    },
  });

  const slots = n1.sortSlots(planned.plan);

  // ---- 요약 ----
  const uniqNew = [...new Set(newKanji)];
  console.log("");
  console.log("── 실행 요약 ──────────────────────────────");
  if (PAUSE_NEW) console.log(`주말(${DOW_KR})  — 신규 생성 건너뜀(전량 복습)`);
  console.log(`총 슬롯       ${slots.length}칸  (${cfg.START_HOUR ?? 9}:00~${cfg.END_HOUR ?? 23}:00, ${cfg.INTERVAL_MIN ?? 15}분 간격)`);
  console.log(`신규          ${planned.newCount}칸  · 한자 ${uniqNew.length}자: ${uniqNew.join(" ") || "(없음)"}`);
  console.log(`복습          ${planned.reviewCount}칸`);
  console.log(`API 호출      ${stats.apiCalls}회  · 실패(시도) ${stats.apiFails}회  · 복습으로 대체된 칸 ${stats.fallbackSlots}`);
  console.log(`전진 후 진도  progressIndex ${s.progressIndex} / ${s.kanjiList.length} · cycle ${s.cycle}`);
  console.log("──────────────────────────────────────────");

  if (DRY_RUN) {
    console.log("\n[dry-run] 슬롯 계획 샘플 (앞 6 · 뒤 4):");
    const sample = slots.length > 12 ? [...slots.slice(0, 6), null, ...slots.slice(-4)] : slots;
    for (const sl of sample) {
      if (!sl) { console.log("   …"); continue; }
      console.log(`   ${sl.key}  ${sl.title.split("\n")[0]}  | ${String(sl.body).split("\n")[0]}`);
    }
    console.log("\n[dry-run] PATCH 하지 않고 종료.");
    return;
  }

  // ---- 안전장치: 슬롯 0개면 Gist 를 덮어쓰지 않는다 ----
  if (!slots.length) die("슬롯이 0개입니다 — Gist 를 덮어쓰지 않고 중단합니다.");

  // ---- 3) pending 병합 + 상태 마무리 ----
  s.pending = (Array.isArray(s.pending) ? s.pending : []).concat(planned.pending);
  n1.reconcile(s);
  s.lastPlannedDate = today;
  s.updatedAt = n1.nowISO();

  // ---- 4) Gist 업로드 (today 먼저 — 사용자에게 보이는 산출물) ----
  const todayPayload = { date: today, slots, updatedAt: n1.nowISO() };
  await gistPatch({ [TODAY_FILE]: JSON.stringify(todayPayload) });
  console.log(`✓ ${TODAY_FILE} 업로드 · ${slots.length}칸`);

  // ---- 5) 상태 업로드 ----
  await gistPatch({ [STATE_FILE]: JSON.stringify(s) });
  console.log(`✓ ${STATE_FILE} 업로드 · progressIndex ${s.progressIndex}`);

  console.log("\n완료.");
}

main().catch((e) => die(e && e.stack ? e.stack : String(e)));
