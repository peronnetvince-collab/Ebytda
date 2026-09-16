
'use strict';

const $=(s,p=document)=>p.querySelector(s);
const $$=(s,p=document)=>[...p.querySelectorAll(s)];
const CONFIG={
  api:'https://api.coingecko.com/api/v3',
  normalMs:60*60*1000,
  focusMs:30*60*1000,
  quietStart:1,
  quietEnd:8,
  stable:new Set(['usdt','usdc','dai','fdusd','usde','usds','pyusd','tusd','usdd','frax','usdp','gusd']),
  hist:'ebyt-da-history-v1'
};
const state={
  lang:localStorage.getItem('ebyt-lang')||'fr',
  cur:localStorage.getItem('ebyt-cur')||'eur',
  rows:[],ranked:[],top3:[],market:{},next:null,timer:null,count:null,
  hist:JSON.parse(localStorage.getItem(CONFIG.hist)||'[]')
};

function toast(m){const e=$('#toast');e.textContent=m;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),2500)}
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const pct=(v,d=2)=>Number.isFinite(Number(v))?`${Number(v)>=0?'+':''}${Number(v).toFixed(d)} %`:'—';
const sc=v=>Number(v||0).toFixed(2);
const dir=v=>n(v)>=0?'positive':'negative';

function money(v){
  if(!Number.isFinite(Number(v)))return '—';
  let max=Math.abs(v)<1?6:Math.abs(v)<100?3:2;
  return new Intl.NumberFormat(state.lang==='fr'?'fr-FR':'en-US',{style:'currency',currency:state.cur.toUpperCase(),maximumFractionDigits:max}).format(v)
}
function compact(v){
  if(!Number.isFinite(Number(v)))return '—';
  return new Intl.NumberFormat(state.lang==='fr'?'fr-FR':'en-US',{style:'currency',currency:state.cur.toUpperCase(),notation:'compact',maximumFractionDigits:1}).format(v)
}
function quiet(){const h=new Date().getHours();return h>=CONFIG.quietStart&&h<CONFIG.quietEnd}

function normalizeChange(v,scale=8){return clamp(50+n(v)*scale)}
function seedScore(s){let x=0;for(const c of s)x=(x*31+c.charCodeAt(0))%997;return (x%1000)/1000}

function computeMarket(rows){
  const trade=rows.filter(r=>!CONFIG.stable.has(r.symbol));
  const breadth=trade.length?trade.filter(r=>n(r.price_change_percentage_24h)>=0).length/trade.length*100:50;
  const btc=rows.find(r=>r.symbol==='btc')||trade[0];
  const eth=rows.find(r=>r.symbol==='eth')||trade[1];
  const btc24=n(btc?.price_change_percentage_24h);
  const eth24=n(eth?.price_change_percentage_24h);
  const avg7=trade.length?trade.reduce((a,r)=>a+n(r.price_change_percentage_7d_in_currency),0)/trade.length:0;
  const vol=trade.length?trade.reduce((a,r)=>a+Math.abs(n(r.price_change_percentage_24h)),0)/trade.length:0;

  let label='RANGE / MIXTE',base=60;
  if(breadth>62 && btc24>1){label='RISK-ON';base=80}
  else if(breadth<38 && btc24<-1){label='RISK-OFF';base=42}
  else if(Math.abs(btc24)<0.8 && Math.abs(avg7)<2){label='MARCHÉ PLAT';base=55}
  else if(eth24>btc24+1 && breadth>55){label='ROTATION ALTCOINS';base=77}
  if(vol>5)label+=' • VOLATIL';
  const mode=vol>4.5?'focus':'normal';
  return {breadth,btc,vol,label,base,mode}
}

function scoreAsset(r,m){
  const h1=n(r.price_change_percentage_1h_in_currency);
  const d1=n(r.price_change_percentage_24h);
  const d7=n(r.price_change_percentage_7d_in_currency);
  const d30=n(r.price_change_percentage_30d_in_currency);
  const vmc=n(r.total_volume)/(n(r.market_cap,1));
  const capRank=n(r.market_cap_rank,100);
  const ath=n(r.ath_change_percentage,-50);

  const momentum=clamp(50+h1*8+d1*2.8+d7*.8);
  const trend=clamp(50+d1*2+d7*1.2+d30*.28);
  const volume=clamp(35+Math.log10(Math.max(vmc,0.0001)*10000)*14);
  const stability=clamp(84-Math.abs(d1)*3-Math.max(0,Math.abs(h1)-3)*4);
  const tech=clamp(momentum*.36+trend*.34+volume*.20+stability*.10);

  const capQuality=clamp(92-Math.log10(Math.max(capRank,1))*21);
  const liquidity=clamp(35+Math.log10(Math.max(n(r.total_volume),1))*5.3);
  const recovery=clamp(90+ath*.40);
  const fund=clamp(capQuality*.45+liquidity*.35+recovery*.20);

  const rel=d1-(m.btc? n(m.btc.price_change_percentage_24h):0);
  const regime=clamp(m.base+rel*2.4+(m.breadth-50)*.25);

  const accel=clamp(50+h1*10+(d1-h1*4)*3);
  const fomo=clamp(accel*.38+volume*.23+tech*.24+regime*.15);

  const riskPenalty=Math.max(0,Math.abs(d1)-9)*1.4 + Math.max(0,Math.abs(h1)-5)*2;
  let ai=clamp(tech*.40+fund*.22+regime*.20+fomo*.18-riskPenalty);

  // légère stabilité déterministe pour départager sans bruit aléatoire
  ai=clamp(ai+(seedScore(r.id)-.5)*1.2);
  const confidence=clamp(48+Math.abs(ai-50)*.7+Math.min(12,Math.log10(Math.max(n(r.total_volume),1))*1.1));

  let status='neutral',label='NEUTRE';
  if(ai>=82 && fomo>=78 && regime>=56){status='order';label="ORDRE CONSEILLÉ"}
  else if(ai>=74 && fomo>=68){status='preorder';label='PRÉ-ORDRE'}
  else if(ai>=64){status='watch';label='À SURVEILLER'}

  const volBand=clamp(2.2+Math.abs(d1)*.22+Math.abs(h1)*.38,2,8);
  const p=n(r.current_price);
  const entryLow=p*(1-volBand*.0017),entryHigh=p*(1+volBand*.0010);
  const stop=p*(1-(3.0+volBand*.45)/100);
  const tp1=p*(1+(3.2+volBand*.55)/100);
  const tp2=p*(1+(6.5+volBand*.95)/100);
  const gains=[(tp1/p-1)*100,(tp2/p-1)*100,(tp2/p-1)*100+Math.max(2.2,d7*.12+2.2)];

  const reasonParts=[];
  if(momentum>72)reasonParts.push('momentum en accélération');
  if(volume>68)reasonParts.push('volume/liquidité solides');
  if(regime>70)reasonParts.push('régime favorable');
  if(rel>1.5)reasonParts.push('surperformance face au BTC');
  if(stability<45)reasonParts.push('volatilité élevée à contrôler');
  if(!reasonParts.length)reasonParts.push('configuration encore partielle');

  return {...r,tech,fund,regime,fomo,ai,confidence,status,label,entryLow,entryHigh,stop,tp1,tp2,gains,reason:reasonParts.join(' • ')};
}

function fallbackData(){
  const coins=[
    ['bitcoin','btc','Bitcoin'],['ethereum','eth','Ethereum'],['tether','usdt','Tether'],['binancecoin','bnb','BNB'],
    ['solana','sol','Solana'],['usd-coin','usdc','USDC'],['ripple','xrp','XRP'],['dogecoin','doge','Dogecoin'],
    ['cardano','ada','Cardano'],['avalanche-2','avax','Avalanche'],['chainlink','link','Chainlink'],['polkadot','dot','Polkadot'],
    ['tron','trx','TRON'],['matic-network','pol','POL'],['litecoin','ltc','Litecoin'],['uniswap','uni','Uniswap'],
    ['internet-computer','icp','Internet Computer'],['near','near','NEAR'],['aptos','apt','Aptos'],['arbitrum','arb','Arbitrum'],
    ['optimism','op','Optimism'],['render-token','render','Render'],['sui','sui','Sui'],['aave','aave','Aave'],
    ['cosmos','atom','Cosmos'],['stellar','xlm','Stellar'],['filecoin','fil','Filecoin'],['injective-protocol','inj','Injective'],
    ['the-graph','grt','The Graph'],['maker','mkr','Maker']
  ];
  for(let i=coins.length;i<100;i++)coins.push([`asset-${i+1}`,`c${i+1}`,`Crypto ${i+1}`]);
  return coins.map((c,i)=>{
    const s=seedScore(c[0]);
    const price=i<5?[65000,3500,1,600,150][i]:Math.max(.04,160/(i+1)*(0.6+s));
    const h1=(s-.5)*7;
    const d1=(seedScore(c[1]+'d')-.46)*15;
    const d7=(seedScore(c[1]+'w')-.44)*30;
    const d30=(seedScore(c[1]+'m')-.45)*55;
    return {id:c[0],symbol:c[1],name:c[2],image:'',current_price:price,market_cap_rank:i+1,market_cap:price*(1e9/(i+1)),
      total_volume:price*(5e7/(i+1))*(1+s*2),price_change_percentage_1h_in_currency:h1,price_change_percentage_24h:d1,
      price_change_percentage_7d_in_currency:d7,price_change_percentage_30d_in_currency:d30,ath_change_percentage:-10-(1-s)*72};
  })
}

async function fetchRows(){
  const url=`${CONFIG.api}/coins/markets?vs_currency=${state.cur}&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=1h,24h,7d,30d`;
  const r=await fetch(url,{headers:{accept:'application/json'}});
  if(!r.ok)throw new Error('API '+r.status);
  const j=await r.json();
  if(!Array.isArray(j)||j.length<20)throw new Error('Réponse incomplète');
  return j;
}

async function scan(manual=false){
  $('#refresh').classList.add('spin');
  let rows,source='live';
  try{rows=await fetchRows()}
  catch(e){rows=fallbackData();source='demo';toast('API temporairement indisponible : données de démonstration actives.')}
  const m=computeMarket(rows);
  const ranked=rows.map(r=>scoreAsset(r,m)).filter(r=>!CONFIG.stable.has(r.symbol)).sort((a,b)=>b.ai-a.ai);
  state.rows=rows.map(r=>scoreAsset(r,m)).sort((a,b)=>n(a.market_cap_rank)-n(b.market_cap_rank));
  state.market=m;state.ranked=ranked;state.top3=ranked.slice(0,3);
  const top=ranked[0];

  state.hist.unshift({time:new Date().toISOString(),symbol:top.symbol.toUpperCase(),name:top.name,score:top.ai,status:top.label,source});
  state.hist=state.hist.slice(0,120);
  localStorage.setItem(CONFIG.hist,JSON.stringify(state.hist));

  state.scanMode=m.mode;
  scheduleNext();
  render();
  $('#refresh').classList.remove('spin');
  if(manual)toast('Analyse complète recalculée.');
}

function scheduleNext(){
  clearTimeout(state.timer);clearInterval(state.count);
  const ms=state.scanMode==='focus'?CONFIG.focusMs:CONFIG.normalMs;
  state.next=new Date(Date.now()+ms);
  $('#scanMode').textContent=state.scanMode==='focus'?'FOCUS • 30 min':'Scan 1 h';
  state.timer=setTimeout(()=>{ if(quiet()){scheduleNext();renderCountdown();} else scan(false)},ms);
  state.count=setInterval(renderCountdown,1000);renderCountdown();
}

function renderCountdown(){
  if(!state.next)return;
  if(quiet()){
    $('#countdown').textContent='PAUSE';
    $('#lastScan').textContent='Reprise automatique à 08:00';
    return;
  }
  const sec=Math.max(0,Math.floor((state.next-Date.now())/1000));
  const mm=Math.floor(sec/60),ss=sec%60;
  $('#countdown').textContent=`${mm}m ${String(ss).padStart(2,'0')}s`;
}

function render(){
  const m=state.market,top=state.ranked[0];
  $('#regime').textContent=m.label;
  $('#regimeSub').textContent=m.mode==='focus'?'Mode FOCUS 30 min':'Scan standard 1 h';
  $('#breadth').textContent=`${m.breadth.toFixed(0)} %`;
  $('#btcChange').textContent=pct(m.btc?.price_change_percentage_24h);
  $('#btcChange').className=dir(m.btc?.price_change_percentage_24h);
  $('#btcPrice').textContent=money(m.btc?.current_price);
  $('#lastScan').textContent=`Dernier scan ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
  if(!top)return;

  $('#topSymbol').textContent=top.symbol.toUpperCase();
  $('#topScore').textContent=`Score IA ${sc(top.ai)} / 100`;
  $('#heroSignal').textContent=top.label;$('#heroSignal').className=`signal ${top.status}`;
  $('#heroName').textContent=`${top.name} (${top.symbol.toUpperCase()})`;
  $('#heroImg').src=top.image||avatar(top.symbol);$('#heroImg').alt=top.name;
  $('#heroPrice').textContent=money(top.current_price);
  $('#hero24h').textContent=pct(top.price_change_percentage_24h);$('#hero24h').className=dir(top.price_change_percentage_24h);
  $('#heroReason').textContent=`${top.reason}. L'IA croise les quatre moteurs puis compare cette configuration aux 99 autres actifs.`;
  $('#planSymbol').textContent=top.symbol.toUpperCase();$('#confidence').textContent=`${top.confidence.toFixed(0)} %`;
  fillScore('Ai',top.ai);fillScore('Tech',top.tech);fillScore('Fund',top.fund);fillScore('Reg',top.regime);fillScore('Fomo',top.fomo);
  $('#entry').textContent=`${money(top.entryLow)} – ${money(top.entryHigh)}`;$('#stop').textContent=money(top.stop);
  $('#tp1').textContent=money(top.tp1);$('#tp2').textContent=money(top.tp2);
  $('#g1').textContent=pct(top.gains[0]);$('#g2').textContent=pct(top.gains[1]);$('#g3').textContent=pct(top.gains[2]);

  renderTop3();renderTop10();renderTable();renderHistory();renderCountdown();
}

function fillScore(k,v){$('#s'+k).textContent=sc(v);$('#b'+k).style.width=`${clamp(v)}%`}

function avatar(sym){
  const txt=(sym||'?').toUpperCase().slice(0,3);
  return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="100%" height="100%" rx="40" fill="#12253a"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#5ef2d6" font-size="25" font-family="Arial" font-weight="700">${txt}</text></svg>`);
}

function cardStatus(i,a){
  if(i===0 && a.status==='order')return ['order','ORDRE CONSEILLÉ'];
  if(i===0 && a.status!=='order')return [a.status,a.label];
  if(i===1)return ['preorder','PRÉ-ORDRE'];
  return ['watch','À SURVEILLER'];
}

function renderTop3(){
  $('#top3').innerHTML=state.top3.map((a,i)=>{
    const [cls,label]=cardStatus(i,a);
    return `<article class="fcard ${cls}">
      <div class="fcard-head"><div class="coin"><img src="${a.image||avatar(a.symbol)}"><div><b>${a.name}</b><span>${a.symbol.toUpperCase()}</span></div></div><div class="rank">#${i+1}</div></div>
      <div class="bigscore"><div><small>SCORE FOMO</small><strong>${sc(a.fomo)}</strong></div><span class="signal ${cls}">${label}</span></div>
      <p>${a.reason}</p>
      <div class="fmeta"><div><small>IA</small><b>${sc(a.ai)}</b></div><div><small>24 h</small><b class="${dir(a.price_change_percentage_24h)}">${pct(a.price_change_percentage_24h)}</b></div><div><small>TP2</small><b>${money(a.tp2)}</b></div></div>
    </article>`
  }).join('');
}

function renderTop10(){
  $('#top10').innerHTML=state.ranked.slice(0,10).map((a,i)=>`<div class="toprow">
    <b>#${i+1}</b>
    <div class="coin"><img src="${a.image||avatar(a.symbol)}"><div><b>${a.name}</b><span class="muted">${a.symbol.toUpperCase()}</span></div></div>
    <div><span class="muted">IA</span><b>${sc(a.ai)}</b></div>
    <div><span class="muted">Tech</span><b>${sc(a.tech)}</b></div>
    <div><span class="muted">Fond.</span><b>${sc(a.fund)}</b></div>
    <div><span class="muted">Régime</span><b>${sc(a.regime)}</b></div>
    <div><span class="muted">FOMO</span><b>${sc(a.fomo)}</b></div>
  </div>`).join('');
}

function renderTable(){
  const q=$('#search').value.toLowerCase().trim(),filter=$('#statusFilter').value;
  const list=state.rows.filter(a=>{
    const match=!q||a.name.toLowerCase().includes(q)||a.symbol.toLowerCase().includes(q);
    const status=CONFIG.stable.has(a.symbol)?'neutral':a.status;
    return match&&(filter==='all'||status===filter)
  });
  $('#cryptoRows').innerHTML=list.map(a=>{
    const stable=CONFIG.stable.has(a.symbol),status=stable?'neutral':a.status,label=stable?'STABLECOIN':a.label;
    return `<tr>
      <td>${a.market_cap_rank||'—'}</td>
      <td><div class="tcoin"><img src="${a.image||avatar(a.symbol)}"><div><b>${a.name}</b><span>${a.symbol.toUpperCase()}</span></div></div></td>
      <td>${money(a.current_price)}</td>
      <td class="${dir(a.price_change_percentage_1h_in_currency)}">${pct(a.price_change_percentage_1h_in_currency)}</td>
      <td class="${dir(a.price_change_percentage_24h)}">${pct(a.price_change_percentage_24h)}</td>
      <td class="${dir(a.price_change_percentage_7d_in_currency)}">${pct(a.price_change_percentage_7d_in_currency)}</td>
      <td>${compact(a.total_volume)}</td>
      <td><span class="pill ${a.tech>=80?'high':''}">${sc(a.tech)}</span></td>
      <td><span class="pill ${a.fund>=80?'high':''}">${sc(a.fund)}</span></td>
      <td><span class="pill ${a.regime>=80?'high':''}">${sc(a.regime)}</span></td>
      <td><span class="pill ${a.fomo>=80?'high':''}">${sc(a.fomo)}</span></td>
      <td><span class="pill ${a.ai>=80?'high':''}">${sc(a.ai)}</span></td>
      <td><span class="signal ${status}">${label}</span></td>
    </tr>`
  }).join('');
}

function renderHistory(){
  $('#historyList').innerHTML=state.hist.length?state.hist.slice(0,30).map(x=>`<div class="hitem">
    <div class="time">${new Date(x.time).toLocaleString()}</div><div><b>${x.name}</b> (${x.symbol})</div><div class="status">${x.status}</div><div class="score">${Number(x.score).toFixed(2)}</div>
  </div>`).join(''):`<div class="empty">Aucun scan enregistré.</div>`;
}

function setCurrency(c){state.cur=c;localStorage.setItem('ebyt-cur',c);$$('[data-cur]').forEach(b=>b.classList.toggle('active',b.dataset.cur===c));scan(true)}
function setLang(l){state.lang=l;localStorage.setItem('ebyt-lang',l);document.documentElement.lang=l;$$('[data-lang]').forEach(b=>b.classList.toggle('active',b.dataset.lang===l));toast(l==='fr'?'Interface française':'English interface');render()}

$('#refresh').addEventListener('click',()=>scan(true));
$('#search').addEventListener('input',renderTable);$('#statusFilter').addEventListener('change',renderTable);
$$('[data-cur]').forEach(b=>b.addEventListener('click',()=>setCurrency(b.dataset.cur)));
$$('[data-lang]').forEach(b=>b.addEventListener('click',()=>setLang(b.dataset.lang)));
$$('.nav').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.go;document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});$$('.nav').forEach(x=>x.classList.toggle('active',x===b))}));
$('#clearHistory').addEventListener('click',()=>{state.hist=[];localStorage.removeItem(CONFIG.hist);renderHistory();toast('Historique local vidé.')});

$$('[data-cur]').forEach(b=>b.classList.toggle('active',b.dataset.cur===state.cur));
$$('[data-lang]').forEach(b=>b.classList.toggle('active',b.dataset.lang===state.lang));
scan(false);
