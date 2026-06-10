// Netlify 서버리스 함수 — Yahoo Finance 뉴스 API 사용 (stock.js와 동일 서버)
// GET /.netlify/functions/news?tickers=005930.KS,000660.KS&n=1   (종목별 배치)
// GET /.netlify/functions/news?q=KOSPI+market&n=8               (시장 뉴스)
const https = require('https');

exports.handler = async (event) => {
  const p       = event.queryStringParameters || {};
  const tickers = p.tickers;  // 쉼표 구분 티커 배치 모드
  const q       = p.q;        // 단일 검색어 모드
  const n       = Math.min(parseInt(p.n) || 8, 20);

  if (!q && !tickers) return respond(400, { error: 'q or tickers required' });

  try {
    if (tickers) {
      // ── 배치: 티커별 1개씩 병렬 fetch ───────────────────────
      const list = tickers.split(',').map(s => s.trim()).filter(Boolean).slice(0, 15);
      const results = await Promise.all(list.map(t => fetchTickerNews(t, 1)));
      const items = results.flat().filter(x => x && x.title);
      items.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
      return ok(JSON.stringify({ items }));
    } else {
      // ── 단일 검색어 ─────────────────────────────────────────
      const items = await searchNews(q, n);
      return ok(JSON.stringify({ items }));
    }
  } catch(e) {
    return respond(500, { error: e.message });
  }
};

// 티커로 뉴스 가져오기 (Yahoo Finance search API)
async function fetchTickerNews(ticker, count) {
  const path = `/v1/finance/search?q=${encodeURIComponent(ticker)}`
    + `&newsCount=${count}&quotesCount=0`
    + `&enableFuzzyQuery=false&enableNavLinks=false&enableCb=false`;

  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    try {
      const r = await yhFetch(host, path);
      if (r.status === 200) {
        const json = JSON.parse(r.body);
        const news = json?.news || [];
        return news.slice(0, count).map(itemToObj);
      }
    } catch(e) { /* 다음 host */ }
  }
  return [];
}

// 검색어로 뉴스 가져오기
async function searchNews(query, count) {
  const path = `/v1/finance/search?q=${encodeURIComponent(query)}`
    + `&newsCount=${count}&quotesCount=0`
    + `&enableFuzzyQuery=true&enableNavLinks=false&enableCb=false`;

  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    try {
      const r = await yhFetch(host, path);
      if (r.status === 200) {
        const json = JSON.parse(r.body);
        const news = json?.news || [];
        return news.slice(0, count).map(itemToObj);
      }
    } catch(e) { /* 다음 host */ }
  }
  return [];
}

function itemToObj(n) {
  return {
    title:       clean(n.title || ''),
    link:        n.link || '',
    description: clean(n.summary || n.description || ''),
    pubDate:     n.providerPublishTime
      ? new Date(n.providerPublishTime * 1000).toUTCString()
      : (n.pubDate || '')
  };
}

function clean(str) {
  return (str || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .trim();
}

// Yahoo Finance용 HTTPS GET (stock.js와 동일한 헤더)
function yhFetch(host, path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        path,
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
            'AppleWebKit/537.36 (KHTML, like Gecko) ' +
            'Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache'
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
