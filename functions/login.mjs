import {issueSession,cookieFor,json} from "./auth-lib.mjs";
export default async (req)=>{
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const {username,password}=await req.json().catch(()=>({}));
 const u=process.env.ADMIN_USERNAME,p=process.env.ADMIN_PASSWORD;
 if(!u||!p||!process.env.SESSION_SECRET)return json({error:"Configuration admin incomplète"},500);
 if(username!==u||password!==p)return json({error:"Identifiants incorrects"},401);
 return json({ok:true},200,{"Set-Cookie":cookieFor(issueSession(username))});
};
