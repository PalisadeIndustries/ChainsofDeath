'use strict';
/* ================= STATIC EARTH ================= */
const W=120,H=52,NT=W*H;
const MASK="__MASK__";
const S=14,SQ=Math.sqrt(3),HW=S*SQ,MAPW=W*HW,MAPH=(H*1.5+0.5)*S;
const latOf=r=>78-r*2.6, lonOf=(c,r)=>-180+(c+0.5*(r&1)+0.5)*3;
const wrapC=c=>((c%W)+W)%W;
const idx=(c,r)=>r*W+wrapC(c);
function hexAt(lo,la){const r=Math.max(0,Math.min(H-1,Math.round((78-la)/2.6)));return idx(Math.round((lo+180)/3-0.5-0.5*(r&1)),r)}
const DE=[[1,0],[0,-1],[-1,-1],[-1,0],[-1,1],[0,1]],DO=[[1,0],[1,-1],[0,-1],[-1,0],[0,1],[1,1]];
const NB=new Int32Array(NT*6).fill(-1);
for(let i=0;i<NT;i++){const c=i%W,r=(i/W)|0,D=(r&1)?DO:DE;for(let d=0;d<6;d++){const rr=r+D[d][1];if(rr<0||rr>=H)continue;NB[i*6+d]=idx(c+D[d][0],rr)}}
function hdist(a,b){const ca=a%W,ra=(a/W)|0,cb=b%W,rb=(b/W)|0;const q1=ca-((ra-(ra&1))>>1);let best=1e9;for(const k of [-W,0,W]){const q2=cb+k-((rb-(rb&1))>>1);const dq=q2-q1,dr=rb-ra;const d=(Math.abs(dq)+Math.abs(dr)+Math.abs(dq+dr))/2;if(d<best)best=d}return best}
function around(i,rad){const out=[i],seen=new Set([i]);let fr=[i];for(let k=0;k<rad;k++){const nx=[];for(const a of fr)for(let d=0;d<6;d++){const b=NB[a*6+d];if(b>=0&&!seen.has(b)){seen.add(b);nx.push(b);out.push(b)}}fr=nx}return out}
const cxOf=i=>{const c=i%W,r=(i/W)|0;return HW*(c+0.5*(r&1))+HW/2};
const cyOf=i=>S*1.5*((i/W)|0)+S;
function fmtLL(i){const c=i%W,r=(i/W)|0,la=latOf(r);let lo=lonOf(c,r);if(lo>180)lo-=360;return `${Math.abs(la).toFixed(0)}°${la>=0?'N':'S'} ${Math.abs(lo).toFixed(0)}°${lo>=0?'E':'W'}`}

function h2(x,y,s){let n=(x*374761393+y*668265263+s*982451653)|0;n=Math.imul(n^(n>>>13),1274126177);n=n^(n>>>16);return (n>>>0)/4294967295}
function vnoise(x,y,s){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);const a=h2(xi,yi,s),b=h2(xi+1,yi,s),c=h2(xi,yi+1,s),d=h2(xi+1,yi+1,s);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
const fbm=(x,y,s)=>vnoise(x,y,s)*0.6+vnoise(x*2.1,y*2.1,s+7)*0.3+vnoise(x*4.3,y*4.3,s+13)*0.1;

const TER=['Ocean','Plains','Forest','Hills','Mountains','Desert','Tundra','Ice','Rift','Glass Waste','Fungal Wilds','Bone Plains'];
const ROADC=[5,4,7,8,14,6,7,18,999,10,8,6];
const MC=[Infinity,1,2,2,3,2,2,3,Infinity,2,2,1.5];
const YIELD=[0,2,0.8,0.9,0.3,0.3,0.5,0,0,0,1.4,0.6];
const DEFM=[1,1,1.2,1.3,1.5,1,1,1,1,1,1.2,1];
const T=new Uint8Array(NT);
(function(){
  const inB=(lo,la,b)=>lo>=b[0]&&lo<=b[1]&&la>=b[2]&&la<=b[3];
  const MTN=[[5,15,44.5,47.8],[-1.5,3,42,43.5],[20,26.5,45.5,49],[39,49,41,44],[73,100,28,37],[70,90,40,44],[57,61,51,66],[-124,-106,35,58],[-76,-67,-45,6],[-73,-70,-55,-45]];
  const HILL=[[-9,9,30,36],[44,60,27,38],[35,42,4,15],[5,17,59,69],[-84,-75,35,45],[145,153,-38,-18],[28,44,37,40],[-110,-95,15,28],[-50,-40,-25,-12],[100,120,22,32],[-6,-2,55,59]];
  const DES=[[-16,33,16,31],[34,58,14,31],[52,66,26,36],[90,116,38,46],[76,92,37,42],[16,26,-28,-19],[116,143,-32,-19],[-117,-103,27,37],[-72,-68,-27,-17],[66,75,23,29],[50,70,38,46]];
  const JUNG=[[-76,-46,-14,5],[9,31,-6,5],[94,126,-9,21],[-92,-77,7,18]];
  for(let i=0;i<NT;i++){
    if(MASK[i]!=='1'){T[i]=0;continue}
    const c=i%W,r=(i/W)|0,la=latOf(r);let lo=lonOf(c,r);if(lo>180)lo-=360;
    const n=fbm(lo/14+50,la/14+50,3);
    let t=1;
    if((la>58&&lo>-60&&lo<-15)||la>73)t=7;
    else if(la<-50||la>62||(la>57&&(lo>40||lo<-50)))t=n>0.55?2:6;
    else if(MTN.some(b=>inB(lo,la,b)))t=n<0.25?3:4;
    else if(DES.some(b=>inB(lo,la,b)))t=n>0.72?3:5;
    else if(HILL.some(b=>inB(lo,la,b)))t=n>0.66?1:3;
    else if(JUNG.some(b=>inB(lo,la,b)))t=n<0.25?1:2;
    else t=n>0.58?2:n<0.22?3:1;
    T[i]=t;
  }
})();
/* ===== CONTINENTS & WATER ===== */
const CONTS=['North America','South America','Europe','Africa','Asia','Oceania','Antarctica'];
const CONT=new Int8Array(NT).fill(-1);
const COMP=new Int32Array(NT).fill(-1),COMPN=[];
(function(){
  for(let i=0;i<NT;i++){if(!T[i])continue;const la=latOf((i/W)|0);let lo=lonOf(i%W,(i/W)|0);if(lo>180)lo-=360;let c;
    if(la<-58)c=6;
    else if(lo<-25&&lo>-170)c=la>=10?0:1;
    else if((lo>=110&&la<-10)||(lo>=130&&la<0)||(lo>=160&&la<-30))c=5;
    else if(la<35.5&&lo>=-20&&lo<52&&!(lo>=34&&la>=12))c=3;
    else if(la>=36&&lo>=-25&&(lo<40||(la>=48&&lo<60))&&!(lo>=26&&la<41.5))c=2;
    else c=4;
    CONT[i]=c}
  for(let i=0;i<NT;i++){if(T[i]||COMP[i]>=0)continue;const id=COMPN.length;let n=0;const q=[i];COMP[i]=id;
    for(let h=0;h<q.length;h++){const c=q[h];n++;for(let k=0;k<6;k++){const b=NB[c*6+k];if(b>=0&&!T[b]&&COMP[b]<0){COMP[b]=id;q.push(b)}}}COMPN.push(n)}
})();
function contsOn(){const s=new Set();for(let i=0;i<NT;i++)if(CONT[i]>=0)s.add(CONT[i]);return [...s].sort()}
/* ===== FRACTURED EARTHS ===== */
let MODS=[];
const tt=(w,i)=>{const m=MODS[w];return m&&m[i]?m[i]:T[i]};
function genMods(){MODS=[];for(const w of G.worlds){if(!w.weird){MODS[w.id]=null;continue}
  const m=new Uint8Array(NT),s=(G.seed+w.id*977)&0xffff,k=w.weird,ps=new Set(w.portals.map(p=>p.i));
  for(let i=0;i<NT;i++){if(!T[i]||ps.has(i))continue;const la=latOf((i/W)|0),lo=lonOf(i%W,(i/W)|0);
    const n=fbm(lo/10+(s%97),la/10+(s%89),s),n2=fbm(lo/6+31,la/6+17,s+5);
    if(Math.abs(n-0.5)<0.014+0.008*k)m[i]=8;else if(n2>0.8-0.04*k)m[i]=9;else if(n2<0.2+0.04*k)m[i]=10;else if(n>0.72-0.03*k&&(T[i]===1||T[i]===5))m[i]=11}
  MODS[w.id]=m}}
const STORMS=['glass storm','aurora tempest','ash squall','rift-wind','black hail'];
function presence(w,o){o=o||ME;return G.hubs.some(h=>h.w===w&&h.o===o)||G.units.some(u=>u.w===w&&u.o===o)}
function strangeTurn(){
  for(const w of G.worlds){if(!w.weird)continue;
    if(w.storm>0)w.storm--;else if(rnd()<0.07*w.weird){w.storm=1+Math.floor(rnd()*2);w.stormName=pick(STORMS,rnd);for(const id of aliveIds())if(presence(w.id,id))logTo(id,`${/^[aeiou]/.test(w.stormName)?'An':'A'} ${w.stormName} sweeps ${w.name}. Marches slow and harvests fail while it lasts.`,'loss')}
    const active=G.hubs.some(h=>h.w===w.id)||G.units.some(u=>u.w===w.id&&u.o!=='M');if(!active)continue;
    const mons=G.units.filter(u=>u.o==='M'&&u.w===w.id);
    if(mons.length<1+w.weird&&rnd()<0.12*w.weird){let i=null;for(let t=0;t<200;t++){const c=Math.floor(rnd()*NT);if(!T[c]||[7,8].includes(tt(w.id,c)))continue;if(G.hubs.some(h=>h.w===w.id&&hdist(h.i,c)<5)||G.units.some(u=>u.w===w.id&&u.o!=='M'&&hdist(u.i,c)<4))continue;i=c;break}
      if(i!=null){const type=w.weird>=3&&rnd()<0.5?'horror':rnd()<0.5?'swarm':'beast';addUnit('M',type,w.id,i,UT[type].n)}}
    for(const u of mons){u.str=Math.min(100,u.str+4);let best=null,bd=9;
      for(const v of G.units)if(v.o!=='M'&&v.w===w.id){const d=hdist(u.i,v.i);if(d<bd){bd=d;best={w:w.id,i:v.i}}}
      for(const h of G.hubs)if(h.w===w.id){const d=hdist(u.i,h.i);if(d<bd){bd=d;best={w:w.id,i:h.i}}}
      if(best)u.dest=best;else if(!u.dest||rnd()<0.3){const c=around(u.i,4).filter(t=>T[t]&&tt(w.id,t)!==8);u.dest={w:w.id,i:c[Math.floor(rnd()*c.length)]}}}}
}
/* ===== FOG & EXPLORATION ===== */
let SEEN=[],FOGV=0;
function seenArr(w){return SEEN[w]||(SEEN[w]=new Uint8Array(NT))}
function isSeen(w,i){return w===RM.home||!!(SEEN[w]&&SEEN[w][i])}
function see(w,i,r){if(w===RM.home||RM.isAI)return;const a=seenArr(w);let nw=false;
  for(const t of around(i,r)){if(a[t])continue;a[t]=1;nw=true;const pt=portalTo(w,t);if(pt!=null&&G.log&&G.turn>0)log(`A portal was sighted ${T[t]?'':'beneath the sea '}at ${fmtLL(t)} on ${G.worlds[w].name}${G.disc[pt]?`, leading to ${G.worlds[pt].name}`:', leading somewhere uncharted'}.`,'world')}
  if(nw)FOGV++}
function packSeen_unused(){return SEEN.map(a=>{if(!a)return null;const b=new Uint8Array(Math.ceil(NT/8));for(let i=0;i<NT;i++)if(a[i])b[i>>3]|=1<<(i&7);let s='';for(const x of b)s+=String.fromCharCode(x);return btoa(s)})}
function unpackSeen_unused(arr){SEEN=[];(arr||[]).forEach((s,w)=>{if(!s)return;const bin=atob(s);const a=new Uint8Array(NT);for(let i=0;i<NT;i++)if(bin.charCodeAt(i>>3)&(1<<(i&7)))a[i]=1;SEEN[w]=a});FOGV++}
const LCOMP=new Int32Array(NT).fill(-1);
(function(){let id=0;for(let i=0;i<NT;i++){if(!T[i]||LCOMP[i]>=0)continue;const q=[i];LCOMP[i]=id;for(let h=0;h<q.length;h++){const c=q[h];for(let k=0;k<6;k++){const b=NB[c*6+k];if(b>=0&&T[b]&&LCOMP[b]<0){LCOMP[b]=id;q.push(b)}}}id++}})();
function exploreOrders(){
  for(const u of G.units){if(u.o!==ME||u.auto!=='explore')continue;
    if(u.dest&&(u.dest.w!==u.w||!isSeen(u.w,u.dest.i)))continue;
    const skip=new Set(u.skip||[]);const lc=LCOMP[u.i];let best=null,bd=Infinity;
    if(T[u.i])for(let i=0;i<NT;i++){if(!T[i]||LCOMP[i]!==lc||isSeen(u.w,i)||skip.has(i)||tt(u.w,i)===8)continue;const d=hdist(u.i,i);if(d<bd){bd=d;best=i}}
    if(best!=null){u.dest={w:u.w,i:best};u.status=`Exploring toward ${fmtLL(best)}.`;continue}
    let pp=null;bd=Infinity;for(const p of G.worlds[u.w].portals){if(!isSeen(u.w,p.i)||!T[p.i]||LCOMP[p.i]!==lc||homeOwner(p.to)&&homeOwner(p.to)!==ME&&G.disc[p.to])continue;if(G.disc[p.to]&&!hasUnseen(p.to,LCOMP[p.i]))continue;const d=hdist(u.i,p.i)+(G.disc[p.to]?30:0);if(d<bd){bd=d;pp=p}}
    if(pp){u.dest={w:pp.to,i:pp.i};u.status=`Heading through the portal at ${fmtLL(pp.i)}${G.disc[pp.to]?'':' into the unknown'}.`;continue}
    u.dest=null;u.status='Nothing left to explore that can be reached on foot.'}
}
function landNear(i){if(T[i]&&T[i]!==7)return i;for(const t of around(i,4))if(T[t]&&T[t]!==7)return t;return i}

/* ================= DEFINITIONS ================= */
const DEP={
  grain:{n:'Fertile Loam',g:'Gr',col:'#d9c35c',gold:0,food:3},
  timber:{n:'Old-Growth Timber',g:'Tb',col:'#6fa25d',gold:3,bonus:'Supply lines cost 15% less to lay'},
  iron:{n:'Iron Ore',g:'Fe',col:'#b98b74',gold:4,bonus:'Regiments cost 15% less to raise'},
  copper:{n:'Copper',g:'Cu',col:'#d08a4f',gold:3},
  coal:{n:'Coal Seam',g:'Co',col:'#8d8d8d',gold:3,bonus:'Rifle and mechanized regiments cost 15% less'},
  silver:{n:'Silver',g:'Ag',col:'#dfe3e6',gold:8},
  salt:{n:'Salt Pans',g:'Na',col:'#e8e0cf',gold:3},
  stone:{n:'Dressed Stone',g:'St',col:'#a8a291',gold:2,bonus:'Forts and depots defend 20% better'},
  horses:{n:'Wild Horses',g:'Hs',col:'#c4a06a',gold:2,bonus:'Cavalry costs 25% less'},
  aether:{strange:1,unk:'Weightless Ore',n:'Aetherite',g:'✦',col:'#8fdcff',reveal:'Shards of it fall upward. Shipwrights lash it beneath hulls to raise them into the sky.'},
  dragon:{strange:1,unk:'Great Nesting Grounds',n:'Dragon Roost',g:'✦',col:'#ff9a6b',reveal:'The nests are dragon roosts. Hatchlings raised from the egg will bear a rider.'},
  sending:{strange:1,unk:'Humming Twin-Crystals',n:'Sending Crystals',g:'✦',col:'#b6a4ff',reveal:'Paired crystals pass messages and small cargo instantly. Gate crossings stop costing your carters days.'},
  magitek:{strange:1,unk:'Rune-Veined Ore',n:'Magitek Ore',g:'✦',col:'#7ff0c8',reveal:'The veins hold a charge. Forged into plate and engines, it drives walking armor and haulage.'},
  xen:{strange:1,unk:'Pulsing Gray Growth',n:'Grafting Biomass',g:'✦',col:'#c7d36a',reveal:'The growth takes to living flesh. Grafted soldiers need little food and do not tire.'},
  ley:{strange:1,unk:'Welling Light',n:'Ley Spring',g:'✦',col:'#f0e48a',reveal:'A spring of raw ley-light. Trained adepts can draw on it in battle, and it feeds every study.'},
};
const STRANGE=['aether','dragon','sending','magitek','xen','ley'];
const UT={
  levy:{n:'Levy Spearmen',g:'SP',era:0,atk:2,def:3,cost:30,up:1,food:2,spd:4},
  maa:{n:'Men-at-Arms',g:'MA',era:0,atk:4,def:4,cost:55,up:2,food:2,spd:4},
  bow:{n:'Longbowmen',g:'LB',era:0,atk:4,def:2,cost:45,up:2,food:2,spd:4},
  kn:{n:'Knights',g:'KN',era:0,atk:6,def:3,cost:90,up:3,food:4,spd:6,cav:1},
  pike:{n:'Pike Square',g:'PK',era:1,atk:4,def:7,cost:60,up:2,food:2,spd:4},
  arq:{n:'Arquebusiers',g:'AQ',era:1,atk:7,def:3,cost:65,up:2,food:2,spd:4},
  reit:{n:'Reiters',g:'RT',era:1,atk:7,def:4,cost:95,up:3,food:4,spd:6,cav:1},
  line:{n:'Line Infantry',g:'LI',era:2,atk:8,def:7,cost:75,up:3,food:2,spd:5},
  drag:{n:'Dragoons',g:'DG',era:2,atk:8,def:5,cost:100,up:3,food:4,spd:7,cav:1},
  fart:{n:'Field Artillery',g:'FA',era:2,atk:12,def:2,cost:110,up:3,food:3,spd:3},
  rifle:{n:'Rifle Regiment',g:'RF',era:3,atk:11,def:10,cost:95,up:3,food:3,spd:5,coal:1},
  gun:{n:'Gun Battery',g:'GB',era:3,atk:16,def:3,cost:130,up:4,food:3,spd:3,coal:1},
  cavb:{n:'Cavalry Brigade',g:'CB',era:3,atk:10,def:6,cost:110,up:3,food:4,spd:7,cav:1},
  motor:{n:'Motor Rifles',g:'MR',era:4,atk:15,def:13,cost:140,up:5,food:3,spd:8,coal:1},
  tank:{n:'Tank Battalion',g:'TK',era:4,atk:22,def:13,cost:210,up:6,food:3,spd:9,coal:1},
  airship:{n:'Aetherite Airship',g:'AS',req:'aether',atk:8,def:6,cost:160,up:5,food:3,spd:10,fly:1},
  drake:{n:'Dragon Lances',g:'DL',req:'dragon',atk:16,def:8,cost:220,up:6,food:5,spd:12,fly:1},
  mtek:{n:'Magitek Armor',g:'MT',req:'magitek',atk:15,def:14,cost:200,up:5,food:2,spd:6},
  graft:{n:'Grafted Legion',g:'GL',req:'xen',atk:12,def:12,cost:150,up:2,food:1,spd:5},
  magi:{n:'Battle Magi',g:'BM',req:'ley',atk:13,def:5,cost:130,up:4,food:2,spd:4},
  scout:{n:'Explorers',g:'EX',era:0,atk:1,def:1,cost:25,up:1,food:1,spd:6,scout:1},
  beast:{n:'Rift Beasts',g:'RB',atk:7,def:6,cost:0,up:0,food:0,spd:3,mon:1,hidden:1},
  swarm:{n:'Glass Swarm',g:'GS',atk:5,def:3,cost:0,up:0,food:0,spd:5,mon:1,hidden:1},
  horror:{n:'Shardborn Horror',g:'SH',atk:13,def:11,cost:0,up:0,food:0,spd:2,mon:1,hidden:1},
  caravan:{n:'Caravan',g:'CV',atk:0,def:1,cost:0,up:0,food:0,spd:5,party:1,hidden:1},
  retinue:{n:'Noble Retinue',g:'NR',atk:3,def:3,cost:0,up:0,food:0,spd:5,party:1,hidden:1},
  exiles:{n:'Emigrant Column',g:'EM',atk:0,def:1,cost:0,up:0,food:0,spd:3,party:1,hidden:1},
  adventurers:{n:'Adventurers',g:'AD',atk:1,def:2,cost:0,up:0,food:0,spd:6,party:1,scout:1,hidden:1},
  traction:{n:'Traction City',g:'TC',atk:0,def:0,cost:0,up:0,food:0,spd:3,city:1,hidden:1},
};
const ERAS=['High Medieval','Pike & Shot','Line & Musket','Rifle & Rail','Mechanized'],ERA_Y=[1212,1470,1700,1855,1935];
const LOGI=['Ox Carts','Turnpikes & Wagons','Canals & Depots','Railways & Steamships','Motor Transport','Air Transport'],LOGI_Y=[1212,1663,1761,1830,1910,1935];
const AGRI=['Three-Field','Crop Rotation','Enclosure & Drainage','Mechanical Reapers','Fertilizers'],AGRI_Y=[1212,1730,1760,1834,1913];
const LOGI_TXT=['Armies walk; wagons crawl along your lines.','Lines move troops faster and cost less to lay.','Canals and depots raise haulage capacity.','Regiments ride the rails along your land lines and steam along sea lanes.','Motor columns: faster on and off your lines.','Airlift regiments between any two connected hubs.'];
const MILES=190;
const RATE=[1,1.5,2.5,5,8,12];            // construction work points per crew per quarter, by logistics level
const BW=[0,1,1.5,1.5,3,1.5,1.5,4,99,2,2,1.2];      // work points to lay one hex, by terrain
const PORTC=50,PORTW=3,SEAC=0.3,SAILW=0.25;          // harbor gold, harbor work, sea-route planning weight
const LINEC=[0.7,0.55,0.45,0.1,0.07,0.07];// march cost per hex along your own lines
const SEAMV=[0.2,0.2,0.18,0.07,0.06,0.06];// sailing cost per sea hex
const REACH=[8,12,18,45,80,120];          // haulage hexes before load doubles
const SEAF=[0.35,0.3,0.25,0.12,0.1,0.08]; // haulage weight of a sea hex between ports
const CAPL=[0,15,40,100,160,220];         // extra haulage capacity by logistics level
const crewsMax=()=>2+G.research.logi;
const tractionOK=()=>G.research.logi>=4||!!G.unlocked.magitek||!!G.unlocked.aether;
const pace=g=>0.25+0.9*Math.sqrt(Math.max(0,g));
const SEASONS=['Spring','Summer','Autumn','Winter'];
const STUDY_NEED={aether:90,dragon:110,sending:100,magitek:110,xen:90,ley:70};
const ROLES={colony:'Colony',granary:'Granary',prison:'Prison',proving:'Proving Ground',fortress:'Fortress March',reserve:'Reserve'};
const ROLE_TXT={colony:'No special rules.',granary:'Farms here yield 50% more food.',prison:'Penal Transport Companies can work deposits here. Lines cost 40% less and convicts arrive steadily, but towns pay half tax.',proving:'Weapons testing: each hub adds 3 study points and strange studies run 25% faster. No population growth.',fortress:'Your regiments here defend 20% better.',reserve:'Companies and emigrants will not work or settle here.'};
const HOUSES=['Corvel','Maudray','Sennet','Pellork','Ostrance','Vellaine','Hautbrac','Grisolm','Tavercy','Branmoor'];
const GROUPS=['Dissenters','Old Believers','Tenant Farmers','Weavers','Free Peasants','Brethren','Exiles','Drovers','Fenmen','Hill Clans'];
const REASONS={hunger:'With no land left to farm',famine:'Fleeing famine',enclosure:'Turned off their land by enclosure',faith:'After a quarrel over faith',succession:'Backing the losing side in a disputed inheritance',guild:'After the guilds closed ranks against them'};

/* ================= NAMES ================= */
const WA=['Cal','Ves','Tor','Hal','Ost','Bre','Sel','Dun','Ker','Vor','Lis','Quen','Ith','Gar','Tal','Wen','Rhy','Sav','Imb','Orv','Pel','Zar','Nev','Eld'];
const WB=['a','e','i','o','au','ei','y'];
const WC=['dine','mere','vessa','holm','grave','stead','ren','thas','lorn','vale','mark','dain','ra','nore','ssa','vant','lith','mour'];
const HA=['Ost','Hes','Bra','Kel','Mar','Vel','Tre','Gol','Ard','Fen','Sar','Pol','Cor','Lun','Ash','Wyn','Rav','Dov','Elm','Thorn','Mil','Brack','Sto','Har'];
const HC=['wyck','dray','ford','ham','brook','gate','mere','stow','ley','burn','holt','cross','by','well','marsh','reach','den','combe'];
const AA=['Qa','Zhu','Ren','Sa','Ko','Mei','Lo','Hua','Te','Yan','Ji','Shu'];
const AC=['ndar','lin','vesh','thar','kor','mun','sai','ren','dhu','wen'];
const MERC_A=['Ninth','Lantern','Grey','Salt','Broken','Iron','Weeping','Crooked','Last','Ember','Hollow','Tallow'];
const MERC_B=['Hand','Banner','Hounds','Ledger','Bell','Crows','Oath','Tithe','Mile','Chain','Wick','Spur'];
const pick=(a,r)=>a[Math.floor(r()*a.length)];
function ordn(n){const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])}
/* ================= REALMS ================= */
let ME='r0',RM=null;
const RKEYS=['gold','research','orgs','nobles','petitions','ships','unlocked','disc','capBonus','gateBonus','log','exps','lastEmig','rdBoost','secured','last','roles'];
const COLORS=['#d9ae55','#cf5a4e','#6fb3d9','#8fc37a','#d38fd0'];
const SEATS=[
  {realm:'Kingdom of Varenne',cap:[2.35,48.85],capName:'Varenne',towns:['Saint-Orme','Hesdray'],gate:[14,49.5],world:'Earth Varenna',demonym:'Varennois',style:0},
  {realm:'Ashen Concordance',cap:[108.9,34.3],capName:'Qandar',towns:['Meisai','Lovesh'],gate:[100.5,34.5],world:'Earth Auldmere',demonym:'Qandari',style:1},
  {realm:'Sultanate of Ammar',cap:[31.2,30.0],capName:'Ammarah',towns:['Siwad','Tellum'],gate:[40,32],world:'Earth Ammaris',demonym:'Ammari',style:2},
  {realm:'Free Cities of Tlaxa',cap:[-99.1,19.4],capName:'Tlaxa',towns:['Ocotlan','Ixmar'],gate:[-90,21],world:'Earth Tlaxcal',demonym:'Tlaxan',style:3},
  {realm:'Rajadom of Indravar',cap:[77.2,28.6],capName:'Indravar',towns:['Pratipur','Gaurisa'],gate:[86,26],world:'Earth Indrava',demonym:'Indravari',style:4},
];
const SEATCAPS=SEATS.map(s=>landNear(hexAt(s.cap[0],s.cap[1])));
const NAMESTY=[[HA,HC],[AA,AC],[['Sa','Ka','Ta','Ha','Ma','Za','Ra','Na','Ba','Qa'],['bir','ram','sur','dun','mar','zah','lim','kesh']],[['Te','Xo','Tla','Ix','Ca','Mi','Oco','Tza'],['tlan','pan','co','huac','tepec','mal','zin']],[['Pra','Vi','Ka','Ra','Su','Go','Ha','Ma'],['pur','nagar','garh','vati','ganj','kot','sar']]];
function setRealm(id){const r=G.realms[id];if(!r)return;ME=id;RM=r;KNOWN=r._known;SEEN=r._seen}
function withRealm(o,f){const p=ME;setRealm(o);try{return f()}finally{if(G.realms[p])setRealm(p)}}
function bindG(){for(const k of RKEYS)Object.defineProperty(G,k,{get(){return RM?RM[k]:undefined},set(v){RM[k]=v},enumerable:false,configurable:true});
  Object.defineProperty(G,'realm',{get(){return RM?RM.name:''},set(v){RM.name=v},enumerable:false,configurable:true})}
function hideRuntime(r,known,seen){Object.defineProperty(r,'_known',{value:known,writable:true,enumerable:false,configurable:true});Object.defineProperty(r,'_seen',{value:seen,writable:true,enumerable:false,configurable:true})}
const realmIds=()=>Object.keys(G.realms);
const aliveIds=()=>realmIds().filter(id=>G.realms[id].alive);
const homeOf=o=>G.realms[o]?G.realms[o].home:-1;
function homeOwner(w){for(const id in G.realms)if(G.realms[id].home===w)return id;return null}
const capOf=o=>G.realms[o]?G.realms[o].cap:null;
function roleOf(o,w){const r=G.realms[o];if(r&&r.roles&&r.roles[w])return r.roles[w];const h=homeOwner(w);return h===o?'home':h?'foreign':'colony'}
const isFoe=o=>o!==ME&&o!=='M'&&!!G.realms[o];
const rname=o=>o==='M'?'creatures':G.realms[o]?G.realms[o].name:'someone';
function isSeenBy(o,w,i){const r=G.realms[o];if(!r)return true;if(r.isAI)return true;return w===r.home||!!(r._seen&&r._seen[w]&&r._seen[w][i])}
function logTo(o,txt,kind){if(!G.realms[o])return;withRealm(o,()=>log(txt,kind))}
function packArr(a){if(!a)return null;const b=new Uint8Array(Math.ceil(NT/8));for(let i=0;i<NT;i++)if(a[i])b[i>>3]|=1<<(i&7);let s='';for(const x of b)s+=String.fromCharCode(x);return btoa(s)}
function unpackArr(s){if(!s)return undefined;const bin=atob(s);const a=new Uint8Array(NT);for(let i=0;i<NT;i++)if(bin.charCodeAt(i>>3)&(1<<(i&7)))a[i]=1;return a}
function newRealm(k,seat,human,name){const id='r'+k;const r={id,seat:k,name:name||seat.realm,color:COLORS[k],isAI:!human,alive:true,style:seat.style,demonym:seat.demonym,
  gold:260,research:{budget:12,alloc:{arms:30,logi:30,agri:20,arc:20},year:{arms:1212,logi:1212,agri:1212},rate:{arms:0.25,logi:0.25,agri:0.25},arcPool:0,era:0,logi:0,agri:0,studies:{}},
  orgs:[],nobles:[],petitions:[],ships:{},unlocked:{},disc:[],capBonus:0,gateBonus:0,log:[],exps:[],lastEmig:-6,rdBoost:{},secured:null,last:null,roles:{},
  aiS:human?null:{roads:0,lastDepot:0,tip:null,lastWorks:0,flavor:null}};
  hideRuntime(r,new Set(),[]);return r}

/* ================= STATE ================= */
let G=null, D=new Array(NT).fill(null), KNOWN=new Set();
function mb(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function rnd(){let a=G.rs=(G.rs+0x6D2B79F5)|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}

function genDeposits(seed){
  const r=mb(seed^0x9e3779);D=new Array(NT).fill(null);
  const tab={1:[['grain',5],['horses',2],['salt',1],['stone',1],['copper',1]],2:[['timber',6],['iron',1]],3:[['iron',3],['copper',2],['coal',2],['silver',1],['stone',2]],4:[['silver',2],['iron',2],['coal',1],['copper',1]],5:[['salt',3],['copper',1],['silver',1]],6:[['timber',2],['coal',1],['iron',1]]};
  for(let i=0;i<NT;i++){const t=T[i];if(!t||t===7)continue;if(r()<0.085){const L=tab[t];let tot=L.reduce((a,b)=>a+b[1],0),x=r()*tot;for(const [k,w] of L){x-=w;if(x<=0){D[i]=k;break}}}}
  const cnt={aether:3,dragon:2,sending:2,magitek:2,xen:2,ley:3};
  const ok={aether:[3,4],dragon:[3,4,6],sending:[1,3,5,6],magitek:[3,4],xen:[1,2,5],ley:[1,2,3,5,6]};
  for(const k of STRANGE){let n=0,tries=0;while(n<cnt[k]&&tries++<5000){const i=Math.floor(r()*NT);if(!ok[k].includes(T[i])||D[i]&&DEP[D[i]].strange||SEATCAPS.some(c=>hdist(i,c)<10))continue;D[i]=k;n++}}
}
function wName(r,used){for(;;){const n=pick(WA,r)+pick(WB,r)+pick(WC,r);if(!used.has(n)){used.add(n);return n}}}
function hubName(o){const r=rnd;const st=NAMESTY[(G.realms[o]&&G.realms[o].style)||0];for(let k=0;k<30;k++){const n=pick(st[0],r)+pick(st[1],r);if(!G.hubs.some(h=>h.name===n))return n}return 'Outpost '+G.nid}

function newGame(opts){
  opts=opts||{};const seats=opts.seats||[{human:true},{human:false}];const N=Math.max(1,Math.min(5,seats.length));
  const seed=opts.seed||((Date.now()%1e9)|0);
  G={v:6,mp:1,seed,rs:seed,turn:0,inf:{},hubs:[],units:[],projects:[],lanes:[],nid:1,realms:{},worlds:[],over:null};
  for(let k=0;k<N;k++)G.realms['r'+k]=newRealm(k,SEATS[k],seats[k].human!==false,seats[k].realm);
  bindG();setRealm('r0');
  genDeposits(seed);
  const r=mb(seed^0x51ed);const used=new Set(SEATS.map(s=>s.world.replace('Earth ','')));
  const worlds=G.worlds;
  function mk(name){const w={id:worlds.length,name:name||('Earth '+wName(r,used)),portals:[],soff:Math.floor(r()*4),hoff:Math.floor(r()*24),off:0,weird:0};worlds.push(w);return w.id}
  function link(a,b,i){worlds[a].portals.push({i,to:b});worlds[b].portals.push({i,to:a})}
  function pickTile(wd,seaOK){let i,tries=0;const sea=seaOK&&r()<0.22;
    const bad=i=>sea?(T[i]!==0||COMPN[COMP[i]]<400||!around(i,3).some(t=>T[t]&&T[t]!==7)):(!T[i]||T[i]===7||SEATCAPS.some(c=>hdist(c,i)<9));
    do{i=Math.floor(r()*NT);tries++}while(tries<4000&&(bad(i)||wd.portals.some(p=>hdist(p.i,i)<(tries<2500?24:12))));return i}
  // the crossroads, one long arm per realm (about fifteen Earths between any two homes), then branches
  const C=mk();const spine=new Set([C]);const homes=[],gates=[];
  for(let k=0;k<N;k++){const L=N===1?6:7+(r()<0.5?1:0);let prev=C;
    for(let d=1;d<L;d++){const w=mk();link(prev,w,pickTile(worlds[prev],d>1));spine.add(w);prev=w}
    const s=SEATS[k];const gate=landNear(hexAt(s.gate[0],s.gate[1]));const home=mk(s.world);link(prev,home,gate);spine.add(home);homes.push(home);gates.push(gate)}
  const MAXW=Math.min(110,worlds.length+N*6+12),free=w=>worlds[w].portals.length<3&&!homes.includes(w);
  const arms=Math.max(2,Math.ceil(N*0.6));const spineArr=[...spine].filter(w=>w!==C&&!homes.includes(w));
  for(let a=0;a<arms;a++){let pw=spineArr[Math.floor(r()*spineArr.length)];if(!free(pw))continue;const len=7+Math.floor(r()*4);
    for(let d=0;d<len&&worlds.length<MAXW+N*9;d++){const c=mk();link(pw,c,pickTile(worlds[pw],true));pw=c}}
  const pool=worlds.filter(w=>free(w.id)&&w.id!==C).map(w=>w.id);
  let guard=0;while(pool.length&&worlds.length<MAXW+N*9&&guard++<600){const k=Math.floor(r()*pool.length);const pw=pool[k];if(!free(pw)||r()<0.3){pool.splice(k,1);continue}
    const c=mk();link(pw,c,pickTile(worlds[pw],true));if(r()<0.55)pool.push(c)}
  {const q=[...spine];for(const w of worlds)w.off=spine.has(w.id)?0:99;
    for(let h=0;h<q.length;h++){const w=worlds[q[h]];for(const p of w.portals){const o=worlds[p.to];if(o.off>w.off+1){o.off=w.off+1;q.push(o.id)}}}
    for(const w of worlds)w.weird=Math.max(0,Math.min(4,w.off-5))}
  G.center=C;genMods();
  // each realm's homeland
  for(let k=0;k<N;k++){const id='r'+k;setRealm(id);const s=SEATS[k];const home=homes[k],gate=gates[k];
    RM.home=home;const capI=SEATCAPS[k];RM.cap={w:home,i:capI};RM.disc[home]=1;
    const arm=worlds[home].portals[0].to;RM.disc[arm]=1;
    // two towns a few hexes out, well apart
    const cands=around(capI,6).filter(t=>T[t]&&T[t]!==7&&hdist(t,capI)>=3&&hdist(t,gate)>=2);
    const score=t=>{let sc=0;for(const n of around(t,1))sc+=YIELD[T[n]];return sc};
    cands.sort((a,b)=>score(b)-score(a));const t1i=cands[0];const t2i=cands.filter(t=>hdist(t,t1i)>=4).sort((a,b)=>score(b)-score(a))[0]??cands[1];
    const lk=(i)=>{const pl=roadPlan(id,home,i,1);if(pl)for(const st of pl.steps)if(st.t==='hex')placeInfra(id,home,st.i)};
    const cap=foundHub(id,home,capI,{name:s.capName,pop:30,cap:1});for(const x of [t1i,t2i,gate])lk(x);
    const t1=foundHub(id,home,t1i,{name:s.towns[0],pop:9}),t2=foundHub(id,home,t2i,{name:s.towns[1],pop:7});
    const gh=foundHub(id,home,gate,{name:'The '+(['Gatehouse','Gate Fort','Portal Keep','Threshold','Gate Tower'][k]),pop:0.6,kind:'fort'});
    const short=s.capName;
    addUnit(id,'maa',home,capI,`1st ${short} Men-at-Arms`);addUnit(id,'levy',home,capI,`1st ${short} Spears`);addUnit(id,'bow',home,t1.i,`1st ${t1.name} Bows`);
    addUnit(id,'maa',home,gate,`${gh.name.replace('The ','')} Guard`);addUnit(id,'kn',home,gate,`1st ${short} Knights`);
    const hs=HOUSES.slice().sort(()=>r()-0.5);const seatsH=[cap,t1,t2,gh];
    seatsH.forEach((h,j)=>{const n={id:G.nid++,name:'House '+hs[j],seat:h.id,loyalty:50+Math.floor(r()*20),rival:null,feud:0,wealth:0};G.nobles.push(n);addUnit(id,j%2?'kn':'maa',home,h.i,'House '+hs[j]+' Household').guard=n.id});
    G.nobles[0].rival=G.nobles[1].id;G.nobles[1].rival=G.nobles[0].id;G.nobles[2].rival=G.nobles[3].id;G.nobles[3].rival=G.nobles[2].id;
    if(!RM.isAI){const hd=newHead();if(hd.traits.includes('bold'))hd.traits=['industrious','loyal'];G.orgs.push({id:G.nid++,name:'Royal Survey Corps',type:'survey',head:hd,traits:hd.traits,w:'any',cont:'any',fund:12,purse:30,status:'Mustering engineers at the gate.',works:0,standing:70,demand:null,toll:0,tollW:null,cut:{},defiant:false})}
    else RM.aiS.flavor=pick(['magitek','xen','aether'],r);
    for(const t of around(capI,7))if(D[t])KNOWN.add(t);
    see(arm,gate,2);
    if(!RM.isAI){const u=addUnit(id,'scout',home,gate,`${short} Pathfinders`);u.auto='explore'}
    log(`Spring 1212. The gate beside ${s.capName} stands open onto ${worlds[arm].name}, an empty copy of the world. Somewhere beyond the portals, other realms have found gates of their own. Your captains want orders.`,'info');
  }
  for(const id of realmIds()){setRealm(id);if(!RM.isAI)revealTurn()}
  setRealm('r0');
}

/* ================= HELPERS ================= */
const key=(w,i)=>w*NT+i;
function log(txt,kind){G.log.unshift({t:G.turn,txt,kind:kind||'info'});if(G.log.length>250)G.log.length=250}
function dateStr(t){t=t==null?G.turn:t;return SEASONS[t%4]+' '+(1212+Math.floor(t/4))}
function seasonAt(w,i){let s=(G.turn+(G.worlds[w].soff||0))%4;if(i!=null&&latOf((i/W)|0)<0)s=(s+2)%4;return s}
function hourStr(w,base){const h=((base==null?12:base)+(G.worlds[w].hoff||0))%24;return (h<10?'0':'')+h+':00'}
function winterAt(w,i){return seasonAt(w,i)===3&&Math.abs(latOf((i/W)|0))>35}
function portalTo(w,i){const p=G.worlds[w].portals.find(p=>p.i===i);return p?p.to:null}
function portalBetween(a,b){const p=G.worlds[a].portals.find(p=>p.to===b);return p?p.i:null}
function hubAt(w,i){return G.hubs.find(h=>h.w===w&&h.i===i)}
function tier(h){return h.pop<2?0:h.pop<10?1:h.pop<40?2:3}
const TIERN=['Depot','Town','City','Metropolis'];
function hubLabel(h){const t=TIERN[tier(h)];return h.kind==='fort'?'Fort':h.kind==='works'?'Works':h.kind==='civ'?'Free '+t.toLowerCase():h.kind==='company'?'Company '+t.toLowerCase():h.kind==='estate'?'Noble estate':t}
function enemyUnitAt(w,i,o){return G.units.some(v=>v.o!==o&&v.w===w&&v.i===i&&v.str>0)}
function allowed(o,w,t){const h=homeOwner(w);if(h){if(h!==o)return false;return hdist(t,G.realms[h].cap.i)<=7}return true}
function passable(o,w,t){if(!allowed(o,w,t))return false;const x=G.inf[key(w,t)];return !x||x===o}
function placeInfra(o,w,i){const k=key(w,i);if(G.inf[k]&&G.inf[k]!==o)return false;G.inf[k]=o;const to=portalTo(w,i);if(to!=null&&G.realms[o]&&(G.realms[o].isAI||G.realms[o].disc[to])&&!G.inf[key(to,i)])G.inf[key(to,i)]=o;return true}
function foundHub(o,w,i,opt){opt=opt||{};if(!opt.mobile)placeInfra(o,w,i);const h={id:G.nid++,o,w,i,name:opt.name||hubName(o),pop:opt.pop||0.6,cap:opt.cap?1:0,kind:opt.kind||'town',org:opt.org||null,raised:0,auto:['civ','company','estate'].includes(opt.kind),group:opt.group||null,noble:opt.noble||null,port:!!opt.port,mobile:!!opt.mobile,penal:!!opt.penal,dest:null};G.hubs.push(h);return h}
function addUnit(o,type,w,i,name,merc){const u={id:G.nid++,o,type,w,i,str:100,dest:null,name,merc:merc||null,sup:1};G.units.push(u);return u}
function heapPush(h,k,v){h.push([k,v]);let i=h.length-1;while(i>0){const p=(i-1)>>1;if(h[p][0]<=h[i][0])break;const t=h[p];h[p]=h[i];h[i]=t;i=p}}
function heapPop(h){const top=h[0],last=h.pop();if(h.length){h[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<h.length&&h[l][0]<h[m][0])m=l;if(r<h.length&&h[r][0]<h[m][0])m=r;if(m===i)break;const t=h[m];h[m]=h[i];h[i]=t;i=m}}return top}

function roadMul(o,w){const rr=G.realms[o];let m=1-0.07*lvOf(o);if(rr&&rr.secured&&rr.secured.has&&rr.secured.has('timber'))m*=0.85;if(roleOf(o,w)==='prison')m*=0.6;return m}
function isPort(o,w,i){const h=hubAt(w,i);return !!(h&&h.o===o&&h.port)}
function landOK(o,w,t){if(!T[t])return true;if(tt(w,t)===8)return false;if(!allowed(o,w,t))return false;const x=G.inf[key(w,t)];return !x||x===o}
// Cheapest construction route from your existing lines on world w to any target tile. Crosses water via harbors.
function roadPlan(o,w,targets,mul){
  const tset=typeof targets==='number'?new Set([targets]):targets;
  const dist=new Float64Array(NT).fill(Infinity),prev=new Int32Array(NT).fill(-1),h=[];
  const lo=w*NT,hi=lo+NT;
  for(const k in G.inf){if(G.inf[k]!==o)continue;const kk=+k;if(kk<lo||kk>=hi)continue;const t=kk-lo;if(!T[t])continue;dist[t]=0;heapPush(h,0,t)}
  if(!h.length)return null;
  let goal=-1;
  while(h.length){const [d,cur]=heapPop(h);if(d>dist[cur])continue;if(tset.has(cur)&&T[cur]){goal=cur;break}
    for(let q=0;q<6;q++){const nb=NB[cur*6+q];if(nb<0||!landOK(o,w,nb))continue;let ec;
      if(!T[nb]){if(T[cur]){if(o===ME&&!(isPort(o,w,cur)&&shipsEff(o,w)>0))continue;ec=isPort(o,w,cur)?SEAC:PORTC+SEAC}else ec=SEAC}
      else{const lay=G.inf[lo+nb]===o?0:ROADC[tt(w,nb)]*mul;ec=T[cur]?lay:PORTC+lay}
      const nd=d+ec;if(nd<dist[nb]){dist[nb]=nd;prev[nb]=cur;heapPush(h,nd,nb)}}}
  if(goal<0)return null;
  const path=[];let c=goal;while(c!==-1){path.push(c);c=prev[c]}path.reverse();
  const steps=makeSteps(o,w,path);let cost=0,work=0;
  for(const s of steps){if(s.t==='hex'){cost+=Math.round(ROADC[tt(w,s.i)]*mul);work+=BW[tt(w,s.i)]}else if(s.t==='port'){cost+=PORTC;work+=PORTW}else work+=sailW(s)}
  return {w,path,steps,cost,work,goal,mul};
}
function sailW(s){return 0}
function makeSteps(o,w,path){const st=[];
  for(let k=1;k<path.length;k++){const a=path[k-1],b=path[k];
    if(T[b]){if(!T[a])st.push({t:'port',i:b});else if(G.inf[key(w,b)]!==o)st.push({t:'hex',i:b})}
    else if(T[a]){if(!isPort(o,w,a))st.push({t:'port',i:a});let m=k;while(m<path.length&&!T[path[m]])m++;st.push({t:'sail',tiles:path.slice(k-1,m+1)})}}
  return st}
function fundsOf(p){const rr=G.realms[p.o];if(!rr)return 0;return p.by?((rr.orgs.find(x=>x.id===p.by)||{}).purse||0):rr.gold}
function payFor(p,c){const rr=G.realms[p.o];if(!rr)return;if(p.by){const org=rr.orgs.find(x=>x.id===p.by);if(org)org.purse-=c}else rr.gold-=c}
function addProject(o,plan,opt){opt=opt||{};const p={id:G.nid++,o,w:plan.w,path:plan.path,steps:plan.steps,k:0,prog:0,mul:plan.mul,crews:opt.crews||1,by:opt.by||null,done:opt.done||null,name:opt.name||('Line to '+fmtLL(plan.goal)),goal:plan.goal,stall:false,rateMul:opt.rateMul||1};G.projects.push(p);return p}
function projRate(p){return RATE[lvOf(p.o)]*p.crews*p.rateMul}
function projLeft(p){let w=0,c=0;for(let k=p.k;k<p.steps.length;k++){const s=p.steps[k];if(s.t==='hex'){w+=BW[tt(p.w,s.i)];c+=Math.round(ROADC[tt(p.w,s.i)]*p.mul)}else if(s.t==='port'){w+=PORTW;c+=PORTC}else w+=sailW(s)}return {work:Math.max(0,w-p.prog),cost:c}}
function crownCrews(){return G.projects.filter(p=>p.o===ME&&!p.by).reduce((s,p)=>s+p.crews,0)}
function runProject(p){
  const rate=projRate(p);p.prog+=rate;p.stall=false;p.blocked=false;let laid=0;
  while(p.k<p.steps.length){const s=p.steps[p.k];
    if(s.t==='sail'){if(p.o===ME&&!(shipsEff(ME,p.w)>0)){p.stall='ships';break}if(p.prog<sailW(s))break;p.prog-=sailW(s);if(!G.lanes.some(l=>l.o===p.o&&l.w===p.w&&l.tiles[0]===s.tiles[0]&&l.tiles[l.tiles.length-1]===s.tiles[s.tiles.length-1]))G.lanes.push({o:p.o,w:p.w,tiles:s.tiles});p.k++;continue}
    const sw=s.w??p.w;const own=G.inf[key(sw,s.i)];
    if(s.t==='hex'&&own===p.o){p.k++;continue}
    if(own&&own!==p.o||hubAt(sw,s.i)&&hubAt(sw,s.i).o!==p.o){p.blocked=true;break}
    const need=s.t==='hex'?BW[tt(sw,s.i)]:PORTW,cost=s.t==='hex'?Math.round(ROADC[tt(sw,s.i)]*p.mul):PORTC;
    if(p.prog<need)break;
    if(fundsOf(p)<cost){p.stall='gold';break}
    payFor(p,cost);p.prog-=need;p.k++;
    if(sw!==p.w&&p.o===ME&&!G.disc[sw])discoverWorld(sw,'Ships sailed through the portal in the sea.');
    placeInfra(p.o,sw,s.i);laid++;if(sw===p.w)p.last=s.i;
    if(s.t==='port'){let h=hubAt(sw,s.i);if(!h)h=foundHub(p.o,sw,s.i,{pop:0.6,name:hubName(p.o)+' Harbor'});h.port=true;if(p.o===ME)log(`Harbor completed at ${h.name}, ${G.worlds[sw].name}. With ships assigned to that Earth it links by sea to every harbor on the same water${G.worlds[sw].portals.some(x=>!T[x.i])?', and through any portal in that sea':''}.`,'grow')}
    const to=portalTo(sw,s.i);if(to!=null&&p.o===ME&&!G.disc[to])discoverWorld(to,`Crews building the line reached the portal at ${fmtLL(s.i)}.`);
  }
  {const s=p.steps[p.k];const need=!s?0:s.t==='sail'?sailW(s):s.t==='port'?PORTW:BW[tt(p.w,s.i)];p.prog=Math.min(p.prog,Math.max(rate*2,need))}
  {const rr=G.realms[p.o];if(rr&&rr.aiS)rr.aiS.roads+=laid}
  if(p.k>=p.steps.length){G.projects=G.projects.filter(x=>x!==p);finishProject(p)}
}
function finishProject(p){const d=p.done;
  if(d&&d.t==='works'){const org=G.orgs.find(x=>x.id===d.org);if(!org)return;const c=Math.min(30,org.purse);org.purse-=c;
    const end=p.path[p.path.length-1];if(G.hubs.some(h=>h.w===p.w&&hdist(h.i,end)<=1&&!h.port)){return}
    const h=foundHub(ME,p.w,end,{kind:'works',pop:0.6*(org.traits.includes('ambitious')?2:1),org:org.id,penal:org.type==='penal'});org.works++;
    log(`${org.name} opened ${h.name} on the ${depName(D[d.dep])} near ${fmtLL(d.dep)}, ${G.worlds[p.w].name}.`,'org');return}
  if(d&&d.t==='harbor')return;
  if(p.o===ME&&!p.by){const end=p.path[p.path.length-1];let msg=`${p.name} on ${G.worlds[p.w].name} is complete.`;
    if(!G.hubs.some(h=>h.w===p.w&&hdist(h.i,end)<=1)){const h=foundHub(ME,p.w,end,{pop:0.6});msg+=` A depot, ${h.name}, now stands at its end.`}
    log(msg,'grow')}
}
function worldRoute(a,b,o){if(a===b)return [a];const prev=new Map([[a,-1]]),q=[a];while(q.length){const w=q.shift();for(const p of G.worlds[w].portals){if(prev.has(p.to))continue;if(o&&G.realms[o]&&!G.realms[o].isAI&&!isSeenBy(o,w,p.i))continue;prev.set(p.to,w);if(p.to===b){const out=[b];let c=w;while(c!==-1){out.push(c);c=prev.get(c)}return out.reverse()}q.push(p.to)}}return null}
function travelEst(w1,i1,w2,i2,o){if(w1===w2)return hdist(i1,i2);const rt=worldRoute(w1,w2,o);if(!rt)return Infinity;let s=0,cur=i1;for(let k=0;k<rt.length-1;k++){const p=portalBetween(rt[k],rt[k+1]);s+=hdist(cur,p)+2;cur=p}return s+hdist(cur,i2)}

/* ================= NETWORK & ECONOMY ================= */
const SEAD=new Map();
function seaFrom(i){if(SEAD.has(i))return SEAD.get(i);const d=new Int16Array(NT).fill(-1),q=[];for(let k=0;k<6;k++){const n=NB[i*6+k];if(n>=0&&!T[n]&&d[n]<0){d[n]=1;q.push(n)}}
  for(let h=0;h<q.length;h++){const c=q[h];for(let k=0;k<6;k++){const n=NB[c*6+k];if(n>=0&&!T[n]&&d[n]<0){d[n]=d[c]+1;q.push(n)}}}SEAD.set(i,d);return d}
function seaDist(a,b){const d=seaFrom(a);let m=Infinity;for(let k=0;k<6;k++){const n=NB[b*6+k];if(n>=0&&!T[n]&&d[n]>0)m=Math.min(m,d[n])}return m}
function pfOf(o){if(o===ME)return (G.unlocked.sending&&G.secured&&G.secured.has('sending'))?1:Math.max(3,10-Math.floor(G.gateBonus));return 10}
function network(o){
  const cap=G.hubs.find(h=>h.o===o&&h.cap);const dist=new Map();if(!cap)return dist;
  const lv=lvOf(o);const ports={};const sfw=w=>{const e=shipsEff(o,w);return e>0?SEAF[lv]*SEAF_SHIP(e):Infinity};const wp={};for(const w of G.worlds)for(const p of w.portals)if(!T[p.i])(wp[w.id]=wp[w.id]||[]).push(p);for(const h of G.hubs)if(h.o===o&&h.port&&G.inf[key(h.w,h.i)]===o)(ports[h.w]=ports[h.w]||[]).push(h.i);
  const pf=pfOf(o),h=[];const s=key(cap.w,cap.i);dist.set(s,0);heapPush(h,0,s);
  const relax=(k2,nd)=>{if(nd<(dist.has(k2)?dist.get(k2):Infinity)){dist.set(k2,nd);heapPush(h,nd,k2)}};
  while(h.length){const [d,k]=heapPop(h);if(d>dist.get(k))continue;const w=Math.floor(k/NT),i=k-w*NT;
    if(T[i])for(let q=0;q<6;q++){const nb=NB[i*6+q];if(nb<0)continue;const k2=w*NT+nb;if(G.inf[k2]!==o)continue;relax(k2,d+1)}
    if(T[i]){const to=portalTo(w,i);if(to!=null){const k2=to*NT+i;if(G.inf[k2]===o)relax(k2,d+pf)}}
    const sf=sfw(w);
    if(T[i]&&sf<Infinity&&ports[w]&&ports[w].includes(i)){for(const j of ports[w]){if(j===i)continue;const sd=seaDist(i,j);if(sd<Infinity)relax(w*NT+j,d+sd*sf)}
      for(const p of (wp[w]||[])){if(!G.disc[p.to]&&o===ME)continue;const sd=seaFrom(i)[p.i];if(sd>0)relax(w*NT+p.i,d+sd*sf)}}
    if(!T[i]){const to2=portalTo(w,i);if(to2!=null){const k2=to2*NT+i;relax(k2,d+pf)}
      if(sf<Infinity&&ports[w])for(const j of ports[w]){const sd=seaDist(i,j);if(sd<Infinity)relax(w*NT+j,d+sd*sf)}}}
  return dist;
}
function shipsEff(o,w){const rr=G.realms[o];if(!rr)return 0;if(rr.isAI)return 3;let e=rr.ships[w]||0;for(const p of G.worlds[w].portals)if(!T[p.i])e+=0.5*(rr.ships[p.to]||0);return e}
function portalLinked(o,w,nx){const p=portalBetween(w,nx);if(p==null)return false;if(T[p])return G.inf[key(nx,p)]===o;
  const c=COMP[p];return G.hubs.some(h=>h.o===o&&h.w===nx&&h.port&&around(h.i,1).some(t=>!T[t]&&COMP[t]===c))}
function coastOf(o,w,c){const s=new Set();for(let i=0;i<NT;i++){if(!T[i]||T[i]===7||!landOK(o,w,i))continue;for(let k=0;k<6;k++){const n=NB[i*6+k];if(n>=0&&!T[n]&&COMP[n]===c){s.add(i);break}}}return s}
function planToPortal(o,w,p,mul){if(T[p])return roadPlan(o,w,p,mul);
  const to=portalTo(w,p),c=COMP[p];const pl=roadPlan(o,w,coastOf(o,w,c),mul);if(!pl)return null;
  const last=pl.steps[pl.steps.length-1];
  if(!isPort(o,w,pl.goal)&&!(last&&last.t==='port'&&last.i===pl.goal)){pl.steps.push({t:'port',i:pl.goal});pl.cost+=PORTC;pl.work+=PORTW}
  if(!portalLinked(o,w,to)){let best=null,bd=Infinity;for(const i of coastOf(o,to,c)){const d=seaDist(p,i);if(d<bd){bd=d;best=i}}
    if(best!=null){pl.steps.push({t:'sail',tiles:[pl.goal,p]});pl.steps.push({t:'port',i:best,w:to});pl.cost+=PORTC;pl.work+=PORTW}}
  return pl}
function crad(h){return h.mobile?2:h.pop<3?1:h.pop<10?2:h.pop<30?3:h.pop<80?4:5}
function hubFood(h,o){
  let raw=0;const role=roleOf(h.o,h.w);
  for(const t of around(h.i,crad(h))){raw+=YIELD[tt(h.w,t)];if(D[t]==='grain')raw+=DEP.grain.food}
  const agri=G.realms[o]?G.realms[o].research.agri:0;
  raw*=(1+0.15*agri)*(h.w===homeOf(h.o)?1.6:1)*(role==='granary'?1.5:1)*(winterAt(h.w,h.i)?0.75:1)*(G.worlds[h.w].storm?0.7:1);
  if(h.kind==='works')raw*=0.4;
  return {raw,prod:Math.min(raw,1+h.pop*1.5)};
}
function econ(o){if(!G.realms[o])return null;return withRealm(o,()=>econIn(o))}
function econIn(o){
  const net=network(o);const lv=lvOf(o);const reach=REACH[lv],pf=pfOf(o);
  const R={net,reach,pf,hubs:[],tax:0,dep:0,orgShare:{},upkeep:0,surplus:0,demand:0,load:0,cap:0,secured:new Set(),secTiles:[],units:new Map(),arc:0,civTax:0};
  const counted=new Set();let cap=40+CAPL[lv]+(o===ME?Math.floor(G.capBonus)+4*Object.values(G.ships||{}).reduce((a,b)=>a+b,0):10);
  const harvest=(h,mult)=>{for(const t of around(h.i,crad(h))){const ck=key(h.w,t);if(!D[t]||counted.has(ck))continue;counted.add(ck);const dd=DEP[D[t]];R.secured.add(D[t]);
      if(dd.strange){R.secTiles.push({w:h.w,i:t,k:D[t]});if(D[t]==='ley'&&o===ME)R.arc+=6;continue}
      if(!dd.gold)continue;const g=dd.gold*mult;
      if(h.org){const org=G.orgs.find(x=>x.id===h.org);if(org){let keep=org.traits.includes('greedy')?0.7:org.traits.includes('loyal')?0.2:org.type==='penal'?0.2:0.4;keep=Math.min(0.95,keep+(org.cut&&org.cut[h.w]||0));R.orgShare[org.id]=(R.orgShare[org.id]||0)+g*keep;R.dep+=g*(1-keep);continue}}
      R.dep+=g}};
  const mobiles=[];
  for(const h of G.hubs){if(h.o!==o)continue;const k=key(h.w,h.i);const conn=!h.mobile&&net.has(k);const d=conn?net.get(k):0;const f=hubFood(h,o);
    const hi={h,conn,d,prod:f.prod,raw:f.raw,def:Math.max(0,h.pop-f.prod),sur:Math.max(0,f.prod-h.pop)};R.hubs.push(hi);
    const role=roleOf(o,h.w);
    if(h.mobile){mobiles.push(h);R.tax+=h.pop*0.4;harvest(h,1.5);continue}
    if(h.auto){if(h.kind==='civ')R.civTax+=h.pop*0.15;else if(h.kind==='estate')R.civTax+=h.pop*0.1;
      if(conn){cap+=tier(h)*8;R.surplus+=hi.sur*0.5}continue}
    if(!conn)continue;
    R.tax+=h.pop*(h.cap?0.4:0.3)*(role==='prison'?0.5:1);
    cap+=tier(h)*8+(h.kind==='fort'?10:0)+(h.port?10:0);
    if(role==='proving'&&o===ME)R.arc+=3;
    if(o===ME&&G.worlds[h.w].weird)R.arc+=2*G.worlds[h.w].weird;
    harvest(h,1);
    R.surplus+=hi.sur;if(hi.def>0){R.demand+=hi.def;R.load+=hi.def*(1+d/reach)}
  }
  if(o===ME){if(G.unlocked.sending&&R.secured.has('sending'))cap+=40;if(G.unlocked.magitek&&R.secured.has('magitek'))cap+=30}
  R.cap=cap;
  const mine=G.units.filter(u=>u.o===o);
  const supD=u=>{let best=Infinity;for(const t of around(u.i,1)){const k=key(u.w,t);if(net.has(k))best=Math.min(best,net.get(k))}return best};
  const ships=[];
  for(const u of mine){const ut=UT[u.type];if(!u.guard&&!u.co&&!u.party&&!u.corps)R.upkeep+=ut.up;if(u.merc||u.guard||u.co||ut.scout||u.party){R.units.set(u.id,{sup:true,d:0,merc:true});continue}
    if(!T[u.i]&&!ut.fly){R.units.set(u.id,{sup:true,d:0,merc:true,sea:true});continue}
    const d=supD(u);if(d<Infinity){R.units.set(u.id,{sup:true,d});if(u.type==='airship')ships.push({u,d})}
    else if(mobiles.some(h=>h.w===u.w&&hdist(h.i,u.i)<=2))R.units.set(u.id,{sup:true,d:0,merc:true,city:true});
    else R.units.set(u.id,{sup:false,d:Infinity})}
  for(const u of mine){const s=R.units.get(u.id);if(s.sup)continue;for(const sh of ships)if(sh.u.w===u.w&&hdist(sh.u.i,u.i)<=3){s.sup=true;s.d=sh.d+3;break}}
  for(const u of mine){const s=R.units.get(u.id);if(!s.sup||s.merc)continue;const fd=UT[u.type].food;R.demand+=fd;R.load+=fd*(1+s.d/reach)}
  R.foodR=R.demand>0?Math.min(1,R.surplus/R.demand):1;R.capR=R.load>0?Math.min(1,R.cap/R.load):1;R.sup=Math.min(R.foodR,R.capR);
  R.tax+=R.civTax;R.income=R.tax+R.dep;
  return R;
}

/* ================= COSTS ================= */
function unitCost(type,o){const ut=UT[type];let c=ut.cost;const rr=G.realms[o];const sec=rr&&rr.secured&&rr.secured.has?rr.secured:new Set();if(sec.has('iron'))c*=0.85;if(ut.cav&&sec.has('horses'))c*=0.75;if(ut.coal&&sec.has('coal'))c*=0.85;return Math.round(c)}
function availUnits(o){const rr=G.realms[o];const era=rr.research.era;const unl=rr.unlocked;return Object.keys(UT).filter(k=>{const u=UT[k];if(u.scout&&!u.party)return true;if(u.hidden||u.mon)return false;if(u.req)return !!unl[u.req];return u.era<=era&&u.era>=era-1})}
function bestInf(o){const era=G.realms[o].research.era;return ['maa','pike','line','rifle','motor'][era]}
function raiseUnit(h,type){const c=unitCost(type,ME);if(G.gold<c)return 'Not enough gold.';G.gold-=c;h.raised=(h.raised||0)+1;const u=addUnit(ME,type,h.w,h.i,`${ordn(h.raised)} ${h.name} ${UT[type].n.split(' ').slice(-1)[0]}`);log(`${u.name} mustered at ${h.name}.`,'mil');return null}
function mercCost(h){return Math.round((110+G.research.era*30)*(h&&h.kind==='company'?0.7:1))}
function hireMerc(h){const c=mercCost(h);if(G.gold<c)return 'Not enough gold.';G.gold-=c;spawnMerc(h);return null}
function spawnMerc(h){const r=rnd;const nm=`The ${pick(MERC_A,r)} ${pick(MERC_B,r)}`;const u=addUnit(ME,bestInf(ME),h.w,h.i,nm,{turns:10});log(`${nm}, a free company, signed a ten-quarter contract at ${h.name}. They feed themselves and pick their own fights.`,'mil');return u}

/* ================= DISCOVERY ================= */
function discoverWorld(w,how){if(G.disc[w])return;G.disc[w]=1;
  for(const p of G.worlds[w].portals){if(G.inf[key(p.to,p.i)]===ME&&!G.inf[key(w,p.i)])G.inf[key(w,p.i)]=ME}
  const n=G.worlds[w].portals.length;
  log(`${how} ${G.worlds[w].name} catalogued: ${homeOwner(w)&&homeOwner(w)!==ME?'an Earth':'an empty Earth'} with ${n} portal${n>1?'s':''}${homeOwner(w)&&homeOwner(w)!==ME?'. It is inhabited. Banners of the '+rname(homeOwner(w))+' fly over its cities.':n===1?', a dead end':''}.`,'world');}
function reveal(i,r){let n=0;for(const t of around(i,r))if(D[t]&&!KNOWN.has(t)){KNOWN.add(t);n++}return n}
function revealTurn(){let found=[];for(const u of G.units)if(u.o===ME){see(u.w,u.i,UT[u.type].scout?3:2);for(const p of G.worlds[u.w].portals)if(hdist(p.i,u.i)<=(UT[u.type].scout?9:6))see(u.w,p.i,0);for(const t of around(u.i,2))if(D[t]&&!KNOWN.has(t)){KNOWN.add(t);if(DEP[D[t]].strange)found.push({t,w:u.w})}}
  for(const h of G.hubs)if(h.o===ME){reveal(h.i,crad(h)+1);see(h.w,h.i,crad(h)+1)}
  for(const f of found)log(`Scouts on ${G.worlds[f.w].name} report ${depName(D[f.t])} at ${fmtLL(f.t)}. It will be in the same place on every Earth.`,'strange');}
function depName(k){const d=DEP[k];if(d.strange&&!G.unlocked[k])return d.unk;return d.n}

/* ================= ORGS ================= */
const COTYPES={
  trade:{n:'Chartered Trading Company',b:'An East India-style company. Assign it an Earth, a continent and a resource (or every resource). It lays its own lines to known deposits, opens works, raises its own troops to patrol them, and keeps a share of the profits.'},
  survey:{n:'Military Survey Corps',b:'Army engineers who lay supply lines from your network to every portal they can reach, including harbors for portals that lie at sea. Funding buys more work crews.'},
  ship:{n:'Shipwrights’ Company',b:'Builds and crews merchant ships for one Earth. Sea routes cost nothing to lay but carry nothing without ships; more ships mean cheaper, larger sea haulage.'},
  rnd:{n:'Research & Development Institute',b:'Spends its funding on one field of research. Half again as effective if you keep a Proving Ground.'},
  penal:{n:'Penal Transport Company',b:'Ships convicts to a Prison world and works its deposits with chain gangs. It guards its camps with its own troops.'},
  merc:{n:'Free Company Brokers',b:'Sign on free companies that fight on their own account and may found company towns.'},
};
const TRAITS={
  frugal:{n:'Frugal',d:'lays lines 20% cheaper'},
  industrious:{n:'Industrious',d:'works 50% faster'},
  greedy:{n:'Greedy',d:'keeps 70% of profits and presses for tolls'},
  loyal:{n:'Loyal',d:'keeps only 20% of profits and rarely makes demands'},
  ambitious:{n:'Ambitious',d:'new works start twice as large'},
  bold:{n:'Bold',d:'presses demands hard and may defy the crown'},
  cautious:{n:'Cautious',d:'avoids Earths where the enemy operates'},
  martial:{n:'Martial',d:'raises more company troops'},
};
const CLASH=[['greedy','loyal'],['bold','cautious']];
const RD_FIELDS={arms:'Arms & doctrine',logi:'Logistics & transport',agri:'Agriculture',arc:'Strange studies'};
const FIRST=['Aldous','Benedikt','Cornelius','Dorothea','Emeric','Fenella','Gideon','Hester','Isolde','Jasper','Leopold','Mathilde','Octavia','Percival','Rosamund','Silas','Theodora','Ulric','Wilhelmina','Ambrose','Clement','Ottilie','Barnaby','Cressida','Lavinia','Tobias','Agnes','Lucan','Ysolde','Margery','Osric','Philippa','Radulf','Sabine','Thaddeus','Ermengarde'];
const LAST=['Vane','Ashcombe','Thorncastle','Morrow','Pellingham','Duquesne','Haverford','Sallow','Brightwater','Kestering','Marlowe','Quillfeather','Ravensworth','Stroud','Tallis','Underhill','Wexley','Coldharbour','Fennimore','Hawtrey','Lisle','Barrowcliffe','Ormsby','Gaskell','Penrose','Verity','Dunstable','Aske'];
const SEAF_SHIP=eff=>1+2/Math.max(0.5,eff);
function rollTraits(keep){const pool=Object.keys(TRAITS);const out=keep?[keep]:[];let g=0;
  while(out.length<2&&g++<50){const t=pool[Math.floor(rnd()*pool.length)];if(out.includes(t)||CLASH.some(c=>c.includes(t)&&c.some(x=>x!==t&&out.includes(x))))continue;out.push(t)}return out}
function newHead(keep){return {name:pick(FIRST,rnd)+' '+pick(LAST,rnd),age:34+Math.floor(rnd()*22),traits:rollTraits(keep)}}
function orgProj(org){return G.projects.find(p=>p.by===org.id)}
function hasUnseen(w,lc){if(w===RM.home)return false;const a=SEEN[w];for(let i=0;i<NT;i++)if(T[i]&&LCOMP[i]===lc&&!(a&&a[i])&&tt(w,i)!==8)return true;return false}
function hasLines(w){const lo=w*NT;for(const k in G.inf)if(G.inf[k]===ME&&+k>=lo&&+k<lo+NT&&T[+k-lo])return true;return false}
function projStatus(p){const L=projLeft(p);const q=Math.ceil(L.work/Math.max(0.01,projRate(p)));return p.blocked?'Blocked by enemy lines.':p.stall==='ships'?'Waiting for ships: commission ships at a harbor on this Earth.':p.stall?`Waiting for funds (${L.cost} gold still needed).`:`${p.steps.length-p.k} steps left, about ${q} quarter${q===1?'':'s'}.`}
const COMMON=['grain','iron','copper','coal','silver','salt','stone','timber','horses'];
function orgTypes(org){if(org.type==='penal')return ['iron','copper','coal','silver','salt','stone','timber'];if(org.res==='all')return COMMON.concat(STRANGE);return [org.res]}
function startWorks(org,w,types){
  const cands=new Map();const cont=org.cont==null||org.cont==='any'?null:+org.cont;
  for(const t of KNOWN){if(!types.includes(D[t])||!allowed(ME,w,t))continue;if(cont!=null&&CONT[t]!==cont)continue;if(G.inf[key(w,t)]&&G.inf[key(w,t)]!==ME)continue;
    if(G.hubs.some(h=>h.w===w&&!h.port&&hdist(h.i,t)<=crad(h)))continue;
    if(G.projects.some(p=>p.done&&p.done.dep===t&&p.w===w))continue;
    for(const n of around(t,1))if(T[n]&&![7,8].includes(tt(w,n))&&allowed(ME,w,n)&&!cands.has(n))cands.set(n,t)}
  if(!cands.size)return null;
  const mul=roadMul(ME,w)*(org.traits.includes('frugal')?0.8:1);
  const pl=roadPlan(ME,w,new Set(cands.keys()),mul);if(!pl)return null;
  const dep=cands.get(pl.goal);
  return addProject(ME,pl,{by:org.id,done:{t:'works',org:org.id,dep},name:`${org.name}: ${depName(D[dep])} at ${fmtLL(dep)}`,rateMul:(org.traits.includes('industrious')?1.5:1)*(org.type==='penal'?1.3:1),crews:1});
}
// ---- dominance & competition ----
function transit(w){let n=0;for(const p of G.worlds[w].portals)if(portalLinked(ME,w,p.to)||portalLinked(ME,p.to,w))n++;return n>=2}
function worksOn(w){const m={};for(const h of G.hubs)if(h.o===ME&&h.w===w&&h.org&&h.kind==='works')m[h.org]=(m[h.org]||0)+1;return m}
function dominates(org,w){const m=worksOn(w);const mine=m[org.id]||0;if(mine<3)return false;const tot=Object.values(m).reduce((a,b)=>a+b,0);return mine/tot>=0.6&&transit(w)}
function demandTurn(org){
  if(org.type!=='trade'&&org.type!=='penal')return;
  org.standing=Math.min(100,(org.standing??60)+1.5);
  // lapse
  if(org.toll&&!dominates(org,org.tollW)){log(`Competition broke ${org.name}’s hold on ${G.worlds[org.tollW].name}. Its toll lapses.`,'org');org.toll=0;org.tollW=null}
  for(const w in org.cut)if(!dominates(org,+w)){log(`${org.name} no longer dominates ${G.worlds[+w].name}; the crown’s full share is restored there.`,'org');delete org.cut[w]}
  if(org.defiant&&org.standing>=40){org.defiant=false;log(`${org.head.name} of ${org.name} has made peace with the crown.`,'org')}
  if(org.demand){org.demand.eta--;if(org.demand.eta<=0)answerDemand(org.id,false,true);return}
  const ws=G.worlds.filter(w=>G.disc[w.id]&&dominates(org,w.id));if(!ws.length)return;
  const tr=org.traits;let ch=0.05+(tr.includes('greedy')?0.07:0)+(tr.includes('bold')?0.04:0)-(tr.includes('loyal')?0.04:0);
  if(rnd()>ch)return;const w=ws[Math.floor(rnd()*ws.length)].id;
  if(!org.toll&&rnd()<0.55){const amt=Math.min(30,4+2*(worksOn(w)[org.id]||0));org.demand={t:'toll',w,amt,eta:3};log(`${org.head.name} of ${org.name} controls the supply line across ${G.worlds[w].name} and asks leave to charge the crown a toll of ${amt} gold a quarter.`,'org')}
  else if(!org.cut[w]){org.demand={t:'tax',w,eta:3};log(`${org.head.name} of ${org.name} asks for a reduced crown share on ${G.worlds[w].name}, where the company holds nearly every works.`,'org')}
}
function answerDemand(id,yes,lapsed){const org=G.orgs.find(o=>o.id===id);if(!org||!org.demand)return;const d=org.demand;org.demand=null;
  if(yes){if(d.t==='toll'){org.toll=d.amt;org.tollW=d.w}else org.cut[d.w]=0.25;org.standing=Math.min(100,org.standing+15);log(`The crown granted ${org.name}’s request on ${G.worlds[d.w].name}.`,'org');return}
  org.standing-=lapsed?15:22;log(`The crown ${lapsed?'ignored':'refused'} ${org.name}’s request on ${G.worlds[d.w].name}. The directors are displeased.`,'org');
  const tr=org.traits;if(org.standing<20&&(tr.includes('bold')||tr.includes('greedy'))&&!tr.includes('loyal')&&rnd()<0.25){org.defiant=true;if(d.t==='toll'){org.toll=d.amt;org.tollW=d.w}else org.cut[d.w]=0.25;
    log(`${org.head.name} of ${org.name} defies the crown and imposes its terms on ${G.worlds[d.w].name} anyway. Its troops stay at their posts; the company simply refuses to be refused.`,'loss')}}
function marketTurn(){
  for(const w of G.worlds){const m=worksOn(w.id);const ids=Object.keys(m).map(Number).filter(id=>m[id]>=1);if(ids.length<2)continue;
    const orgs=ids.map(id=>G.orgs.find(o=>o.id===id)).filter(o=>o&&o.type==='trade');
    for(let a=0;a<orgs.length;a++)for(let b=a+1;b<orgs.length;b++){const A=orgs[a],B=orgs[b];const ov=A.res==='all'||B.res==='all'||A.res===B.res;if(!ov||rnd()>0.08)continue;
      A.purse*=0.85;B.purse*=0.85;G.gold+=8;log(`Price war on ${w.name}: ${A.name} and ${B.name} undercut each other. Both lose money; the crown’s customs gain.`,'org')}}
}
// ---- heads ----
function headTurn(org){const h=org.head;h.age+=0.25;const p=h.age<50?0.004:h.age<65?0.012:0.035;if(rnd()>p)return;
  const keep=rnd()<0.4?h.traits[Math.floor(rnd()*h.traits.length)]:null;const nh=newHead(keep);
  log(`${h.name}, head of ${org.name}, has died at ${Math.floor(h.age)}. The directors chose ${nh.name} (${nh.traits.map(t=>TRAITS[t].n).join(', ')}).`,'org');
  org.head=nh;org.traits=nh.traits;if(org.defiant&&!nh.traits.includes('bold')){org.defiant=false;org.standing=Math.max(org.standing,40);log(`${nh.name} ends ${org.name}’s defiance.`,'org')}}
// ---- troops ----
function levyTurn(org){if(org.type!=='trade'&&org.type!=='penal')return;
  const mine=G.units.filter(u=>u.co===org.id);
  for(const u of mine)org.purse-=UT[u.type].up*1.5;
  if(org.purse<0&&mine.length){const u=mine[0];G.units=G.units.filter(x=>x!==u);log(`${org.name} could not pay ${u.name} and disbanded it.`,'mil');org.purse=0;return}
  const cap=Math.min(6,Math.floor(org.works/2)+(org.traits.includes('martial')?1:0));if(mine.length>=cap)return;
  const type=bestInf(ME);const c=Math.round(unitCost(type,ME)*0.9);if(org.purse<c+40)return;
  const hs=G.hubs.filter(h=>h.org===org.id&&h.o===ME).sort((a,b)=>b.pop-a.pop);if(!hs.length)return;
  org.purse-=c;org.levied=(org.levied||0)+1;const u=addUnit(ME,type,hs[0].w,hs[0].i,`${org.name.replace(/^The /,'')} ${ordn(org.levied)} ${org.type==='penal'?'Guards':'Company Foot'}`);u.co=org.id;
  log(`${org.name} raised ${u.name} to patrol its works.`,'mil')}
function companyOrders(){for(const u of G.units){if(!u.co||u.o!==ME)continue;const org=G.orgs.find(o=>o.id===u.co);if(!org){u.co=null;continue}
  const hs=G.hubs.filter(h=>h.org===org.id&&h.o===ME);if(!hs.length){u.dest=null;u.status='No works to guard.';continue}
  let threat=null,bd=12;for(const e of G.units)if(e.o!==ME)for(const h of hs){if(h.w!==e.w)continue;const d=hdist(h.i,e.i);if(d<bd){bd=d;threat={w:e.w,i:e.i}}}
  if(threat){u.dest=threat;u.status='Moving against raiders near company works.';continue}
  if(!u.dest){const h=hs[Math.floor(rnd()*hs.length)];u.dest={w:h.w,i:h.i};u.status=`Patrolling to ${h.name}.`}}}
// ---- quarterly ----
function orgTurn(org){
  if(!org.head){org.head=newHead();org.traits=org.head.traits}
  headTurn(org);
  const f=Math.min(org.fund,Math.max(0,Math.floor(G.gold)));G.gold-=f;org.purse+=f;
  if(org.toll){const t=Math.min(org.toll,Math.max(0,G.gold));G.gold-=t;org.purse+=t}
  let p=orgProj(org);
  switch(org.type){
    case 'trade':case 'penal':{
      if(p){org.status='Building: '+projStatus(p);break}
      const w=+org.w;const wn=G.worlds[w].name;
      if(org.type==='penal'&&roleOf(ME,w)!=='prison'){org.status=`${wn} is not designated a Prison world. Designate it on the Earths tab.`;break}
      if(!hasLines(w)){org.status=`Your lines do not reach ${wn} yet. A survey corps or crown crew must reach its portal first.`;break}
      if(org.traits.includes('cautious')&&G.units.some(u=>u.o!==ME&&u.w===w&&!u.party)){org.status=`Hostile troops on ${wn}; the cautious directors are waiting.`;break}
      if(org.purse<20){org.status='Saving funds before the next venture.';break}
      p=startWorks(org,w,orgTypes(org));
      const where=org.cont!=null&&org.cont!=='any'?` in ${CONTS[+org.cont]}`:'';
      if(p)org.status=`New venture: ${p.name}. `+projStatus(p);
      else org.status=`No unclaimed known ${org.type==='penal'?'deposits':org.res==='all'?'deposits':depName(org.res)}${where} on ${wn}. Send a survey expedition there.`;
      break}
    case 'survey':{
      const crews=Math.min(4,1+Math.floor(org.fund/15));
      {const cap=capHub();if(cap&&org.purse>=25)for(const w of G.worlds){if(!G.disc[w.id]||homeOwner(w.id))continue;
        const bound=G.units.filter(u=>u.o===ME&&((u.w===w.id&&u.auto==='explore')||(u.party&&u.party.kind==='pathfinders'&&u.party.dest.w===w.id))).length;if(bound>=2)continue;
        const rt=worldRoute(cap.w,w.id,ME);if(!rt)continue;const entry=portalBetween(rt[rt.length-2],w.id);if(entry==null||!T[entry]||!hasUnseen(w.id,LCOMP[entry]))continue;
        org.purse-=25;const u=spawnParty('pathfinders','scout',cap,{w:w.id,i:entry},`${org.name} Pathfinders`);u.corps=1;
        log(`${org.name} sent pathfinders from ${cap.name} to map ${w.name}, ${rt.length-1} portal${rt.length>2?'s':''} away.`,'world');break}}
      if(p){p.crews=crews;org.status=projStatus(p);break}
      if(org.purse<10){org.status='Waiting for funds.';break}
      let best=null;
      for(const w of G.worlds){if(!G.disc[w.id]||(homeOwner(w.id)&&homeOwner(w.id)!==ME)||roleOf(ME,w.id)==='reserve')continue;if(org.w!=='any'&&+org.w!==w.id)continue;if(!hasLines(w.id))continue;
        for(const pt of w.portals){if(!isSeen(w.id,pt.i))continue;if(portalLinked(ME,w.id,pt.to)||aliveIds().some(o=>o!==ME&&portalLinked(o,w.id,pt.to))&&T[pt.i])continue;if(G.projects.some(x=>x.w===w.id&&x.portal===pt.i))continue;
          const pl=planToPortal(ME,w.id,pt.i,roadMul(ME,w.id));if(pl&&(!best||pl.work<best.work)){best=pl;best.portal=pt.i}}}
      if(best){p=addProject(ME,best,{by:org.id,crews,name:`${org.name}: ${T[best.portal]?'':'sea '}portal at ${fmtLL(best.portal)}`,rateMul:org.traits.includes('industrious')?1.5:1});p.portal=best.portal;org.status=`Surveying toward the ${T[best.portal]?'':'sea '}portal at ${fmtLL(best.portal)} on ${G.worlds[best.w].name}. `+projStatus(p);}
      else{const s=Math.min(org.purse,30);org.purse-=s;G.gateBonus=Math.min(7,G.gateBonus+s/80);org.status=`All reachable portals are joined to your lines. The corps is building ramps and cranes at the gates: crossing now costs ${Math.max(3,10-Math.floor(G.gateBonus))} hexes of haulage.`}
      break}
    case 'ship':{const w=+org.w;const wn=G.worlds[w].name;const cost=org.traits.includes('frugal')?30:40;
      if(!G.hubs.some(h=>h.o===ME&&h.w===w&&h.port)){org.status=`Needs a harbor of yours on ${wn} to build from.`;break}
      const capS=4+4*G.hubs.filter(h=>h.o===ME&&h.w===w&&h.port).length;if((G.ships[w]||0)>=capS){org.status=`${G.ships[w]} ships sail on ${wn}, all its harbors can berth. Build more harbors there for more ships.`;break}
      let n=0;const lim=org.traits.includes('industrious')?3:2;while(org.purse>=cost&&n<lim&&(G.ships[w]||0)<capS){org.purse-=cost;G.ships[w]=(G.ships[w]||0)+1;n++;org.built=(org.built||0)+1}
      org.status=n?`Launched ${n} ship${n>1?'s':''} on ${wn}. ${G.ships[w]} ships now sail there.`:`Laying keels on ${wn}: ${Math.floor(org.purse)}/${cost} gold for the next ship.`;break}
    case 'rnd':{const s=Math.min(org.purse,Math.max(10,org.fund*1.5));org.purse-=s;
      const pv=G.worlds.some(w=>roleOf(ME,w.id)==='proving'&&G.hubs.some(h=>h.o===ME&&h.w===w.id))?1.5:1;
      G.rdBoost[org.field]=(G.rdBoost[org.field]||0)+s*pv;org.status=`Spent ${Math.round(s)} gold on ${RD_FIELDS[org.field].toLowerCase()}${pv>1?' (proving ground bonus)':''}.`;break}
    case 'merc':{if(org.purse>=120){const hs=G.hubs.filter(h=>h.o===ME&&!h.mobile);let best=hs.find(h=>h.cap),bd=Infinity;for(const h of hs)for(const e of G.units)if(isFoe(e.o)){const d=travelEst(h.w,h.i,e.w,e.i);if(d<bd){bd=d;best=h}}org.purse-=120;spawnMerc(best);org.status='Last company sent out from '+best.name+'.'}else org.status=`Raising a company: ${Math.floor(org.purse)}/120.`;break}
  }
  levyTurn(org);demandTurn(org);
  if(org.defiant)org.status='Defying the crown. '+org.status;
}
function makeOrg(o){const head=newHead();
  const org={id:G.nid++,name:o.name,type:o.type,head,traits:head.traits,w:o.w==null?'any':o.w,cont:o.cont??'any',res:o.res||null,field:o.field||'arms',fund:o.fund??20,purse:30,status:'Newly chartered. Acts at the end of the quarter.',works:0,standing:60,demand:null,toll:0,tollW:null,cut:{},defiant:false,house:o.house||null};
  G.orgs.push(org);return org}
function charterCompany(o){if(G.gold<50)return 'A charter costs 50 gold.';G.gold-=50;const org=makeOrg(o);const head=org.head;
  log(`${org.name} received a royal charter (${COTYPES[org.type].n}). Its first head is ${head.name}, ${head.traits.map(t=>TRAITS[t].n.toLowerCase()).join(' and ')}.`,'org');return null}
function revokeCharter(id){const o=G.orgs.find(o=>o.id===id);if(!o)return;if(o.house){const n=G.nobles.find(x=>x.id===o.house);if(n){n.co=null;n.loyalty-=15}}G.orgs=G.orgs.filter(x=>x!==o);G.projects=G.projects.filter(p=>p.by!==id);for(const h of G.hubs)if(h.org===o.id)h.org=null;
  const n=G.units.filter(u=>u.co===id).length;G.units=G.units.filter(u=>u.co!==id);
  log(`The charter of ${o.name} was revoked. Its sites revert to the crown${n?` and its ${n} troop${n>1?'s':''} disband`:''}.`,'org')}

/* ================= MOVEMENT & COMBAT ================= */
function lvOf(o){return G.realms[o]?G.realms[o].research.logi:0}
function moveCost(u,w,from,to){const ut=UT[u.type];if(ut.fly)return 1;const lv=lvOf(u.o);
  if(!T[to]){if(ut.city)return Infinity;if(T[from]&&(!isPort(u.o,w,from)||!(shipsEff(u.o,w)>0)))return Infinity;return SEAMV[lv]}
  if(!T[from])return 1;
  if(G.inf[key(w,to)]===u.o&&G.inf[key(w,from)]===u.o)return ut.city?LINEC[Math.min(lv,2)]:LINEC[lv];
  let c=MC[tt(w,to)];if(lv>=4&&!ut.cav&&!ut.city)c*=0.6;return c}
function travelMode(u){const ut=UT[u.type];if(ut.fly)return 'Flying';const lv=lvOf(u.o);
  if(!T[u.i])return lv>=3?'By steamship':'Under sail';
  if(G.inf[key(u.w,u.i)]===u.o)return ['On foot along your lines','By wagon road','By canal barge and road','By rail','By rail and motor','By rail, motor and air'][lv];
  return ut.cav?'Mounted, cross-country':lv>=4?'Motorized, cross-country':'On foot, cross-country'}
function travelPlan(u){if(!u.dest)return null;const rt=worldRoute(u.w,u.dest.w,u.o);if(!rt)return null;let i=u.i,cost=0,hexes=0;
  for(let k=0;k<rt.length;k++){const goal=k<rt.length-1?portalBetween(rt[k],rt[k+1]):u.dest.i;const p=aStar(u,rt[k],i,goal);if(!p)return null;let pr=i;for(const t of p){cost+=moveCost(u,rt[k],pr,t);pr=t}hexes+=p.length;if(k<rt.length-1){cost+=1;i=goal}}
  return {hexes,miles:hexes*MILES,quarters:Math.max(1,Math.ceil(cost/UT[u.type].spd)),crossings:rt.length-1}}
function aStar(u,w,from,to){if(from===to)return [];const g=new Float64Array(NT).fill(Infinity),prev=new Int32Array(NT).fill(-1),h=[];g[from]=0;heapPush(h,0,from);let n=0;
  while(h.length&&n<40000){const [f,cur]=heapPop(h);if(cur===to)break;if(f>g[cur]+hdist(cur,to)*0.06+1e-9)continue;n++;for(let q=0;q<6;q++){const nb=NB[cur*6+q];if(nb<0)continue;const c=moveCost(u,w,cur,nb);if(c===Infinity)continue;const ng=g[cur]+c;if(ng<g[nb]){g[nb]=ng;prev[nb]=cur;heapPush(h,ng+hdist(nb,to)*0.06,nb)}}}
  if(g[to]===Infinity)return null;const p=[];let c=to;while(c!==from){p.push(c);c=prev[c]}return p.reverse()}
function enemyHubAt(w,i,o){const h=hubAt(w,i);return h&&h.o!==o}
function moveUnit(u){
  const ut=UT[u.type];let mp=ut.spd,guard=0,first=true;u.mv=false;u.tr=false;
  if(u.air){u.w=u.air.w;u.i=u.air.i;u.air=null;u.dest=null;u.mv=true;return}
  if(!ut.fly&&T[u.i]&&winterAt(u.w,u.i)&&G.inf[key(u.w,u.i)]!==u.o)mp-=1;
  if(!ut.fly&&G.worlds[u.w].storm)mp-=2;
  while(u.dest&&mp>0&&guard++<30){
    if(u.w===u.dest.w&&u.i===u.dest.i){u.dest=null;break}
    let goal;
    if(u.w!==u.dest.w){const rt=worldRoute(u.w,u.dest.w,u.o);if(!rt){u.dest=null;break}const p=portalBetween(u.w,rt[1]);
      if(u.i===p){mp-=1;first=false;const from=u.w;u.w=rt[1];u.mv=true;u.tr=true;if(u.o===ME&&!G.disc[u.w])discoverWorld(u.w,u.name+' marched through the portal.');if(u.o===ME&&!u.guard&&!u.party&&!u.corps)log(`${u.name} crossed from ${G.worlds[from].name} (${SEASONS[seasonAt(from,p)]}, ${hourStr(from)}) into ${G.worlds[u.w].name} (${SEASONS[seasonAt(u.w,p)]}, ${hourStr(u.w)}).`,'world');if(enemyUnitAt(u.w,u.i,u.o)||enemyHubAt(u.w,u.i,u.o))break;continue}
      goal=p}else goal=u.dest.i;
    const path=aStar(u,u.w,u.i,goal);if(!path){if(u.o===ME&&!u.auto&&!u.party)log(`${u.name} could find no route to its destination. Overseas destinations need a harbor with ships to embark from.`,'mil');if(u.auto){(u.skip=u.skip||[]).push(goal);if(u.skip.length>60)u.skip.shift()}u.dest=null;break}
    let stop=false,pr=u.i;
    for(const t of path){const c=moveCost(u,u.w,pr,t);if(c>mp&&!first){mp=0;break}mp-=c;first=false;u.i=t;pr=t;u.mv=true;if(u.party)trailblaze(u,t);if(!ut.city&&(enemyUnitAt(u.w,t,u.o)||enemyHubAt(u.w,t,u.o))){stop=true;break}if(mp<=0)break}
    if(stop){if(u.dest&&u.dest.w===u.w&&u.dest.i===u.i)u.dest=null;break}
    if(u.i!==goal)break;
  }
}
function moveCities(){for(const h of G.hubs){if(!h.mobile||!h.dest)continue;if(G.realms[h.o])setRealm(h.o);const u={o:h.o,type:'traction',w:h.w,i:h.i,dest:h.dest,name:h.name,guard:1};
  if(hubAt(u.dest.w,u.dest.i)&&hubAt(u.dest.w,u.dest.i)!==h){h.dest=null;continue}
  moveUnit(u);h.w=u.w;h.i=u.i;h.dest=u.dest;if(!h.dest&&h.o===ME)log(`${h.name} has rolled to a halt at ${fmtLL(h.i)}, ${G.worlds[h.w].name}.`,'grow')}}
function buildTraction(src){if(!tractionOK())return 'Traction cities are not yet within your engineers’ reach.';if(G.gold<400)return 'A traction city costs 400 gold.';if(tier(src)<2)return 'Only a city can build a traction city.';
  let site=null;for(const t of around(src.i,1))if(t!==src.i&&T[t]&&!hubAt(src.w,t)){site=t;break}if(site==null)return 'No room beside the city.';
  G.gold-=400;src.pop-=3;const h=foundHub(ME,src.w,site,{pop:3,mobile:true,name:src.name+' Traction'});
  log(`${h.name} rolled out of the works at ${src.name}: a moving city that harvests everything within two hexes and supplies your regiments around it.`,'grow');return null}
function battles(){
  const by=new Map();for(const u of G.units){if(u.str<=0)continue;const k=key(u.w,u.i);if(!by.has(k))by.set(k,[]);by.get(k).push(u)}
  for(const [k,us] of by){const owners=[...new Set(us.map(u=>u.o))];if(owners.length<2)continue;
    owners.sort((x,y)=>(x==='M')-(y==='M'));const a=owners[0],b=owners[1];
    const S1=us.filter(u=>u.o===a),S2=us.filter(u=>u.o===b);
    const w=Math.floor(k/NT),i=k-w*NT;const hub=hubAt(w,i);const gate=portalTo(w,i)!=null;const ter=tt(w,i);
    const pow=(side)=>side.reduce((s,u)=>{const ut=UT[u.type];let m=u.mv?ut.atk:ut.def;if(!u.mv){m*=DEFM[ter]||1;if(hub&&hub.o===u.o)m*=hub.kind==='fort'?1.8:1.4;const rr=G.realms[u.o];if(hub&&hub.o===u.o&&rr&&rr.secured&&rr.secured.has&&rr.secured.has('stone'))m*=1.2}
      if(G.realms[u.o]&&roleOf(u.o,w)==='fortress'&&!u.mv)m*=1.2;if(!u.mv&&gate)m*=1.5;if(u.tr)m*=0.75;if(u.merc)m*=1.1;if(u.sup<0.5)m*=0.8;return s+(u.str/100)*m},0)*(0.85+rnd()*0.3);
    const p1=pow(S1),p2=pow(S2),tot=p1+p2||1;
    const l1=42*p2/tot,l2=42*p1/tot;
    for(const u of S1){u.str-=l1*(0.8+rnd()*0.4);u.foe=b}for(const u of S2){u.str-=l2*(0.8+rnd()*0.4);u.foe=a}
    const loser=p1<p2?S1:S2,win=loser===S1?b:a;
    for(const u of loser){if(u.str<=10)continue;const opts=[];for(let q=0;q<6;q++){const nb=NB[u.i*6+q];if(nb<0||(!T[nb]&&!UT[u.type].fly)||tt(w,nb)===8||enemyUnitAt(w,nb,u.o))continue;opts.push(nb)}
      opts.sort((x,y)=>(G.inf[key(w,y)]===u.o?1:0)-(G.inf[key(w,x)]===u.o?1:0));if(opts.length){u.i=opts[0];u.dest=null}else u.str-=15}
    for(const [side,mine,their,lm,lt] of [[a,S1,S2,l1,l2],[b,S2,S1,l2,l1]]){if(!G.realms[side])continue;const foe=side===a?b:a;const won=win===side;
      logTo(side,`Battle at ${fmtLL(i)}, ${G.worlds[w].name}: ${mine.map(u=>u.name).join(', ')} ${won?'drove off':'were driven off by'} ${foe==='M'?their.map(u=>UT[u.type].n.toLowerCase()).join(' and '):'the '+rname(foe)} (our losses ${Math.round(lm)}%, theirs ${Math.round(lt)}%).`,won?'win':'loss')}
  }
  for(const u of G.units)if(u.str<=10){if(G.realms[u.o])logTo(u.o,`${u.name} broke and scattered.`,'loss');
    if(u.foe&&G.realms[u.foe]){if(u.o==='M'){G.realms[u.foe].research.arcPool+=10;logTo(u.foe,`Your troops destroyed the ${UT[u.type].n.toLowerCase()} on ${G.worlds[u.w].name}. Their remains went to your scholars (+10 study points).`,'strange')}
      else logTo(u.foe,`A regiment of the ${rname(u.o)} (${UT[u.type].n}) broke and scattered.`,'win')}}
  G.units=G.units.filter(u=>u.str>10);
}
function mercOrders(){
  for(const u of G.units){if(u.o!==ME||!u.merc)continue;let best=null,bd=Infinity;
    for(const e of G.units)if(isFoe(e.o)&&!e.party){const d=travelEst(u.w,u.i,e.w,e.i,ME);if(d<bd){bd=d;best={w:e.w,i:e.i}}}
    for(const k in G.inf)if(isFoe(G.inf[k])){const kk=+k,w=Math.floor(kk/NT);if(!G.disc[w])continue;const d=travelEst(u.w,u.i,w,kk-w*NT,ME);if(d<bd){bd=d;best={w,i:kk-w*NT}}}
    u.dest=bd<70?best:null;u.status=best&&bd<70?'Hunting the enemy.':'No enemy within reach; holding.';
    if(bd>=70&&T[u.i]&&allowed(ME,u.w,u.i)&&!G.hubs.some(h=>h.w===u.w&&hdist(h.i,u.i)<=6)&&rnd()<0.12)foundCompanyTown(u)}
}
function foundCompanyTown(u){if(!T[u.i]||!allowed(ME,u.w,u.i)||G.hubs.some(h=>h.w===u.w&&hdist(h.i,u.i)<=2)||(G.inf[key(u.w,u.i)]&&G.inf[key(u.w,u.i)]!==ME))return 'Too close to another town, or not open land.';
  const h=foundHub(ME,u.w,u.i,{kind:'company',pop:1,group:u.name});u.merc.turns+=6;u.dest=null;
  log(`${u.name} stopped at ${fmtLL(u.i)} on ${G.worlds[u.w].name} and built ${h.name}, a company town. It pays no taxes but free companies can be hired there cheaply.`,'grow');return null
}

/* ================= AI ================= */
function raids(){
  const cut={},byR={};
  for(const u of G.units){if(u.party||u.corps||enemyUnitAt(u.w,u.i,u.o))continue;const k=key(u.w,u.i);const own=G.inf[k];const h=hubAt(u.w,u.i);
    if(u.o==='M'){if(h){h.pop*=0.82;logTo(h.o,`Creatures ravaged ${h.name} on ${G.worlds[h.w].name}.`,'loss');if(h.pop<0.3&&!h.cap){G.hubs=G.hubs.filter(x=>x!==h);logTo(h.o,`${h.name} was abandoned.`,'loss')}}else if(own){delete G.inf[k];cut[own]=(cut[own]||0)+1}continue}
    if(h&&h.o!==u.o&&G.realms[h.o]){const loser=h.o;const wn=G.worlds[h.w].name;
      if(h.cap){eliminate(loser,u.o,h);continue}
      h.o=u.o;h.org=null;if(h.kind==='estate'){h.kind='town';h.auto=false;h.noble=null}h.pop*=0.6;h.dest=null;if(!h.mobile)G.inf[k]=u.o;
      logTo(u.o,`${u.name} captured ${h.name} on ${wn}.`,'win');logTo(loser,`The ${rname(u.o)} captured ${h.name} on ${wn}.`,'loss')}
    else if(own&&own!==u.o&&!h){delete G.inf[k];cut[own]=(cut[own]||0)+1;byR[u.o]=(byR[u.o]||0)+1}}
  for(const o in cut)logTo(o,`Raiders cut ${cut[o]} hex${cut[o]>1?'es':''} of your supply lines.`,'loss');
  for(const o in byR)logTo(o,`Your regiments cut ${byR[o]} hex${byR[o]>1?'es':''} of enemy line.`,'win');
}
function eliminate(loser,captor,cap){const L=G.realms[loser];if(!L||!L.alive)return;L.alive=false;
  for(const h of G.hubs)if(h.o===loser){h.o=captor;h.org=null;if(h.kind==='estate'){h.kind='town';h.auto=false;h.noble=null}h.cap=0;h.dest=null}
  for(const k in G.inf)if(G.inf[k]===loser)G.inf[k]=captor;
  G.units=G.units.filter(u=>u.o!==loser);G.projects=G.projects.filter(p=>p.o!==loser);for(const l of G.lanes)if(l.o===loser)l.o=captor;
  for(const id of realmIds())logTo(id,id===captor?`Your regiments stormed ${cap.name}. The ${L.name} has fallen, and its towns and lines are now yours.`:id===loser?`The ${rname(captor)} stormed ${cap.name}. Your realm has fallen.`:`The ${rname(captor)} stormed ${cap.name}. The ${L.name} has fallen.`,id===loser?'loss':id===captor?'win':'world');
  const alive=aliveIds();if(alive.length<=1){const wnr=alive[0]||captor;G.over={winner:wnr,txt:`The ${rname(wnr)} stands alone among the Earths.`}}
}

/* A computer realm whose next portal lies across water raises a harbor and buys ships on that Earth. */
function aiSea(w,p){let did=false;
  const want=new Set();if(!T[p])want.add(COMP[p]);else for(let i=0;i<NT;i++)if(!T[i]&&around(i,1).some(t=>T[t]&&LCOMP[t]===LCOMP[p]))want.add(COMP[i]);
  const coastal=i=>T[i]&&around(i,1).some(t=>!T[t]&&want.has(COMP[t]));
  if((G.ships[w]||0)<2&&G.gold>=60){G.gold-=40;G.ships[w]=(G.ships[w]||0)+1;did=true}
  if(G.hubs.some(h=>h.o===ME&&h.w===w&&h.port&&coastal(h.i)))return did;
  if(G.projects.some(q=>q.o===ME&&q.w===w&&!q.by))return true;
  const h=G.hubs.find(h=>h.o===ME&&h.w===w&&!h.mobile&&!h.port&&coastal(h.i));
  if(h)return addProject(ME,{w,path:[h.i],steps:[{t:'port',i:h.i}],goal:h.i,mul:1},{crews:1,name:'Harbor at '+h.name,done:{t:'harbor'},rateMul:0.6});
  const lo=w*NT;for(const k in G.inf){const kk=+k;if(kk<lo||kk>=lo+NT||G.inf[k]!==ME)continue;const i=kk-lo;if(coastal(i)&&!hubAt(w,i)&&allowed(ME,w,i)){if(G.gold<40)return true;G.gold-=40;foundHub(ME,w,i,{pop:0.6});return true}}
  const ts=new Set();for(let i=0;i<NT;i++)if(coastal(i)&&allowed(ME,w,i)&&!G.inf[key(w,i)])ts.add(i);
  const pl=ts.size?roadPlan(ME,w,ts,roadMul(ME,w)):null;if(pl&&pl.steps.length)return addProject(ME,pl,{crews:1,by:null,name:RM.name+' coast road',rateMul:0.6});
  return did}
function aiTurn(){
  const A=RM.aiS,t=G.turn;if(!A)return;
  RM.research.budget=Math.max(4,Math.min(40,Math.floor(G.gold*0.12)));
  if(t===40&&A.flavor){RM.research.studies[A.flavor]={prog:STUDY_NEED[A.flavor]};G.unlocked[A.flavor]=true}
  let tgt=null,bl=Infinity;for(const id of aliveIds()){if(id===ME)continue;const rt=worldRoute(RM.home,homeOf(id));if(rt&&rt.length<bl){bl=rt.length;tgt=id}}
  if(!tgt)return;A.target=tgt;
  const route=worldRoute(RM.home,homeOf(tgt));let leg=null;
  for(let k=0;k<route.length-1;k++){const w=route[k],nx=route[k+1],p=portalBetween(w,nx);if(portalLinked(ME,w,nx))continue;
    if(T[p]&&G.inf[key(w,p)]&&G.inf[key(w,p)]!==ME){leg={w,blocked:p};break}
    leg={w,target:p};break}
  let proj=G.projects.find(p=>p.o===ME&&!p.by);
  if(proj&&proj.last!=null)A.tip={w:proj.w,i:proj.last};
  if(!A.tip)A.tip={w:RM.home,i:RM.cap.i};
  if(!proj&&leg&&leg.target!=null){const pl=planToPortal(ME,leg.w,leg.target,roadMul(ME,leg.w));if(pl)proj=addProject(ME,pl,{crews:1,by:null,name:RM.name+' line',rateMul:0.6});else{const r=aiSea(leg.w,leg.target);if(r&&r.steps)proj=r;else if(!r)A.contact=true}}
  else if(leg&&leg.blocked!=null){A.contact=true;
    if(!proj){const ts=new Set(around(leg.blocked,2).filter(t=>T[t]&&!G.inf[key(leg.w,t)]));const pl=ts.size?roadPlan(ME,leg.w,ts,roadMul(ME,leg.w)):null;
      if(pl&&pl.steps.length)proj=addProject(ME,pl,{crews:1,by:null,name:RM.name+' siege line',rateMul:0.6});else A.tip={w:leg.w,i:leg.blocked}}}
  if(A.roads-A.lastDepot>=9&&G.gold>=35&&A.tip&&T[A.tip.i]&&!hubAt(A.tip.w,A.tip.i)&&G.inf[key(A.tip.w,A.tip.i)]===ME){foundHub(ME,A.tip.w,A.tip.i,{pop:0.8});G.gold-=35;A.lastDepot=A.roads}
  if(t-A.lastWorks>=3&&G.gold>=50&&G.hubs.filter(h=>h.o===ME&&h.kind==='works').length<8){A.lastWorks=t;outer:for(const w of route){const lo=w*NT;for(const k in G.inf){if(G.inf[k]!==ME||+k<lo||+k>=lo+NT)continue;const i=+k-lo;if(!T[i])continue;for(const n of around(i,2)){if(!T[n]||!D[n]||DEP[D[n]].strange||G.hubs.some(h=>h.w===w&&hdist(h.i,n)<=1)||!allowed(ME,w,n))continue;const plan=roadPlan(ME,w,n,1);if(plan&&plan.steps.every(s=>s.t==='hex')&&plan.cost<=G.gold-30){for(const s of plan.steps)placeInfra(ME,w,s.i);G.gold-=plan.cost+30;foundHub(ME,w,n,{kind:'works',pop:0.6});break outer}}}}}
  const mine=G.units.filter(u=>u.o===ME&&!u.party&&!u.guard);const cap=Math.min(G.gold>20000?70:G.gold>3000?45:G.gold>600?30:18,3+Math.floor(t/3));
  if(mine.length<cap){const opts=availUnits(ME).filter(k=>!UT[k].scout);const special=opts.filter(k=>UT[k].req);const plain=opts.filter(k=>!UT[k].req);let type=special.length&&rnd()<0.35?special[0]:plain[Math.floor(rnd()*plain.length)];
    const c=unitCost(type,ME);if(G.gold>=c+20){G.gold-=c;let h=G.hubs.filter(h=>h.o===ME&&tier(h)>=1&&!h.mobile).sort((a,b)=>travelEst(a.w,a.i,A.tip.w,A.tip.i)-travelEst(b.w,b.i,A.tip.w,A.tip.i))[0]||G.hubs.find(h=>h.o===ME&&h.cap);if(h)addUnit(ME,type,h.w,h.i,`${RM.name.split(' ').slice(-1)[0]} ${UT[type].n}`)}}
  const targets=[];for(const h of G.hubs)if(isFoe(h.o))targets.push({w:h.w,i:h.i,v:h.cap?3:1});for(const u of G.units)if(isFoe(u.o)&&!u.party)targets.push({w:u.w,i:u.i,v:1});
  let frontGap=Infinity;if(A.tip)for(const tg of targets)frontGap=Math.min(frontGap,travelEst(A.tip.w,A.tip.i,tg.w,tg.i));
  const aggressive=A.contact||frontGap<=18||t>=140;
  for(const u of G.units){if(u.o!==ME||u.party||u.guard||u.merc||u.co||UT[u.type].scout)continue;
    if(u.str<55){const h=G.hubs.filter(h=>h.o===ME&&!h.mobile).sort((a,b)=>travelEst(u.w,u.i,a.w,a.i)-travelEst(u.w,u.i,b.w,b.i))[0];if(h)u.dest={w:h.w,i:h.i};continue}
    if(aggressive){let best=null,bs=Infinity;for(const tg of targets){const d=travelEst(u.w,u.i,tg.w,tg.i)/tg.v;if(d<bs){bs=d;best=tg}}
      const lo=u.w*NT;for(const k in G.inf){if(!isFoe(G.inf[k])||+k<lo||+k>=lo+NT)continue;const d=hdist(u.i,+k-lo)*1.5;if(d<bs){bs=d;best={w:u.w,i:+k-lo}}}
      u.dest=bs<=30?best:(A.tip?{w:A.tip.w,i:A.tip.i}:null)}
    else if(A.tip)u.dest={w:A.tip.w,i:A.tip.i}}
}

/* ================= TURN ================= */
/* ================= NOBILITY ================= */
function houseHubs(n){return G.hubs.filter(h=>h.o===ME&&(h.id===n.seat||h.noble===n.id))}
function feudal(){return G.research.era<2}
function goodSite(w,minHub,minInf,cont){for(let tries=0;tries<500;tries++){const i=Math.floor(rnd()*NT);if(![1,2,3,10].includes(tt(w,i))||!allowed(ME,w,i))continue;if(cont!=null&&CONT[i]!==cont)continue;
  if(G.hubs.some(h=>h.w===w&&hdist(h.i,i)<minHub))continue;if(G.worlds[w].portals.some(p=>hdist(p.i,i)<3))continue;if(G.inf[key(w,i)])continue;
  if(minInf){let near=false;const lo=w*NT;for(const k in G.inf){const kk=+k;if(kk>=lo&&kk<lo+NT&&hdist(kk-lo,i)<minInf){near=true;break}}if(near)continue}
  let sc=0;for(const t of around(i,1))sc+=YIELD[tt(w,t)]+(D[t]==='grain'?3:0)+(D[t]&&DEP[D[t]].gold?1:0);if(sc<9)continue;return i}return null}
function contHubs(w,c){return G.hubs.filter(h=>h.w===w&&CONT[h.i]===c&&!h.mobile)}
function houseShare(n){if(!n.home)return 0;const all=contHubs(n.home.w,n.home.c);if(!all.length)return 0;return all.filter(h=>h.noble===n.id).length/all.length}
const ESTN=['Manor','Hall','Court','Grange','Chase','Keep','Holt','Demesne'];
function nobleTurn(){
  for(const n of G.nobles){const hs=houseHubs(n);
    n.loyalty+=Math.sign(55-n.loyalty);
    n.wealth=(n.wealth||0)+0.5+hs.reduce((s,h)=>s+(h.kind==='estate'?h.pop*0.15:0),0);
    for(const u of G.units){if(u.guard!==n.id)continue;if(!hs.length){u.str=0;continue}
      let threat=null,bd=9;for(const e of G.units)if(e.o!==ME)for(const h of hs){if(h.w!==e.w)continue;const d=hdist(h.i,e.i);if(d<bd){bd=d;threat={w:e.w,i:e.i}}}
      if(threat){u.dest=threat;u.status=`Riding out against invaders near ${hs[0].name}.`}
      else{const home=hs.find(h=>h.w===u.w)||hs[0];u.dest=(u.w===home.w&&u.i===home.i)?null:{w:home.w,i:home.i};u.status=`Guarding the house lands at ${home.name}.`}}
    // develop land: carve new holdings near existing estates on the same continent
    const est=hs.filter(h=>h.kind==='estate');
    if(!RM.isAI&&est.length&&n.wealth>=45&&rnd()<Math.min(0.6,0.15+n.wealth/600)){const base=est[Math.floor(rnd()*est.length)];let site=null;
      for(const t of around(base.i,5)){if(hdist(t,base.i)<3||!T[t]||[7,8,9].includes(tt(base.w,t))||!allowed(ME,base.w,t)||CONT[t]!==CONT[base.i])continue;
        if(G.hubs.some(x=>x.w===base.w&&hdist(x.i,t)<3))continue;const ow=G.inf[key(base.w,t)];if(ow&&ow!==ME)continue;if(YIELD[tt(base.w,t)]<0.8)continue;site=t;if(rnd()<0.35)break}
      if(site!=null){n.wealth-=45;const h=foundHub(ME,base.w,site,{kind:'estate',pop:1,noble:n.id,name:n.name.replace('House ','')+' '+pick(ESTN,rnd)});
        const pl=roadPlan(ME,base.w,site,1);if(pl&&pl.steps.length<=6&&pl.steps.every(s=>s.t==='hex'))for(const s of pl.steps)placeInfra(ME,base.w,s.i);
        log(`${n.name} carved a new holding, ${h.name}, out of ${CONTS[CONT[site]]} on ${G.worlds[base.w].name}.`,'grow')}}
    // continental ambitions
    if(n.home){const all=contHubs(n.home.w,n.home.c).length;const lord=houseShare(n)>=0.6&&all>=6;
      if(lord&&!n.lord){n.lord=true;n.loyalty+=8;log(`${n.name} now holds most of ${CONTS[n.home.c]} on ${G.worlds[n.home.w].name}. Its lords style themselves Wardens of ${CONTS[n.home.c]}.`,'org')}
      else if(!lord&&n.lord){n.lord=false;log(`${n.name} has lost its grip on ${CONTS[n.home.c]} on ${G.worlds[n.home.w].name}.`,'org')}}
    // a house company limited to its continent
    if(!RM.isAI&&n.home&&!n.co&&n.wealth>=110&&rnd()<0.3){n.wealth-=60;const org=makeOrg({name:`${n.name.replace('House ','')} ${CONTS[n.home.c]} Company`,type:'trade',w:n.home.w,cont:n.home.c,res:'all',fund:0,house:n.id});org.purse=60;n.co=org.id;
      log(`${n.name} founded ${org.name}, a company confined to ${CONTS[n.home.c]} on ${G.worlds[n.home.w].name}, at its own expense.`,'org')}
    if(n.co){const org=G.orgs.find(o=>o.id===n.co);if(!org)n.co=null;else{const t=Math.max(Math.min(n.wealth,15),n.wealth*0.2);n.wealth-=t;org.purse+=t}}
    // feuds
    const rv=G.nobles.find(x=>x.id===n.rival);
    if(rv&&n.id<rv.id){
      if(!n.feud&&n.loyalty<50&&rv.loyalty<50&&rnd()<0.08){n.feud=rv.feud=1;log(`${n.name} and ${rv.name} are feuding. Their household guards are skirmishing over boundary stones.`,'loss')}
      else if(n.feud){for(const u of G.units)if(u.guard===n.id||u.guard===rv.id)u.str-=6+rnd()*8;
        for(const x of [n,rv]){const hh=houseHubs(x);if(hh.length){const h=hh[Math.floor(rnd()*hh.length)];h.pop*=0.96}}
        if(rnd()<0.22){n.feud=rv.feud=0;log(`The feud between ${n.name} and ${rv.name} has burned out for now.`,'info')}}}
  }
  G.units=G.units.filter(u=>u.str>10);
  if(RM.isAI)for(const p of G.petitions.slice())answerPetition(p.id,true);
  // petitions for more land, mostly on the house's own continent
  for(const p of G.petitions){p.eta--;if(p.eta<=0){const n=G.nobles.find(x=>x.id===p.noble);if(n){n.loyalty-=6;log(`${n.name}'s petition went unanswered. They take it as a slight.`,'info')}}}
  G.petitions=G.petitions.filter(p=>p.eta>0);
  if(!RM.isAI)for(const n of G.nobles){if(G.petitions.length>=3||G.petitions.some(p=>p.noble===n.id))continue;
    if(rnd()>0.035+Math.min(0.06,(n.wealth||0)/1500))continue;
    let w,i;
    if(n.home&&rnd()<0.75){w=n.home.w;i=goodSite(w,4,0,n.home.c)}
    if(i==null){const ws=G.worlds.filter(x=>G.disc[x.id]&&!homeOwner(x.id)&&!['reserve','proving'].includes(roleOf(ME,x.id)));if(!ws.length)continue;w=ws[Math.floor(rnd()*ws.length)].id;i=goodSite(w,4,0)}
    if(i==null)continue;G.petitions.push({id:G.nid++,noble:n.id,w,i,eta:4});log(`${n.name} seeks letters patent for an estate at ${fmtLL(i)} in ${CONTS[CONT[i]]} on ${G.worlds[w].name}.`,'org')}
}
function answerPetition(id,yes){const p=G.petitions.find(x=>x.id===id);if(!p)return;G.petitions=G.petitions.filter(x=>x!==p);const n=G.nobles.find(x=>x.id===p.noble);if(!n)return;
  if(!yes){n.loyalty-=12;log(`You refused ${n.name}'s petition. The house is offended.`,'info');return}
  if(hubAt(p.w,p.i)||(G.inf[key(p.w,p.i)]&&G.inf[key(p.w,p.i)]!==ME)){log(`The site ${n.name} wanted is no longer free.`,'info');return}
  n.loyalty+=12;const rv=G.nobles.find(x=>x.id===n.rival);if(rv)rv.loyalty-=5;
  const seats=houseHubs(n).map(h=>({h,d:travelEst(h.w,h.i,p.w,p.i,ME)})).filter(o=>o.d<Infinity).sort((a,b)=>a.d-b.d);
  if(!seats.length){const h=foundHub(ME,p.w,p.i,{kind:'estate',pop:1.5,noble:n.id,name:n.name.replace('House ','')+' '+pick(ESTN,rnd)});if(!n.home)n.home={w:p.w,c:CONT[p.i]};log(`Letters patent granted. ${n.name} founded ${h.name} in ${CONTS[CONT[p.i]]} on ${G.worlds[p.w].name}.`,'org');return}
  const from=seats[0].h;const u=spawnParty('retinue','retinue',from,{w:p.w,i:p.i},`${n.name} retinue`,{noble:n.id});
  const q=partyEta(u);log(`Letters patent granted. ${n.name}’s retinue set out from ${from.name} for its new land in ${CONTS[CONT[p.i]]} on ${G.worlds[p.w].name}${q?`, about ${qs(q)} away`:''}.`,'org')}
function arbitrate(id){const n=G.nobles.find(x=>x.id===id);const rv=n&&G.nobles.find(x=>x.id===n.rival);if(!n||!rv)return 'No feud.';if(G.gold<40)return 'Arbitration costs 40 gold.';G.gold-=40;n.feud=rv.feud=0;n.loyalty+=10;rv.loyalty+=10;log(`The crown arbitrated between ${n.name} and ${rv.name}. Both swore to keep the peace.`,'org');return null}

/* ================= TRAVELERS ================= */
const PARTY={caravan:{n:'Caravan',trail:3},retinue:{n:'Noble retinue',trail:6},exiles:{n:'Emigrant column',trail:4},adventurers:{n:'Adventurers',trail:2},pathfinders:{n:'Pathfinders',trail:2}};
const CARAVAN_N=['Salt','Amber','Wool','Spice','Iron','Cloth','Wine','Grain','Tin','Silk'];
const qs=n=>`${n} quarter${n===1?'':'s'}`;
function capHub(){return G.hubs.find(h=>h.o===ME&&h.cap)}
function reachable(w1,i1,w2,i2){return travelEst(w1,i1,w2,i2,ME)<Infinity}
function spawnParty(kind,type,from,dest,name,extra){const u=addUnit(ME,type,from.w,from.i,name);u.party=Object.assign({kind,dest,trail:PARTY[kind].trail,stuck:0,left:G.turn,from:{w:from.w,i:from.i}},extra||{});u.dest={w:dest.w,i:dest.i};return u}
function partyEta(u){if(!u.party||!u.dest)return null;const tp=travelPlan(u);return tp?tp.quarters:null}
// lay a little trail: only where it extends a line you already have
function trailblaze(u,t){const pt=u.party;if(!pt||pt.trail<=0||!T[t])return;const k=key(u.w,t);if(G.inf[k]||!allowed(ME,u.w,t)||[7,8].includes(tt(u.w,t)))return;
  let touch=false;for(let q=0;q<6;q++){const nb=NB[t*6+q];if(nb>=0&&G.inf[key(u.w,nb)]===ME){touch=true;break}}if(!touch)return;
  placeInfra(ME,u.w,t);pt.trail--;pt.laid=(pt.laid||0)+1}
function partySpawns(){if(RM.isAI)return;
  const cap=capHub();
  // caravans between your larger towns
  const cars=G.units.filter(u=>u.party&&u.party.kind==='caravan').length;
  if(cars<6)for(const h of G.hubs){if(h.o!==ME||h.mobile||tier(h)<2||rnd()>0.05)continue;
    const ds=G.hubs.filter(x=>x.o===ME&&x!==h&&!x.mobile&&tier(x)>=1).map(x=>({x,d:travelEst(h.w,h.i,x.w,x.i,ME)})).filter(o=>o.d>=8&&o.d<90);if(!ds.length)continue;
    const t=ds[Math.floor(rnd()*ds.length)];const nm=`${pick(CARAVAN_N,rnd)} caravan of ${h.name}`;
    spawnParty('caravan','caravan',h,{w:t.x.w,i:t.x.i},nm,{to:t.x.id,home:h.id,dist:t.d});break}
  // adventurers chase portals nobody has stepped through
  if(cap&&G.units.filter(u=>u.party&&u.party.kind==='adventurers').length<2&&rnd()<0.06){let best=null,bd=Infinity;
    for(const w of G.worlds){if(!G.disc[w.id])continue;for(const p of w.portals){if(G.disc[p.to]||!isSeen(w.id,p.i)||!T[p.i])continue;const d=travelEst(cap.w,cap.i,w.id,p.i,ME);if(d<bd){bd=d;best={w:p.to,i:p.i,via:w.id}}}}
    if(best){const u=spawnParty('adventurers','adventurers',cap,best,`${pick(['Lantern','Compass','Far Road','Wayfarers’','Thornback','Grey Cloak'],rnd)} Society`,{explore:8});log(`${u.name} set out from ${cap.name} for the uncharted portal on ${G.worlds[best.via].name}.`,'world')}}
}
function partyTurn(){
  for(const u of G.units){const pt=u.party;if(!pt||u.o!==ME)continue;
    const at=u.dest==null&&!(u.auto);if(u.auto)continue;
    if(!u.dest){const fin=u.w===pt.dest.w&&hdist(u.i,pt.dest.i)<=0;if(fin){arrive(u);continue}
      pt.stuck++;if(pt.stuck>=3){strand(u);continue}u.dest={w:pt.dest.w,i:pt.dest.i}}}
  G.units=G.units.filter(u=>!u.gone);
}
function arrive(u){const pt=u.party;
  if(pt.kind==='caravan'){if(!pt.back){const g=Math.round(6+pt.dist*0.7);G.gold+=g;pt.earned=g;log(`${u.name} reached ${(G.hubs.find(h=>h.id===pt.to)||{name:'its market'}).name} and paid ${g} gold in duties.`,'info');
      const home=G.hubs.find(h=>h.id===pt.home);if(home){pt.back=1;pt.dest={w:home.w,i:home.i};u.dest={w:home.w,i:home.i};pt.trail=Math.max(pt.trail,1);return}}
    const g=Math.round(3+pt.dist*0.3);G.gold+=g;u.gone=1;return}
  if(pt.kind==='retinue'){const n=G.nobles.find(x=>x.id===pt.noble);u.gone=1;if(!n)return;
    if(hubAt(u.w,u.i)||(G.inf[key(u.w,u.i)]&&G.inf[key(u.w,u.i)]!==ME)){strand(u);return}
    const h=foundHub(ME,u.w,u.i,{kind:'estate',pop:1.5,noble:n.id,name:n.name.replace('House ','')+' '+pick(ESTN,rnd)});if(!n.home)n.home={w:u.w,c:CONT[u.i]};
    let extra='';if(feudal()&&G.units.filter(x=>x.guard===n.id).length<3){addUnit(ME,rnd()<0.5?'kn':'maa',u.w,u.i,`${n.name} Household (${h.name})`).guard=n.id;extra=' A household guard holds it.'}
    log(`After ${qs(Math.max(1,G.turn-pt.left))} on the road, ${n.name}’s retinue founded ${h.name} in ${CONTS[CONT[u.i]]} on ${G.worlds[u.w].name}.${extra}${pt.laid?` They cut ${pt.laid} hexes of trail on the way.`:''}`,'org');return}
  if(pt.kind==='exiles'){u.gone=1;if(hubAt(u.w,u.i)||G.inf[key(u.w,u.i)]&&G.inf[key(u.w,u.i)]!==ME){strand(u);return}
    const h=foundHub(ME,u.w,u.i,{kind:'civ',pop:pt.pop,group:pt.group});
    log(`The ${pt.group} reached the end of their road after ${qs(Math.max(1,G.turn-pt.left))} and founded ${h.name} at ${fmtLL(u.i)}, ${G.worlds[u.w].name}. They govern themselves and pay taxes.`,'world');return}
  if(pt.kind==='adventurers'){u.auto='explore';u.dest=null;pt.exploring=1;return}
  if(pt.kind==='pathfinders'){u.auto='explore';u.dest=null;u.corps=1;delete u.party;return}
}
function strand(u){const pt=u.party;u.gone=1;
  const ok=T[u.i]&&allowed(ME,u.w,u.i)&&!G.hubs.some(h=>h.w===u.w&&hdist(h.i,u.i)<3)&&!(G.inf[key(u.w,u.i)]&&G.inf[key(u.w,u.i)]!==ME)&&tt(u.w,u.i)!==8;
  if(pt.kind==='exiles'){if(ok){const h=foundHub(ME,u.w,u.i,{kind:'civ',pop:pt.pop,group:pt.group});log(`Unable to go further, the ${pt.group} settled where they stood and founded ${h.name} at ${fmtLL(u.i)}, ${G.worlds[u.w].name}.`,'world')}else log(`The ${pt.group} could find no road onward and scattered.`,'loss');return}
  if(pt.kind==='retinue'){const n=G.nobles.find(x=>x.id===pt.noble);if(n&&ok){const h=foundHub(ME,u.w,u.i,{kind:'estate',pop:1.2,noble:n.id,name:n.name.replace('House ','')+' '+pick(ESTN,rnd)});if(!n.home)n.home={w:u.w,c:CONT[u.i]};log(`${n.name}’s retinue could not reach its grant and claimed land where it stopped: ${h.name}.`,'org')}else if(n){n.loyalty-=6;log(`${n.name}’s retinue turned back, finding no road to its grant.`,'org')}return}
  if(pt.kind==='pathfinders'){u.gone=0;u.auto='explore';u.dest=null;u.corps=1;delete u.party;return}
  if(pt.kind==='caravan'){if(pt.earned==null)log(`${u.name} found no road and turned home.`,'info');return}
}
function adventurerTurn(){for(const u of G.units){const pt=u.party;if(!pt||u.o!==ME||pt.kind!=='adventurers'||!pt.exploring)continue;pt.explore--;
  if(pt.explore<=0){u.gone=1;log(`${u.name} came home from ${G.worlds[u.w].name} with maps and tall stories.`,'world')}}
  G.units=G.units.filter(u=>!u.gone)}

/* ================= EMIGRANTS & FREE TOWNS ================= */
function people(h){const m={'Varenne':'Varennois','Saint-Orme':'Ormish','Hesdray':'Hesdrayan'};return m[h.name]||h.name+'folk'}
function civTurn(){
  // free towns plant daughter towns on their own
  for(const h of G.hubs.filter(h=>h.o===ME&&h.kind==='civ'&&h.pop>14)){if(rnd()>0.04||G.hubs.filter(x=>x.group===h.group).length>=6)continue;
    let site=null;for(const t of around(h.i,6)){if(hdist(t,h.i)<3||![1,2,3].includes(tt(h.w,t))||!allowed(ME,h.w,t)||G.hubs.some(x=>x.w===h.w&&hdist(x.i,t)<3)||G.inf[key(h.w,t)])continue;site=t;if(rnd()<0.3)break}
    if(site==null)continue;const nh=foundHub(ME,h.w,site,{kind:'civ',pop:2,group:h.group});h.pop-=2;
    const pl=roadPlan(ME,h.w,site,1);if(pl&&pl.path.length<=7&&pl.steps.every(x=>x.t==='hex'))for(const x of pl.steps)placeInfra(ME,h.w,x.i);
    log(`The ${h.group} of ${h.name} founded a daughter town, ${nh.name}. The crown was not consulted.`,'grow')}
  if(RM.isAI||G.turn-G.lastEmig<6)return;
  const srcs=G.hubs.filter(h=>h.o===ME&&!h.auto&&h.pop>10);if(!srcs.length)return;
  const src=srcs[Math.floor(rnd()*srcs.length)];const raw=hubFood(src,ME).raw;
  const sup=G.last?G.last.sup:1;let reason=null,ch=0.08;
  if(src.pop>raw*0.85){ch+=0.12;reason='hunger'}
  if(sup<0.7){ch+=0.15;reason='famine'}
  if(G.research.agri>=2){ch+=0.05;reason=reason||'enclosure'}
  if(rnd()>ch)return;
  reason=reason||pick(['faith','succession','guild'],rnd);
  const ws=G.worlds.filter(w=>G.disc[w.id]&&!homeOwner(w.id)&&!['reserve','proving','prison'].includes(roleOf(ME,w.id))&&!G.units.some(u=>isFoe(u.o)&&u.w===w.id));
  if(!ws.length)return;const w=ws[Math.floor(rnd()*ws.length)].id;const i=goodSite(w,5,4);if(i==null||!reachable(src.w,src.i,w,i))return;
  const pop=Math.max(2,Math.min(6,src.pop*0.12));src.pop-=pop;G.lastEmig=G.turn;
  const group=`${people(src)} ${pick(GROUPS,rnd)}`;const u=spawnParty('exiles','exiles',src,{w,i},`${group} column`,{pop,group});const q=partyEta(u);
  log(`${REASONS[reason]}, ${Math.round(pop*1000).toLocaleString('en-US')} ${group} left ${src.name} on foot for ${G.worlds[w].name}${q?`, a journey of about ${qs(q)}`:''}. They mean to found a town of their own.`,'world')}

function endTurn(){
  if(G.over)return {};
  const marks={};for(const id of realmIds())marks[id]=G.realms[id].log[0]||null;
  for(const id of aliveIds()){setRealm(id);G.secured=econ(id).secured;for(const org of G.orgs.slice())orgTurn(org);if(RM.isAI)aiTurn()}
  for(const p of G.projects.slice()){if(!G.realms[p.o]||!G.realms[p.o].alive)continue;setRealm(p.o);runProject(p)}
  for(const id of aliveIds()){setRealm(id);marketTurn();mercOrders();companyOrders();nobleTurn();partySpawns();exploreOrders()}
  strangeTurn();
  const order=G.units.slice().sort(()=>rnd()-0.5);
  for(const u of order){if(G.realms[u.o])setRealm(u.o);moveUnit(u)}
  moveCities();
  for(const id of aliveIds()){setRealm(id);partyTurn();adventurerTurn()}
  battles();raids();
  if(!G.over)for(const id of aliveIds()){setRealm(id);economyTurn(id);expeditionTurn();civTurn();if(!RM.isAI)revealTurn()}
  if(G.over)for(const id of realmIds())logTo(id,G.over.txt,G.over.winner===id?'win':'loss');
  G.turn++;
  const out={};for(const id of realmIds()){const L=G.realms[id].log;const o=[];for(const l of L){if(l===marks[id])break;o.push(l)}out[id]=o}
  return out;
}
function economyTurn(o){
  const R=econ(o);
  const research=Math.min(G.research.budget,Math.max(0,Math.floor(G.gold+R.income-R.upkeep)));
  const delta=R.income-R.upkeep-research+(RM.isAI?6:0);
  G.gold+=delta;G.last={tax:R.tax,dep:R.dep,civTax:R.civTax,upkeep:R.upkeep,sup:R.sup,income:R.income,research,delta};G.secured=R.secured;
  const gold=G.gold;
  for(const hi of R.hubs){const h=hi.h,role=roleOf(o,h.w),t0=tier(h);
    if(role==='proving'){}
    else if(h.auto||h.mobile){if(hi.prod>=h.pop*1.05)h.pop+=(h.pop*0.035+0.08)*Math.max(0,1-h.pop/60);else if(hi.prod<h.pop)h.pop*=0.97}
    else if(hi.conn){if(R.sup>=0.95&&(hi.sur>h.pop*0.12||R.surplus>R.demand*1.15))h.pop+=h.pop*(0.03+0.008*G.research.agri)*Math.max(0,1-h.pop/(120+40*G.research.agri))+(t0===0?0.12:0);else if(hi.def>0)h.pop-=h.pop*0.1*(1-R.sup)}
    else{if(hi.prod<h.pop)h.pop*=0.95;else h.pop*=1.015}
    if(role==='prison')h.pop+=h.penal?0.25:0.1;
    h.pop=Math.max(0.2,h.pop);
    if(!RM.isAI&&tier(h)>t0)log(`${h.name} on ${G.worlds[h.w].name} has grown into a ${TIERN[tier(h)]}.`,'grow');
    if(!RM.isAI&&tier(h)<t0)log(`${h.name} is shrinking for want of food. It is now a ${TIERN[tier(h)]}.`,'loss');
  }
  for(const u of G.units){if(u.o!==o)continue;const s=R.units.get(u.id);if(!s)continue;
    if(u.merc||u.guard||u.co||u.party||UT[u.type].scout){u.str=Math.min(100,u.str+3);u.sup=1;continue}
    if(s.sup){u.sup=R.sup;u.str=Math.min(100,u.str+5*R.sup-12*(1-R.sup))}else{u.sup=0;u.str-=8}
    if(gold<0)u.str-=6;}
  const rs=G.research,al=rs.alloc,tot=(al.arms+al.logi+al.agri+al.arc)||1;
  const rb=G.rdBoost||{};for(const f of ['arms','logi','agri']){const y=pace(research*al[f]/tot+(rb[f]||0));rs.rate[f]=y;rs.year[f]+=y}
  rs.arcPool+=research*al.arc/tot+R.arc+(rb.arc||0)*1.2;G.rdBoost={};
  while(rs.era<4&&rs.year.arms>=ERA_Y[rs.era+1]){rs.era++;log(`Your armies now fight in the manner of ${ERA_Y[rs.era]}: ${ERAS[rs.era]}. New regiments: ${Object.keys(UT).filter(k=>UT[k].era===rs.era).map(k=>UT[k].n).join(', ')}.${rs.era===2?' The crown is strong enough to forbid new private armies.':''}`,'tech')}
  while(rs.logi<5&&rs.year.logi>=LOGI_Y[rs.logi+1]){rs.logi++;log(`Logistics of ${LOGI_Y[rs.logi]}: ${LOGI[rs.logi]}. ${LOGI_TXT[rs.logi]}`,'tech')}
  while(rs.agri<4&&rs.year.agri>=AGRI_Y[rs.agri+1]){rs.agri++;log(`Farming of ${AGRI_Y[rs.agri]}: ${AGRI[rs.agri]}. Farms yield more.`,'tech')}
  const act=Object.keys(rs.studies).filter(k=>!G.unlocked[k]);
  if(act.length&&rs.arcPool>0){const pv=G.hubs.some(h=>h.o===o&&roleOf(o,h.w)==='proving')?1.25:1;const share=rs.arcPool/act.length;rs.arcPool=0;
    for(const k of act){rs.studies[k].prog+=share*pv;if(rs.studies[k].prog>=STUDY_NEED[k]){G.unlocked[k]=true;const un=Object.keys(UT).find(x=>UT[x].req===k);log(`Breakthrough. The ${DEP[k].unk} is ${DEP[k].n}. ${DEP[k].reveal}${un?' New regiment: '+UT[un].n+'.':''}`,'strange')}}}
  for(const u of G.units)if(u.merc&&u.o===o){u.merc.turns--;if(u.merc.turns<=0){u.str=0;const ct=G.hubs.find(h=>h.kind==='company'&&h.o===o&&h.w===u.w&&hdist(h.i,u.i)<=2);if(ct){ct.pop+=1;log(`${u.name} finished its contract and settled down in ${ct.name}.`,'grow')}else log(`${u.name} finished its contract and marched off to sell its swords elsewhere.`,'mil')}}
  G.units=G.units.filter(u=>u.str>10);
}
function expeditionTurn(){
  for(const e of G.exps){e.eta--;if(e.eta>0)continue;const w=G.worlds[e.w];
    see(e.w,e.i,4);
    if(e.focus==='survey'){const n=reveal(e.i,6);log(`The ${e.name} returned from ${w.name}: ${n} new deposit${n===1?'':'s'} charted around ${fmtLL(e.i)}.`,'world')}
    else if(e.focus==='prospect'){let best=null,bd=Infinity;for(let t=0;t<NT;t++)if(D[t]&&DEP[D[t]].strange&&!KNOWN.has(t)){const d=hdist(t,e.i);if(d<bd){bd=d;best=t}}
      if(best!=null){KNOWN.add(best);log(`The ${e.name} found ${depName(D[best])} at ${fmtLL(best)}. The same site exists on every Earth.`,'strange')}else log(`The ${e.name} found nothing strange that is not already charted.`,'world')}}
  G.exps=G.exps.filter(e=>e.eta>0);
}
function collect(startLog){const out=[];for(const l of G.log){if(l===startLog)break;out.push(l)}return out}
const EXP={survey:{n:'Survey',cost:40,eta:2,d:'Charts deposits within 6 hexes of the chosen hex.'},prospect:{n:'Strange prospecting',cost:70,eta:3,d:'Finds the nearest uncharted strange deposit. Its site holds on every Earth.'}};
const EXPN=['Varne Society','Hollin Survey','Royal Academy party','Merchant Adventurers','Order of the Lamp','Carrow Expedition','Thessel Commission'];
function expEta(w,i){const hs=G.hubs.filter(h=>h.o===ME&&!h.mobile);let d=Infinity;for(const h of hs){const x=travelEst(h.w,h.i,w,i,ME);if(x<d)d=x}return d===Infinity?null:1+Math.ceil(d/6)}
function launchExp(w,i,focus){const e=EXP[focus];const eta=expEta(w,i);if(eta==null)return 'No known route from your towns to there.';if(G.gold<e.cost)return 'Not enough gold.';G.gold-=e.cost;const ex={id:G.nid++,w,i,focus,eta:eta+e.eta-1,name:EXPN[G.nid%EXPN.length]};G.exps.push(ex);log(`The ${ex.name} set out for ${G.worlds[w].name} (${e.n.toLowerCase()}).`,'world');return null}

/* ================= ORDERS (one realm at a time) ================= */
const myUnit=id=>G.units.find(u=>u.id===id&&u.o===ME);
const myHub=id=>G.hubs.find(h=>h.id===id&&h.o===ME);
const ctrl=u=>u&&u.o===ME&&!u.merc&&!u.guard&&!u.co&&!u.party&&!u.corps;
const okW=w=>Number.isInteger(w)&&w>=0&&w<G.worlds.length;
const okI=i=>Number.isInteger(i)&&i>=0&&i<NT;
const CMD={
  move({ids,w,i}){if(!okW(w)||!okI(i))return 'Bad destination.';for(const id of ids||[]){const u=myUnit(id);if(!ctrl(u))continue;u.dest={w,i};u.hold=false;if(u.auto)u.auto=null}},
  halt({ids}){for(const id of ids||[]){const u=myUnit(id);if(!ctrl(u))continue;u.dest=null;if(u.air){G.gold+=25;u.air=null}}},
  hold({ids,on}){for(const id of ids||[]){const u=myUnit(id);if(ctrl(u)&&!UT[u.type].scout){u.hold=!!on;if(on)u.dest=null}}},
  explore({ids,on}){for(const id of ids||[]){const u=myUnit(id);if(ctrl(u)&&UT[u.type].scout){u.auto=on?'explore':null;if(!on)u.dest=null;u.skip=[]}}if(on)exploreOrders()},
  transit({id}){const u=myUnit(id);if(!ctrl(u))return;const to=portalTo(u.w,u.i);if(to==null||!isSeen(u.w,u.i))return 'Not on a known portal.';u.dest={w:to,i:u.i};u.auto=null},
  airlift({id,w,i}){const u=myUnit(id);if(!ctrl(u))return;const h=hubAt(w,i);const R=econ(ME);if(G.research.logi<5||!h||h.o!==ME||!R.net.has(key(w,i))||!R.net.has(key(u.w,u.i)))return 'Airlifts fly between your connected hubs.';if(G.gold<25)return 'Not enough gold.';G.gold-=25;u.air={w,i};u.dest=null},
  companytown({id}){const u=myUnit(id);if(!u||!u.merc)return;return foundCompanyTown(u)},
  petition({id,yes}){answerPetition(id,!!yes)},
  arbitrate({id}){return arbitrate(id)},
  disband({id}){const u=myUnit(id);if(!ctrl(u))return;G.units=G.units.filter(x=>x!==u);log(`${u.name} was disbanded.`,'mil')},
  raise({hub,type}){const h=myHub(hub);if(!h||h.auto)return 'Not your town.';if(!availUnits(ME).includes(type))return 'Unknown regiment.';if(!(tier(h)>=1||h.cap||type==='levy'||UT[type].scout))return 'Only towns can raise that.';const err=raiseUnit(h,type);if(err)return err;const nu=G.units[G.units.length-1];if(UT[type].scout)nu.auto='explore';return {id:nu.id}},
  merc({hub}){const h=myHub(hub);if(!h)return 'Not your town.';return hireMerc(h)},
  depot({w,i}){if(!okW(w)||!okI(i)||!T[i])return;if(G.inf[key(w,i)]!==ME||hubAt(w,i))return 'Depots go on your own line.';if(G.gold<40)return 'Not enough gold.';G.gold-=40;const h=foundHub(ME,w,i,{pop:0.6});log(`Depot ${h.name} founded at ${fmtLL(i)}, ${G.worlds[w].name}.`,'grow')},
  build({w,i,crews}){if(!okW(w)||!okI(i)||!G.disc[w])return 'Bad site.';const c=Math.max(1,Math.min(crews|0,crewsMax()-crownCrews()));if(crownCrews()+c>crewsMax())return 'Not enough free crews.';const pl=roadPlan(ME,w,i,roadMul(ME,w));if(!pl)return 'No route.';const pr=addProject(ME,pl,{crews:c,name:'Line to '+fmtLL(pl.goal)});log(`Crown crews began ${pr.name} on ${G.worlds[w].name}.`,'grow')},
  crew({pid,d}){const p=G.projects.find(x=>x.id===pid&&x.o===ME&&!x.by);if(!p)return;if(d>0&&crownCrews()<crewsMax())p.crews++;if(d<0&&p.crews>1)p.crews--},
  cancelproj({pid}){const p=G.projects.find(x=>x.id===pid&&x.o===ME&&!x.by);if(!p)return;G.projects=G.projects.filter(x=>x!==p);log(`Work stopped on ${p.name}. What was laid stays.`,'info')},
  harbor({hub}){const h=myHub(hub);if(!h||h.port||h.mobile)return;if(!around(h.i,1).some(t=>!T[t]))return 'Not on the coast.';if(crownCrews()>=crewsMax())return 'All crown crews are busy.';if(G.projects.some(p=>p.o===ME&&p.goal===h.i&&p.w===h.w&&p.steps.length===1))return;addProject(ME,{w:h.w,path:[h.i],steps:[{t:'port',i:h.i}],goal:h.i,mul:1},{crews:1,name:'Harbor at '+h.name,done:{t:'harbor'}})},
  traction({hub}){const h=myHub(hub);if(!h)return;return buildTraction(h)},
  tmove({hub,w,i}){const h=myHub(hub);if(!h||!h.mobile||!okW(w)||!okI(i))return;if(!T[i])return 'Traction cities cannot cross water.';h.dest={w,i}},
  thalt({hub}){const h=myHub(hub);if(h)h.dest=null},
  study({k}){if(!STRANGE.includes(k)||G.research.studies[k])return;G.research.studies[k]={prog:0};log(`Researchers began studying the ${depName(k)}.`,'strange')},
  charter(o){if(!COTYPES[o.type])return 'Unknown company.';const w=o.w==='any'?'any':+o.w;if(w!=='any'&&!G.disc[w])return 'Unknown Earth.';if(o.type==='trade'&&o.res!=='all'&&!DEP[o.res])return 'Unknown resource.';
    return charterCompany({name:String(o.name||'Company').slice(0,40),type:o.type,w,cont:o.cont==null||o.cont==='any'?'any':+o.cont,res:o.res,field:RD_FIELDS[o.field]?o.field:'arms',fund:Math.max(0,Math.min(60,+o.fund||20))})},
  demand({id,yes}){answerDemand(id,!!yes)},
  ship({hub}){const h=myHub(hub);if(!h||!h.port)return;if(G.gold<40)return 'A ship costs 40 gold.';G.gold-=40;G.ships[h.w]=(G.ships[h.w]||0)+1;log(`A crown ship was launched at ${h.name}. ${G.ships[h.w]} ships now sail on ${G.worlds[h.w].name}.`,'grow')},
  revoke({id}){if(G.orgs.some(o=>o.id===id))revokeCharter(id)},
  expedition({w,i,f}){if(!okW(w)||!okI(i)||!EXP[f]||!G.disc[w])return 'Bad target.';return launchExp(w,i,f)},
  scoutgo({w,i}){if(!okW(w)||!okI(i))return;const sc=G.units.filter(x=>x.o===ME&&x.w===w&&UT[x.type].scout&&ctrl(x)).sort((a,b)=>(a.auto?1:0)-(b.auto?1:0)||hdist(a.i,i)-hdist(b.i,i));if(!sc[0])return 'No explorers on this Earth.';sc[0].auto=null;sc[0].dest={w,i};return {id:sc[0].id}},
  research({budget,alloc}){const r=G.research;if(budget!=null)r.budget=Math.max(0,Math.min(400,budget|0));if(alloc){const a={};let s=0;for(const f of ['arms','logi','agri','arc']){a[f]=Math.max(0,Math.min(100,+alloc[f]||0));s+=a[f]}if(s>0)for(const f in a)r.alloc[f]=Math.round(a[f]*100/s)}},
  fund({id,fund}){const o=G.orgs.find(x=>x.id===id);if(o)o.fund=Math.max(0,Math.min(60,fund|0))},
  role({w,role}){if(!okW(w)||!ROLES[role]||!G.disc[w])return;const cur=roleOf(ME,w);if(cur==='home'||cur==='foreign')return 'That Earth cannot be designated.';G.roles[w]=role;log(`${G.worlds[w].name} designated a ${ROLES[role]}.`,'world')},
  rename({name}){const n=String(name||'').trim().slice(0,40);if(n)RM.name=n},
};
function runCmd(realm,name,args){const r=G.realms[realm];if(!r)return {err:'No such realm.'};if(!r.alive)return {err:'Your realm has fallen.'};if(G.over)return {err:'The war is over.'};
  setRealm(realm);const f=CMD[name];if(!f)return {err:'Unknown order.'};
  try{const res=f(args||{});if(typeof res==='string')return {err:res};return {ok:1,res:res||null}}catch(e){return {err:'That order failed.'}}}
/* ================= WHAT EACH PLAYER MAY SEE ================= */
function makeView(rid){setRealm(rid);G.secured=econ(rid).secured;
  const vis=(w,i)=>!!G.disc[w]&&isSeen(w,i);
  const worlds=G.worlds.map(w=>{if(!G.disc[w.id])return {id:w.id,name:'Uncharted',portals:[],hidden:1,soff:0,hoff:0,weird:0};
    return {id:w.id,name:w.name,soff:w.soff,hoff:w.hoff,weird:w.weird,storm:w.storm||0,stormName:w.stormName||'',role:roleOf(rid,w.id),portals:w.portals.filter(p=>isSeen(w.id,p.i)).map(p=>({i:p.i,to:p.to}))}});
  const hubs=G.hubs.filter(h=>h.o===rid||vis(h.w,h.i)).map(h=>h.o===rid?h:{id:h.id,o:h.o,w:h.w,i:h.i,name:h.name,pop:h.pop,cap:h.cap,kind:h.kind,port:h.port,mobile:h.mobile,auto:h.auto,group:h.group});
  const units=G.units.filter(u=>u.o===rid||vis(u.w,u.i)).map(u=>u.o===rid?u:{id:u.id,o:u.o,type:u.type,w:u.w,i:u.i,str:u.str,name:u.o==='M'?UT[u.type].n:UT[u.type].n});
  const inf={};for(const k in G.inf){const o=G.inf[k];if(o===rid){inf[k]=o;continue}const w=Math.floor(k/NT);if(vis(w,k-w*NT))inf[k]=o}
  const realms={};for(const id in G.realms){const r=G.realms[id];if(id===rid){const c={...r,secured:null,known:[...r._known],seenS:r._seen.map(packArr)};realms[id]=c}
    else realms[id]={id,name:r.name,color:r.color,alive:r.alive,isAI:r.isAI,seat:r.seat,home:G.disc[r.home]?r.home:-1,cap:G.disc[r.home]&&isSeen(r.home,r.cap.i)?r.cap:null}}
  const dep=[...KNOWN].map(t=>[t,D[t]]);
  const mods={};for(const w of G.worlds)if(G.disc[w.id]&&MODS[w.id]){const a=[];const m=MODS[w.id];for(let i=0;i<NT;i++)if(m[i]&&isSeen(w.id,i))a.push(i,m[i]);mods[w.id]=a}
  return {me:rid,turn:G.turn,nid:G.nid,worlds,hubs,units,inf,projects:G.projects.filter(p=>p.o===rid),lanes:G.lanes.filter(l=>l.o===rid),realms,dep,mods,over:G.over,center:-1}}
function loadView(v){G={v:6,mp:1,turn:v.turn,nid:v.nid,worlds:v.worlds,hubs:v.hubs,units:v.units,inf:v.inf,projects:v.projects,lanes:v.lanes,realms:v.realms,over:v.over,rs:1};
  for(const id in G.realms){const r=G.realms[id];if(id===v.me){hideRuntime(r,new Set(r.known||[]),(r.seenS||[]).map(unpackArr));delete r.known;delete r.seenS;if(!r.ships)r.ships={};if(!r.roles)r.roles={}}else hideRuntime(r,new Set(),[])}
  bindG();D.fill(null);for(const [t,k] of v.dep)D[t]=k;MODS.length=0;for(const w in v.mods){const m=new Uint8Array(NT);const a=v.mods[w];for(let j=0;j<a.length;j+=2)m[a[j]]=a[j+1];MODS[+w]=m}
  setRealm(v.me);FOGV++}
/* ================= SAVE / LOAD (server) ================= */
function serialize(){const out={...G};out.realms={};for(const id in G.realms){const r=G.realms[id];out.realms[id]={...r,secured:null,known:[...r._known],seenS:r._seen.map(packArr)}}return JSON.stringify(out)}
function deserialize(s){const o=typeof s==='string'?JSON.parse(s):s;G=o;for(const id in G.realms){const r=G.realms[id];hideRuntime(r,new Set(r.known||[]),(r.seenS||[]).map(unpackArr));delete r.known;delete r.seenS}
  bindG();genDeposits(G.seed);genMods();setRealm(Object.keys(G.realms)[0])}
function useGame(rt){G=rt.G;D=rt.D;MODS=rt.MODS;bindG();setRealm(Object.keys(G.realms)[0])}
function snapshotRuntime(){return {G,D,MODS}}
if(typeof module!=='undefined')module.exports={newGame,endTurn,runCmd,makeView,serialize,deserialize,useGame,snapshotRuntime,aliveIds,realmIds,setRealm,econ,
  get G(){return G},get ME(){return ME},UT,T,NT,STRANGE,worldRoute,travelEst,homeOf,KNOWN:()=>KNOWN,SEATS};
