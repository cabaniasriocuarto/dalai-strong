import React, { useEffect, useMemo, useState } from "react";

// Dalai Strong – App Nutricional (compact, cleaned)
// Mantiene: Menú con ficha + micro/macro, "Mi día", objetivos día/semana/mes,
// recomendación por altura/peso, planificador por fecha + compartir, sugeridor de combos ±t,
// banners rotativos (7s), y panel Admin (demo). Self-tests mínimos al montar.

// ---------- Tipos ----------

type Macros = { kcal:number; protein:number; carbs:number; fat:number };
type Micros = { fiber?:number; sodium?:number; calcium?:number; iron?:number; vitC?:number; b12?:number };
type Dish = { id:string; name:string; tags:("vegano"|"vegetariano"|"fit"|"sin_gluten")[]; portionGrams:number; macros:Macros; micros:Micros; allergens?:string[]; brand?:string };
type Goals = { kcal:number; protein:number; carbs:number; fat:number; fiber:number; sodium:number; calcium:number; iron:number; vitC:number; b12:number };
type Plan = { [dateISO:string]: { items: { dishId:string; portions:number }[] } };
type Combo={items:{dish:Dish;portions:number}[];sum:{macros:Macros;micros:Micros}};

// ---------- Datos (SARA 2 orientativo) ----------

const DISHES: Dish[] = [
  { id:"bowl-quinoa-tofu", name:"Bowl de Quinoa + Tofu", tags:["vegano","fit","sin_gluten"], portionGrams:380, macros:{kcal:520,protein:28,carbs:58,fat:18}, micros:{fiber:9,sodium:520,calcium:220,iron:5.2,vitC:18,b12:0}, allergens:["soja","sésamo"], brand:"Dalai Strong" },
  { id:"kale-garbanzos", name:"Kale + Garbanzos crocantes", tags:["vegano","fit","sin_gluten"], portionGrams:320, macros:{kcal:420,protein:20,carbs:42,fat:16}, micros:{fiber:10,sodium:380,calcium:180,iron:4.4,vitC:60}, allergens:["sésamo"], brand:"Dalai Strong" },
  { id:"lettuce-wrap", name:"Wrap Lechuga + Falafel", tags:["vegano","fit","sin_gluten"], portionGrams:360, macros:{kcal:460,protein:22,carbs:40,fat:20}, micros:{fiber:11,sodium:640,calcium:170,iron:4.8,vitC:20}, allergens:["sésamo"], brand:"Dalai Strong" },
  { id:"sopa-calabaza", name:"Sopa de Calabaza", tags:["vegano","fit","sin_gluten"], portionGrams:400, macros:{kcal:220,protein:5,carbs:32,fat:8}, micros:{fiber:6,sodium:480,calcium:80,iron:1.4,vitC:18}, brand:"Dalai Strong" },
  { id:"tacos-maiz", name:"Tacos Maíz + Portobello", tags:["vegano","fit","sin_gluten"], portionGrams:340, macros:{kcal:510,protein:17,carbs:52,fat:24}, micros:{fiber:9,sodium:620,calcium:120,iron:2.4,vitC:22}, brand:"Dalai Strong" },
  { id:"blackbean-burger", name:"Burger Porotos Negros", tags:["vegano","fit","sin_gluten"], portionGrams:300, macros:{kcal:430,protein:26,carbs:36,fat:18}, micros:{fiber:10,sodium:560,calcium:110,iron:3.6,vitC:10}, brand:"Dalai Strong" },
  { id:"chia-pudding", name:"Pudding de Chía", tags:["vegano","fit","sin_gluten"], portionGrams:250, macros:{kcal:300,protein:9,carbs:28,fat:15}, micros:{fiber:12,sodium:120,calcium:260,iron:2.2,vitC:14}, brand:"Dalai Strong" },
  { id:"smoothie-verde", name:"Smoothie Verde", tags:["vegano","fit","sin_gluten"], portionGrams:330, macros:{kcal:230,protein:6,carbs:45,fat:3}, micros:{fiber:7,sodium:50,calcium:90,iron:1.8,vitC:70}, brand:"Dalai Strong" },
];

// ---------- Utils UI ----------

const clamp=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));
const fmt=(n:number,d=0)=>n.toLocaleString("es-AR",{maximumFractionDigits:d,minimumFractionDigits:d});
const Badge=({children}:{children:React.ReactNode})=> <span className="inline-block rounded-full border px-2 py-0.5 text-xs text-slate-600 border-slate-200">{children}</span>;
const Section=({title,children,right}:{title:string;children:React.ReactNode;right?:React.ReactNode})=> (
  <section className="mb-6"><div className="flex items-center justify-between mb-2"><h2 className="text-lg font-semibold">{title}</h2>{right}</div><div className="rounded-2xl border p-4 shadow-sm bg-white/70">{children}</div></section>
);
const ProgressBar=({value,target}:{value:number;target:number})=>{const pct=clamp(target>0?(value/target)*100:0,0,200);return <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden"><div className="h-full rounded-full" style={{width:`${pct}%`,background:`linear-gradient(90deg, rgba(56,189,248,1) 0%, rgba(34,197,94,1) 100%)`}}/></div>};
const AdBanner=({img,href,alt}:{img:string;href?:string;alt?:string})=>{const content=(<img src={img} alt={alt||"Publicidad"} className="w-full h-28 object-cover rounded-2xl border"/>);return href?(<a href={href} target="_blank" rel="noreferrer" className="block hover:opacity-95">{content}</a>):content};
const RotatingBanner=({images,interval=7000}:{images:{img:string;href?:string;alt?:string}[];interval?:number})=>{const[idx,setIdx]=useState(0);useEffect(()=>{const id=setInterval(()=>setIdx(i=>(i+1)%images.length),interval);return()=>clearInterval(id)},[images.length,interval]);const c=images[idx];return<AdBanner img={c.img} href={c.href} alt={c.alt}/>};
const Stepper=({value,onChange,min=0,max=20}:{value:number;onChange:(v:number)=>void;min?:number;max?:number})=> (
  <div className="inline-flex items-center gap-2"><button className="px-2 py-1 border rounded-lg" onClick={()=>onChange(clamp(value-1,min,max))}>−</button><span className="w-6 text-center text-sm">{value}</span><button className="px-2 py-1 border rounded-lg" onClick={()=>onChange(clamp(value+1,min,max))}>+</button></div>
);

// ---------- Estado persistente ----------

const LS={ goals:"nk_goals_v2", day:"nk_day_v1", plan:"nk_plan_v1", user:"nk_user_v1", tol:"nk_tol_v1", extra:"nk_extra_dishes_v1" };
function useLocalState<T>(k:string,i:T){const[s,setS]=useState<T>(()=>{try{const r=localStorage.getItem(k);return r?JSON.parse(r) as T:i}catch{return i}});useEffect(()=>{try{localStorage.setItem(k,JSON.stringify(s))}catch{}},[k,s]);return[s,setS] as const}

// ---------- Objetivos por período ----------

const GOALS_DAY:Goals={kcal:2000,protein:110,carbs:230,fat:60,fiber:30,sodium:1800,calcium:1000,iron:14,vitC:60,b12:2.4};
const scale=(g:Goals,k:number):Goals=>({kcal:g.kcal*k,protein:g.protein*k,carbs:g.carbs*k,fat:g.fat*k,fiber:g.fiber*k,sodium:g.sodium*k,calcium:g.calcium*k,iron:g.iron*k,vitC:g.vitC*k,b12:g.b12*k});
const DEFAULT={period:"day" as "day"|"week"|"month",values:{day:GOALS_DAY,week:scale(GOALS_DAY,7),month:scale(GOALS_DAY,30)}};

// ---------- Cálculos ----------

const addM=(a:Macros,b:Macros):Macros=>({kcal:a.kcal+b.kcal,protein:a.protein+b.protein,carbs:a.carbs+b.carbs,fat:a.fat+b.fat});
const addu=(a:Micros,b:Micros):Micros=>({fiber:(a.fiber||0)+(b.fiber||0),sodium:(a.sodium||0)+(b.sodium||0),calcium:(a.calcium||0)+(b.calcium||0),iron:(a.iron||0)+(b.iron||0),vitC:(a.vitC||0)+(b.vitC||0),b12:(a.b12||0)+(b.b12||0)});
function sumItems(items:{dishId:string;portions:number}[]){return items.reduce((acc,it)=>{const d=ALL_REF.find(x=>x.id===it.dishId)!;for(let i=0;i<it.portions;i++){acc.macros=addM(acc.macros,d.macros);acc.micros=addu(acc.micros,d.micros);acc.weight+=d.portionGrams}return acc},{macros:{kcal:0,protein:0,carbs:0,fat:0},micros:{},weight:0} as {macros:Macros;micros:Micros;weight:number})}

const iso=(d:Date)=>d.toISOString().slice(0,10);
function weekRange(a:Date){const day=a.getDay();const s=new Date(a);s.setDate(a.getDate()-((day+6)%7));const e=new Date(s);e.setDate(s.getDate()+6);return{start:s,end:e}}
const inR=(d:Date,s:Date,e:Date)=>d>=s&&d<=e;
function sumPlan(p:Plan,per:"day"|"week"|"month",a:Date){const out:{macros:Macros;micros:Micros;weight:number}={macros:{kcal:0,protein:0,carbs:0,fat:0},micros:{},weight:0};if(per==="day")return sumItems(p[iso(a)]?.items||[]);if(per==="week"){const{start,end}=weekRange(a);Object.entries(p).forEach(([k,v])=>{const d=new Date(k+"T00:00:00");if(inR(d,start,end)){const s=sumItems(v.items);out.macros=addM(out.macros,s.macros);out.micros=addu(out.micros,s.micros);out.weight+=s.weight}});return out}const y=a.getFullYear(),m=a.getMonth();Object.entries(p).forEach(([k,v])=>{const d=new Date(k+"T00:00:00");if(d.getFullYear()===y&&d.getMonth()===m){const s=sumItems(v.items);out.macros=addM(out.macros,s.macros);out.micros=addu(out.micros,s.micros);out.weight+=s.weight}});return out}

// --- Sugeridor combos ---

const within=(v:number,t:number,tl:number)=>t<=0|| (v>=t*(1-tl)&&v<=t*(1+tl));
const rerr=(v:number,t:number)=>t<=0?0:Math.abs(v-t)/t;
function score(c:Combo,g:Goals,t:number){const m=c.sum.macros,mi=c.sum.micros;const ok=within(m.kcal,g.kcal,t)&&within(m.protein,g.protein,t)&&within(mi.fiber||0,g.fiber,t)&&within(mi.sodium||0,g.sodium,t);const s=1-(0.35*(1-rerr(m.kcal,g.kcal))+0.35*(1-rerr(m.protein,g.protein))+0.2*(1-rerr(mi.fiber||0,g.fiber))+0.1*(1-rerr(mi.sodium||0,g.sodium)));const sod=mi.sodium||0;const pen=sod>g.sodium*(1+t)?(sod-g.sodium*(1+t))/(g.sodium*(1+t)+1):0;return{ok,score:s+pen}}
function combos(pool:Dish[]):Combo[]{const C:Combo[]=[];for(let i=0;i<pool.length;i++){const a=pool[i];C.push({items:[{dish:a,portions:1}],sum:{macros:a.macros,micros:a.micros}});for(let j=i+1;j<pool.length;j++){const b=pool[j],ab={items:[{dish:a,portions:1},{dish:b,portions:1}],sum:{macros:addM(a.macros,b.macros),micros:addu(a.micros,b.micros)}};C.push(ab);for(let k=j+1;k<pool.length;k++){const c=pool[k];C.push({items:[...ab.items,{dish:c,portions:1}],sum:{macros:addM(ab.sum.macros,c.macros),micros:addu(ab.sum.micros,c.micros)}})}}}return C}
function suggest(g:Goals,tolPct:number,pool:Dish[],top=5):Combo[]{const t=tolPct/100;const S=combos(pool).map(c=>({c,r:score(c,g,t)}));const ok=S.filter(x=>x.r.ok).sort((a,b)=>a.r.score-b.r.score).map(x=>x.c);return (ok.length?ok:S.sort((a,b)=>a.r.score-b.r.score).map(x=>x.c)).slice(0,top)}

// --- Share ---

async function shareText(text:string){if((navigator as any).share){try{await (navigator as any).share({text});return true}catch{return false}}try{await navigator.clipboard.writeText(text);alert("Resumen copiado");return true}catch{return false}}
function summary(title:string,tot:{macros:Macros;micros:Micros},g?:Goals){const L:string[]=[];const p=(k:string,v:string)=>L.push(`${k}: ${v}`);L.push(`# ${title}`);p("Calorías", `${tot.macros.kcal.toFixed(0)}${g?" / "+g.kcal.toFixed(0):""}`);p("Proteína", `${tot.macros.protein.toFixed(1)} g${g?" / "+g.protein.toFixed(1)+" g":""}`);p("Carbohidratos", `${tot.macros.carbs.toFixed(1)} g${g?" / "+g.carbs.toFixed(1)+" g":""}`);p("Grasas", `${tot.macros.fat.toFixed(1)} g${g?" / "+g.fat.toFixed(1)+" g":""}`);p("Fibra", `${(tot.micros.fiber||0).toFixed(1)} g${g?" / "+g.fiber.toFixed(1)+" g":""}`);p("Sodio", `${(tot.micros.sodium||0).toFixed(0)} mg${g?" / "+g.sodium.toFixed(0)+" mg":""}`);p("Calcio", `${(tot.micros.calcium||0).toFixed(0)} mg${g?" / "+g.calcium.toFixed(0)+" mg":""}`);p("Hierro", `${(tot.micros.iron||0).toFixed(1)} mg${g?" / "+g.iron.toFixed(1)+" mg":""}`);p("Vit C", `${(tot.micros.vitC||0).toFixed(0)} mg${g?" / "+g.vitC.toFixed(0)+" mg":""}`);p("Vit B12", `${(tot.micros.b12||0).toFixed(1)} µg${g?" / "+g.b12.toFixed(1)+" µg":""}`);L.push("","#DalaiStrong #ComeConDatos");return L.join('\n')}

// ---------- App ----------

let ALL_REF:Dish[]=DISHES;
export default function App(){
  const[user,setUser]=useLocalState<{id:string;name:string}|null>(LS.user,null);
  const[day,setDay]=useLocalState<{dishId:string;portions:number}[]>(LS.day,[]);
  const[plan,setPlan]=useLocalState<Plan>(LS.plan,{});
  const[go,setGo]=useLocalState<typeof DEFAULT>(LS.goals,DEFAULT);
  const[tol,setTol]=useLocalState<number>(LS.tol,17);
  const[q,setQ]=useState("");
  const[tag,setTag]=useState("all");
  const[date,setDate]=useState(()=>new Date().toISOString().slice(0,10));
  const[extra,setExtra]=useLocalState<Dish[]>(LS.extra,[]);
  const ALL=useMemo(()=>{const a=[...DISHES,...extra];ALL_REF=a;return a},[extra]);

  // self-tests mínimos
  useEffect(()=>{try{
    const sm=summary('Test',{macros:{kcal:1,protein:1,carbs:1,fat:1},micros:{}});console.assert(sm.includes('\n'),'summary newline');
    console.assert(scale(GOALS_DAY,7).kcal===GOALS_DAY.kcal*7,'scale');
    const t1=sumItems([{dishId:DISHES[0].id,portions:2}]);console.assert(t1.macros.kcal===DISHES[0].macros.kcal*2,'sumItems');
    const comb=combos(DISHES.slice(0,3));console.assert(comb.some(c=>c.items.length===3),'combos 3-items');
    const ff=ALL.filter(d=>d.tags.includes('vegano')).length;console.assert(ff>=0,'filter safe');
  }catch(e){console.warn('selftest',e)}},[]);

  const add=(id:string)=>setDay(d=>[...d,{dishId:id,portions:1}]);
  const ch=(i:number,q:number)=>setDay(d=>d.map((it,ix)=>ix===i?{...it,portions:Math.max(0,q)}:it).filter(x=>x.portions>0));
  const rm=(i:number)=>setDay(d=>d.filter((_,ix)=>ix!==i));
  const totDay=useMemo(()=>sumItems(day),[day]);
  const filtered=useMemo(()=>{const s=q.trim().toLowerCase();return ALL.filter(d=>(!s||`${d.name} ${d.brand||''}`.toLowerCase().includes(s))&&(tag==="all"||d.tags.includes(tag as any)))},[q,tag,ALL]);
  const curPer=go.period; const curGoals:Goals=go.values[curPer];
  const anchor=useMemo(()=>new Date(date+"T00:00:00"),[date]);
  const totPer=useMemo(()=>sumPlan(plan,curPer,anchor),[plan,curPer,anchor]);
  const sug=useMemo(()=>suggest(go.values.day,tol,ALL,5),[go.values.day,tol,ALL]);

  const RowStats=({pairs}:{pairs:{label:string;value:number;target?:number;dec?:number;suffix?:string}[]})=> (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{pairs.map((p,i)=> (
      <div key={i}><div className="text-xs text-slate-500 mb-1">{p.label}</div>{p.target!=null?<ProgressBar value={p.value} target={p.target}/>:null}<div className="text-xs mt-1">{fmt(p.value,p.dec||0)}{p.target!=null?` / ${fmt(p.target)}`:''} {p.suffix||''}</div></div>
    ))}</div>
  );

  const MicroGrid=({m}:{m:Micros})=>{const F:[(keyof Micros),string,string?,number?][]=[["fiber","Fibra","g",1],["sodium","Sodio","mg"],["calcium","Calcio","mg"],["iron","Hierro","mg",1],["vitC","Vitamina C","mg"],["b12","Vit. B12","µg",1]];return (
    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs mt-2">{F.map(([k,l,u,d])=> m[k]!=null? <div key={String(k)} className="p-2 rounded-lg bg-slate-50"><div className="text-[10px] text-slate-500">{l}</div><div className="font-medium">{fmt(m[k] as number,d||0)} {u}</div></div>:null)} </div>
  )};

  // --- helpers de JSX para evitar llaves anidadas confusas ---
  const menuRight=(
    <div className="flex items-center gap-2">
      <select className="border rounded-xl px-2 py-1" value={tag} onChange={e=>setTag(e.target.value)}>
        <option value="all">Todos</option>
        <option value="vegano">Vegano</option>
        <option value="vegetariano">Vegetariano</option>
        <option value="fit">Fit</option>
        <option value="sin_gluten">Sin gluten</option>
      </select>
      <input className="border rounded-xl px-3 py-1 w-44" placeholder="Buscar" value={q} onChange={e=>setQ(e.target.value)}/>
    </div>
  );

  return (
  <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-800 p-4 sm:p-6"><div className="max-w-5xl mx-auto">
    <header className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3"><div><h1 className="text-2xl sm:text-3xl font-bold">Dalai Strong – App Nutricional</h1><p className="text-sm text-slate-600">Elegí platos, mirá su composición y alcanzá tus objetivos (±{fmt(tol)}%). Fuente: SARA 2.</p></div>
      <div className="flex items-center gap-2">{user? (<><span className="text-sm">Hola, <b>{user.name}</b></span><button className="px-3 py-1.5 rounded-xl border hover:bg-slate-50" onClick={()=>setUser(null)}>Salir</button>{user.id!=="admin"&&<button className="px-3 py-1.5 rounded-xl border hover:bg-slate-50" onClick={()=>setUser({id:"admin",name:"Admin"})}>Modo Admin (demo)</button>}</>): (<button className="px-3 py-1.5 rounded-xl border hover:bg-slate-50" onClick={()=>setUser({id:"demo",name:"Invitado"})}>Iniciar sesión (demo)</button>)}</div>
    </header>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6"><RotatingBanner images={[{img:"/banners/kaboom-combo-1.jpg",href:"#",alt:"Kaboom 1"},{img:"/banners/kaboom-combo-2.jpg",href:"#",alt:"Kaboom 2"}]}/><RotatingBanner images={[{img:"/banners/kaboom-combo-2.jpg",href:"#",alt:"Kaboom 2"},{img:"/banners/kaboom-combo-1.jpg",href:"#",alt:"Kaboom 1"}]}/></div>

    <Section title="Perfil y recomendación (ARG orientativa)" right={<span className="text-xs text-slate-500">GAPA/ANMAT</span>}><RecoBox onApply={(g)=>setGo({...go,values:{...go.values,day:g}})}/></Section>

    <div className="grid md:grid-cols-2 gap-6">
      <Section title="Menú Dalai Strong" right={menuRight}>
        <div className="grid gap-3">{filtered.map(d=> (
          <div key={d.id} className="rounded-xl border p-3 bg-white hover:shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-semibold leading-tight">{d.name}</h3>
                <div className="mt-1 flex flex-wrap gap-1">{d.brand&&<Badge>{d.brand}</Badge>}{d.tags.map(t=><Badge key={t}>{t.replace('_',' ')}</Badge>)}{d.allergens?.length?<Badge>Alérgenos: {d.allergens.join(', ')}</Badge>:null}<Badge>{fmt(d.portionGrams)} g</Badge><Badge>Fuente: SARA 2</Badge></div>
              </div>
              <button className="px-3 py-1.5 rounded-xl border bg-slate-50 hover:bg-white" onClick={()=>add(d.id)}>Agregar a mi día</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">{[{l:'Calorías',v:d.macros.kcal,s:'kcal'},{l:'Proteína',v:d.macros.protein,s:'g'},{l:'Carbohidratos',v:d.macros.carbs,s:'g'},{l:'Grasas',v:d.macros.fat,s:'g'}].map((x,i)=>(<div key={i} className="p-2 rounded-lg bg-slate-50"><div className="text-xs text-slate-500">{x.l}</div><div className="font-semibold">{fmt(x.v)} {x.s}</div></div>))}</div>
            <MicroGrid m={d.micros}/>
          </div>
        ))}</div>
      </Section>

      <Section title="Mi día (hoy)" right={<div className="flex items-center gap-2"><button className="px-2.5 py-1 rounded-lg border hover:bg-slate-50" onClick={()=>setDay([])} disabled={!day.length}>Limpiar</button><button className="px-2.5 py-1 rounded-lg border hover:bg-slate-50" onClick={()=>shareText(summary("Mi día – Dalai Strong",totDay,go.values.day))}>Compartir</button></div>}>
        {day.length===0? <p className="text-sm text-slate-600">Aún no agregaste platos.</p> : (
          <div className="space-y-3">{day.map((it,i)=>{const d=ALL.find(x=>x.id===it.dishId)!;return (
            <div key={i} className="flex items-center justify-between gap-2 border rounded-lg p-2"><div className="text-sm"><div className="font-medium">{d.name}</div><div className="text-xs text-slate-500">{fmt(d.portionGrams)} g · {fmt(d.macros.kcal)} kcal</div></div><div className="flex items-center gap-2"><Stepper value={it.portions} onChange={v=>ch(i,v)} min={0}/><button className="text-xs px-2 py-1 rounded-lg border" onClick={()=>rm(i)}>Quitar</button></div></div>
          )})}
            <RowStats pairs={[{label:'Calorías',value:totDay.macros.kcal,target:go.values.day.kcal,suffix:'kcal'},{label:'Proteína',value:totDay.macros.protein,target:go.values.day.protein,dec:1,suffix:'g'},{label:'Fibra',value:totDay.micros.fiber||0,target:go.values.day.fiber,dec:1,suffix:'g'},{label:'Sodio',value:totDay.micros.sodium||0,target:go.values.day.sodium,suffix:'mg'}]}/>
            <RowStats pairs={[{label:'Calcio',value:totDay.micros.calcium||0,target:go.values.day.calcium,suffix:'mg'},{label:'Hierro',value:totDay.micros.iron||0,target:go.values.day.iron,dec:1,suffix:'mg'},{label:'Vit C',value:totDay.micros.vitC||0,target:go.values.day.vitC,suffix:'mg'},{label:'Vit B12',value:totDay.micros.b12||0,target:go.values.day.b12,dec:1,suffix:'µg'}]}/>
            <p className="text-[11px] text-slate-500">Valores estimados (SARA 2). Pueden variar por proveedor y cocción.</p>
          </div>
        )}
      </Section>

      <Section title="Objetivos nutricionales" right={<span className="text-xs text-slate-500">Tolerancia ±{fmt(tol)}%</span>}>
        <div className="flex items-center gap-2 mb-3"><label className="text-sm">Período:</label><select className="border rounded-xl px-2 py-1" value={go.period} onChange={e=>setGo({...go,period:e.target.value as any})}><option value="day">Día</option><option value="week">Semana</option><option value="month">Mes</option></select><div className="ml-auto text-xs text-slate-500">Fecha base <input type="date" className="border rounded px-2 py-1" value={date} onChange={e=>setDate(e.target.value)}/></div></div>
        <GoalsEditor goals={go.values[curPer]} onChange={g=>setGo({...go,values:{...go.values,[curPer]:g}})}/>
        <div className="mt-3"><input type="range" min={5} max={35} value={tol} onChange={e=>setTol(Number(e.target.value))} className="w-full"/><div className="text-xs text-slate-500 mt-1">Ajustá la tolerancia (default 17%).</div></div>
      </Section>

      <Section title="Planificador de menús" right={<span className="text-xs text-slate-500">Plan + compartir</span>}>
        <div className="flex items-center gap-2 mb-3"><label className="text-sm">Fecha:</label><input type="date" className="border rounded px-2 py-1" value={date} onChange={e=>setDate(e.target.value)}/><button className="ml-auto px-3 py-1.5 rounded-xl border bg-slate-50 hover:bg-white" onClick={()=>{const k=date;const items=(plan[k]?.items||[]).concat([{dishId:ALL[0].id,portions:1}]);setPlan({...plan,[k]:{items}})}}>Agregar plato ejemplo</button></div>
        <PlannedList dateISO={date} plan={plan} setPlan={setPlan} dishes={ALL}/>
        <div className="mt-4 border rounded-2xl p-3 bg-white"><div className="flex items-center justify-between mb-2"><h3 className="font-semibold text-sm">Resumen planificado ({curPer})</h3><button className="px-3 py-1.5 rounded-xl border bg-slate-50 hover:bg-white text-sm" onClick={()=>shareText(summary(`Plan ${curPer} – Dalai Strong`,totPer,curGoals))}>Compartir</button></div><PeriodSummary totals={totPer} goals={curGoals}/></div>
      </Section>

      <Section title="Sugerencias de combos (hasta 3 platos)"><p className="text-sm text-slate-600 mb-3">Con tolerancia ±{fmt(tol)}% respecto a tus objetivos diarios.</p><div className="space-y-3">{sug.map((c,idx)=>(<div key={idx} className="border rounded-xl p-3 bg-white"><div className="flex flex-wrap gap-2 mb-2">{c.items.map((it,i)=>(<Badge key={i}>{it.dish.name}</Badge>))}</div><div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">{[{l:'kcal',v:c.sum.macros.kcal,s:''},{l:'Proteína (g)',v:c.sum.macros.protein,d:1},{l:'Carbohidratos (g)',v:c.sum.macros.carbs,d:1},{l:'Grasas (g)',v:c.sum.macros.fat,d:1},{l:'Fibra (g)',v:c.sum.micros.fiber||0,d:1},{l:'Sodio (mg)',v:c.sum.micros.sodium||0}].map((x,i)=>(<div key={i} className="p-2 bg-slate-50 rounded-lg text-xs"><div className="text-[10px] text-slate-500">{x.l}</div><div className="font-medium">{fmt(x.v,x.d||0)} {x.s||''}</div></div>))}</div><div className="mt-2"><button className="px-3 py-1.5 rounded-xl border bg-slate-50 hover:bg-white" onClick={()=>{const items=c.items.map(it=>({dishId:it.dish.id,portions:it.portions}));setDay(d=>[...d,...items]);window.scrollTo({top:0,behavior:'smooth'})}}>Agregar combo a mi día</button></div></div>))}</div></Section>

      {user?.id==='admin'&& (<Section title="Admin (demo) – Cargar platos" right={<span className="text-xs text-slate-500">Guardado local</span>}><AdminPanel onAdd={d=>setExtra([...extra,d])} onClear={()=>setExtra([])} extra={extra}/></Section>)}
    </div>
    <footer className="mt-8 text-[11px] text-slate-500"><p>* Composición basada en SARA 2 – Ministerio de Salud (Argentina). Valores estimativos; no sustituyen consejo médico. Libre de gluten según receta y protocolos.</p></footer>
  </div></div>);
}

// ---------- Subcomponentes ----------

function GoalsEditor({goals,onChange}:{goals:Goals;onChange:(g:Goals)=>void}){const F:{key:keyof Goals;label:string;step?:number}[]=[{key:"kcal",label:"Calorías (kcal)"},{key:"protein",label:"Proteína (g)",step:0.1},{key:"carbs",label:"Carbohidratos (g)",step:0.1},{key:"fat",label:"Grasas (g)",step:0.1},{key:"fiber",label:"Fibra (g)",step:0.1},{key:"sodium",label:"Sodio (mg)"},{key:"calcium",label:"Calcio (mg)"},{key:"iron",label:"Hierro (mg)",step:0.1},{key:"vitC",label:"Vitamina C (mg)"},{key:"b12",label:"Vitamina B12 (µg)",step:0.1}];return <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{F.map(f=>(<label key={f.key} className="text-sm"><div className="text-xs text-slate-500 mb-1">{f.label}</div><input type="number" step={f.step||1} className="w-full border rounded-xl px-3 py-1.5" value={Number((goals as any)[f.key])} onChange={e=>onChange({...goals,[f.key]:Number(e.target.value)} as Goals)} min={0}/></label>))}</div>}

function PlannedList({dateISO,plan,setPlan,dishes}:{dateISO:string;plan:Plan;setPlan:(p:Plan)=>void;dishes:Dish[]}){
  const items=plan[dateISO]?.items||[];
  const add=(id:string)=>{if(!id)return;const next=(plan[dateISO]?.items||[]).concat([{dishId:id,portions:1}]);setPlan({...plan,[dateISO]:{items:next}})};
  const rm=(i:number)=>{const a=[...items];a.splice(i,1);setPlan({...plan,[dateISO]:{items:a}})};
  const ch=(i:number,p:number)=>{const a=items.map((it,ix)=>ix===i?{...it,portions:Math.max(0,p)}:it).filter(x=>x.portions>0);setPlan({...plan,[dateISO]:{items:a}})};
  const tot=sumItems(items);
  return (
    <div>
      <div className="flex gap-2 mb-2">
        <select className="border rounded-xl px-2 py-1" onChange={e=>add(e.target.value)}>
          <option value="">Agregar plato…</option>
          {dishes.map(d=> <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {items.length>0 && (
          <button className="px-2.5 py-1 rounded-lg border hover:bg-slate-50" onClick={()=>setPlan({...plan,[dateISO]:{items:[]}})}>Vaciar fecha</button>
        )}
        <button className="ml-auto px-3 py-1.5 rounded-xl border bg-slate-50 hover:bg-white" onClick={()=>shareText(summary(`Plan del ${dateISO} – Dalai Strong`,tot))}>Compartir fecha</button>
      </div>

      {items.length===0 ? (
        <p className="text-sm text-slate-600">No hay platos planificados.</p>
      ) : (
        <div className="space-y-2">
          {items.map((it,i)=>{
            const d=dishes.find(x=>x.id===it.dishId)!;
            return (
              <div key={i} className="flex items-center justify-between gap-2 border rounded-lg p-2 bg-white">
                <div className="text-sm">
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-slate-500">{fmt(d.portionGrams)} g · {fmt(d.macros.kcal)} kcal</div>
                </div>
                <div className="flex items-center gap-2">
                  <Stepper value={it.portions} onChange={v=>ch(i,v)} />
                  <button className="text-xs px-2 py-1 rounded-lg border" onClick={()=>rm(i)}>Quitar</button>
                </div>
              </div>
            );
          })}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
            <div className="p-2 bg-slate-50 rounded-lg text-xs"><div className="text-[10px] text-slate-500">Calorías</div><div className="font-medium">{fmt(tot.macros.kcal)}</div></div>
            <div className="p-2 bg-slate-50 rounded-lg text-xs"><div className="text-[10px] text-slate-500">Proteína (g)</div><div className="font-medium">{fmt(tot.macros.protein,1)}</div></div>
            <div className="p-2 bg-slate-50 rounded-lg text-xs"><div className="text-[10px] text-slate-500">Fibra (g)</div><div className="font-medium">{fmt(tot.micros.fiber||0,1)}</div></div>
            <div className="p-2 bg-slate-50 rounded-lg text-xs"><div className="text-[10px] text-slate-500">Sodio (mg)</div><div className="font-medium">{fmt(tot.micros.sodium||0)}</div></div>
          </div>
        </div>
      )}
    </div>
  );
}

function PeriodSummary({totals,goals}:{totals:{macros:Macros;micros:Micros};goals:Goals}){const P:[string,number,number?,number?,string?][]=[["Calorías",totals.macros.kcal,goals.kcal,0,'kcal'],["Proteína",totals.macros.protein,goals.protein,1,'g'],["Fibra",totals.micros.fiber||0,goals.fiber,1,'g'],["Sodio",totals.micros.sodium||0,goals.sodium,0,'mg'],["Calcio",totals.micros.calcium||0,goals.calcium,0,'mg'],["Hierro",totals.micros.iron||0,goals.iron,1,'mg'],["Vitamina C",totals.micros.vitC||0,goals.vitC,0,'mg'],["Vitamina B12",totals.micros.b12||0,goals.b12,1,'µg']];return (<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">{P.map(([l,v,t,d,s],i)=>(<div key={i}><div className="text-xs text-slate-500 mb-1">{l}</div><ProgressBar value={v} target={t!} /><div className="text-xs mt-1">{fmt(v,d||0)} / {fmt(t!)} {s||''}</div></div>))}</div>)}

function RecoBox({onApply}:{onApply:(g:Goals)=>void}){const[height,setH]=useState(170);const[weight,setW]=useState(70);const[kpk,setK]=useState(27);const bmi=useMemo(()=>weight/Math.pow(height/100,2),[height,weight]);const kcal=Math.round(weight*kpk);const g:Goals={kcal,protein:+((kcal*0.15)/4).toFixed(0),carbs:+((kcal*0.55)/4).toFixed(0),fat:+((kcal*0.30)/9).toFixed(0),fiber:30,sodium:1800,calcium:1000,iron:14,vitC:60,b12:2.4};return (<div><div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3"><label className="text-sm"><div className="text-xs text-slate-500 mb-1">Altura (cm)</div><input type="number" className="w-full border rounded-xl px-3 py-1.5" value={height} onChange={e=>setH(Number(e.target.value))}/></label><label className="text-sm"><div className="text-xs text-slate-500 mb-1">Peso (kg)</div><input type="number" className="w-full border rounded-xl px-3 py-1.5" value={weight} onChange={e=>setW(Number(e.target.value))}/></label><label className="col-span-2 text-sm"><div className="flex items-center justify-between text-xs text-slate-500 mb-1"><span>kcal/kg (25–35)</span><span>{kpk}</span></div><input type="range" min={20} max={40} step={1} value={kpk} onChange={e=>setK(Number(e.target.value))} className="w-full"/></label></div><div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs mb-2">{[{l:'IMC',v:+bmi.toFixed(1)},{l:'kcal/día',v:kcal},{l:'Prot (g)',v:g.protein},{l:'Carbs (g)',v:g.carbs},{l:'Grasas (g)',v:g.fat},{l:'Fibra (g)',v:g.fiber}].map((x,i)=>(<div key={i} className="p-2 bg-slate-50 rounded-lg text-xs"><div className="text-[10px] text-slate-500">{x.l}</div><div className="font-medium">{fmt(x.v as number)}</div></div>))}</div><button className="px-3 py-1.5 rounded-xl border bg-slate-50 hover:bg-white" onClick={()=>onApply(g)}>Aplicar a objetivos diarios</button><p className="mt-2 text-[11px] text-slate-500">Orientación GAPA/ANMAT. Ajustá con tu profesional.</p></div>)}

function AdminPanel({onAdd,onClear,extra}:{onAdd:(d:Dish)=>void;onClear:()=>void;extra:Dish[]}){
  const[d,setD]=useState<Dish>({id:"",name:"",tags:["vegano","fit","sin_gluten"],portionGrams:300,macros:{kcal:400,protein:20,carbs:40,fat:15},micros:{fiber:8,sodium:500,calcium:100,iron:3,vitC:20,b12:0},brand:"Dalai Strong"});
  const dis=!d.id||!d.name;
  const Fm:[keyof Macros,string][]= [["kcal","kcal"],["protein","Prot (g)"],["carbs","Carbs (g)"],["fat","Grasas (g)"]];
  const fim:[keyof Micros,string][]= [["fiber","Fibra (g)"],["sodium","Sodio (mg)"],["calcium","Calcio (mg)"],["iron","Hierro (mg)"],["vitC","Vit C (mg)"],["b12","B12 (µg)"]];
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <label className="text-sm"><div className="text-xs text-slate-500 mb-1">ID único</div><input className="w-full border rounded-xl px-3 py-1.5" value={d.id} onChange={e=>setD({...d,id:e.target.value})} placeholder="ej: ensalada-kale-2024"/></label>
        <label className="col-span-2 text-sm"><div className="text-xs text-slate-500 mb-1">Nombre</div><input className="w-full border rounded-xl px-3 py-1.5" value={d.name} onChange={e=>setD({...d,name:e.target.value})}/></label>
        <label className="text-sm"><div className="text-xs text-slate-500 mb-1">Porción (g)</div><input type="number" className="w-full border rounded-xl px-3 py-1.5" value={d.portionGrams} onChange={e=>setD({...d,portionGrams:Number(e.target.value)})}/></label>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {Fm.map(([k,l])=> (
          <label key={String(k)} className="text-sm"><div className="text-xs text-slate-500 mb-1">{l}</div>
            <input type="number" className="w-full border rounded-xl px-3 py-1.5" value={(d.macros as any)[k]} onChange={e=>setD({...d,macros:{...d.macros,[k]:Number(e.target.value)}})}/>
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-3">
        {fim.map(([k,l])=> (
          <label key={String(k)} className="text-sm"><div className="text-xs text-slate-500 mb-1">{l}</div>
            <input type="number" className="w-full border rounded-xl px-3 py-1.5" value={(d.micros as any)[k]||0} onChange={e=>setD({...d,micros:{...d.micros,[k]:Number(e.target.value)}})}/>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button className="px-3 py-1.5 rounded-xl border bg-slate-50 hover:bg-white disabled:opacity-50" disabled={dis} onClick={()=>onAdd(d)}>Agregar al menú</button>
        <button className="px-3 py-1.5 rounded-xl border bg-slate-50 hover:bg-white" onClick={onClear}>Borrar cargados</button>
        <span className="text-xs text-slate-500 ml-auto">Platos cargados: {extra.length}</span>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">Tip: ID en minúsculas y sin espacios. Se guarda localmente y se combina con el menú base.</p>
    </div>
  );
}
