import {requireAuth,json} from "./auth-lib.mjs";
const BASE="https://api.coingecko.com/api/v3";
function headers(){const h={accept:"application/json"};if(process.env.COINGECKO_API_KEY)h["x-cg-demo-api-key"]=process.env.COINGECKO_API_KEY;return h}
export default async (req)=>{
 const a=requireAuth(req);if(!a.ok)return json({error:a.message},a.status);
 const q="vs_currency=eur&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=1h%2C24h%2C7d%2C30d";
 const r=await fetch(`${BASE}/coins/markets?${q}`,{headers:headers()});
 if(!r.ok)return json({error:`CoinGecko ${r.status}`},502,a.headers);
 const coins=(await r.json()).slice(0,100);
 return json({coins,upstream_calls:1,universe:"top_100_market_cap"},200,a.headers);
};
