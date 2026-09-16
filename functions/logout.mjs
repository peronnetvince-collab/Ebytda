import {clearCookie,json} from "./auth-lib.mjs";
export default async ()=>json({ok:true},200,{"Set-Cookie":clearCookie()});
