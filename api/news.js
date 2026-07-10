// Vercel 서버리스 함수 — Google News RSS
const https = require('https');
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  const p = req.query || {};
  const q = p.q, names = p.names, n = Math.min(parseInt(p.n) || 8, 20);
  if (!q && !names) { res.status(400).json({ error: 'q or names required' }); return; }
  try {
    if (names) {
      const list = names.split(',').map(s=>s.trim()).filter(Boolean).slice(0,20);
      const results = await Promise.all(list.map(name=>searchGoogle(name+' 주가',1)));
      const items = results.flat().filter(x=>x&&x.title);
      const seen=new Set(), unique=items.filter(x=>{if(seen.has(x.title))return false;seen.add(x.title);return true;});
      unique.sort((a,b)=>new Date(b.pubDate||0)-new Date(a.pubDate||0));
      res.status(200).json({ items: unique });
    } else {
      const items = await searchGoogle(q, n);
      res.status(200).json({ items });
    }
  } catch(e) { res.status(500).json({ error: e.message }); }
};
async function searchGoogle(query,count){
  const path='/rss/search?q='+encodeURIComponent(query)+'&hl=ko&gl=KR&ceid=KR:ko';
  try{const r=await httpsGet('news.google.com',path);if(r.status!==200)return[];return parseRSS(r.body).slice(0,count);}catch(e){return[];}
}
function parseRSS(xml){const items=[];const re=/<item>([\s\S]*?)<\/item>/g;let m;while((m=re.exec(xml))!==null){const b=m[1];const title=extract(b,'title'),link=tag(b,'link'),pubDate=tag(b,'pubDate'),source=attr(b,'source','url')||extract(b,'source')||'';if(title)items.push({title,link,pubDate,source});}return items;}
function extract(b,t){const m=b.match(new RegExp('<'+t+'[^>]*>\\s*(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?\\s*</'+t+'>','s'));return m?m[1].trim():'';}
function tag(b,t){const m=b.match(new RegExp('<'+t+'[^>]*>([^<]*)</'+t+'>'));return m?m[1].trim():'';}
function attr(b,t,a){const m=b.match(new RegExp('<'+t+'[^>]*'+a+'="([^"]*)"[^>]*>'));return m?m[1].trim():'';}
function httpsGet(hostname,path){return new Promise((resolve,reject)=>{const req=https.get({hostname,path,headers:{'User-Agent':'Mozilla/5.0','Accept-Language':'ko-KR,ko;q=0.9'}},res=>{if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){try{const u=new URL(res.headers.location);resolve(httpsGet(u.hostname,u.pathname+u.search));}catch(e){resolve({status:res.statusCode,body:''});}return;}let body='';res.on('data',c=>{body+=c;});res.on('end',()=>resolve({status:res.statusCode,body}));});req.on('error',reject);req.setTimeout(12000,()=>{req.destroy();reject(new Error('timeout'));});req.end();});}
