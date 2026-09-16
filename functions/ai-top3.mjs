import {requireAuth,json} from "./auth-lib.mjs";
function extractText(data){
 if(typeof data.output_text==="string")return data.output_text;
 for(const item of data.output||[])for(const c of item.content||[])if(typeof c.text==="string")return c.text;
 return "";
}
function parseJson(txt){const m=txt.match(/\{[\s\S]*\}/);if(!m)throw new Error("Réponse IA non JSON");return JSON.parse(m[0])}
export default async (req)=>{
 const a=requireAuth(req);if(!a.ok)return json({error:a.message},a.status);
 if(req.method!=="POST")return json({error:"Method not allowed"},405,a.headers);
 const key=process.env.OPENAI_API_KEY,model=process.env.EBYTDA_AI_MODEL;
 if(!key||!model)return json({error:"OPENAI_API_KEY ou EBYTDA_AI_MODEL manquant"},503,a.headers);
 const body=await req.json().catch(()=>null);if(!body?.candidates?.length)return json({error:"Candidats manquants"},400,a.headers);
 const system=`Tu es le module d'arbitrage EBYTDA. Tu ne peux choisir que parmi les candidats fournis par le moteur quantitatif.
Tu ne dois inventer aucune donnée de marché. Classe au maximum 3 setups exploitables. Pour chacun, donne entry_timing parmi "MAINTENANT","DANS ~1H","ATTENDRE", une justification détaillée, un horizon de sortie et un plan de sortie.
Les niveaux entrée/stop/TP sont calculés par le Risk Engine et ne doivent pas être modifiés.
Si le timing est mauvais, garde le candidat mais indique ATTENDRE. Aucun résultat n'est garanti.
Réponds uniquement en JSON: {"top3":[{"id":"...","symbol":"...","fomo_score":0,"entry_timing":"...","entry_note":"...","exit_horizon":"...","exit_plan":"...","comment":"..."}]}.`;
 const input=system+"\n\nDonnées:\n"+JSON.stringify(body);
 const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model,input})});
 if(!r.ok)return json({error:`OpenAI ${r.status}`,detail:await r.text()},502,a.headers);
 const data=await r.json();
 try{return json(parseJson(extractText(data)),200,a.headers)}catch(e){return json({error:e.message,raw:extractText(data).slice(0,1000)},502,a.headers)}
};
