const BASE='https://api.twelvedata.com';

function json(status,body){
  return {statusCode:status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, max-age=0'},body:JSON.stringify(body)};
}
function safeNumber(v){const n=Number(v);return Number.isFinite(n)?n:null}
function findDeep(obj,names){
  const wanted=new Set(names.map(x=>x.toLowerCase()));
  const stack=[obj];
  while(stack.length){const x=stack.shift();if(!x||typeof x!=='object')continue;for(const [k,v] of Object.entries(x)){if(wanted.has(k.toLowerCase()))return v;if(v&&typeof v==='object')stack.push(v)}}
  return null;
}

exports.handler=async function(event){
  if(event.httpMethod!=='GET')return json(405,{ok:false,error:'GET only'});
  const key=process.env.TWELVE_DATA_API_KEY||process.env.TWELVE_API_KEY||'';
  if(!key)return json(503,{ok:false,configured:false,error:'TWELVE_DATA_API_KEY non configurée dans Netlify'});
  const mode=String(event.queryStringParameters?.mode||'usage').toLowerCase();
  try{
    if(mode==='usage'){
      const r=await fetch(`${BASE}/api_usage`,{headers:{Authorization:`apikey ${key}`,Accept:'application/json'}});
      const data=await r.json().catch(()=>({}));
      const hLeft=safeNumber(r.headers.get('api-credits-left'));
      const hUsed=safeNumber(r.headers.get('api-credits-used'));
      const left=hLeft??safeNumber(findDeep(data,['credits_left','creditsLeft','api_credits_left','remaining_credits','remainingCredits']));
      const used=hUsed??safeNumber(findDeep(data,['credits_used','creditsUsed','api_credits_used','used_credits','usedCredits']));
      const plan=findDeep(data,['plan','plan_name','name']);
      if(!r.ok){const msg=data?.message||data?.error||`Twelve HTTP ${r.status}`;return json(r.status,{ok:false,configured:true,error:msg,creditsLeft:left,creditsUsed:used,raw:data})}
      return json(200,{ok:true,configured:true,plan:typeof plan==='string'?plan:'',creditsLeft:left,creditsUsed:used});
    }
    if(mode==='price'){
      const symbol=String(event.queryStringParameters?.symbol||'').toUpperCase();
      if(!/^[A-Z0-9._-]{1,20}\/[A-Z0-9._-]{1,20}$/.test(symbol))return json(400,{ok:false,configured:true,error:'Symbole invalide'});
      const url=new URL(`${BASE}/price`);url.searchParams.set('symbol',symbol);
      const r=await fetch(url,{headers:{Authorization:`apikey ${key}`,Accept:'application/json'}});
      const data=await r.json().catch(()=>({}));
      const left=safeNumber(r.headers.get('api-credits-left')),used=safeNumber(r.headers.get('api-credits-used'));
      if(!r.ok||data?.status==='error'){const msg=data?.message||data?.error||`Twelve HTTP ${r.status}`;return json(r.status||502,{ok:false,configured:true,error:msg,creditsLeft:left,creditsUsed:used})}
      const price=safeNumber(data?.price);if(!(price>0))return json(502,{ok:false,configured:true,error:'Prix Twelve invalide',creditsLeft:left,creditsUsed:used});
      return json(200,{ok:true,configured:true,symbol,price,creditsLeft:left,creditsUsed:used});
    }
    return json(400,{ok:false,configured:true,error:'Mode inconnu'});
  }catch(e){return json(502,{ok:false,configured:true,error:e?.message||'Erreur Twelve Data'})}
};
