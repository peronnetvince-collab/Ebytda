import crypto from "node:crypto";
const COOKIE="ebytda_session";
const IDLE_MS=30*60*1000, MAX_MS=8*60*60*1000;
function secret(){return process.env.SESSION_SECRET||""}
function sign(s){return crypto.createHmac("sha256",secret()).update(s).digest("base64url")}
function parseCookies(req){const h=req.headers.get("cookie")||"";return Object.fromEntries(h.split(";").map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf("=");return [x.slice(0,i),decodeURIComponent(x.slice(i+1))]}))}
export function issueSession(username,iat=Date.now()){
 const p={u:username,iat,last:Date.now()};const raw=Buffer.from(JSON.stringify(p)).toString("base64url");return raw+"."+sign(raw)
}
export function cookieFor(token,maxAge=1800){return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`}
export function clearCookie(){return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`}
export function requireAuth(req){
 if(!secret())return {ok:false,status:500,message:"SESSION_SECRET manquant"};
 const tok=parseCookies(req)[COOKIE];if(!tok)return {ok:false,status:401,message:"Non authentifié"};
 const [raw,sig]=tok.split(".");if(!raw||!sig||!crypto.timingSafeEqual(Buffer.from(sign(raw)),Buffer.from(sig)))return {ok:false,status:401,message:"Session invalide"};
 let p;try{p=JSON.parse(Buffer.from(raw,"base64url").toString("utf8"))}catch{return {ok:false,status:401,message:"Session invalide"}}
 const now=Date.now();if(now-p.last>IDLE_MS||now-p.iat>MAX_MS)return {ok:false,status:401,message:"Session expirée"};
 const refreshed=issueSession(p.u,p.iat);return {ok:true,user:p.u,headers:{"Set-Cookie":cookieFor(refreshed)}}
}
export function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8",...headers}})}
