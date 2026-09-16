import {requireAuth,json} from "./auth-lib.mjs";
const BASE="https://api.coingecko.com/api/v3";
function headers(){const h={accept:"application/json"};if(process.env.COINGECKO_API_KEY)h["x-cg-demo-api-key"]=process.env.COINGECKO_API_KEY;return h}
async function grab(id,days){
 const r=await fetch(`${BASE}/coins/${encodeURIComponent(id)}/market_chart?vs_currency=eur&days=${days}`,{headers:headers()});
 if(!r.ok)throw new Error(String(r.status));return r.json()
}
export default async (req)=>{
 const a=requireAuth(req);if(!a.ok)return json({error:a.message},a.status);
 const id=new URL(req.url).searchParams.get("id");if(!id)return json({error:"id manquant"},400,a.headers);
 try{const d=await grab(id,730);return json({prices:d.prices||[],days:730,upstream_calls:1},200,a.headers)}
 catch(e){try{const d=await grab(id,365);return json({prices:d.prices||[],days:365,upstream_calls:1},200,a.headers)}
 catch(e2){return json({error:`Historique CoinGecko indisponible (${e2.message})`},502,a.headers)}}
};
