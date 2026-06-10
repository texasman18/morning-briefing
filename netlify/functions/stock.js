// Netlify 서버리스 함수 — Node.js https 모듈 사용 (버전 무관)
const https = require('https');

exports.handler = async (event) => {
  const p = event.queryStringParameters || {};
  const ticker   = p.ticker;
  const range    = p.range    || '1d';
  const interval = p.interval || '1d';

  if (!ticker) {
    return respond(400, { error: 'ticker required' });
  }

  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  const path  = `/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`;

  for (const host of hosts) {
    try {
      const result = await httpsGet(host, path);
      if (result.status === 200) {
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store'
          },
          body: result.body
        };
      }
    } catch (e) { /* 다음 host 시도 */ }
  }

  return respond(502, { error: 'Yahoo Finance 응답 없음' });
};

function httpsGet(host, path) {
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
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
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
