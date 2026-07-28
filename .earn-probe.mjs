import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env=Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim()]}));
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
function fare(m, now){ const ceil=Number(m.ceiling); const start=m.pdp_start!=null?Number(m.pdp_start):ceil*0.5;
  const step=m.pdp_step!=null?Number(m.pdp_step):0; const iv=m.pdp_interval!=null?Number(m.pdp_interval):0;
  if(step<=0||iv<=0) return Math.min(start,ceil);
  const from=new Date(m.pooled_at??m.created_at); const steps=Math.max(0,Math.floor((now-from)/60000/iv));
  return Math.round(Math.min(ceil,start+steps*step)*100)/100; }
const { data } = await db.from("mission").select("id,status,no_show,pickup_at,accepted_at,created_at,pooled_at,ceiling,base_fare,pdp_start,pdp_step,pdp_interval,waiting_fee,waiting_minutes,cancellation_fee,cancelled_by,driver_id")
  .not("driver_id","is",null).in("status",["completed","cancelled"]).order("pickup_at",{ascending:false}).limit(12);
const now=new Date();
console.log("status  pickup       ceiling  fare@now  fare@accept  waiting  cancelFee by");
for(const m of data??[]) console.log(
  (m.no_show?"noshow":m.status).padEnd(8),
  (m.pickup_at??"").slice(0,10),
  String(m.ceiling).padStart(7),
  String(fare(m,now)).padStart(9),
  String(m.accepted_at?fare(m,new Date(m.accepted_at)):"-").padStart(12),
  String(m.waiting_fee??"-").padStart(8),
  String(m.cancellation_fee??"-").padStart(9), m.cancelled_by??"");
const { count } = await db.from("mission").select("*",{count:"exact",head:true}).eq("status","completed").not("driver_id","is",null);
console.log("completed w/ driver:", count);
