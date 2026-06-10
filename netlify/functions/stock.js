// Netlify 서버리스 함수 — 서버에서 Yahoo Finance 호출 (CORS 완전 우회)
// 경로: /.netlify/functions/stock?ticker=NVDA&range=1d&interval=1d

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const ticker   = params.ticker;
  const range    = params.range    || '1d';
  const interval = params.interval || '1d';

  if (!ticker) {
    return respond(400, { error: 'ticker 파라미터 필요' });
  }

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/` +
    `${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      }
    });

    if (!res.ok) {
      // query2 로 재시도
      const res2 = await fetch(url.replace('query1', 'query2'), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      });
      if (!res2.ok) return respond(502, { error: `Yahoo ${res2.status}` });
      const body2 = await res2.text();
      return ok(body2);
    }

    const body = await res.text();
    return ok(body);
  } catch (e) {
    return respond(500, { error: e.message });
  }
};

function ok(body) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type':  'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store, no-cache'
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
