// Vercel 서버리스 함수 — 토스증권 Open API 보유종목(홀딩스) 조회
// 시크릿(TOSS_CLIENT_ID, TOSS_CLIENT_SECRET)은 Vercel 환경변수로만 존재하며
// 이 함수 밖(브라우저)으로는 절대 전달되지 않습니다.
const https = require('https');

let cachedAccountSeq = null;

function postForm(host, path, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

function getJSON(host, path, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: host, path, method: 'GET', headers }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

async function getAccessToken() {
  const clientId = process.env.TOSS_CLIENT_ID;
  const clientSecret = process.env.TOSS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    const e = new Error('missing-toss-credentials');
    e.code = 'missing-toss-credentials';
    throw e;
  }
  const body = 'grant_type=client_credentials'
    + '&client_id=' + encodeURIComponent(clientId)
    + '&client_secret=' + encodeURIComponent(clientSecret);
  const r = await postForm('openapi.tossinvest.com', '/oauth2/token', body);
  if (r.status !== 200) {
    const e = new Error('token-issue-failed: ' + r.body);
    e.code = 'token-issue-failed';
    throw e;
  }
  const json = JSON.parse(r.body);
  return json.access_token;
}

async function getAccountSeq(token) {
  if (cachedAccountSeq) return cachedAccountSeq;
  const r = await getJSON('openapi.tossinvest.com', '/api/v1/accounts', {
    Authorization: 'Bearer ' + token,
    Accept: 'application/json',
  });
  if (r.status !== 200) {
    const e = new Error('accounts-fetch-failed: ' + r.body);
    e.code = 'accounts-fetch-failed';
    throw e;
  }
  const json = JSON.parse(r.body);
  const result = json.result || json;
  const list = Array.isArray(result) ? result : (result.items || result.accounts || []);
  const brokerage = list.find((a) => a.accountType === 'BROKERAGE') || list[0];
  if (!brokerage) {
    const e = new Error('no-account-found');
    e.code = 'no-account-found';
    throw e;
  }
  cachedAccountSeq = brokerage.accountSeq;
  return cachedAccountSeq;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const token = await getAccessToken();
    const accountSeq = await getAccountSeq(token);

    const r = await getJSON('openapi.tossinvest.com', '/api/v1/holdings', {
      Authorization: 'Bearer ' + token,
      'X-Tossinvest-Account': String(accountSeq),
      Accept: 'application/json',
    });

    if (r.status !== 200) {
      res.status(502).json({ error: 'holdings-fetch-failed', detail: r.body });
      return;
    }

    const json = JSON.parse(r.body);
    const overview = json.result || {};

    const items = (overview.items || []).map((it) => ({
      symbol: it.symbol,
      name: it.name,
      market: it.marketCountry,
      currency: it.currency,
      quantity: it.quantity,
      lastPrice: it.lastPrice,
      avgPrice: it.averagePurchasePrice,
      purchaseAmount: it.marketValue ? it.marketValue.purchaseAmount : null,
      marketValue: it.marketValue ? it.marketValue.amount : null,
      profitAmount: it.profitLoss ? it.profitLoss.amount : null,
      profitRate: it.profitLoss ? it.profitLoss.rate : null,
    }));

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      updatedAt: new Date().toISOString(),
      totalPurchaseAmount: {
        krw: overview.totalPurchaseAmount ? overview.totalPurchaseAmount.krw : 0,
        usd: overview.totalPurchaseAmount ? overview.totalPurchaseAmount.usd : null,
      },
      marketValue: {
        krw: overview.marketValue && overview.marketValue.amount ? overview.marketValue.amount.krw : 0,
        usd: overview.marketValue && overview.marketValue.amount ? overview.marketValue.amount.usd : null,
      },
      profitLoss: {
        krw: overview.profitLoss && overview.profitLoss.amount ? overview.profitLoss.amount.krw : 0,
        usd: overview.profitLoss && overview.profitLoss.amount ? overview.profitLoss.amount.usd : null,
        rate: overview.profitLoss ? overview.profitLoss.rate : null,
      },
      items,
    });
  } catch (e) {
    res.status(500).json({ error: 'holdings-error', code: e.code || null, message: String((e && e.message) || e) });
  }
};
