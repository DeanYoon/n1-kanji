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
// 주말(KST 토·일) 그리고 일본 공휴일에는 신규 생성을 하지 않는다 — AI 호출 0회,
// 진도 0 전진, 전량 복습. 주말과 공휴일은 완전히 같은 취급이다.
// 배치 자체는 매일 돌린다(크론은 그대로 매일). 그런 날에도 알림은 평소대로 와야 하므로,
// n1.planDay() 에 cfg.PAUSE_NEW 를 세워 그날 57칸을 전부 복습으로 채운다.
// 요일은 process.env.TZ=Asia/Seoul 이 보장되므로 new Date().getDay() 를 그대로 쓴다
// (0=일 … 6=토). 공휴일은 holidays-jp.github.io API(연도별 엔드포인트)를 GET 해서
// 오늘 날짜(KST) 키가 있으면 공휴일로 본다. 振替休日·国民の休日도 포함된다.
//   · API 실패/비정상 응답 → 레포에 커밋해 둔 scripts/jp-holidays.json 하드코딩 목록 사용.
//   · 하드코딩에도 없고 API 도 실패 → 평일로 간주하고 정상 생성 (잘못 쉬어서 진도가 밀리는
//     것보다, 공휴일에 한 번 더 생성되는 쪽이 피해가 적다).
// 테스트용으로 FORCE_DATE(임의 날짜) / FORCE_DOW(요일) 를 주입할 수 있다.
//
// 플래그:
//   --dry-run       API 호출·PATCH 없이 계획만 출력 (슬롯 그리드·신규/복습 배치 확인용).
//   --force         오늘 이미 계획했더라도 다시 만든다 (기본은 중복 실행 시 건너뜀).
//   --new-anyway    주말·공휴일이라도 신규 생성을 강행한다 (달력 스킵 무시).
//                   IGNORE_CALENDAR=1 (또는 하위 호환용 IGNORE_WEEKEND=1) 도 동일.
//
// 환경변수:
//   OPENROUTER_KEY        (필수, --dry-run 이면 불필요)
//   GIST_TOKEN            (필수, --dry-run 이면 불필요) — gist scope PAT
//   GIST_ID              기본 3c7a0d99f309aa0dfea3861a7df296d4
//   MODEL                기본 openai/gpt-5.6-sol
//   TZ                   기본 Asia/Seoul
//   INIT_PROGRESS_INDEX  상태가 아예 없을 때의 시작 진도 (기본 0)
//   IGNORE_CALENDAR      "1" 이면 주말·공휴일 신규 스킵을 무시 (--new-anyway 와 동일)
//   IGNORE_WEEKEND       하위 호환 별칭 — IGNORE_CALENDAR 와 동일
//   WEAK_RATIO           하루 신규 슬롯 중 약점 보강에 배정할 비율 (0~1, 기본 0.5).
//                        약점 데이터(gist n1-weak.json 또는 repo scripts/weak-readings.json)가
//                        없으면 이 값과 무관하게 전량 커리큘럼 — 기존 동작과 100% 동일.
//   FORCE_DATE           테스트 전용 — YYYY-MM-DD 로 기준 날짜를 주입 (주말·공휴일 판정용)
//   FORCE_DOW            테스트 전용 — 0~6 으로 요일을 주입 (FORCE_DATE 미지정 시)
//   HOLIDAY_API_BASE     테스트 전용 — 공휴일 API 베이스 URL 오버라이드 (실패 시뮬레이션용)
//   WEAK_FIXTURE         테스트 전용 — 약점 데이터 JSON 파일 경로를 직접 주입 (gist/repo 대신)

process.env.TZ = process.env.TZ || "Asia/Seoul";

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const n1 = require("../n1.js");   // 폰과 같은 로직 모듈 (CJS). 순수 함수만 재사용.

// ---------- 설정 ----------
const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const NEW_ANYWAY = process.argv.includes("--new-anyway")
  || process.env.IGNORE_CALENDAR === "1"
  || process.env.IGNORE_WEEKEND === "1";   // 하위 호환 별칭
const DEFAULT_GIST_ID = "3c7a0d99f309aa0dfea3861a7df296d4";
const HOLIDAY_API_BASE = process.env.HOLIDAY_API_BASE || "https://holidays-jp.github.io/api/v1";

// 기준 날짜(KST). 테스트로 FORCE_DATE=YYYY-MM-DD 를 주면 그 날짜로 주말·공휴일을 판정.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FORCE_DATE = (process.env.FORCE_DATE || "").trim();
const HAS_FORCE_DATE = DATE_RE.test(FORCE_DATE);
const BASE_DATE = HAS_FORCE_DATE ? FORCE_DATE : n1.dateJST();

// KST 요일 (0=일 … 6=토). 우선순위: FORCE_DATE > FORCE_DOW > 실제(TZ=Asia/Seoul 보장).
// 날짜만 있는 ISO 를 UTC 자정으로 파싱해도 getUTCDay() 요일값은 정확하다.
const DOW = HAS_FORCE_DATE
  ? new Date(BASE_DATE + "T00:00:00Z").getUTCDay()
  : (process.env.FORCE_DOW != null && process.env.FORCE_DOW !== "")
    ? parseInt(process.env.FORCE_DOW, 10)
    : new Date().getDay();
const IS_WEEKEND = DOW === 0 || DOW === 6;
const DOW_KR = ["일", "월", "화", "수", "목", "금", "토"][DOW] || "?";

const cfg = {
  OPENROUTER_KEY: process.env.OPENROUTER_KEY || "",
  GIST_TOKEN: process.env.GIST_TOKEN || "",
  GIST_ID: process.env.GIST_ID || DEFAULT_GIST_ID,
  MODEL: process.env.MODEL || "openai/gpt-5.6-sol",
  // 폰의 day() 기본값과 동일 (planDay 가 읽는 키): START_HOUR 9 · END_HOUR 23 ·
  // INTERVAL_MIN 15 · NEW_EVERY_MIN 30 · REPS_PER_KANJI 2. 필요하면 여기서 덮어쓰기.
  // PAUSE_NEW 는 main() 에서 주말·공휴일 판정 뒤에 세운다 (planDay() 가 신규 0 · 전량
  // 복습으로 계획하게 한다). 공휴일 판정은 네트워크 조회라 async 라서 여기서 못 한다.
  PAUSE_NEW: false,
  // 하루 신규 슬롯 중 약점 보강에 배정할 비율. 약점 큐가 비었거나 약점 데이터 파일이
  // 없으면 자동으로 0 처럼 동작(전량 커리큘럼). WEAK_RATIO 환경변수로 덮어쓸 수 있다.
  WEAK_RATIO: (() => {
    const v = parseFloat(process.env.WEAK_RATIO ?? "");
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.5;
  })(),
};

// ---------- 일본 공휴일 판정 ----------
// 1) holidays-jp.github.io API(연도별 엔드포인트) GET, 10초 타임아웃.
// 2) 실패/비정상 → 레포 커밋된 scripts/jp-holidays.json 하드코딩 목록.
// 3) 둘 다 실패/미수록 → { name:null } (평일로 간주). 잘못 쉬어 진도가 밀리는 것보다
//    공휴일에 한 번 더 생성되는 쪽이 피해가 적다는 판단.
async function resolveHoliday(dateStr) {
  const year = dateStr.slice(0, 4);
  const url = `${HOLIDAY_API_BASE}/${year}/date.json`;
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 10000);
    let map;
    try {
      const res = await fetch(url, { signal: ac.signal, headers: { "User-Agent": "n1-kanji-generate-day" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      map = await res.json();
    } finally { clearTimeout(timer); }
    if (!map || typeof map !== "object" || Array.isArray(map)) throw new Error("비정상 응답(객체 아님)");
    return { name: map[dateStr] || null, source: "api" };
  } catch (e) {
    console.warn(`  · 공휴일 API 조회 실패 (${e.message}) → 하드코딩 목록으로 폴백`);
  }
  try {
    const fs = require("node:fs");
    const map = JSON.parse(fs.readFileSync(new URL("./jp-holidays.json", import.meta.url), "utf8"));
    if (Object.prototype.hasOwnProperty.call(map, dateStr)) return { name: map[dateStr], source: "fallback" };
    if (!Object.keys(map).some((k) => DATE_RE.test(k) && k.startsWith(year))) {
      console.warn(`  · 하드코딩 목록에 ${year}년 데이터 없음 → 평일로 간주`);
    }
    return { name: null, source: "fallback" };
  } catch (e) {
    console.warn(`  · 하드코딩 목록 로드 실패 (${e.message}) → 평일로 간주`);
    return { name: null, source: "none" };
  }
}

const STATE_FILE = "n1-state.json";
const TODAY_FILE = "n1-today.json";
const WEAK_FILE = "n1-weak.json";   // 진단(self-check) 결과 — 있으면 gist GET 응답에서 같이 꺼낸다.
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
  for (const name of [STATE_FILE, TODAY_FILE, WEAK_FILE]) {
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

// ================= 약점(진단) 보강 배관 =================
// 진단 페이지(n3-check.html)가 뱉는 JSON:
//   { version, scope, generatedAt, total, knownCount,
//     unknown: [ { k:"生", r:"しょう", type:"on", words:[ { w:"一生", wr:"いっしょう" } ] } ] }
//
// 데이터 위치(이 순서로 탐색):
//   1) gist 의 n1-weak.json  (이미 GET 한 응답에서 꺼냄 — 추가 호출 0)
//   2) repo 의 scripts/weak-readings.json
//   3) 둘 다 없음 → 약점 기능 완전 비활성, 아래 라우터가 전량 커리큘럼으로 흐름(기존 동작).
//
// 소비 방식:
//   · 상태(n1-state.json)에 weakQueue / weakIndex / weakRepCount 를 둔다.
//     최초 로드 시 unknown 배열을 그대로 큐로 저장(순서 유지). 이미 큐가 있으면
//     k+r 조합으로 중복 판정해 "새로 추가된 항목만" 뒤에 append(재진단 갱신 대응).
//   · 하루 신규 슬롯 중 cfg.WEAK_RATIO(기본 0.5) 비율을 약점 항목에 배정. 약점 큐가
//     비면 전부 커리큘럼. 약점 항목도 REPS_PER_KANJI(현재 2)만큼 반복 후 다음 항목으로.
//   · ⚠️ 약점 항목은 커리큘럼 진도(progressIndex)를 전진시키지 않는다 — 별도 트랙.
//     (n1.commitWeakEntry 가 weakIndex/weakRepCount 만 전진시킨다.)

const weakStats = {
  enabled: false, source: null,
  weakSlots: 0, curriculumSlots: 0, verifyFails: 0, samples: [],
};

// k+r 중복 판정 키.
const weakKey = (it) => `${it.k} ${it.r}`;

// 1)gist → 2)repo → 3)null. 반환: { items:[{k,r,type,words:[{w,wr}]}], source:"gist"|"repo" } | null
function loadWeakReadings(remoteFiles) {
  let raw = null, source = null;
  if (process.env.WEAK_FIXTURE) {
    // 테스트 전용 — FIXTURE_STATE 와 같은 패턴. 실제 gist/repo 를 안 건드림.
    try { raw = require("node:fs").readFileSync(process.env.WEAK_FIXTURE, "utf8"); source = "fixture"; }
    catch (e) { console.warn(`  · WEAK_FIXTURE 읽기 실패 (${e.message}) → 약점 기능 비활성`); return null; }
  }
  if (raw == null && remoteFiles && remoteFiles[WEAK_FILE] && String(remoteFiles[WEAK_FILE]).trim()) {
    raw = remoteFiles[WEAK_FILE]; source = "gist";
  }
  if (raw == null) {
    try {
      raw = require("node:fs").readFileSync(new URL("./weak-readings.json", import.meta.url), "utf8");
      source = "repo";
    } catch { /* 파일 없음 — 정상. 약점 기능 비활성 */ }
  }
  if (raw == null || !String(raw).trim()) return null;

  let data;
  try { data = JSON.parse(raw); }
  catch (e) { console.warn(`  · 약점 파일 파싱 실패 (${e.message}) → 약점 기능 비활성`); return null; }
  const unknown = data && Array.isArray(data.unknown) ? data.unknown : null;
  if (!unknown) { console.warn("  · 약점 파일에 unknown 배열이 없음 → 약점 기능 비활성"); return null; }

  const items = [];
  for (const u of unknown) {
    if (!u || typeof u.k !== "string" || !u.k || typeof u.r !== "string" || !u.r) continue;
    const words = Array.isArray(u.words)
      ? u.words.filter((w) => w && typeof w.w === "string" && w.w)
          .map((w) => ({ w: w.w, wr: typeof w.wr === "string" ? w.wr : "" }))
      : [];
    items.push({ k: u.k, r: u.r, type: (u.type === "on" || u.type === "kun") ? u.type : "", words });
  }
  if (!items.length) { console.warn("  · 약점 파일 unknown 이 비어 있음 → 약점 기능 비활성"); return null; }
  return { items, source };
}

// unknown 항목을 상태의 weakQueue 에 병합. 최초면 통째로, 있으면 새 항목만 append.
// 반환: 이번에 새로 추가된 개수.
function mergeWeakQueue(s, items) {
  if (!Array.isArray(s.weakQueue)) s.weakQueue = [];
  if (typeof s.weakIndex !== "number" || s.weakIndex < 0) s.weakIndex = 0;
  if (typeof s.weakRepCount !== "number" || s.weakRepCount < 0) s.weakRepCount = 0;
  const seen = new Set(s.weakQueue.map(weakKey));
  let added = 0;
  for (const it of items) {
    const key = weakKey(it);
    if (seen.has(key)) continue;
    seen.add(key);
    s.weakQueue.push(it);
    added++;
  }
  return added;
}

// 이 약점 항목(k+r)으로 이미 만든 예문에서 쓴 표제어 — 반복 생성 시 같은 단어 재탕 방지.
function weakPriorWords(s, k, r) {
  const out = [];
  for (const e of (Array.isArray(s.history) ? s.history : [])) {
    if (e && e.targetKanji === k && e.weak && e.weak.r === r) {
      const hw = n1.pickHeadword(e);
      if (hw && hw.word && out.indexOf(hw.word) < 0) out.push(hw.word);
    }
  }
  return out;
}

// 다음 신규 슬롯을 약점에 줄지 판단 — 현재까지의 실제 배정 비율이 목표(WEAK_RATIO)에
// 못 미치면 약점. 약점 큐가 소진됐으면(또는 애초에 없으면) 항상 false → 커리큘럼.
function wantWeakSlot(s) {
  if (!weakStats.enabled) return false;
  if (!Array.isArray(s.weakQueue) || s.weakIndex >= s.weakQueue.length) return false;
  const ratio = cfg.WEAK_RATIO;
  if (!(ratio > 0)) return false;
  const done = weakStats.weakSlots + weakStats.curriculumSlots;
  return weakStats.weakSlots < ratio * (done + 1);
}

// planDay 에 넘길 신규 예문 생성기. 매 신규 슬롯마다 약점/커리큘럼을 갈라서,
// 커리큘럼은 leaf(dry/real Composer) 로 그대로, 약점은 목표 읽기를 강제해 생성.
function makeComposeRouter(leaf) {
  return async function composeRouter(c, s, slotISO, idSuffix) {
    if (wantWeakSlot(s)) return await composeWeakSlot(c, s, slotISO, idSuffix, leaf);
    weakStats.curriculumSlots++;
    return await leaf(c, s, slotISO, idSuffix);
  };
}

async function composeWeakSlot(c, s, slotISO, idSuffix, leaf) {
  const item = s.weakQueue[s.weakIndex];
  if (!item || typeof item.k !== "string" || typeof item.r !== "string") {
    // 손상 항목 — 커서만 넘기고 이 칸은 커리큘럼으로.
    s.weakIndex += 1; s.weakRepCount = 0;
    weakStats.curriculumSlots++;
    return await leaf(c, s, slotISO, idSuffix);
  }
  const target = { r: item.r, type: item.type || "", words: item.words || [] };
  let entry;

  if (DRY_RUN) {
    const w0 = item.words[0];
    entry = n1.commitWeakEntry(c, s, slotISO, idSuffix, item.k, {
      sentenceJP: `「${item.k}」を「${item.r}」と読む例文（dry-run）`,
      readingHiragana: "",
      translationKR: "(dry-run · 약점 예문 미생성)",
      furigana: null,
      kanjiNotes: [{ word: w0 ? w0.w : item.k, reading: w0 ? w0.wr : item.r, meaningKR: "(dry-run)" }],
      grammarNotes: [],
    }, { r: item.r, type: item.type || "" });
  } else {
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
      stats.apiCalls++;
      try {
        const composed = await n1.compose(c, item.k, weakPriorWords(s, item.k, item.r), target);
        entry = n1.commitWeakEntry(c, s, slotISO, idSuffix, item.k, composed, { r: item.r, type: item.type || "" });
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        stats.apiFails++;
        console.warn(`  · 약점 예문 생성 실패 (시도 ${attempt}/3): ${e.message}`);
        if (attempt < 3) await sleep(1000 * 2 ** (attempt - 1));
      }
    }
    if (lastErr) throw lastErr;   // planDay 의 newErrorFallback 가 이 칸을 복습으로 대체
  }

  // 검증: 실제로 목표 읽기를 썼는지. 실패해도 재생성 안 함(비용) — 경고만, 예문은 채택.
  const ok = n1.verifyReading(entry, item.k, item.r);
  if (!ok) {
    weakStats.verifyFails++;
    console.log(`  · ⚠️ 약점 검증 실패: 「${item.k}」예문에서 목표 읽기 「${item.r}」를 확인 못 함 (그대로 채택)`);
  }

  weakStats.weakSlots += 1;
  newKanji.push(entry.targetKanji);
  if (weakStats.samples.length < 12) {
    weakStats.samples.push({
      k: item.k, r: item.r, type: item.type || "", ok,
      sentence: String(entry.sentenceJP || "").split("\n")[0],
    });
  }
  return entry;
}

// ---------- 메인 ----------
async function main() {
  const today = BASE_DATE;   // 평소엔 n1.dateJST(). FORCE_DATE 로 임의 날짜 주입 가능.
  console.log(`N1 클라우드 생성기 · ${today}(${DOW_KR}) · TZ=${process.env.TZ}${DRY_RUN ? " · DRY-RUN" : ""}${HAS_FORCE_DATE ? " · FORCE_DATE" : ""}`);

  // 주말·공휴일 판정 (완전히 같은 취급). NEW_ANYWAY 면 공휴일 조회 자체를 건너뛴다.
  const holiday = NEW_ANYWAY ? { name: null, source: "skip" } : await resolveHoliday(BASE_DATE);
  const IS_HOLIDAY = !!holiday.name;
  const PAUSE_NEW = (IS_WEEKEND || IS_HOLIDAY) && !NEW_ANYWAY;
  cfg.PAUSE_NEW = PAUSE_NEW;
  // 주말/공휴일/둘 다를 구분해 표기: "주말(일)" / "공휴일(敬老の日)" / "주말(일) + 공휴일(…)"
  const calReason = [
    IS_WEEKEND ? `주말(${DOW_KR})` : null,
    IS_HOLIDAY ? `공휴일(${holiday.name})` : null,
  ].filter(Boolean).join(" + ");

  if (PAUSE_NEW) {
    console.log(`${calReason} — 신규 생성 건너뜀(전량 복습). API 0회 · 진도 0 전진.`);
  } else if ((IS_WEEKEND || IS_HOLIDAY) && NEW_ANYWAY) {
    console.log(`주말/공휴일이지만 --new-anyway/IGNORE_CALENDAR=1 → 신규 생성 강행.`);
  }

  if (!DRY_RUN) {
    if (!cfg.OPENROUTER_KEY) die("OPENROUTER_KEY 환경변수가 없습니다.");
    if (!cfg.GIST_TOKEN) die("GIST_TOKEN 환경변수가 없습니다.");
  }

  // ---- 1) 상태 로드 ----
  let remoteFiles = { [STATE_FILE]: null, [TODAY_FILE]: null, [WEAK_FILE]: null };
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

  // ---- 1b) 약점(진단) 데이터 로드 — 없으면 약점 기능 완전 비활성(기존 동작 그대로) ----
  const weakLoad = loadWeakReadings(remoteFiles);
  if (weakLoad) {
    const added = mergeWeakQueue(s, weakLoad.items);
    weakStats.enabled = true;
    weakStats.source = weakLoad.source;
    const remain = Math.max(0, s.weakQueue.length - s.weakIndex);
    console.log(
      `약점 읽기 ${s.weakQueue.length}개 로드 (출처: ${weakLoad.source})` +
      ` · 이번 추가 ${added}개 · 큐 잔여 ${remain}개 · WEAK_RATIO ${cfg.WEAK_RATIO}`
    );
  }

  // ---- 2) 지난 예약 반영 + 슬롯 계획 ----
  n1.reconcile(s);
  const planned = await n1.planDay(cfg, s, {
    now: new Date(),
    alreadyKeys: [],
    compose: makeComposeRouter(DRY_RUN ? dryComposer : realComposer),
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
  if (PAUSE_NEW) console.log(`${calReason}  — 신규 생성 건너뜀(전량 복습)`);
  console.log(`총 슬롯       ${slots.length}칸  (${cfg.START_HOUR ?? 9}:00~${cfg.END_HOUR ?? 23}:00, ${cfg.INTERVAL_MIN ?? 15}분 간격)`);
  console.log(`신규          ${planned.newCount}칸  · 한자 ${uniqNew.length}자: ${uniqNew.join(" ") || "(없음)"}`);
  console.log(`복습          ${planned.reviewCount}칸`);
  console.log(`API 호출      ${stats.apiCalls}회  · 실패(시도) ${stats.apiFails}회  · 복습으로 대체된 칸 ${stats.fallbackSlots}`);
  console.log(`전진 후 진도  progressIndex ${s.progressIndex} / ${s.kanjiList.length} · cycle ${s.cycle}`);
  if (weakStats.enabled) {
    const remain = Math.max(0, s.weakQueue.length - s.weakIndex);
    const sampleStr = weakStats.samples.map((x) => `${x.k}${x.r}`).join(" ");
    console.log(
      `약점 보강      ${weakStats.weakSlots}칸(${sampleStr || "없음"})` +
      ` · 커리큘럼 ${weakStats.curriculumSlots}칸 · 약점 큐 잔여 ${remain}개` +
      (weakStats.verifyFails ? ` · 검증 실패 ${weakStats.verifyFails}건(경고만·채택됨)` : "")
    );
  }
  console.log("──────────────────────────────────────────");

  if (DRY_RUN) {
    console.log("\n[dry-run] 슬롯 계획 샘플 (앞 6 · 뒤 4):");
    const sample = slots.length > 12 ? [...slots.slice(0, 6), null, ...slots.slice(-4)] : slots;
    for (const sl of sample) {
      if (!sl) { console.log("   …"); continue; }
      console.log(`   ${sl.key}  ${sl.title.split("\n")[0]}  | ${String(sl.body).split("\n")[0]}`);
    }
    if (weakStats.enabled && weakStats.samples.length) {
      console.log("\n[dry-run] 약점 슬롯 샘플:");
      for (const x of weakStats.samples) {
        console.log(`   ${x.k}「${x.r}」${x.type ? ` (${x.type})` : ""}  ${x.ok ? "✓읽기확인" : "⚠검증실패"}  | ${x.sentence}`);
      }
      console.log(`\n[dry-run] 약점 상태 커서: weakIndex ${s.weakIndex} / ${s.weakQueue.length} · weakRepCount ${s.weakRepCount}`);
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
