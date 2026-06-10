// Netlify 서버리스 함수 — Google News RSS로 최신 뉴스 가져오기
// GET /.netlify/functions/news?q=코스피+증시&n=8         (단일 쿼리)
// GET /.netlify/functions/news?queries=삼성전자,SK하이닉스  (종목별 배치)
const https = require('https');

exports.handler = async (event) => {
  const p       = event.queryStringParameters || {};
  const queries = p.queries;            // 쉼표 구분 배치 모드
  const q       = p.q;                  // 단일 쿼리
  const n       = Math.min(parseInt(p.n) || 8, 20);

  if (!q && !queries) return respond(400, { error: 'q or queries required' });

  try {
    if (queries) {
      // ── 배치 모드: 종목별 1개씩 병렬 fetch ─────────────────
      const list = queries.split(',').map(s => s.trim()).filter(Boolean).slice(0, 15);
      const results = await Promise.all(list.map(name => fetchOne(name)));
      const items = results.filter(Boolean);
      // 최신순 정렬
      items.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
      return ok(JSON.stringify({ items }));
    } else {
      // ── 단일 쿼리 모드 ────────────────────────────────────
      const items = await fetchMany(q, n);
      return ok(JSON.stringify({ items }));
    }
  } catch(e) {
    return respond(500, { error: e.message });
  }
};

// 종목명으로 뉴스 1개 가져오기
async function fetchOne(name) {
  try {
    const items = await fetchMany(name + ' 주식 뉴스', 1);
    return items[0] || null;
  } catch(e) { return null; }
}

// 쿼리로 최대 count개 뉴스 가져오기
async function fetchMany(query, count) {
  const path = `/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
  try {
    const r = await httpsGet('news.google.com', path);
    if (r.status !== 200) return [];
    return parseRSS(r.body, count);
  } catch(e) { return []; }
}

// RSS XML → JSON 배열 파싱
function parseRSS(xml, count) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;

  while ((m = re.exec(xml)) !== null && items.length < count) {
    const block = m[1];
    const rawTitle = getTag(block, 'title');
    const link     = getTag(block, 'link') || getGuid(block);
    const desc     = getTag(block, 'description');
    const pubDate  = getTag(block, 'pubDate');

    // Google News: "제목 - 출처명" 형식에서 출처 제거
    const title = html2text(rawTitle).replace(/ - [^-]+$/, '').trim();

    if (!title) continue;

    items.push({
      title,
      link:        (link || '').trim(),
      description: html2text(desc),
      pubDate:     (pubDate || '').trim()
    });
  }
  return items;
}

// XML 태그 추출 (CDATA 포함)
function getTag(str, tag) {
  const re = new RegExp(
    `<${tag}(?:\\s[^>]*)?>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'
  );
  const m = str.match(re);
  return m ? m[1].trim() : '';
}

// <guid> 태그 추출
function getGuid(str) {
  const m = str.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
  return m ? m[1].trim() : '';
}

// HTML 엔티티 / 태그 제거
function html2text(str) {
  return (str || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')
    .trim();
}

// HTTPS GET 헬퍼
function httpsGet(host, path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        path,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; newsbot/1.0)',
          'Accept': 'text/xml,application/rss+xml,*/*',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8'
        }
      },
      res => {
        let body = '';
        res.on('data', c => { body += c; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function ok(body) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    },
    body
  };
}

function respond(status, obj) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(obj)
  };
}
