#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
퀴즈 데이터 검증/수정/추가/삭제 전용 툴 (로컬 실행)
────────────────────────────────────────────────────────────
실행 방법:
    1) 이 파일을 server/ 폴더(quizData.js 가 있는 곳)에 둡니다.
    2) 터미널에서:  python quiz_validator.py   (또는 더블클릭)
    3) 브라우저가 자동으로 http://localhost:8765 를 엽니다.

기능:
    [수정]
      - 시작 지점(Start)만 바꾸면 끝 지점(End)은 자동으로 start+10 으로 저장
      - youtubeId / 카테고리(드롭다운) / 정답 목록 수정
      - 정답은 "한 줄에 하나씩", 첫 줄이 표시(대표) 정답, 나머지는 추가 인정 정답
      - 힌트는 수정하지 않음(원본 보존)
    [추가]
      - 카테고리를 드롭다운에서 선택 → 그에 맞는 ID 자동 부여
      - youtubeId / 시작 지점 / 정답 목록 입력 (힌트·난이도 선택 입력)
    [삭제]
      - 현재 선택한 항목을 quizData.js 에서 제거
    [재생 검사]  ★신규
      - "🔎 재생 검사" → 모든 유튜브 ID를 oEmbed로 조회해 삭제·비공개·잘못된 ID 검출
      - 결과는 quizData.js.check.json 에 캐시(재실행 시 새 항목만 조회)
      - 좌측 상단 "🚫 재생 불가만" 필터로 안 되는 것만 모아보기
    [중복 정답]  ★신규
      - 대표 정답(answers[0])이 같은 항목을 자동으로 묶어 "🔁 중복" 표시
      - "🔁 중복 정답만" 필터로 겹치는 것만 모아보기 → 삭제 버튼으로 정리

안전장치:
    - 첫 저장 시 quizData.js.bak (원본 백업) 생성
    - 매 저장마다 quizData.js.bak.last (직전 상태) 생성
    - 수정은 해당 줄의 필요한 필드만 정밀 교체 → 주석/다른 항목/포맷 보존

주의:
    - 외부 패키지 불필요 (파이썬 표준 라이브러리만 사용)
    - 인터넷 연결 필요 (유튜브 재생용)
"""

import os
import re
import json
import shutil
import threading
import webbrowser
import urllib.request
import urllib.error
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = 8765
END_OFFSET = 10  # 끝 지점 = 시작 지점 + 10

# ── quizData.js 위치 자동 탐색 ───────────────────────────────
def find_quiz_file():
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(here, 'quizData.js'),
        os.path.join(here, 'server', 'quizData.js'),
        os.path.join(here, '..', 'server', 'quizData.js'),
    ]
    for c in candidates:
        if os.path.isfile(c):
            return os.path.abspath(c)
    return None

QUIZ_FILE = find_quiz_file()

# 한 객체 라인을 파싱하기 위한 필드별 정규식
RE_ID    = re.compile(r"id:\s*'([^']*)'")
RE_CAT   = re.compile(r"category:\s*'([^']*)'")
RE_YID   = re.compile(r"youtubeId:\s*'([^']*)'")
RE_START = re.compile(r"youtubeStart:\s*(\d+)")
RE_END   = re.compile(r"youtubeEnd:\s*(\d+)")
RE_HINT  = re.compile(r"hint:\s*'((?:[^'\\]|\\.)*)'")
RE_ANS   = re.compile(r"answers:\s*(\[[^\]]*\])")
RE_DIFF  = re.compile(r"difficulty:\s*(\d+)")

# 객체로 보이는 라인 (id: 로 시작하는 중괄호 라인)
RE_OBJECT_LINE = re.compile(r"^\s*\{\s*id:\s*'")

# id 의 알파벳 프리픽스 + 숫자 추출
RE_IDNUM = re.compile(r"^([A-Za-z]+)(\d+)")


# ── 문자열 배열 파싱 (작은/큰따옴표 + 이스케이프 모두 처리) ──
def parse_string_array(arr_text):
    out = []
    i, n = 0, len(arr_text)
    while i < n:
        ch = arr_text[i]
        if ch == "'" or ch == '"':
            quote = ch
            i += 1
            buf = []
            while i < n:
                c = arr_text[i]
                if c == '\\' and i + 1 < n:
                    buf.append(arr_text[i + 1]); i += 2; continue
                if c == quote:
                    i += 1; break
                buf.append(c); i += 1
            out.append(''.join(buf))
        else:
            i += 1
    return out


# ── JS 문자열 리터럴로 직렬화 (원본 스타일 유지) ──
def js_str(s):
    s = s if s is not None else ''
    if "'" not in s:
        return "'" + s + "'"
    if '"' not in s:
        return '"' + s + '"'
    # 둘 다 들어있으면 작은따옴표로 감싸고 작은따옴표만 이스케이프
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"


def answers_to_js(answers):
    return '[' + ', '.join(js_str(a) for a in answers) + ']'


def parse_quiz(text):
    """파일 텍스트에서 항목들을 줄 단위로 파싱. 각 항목에 원본 줄 번호(line_no)를 보존."""
    items = []
    for idx, line in enumerate(text.splitlines()):
        if not RE_OBJECT_LINE.match(line):
            continue
        m_id = RE_ID.search(line)
        if not m_id:
            continue

        def g(rx, default=''):
            m = rx.search(line)
            return m.group(1) if m else default

        answers_raw = g(RE_ANS, '[]')
        answers = parse_string_array(answers_raw)
        items.append({
            'line_no':      idx,           # 0-based
            'id':           m_id.group(1),
            'category':     g(RE_CAT),
            'youtubeId':    g(RE_YID),
            'youtubeStart': int(g(RE_START, '0') or 0),
            'youtubeEnd':   int(g(RE_END, '0') or 0),
            'hint':         g(RE_HINT),
            'answers':      answers,
            'difficulty':   int(g(RE_DIFF, '1') or 1),
        })
    return items


def next_id_for_category(items, category):
    """선택한 카테고리에서 가장 많이 쓰인 프리픽스를 찾아 (최대번호+1) 로 새 ID 생성."""
    group = [it for it in items if it.get('category') == category]
    all_ids = {it['id'] for it in items}

    stats = defaultdict(lambda: {'count': 0, 'max': 0, 'width': 3})
    for it in group:
        m = RE_IDNUM.match(it['id'])
        if not m:
            continue
        pre, num = m.group(1), m.group(2)
        st = stats[pre]
        st['count'] += 1
        val = int(num)
        st['width'] = max(st['width'], len(num))
        if val > st['max']:
            st['max'] = val

    if not stats:
        # 해당 카테고리에 파싱 가능한 ID가 없으면 안전한 임시 프리픽스
        prefix, width, nextnum = 'q', 3, 1
    else:
        # 우선순위: 항목 수 많은 프리픽스 → 동률이면 최대번호 큰 쪽
        prefix = sorted(stats.items(), key=lambda kv: (kv[1]['count'], kv[1]['max']))[-1][0]
        st = stats[prefix]
        width = st['width']
        nextnum = st['max'] + 1

    cand = f"{prefix}{str(nextnum).zfill(width)}"
    while cand in all_ids:
        nextnum += 1
        cand = f"{prefix}{str(nextnum).zfill(width)}"
    return cand


def build_item_line(item_id, category, youtube_id, start, answers, hint, difficulty):
    start = int(start)
    end = start + END_OFFSET
    return (
        f"    {{ id: '{item_id}', category: {js_str(category)}, "
        f"youtubeId: '{youtube_id}', youtubeStart: {start}, youtubeEnd: {end}, "
        f"hint: {js_str(hint or '')}, answers: {answers_to_js(answers)}, "
        f"difficulty: {int(difficulty)} }},\n"
    )


def save_lines(lines):
    if not os.path.exists(QUIZ_FILE + '.bak'):
        shutil.copy2(QUIZ_FILE, QUIZ_FILE + '.bak')        # 최초 원본 백업
    shutil.copy2(QUIZ_FILE, QUIZ_FILE + '.bak.last')        # 직전 상태 백업
    with open(QUIZ_FILE, 'w', encoding='utf-8') as f:
        f.writelines(lines)


def update_item(target_id, fields):
    """target_id 항목의 지정된 필드만 그 줄 안에서 정밀 교체. End 는 Start+10 자동."""
    with open(QUIZ_FILE, 'r', encoding='utf-8') as f:
        text = f.read()
    lines = text.splitlines(keepends=True)

    found = None
    for i, line in enumerate(lines):
        if RE_OBJECT_LINE.match(line):
            m = RE_ID.search(line)
            if m and m.group(1) == target_id:
                found = i
                break
    if found is None:
        return False, f"id '{target_id}' 를 찾을 수 없습니다."

    line = lines[found]

    if 'youtubeId' in fields and RE_YID.search(line):
        yid = fields['youtubeId']
        line = RE_YID.sub(lambda m: f"youtubeId: '{yid}'", line, count=1)

    if 'youtubeStart' in fields:
        s = int(fields['youtubeStart'])
        # End: 명시값이 있고 시작보다 크면 그대로, 아니면 기본 start+10
        if fields.get('youtubeEnd') not in (None, ''):
            e = int(fields['youtubeEnd'])
            if e <= s:
                e = s + END_OFFSET
        else:
            e = s + END_OFFSET
        if RE_START.search(line):
            line = RE_START.sub(lambda m: f"youtubeStart: {s}", line, count=1)
        if RE_END.search(line):
            line = RE_END.sub(lambda m: f"youtubeEnd: {e}", line, count=1)

    if 'category' in fields and RE_CAT.search(line):
        cat = fields['category']
        line = RE_CAT.sub(lambda m: f"category: {js_str(cat)}", line, count=1)

    if 'answers' in fields and RE_ANS.search(line):
        ans = [a for a in fields['answers'] if a != '']
        line = RE_ANS.sub(lambda m: 'answers: ' + answers_to_js(ans), line, count=1)

    if 'difficulty' in fields and RE_DIFF.search(line):
        d = max(1, int(fields['difficulty']))
        line = RE_DIFF.sub(lambda m: f"difficulty: {d}", line, count=1)

    lines[found] = line
    save_lines(lines)
    return True, "저장 완료"


def add_item(category, youtube_id, start, answers, hint, difficulty):
    with open(QUIZ_FILE, 'r', encoding='utf-8') as f:
        text = f.read()
    items = parse_quiz(text)
    new_id = next_id_for_category(items, category)

    lines = text.splitlines(keepends=True)
    last = None
    for i, line in enumerate(lines):
        if RE_OBJECT_LINE.match(line):
            last = i
    if last is None:
        return False, "항목 삽입 위치를 찾지 못했습니다.", None

    new_line = build_item_line(new_id, category, youtube_id, start, answers, hint, difficulty)
    if not lines[last].endswith('\n'):
        lines[last] = lines[last] + '\n'
    lines.insert(last + 1, new_line)
    save_lines(lines)
    return True, f"추가 완료 (ID: {new_id})", new_id


def delete_item(target_id):
    with open(QUIZ_FILE, 'r', encoding='utf-8') as f:
        text = f.read()
    lines = text.splitlines(keepends=True)

    idx = None
    for i, line in enumerate(lines):
        if RE_OBJECT_LINE.match(line):
            m = RE_ID.search(line)
            if m and m.group(1) == target_id:
                idx = i
                break
    if idx is None:
        return False, f"id '{target_id}' 를 찾을 수 없습니다."

    del lines[idx]
    save_lines(lines)
    return True, "삭제 완료"


# ── 영상 재생 가능 여부 검사 (YouTube oEmbed) ──────────────────
# 결과는 quizData.js.check.json 에 캐시 → 재실행 시 이미 검사한 건 건너뜀
CHECK_CACHE = (QUIZ_FILE + '.check.json') if QUIZ_FILE else None


def load_check_cache():
    if CHECK_CACHE and os.path.isfile(CHECK_CACHE):
        try:
            with open(CHECK_CACHE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_check_cache(cache):
    if CHECK_CACHE:
        with open(CHECK_CACHE, 'w', encoding='utf-8') as f:
            json.dump(cache, f, ensure_ascii=False)


def check_one_video(vid):
    """oEmbed로 판정: 'ok'(재생 가능) | 'unavailable'(삭제·비공개·잘못된ID) | 'error'(조회 실패)"""
    url = ('https://www.youtube.com/oembed?format=json'
           '&url=https://www.youtube.com/watch?v=' + vid)
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=8) as r:
            return 'ok' if r.status == 200 else 'unavailable'
    except urllib.error.HTTPError as e:
        return 'unavailable' if e.code in (400, 401, 403, 404) else 'error'
    except Exception:
        return 'error'


def unique_video_ids():
    with open(QUIZ_FILE, 'r', encoding='utf-8') as f:
        items = parse_quiz(f.read())
    seen, vids = set(), []
    for it in items:
        v = it['youtubeId']
        if v and v not in seen:
            seen.add(v)
            vids.append(v)
    return vids


def check_videos(force=False):
    """현재 데이터의 모든 유튜브 ID 재생 검사. 캐시 활용, 없는 것만 병렬 조회."""
    vids = unique_video_ids()
    cache = load_check_cache()
    todo = [v for v in vids if force or v not in cache]
    if todo:
        with ThreadPoolExecutor(max_workers=16) as ex:
            for v, status in zip(todo, ex.map(check_one_video, todo)):
                cache[v] = status
        save_check_cache(cache)
    result = {v: cache.get(v, 'unknown') for v in vids}
    bad = sum(1 for s in result.values() if s != 'ok')
    return result, bad, len(todo)


def cached_status():
    """네트워크 없이 캐시에 있는 결과만 반환 (현재 데이터에 존재하는 ID 한정)."""
    cache = load_check_cache()
    return {v: cache[v] for v in unique_video_ids() if v in cache}


# ── HTML (브라우저 UI) ───────────────────────────────────────
HTML_PAGE = r"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>퀴즈 데이터 편집 툴</title>
<style>
  :root { --bg:#0b0e1a; --panel:#151a2e; --line:#2a3050; --txt:#e6e9f5;
          --dim:#8b93b5; --accent:#7c3aed; --cyan:#06b6d4; --ok:#10b981; --warn:#f59e0b; --danger:#ef4444; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:system-ui,-apple-system,'Segoe UI',sans-serif;
         background:var(--bg); color:var(--txt); height:100vh; overflow:hidden; }
  .app { display:grid; grid-template-columns:320px 1fr; grid-template-rows:minmax(0,1fr); height:100vh; }
  /* 좌측 목록 */
  .sidebar { border-right:1px solid var(--line); display:flex; flex-direction:column; min-height:0; }
  .side-head { padding:12px; border-bottom:1px solid var(--line); }
  .side-head h1 { font-size:1rem; margin:0 0 8px; }
  .filters { display:flex; gap:6px; flex-wrap:wrap; }
  .filters input, .filters select {
    background:var(--panel); color:var(--txt); border:1px solid var(--line);
    border-radius:6px; padding:6px 8px; font-size:0.82rem; }
  .filters input { flex:1; min-width:0; }
  .count { font-size:0.75rem; color:var(--dim); margin-top:6px; }
  .list { overflow-y:auto; flex:1; }
  .row { padding:9px 12px; border-bottom:1px solid rgba(255,255,255,0.04);
         cursor:pointer; font-size:0.83rem; }
  .row:hover { background:rgba(124,58,237,0.12); }
  .row.active { background:rgba(124,58,237,0.28); }
  .row .rid { font-family:monospace; color:var(--cyan); }
  .row .rcat { color:var(--dim); font-size:0.72rem; margin-left:6px; }
  .row .rans { display:block; color:var(--txt); margin-top:2px; }
  .row.done { opacity:0.5; }
  .row .check { color:var(--ok); }
  .tag { display:inline-block; font-size:0.64rem; font-weight:700; padding:1px 6px;
         border-radius:100px; margin-left:6px; vertical-align:middle; }
  .tag-bad { background:rgba(239,68,68,0.22); color:#fca5a5; }
  .tag-dup { background:rgba(245,158,11,0.20); color:#fcd34d; }
  .btn-check { border:0; border-radius:6px; color:#fff; font-weight:600;
               background:#2563eb; cursor:pointer; }
  /* 우측 메인 */
  .main { display:flex; flex-direction:column; min-height:0; padding:16px; gap:14px; overflow-y:auto; }
  .meta { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
  .badge { background:var(--panel); border:1px solid var(--line); border-radius:8px;
           padding:6px 12px; font-size:0.85rem; }
  .badge b { color:var(--cyan); }
  .player-wrap { background:#000; border-radius:12px; overflow:hidden;
                 width:100%; max-width:760px; aspect-ratio:16/9; align-self:center; }
  .player-wrap iframe { width:100%; height:100%; border:0; }
  /* 편집 패널 */
  .editor { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:16px;
            display:flex; flex-direction:column; gap:12px; max-width:760px; align-self:center; width:100%; }
  .editor h3 { margin:0; font-size:0.95rem; display:flex; align-items:center; gap:8px; }
  .field { display:flex; flex-direction:column; gap:4px; }
  .field label { font-size:0.78rem; color:var(--dim); }
  .field input, .field select, .field textarea {
    background:var(--bg); color:var(--txt); border:1px solid var(--line);
    border-radius:6px; padding:9px 10px; font-size:0.95rem; font-family:monospace; }
  .field textarea { resize:vertical; min-height:78px; line-height:1.5; }
  .grid3 { display:grid; grid-template-columns:1fr 130px 1fr; gap:10px; }
  .grid-add { display:grid; grid-template-columns:1fr 130px 120px; gap:10px; }
  .endinfo { font-size:0.78rem; color:var(--cyan); align-self:flex-end; padding-bottom:9px; }
  .actions { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  button.act { border:0; border-radius:8px; padding:10px 18px; font-size:0.92rem;
               font-weight:600; cursor:pointer; color:#fff; }
  .btn-apply { background:linear-gradient(135deg,var(--accent),var(--cyan)); }
  .btn-add { background:linear-gradient(135deg,#0ea5e9,#10b981); }
  .btn-reload { background:#334; }
  .btn-prev, .btn-next { background:#243; }
  .btn-preview { background:#3a2a55; }
  .btn-del { background:var(--danger); margin-left:auto; }
  .status { font-size:0.85rem; color:var(--ok); }
  .status.err { color:#f87171; }
  .hint-row { font-size:0.78rem; color:var(--dim); }
  .nav { display:flex; gap:8px; }
  .nofile { padding:40px; text-align:center; color:#f87171; }
  .divider { height:1px; background:var(--line); margin:2px 0; }
</style>
</head>
<body>
<div class="app">
  <div class="sidebar">
    <div class="side-head">
      <h1>🎬 퀴즈 데이터 편집 툴</h1>
      <div class="filters">
        <input id="search" placeholder="ID·정답·힌트 검색">
        <select id="catFilter"><option value="">전체 카테고리</option></select>
      </div>
      <div class="filters" style="margin-top:6px;">
        <select id="viewMode" style="flex:1;">
          <option value="all">전체 보기</option>
          <option value="bad">🚫 재생 불가만</option>
          <option value="dup">🔁 중복 정답만</option>
        </select>
        <button class="btn-check" id="checkBtn" onclick="runCheck(false)"
                style="padding:6px 10px;font-size:0.8rem;">🔎 재생 검사</button>
      </div>
      <div class="count" id="count"></div>
      <div class="count" id="checkinfo"></div>
    </div>
    <div class="list" id="list"></div>
  </div>

  <div class="main" id="main">
    <div class="meta" id="meta"></div>
    <div class="player-wrap"><iframe id="yt" allow="autoplay; encrypted-media" allowfullscreen></iframe></div>

    <!-- ── 수정 ── -->
    <div class="editor">
      <h3>✏️ 수정 <span class="hint-row" id="curhint"></span></h3>
      <div class="grid3">
        <div class="field">
          <label>YouTube ID</label>
          <input id="f_id" placeholder="dQw4w9WgXcQ">
        </div>
        <div class="field">
          <label>Start (초)</label>
          <input id="f_start" type="number" min="0" oninput="onStartChange()">
        </div>
        <div class="field">
          <label>End (초) · 기본 Start+10</label>
          <input id="f_end" type="number" min="0" oninput="updateEndInfo()">
        </div>
      </div>
      <div class="grid3">
        <div class="field">
          <label>카테고리</label>
          <select id="e_cat"></select>
        </div>
        <div class="field">
          <label>난이도</label>
          <input id="e_diff" type="number" min="1" max="5">
        </div>
        <div class="field" style="justify-content:flex-end;">
          <button class="act btn-preview" type="button" onclick="resetEnd()"
                  style="padding:9px 10px;font-size:0.82rem;">End = Start+10 초기화</button>
        </div>
      </div>
      <div class="field">
        <label>정답 (한 줄에 하나씩 · 첫 줄 = 표시되는 대표 정답)</label>
        <textarea id="e_answers" spellcheck="false"></textarea>
      </div>
      <div class="hint-row" id="e_endinfo"></div>
      <div class="hint-row">기본 종료는 Start+10초. 10초보다 짧게(또는 다르게) 자르려면 End를 직접 입력하세요. "반영 저장"을 눌러야 파일이 바뀝니다.</div>
      <div class="actions">
        <button class="act btn-preview" onclick="previewEdit()">▶ 미리보기</button>
        <button class="act btn-apply" onclick="applyEdit()">💾 반영 저장</button>
        <div class="nav">
          <button class="act btn-prev" onclick="go(-1)">← 이전</button>
          <button class="act btn-next" onclick="go(1)">다음 →</button>
        </div>
        <button class="act btn-reload" onclick="loadData()">⟳ 새로고침</button>
        <button class="act btn-del" onclick="deleteItem()">🗑 삭제</button>
      </div>
      <span class="status" id="status"></span>
    </div>

    <!-- ── 새 데이터 추가 ── -->
    <div class="editor">
      <h3>➕ 새 데이터 추가 <span class="hint-row">(카테고리 선택 → ID 자동 부여)</span></h3>
      <div class="grid-add">
        <div class="field">
          <label>카테고리</label>
          <select id="a_cat"></select>
        </div>
        <div class="field">
          <label>Start (초)</label>
          <input id="a_start" type="number" min="0" value="0">
        </div>
        <div class="field">
          <label>난이도</label>
          <input id="a_diff" type="number" min="1" max="5" value="1">
        </div>
      </div>
      <div class="field">
        <label>YouTube ID</label>
        <input id="a_id" placeholder="dQw4w9WgXcQ">
      </div>
      <div class="field">
        <label>정답 (한 줄에 하나씩 · 첫 줄 = 표시되는 대표 정답)</label>
        <textarea id="a_answers" spellcheck="false" placeholder="대표 정답&#10;다른 정답1&#10;다른 정답2"></textarea>
      </div>
      <div class="field">
        <label>힌트 (선택)</label>
        <input id="a_hint" placeholder="(비워둬도 됩니다)">
      </div>
      <div class="actions">
        <button class="act btn-add" onclick="addItem()">➕ 추가 저장</button>
        <span class="status" id="addstatus"></span>
      </div>
    </div>
  </div>
</div>

<script>
let DATA = [];
let view = [];
let cur = -1;
let CHECK = {};    // youtubeId -> 'ok' | 'unavailable' | 'error'
let DUPMAP = {};   // id -> { key, partners:[id...] }  (대표답 중복)
const done = new Set(JSON.parse(localStorage.getItem('quiz_done') || '[]'));

const $ = s => document.querySelector(s);

// 정답 정규화 (대소문자·공백·문장부호 무시, 한글/숫자/문자는 유지)
function norm(s) {
  return (s || '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

// 대표답(answers[0]) 이 같은 항목들을 중복으로 묶음
function computeDuplicates() {
  const map = {};
  DATA.forEach(d => {
    if (!d.answers || !d.answers.length) return;
    const k = norm(d.answers[0]);
    if (!k) return;
    (map[k] = map[k] || []).push(d.id);
  });
  DUPMAP = {};
  Object.entries(map).forEach(([k, ids]) => {
    if (ids.length > 1) ids.forEach(id => { DUPMAP[id] = { key: k, partners: ids.filter(x => x !== id) }; });
  });
}

function isBad(d) { const s = CHECK[d.youtubeId]; return s && s !== 'ok'; }

function fillCategorySelects() {
  const cats = [...new Set(DATA.map(d => d.category))].sort();
  const opts = cats.map(c => `<option value="${c}">${c}</option>`).join('');
  const keepFilter = $('#catFilter').value;
  $('#catFilter').innerHTML = '<option value="">전체 카테고리</option>' + opts;
  $('#catFilter').value = keepFilter;
  $('#e_cat').innerHTML = opts;
  $('#a_cat').innerHTML = opts;
}

async function loadData() {
  const res = await fetch('/api/data');
  const j = await res.json();
  if (!j.ok) { $('#main').innerHTML = '<div class="nofile">' + j.error + '</div>'; return; }
  DATA = j.items;
  fillCategorySelects();
  computeDuplicates();
  await loadCheckCache();       // 이전에 검사한 재생상태(캐시)를 즉시 반영
  applyFilter();
  setStatus('데이터 로드됨 (' + DATA.length + '개, 중복 정답 ' + Object.keys(DUPMAP).length + '개)');
}

function applyFilter() {
  const q = $('#search').value.trim().toLowerCase();
  const cat = $('#catFilter').value;
  const vm = $('#viewMode').value;
  view = DATA.filter(d => {
    if (cat && d.category !== cat) return false;
    if (vm === 'bad' && !isBad(d)) return false;
    if (vm === 'dup' && !DUPMAP[d.id]) return false;
    if (!q) return true;
    const hay = (d.id + ' ' + d.category + ' ' + d.hint + ' ' + (d.answers || []).join(' ')).toLowerCase();
    return hay.includes(q);
  });
  renderList();
  if (view.length) selectByIndex(0);
}

function renderList() {
  $('#count').textContent = view.length + '개 표시 / 전체 ' + DATA.length + '개  (검증 ' + done.size + ')';
  $('#list').innerHTML = view.map((d, i) => {
    const isDone = done.has(d.id);
    const badTag = isBad(d) ? '<span class="tag tag-bad">재생불가</span>' : '';
    const dupTag = DUPMAP[d.id] ? '<span class="tag tag-dup">중복</span>' : '';
    return `<div class="row ${isDone ? 'done' : ''}" data-i="${i}" onclick="selectByIndex(${i})">
      <span class="rid">${d.id}</span><span class="rcat">${d.category}</span>${badTag}${dupTag}
      ${isDone ? '<span class="check">✓</span>' : ''}
      <span class="rans">${(d.answers || []).slice(0, 3).join(', ')}</span>
    </div>`;
  }).join('');
  highlight();
}

function highlight() {
  document.querySelectorAll('.row').forEach(r => {
    r.classList.toggle('active', Number(r.dataset.i) === cur);
  });
}

function selectByIndex(i) {
  if (i < 0 || i >= view.length) return;
  cur = i;
  const d = view[i];
  const st = CHECK[d.youtubeId];
  const stBadge = st
    ? `<div class="badge">재생 <b style="color:${st === 'ok' ? 'var(--ok)' : '#f87171'}">${st === 'ok' ? '가능' : '불가(' + st + ')'}</b></div>`
    : '';
  const dupBadge = DUPMAP[d.id]
    ? `<div class="badge" style="border-color:var(--warn)">🔁 중복: <b style="color:var(--warn)">${DUPMAP[d.id].partners.join(', ')}</b></div>`
    : '';
  $('#meta').innerHTML =
    `<div class="badge">ID <b>${d.id}</b></div>` +
    `<div class="badge">카테고리 <b>${d.category}</b></div>` +
    `<div class="badge">난이도 <b>${d.difficulty}</b></div>` +
    stBadge + dupBadge;
  $('#curhint').textContent = d.hint ? ('힌트: ' + d.hint) : '';
  $('#f_id').value = d.youtubeId;
  $('#f_start').value = d.youtubeStart;
  $('#f_end').value = d.youtubeEnd;
  $('#e_cat').value = d.category;
  $('#e_diff').value = d.difficulty;
  $('#e_answers').value = (d.answers || []).join('\n');
  updateEndInfo();
  loadVideo(d.youtubeId, d.youtubeStart, d.youtubeEnd);
  highlight();
  const el = document.querySelector(`.row[data-i="${i}"]`);
  el && el.scrollIntoView({ block: 'nearest' });
}

function selectById(id) {
  let i = view.findIndex(d => d.id === id);
  if (i < 0) { $('#search').value = ''; $('#catFilter').value = ''; applyFilter(); i = view.findIndex(d => d.id === id); }
  if (i >= 0) selectByIndex(i);
}

// Start 를 바꾸면 End 를 기본값(Start+10)으로 자동 설정 (원하면 그 뒤 직접 수정)
function onStartChange() {
  const s = Number($('#f_start').value) || 0;
  $('#f_end').value = s + 10;
  updateEndInfo();
}
function resetEnd() {
  const s = Number($('#f_start').value) || 0;
  $('#f_end').value = s + 10;
  updateEndInfo();
}
function updateEndInfo() {
  const s = Number($('#f_start').value) || 0;
  const e = Number($('#f_end').value) || 0;
  const len = e - s;
  $('#e_endinfo').textContent = len > 0
    ? `재생 구간: ${s}s ~ ${e}s (${len}초)`
    : `⚠️ End(${e})가 Start(${s})보다 커야 합니다 — 저장 시 Start+10으로 보정됩니다`;
}

function loadVideo(id, start, end) {
  const s = Number(start) || 0;
  const e = Number(end) || 0;
  let url = `https://www.youtube.com/embed/${id}?start=${s}&autoplay=0&rel=0`;
  if (e > s) url += `&end=${e}`;
  $('#yt').src = url;
}

function previewEdit() {
  loadVideo($('#f_id').value.trim(), Number($('#f_start').value) || 0, Number($('#f_end').value) || 0);
  setStatus('미리보기 로드됨 (아직 저장 안 됨)', false);
}

function readAnswers(sel) {
  return $(sel).value.split('\n').map(s => s.trim()).filter(Boolean);
}

async function applyEdit() {
  if (cur < 0) return;
  const d = view[cur];
  const answers = readAnswers('#e_answers');
  if (!answers.length) { setStatus('정답을 1개 이상 입력하세요.', true); return; }
  const start = Number($('#f_start').value) || 0;
  let end = Number($('#f_end').value) || 0;
  if (end <= start) end = start + 10;              // 잘못된 End는 기본값으로 보정
  const payload = {
    id: d.id,
    youtubeId: $('#f_id').value.trim(),
    youtubeStart: start,
    youtubeEnd: end,
    category: $('#e_cat').value,
    difficulty: Math.max(1, Number($('#e_diff').value) || 1),
    answers
  };
  const res = await fetch('/api/update', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const j = await res.json();
  if (j.ok) {
    Object.assign(d, {
      youtubeId: payload.youtubeId,
      youtubeStart: payload.youtubeStart,
      youtubeEnd: payload.youtubeEnd,
      category: payload.category,
      difficulty: payload.difficulty,
      answers
    });
    const orig = DATA.find(x => x.id === d.id);
    if (orig) Object.assign(orig, d);
    done.add(d.id);
    localStorage.setItem('quiz_done', JSON.stringify([...done]));
    renderList();
    setStatus('✓ 저장됨: ' + d.id, false);
  } else {
    setStatus('오류: ' + j.error, true);
  }
}

async function deleteItem() {
  if (cur < 0) return;
  const d = view[cur];
  if (!confirm(`정말 삭제할까요?\n\nID: ${d.id}\n정답: ${(d.answers || [])[0] || ''}`)) return;
  const res = await fetch('/api/delete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: d.id })
  });
  const j = await res.json();
  if (j.ok) {
    done.delete(d.id);
    localStorage.setItem('quiz_done', JSON.stringify([...done]));
    await loadData();
    setStatus('🗑 삭제됨: ' + d.id, false);
  } else {
    setStatus('오류: ' + j.error, true);
  }
}

async function addItem() {
  const answers = readAnswers('#a_answers');
  const yid = $('#a_id').value.trim();
  if (!yid) { setAddStatus('YouTube ID 를 입력하세요.', true); return; }
  if (!answers.length) { setAddStatus('정답을 1개 이상 입력하세요.', true); return; }
  const payload = {
    category: $('#a_cat').value,
    youtubeId: yid,
    youtubeStart: Number($('#a_start').value) || 0,
    answers,
    hint: $('#a_hint').value.trim(),
    difficulty: Number($('#a_diff').value) || 1
  };
  const res = await fetch('/api/add', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const j = await res.json();
  if (j.ok) {
    $('#a_id').value = '';
    $('#a_answers').value = '';
    $('#a_hint').value = '';
    setAddStatus('✓ 추가됨 (ID: ' + j.id + ')', false);
    await loadData();
    selectById(j.id);
  } else {
    setAddStatus('오류: ' + j.error, true);
  }
}

function go(delta) {
  let n = cur + delta;
  if (n < 0) n = 0;
  if (n >= view.length) n = view.length - 1;
  selectByIndex(n);
}

function setStatus(msg, err) {
  const s = $('#status'); s.textContent = msg;
  s.className = 'status' + (err ? ' err' : '');
}
function setAddStatus(msg, err) {
  const s = $('#addstatus'); s.textContent = msg;
  s.className = 'status' + (err ? ' err' : '');
}

function badCount() { return Object.values(CHECK).filter(s => s !== 'ok').length; }

// 캐시된 재생검사 결과만 즉시 로드 (네트워크 X)
async function loadCheckCache() {
  try {
    const r = await fetch('/api/check');
    const j = await r.json();
    if (j.ok) {
      CHECK = j.status || {};
      const n = Object.keys(CHECK).length;
      $('#checkinfo').textContent = n
        ? `재생 검사됨 ${n}개 · 재생 불가 ${badCount()}개 (캐시)`
        : '재생 검사 아직 안 함 — "🔎 재생 검사" 누르세요';
    }
  } catch (e) {}
}

// 실제 유튜브 재생 검사 실행 (force=true 면 캐시 무시 전체 재검사)
async function runCheck(force) {
  const btn = $('#checkBtn');
  btn.disabled = true;
  const old = btn.textContent;
  btn.textContent = '검사 중...';
  $('#checkinfo').textContent = '유튜브 재생 검사 중... 수백 개라 수십 초 걸릴 수 있어요 ⏳';
  try {
    const res = await fetch('/api/check', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: !!force })
    });
    const j = await res.json();
    if (j.ok) {
      CHECK = j.status || {};
      $('#checkinfo').textContent =
        `검사 완료: 재생 불가 ${j.bad}개 / 전체 ${Object.keys(CHECK).length}개 (이번에 ${j.checked}개 새로 조회)`;
      applyFilter();
    } else {
      $('#checkinfo').textContent = '오류: ' + j.error;
    }
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}

$('#search').addEventListener('input', applyFilter);
$('#catFilter').addEventListener('change', applyFilter);
$('#viewMode').addEventListener('change', applyFilter);
document.addEventListener('keydown', e => {
  const t = e.target.tagName;
  if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA') return;
  if (e.key === 'ArrowDown') { e.preventDefault(); go(1); }
  if (e.key === 'ArrowUp') { e.preventDefault(); go(-1); }
});

loadData();
</script>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype='application/json'):
        data = body.encode('utf-8') if isinstance(body, str) else body
        self.send_response(code)
        self.send_header('Content-Type', ctype + '; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass  # 콘솔 깔끔하게

    def _read_json(self):
        length = int(self.headers.get('Content-Length', 0))
        return json.loads(self.rfile.read(length).decode('utf-8'))

    def do_GET(self):
        if self.path == '/' or self.path.startswith('/index'):
            self._send(200, HTML_PAGE, 'text/html')
        elif self.path == '/api/data':
            if not QUIZ_FILE:
                self._send(200, json.dumps({'ok': False,
                    'error': 'quizData.js 를 찾을 수 없습니다. 이 스크립트를 quizData.js 와 같은 폴더(또는 server/ 상위)에 두세요.'}))
                return
            with open(QUIZ_FILE, 'r', encoding='utf-8') as f:
                items = parse_quiz(f.read())
            self._send(200, json.dumps({'ok': True, 'items': items, 'file': QUIZ_FILE}, ensure_ascii=False))
        elif self.path == '/api/check':
            # 캐시된 재생검사 결과만 반환 (네트워크 조회 없음)
            self._send(200, json.dumps({'ok': True, 'status': cached_status()}, ensure_ascii=False))
        else:
            self._send(404, json.dumps({'ok': False, 'error': 'not found'}))

    def do_POST(self):
        try:
            if self.path == '/api/update':
                p = self._read_json()
                fields = {}
                for k in ('youtubeId', 'youtubeStart', 'youtubeEnd', 'category', 'answers', 'difficulty'):
                    if k in p:
                        fields[k] = p[k]
                ok, msg = update_item(p['id'], fields)
                self._send(200, json.dumps({'ok': ok, 'error': None if ok else msg, 'msg': msg}, ensure_ascii=False))

            elif self.path == '/api/add':
                p = self._read_json()
                ok, msg, new_id = add_item(
                    p['category'], p['youtubeId'], p.get('youtubeStart', 0),
                    p.get('answers', []), p.get('hint', ''), p.get('difficulty', 1))
                self._send(200, json.dumps({'ok': ok, 'id': new_id, 'error': None if ok else msg, 'msg': msg}, ensure_ascii=False))

            elif self.path == '/api/delete':
                p = self._read_json()
                ok, msg = delete_item(p['id'])
                self._send(200, json.dumps({'ok': ok, 'error': None if ok else msg, 'msg': msg}, ensure_ascii=False))

            elif self.path == '/api/check':
                p = self._read_json()
                status, bad, checked = check_videos(force=bool(p.get('force')))
                self._send(200, json.dumps(
                    {'ok': True, 'status': status, 'bad': bad, 'checked': checked}, ensure_ascii=False))

            else:
                self._send(404, json.dumps({'ok': False, 'error': 'not found'}))
        except Exception as e:
            self._send(200, json.dumps({'ok': False, 'error': str(e)}, ensure_ascii=False))


def main():
    if not QUIZ_FILE:
        print('⚠️  quizData.js 를 찾지 못했습니다.')
        print('    이 스크립트를 quizData.js 와 같은 폴더에 두고 다시 실행하세요.')
    else:
        print('📂 대상 파일:', QUIZ_FILE)
    url = f'http://localhost:{PORT}'
    print(f'🚀 편집 툴 실행 중 → {url}')
    print('   (종료하려면 이 창에서 Ctrl+C)')
    threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    server = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n👋 종료합니다.')
        server.shutdown()


if __name__ == '__main__':
    main()
