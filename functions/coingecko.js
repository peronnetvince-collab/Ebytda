const DEMO_BASE='https://api.coingecko.com/api/v3';
const PRO_BASE='https://pro-api.coingecko.com/api/v3';

function json(status,body){
  return {statusCode:status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, max-age=0','access-control-allow-origin':'*'},body:JSON.stringify(body)};
}
function safeId(v){return /^[a-z0-9._-]{1,100}$/i.test(String(v||''))?String(v):''}
function safeIds(v){return String(v||'').split(',').map(x=>safeId(x.trim())).filter(Boolean).slice(0,250).join(',')}
async function upstream(path,params={}){
  const proKey=process.env.COINGECKO_PRO_API_KEY||'';
  const demoKey=process.env.COINGECKO_DEMO_API_KEY||process.env.COINGECKO_API_KEY||'';
  const isPro=!!proKey;
  const key=proKey||demoKey;
  const base=isPro?PRO_BASE:DEMO_BASE;
  const u=new URL(base+path);
  for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&String(v)!=='')u.searchParams.set(k,String(v));
  const headers={Accept:'application/json'};
  if(key)headers[isPro?'x-cg-pro-api-key':'x-cg-demo-api-key']=key;
  const r=await fetch(u,{headers});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){
    let msg=data?.error||data?.status?.error_message||data?.message||`CoinGecko HTTP ${r.status}`;
    if(!key&&(r.status===401||r.status===403||r.status===429))msg=`${msg} • Ajoute COINGECKO_DEMO_API_KEY dans Netlify`;
    return {ok:false,status:r.status,data:{ok:false,error:msg,configured:!!key,tier:isPro?'PRO':key?'DEMO':'PUBLIC'}};
  }
  return {ok:true,status:200,data};
}

exports.handler=async function(event){
  if(event.httpMethod!=='GET')return json(405,{ok:false,error:'GET only'});
  const q=event.queryStringParameters||{};
  const mode=String(q.mode||'status').toLowerCase();
  try{
    let result;
    if(mode==='status') result=await upstream('/ping');
    else if(mode==='markets'){
      const page=Math.max(1,Math.min(2,Number(q.page)||1));
      result=await upstream('/coins/markets',{vs_currency:'usd',order:'market_cap_desc',per_page:250,page,sparkline:'false',price_change_percentage:'1h,24h,7d,14d,30d,200d,1y'});
    } else if(mode==='simple'){
      const ids=safeIds(q.ids); if(!ids)return json(400,{ok:false,error:'ids invalides'});
      const allowedVs=String(q.vs||'usd').split(',').map(x=>x.trim().toLowerCase()).filter(x=>['usd','eur'].includes(x)).join(',')||'usd';
      result=await upstream('/simple/price',{ids,vs_currencies:allowedVs});
    } else if(mode==='coin'){
      const id=safeId(q.id); if(!id)return json(400,{ok:false,error:'id invalide'});
      result=await upstream(`/coins/${encodeURIComponent(id)}`,{localization:'false',tickers:'false',market_data:'false',community_data:'false',developer_data:'false',sparkline:'false'});
    } else if(mode==='ohlc'){
      const id=safeId(q.id); if(!id)return json(400,{ok:false,error:'id invalide'});
      const allowed=new Set(['1','7','14','30','90','180','365']);
      const days=allowed.has(String(q.days))?String(q.days):'1';
      result=await upstream(`/coins/${encodeURIComponent(id)}/ohlc`,{vs_currency:'usd',days});
    } else return json(400,{ok:false,error:'Mode inconnu'});
    return json(result.status,result.data);
  }catch(e){return json(502,{ok:false,error:e?.message||'Erreur proxy CoinGecko'});}
};
