// Netlify 서버리스 함수 — 네이버 검색 API (한국어 뉴스)
// GET /.netlify/functions/naver-news?names=삼성전자,SK하이닉스,...&n=1  (종목별 배치)
// GET /.netlify/functions/naver-news?q=코스피 증시 시황&n=8            (시장 뉴스)
const https = require('https');

const CLIENT_ID     = 'Ayqzoh8YSMntUK24lJOv';
const CLIENT_SECRET = 'X4TXuG5Nen';

exports.handler = async (event) => {
  const p     = event.queryStringParameters || {};
  const q     = p.q;
  const names = p.names;
  const n     = Math.min(parseInt(p.n) || 8, 20);

  if (!q && !names) return respond(400, { error: 'q or names required' });

  try {
    if (names) {
      // 배치: 종목명별 1개씩 병렬 검색
      const list = names.split(',').map(s => s.trim()).filter(Boolean).slice(0, 15);
      const results = await Promise.all(
        list.map(name => searchNaver(name + ' 주가', 1))
      );
      const items = results.flat().filter(x => x && x.title);

      // 중복 제거 (같은 제목)
      const seen   = new Set();
      const unique = items.filter(x => {
        if (seen.has(x.title)) return false;
        seen.add(x.title);
        return true;
      });
      unique.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
      return ok(JSON.stringify({ items: unique }));
    } else {
      // 단일 쿼리 (시장 뉴스)
      const items = await searchNaver(q, n);
      return ok(JSON.stringify({ items }));
    }
  } catch(e) {
    return respond(500, { error: e.message });
  }
};

async function searchNaver(query, count) {
  const path = `/v1/search/news.json?query=${encodeURIComponent(query)}&display=${count}&sort=date`;
  try {
    const r = await httpsGet('openapi.naver.com', path);
    if (r.status !== 200) return [];
    const json = JSON.parse(r.body);
    return (json.items || []).slice(0, count).map(item => ({
      title:       cleanHtml(item.title),
      link:        item.originallink || item.link,
      description: cleanHtml(item.description),
      pubDate:     item.pubDate
    }));
  } catch(e) { return []; }
}

function cleanHtml(str) {
  return (str || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function httpsGet(hostname, path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        path,
        method: 'GET',
        headers: {
          'X-Naver-Client-Id':     CLIENT_ID,
          'X-Naver-Client-Secret': CLIENT_SECRET,
          'Accept': 'application/json'
        }
      },
      res => {
        let body = '';
        res.on('data', c => { body += c; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
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
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(obj)
  };
}
