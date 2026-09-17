const BASE='https://api.twelvedata.com';
function json(status,body){return {statusCode:status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, max-age=0','access-control-allow-origin':'*'},body:JSON.stringify(body)}}
function n(v){const x=Number(v);return Number.isFinite(x)?x:null}
function deep(obj,names){const wanted=new Set(names.map(x=>x.toLowerCase())),stack=[obj];while(stack.length){const x=stack.shift();if(!x||typeof x!=='object')continue;for(const [k,v] of Object.entries(x)){if(wanted.has(k.toLowerCase()))return v;if(v&&typeof v==='object')stack.push(v)}}return null}
async function call(path,params,key){const u=new URL(BASE+path);for(const [k,v] of Object.entries(params||{}))u.searchParams.set(k,String(v));u.searchParams.set('apikey',key);const r=await fetch(u,{headers:{Accept:'application/json'}});const data=await r.json().catch(()=>({}));return {r,data}}
exports.handler=async function(event){
  if(event.httpMethod!=='GET')return json(405,{ok:false,error:'GET only'});
  const key=process.env.TWELVE_DATA_API_KEY||process.env.TWELVE_API_KEY||'';
  if(!key)return json(503,{ok:false,configured:false,error:'TWELVE_DATA_API_KEY non configurée dans Netlify'});
  const q=event.queryStringParameters||{},mode=String(q.mode||'usage').toLowerCase();
  try{
    if(mode==='usage'){
      const {r,data}=await call('/api_usage',{},key);
      const left=n(r.headers.get('api-credits-left'))??n(deep(data,['credits_left','creditsLeft','api_credits_left','remaining_credits','remainingCredits']));
      const used=n(r.headers.get('api-credits-used'))??n(deep(data,['credits_used','creditsUsed','api_credits_used','used_credits','usedCredits']));
      const plan=deep(data,['plan','plan_name','name']);
      if(!r.ok||data?.status==='error')return json(r.status||502,{ok:false,configured:true,error:data?.message||data?.error||`Twelve HTTP ${r.status}`,creditsLeft:left,creditsUsed:used});
      return json(200,{ok:true,configured:true,plan:typeof plan==='string'?plan:'',creditsLeft:left,creditsUsed:used});
    }
    if(mode==='price'){
      const symbol=String(q.symbol||'').toUpperCase();
      if(!/^[A-Z0-9._-]{1,20}\/[A-Z0-9._-]{1,20}$/.test(symbol))return json(400,{ok:false,configured:true,error:'Symbole invalide'});
      const {r,data}=await call('/price',{symbol},key);
      const left=n(r.headers.get('api-credits-left')),used=n(r.headers.get('api-credits-used'));
      if(!r.ok||data?.status==='error')return json(r.status||502,{ok:false,configured:true,error:data?.message||data?.error||`Twelve HTTP ${r.status}`,creditsLeft:left,creditsUsed:used});
      const price=n(data?.price);if(!(price>0))return json(502,{ok:false,configured:true,error:'Prix Twelve invalide',creditsLeft:left,creditsUsed:used});
      return json(200,{ok:true,configured:true,symbol,price,creditsLeft:left,creditsUsed:used});
    }
    return json(400,{ok:false,configured:true,error:'Mode inconnu'});
  }catch(e){return json(502,{ok:false,configured:true,error:e?.message||'Erreur Twelve Data'});}
};
