(() => {
'use strict';
const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v)), num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const CONFIG={
  api:'https://api.coingecko.com/api/v3',
  scanMs:60*60*1000, focusMs:30*60*1000, positionMs:60*1000,
  stable:new Set(['usdt','usdc','dai','fdusd','usde','usds','pyusd','tusd','usdd','frax','usdp','gusd']),
  posKey:'ebyt-da-v3-positions', closedKey:'ebyt-da-v3-closed', authKey:'ebyt-da-v3-auth', authEmailKey:'ebyt-da-v3-auth-email', demoPass:'EBYTDA-ADMIN-2026'
};
const I18N={
 fr:{navRadar:'Radar IA',navPositions:'Positions ouvertes',navUniverse:'Top 100',navHistory:'Historique',
 title:'Radar Crypto IA <span class="gold">Trading Desk</span>',subtitle:"100 cryptos scannées • TOP 10 éligible à l'ouverture manuelle d'une position • suivi P&L dynamique",
 bestChoice:'CHOIX IA N°1 PARMI LES 100',aiScore:'Score IA',technical:'Technique',fundamental:'Fondamental',regime:'Régime',marketBreadth:'Largeur positive TOP 100',scanMode:'Mode de scan',
 noForce:"L'IA classe les meilleures asymétries sans forcer une entrée si le marché est plat. Le passage d'ordre reste manuel.",
 eligible:"ACTIFS ÉLIGIBLES À L'ORDRE",top10Only:'Uniquement le TOP 10 Algo',openPositions:'POSITIONS OUVERTES',lastSync:'DERNIÈRE SYNCHRO',pricesEveryMinute:'Prix positions : toutes les 60 s',
 top3Title:'Top 3 — opportunités du moment',top3Hint:"Cliquez sur le numéro d'une carte pour l'analyser et préparer un ordre manuel.",orderAdvice:'Passage conseillé',preOrder:'Pré-ordre',watch:'À surveiller',
 candleSource:'Bougies OHLC • CoinGecko',actionPlan:"Plan d'action IA",entryZone:"Zone d'entrée",invalidation:'Stop / invalidation',prudent:'Prudent',central:'Central',favorable:'Favorable',
 prepareOrder:"PRÉPARER L'ORDRE MANUEL",brokers:'BROKERS',brokerNote:"Après exécution chez le broker, renseignez le prix réellement obtenu dans le ticket EBYTDA.",
 top10Title:"TOP 10 ALGO — univers autorisé pour l'ouverture d'une position",top10Hint:"Le numéro bleu/or est cliquable. Aucun actif hors TOP 10 ne peut ouvrir le ticket d'ordre.",
 asset:'Actif',price:'Prix',technicalShort:'Tech.',fundamentalShort:'Fond.',signal:'Signal',liveBook:'LIVE BOOK',positionsTitle:"Positions ouvertes — gains / pertes depuis l'exécution",
 positionsHint:'Les prix sont resynchronisés automatiquement toutes les 60 secondes.',refreshPrices:'Actualiser les prix',universeTitle:'Top 100 cryptos scannées',
 universeHint:"Consultation et graphique possibles. L'ouverture d'ordre reste verrouillée aux actifs du TOP 10.",volume:'Volume',trackRecord:'TRACK RECORD LOCAL',historyTitle:'Historique des positions clôturées',clear:'Vider',
 footerRisk:"Les scores et objectifs sont des aides à la décision. Les gains potentiels ne sont pas garantis.",manualOrder:'ORDRE MANUEL',eligibility:'Éligibilité',brokerUsed:'Broker utilisé',
 direction:'Sens',capital:'Capital engagé',executedPrice:'Prix réellement exécuté',manualCheck:"Je confirme avoir réellement exécuté cet ordre manuellement chez le broker sélectionné.",
 confirmExecution:"CONFIRMER L'EXÉCUTION ET SUIVRE LA POSITION",modalNote:"EBYTDA n'envoie aucun ordre au broker : ce bouton enregistre uniquement votre exécution réelle pour suivre la position."
 },
 en:{navRadar:'AI Radar',navPositions:'Open positions',navUniverse:'Top 100',navHistory:'History',
 title:'Crypto AI Radar <span class="gold">Trading Desk</span>',subtitle:'100 cryptos scanned • TOP 10 eligible for manual position opening • dynamic P&L tracking',
 bestChoice:'AI #1 CHOICE AMONG 100',aiScore:'AI Score',technical:'Technical',fundamental:'Fundamental',regime:'Regime',marketBreadth:'Positive breadth TOP 100',scanMode:'Scan mode',
 noForce:'AI ranks the best asymmetries without forcing an entry when the market is flat. Order execution remains manual.',
 eligible:'ORDER-ELIGIBLE ASSETS',top10Only:'TOP 10 Algo only',openPositions:'OPEN POSITIONS',lastSync:'LAST SYNC',pricesEveryMinute:'Position prices: every 60 sec',
 top3Title:'Top 3 — current opportunities',top3Hint:'Click a card number to analyze it and prepare a manual order.',orderAdvice:'Entry advised',preOrder:'Pre-order',watch:'Watch',
 candleSource:'OHLC candles • CoinGecko',actionPlan:'AI action plan',entryZone:'Entry zone',invalidation:'Stop / invalidation',prudent:'Prudent',central:'Central',favorable:'Favorable',
 prepareOrder:'PREPARE MANUAL ORDER',brokers:'BROKERS',brokerNote:'After execution at the broker, enter the actual filled price in the EBYTDA ticket.',
 top10Title:'TOP 10 ALGO — authorized universe for opening a position',top10Hint:'The blue/gold rank number is clickable. No asset outside the TOP 10 can open an order ticket.',
 asset:'Asset',price:'Price',technicalShort:'Tech.',fundamentalShort:'Fund.',signal:'Signal',liveBook:'LIVE BOOK',positionsTitle:'Open positions — gains / losses since execution',
 positionsHint:'Prices are automatically resynced every 60 seconds.',refreshPrices:'Refresh prices',universeTitle:'Top 100 scanned cryptos',
 universeHint:'Chart viewing is available for all assets. Order opening remains locked to TOP 10 assets.',volume:'Volume',trackRecord:'LOCAL TRACK RECORD',historyTitle:'Closed position history',clear:'Clear',
 footerRisk:'Scores and targets are decision-support tools. Potential gains are not guaranteed.',manualOrder:'MANUAL ORDER',eligibility:'Eligibility',brokerUsed:'Broker used',
 direction:'Side',capital:'Capital committed',executedPrice:'Actual executed price',manualCheck:'I confirm that I actually executed this order manually at the selected broker.',
 confirmExecution:'CONFIRM EXECUTION AND TRACK POSITION',modalNote:'EBYTDA sends no broker orders: this button only records your actual execution to track the position.'
 }
};
const state={
 lang:localStorage.getItem('ebyt-lang')||'fr',cur:localStorage.getItem('ebyt-cur')||'eur',
 rows:[],ranked:[],market:{},selected:null,chartDays:1,nextScan:null,scanTimer:null,countTimer:null,posTimer:null,
 positions:JSON.parse(localStorage.getItem(CONFIG.posKey)||'[]'), closed:JSON.parse(localStorage.getItem(CONFIG.closedKey)||'[]'),
 auth:localStorage.getItem(CONFIG.authKey)==='1', authEmail:localStorage.getItem(CONFIG.authEmailKey)||'',
 chart:null,candleSeries:null
};
function t(k){return I18N[state.lang][k]||I18N.fr[k]||k}
function toast(m){const e=$('#toast');e.textContent=m;e.classList.add('show');clearTimeout(toast.x);toast.x=setTimeout(()=>e.classList.remove('show'),2600)}
function pct(v,d=2){return Number.isFinite(Number(v))?`${Number(v)>=0?'+':''}${Number(v).toFixed(d)} %`:'—'}
function score(v){return Number(v||0).toFixed(2)}
function klass(v){return num(v)>=0?'pos':'neg'}
function money(v,cur=state.cur){
 if(!Number.isFinite(Number(v)))return '—';
 const digits=Math.abs(v)<1?6:Math.abs(v)<100?3:2;
 return new Intl.NumberFormat(state.lang==='fr'?'fr-FR':'en-US',{style:'currency',currency:cur.toUpperCase(),maximumFractionDigits:digits}).format(v)
}
function compact(v,cur=state.cur){
 if(!Number.isFinite(Number(v)))return '—';
 return new Intl.NumberFormat(state.lang==='fr'?'fr-FR':'en-US',{style:'currency',currency:cur.toUpperCase(),notation:'compact',maximumFractionDigits:1}).format(v)
}
function avatar(sym){
 const txt=(sym||'?').toUpperCase().slice(0,3);
 return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="100%" height="100%" rx="40" fill="#0e2230"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#f3d77f" font-size="24" font-family="Arial" font-weight="700">${txt}</text></svg>`);
}
function seed(s){let x=0;for(const c of s)x=(x*31+c.charCodeAt(0))%1009;return (x%1000)/1000}
function marketStats(rows){
 const tr=rows.filter(r=>!CONFIG.stable.has(r.symbol));
 const breadth=tr.length?tr.filter(r=>num(r.price_change_percentage_24h)>=0).length/tr.length*100:50;
 const btc=rows.find(r=>r.symbol==='btc')||tr[0],eth=rows.find(r=>r.symbol==='eth')||tr[1];
 const b24=num(btc?.price_change_percentage_24h),e24=num(eth?.price_change_percentage_24h);
 const avg7=tr.length?tr.reduce((a,r)=>a+num(r.price_change_percentage_7d_in_currency),0)/tr.length:0;
 const vol=tr.length?tr.reduce((a,r)=>a+Math.abs(num(r.price_change_percentage_24h)),0)/tr.length:0;
 let label='RANGE / MIXTE',base=60;
 if(breadth>62&&b24>1){label='RISK-ON';base=80}
 else if(breadth<38&&b24<-1){label='RISK-OFF';base=42}
 else if(Math.abs(b24)<.8&&Math.abs(avg7)<2){label='MARCHÉ PLAT';base=55}
 else if(e24>b24+1&&breadth>55){label='ROTATION ALTCOINS';base=77}
 if(vol>5)label+=' • VOLATIL';
 return {breadth,btc,vol,label,base,mode:vol>4.5?'focus':'normal'}
}
function scoreAsset(r,m){
 const h1=num(r.price_change_percentage_1h_in_currency),d1=num(r.price_change_percentage_24h),d7=num(r.price_change_percentage_7d_in_currency),d30=num(r.price_change_percentage_30d_in_currency);
 const vmc=num(r.total_volume)/num(r.market_cap,1),rank=num(r.market_cap_rank,100),ath=num(r.ath_change_percentage,-50);
 const momentum=clamp(50+h1*8+d1*2.8+d7*.8),trend=clamp(50+d1*2+d7*1.2+d30*.28),volume=clamp(35+Math.log10(Math.max(vmc,.0001)*10000)*14),stability=clamp(84-Math.abs(d1)*3-Math.max(0,Math.abs(h1)-3)*4);
 const tech=clamp(momentum*.36+trend*.34+volume*.2+stability*.1);
 const capQuality=clamp(92-Math.log10(Math.max(rank,1))*21),liquidity=clamp(35+Math.log10(Math.max(num(r.total_volume),1))*5.3),recovery=clamp(90+ath*.4);
 const fund=clamp(capQuality*.45+liquidity*.35+recovery*.2);
 const rel=d1-num(m.btc?.price_change_percentage_24h),regime=clamp(m.base+rel*2.4+(m.breadth-50)*.25),accel=clamp(50+h1*10+(d1-h1*4)*3);
 const fomo=clamp(accel*.38+volume*.23+tech*.24+regime*.15),riskPenalty=Math.max(0,Math.abs(d1)-9)*1.4+Math.max(0,Math.abs(h1)-5)*2;
 let ai=clamp(tech*.4+fund*.22+regime*.2+fomo*.18-riskPenalty+(seed(r.id)-.5)*1.2);
 let status='neutral',label=state.lang==='fr'?'NEUTRE':'NEUTRAL';
 if(ai>=82&&fomo>=78&&regime>=56){status='order';label=state.lang==='fr'?'ORDRE CONSEILLÉ':'ENTRY ADVISED'}
 else if(ai>=74&&fomo>=68){status='preorder';label=state.lang==='fr'?'PRÉ-ORDRE':'PRE-ORDER'}
 else if(ai>=64){status='watch';label=state.lang==='fr'?'À SURVEILLER':'WATCH'}
 const band=clamp(2.2+Math.abs(d1)*.22+Math.abs(h1)*.38,2,8),p=num(r.current_price);
 const entryLow=p*(1-band*.0017),entryHigh=p*(1+band*.0010),stop=p*(1-(3+band*.45)/100),tp1=p*(1+(3.2+band*.55)/100),tp2=p*(1+(6.5+band*.95)/100);
 const gains=[(tp1/p-1)*100,(tp2/p-1)*100,(tp2/p-1)*100+Math.max(2.2,d7*.12+2.2)];
 const reasons=[];
 if(momentum>72)reasons.push(state.lang==='fr'?'momentum en accélération':'accelerating momentum');
 if(volume>68)reasons.push(state.lang==='fr'?'volume/liquidité solides':'strong volume/liquidity');
 if(regime>70)reasons.push(state.lang==='fr'?'régime favorable':'supportive regime');
 if(rel>1.5)reasons.push(state.lang==='fr'?'surperformance face au BTC':'outperforming BTC');
 if(stability<45)reasons.push(state.lang==='fr'?'volatilité élevée à contrôler':'high volatility to control');
 if(!reasons.length)reasons.push(state.lang==='fr'?'configuration encore partielle':'setup still incomplete');
 return {...r,tech,fund,regime,fomo,ai,status,label,entryLow,entryHigh,stop,tp1,tp2,gains,reason:reasons.join(' • ')};
}
function demoData(){
 const base=[['bitcoin','btc','Bitcoin'],['ethereum','eth','Ethereum'],['tether','usdt','Tether'],['binancecoin','bnb','BNB'],['solana','sol','Solana'],['usd-coin','usdc','USDC'],['ripple','xrp','XRP'],['dogecoin','doge','Dogecoin'],['cardano','ada','Cardano'],['avalanche-2','avax','Avalanche'],['chainlink','link','Chainlink'],['polkadot','dot','Polkadot'],['tron','trx','TRON'],['matic-network','pol','POL'],['litecoin','ltc','Litecoin'],['uniswap','uni','Uniswap'],['internet-computer','icp','Internet Computer'],['near','near','NEAR'],['aptos','apt','Aptos'],['arbitrum','arb','Arbitrum'],['optimism','op','Optimism'],['render-token','render','Render'],['sui','sui','Sui'],['aave','aave','Aave'],['cosmos','atom','Cosmos'],['stellar','xlm','Stellar'],['filecoin','fil','Filecoin'],['injective-protocol','inj','Injective'],['the-graph','grt','The Graph'],['maker','mkr','Maker']];
 while(base.length<100){let i=base.length+1;base.push([`asset-${i}`,`c${i}`,`Crypto ${i}`])}
 return base.map((c,i)=>{const s=seed(c[0]),p=i<5?[65000,3500,1,600,150][i]:Math.max(.04,160/(i+1)*(.6+s)),h=(s-.5)*7,d=(seed(c[1]+'d')-.46)*15,w=(seed(c[1]+'w')-.44)*30,m=(seed(c[1]+'m')-.45)*55;
 return {id:c[0],symbol:c[1],name:c[2],image:'',current_price:p,market_cap_rank:i+1,market_cap:p*(1e9/(i+1)),total_volume:p*(5e7/(i+1))*(1+s*2),price_change_percentage_1h_in_currency:h,price_change_percentage_24h:d,price_change_percentage_7d_in_currency:w,price_change_percentage_30d_in_currency:m,ath_change_percentage:-10-(1-s)*72}})
}
async function fetchMarket(){
 const url=`${CONFIG.api}/coins/markets?vs_currency=${state.cur}&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=1h,24h,7d,30d`;
 const r=await fetch(url,{headers:{accept:'application/json'}}); if(!r.ok)throw new Error(r.status); const j=await r.json(); if(!Array.isArray(j)||j.length<20)throw new Error('bad data'); return j;
}
async function scan(manual=false){
 $('#refreshBtn').classList.add('spin'); let raw;
 try{raw=await fetchMarket()}catch(e){raw=demoData();toast(state.lang==='fr'?'API indisponible : mode démonstration actif.':'API unavailable: demo mode active.')}
 const m=marketStats(raw); state.market=m;
 state.rows=raw.map(r=>scoreAsset(r,m)).sort((a,b)=>num(a.market_cap_rank)-num(b.market_cap_rank));
 state.ranked=state.rows.filter(r=>!CONFIG.stable.has(r.symbol)).sort((a,b)=>b.ai-a.ai);
 if(!state.selected)state.selected=state.ranked[0];
 else state.selected=state.rows.find(r=>r.id===state.selected.id)||state.ranked[0];
 scheduleScan(); renderAll(); await loadChart(); $('#refreshBtn').classList.remove('spin');
 if(manual)toast(state.lang==='fr'?'Analyse recalculée.':'Analysis recalculated.');
}
function scheduleScan(){
 clearTimeout(state.scanTimer);clearInterval(state.countTimer);
 const ms=state.market.mode==='focus'?CONFIG.focusMs:CONFIG.scanMs;state.nextScan=Date.now()+ms;
 state.scanTimer=setTimeout(()=>scan(false),ms);state.countTimer=setInterval(renderCountdown,1000);renderCountdown();
}
function renderCountdown(){
 if(!state.nextScan)return;const sec=Math.max(0,Math.floor((state.nextScan-Date.now())/1000)),mm=Math.floor(sec/60),ss=sec%60;
 $('#countdown').textContent=`${mm}m ${String(ss).padStart(2,'0')}s`;
}
function eligible(a){return state.ranked.slice(0,10).some(x=>x.id===a?.id)}
function rankOf(a){const i=state.ranked.findIndex(x=>x.id===a?.id);return i>=0?i+1:null}
function statusLabel(a){return a?.label||'—'}
function translateStatic(){
 $$('[data-i18n]').forEach(el=>{const k=el.dataset.i18n;if(I18N[state.lang][k])el.innerHTML=I18N[state.lang][k]});
 document.documentElement.lang=state.lang;
}
function renderAll(){
 translateStatic(); updateAuthUI(); const top=state.ranked[0],m=state.market;if(!top)return;
 $('#marketRegime').textContent=state.lang==='en'?m.label.replace('MARCHÉ PLAT','FLAT MARKET').replace('ROTATION ALTCOINS','ALTCOIN ROTATION').replace('VOLATIL','VOLATILE').replace('RANGE / MIXTE','RANGE / MIXED'):m.label;$('#breadth').textContent=`${m.breadth.toFixed(0)} %`;$('#breadthFill').style.width=`${m.breadth}%`;
 $('#btc24').textContent=pct(m.btc?.price_change_percentage_24h);$('#btc24').className=klass(m.btc?.price_change_percentage_24h);
 $('#scanMode').textContent=m.mode==='focus'?'FOCUS • 30 min':'STANDARD • 1 h';
 $('#heroImg').src=top.image||avatar(top.symbol);$('#heroName').textContent=`${top.name} (${top.symbol.toUpperCase()})`;$('#heroPrice').textContent=money(top.current_price);
 $('#hero24h').textContent=pct(top.price_change_percentage_24h);$('#hero24h').className=klass(top.price_change_percentage_24h);$('#heroScore').textContent=score(top.ai);$('#heroSignal').textContent=statusLabel(top);
 $('#heroReason').textContent=top.reason;$('#heroTech').textContent=score(top.tech);$('#heroFund').textContent=score(top.fund);$('#heroReg').textContent=score(top.regime);$('#heroFomo').textContent=score(top.fomo);
 $('#kpiSync').textContent=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});renderTop3();renderTop10();renderSelected();renderUniverse();renderPositions();renderClosed();renderPositionKpis();renderCountdown();
}
function advisoryFor(a,i){
 if(i===0)return a.status==='order'?['order',state.lang==='fr'?'PASSAGE CONSEILLÉ':'ENTRY ADVISED']:[a.status,statusLabel(a)];
 if(i===1)return ['preorder',state.lang==='fr'?'PRÉ-ORDRE':'PRE-ORDER'];
 return ['watch',state.lang==='fr'?'À SURVEILLER':'WATCH'];
}
function renderTop3(){
 $('#top3').innerHTML=state.ranked.slice(0,3).map((a,i)=>{const [cls,label]=advisoryFor(a,i);return `<article class="fcard ${cls}">
 <div class="fcard-head"><div class="asset"><img src="${a.image||avatar(a.symbol)}"><div><b>${a.name}</b><small>${a.symbol.toUpperCase()}</small></div></div><button class="rank-btn" data-pick="${a.id}">#${i+1}</button></div>
 <div class="score-line"><div><small>FOMO</small><strong>${score(a.fomo)}</strong></div><span class="status-pill ${cls}">${label}</span></div>
 <p>${a.reason}</p><div class="fmeta"><div><small>IA</small><b>${score(a.ai)}</b></div><div><small>24 h</small><b class="${klass(a.price_change_percentage_24h)}">${pct(a.price_change_percentage_24h)}</b></div><div><small>TP2</small><b>${money(a.tp2)}</b></div></div></article>`}).join('');
 $$('[data-pick]',$('#top3')).forEach(b=>b.onclick=()=>selectAsset(b.dataset.pick,true));
}
function renderTop10(){
 $('#top10Rows').innerHTML=state.ranked.slice(0,10).map((a,i)=>`<tr class="${state.selected?.id===a.id?'selected':''}" data-rowpick="${a.id}">
 <td><button class="table-rank" data-pick="${a.id}">#${i+1}</button></td>
 <td><div class="asset"><img src="${a.image||avatar(a.symbol)}"><div><b>${a.name}</b><small>${a.symbol.toUpperCase()}</small></div></div></td>
 <td>${money(a.current_price)}</td><td class="${klass(a.price_change_percentage_24h)}">${pct(a.price_change_percentage_24h)}</td>
 <td><span class="score-chip ${a.tech>=80?'high':''}">${score(a.tech)}</span></td><td><span class="score-chip ${a.fund>=80?'high':''}">${score(a.fund)}</span></td>
 <td><span class="score-chip ${a.regime>=80?'high':''}">${score(a.regime)}</span></td><td><span class="score-chip ${a.fomo>=80?'high':''}">${score(a.fomo)}</span></td>
 <td><span class="score-chip ${a.ai>=80?'high':''}">${score(a.ai)}</span></td><td><span class="status-pill ${a.status}">${statusLabel(a)}</span></td></tr>`).join('');
 $$('[data-pick]',$('#top10Rows')).forEach(b=>b.onclick=e=>{e.stopPropagation();selectAsset(b.dataset.pick,true)});
 $$('[data-rowpick]').forEach(r=>r.onclick=()=>selectAsset(r.dataset.rowpick,true));
}
function selectAsset(id,fromEligible){
 const a=state.rows.find(x=>x.id===id)||state.ranked.find(x=>x.id===id);if(!a)return;state.selected=a;renderSelected();renderTop10();loadChart();
 if(fromEligible)document.querySelector('.grid').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderSelected(){
 const a=state.selected;if(!a)return;const r=rankOf(a),isEligible=eligible(a);
 $('#chartImg').src=a.image||avatar(a.symbol);$('#chartName').textContent=a.name;$('#chartSymbol').textContent=a.symbol.toUpperCase();
 $('#chartPrice').textContent=money(a.current_price);$('#chartChange').textContent=pct(a.price_change_percentage_24h);$('#chartChange').className=`price-change ${klass(a.price_change_percentage_24h)}`;
 $('#chartRank').textContent=r?`TOP ${r}`:`Rang marché #${a.market_cap_rank||'—'}`;$('#chartEligibility').textContent=isEligible?(state.lang==='fr'?'✓ ÉLIGIBLE À L’ORDRE':'✓ ORDER ELIGIBLE'):(state.lang==='fr'?'GRAPHIQUE SEUL • HORS TOP 10':'CHART ONLY • OUTSIDE TOP 10');$('#chartEligibility').className=`eligibility ${isEligible?'yes':''}`;
 $('#selectedStatus').textContent=`${statusLabel(a)} • ${r?`TOP ${r}`:`#${a.market_cap_rank||'—'}`}`;$('#selectedScore').textContent=score(a.ai);
 $('#entryZone').textContent=`${money(a.entryLow)} – ${money(a.entryHigh)}`;$('#stopLevel').textContent=money(a.stop);$('#tp1Level').textContent=money(a.tp1);$('#tp2Level').textContent=money(a.tp2);$('#selectedReason').textContent=a.reason;
 $('#gain1').textContent=pct(a.gains[0]);$('#gain2').textContent=pct(a.gains[1]);$('#gain3').textContent=pct(a.gains[2]);
 $('#openOrderBtn').disabled=!(isEligible&&state.auth);$('#orderEligibilityNote').textContent=!state.auth?(state.lang==='fr'?"Portail admin requis pour ouvrir un ticket d'ordre.":"Admin portal required to open an order ticket."):isEligible?(state.lang==='fr'?`TOP ${r} : ticket d'ordre manuel autorisé. Le broker reste externe à EBYTDA.`:`TOP ${r}: manual order ticket enabled. Broker execution remains external to EBYTDA.`):(state.lang==='fr'?"Cet actif n'est pas dans le TOP 10 : impossible d'ouvrir un ticket d'ordre.":"This asset is outside the TOP 10: order ticket locked.");
}
function renderUniverse(){
 const q=$('#search').value.trim().toLowerCase(),f=$('#statusFilter').value;
 const list=state.rows.filter(a=>(!q||a.name.toLowerCase().includes(q)||a.symbol.toLowerCase().includes(q))&&(f==='all'||a.status===f));
 $('#cryptoRows').innerHTML=list.map(a=>`<tr data-chartpick="${a.id}">
 <td>${a.market_cap_rank||'—'}</td><td><div class="asset"><img src="${a.image||avatar(a.symbol)}"><div><b>${a.name}</b><small>${a.symbol.toUpperCase()} ${eligible(a)?'• TOP 10':''}</small></div></div></td>
 <td>${money(a.current_price)}</td><td class="${klass(a.price_change_percentage_1h_in_currency)}">${pct(a.price_change_percentage_1h_in_currency)}</td><td class="${klass(a.price_change_percentage_24h)}">${pct(a.price_change_percentage_24h)}</td><td class="${klass(a.price_change_percentage_7d_in_currency)}">${pct(a.price_change_percentage_7d_in_currency)}</td><td>${compact(a.total_volume)}</td>
 <td><span class="score-chip">${score(a.tech)}</span></td><td><span class="score-chip">${score(a.fund)}</span></td><td><span class="score-chip">${score(a.regime)}</span></td><td><span class="score-chip">${score(a.fomo)}</span></td><td><span class="score-chip ${a.ai>=80?'high':''}">${score(a.ai)}</span></td><td><span class="status-pill ${a.status}">${statusLabel(a)}</span></td></tr>`).join('');
 $$('[data-chartpick]').forEach(r=>r.onclick=()=>selectAsset(r.dataset.chartpick,false));
}
function ensureChart(){
 if(state.chart||!window.LightweightCharts)return;
 state.chart=LightweightCharts.createChart($('#chart'),{layout:{background:{type:'solid',color:'#071019'},textColor:'#8ea1af'},grid:{vertLines:{color:'#10202b'},horzLines:{color:'#10202b'}},rightPriceScale:{borderColor:'#1a2a37'},timeScale:{borderColor:'#1a2a37',timeVisible:true,secondsVisible:false},crosshair:{mode:LightweightCharts.CrosshairMode.Normal},localization:{locale:state.lang==='fr'?'fr-FR':'en-US'}});
 state.candleSeries=state.chart.addCandlestickSeries({upColor:'#34d399',downColor:'#fb7185',borderUpColor:'#34d399',borderDownColor:'#fb7185',wickUpColor:'#34d399',wickDownColor:'#fb7185'});
 new ResizeObserver(entries=>{for(const e of entries)state.chart.applyOptions({width:e.contentRect.width,height:e.contentRect.height})}).observe($('#chart'));
}
function demoCandles(a,days){
 const count=days===1?48:days===7?84:days===30?90:120,end=Math.floor(Date.now()/1000),step=Math.floor(days*86400/count),out=[];let p=num(a.current_price,1)*(1-(seed(a.id+'c')-.4)*.08);
 for(let i=count-1;i>=0;i--){const s=(seed(a.id+i)-.5)*.025,o=p,c=o*(1+s),h=Math.max(o,c)*(1+Math.abs(s)*.5+.002),l=Math.min(o,c)*(1-Math.abs(s)*.5-.002);out.push({time:end-i*step,open:o,high:h,low:l,close:c});p=c}
 const factor=num(a.current_price,1)/out[out.length-1].close;return out.map(c=>({...c,open:c.open*factor,high:c.high*factor,low:c.low*factor,close:c.close*factor}));
}
async function loadChart(){
 const a=state.selected;if(!a)return;ensureChart();if(!state.candleSeries){$('#chartStatus').textContent=state.lang==='fr'?'Bibliothèque graphique indisponible.':'Chart library unavailable.';return}
 $('#chartStatus').textContent=state.lang==='fr'?'Chargement des bougies…':'Loading candles…';
 let candles;
 try{const r=await fetch(`${CONFIG.api}/coins/${encodeURIComponent(a.id)}/ohlc?vs_currency=${state.cur}&days=${state.chartDays}`);if(!r.ok)throw new Error(r.status);const j=await r.json();candles=j.map(x=>({time:Math.floor(x[0]/1000),open:x[1],high:x[2],low:x[3],close:x[4]}));if(!candles.length)throw new Error('empty');$('#chartStatus').textContent=t('candleSource')}
 catch(e){candles=demoCandles(a,state.chartDays);$('#chartStatus').textContent=state.lang==='fr'?'Bougies de démonstration • API OHLC indisponible':'Demo candles • OHLC API unavailable'}
 state.candleSeries.setData(candles);state.chart.timeScale().fitContent();
}
function openModal(){
 if(!state.auth){openAuth();return}
 const a=state.selected;if(!eligible(a)){toast(state.lang==='fr'?"Ordre verrouillé : l'actif doit appartenir au TOP 10.":'Order locked: asset must be in TOP 10.');return}
 const r=rankOf(a);$('#modalAsset').textContent=`${a.name} (${a.symbol.toUpperCase()})`;$('#modalRank').textContent=`TOP ${r}`;$('#capitalCurrency').textContent=state.cur.toUpperCase();$('#executionCurrency').textContent=state.cur.toUpperCase();$('#executionInput').value=num(a.current_price).toPrecision(8).replace(/0+$/,'').replace(/\.$/,'');
 $('#ticketAi').textContent=score(a.ai);$('#ticketFomo').textContent=score(a.fomo);$('#ticketStop').textContent=money(a.stop);$('#ticketTps').textContent=`${money(a.tp1)} / ${money(a.tp2)}`;$('#manualCheck').checked=false;$('#confirmOrderBtn').disabled=true;$('#orderModal').classList.add('open');$('#orderModal').setAttribute('aria-hidden','false');
}
function closeModal(){$('#orderModal').classList.remove('open');$('#orderModal').setAttribute('aria-hidden','true')}
async function fetchBothPrice(id){
 try{const r=await fetch(`${CONFIG.api}/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=eur,usd`);if(!r.ok)throw new Error();const j=await r.json();return j[id]||null}catch(e){return null}
}
async function confirmOrder(){
 const a=state.selected;if(!eligible(a))return;const capital=num($('#capitalInput').value),entry=num($('#executionInput').value);if(capital<=0||entry<=0){toast(state.lang==='fr'?'Capital ou prix invalide.':'Invalid capital or price.');return}
 const both=await fetchBothPrice(a.id);let entryEur,entryUsd;
 if(state.cur==='eur'){entryEur=entry;entryUsd=both?.usd&&both?.eur?entry*(both.usd/both.eur):entry*1.1}else{entryUsd=entry;entryEur=both?.eur&&both?.usd?entry*(both.eur/both.usd):entry/1.1}
 const qty=capital/entry,side=$('#sideSelect').value,stopPct=Math.abs((a.stop/a.current_price-1)*100),tp1Pct=Math.abs((a.tp1/a.current_price-1)*100),tp2Pct=Math.abs((a.tp2/a.current_price-1)*100);
 const pos={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),assetId:a.id,symbol:a.symbol,name:a.name,image:a.image||'',rank:rankOf(a),broker:$('#brokerSelect').value,side,qty,openedAt:new Date().toISOString(),orderCurrency:state.cur,capitalOriginal:capital,entryEur,entryUsd,currentEur:both?.eur||entryEur,currentUsd:both?.usd||entryUsd,stopPct,tp1Pct,tp2Pct,ai:a.ai,fomo:a.fomo,status:'open'};
 state.positions.unshift(pos);persistPositions();closeModal();renderPositions();renderPositionKpis();toast(state.lang==='fr'?`${a.symbol.toUpperCase()} ajouté aux positions ouvertes.`:`${a.symbol.toUpperCase()} added to open positions.`);document.getElementById('positions').scrollIntoView({behavior:'smooth'});
}
function persistPositions(){localStorage.setItem(CONFIG.posKey,JSON.stringify(state.positions))}
function persistClosed(){localStorage.setItem(CONFIG.closedKey,JSON.stringify(state.closed))}
function posCalc(p){
 const cur=state.cur==='eur'?num(p.currentEur):num(p.currentUsd),entry=state.cur==='eur'?num(p.entryEur):num(p.entryUsd),sgn=p.side==='short'?-1:1,pnlPct=entry?((cur-entry)/entry*100)*sgn:0,pnlMoney=p.qty*(cur-entry)*sgn,capital=p.qty*entry;
 return {cur,entry,pnlPct,pnlMoney,capital,progress:clamp((pnlPct/Math.max(p.tp1Pct,.01))*100,0,160)}
}
function renderPositions(){
 if(!state.positions.length){$('#positionsList').innerHTML=`<div class="empty">${state.lang==='fr'?"Aucune position ouverte. Sélectionnez un actif du TOP 3 ou du TOP 10 pour enregistrer une exécution manuelle.":"No open position. Select an asset from TOP 3 or TOP 10 to record a manual execution."}</div>`;return}
 $('#positionsList').innerHTML=state.positions.map(p=>{const c=posCalc(p),cl=c.pnlMoney>=0?'profit':'loss';return `<article class="position-card ${cl}">
 <div class="position-top">
 <div class="position-title"><img src="${p.image||avatar(p.symbol)}"><div><b>${p.name} • ${p.symbol.toUpperCase()}</b><small>${p.side.toUpperCase()} • ${p.broker} • TOP ${p.rank}</small></div></div>
 <div class="pmetric"><span>${state.lang==='fr'?'Entrée':'Entry'}</span><b>${money(c.entry)}</b></div><div class="pmetric"><span>${state.lang==='fr'?'Actuel':'Current'}</span><b>${money(c.cur)}</b></div>
 <div class="pmetric"><span>P&L</span><b class="pnl-big ${klass(c.pnlMoney)}">${money(c.pnlMoney)}</b></div><div class="pmetric"><span>P&L %</span><b class="${klass(c.pnlPct)}">${pct(c.pnlPct)}</b></div>
 <button class="close-btn" data-closepos="${p.id}">${state.lang==='fr'?'CLÔTURER':'CLOSE'}</button></div>
 <div class="position-progress"><div class="progress-track"><div class="progress-bar" style="width:${Math.min(100,c.progress)}%"></div></div><div class="progress-label">${state.lang==='fr'?'Progression vers TP1':'Progress to TP1'} : ${c.progress.toFixed(0)} %</div></div>
 <div class="position-meta"><span>${state.lang==='fr'?'Ouverte':'Opened'} ${new Date(p.openedAt).toLocaleString()}</span><span>${state.lang==='fr'?'Capital approx.':'Approx. capital'} ${money(c.capital)}</span><span>TP1 +${p.tp1Pct.toFixed(2)} %</span><span>TP2 +${p.tp2Pct.toFixed(2)} %</span><span>Stop -${p.stopPct.toFixed(2)} %</span></div>
 </article>`}).join('');
 $$('[data-closepos]').forEach(b=>b.onclick=()=>closePosition(b.dataset.closepos));
}
function renderPositionKpis(){
 const cs=state.positions.map(posCalc),capital=cs.reduce((a,c)=>a+c.capital,0),pnl=cs.reduce((a,c)=>a+c.pnlMoney,0),pctTot=capital?pnl/capital*100:0;
 $('#kpiOpen').textContent=state.positions.length;$('#kpiCapital').textContent=capital?`${state.lang==='fr'?'Capital suivi':'Tracked capital'} ${money(capital)}`:'—';$('#kpiPnl').textContent=money(pnl);$('#kpiPnl').className=`kpi-value ${klass(pnl)}`;$('#kpiPnlPct').textContent=pct(pctTot);$('#kpiPnlPct').className=`kpi-sub ${klass(pctTot)}`;
}
function closePosition(id){
 const i=state.positions.findIndex(p=>p.id===id);if(i<0)return;const p=state.positions[i],c=posCalc(p);if(!confirm(state.lang==='fr'?`Clôturer le suivi de ${p.symbol.toUpperCase()} avec le P&L actuel ${money(c.pnlMoney)} ?`:`Close tracking for ${p.symbol.toUpperCase()} at current P&L ${money(c.pnlMoney)}?`))return;
 state.positions.splice(i,1);state.closed.unshift({...p,status:'closed',closedAt:new Date().toISOString(),exitEur:p.currentEur,exitUsd:p.currentUsd,closedPnlEur:state.cur==='eur'?c.pnlMoney:null,closedPnlUsd:state.cur==='usd'?c.pnlMoney:null});state.closed=state.closed.slice(0,200);persistPositions();persistClosed();renderPositions();renderClosed();renderPositionKpis();
}
function renderClosed(){
 if(!state.closed.length){$('#closedList').innerHTML=`<div class="empty">${state.lang==='fr'?'Aucune position clôturée enregistrée.':'No closed positions recorded.'}</div>`;return}
 $('#closedList').innerHTML=state.closed.map(p=>{const entry=state.cur==='eur'?num(p.entryEur):num(p.entryUsd),exit=state.cur==='eur'?num(p.exitEur):num(p.exitUsd),sgn=p.side==='short'?-1:1,pnl=p.qty*(exit-entry)*sgn,pp=entry?((exit-entry)/entry*100)*sgn:0;return `<div class="closed-row"><span>${new Date(p.closedAt).toLocaleString()}</span><b>${p.name} (${p.symbol.toUpperCase()}) • ${p.broker}</b><span>${p.side.toUpperCase()}</span><b class="${klass(pnl)}">${money(pnl)}</b><b class="${klass(pp)}">${pct(pp)}</b></div>`}).join('');
}
async function refreshPositionPrices(manual=false){
 if(!state.positions.length){if(manual)toast(state.lang==='fr'?'Aucune position ouverte.':'No open position.');return}
 const ids=[...new Set(state.positions.map(p=>p.assetId))];
 try{
  const r=await fetch(`${CONFIG.api}/simple/price?ids=${ids.map(encodeURIComponent).join(',')}&vs_currencies=eur,usd`);if(!r.ok)throw new Error();const j=await r.json();
  state.positions=state.positions.map(p=>({...p,currentEur:num(j[p.assetId]?.eur,p.currentEur),currentUsd:num(j[p.assetId]?.usd,p.currentUsd),lastPriceAt:new Date().toISOString()}));persistPositions();renderPositions();renderPositionKpis();if(manual)toast(state.lang==='fr'?'Prix des positions actualisés.':'Position prices refreshed.');
 }catch(e){if(manual)toast(state.lang==='fr'?'Actualisation des prix indisponible.':'Price refresh unavailable.')}
}
function startPositionTimer(){clearInterval(state.posTimer);state.posTimer=setInterval(()=>refreshPositionPrices(false),CONFIG.positionMs);refreshPositionPrices(false)}

function openAuth(){ $('#authModal').classList.add('open'); $('#authModal').setAttribute('aria-hidden','false'); $('#adminEmail').value=state.authEmail||'admin@ebytda.local'; }
function closeAuth(){ $('#authModal').classList.remove('open'); $('#authModal').setAttribute('aria-hidden','true'); }
function updateAuthUI(){
 $('#authBtn').textContent=state.auth?(state.lang==='fr'?'Déconnexion admin':'Admin logout'):(state.lang==='fr'?'Portail Admin':'Admin portal');
 $('#authState').textContent=state.auth?`${state.lang==='fr'?'Admin connecté':'Admin connected'} • ${state.authEmail}`:(state.lang==='fr'?'Portail admin verrouillé':'Admin portal locked');
 $('#authSub').textContent=state.auth?(state.lang==='fr'?'Dashboard premium déverrouillé : tickets d’ordre actifs.':'Premium dashboard unlocked: order tickets enabled.'):(state.lang==='fr'?'Connectez-vous pour déverrouiller le ticket d’ordre et le suivi administrateur.':'Sign in to unlock order tickets and admin tracking.');
 $('#sessionState').textContent=state.auth?'OPEN':'LOCKED';
 const gate=$('#adminGateCard'); if(gate) gate.style.display=state.auth?'none':'block';
}
function doLogin(){ const email=$('#adminEmail').value.trim(), pass=$('#adminPass').value; if(!email){toast(state.lang==='fr'?'Email admin requis.':'Admin email required.'); return} if(pass!==CONFIG.demoPass){toast(state.lang==='fr'?'Code portail invalide.':'Invalid portal code.'); return} state.auth=true; state.authEmail=email; localStorage.setItem(CONFIG.authKey,'1'); localStorage.setItem(CONFIG.authEmailKey,email); updateAuthUI(); closeAuth(); renderSelected(); toast(state.lang==='fr'?'Portail administrateur déverrouillé.':'Administrator portal unlocked.'); }
function doLogout(){ state.auth=false; state.authEmail=''; localStorage.removeItem(CONFIG.authKey); localStorage.removeItem(CONFIG.authEmailKey); updateAuthUI(); closeAuth(); closeModal(); renderSelected(); toast(state.lang==='fr'?'Session admin fermée.':'Admin session closed.'); }

function setLang(l){state.lang=l;localStorage.setItem('ebyt-lang',l);$$('[data-lang]').forEach(b=>b.classList.toggle('active',b.dataset.lang===l));state.rows=state.rows.map(r=>scoreAsset(r,state.market));state.ranked=state.rows.filter(r=>!CONFIG.stable.has(r.symbol)).sort((a,b)=>b.ai-a.ai);state.selected=state.rows.find(r=>r.id===state.selected?.id)||state.ranked[0];renderAll()}
function setCur(c){if(c===state.cur)return;state.cur=c;localStorage.setItem('ebyt-cur',c);$$('[data-cur]').forEach(b=>b.classList.toggle('active',b.dataset.cur===c));scan(true)}
$('#refreshBtn').onclick=()=>scan(true);$('#refreshPositionsBtn').onclick=()=>refreshPositionPrices(true);$('#search').oninput=renderUniverse;$('#statusFilter').onchange=renderUniverse;$('#openOrderBtn').onclick=openModal;$('#manualCheck').onchange=e=>$('#confirmOrderBtn').disabled=!e.target.checked;$('#confirmOrderBtn').onclick=confirmOrder;
$('#authBtn').onclick=()=>state.auth?doLogout():openAuth(); $('#openPortalBtn').onclick=openAuth; $('#openGateBtn').onclick=openAuth; $('#loginBtn').onclick=doLogin; $('#discoverBtn').onclick=()=>document.getElementById('radar').scrollIntoView({behavior:'smooth',block:'start'});
$$('[data-close-modal]').forEach(e=>e.onclick=closeModal); $$('[data-close-auth]').forEach(e=>e.onclick=closeAuth);$$('[data-lang]').forEach(b=>b.onclick=()=>setLang(b.dataset.lang));$$('[data-cur]').forEach(b=>b.onclick=()=>setCur(b.dataset.cur));$$('[data-days]').forEach(b=>b.onclick=()=>{$$('[data-days]').forEach(x=>x.classList.toggle('active',x===b));state.chartDays=Number(b.dataset.days);loadChart()});
$$('[data-nav]').forEach(b=>b.onclick=()=>{$$('[data-nav]').forEach(x=>x.classList.toggle('active',x===b));document.getElementById(b.dataset.nav).scrollIntoView({behavior:'smooth',block:'start'})});
$('#clearHistoryBtn').onclick=()=>{if(confirm(state.lang==='fr'?"Vider l'historique des positions clôturées ?":'Clear closed-position history?')){state.closed=[];persistClosed();renderClosed()}};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal(); closeAuth();}});
$$('[data-cur]').forEach(b=>b.classList.toggle('active',b.dataset.cur===state.cur));$$('[data-lang]').forEach(b=>b.classList.toggle('active',b.dataset.lang===state.lang));
translateStatic();startPositionTimer();scan(false);
})();