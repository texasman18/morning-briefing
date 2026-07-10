// Vercel 서버리스 함수 — Yahoo Finance 주가
const https = require('https');
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  const {ticker, range='1d', interval='1d'} = req.query||{};
  if (!ticker) { res.status(400).json({ error: 'ticker required' }); return; }
  const hosts=['query1.finance.yahoo.com','query2.finance.yahoo.com'];
  const path='/v8/finance/chart/'+encodeURIComponent(ticker)+'?range='+range+'&interval='+interval;
  for(const host of hosts){try{const r=await httpsGet(host,path);if(r.status===200){res.setHeader('Content-Type','application/json');res.status(200).send(r.body);return;}}catch(e){}}
  res.status(502).json({error:'Yahoo Finance 응답 없음'});
};
function httpsGet(host,path){return new Promise((resolve,reject)=>{const req=https.request({hostname:host,path,method:'GET',headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','Accept':'application/json','Accept-Language':'en-US,en;q=0.9'}},(res)=>{let body='';res.on('data',c=>{body+=c;});res.on('end',()=>resolve({status:res.statusCode,body}));});req.on('error',reject);req.setTimeout(12000,()=>{req.destroy();reject(new Error('timeout'));});req.end();});}
