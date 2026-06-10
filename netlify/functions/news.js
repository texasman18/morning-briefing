// Netlify 서버리스 함수 — Google News RSS (인증키 불필요, 한국어 뉴스)
// GET /.netlify/functions/news?names=삼성전자,SK하이닉스,...&n=1  (종목별 배치)
// GET /.netlify/functions/news?q=코스피 증시 시황&n=8            (시장 뉴스)
const https = require('https');

exports.handler = async (event) => {
  const p     = event.queryStringParameters || {};
  const q     = p.q;
  const names = p.names;
  const n     = Math.min(parseInt(p.n) || 8, 20);

  if (!q && !names) return respond(400, { error: 'q or names required' });

  try {
    if (names) {
      // 배치: 종목명별 1개씩 병렬 검색
      const list = names.split(',').map(s => s.trim()).filter(Boolean).slice(0, 20);
      const results = await Promise.all(
        list.map(name => searchGoogle(name + ' 주가', 1))
      );
      const items = results.flat().filter(x => x && x.title);

      // 중복 제거
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
      const items = await searchGoogle(q, n);
      return ok(JSON.stringify({ items }));
    }
  } catch(e) {
    return respond(500, { error: e.message });
  }
};

async function searchGoogle(query, count) {
  // Google News RSS — 인증키 불필요, hl=ko&gl=KR&ceid=KR:ko 로 한국어 뉴스 반환
  const path = `/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
  try {
    const r = await httpsGet('news.google.com', path);
    if (r.status !== 200) return [];
    const items = parseRSS(r.body);
    return items.slice(0, count);
  } catch(e) { return []; }
}

// ── 간단한 RSS XML 파서 (의존성 없음) ──
function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title       = extractCdata(block, 'title');
    const link        = extractTag(block, 'link');
    const description = extractCdata(block, 'description');
    const pubDate     = extractTag(block, 'pubDate');
    const source      = extractCdata(block, 'source');
    if (title) {
      items.push({
        title:       cleanText(title),
        link:        link || '',
        description: cleanText(description),
        pubDate:     pubDate || '',
        source:      source || ''
      });
    }
  }
  return items;
}

function extractCdata(block, tag) {
  // <tag><![CDATA[...]]></tag> 또는 <tag>...</tag>
  const r1 = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/${tag}>`, 'i');
  const r2 = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i');
  let m = r1.exec(block) || r2.exec(block);
  return m ? m[1].trim() : '';
}

function extractTag(block, tag) {
  // <link> 는 self-closing 없이 텍스트 형태
  const r = new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>|<${tag}[^>]*\/>`, 'i');
  // <link> 태그는 특수 처리: </link> 없이 다음 태그 앞까지
  const r2 = new RegExp(`<${tag}>([\\s\\S]*?)(?:<|$)`, 'i');
  let m = r.exec(block) || r2.exec(block);
  return m ? (m[1] || '').trim() : '';
}

function cleanText(str) {
  return (str || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
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
          'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
          'Accept': 'application/rss+xml, application/xml, text/xml'
        }
      },
      res => {
        // Google News RSS는 301/302 리다이렉트 가능
        if (res.statusCode === 301 || res.statusCode === 302) {
          const loc = res.headers.location || '';
          if (loc) {
            try {
              const u = new URL(loc);
              resolve(httpsGet(u.hostname, u.pathname + u.search));
            } catch(e) { resolve({ status: res.statusCode, body: '' }); }
          } else {
            resolve({ status: res.statusCode, body: '' });
          }
          return;
        }
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
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Netlify-CDN-Cache-Control': 'no-store'
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
