const COINLORE_BASE='https://api.coinlore.net/api';
const BINANCE_BASE='https://api.binance.com';
const FRANKFURTER_BASE='https://api.frankfurter.dev/v2';

const CACHE={
  universe:{at:0,payload:null},
  prices:{at:0,payload:null},
  fx:{at:0,payload:null},
  age:new Map(),
  deep:new Map()
};

const STABLE=new Set(['USDT','USDC','DAI','FDUSD','USDE','USDS','PYUSD','TUSD','USDD','FRAX','USDP','GUSD','EURS','EURC']);
const AGE_TTL=30*86400000;
const DEEP_TTL=6*60*60*1000;
const CUTOFF=()=>Date.now()-730*86400000;

function out(status,body,ttl=0){
  const headers={
    'content-type':'application/json; charset=utf-8',
    'access-control-allow-origin':'*',
    'cache-control':ttl>0?`public, max-age=${ttl}`:'no-store, max-age=0'
  };
  if(ttl>0)headers['netlify-cdn-cache-control']=`public, max-age=${ttl}, stale-while-revalidate=${Math.max(ttl*4,120)}`;
  return {statusCode:status,headers,body:JSON.stringify(body)};
}
function n(v,d=0){const x=Number(v);return Number.isFinite(x)?x:d}
function cleanSymbol(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'')}
async function getJson(url,{headers={},timeout=9000}={}){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeout);
  try{
    const r=await fetch(url,{headers:{accept:'application/json',...headers},signal:c.signal});
    const text=await r.text();
    let data=null;try{data=JSON.parse(text)}catch{}
    if(!r.ok)throw Object.assign(new Error(data?.error||data?.message||`HTTP ${r.status}`),{status:r.status,data});
    if(data===null)throw new Error('Réponse JSON invalide');
    return data;
  }finally{clearTimeout(timer)}
}
function yearsSince(date){const t=Date.parse(date||'');return Number.isFinite(t)?Math.max(0,(Date.now()-t)/(365.25*86400000)):0}

async function coinLoreTickers(){
  const pages=await Promise.all([0,100,200].map(start=>getJson(`${COINLORE_BASE}/tickers/?start=${start}&limit=100`,{timeout:7000})));
  const rows=pages.flatMap(x=>Array.isArray(x?.data)?x.data:[]);
  if(rows.length<200)throw new Error(`CoinLore: univers incomplet ${rows.length}`);
  return rows;
}
async function coinLoreAge(id){
  const key=String(id),cached=CACHE.age.get(key);
  if(cached&&Date.now()-cached.at<AGE_TTL)return cached;
  const data=await getJson(`${COINLORE_BASE}/coin/info/?id=${encodeURIComponent(key)}`,{timeout:3500});
  const x=Array.isArray(data)?data[0]:null;
  const first=x?.first_price_date||null;
  const launch=x?.startdate||null;
  const evidence=first||launch||null;
  const mature=!!evidence&&Date.parse(evidence)<=CUTOFF();
  const payload={at:Date.now(),mature,firstPriceDate:first,startDate:launch,historyYears:yearsSince(evidence),logo:x?.logo||''};
  CACHE.age.set(key,payload);
  return payload;
}
async function matureCoinLoreUniverse(){
  const now=Date.now();
  if(CACHE.universe.payload&&now-CACHE.universe.at<12*60*1000)return {...CACHE.universe.payload,cache:true};
  const raw=await coinLoreTickers();
  const base=raw
    .filter(x=>n(x.price_usd)>0&&n(x.market_cap_usd)>0&&n(x.rank)>0&&!STABLE.has(cleanSymbol(x.symbol)))
    .sort((a,b)=>n(a.rank,9999)-n(b.rank,9999))
    .slice(0,280);

  const mature=[];
  const batchSize=36;
  for(let i=0;i<base.length&&mature.length<200;i+=batchSize){
    const batch=base.slice(i,i+batchSize);
    const checked=await Promise.allSettled(batch.map(async x=>({x,age:await coinLoreAge(x.id)})));
    for(const r of checked){
      if(r.status!=='fulfilled'||!r.value.age.mature)continue;
      const {x,age}=r.value;
      mature.push({
        id:`coinlore-${x.id}`,
        provider_id:String(x.id),
        symbol:String(x.symbol||'').toLowerCase(),
        name:x.name||x.symbol||String(x.id),
        image:age.logo||'',
        current_price:n(x.price_usd),
        market_cap_rank:n(x.rank,9999),
        market_cap:n(x.market_cap_usd),
        total_volume:n(x.volume24),
        price_change_percentage_15m_in_currency:null,
        price_change_percentage_30m_in_currency:null,
        price_change_percentage_1h_in_currency:n(x.percent_change_1h),
        price_change_percentage_6h_in_currency:null,
        price_change_percentage_12h_in_currency:null,
        price_change_percentage_24h:n(x.percent_change_24h),
        price_change_percentage_7d_in_currency:n(x.percent_change_7d),
        price_change_percentage_14d_in_currency:null,
        price_change_percentage_30d_in_currency:null,
        price_change_percentage_200d_in_currency:null,
        price_change_percentage_1y_in_currency:null,
        first_data_at:age.firstPriceDate||age.startDate,
        historyYears:age.historyYears,
        mature2y:true,
        mtfFull:false,
        source:'COINLORE',
        last_updated:new Date().toISOString(),
        ath_change_percentage:-50
      });
      if(mature.length>=200)break;
    }
  }
  if(mature.length<200){
    if(CACHE.universe.payload)return {...CACHE.universe.payload,source:'COINLORE_CACHE',fresh:false,warning:`Vérification maturité partielle ${mature.length}/200`};
    throw new Error(`CoinLore: seulement ${mature.length}/200 actifs avec ≥2 ans vérifiés`);
  }
  const rows=mature.slice(0,200);
  await enrichRollingWindows(rows);
  const payload={ok:true,source:'COINLORE + BINANCE MTF',fresh:true,rows,updatedAt:new Date().toISOString(),maturityVerified:true};
  CACHE.universe={at:now,payload};
  return payload;
}

async function binanceAllPrices(){
  const now=Date.now();
  if(CACHE.prices.payload&&now-CACHE.prices.at<8000)return CACHE.prices.payload;
  const data=await getJson(`${BINANCE_BASE}/api/v3/ticker/price`,{timeout:8000});
  if(!Array.isArray(data))throw new Error('Binance: prix invalides');
  const map={};for(const x of data){const p=n(x.price);if(p>0)map[String(x.symbol||'').toUpperCase()]=p}
  CACHE.prices={at:now,payload:map};return map;
}
async function rollingWindow(symbols,windowSize){
  const result={};
  for(let i=0;i<symbols.length;i+=100){
    const batch=symbols.slice(i,i+100).map(s=>`${cleanSymbol(s)}USDT`);
    if(!batch.length)continue;
    const u=new URL(`${BINANCE_BASE}/api/v3/ticker`);
    u.searchParams.set('symbols',JSON.stringify(batch));u.searchParams.set('windowSize',windowSize);u.searchParams.set('type','MINI');
    const data=await getJson(u.toString(),{timeout:8000});
    for(const x of (Array.isArray(data)?data:[data])){
      const sym=String(x.symbol||'').replace(/USDT$/,'');
      const pct=n(x.priceChangePercent,NaN);if(sym&&Number.isFinite(pct))result[sym]=pct;
    }
  }
  return result;
}
async function enrichRollingWindows(rows){
  try{
    const all=await binanceAllPrices();
    const symbols=rows.map(r=>cleanSymbol(r.symbol)).filter(s=>all[`${s}USDT`]>0);
    const [m15,m30,h1,h6,h12,d7]=await Promise.all([
      rollingWindow(symbols,'15m'),rollingWindow(symbols,'30m'),rollingWindow(symbols,'1h'),rollingWindow(symbols,'6h'),rollingWindow(symbols,'12h'),rollingWindow(symbols,'7d')
    ]);
    for(const r of rows){
      const s=cleanSymbol(r.symbol),px=n(all[`${s}USDT`]);
      if(px>0)r.current_price=px;
      if(Number.isFinite(m15[s]))r.price_change_percentage_15m_in_currency=m15[s];
      if(Number.isFinite(m30[s]))r.price_change_percentage_30m_in_currency=m30[s];
      if(Number.isFinite(h1[s]))r.price_change_percentage_1h_in_currency=h1[s];
      if(Number.isFinite(h6[s]))r.price_change_percentage_6h_in_currency=h6[s];
      if(Number.isFinite(h12[s]))r.price_change_percentage_12h_in_currency=h12[s];
      if(Number.isFinite(d7[s]))r.price_change_percentage_7d_in_currency=d7[s];
      r.binanceListed=px>0;
    }
  }catch(e){
    for(const r of rows)r.rollingWarning=e?.message||String(e);
  }
}

async function prices(symbols=[]){
  const wanted=[...new Set(symbols.map(cleanSymbol).filter(Boolean))].slice(0,50);
  const outPrices={};let error='';
  try{
    const all=await binanceAllPrices();
    for(const s of wanted){const p=n(all[`${s}USDT`]);if(p>0)outPrices[s]=p}
  }catch(e){error=e?.message||String(e)}
  return {ok:true,source:'BINANCE',fresh:Object.keys(outPrices).length>0,prices:outPrices,error,updatedAt:new Date().toISOString()};
}

function pctFromCloses(closes,back){
  if(!Array.isArray(closes)||closes.length<2)return null;
  const last=n(closes[closes.length-1]);
  const idx=Math.max(0,closes.length-1-back),old=n(closes[idx]);
  return last>0&&old>0?(last/old-1)*100:null;
}
async function deepOne(symbol){
  const s=cleanSymbol(symbol),cached=CACHE.deep.get(s);
  if(cached&&Date.now()-cached.at<DEEP_TTL)return cached.data;
  const u=new URL(`${BINANCE_BASE}/api/v3/klines`);u.searchParams.set('symbol',`${s}USDT`);u.searchParams.set('interval','1d');u.searchParams.set('limit','365');
  const data=await getJson(u.toString(),{timeout:7000});
  if(!Array.isArray(data)||data.length<210)throw new Error(`${s}: historique Binance insuffisant`);
  const closes=data.map(x=>n(x[4])).filter(x=>x>0);
  const out={symbol:s,d14:pctFromCloses(closes,14),d30:pctFromCloses(closes,30),d200:pctFromCloses(closes,200),y1:closes.length>=360?pctFromCloses(closes,364):null,days:closes.length};
  out.full=[out.d14,out.d30,out.d200,out.y1].every(Number.isFinite);
  CACHE.deep.set(s,{at:Date.now(),data:out});return out;
}
async function deep(symbols=[]){
  const wanted=[...new Set(symbols.map(cleanSymbol).filter(Boolean))].slice(0,36);
  const rows=[];
  for(let i=0;i<wanted.length;i+=9){
    const res=await Promise.allSettled(wanted.slice(i,i+9).map(deepOne));
    for(const r of res)if(r.status==='fulfilled')rows.push(r.value);
  }
  return {ok:true,source:'BINANCE DAILY KLINES',rows,updatedAt:new Date().toISOString()};
}

async function fx(){
  const now=Date.now();if(CACHE.fx.payload&&now-CACHE.fx.at<60*60*1000)return CACHE.fx.payload;
  try{const d=await getJson(`${FRANKFURTER_BASE}/rate/usd/eur`,{timeout:6000});const payload={ok:true,source:'FRANKFURTER',usdEur:n(d?.rate,.85),updatedAt:new Date().toISOString()};CACHE.fx={at:now,payload};return payload}
  catch(e){const payload={ok:true,source:'FALLBACK',usdEur:.85,warning:e?.message||String(e),updatedAt:new Date().toISOString()};CACHE.fx={at:now,payload};return payload}
}
function intervalForDays(days){const d=n(days,1);if(d<=1)return{interval:'15m',limit:96};if(d<=7)return{interval:'1h',limit:168};if(d<=14)return{interval:'2h',limit:168};if(d<=30)return{interval:'4h',limit:180};if(d<=90)return{interval:'12h',limit:180};return{interval:'1d',limit:Math.min(365,Math.max(90,Math.round(d)))}}
async function klines(symbol,days){
  const s=cleanSymbol(symbol);if(!s)throw new Error('Symbole invalide');const {interval,limit}=intervalForDays(days),u=new URL(`${BINANCE_BASE}/api/v3/klines`);u.searchParams.set('symbol',`${s}USDT`);u.searchParams.set('interval',interval);u.searchParams.set('limit',String(limit));
  const data=await getJson(u.toString(),{timeout:8000});if(!Array.isArray(data))throw new Error('Bougies Binance invalides');
  return {ok:true,source:'BINANCE',symbol:s,interval,rows:data.map(x=>[n(x[0]),n(x[1]),n(x[2]),n(x[3]),n(x[4])])};
}

exports.handler=async function(event){
  if(event.httpMethod!=='GET')return out(405,{ok:false,error:'GET only'});
  const q=event.queryStringParameters||{},mode=String(q.mode||'status').toLowerCase();
  try{
    if(mode==='universe')return out(200,await matureCoinLoreUniverse(),120);
    if(mode==='prices')return out(200,await prices(String(q.symbols||'').split(',')),5);
    if(mode==='deep')return out(200,await deep(String(q.symbols||'').split(',')),900);
    if(mode==='fx')return out(200,await fx(),3600);
    if(mode==='klines')return out(200,await klines(q.symbol,q.days),15);
    if(mode==='status')return out(200,{ok:true,universe:'COINLORE',priceFeed:'BINANCE',deepMtf:'BINANCE DAILY KLINES',coinpaprikaRequired:false,coingeckoRequired:false,keysRequired:false});
    return out(400,{ok:false,error:'Mode inconnu'});
  }catch(e){
    // Keep diagnostic body explicit so the UI never shows an opaque Netlify 502 only.
    return out(502,{ok:false,error:e?.message||'Erreur marketdata',stage:mode,provider:mode==='universe'?'COINLORE':'BINANCE'});
  }
};
