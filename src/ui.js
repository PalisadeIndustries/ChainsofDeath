'use strict';
/* ================= UI STATE ================= */
const $=s=>document.querySelector(s);
const cv=$('#map'),ctx=cv.getContext('2d');
let VW=0,VH=0,DPR=1;
const cam={x:0,y:0,z:1.4};
let planCrews=1,tmoveHub=null,curW=0,selHex=null,selUnit=null,mode=null,plan=null,tab='hex',sheetOpen=true,R=null,dirty=true,confirmNew=false;
let ctxPrev=null;const selUnits=new Set();let pathCache={};let terrV=0,TERR=null,FOGC=null,lastTap=null,lastEvents=[];
const COL={P:'#d9ae55',A:'#cf5a4e',M:'#a77be8',ocean:'#0f1d24',civ:'#8fc9b8',company:'#b7a27a',estate:'#c3a0d8',org:'#9fc0d6'};
const hubCol=h=>h.o!=='P'?COL.A:h.kind==='civ'?COL.civ:h.kind==='company'?COL.company:h.kind==='estate'?COL.estate:h.org?COL.org:COL.P;
const TERC=['#12232b','#5f6d3f','#3b5432','#6e6145','#837d72','#a58f5e','#6f786b','#c6cfd1','#14091c','#8aa0a8','#5d3f6e','#b9ae90'];
const movable=u=>u&&u.o==='P'&&!u.merc&&!u.guard&&!u.co&&!u.party&&!u.corps;
const idleUnits=()=>G.units.filter(u=>movable(u)&&!u.dest&&!u.hold&&!u.auto&&!u.air);

/* ================= TERRAIN RASTER ================= */
const base=document.createElement('canvas');base.width=Math.ceil(MAPW+HW);base.height=Math.ceil(MAPH);
(function(){const b=base.getContext('2d');b.fillStyle=TERC[0];b.fillRect(0,0,base.width,base.height);
  const hexP=(c,x,y,s)=>{c.beginPath();for(let k=0;k<6;k++){const a=Math.PI/180*(60*k-30);c.lineTo(x+s*Math.cos(a),y+s*Math.sin(a))}c.closePath()};
  for(let i=0;i<NT;i++){const t=T[i];const x=cxOf(i),y=cyOf(i);let col=TERC[t];
    if(!t){let coast=false;for(let q=0;q<6;q++){const nb=NB[i*6+q];if(nb>=0&&T[nb])coast=true}if(coast)col='#16303a'}
    const v=(h2(i,7,1)-0.5)*0.12;
    for(const dx of [0,MAPW]){if(dx&&x>HW*1.2)continue;hexP(b,x+dx,y,S+0.6);b.fillStyle=col;b.fill();if(v){b.fillStyle=v>0?`rgba(255,255,255,${v})`:`rgba(0,0,0,${-v})`;b.fill()}
      if(t){b.strokeStyle='rgba(0,0,0,0.18)';b.lineWidth=0.8;b.stroke()}}}
  b.lineCap='round';
  for(let i=0;i<NT;i++){const t=T[i];if(t!==4&&t!==3&&t!==2)continue;const x=cxOf(i),y=cyOf(i);b.strokeStyle='rgba(20,18,14,0.35)';b.lineWidth=1.1;
    if(t===4){b.beginPath();b.moveTo(x-6,y+4);b.lineTo(x-1,y-5);b.lineTo(x+4,y+4);b.stroke()}
    else if(t===3){b.beginPath();b.arc(x,y+3,5,Math.PI*1.15,Math.PI*1.85);b.stroke()}
    else{b.fillStyle='rgba(18,30,14,0.35)';b.beginPath();b.arc(x-3,y+1,2.2,0,7);b.arc(x+3,y-2,2.2,0,7);b.fill()}}
})();
const foreignCache={};
function foreignLayer(w){if(foreignCache[w])return foreignCache[w];const c=document.createElement('canvas');c.width=base.width;c.height=base.height;const b=c.getContext('2d');const ctr=w===0?G.capP:G.capA;
  b.fillStyle='rgba(8,10,12,0.55)';for(let i=0;i<NT;i++){if(!T[i]||hdist(i,ctr)<=7)continue;const x=cxOf(i),y=cyOf(i);for(const dx of [0,MAPW]){if(dx&&x>HW*1.2)continue;b.beginPath();for(let k=0;k<6;k++){const a=Math.PI/180*(60*k-30);b.lineTo(x+dx+(S+0.6)*Math.cos(a),y+(S+0.6)*Math.sin(a))}b.fill()}}
  foreignCache[w]=c;return c}
function fogLayer(){if(curW===0)return null;if(FOGC&&FOGC.w===curW&&FOGC.v===FOGV)return FOGC.c;
  const c=FOGC?FOGC.c:document.createElement('canvas');c.width=Math.ceil(base.width/2);c.height=Math.ceil(base.height/2);const b=c.getContext('2d');b.setTransform(0.5,0,0,0.5,0,0);b.clearRect(0,0,base.width,base.height);
  for(let i=0;i<NT;i++){if(isSeen(curW,i))continue;const x=cxOf(i),y=cyOf(i);for(const dx of [0,MAPW]){if(dx&&x>HW*1.2)continue;b.beginPath();for(let k=0;k<6;k++){const a=Math.PI/180*(60*k-30);b.lineTo(x+dx+(S+0.8)*Math.cos(a),y+(S+0.8)*Math.sin(a))}b.closePath();
    b.fillStyle=TERC[T[i]];b.fill();b.fillStyle='rgba(6,10,13,0.62)';b.fill()}}
  FOGC={w:curW,v:FOGV,c};return c}

/* ================= TERRITORY ================= */
function terrCat(h){if(h.o!=='P')return ['A',COL.A];if(h.kind==='estate')return ['N'+h.noble,COL.estate];if(h.kind==='civ')return ['C'+h.group,COL.civ];if(h.kind==='company')return ['F',COL.company];if(h.org)return ['O'+h.org,COL.org];return ['P',COL.P]}
function territory(){const k=curW+':'+terrV;if(TERR&&TERR.k===k)return TERR;
  const hubs=G.hubs.filter(h=>h.w===curW&&(h.o==='P'||isSeen(curW,h.i)));const own=new Int32Array(NT).fill(-1),dist=new Float32Array(NT).fill(99);
  hubs.forEach((h,n)=>{for(const t of around(h.i,crad(h))){if(!T[t])continue;const d=hdist(h.i,t)-Math.min(0.9,h.pop/200);if(d<dist[t]){dist[t]=d;own[t]=n}}});
  const cats=hubs.map(terrCat);const by={};const P=col=>by[col]||(by[col]={fill:new Path2D(),edge:new Path2D()});
  for(let t=0;t<NT;t++){if(own[t]<0)continue;const [c,col]=cats[own[t]];const g=P(col);const x=cxOf(t),y=cyOf(t);
    for(let k=0;k<6;k++){const a=Math.PI/180*(60*k-30);if(k===0)g.fill.moveTo(x+(S+0.3)*Math.cos(a),y+(S+0.3)*Math.sin(a));else g.fill.lineTo(x+(S+0.3)*Math.cos(a),y+(S+0.3)*Math.sin(a))}g.fill.closePath();
    for(let d=0;d<6;d++){const nb=NB[t*6+d];if(nb>=0&&own[nb]>=0&&cats[own[nb]][0]===c)continue;
      const a1=(30-60*d)*Math.PI/180,a2=(-30-60*d)*Math.PI/180;g.edge.moveTo(x+S*Math.cos(a1),y+S*Math.sin(a1));g.edge.lineTo(x+S*Math.cos(a2),y+S*Math.sin(a2))}}
  TERR={k,by};return TERR}

/* ================= CAMERA ================= */
function resize(){DPR=Math.min(2,window.devicePixelRatio||1);VW=cv.clientWidth;VH=cv.clientHeight;cv.width=VW*DPR;cv.height=VH*DPR;dirty=true}
function centerOn(i){cam.x=cxOf(i)-VW/2/cam.z;cam.y=cyOf(i)-mapViewH()/2/cam.z;clampCam();dirty=true}
function mapViewH(){const sh=$('#sheet');if(window.innerWidth>=900)return VH;return VH-(sheetOpen?sh.offsetHeight:56)}
function clampCam(){cam.z=Math.max(0.35,Math.min(4,cam.z));cam.x=((cam.x%MAPW)+MAPW)%MAPW;cam.y=Math.max(-VH/cam.z*0.5,Math.min(MAPH-VH/cam.z*0.3,cam.y))}
function pickHex(sx,sy){let x=cam.x+sx/cam.z,y=cam.y+sy/cam.z;x=((x%MAPW)+MAPW)%MAPW;const xx=x-HW/2,yy=y-S;
  let q=(SQ/3*xx-yy/3)/S,r=(2/3*yy)/S,s=-q-r;let rq=Math.round(q),rr=Math.round(r),rs=Math.round(s);const dq=Math.abs(rq-q),dr=Math.abs(rr-r),ds=Math.abs(rs-s);
  if(dq>dr&&dq>ds)rq=-rr-rs;else if(dr>ds)rr=-rq-rs;if(rr<0||rr>=H)return null;return idx(rq+((rr-(rr&1))>>1),rr)}

/* ================= DRAW ================= */
function hexPath(x,y,s){ctx.beginPath();for(let k=0;k<6;k++){const a=Math.PI/180*(60*k-30);ctx.lineTo(x+s*Math.cos(a),y+s*Math.sin(a))}ctx.closePath()}
function shifts(){const out=[];const x0=cam.x,x1=cam.x+VW/cam.z;for(let k=-1;k<=2;k++){const a=k*MAPW;if(a+MAPW+HW>=x0&&a<=x1)out.push(a)}return out}
function draw(){
  dirty=false;ctx.setTransform(DPR,0,0,DPR,0,0);ctx.fillStyle=COL.ocean;ctx.fillRect(0,0,VW,VH);
  const z=cam.z;ctx.setTransform(DPR*z,0,0,DPR*z,-cam.x*z*DPR,-cam.y*z*DPR);
  const ks=shifts(),px=1/z,W0=G.worlds[curW];
  ctx.imageSmoothingEnabled=z<1.5;
  for(const k of ks)ctx.drawImage(base,k,0);
  if(curW===0||curW===G.rivalW)for(const k of ks)ctx.drawImage(foreignLayer(curW),k,0);
  const visible=(x,y,m)=>{m=m||40*px;return y>cam.y-m&&y<cam.y+VH/z+m&&x>cam.x-m&&x<cam.x+VW/z+m};
  const lo=curW*NT;
  // strange terrain on fractured Earths
  const md=MODS[curW];
  if(md){for(let i=0;i<NT;i++){const m=md[i];if(!m||!isSeen(curW,i))continue;for(const k of ks){const x=cxOf(i)+k,y=cyOf(i);if(!visible(x,y))continue;hexPath(x,y,S+0.5);ctx.fillStyle=TERC[m];ctx.fill();
      if(m===8){ctx.strokeStyle='rgba(180,120,255,0.55)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x-6,y-3);ctx.lineTo(x-1,y+2);ctx.lineTo(x+5,y-2);ctx.stroke()}
      else if(m===9){ctx.strokeStyle='rgba(230,250,255,0.5)';ctx.lineWidth=0.8;ctx.beginPath();ctx.moveTo(x-4,y+3);ctx.lineTo(x,y-4);ctx.lineTo(x+4,y+3);ctx.closePath();ctx.stroke()}
      else if(m===10){ctx.fillStyle='rgba(220,170,255,0.35)';ctx.beginPath();ctx.arc(x-3,y,2,0,7);ctx.arc(x+3,y-2,1.6,0,7);ctx.fill()}
      else{ctx.strokeStyle='rgba(60,50,40,0.45)';ctx.lineWidth=0.9;ctx.beginPath();ctx.moveTo(x-4,y);ctx.lineTo(x+4,y);ctx.stroke()}}}
    ctx.fillStyle=`rgba(120,60,180,${0.04*W0.weird})`;ctx.fillRect(cam.x,cam.y,VW/z,VH/z)}
  else if(curW>0&&curW!==G.rivalW){ctx.fillStyle=`hsla(${(curW*67)%360},45%,55%,0.05)`;ctx.fillRect(cam.x,cam.y,VW/z,VH/z)}
  // territory: faint fill and strong borders
  const TR=territory();
  ctx.lineCap='round';
  for(const col in TR.by){const g=TR.by[col];for(const k of ks){ctx.save();ctx.translate(k,0);ctx.fillStyle=col+'1c';ctx.fill(g.fill);ctx.strokeStyle='rgba(8,12,14,0.7)';ctx.lineWidth=Math.max(3.2,3.6*px);ctx.stroke(g.edge);ctx.strokeStyle=col;ctx.lineWidth=Math.max(1.6,2*px);ctx.stroke(g.edge);ctx.restore()}}
  if(ctxPrev&&ctxPrev.w===curW){const c=ctxPrev;const ring=c.r?around(c.i,c.r):[];ctx.lineWidth=1.2*px;
    for(const t of ring){for(const k of ks){const x=cxOf(t)+k,y=cyOf(t);if(!visible(x,y))continue;hexPath(x,y,S);ctx.fillStyle=c.col+'33';ctx.fill();ctx.strokeStyle=c.col+'aa';ctx.stroke()}}
    if(c.p){for(const k of ks){const x=cxOf(c.i)+k,y=cyOf(c.i);ctx.strokeStyle=c.col;ctx.setLineDash([4*px,4*px]);ctx.lineWidth=1.6*px;for(const rr of [3,6,9]){ctx.beginPath();ctx.arc(x,y,rr*HW,0,7);ctx.stroke()}ctx.setLineDash([])}}
    for(const k of ks){hexPath(cxOf(c.i)+k,cyOf(c.i),S);ctx.strokeStyle='#fff';ctx.lineWidth=2*px;ctx.stroke()}}
  // land lines
  for(const kk in G.inf){const n=+kk;if(n<lo||n>=lo+NT)continue;const i=n-lo,o=G.inf[kk];if(!T[i])continue;if(o!=='P'&&!isSeen(curW,i))continue;
    ctx.strokeStyle=o==='P'?COL.P:COL.A;ctx.lineWidth=Math.max(1.4*px,2);
    let any=false;
    for(let q=0;q<3;q++){const nb=NB[i*6+q];if(nb<0||!T[nb])continue;if(G.inf[lo+nb]!==o)continue;any=true;let dx=cxOf(nb)-cxOf(i);if(dx>MAPW/2)dx-=MAPW;if(dx<-MAPW/2)dx+=MAPW;const dy=cyOf(nb)-cyOf(i);
      for(const k of ks){const x=cxOf(i)+k,y=cyOf(i);if(!visible(x,y))continue;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dx,y+dy);ctx.stroke()}}
    if(!any){let lonely=true;for(let q=3;q<6;q++){const nb=NB[i*6+q];if(nb>=0&&T[nb]&&G.inf[lo+nb]===o)lonely=false}if(lonely){ctx.fillStyle=ctx.strokeStyle;for(const k of ks){ctx.beginPath();ctx.arc(cxOf(i)+k,cyOf(i),2.2,0,7);ctx.fill()}}}}
  for(const l of G.lanes){if(l.w!==curW||l.o!=='P')continue;ctx.strokeStyle=shipsEff('P',curW)>0?COL.P:'#6b7a7d';ctx.lineWidth=1.4*Math.max(1,px);ctx.setLineDash([2,4]);poly(l.tiles,ks)}
  ctx.setLineDash([]);
  for(const p of G.projects){if(p.w!==curW||p.o!=='P')continue;ctx.strokeStyle=p.by?'#c9b48a':'#f3e3b0';ctx.lineWidth=1.4*px;ctx.setLineDash([3*px,3*px]);
    for(let k=p.k;k<p.steps.length;k++){const s=p.steps[k];if(s.t==='sail'){poly(s.tiles,ks);continue}if((s.w??p.w)!==curW)continue;for(const x of ks){hexPath(cxOf(s.i)+x,cyOf(s.i),S*(s.t==='port'?0.75:0.5));ctx.stroke()}}
    const nx=p.steps[p.k];if(nx&&nx.i!=null)for(const x of ks){ctx.setLineDash([]);ctx.fillStyle=p.by?'#c9b48a':'#f3e3b0';ctx.beginPath();ctx.arc(cxOf(nx.i)+x,cyOf(nx.i),3,0,7);ctx.fill()}}
  ctx.setLineDash([]);
  if(plan&&plan.w===curW&&plan.path){ctx.strokeStyle='#ffffff';ctx.lineWidth=2*px;ctx.setLineDash([4*px,4*px]);for(const s of plan.steps){if(s.t==='sail'){poly(s.tiles,ks);continue}if((s.w??plan.w)!==curW)continue;for(const k of ks){hexPath(cxOf(s.i)+k,cyOf(s.i),S*(s.t==='port'?0.75:0.55));ctx.stroke()}}ctx.setLineDash([])}
  // deposits (known on every Earth)
  ctx.textAlign='center';ctx.textBaseline='middle';
  for(const t of KNOWN){const d=DEP[D[t]];for(const k of ks){const x=cxOf(t)+k,y=cyOf(t);if(!visible(x,y))continue;
    if(d.strange){ctx.save();ctx.shadowColor=d.col;ctx.shadowBlur=10;ctx.fillStyle=d.col;ctx.beginPath();ctx.moveTo(x,y-7);ctx.lineTo(x+5,y);ctx.lineTo(x,y+7);ctx.lineTo(x-5,y);ctx.closePath();ctx.fill();ctx.restore();ctx.strokeStyle='#0b1418';ctx.lineWidth=1;ctx.stroke()}
    else{ctx.fillStyle='rgba(10,16,19,0.82)';ctx.beginPath();ctx.arc(x+5,y-5,5.6,0,7);ctx.fill();ctx.strokeStyle=d.col;ctx.lineWidth=1.3;ctx.stroke();
      if(z>0.9){ctx.fillStyle=d.col;ctx.font=`600 5.6px "IBM Plex Mono",monospace`;ctx.fillText(d.g,x+5,y-4.8)}}}}
  // fog over everything not yet explored on this Earth
  const fog=fogLayer();if(fog)for(const k of ks)ctx.drawImage(fog,k,0,base.width,base.height);
  if(W0.storm){ctx.fillStyle='rgba(150,170,200,0.07)';ctx.fillRect(cam.x,cam.y,VW/z,VH/z)}
  // portals you have found
  for(const p of W0.portals){if(!isSeen(curW,p.i))continue;for(const k of ks){const x=cxOf(p.i)+k,y=cyOf(p.i);if(!visible(x,y))continue;
    ctx.save();ctx.shadowColor='#8fdcff';ctx.shadowBlur=14;ctx.strokeStyle='#8fdcff';ctx.lineWidth=2.4;ctx.beginPath();ctx.ellipse(x,y,8,10,0,0,7);ctx.stroke();ctx.restore();
    ctx.fillStyle='rgba(143,220,255,0.18)';ctx.beginPath();ctx.ellipse(x,y,7,9,0,0,7);ctx.fill();
    if(z>0.55){const nm=G.disc[p.to]?G.worlds[p.to].name.replace('Earth ',''):'uncharted';label(x,y+18,'→ '+nm,'#8fdcff',11)}}}
  // hubs
  for(const h of G.hubs){if(h.w!==curW)continue;if(h.o!=='P'&&!isSeen(curW,h.i))continue;for(const k of ks){const x=cxOf(h.i)+k,y=cyOf(h.i);if(!visible(x,y))continue;const c=hubCol(h),tr=tier(h);
    const s=h.cap?8:h.kind==='fort'?6.5:4.5+tr*1.2;ctx.fillStyle='#0b1418';ctx.fillRect(x-s-1.2,y-s-1.2,2*s+2.4,2*s+2.4);ctx.fillStyle=c;
    if(h.kind==='fort'){ctx.beginPath();ctx.moveTo(x,y-s);ctx.lineTo(x+s,y);ctx.lineTo(x,y+s);ctx.lineTo(x-s,y);ctx.closePath();ctx.fill()}else if(h.mobile){ctx.beginPath();ctx.arc(x,y,s+1,0,7);ctx.fill();ctx.fillStyle='#0b1418';for(const dx of [-s*0.6,0,s*0.6]){ctx.beginPath();ctx.arc(x+dx,y+s*0.55,1.6,0,7);ctx.fill()}}else ctx.fillRect(x-s,y-s,2*s,2*s);
    if(h.port){ctx.strokeStyle='#8fdcff';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x+s+2,y+s+1,3,0,7);ctx.stroke()}
    if(h.cap){ctx.fillStyle='#0b1418';ctx.fillRect(x-3,y-3,6,6)}
    if(h.kind==='works'){ctx.fillStyle='#0b1418';ctx.beginPath();ctx.arc(x,y,s*0.45,0,7);ctx.fill()}
    if(z>0.8||h.cap||tr>=2&&z>0.5)label(x,y-s-8,h.name,h.o!=='P'?'#f2b0a8':h.auto?hubCol(h):'#f1dca8',h.cap?13:11)}}
  if(selHex!=null){for(const k of ks){ctx.strokeStyle='#ffffff';ctx.lineWidth=2*px;hexPath(cxOf(selHex)+k,cyOf(selHex),S);ctx.stroke()}}
  // planned marches of the selection
  let np=0;for(const id of selUnits){const su=G.units.find(u=>u.id===id);if(!su||!su.dest||su.w!==curW||np++>8)continue;
    const rt=su.dest.w===curW?null:worldRoute(curW,su.dest.w,'P');const goal=su.dest.w===curW?su.dest.i:rt?portalBetween(curW,rt[1]):null;if(goal==null)continue;
    const ck=su.i+':'+goal;if(!pathCache[id]||pathCache[id].k!==ck)pathCache[id]={k:ck,p:aStar(su,curW,su.i,goal)||[]};
    ctx.strokeStyle='#ffffff';ctx.lineWidth=1.6*px;ctx.setLineDash([5*px,4*px]);for(const k of ks){ctx.beginPath();ctx.moveTo(cxOf(su.i)+k,cyOf(su.i));let prevx=cxOf(su.i);for(const t of pathCache[id].p){let x=cxOf(t);if(x-prevx>MAPW/2)x-=MAPW;if(prevx-x>MAPW/2)x+=MAPW;ctx.lineTo(x+k,cyOf(t));prevx=x}ctx.stroke()}ctx.setLineDash([])}
  // units
  const stacks=new Map();for(const u of G.units){if(u.w!==curW)continue;if(u.o!=='P'&&!isSeen(curW,u.i))continue;if(!stacks.has(u.i))stacks.set(u.i,[]);stacks.get(u.i).push(u)}
  for(const [i,us] of stacks){us.sort((a,b)=>(a.o===b.o?0:a.o==='P'?-1:1));const shown=us.slice(0,4);shown.forEach((u,n)=>{for(const k of ks){const x=cxOf(i)+k-1,y=cyOf(i)+5-n*6.5;if(!visible(x,y))continue;
    const c=u.o==='P'?(u.party?({caravan:'#e0c27a',retinue:COL.estate,exiles:COL.civ,adventurers:'#e8e3d3',pathfinders:'#e8e3d3'})[u.party.kind]:u.merc?COL.company:u.guard?COL.estate:u.co?COL.org:UT[u.type].scout?'#e8e3d3':COL.P):u.o==='M'?COL.M:COL.A;const w=17,hh=9;
    ctx.fillStyle='#0b1418';ctx.fillRect(x-w/2-1,y-hh/2-1,w+2,hh+3.5);ctx.fillStyle=c;ctx.fillRect(x-w/2,y-hh/2,w,hh);
    ctx.fillStyle='#0b1418';ctx.font=`700 6.4px "IBM Plex Mono",monospace`;ctx.fillText(UT[u.type].g,x,y+0.4);
    ctx.fillStyle=u.str>60?'#8fc37a':u.str>35?'#e0a548':'#d0574d';ctx.fillRect(x-w/2,y+hh/2+0.6,w*u.str/100,1.6);
    if(u.hold){ctx.fillStyle='#0b1418';ctx.fillRect(x+w/2-3,y-hh/2,3,3)}
    if(selUnits.has(u.id)){ctx.strokeStyle='#ffffff';ctx.lineWidth=1.4;ctx.strokeRect(x-w/2-2,y-hh/2-2,w+4,hh+6)}}});
    if(us.length>4)for(const k of ks)label(cxOf(i)+k+12,cyOf(i)-14,'+'+(us.length-4),'#ffffff',10)}
}
function poly(tiles,ks){for(const k of ks){ctx.beginPath();let px0=null;for(const t of tiles){let x=cxOf(t);if(px0!=null){if(x-px0>MAPW/2)x-=MAPW;if(px0-x>MAPW/2)x+=MAPW}if(px0==null)ctx.moveTo(x+k,cyOf(t));else ctx.lineTo(x+k,cyOf(t));px0=x}ctx.stroke()}}
function label(x,y,txt,col,size){const z=cam.z;const fs=size/z;ctx.font=`600 ${fs}px "Barlow Semi Condensed",sans-serif`;ctx.lineWidth=3/z;ctx.strokeStyle='rgba(8,12,14,0.9)';ctx.strokeText(txt,x,y);ctx.fillStyle=col;ctx.fillText(txt,x,y)}
function loop(){if(dirty)draw();requestAnimationFrame(loop)}

/* ================= INPUT ================= */
const ptrs=new Map();let drag=null,pinch=null,lpT=null,hoverRAF=0;
cv.addEventListener('pointerdown',e=>{closeCtx();if(e.button===2)return;cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.offsetX,y:e.offsetY});
  if(ptrs.size===1){drag={x:e.offsetX,y:e.offsetY,cx:cam.x,cy:cam.y,moved:false,shift:e.shiftKey||e.ctrlKey||e.metaKey};
    if(e.pointerType!=='mouse'){clearTimeout(lpT);const x=e.offsetX,y=e.offsetY,cx=e.clientX,cy=e.clientY;lpT=setTimeout(()=>{if(drag&&!drag.moved&&ptrs.size===1){drag.long=true;const i=pickHex(x,y);if(i!=null)rightClick(i,cx,cy)}},550)}}
  if(ptrs.size===2){clearTimeout(lpT);const [a,b]=[...ptrs.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),z:cam.z,mx:(a.x+b.x)/2,my:(a.y+b.y)/2};drag&&(drag.moved=true)}});
cv.addEventListener('pointermove',e=>{
  if(!ptrs.has(e.pointerId)){if(e.pointerType==='mouse'&&!e.buttons)hover(e);return}
  ptrs.set(e.pointerId,{x:e.offsetX,y:e.offsetY});
  if(pinch&&ptrs.size>=2){const [a,b]=[...ptrs.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);zoomAt(pinch.mx,pinch.my,pinch.z*d/pinch.d);return}
  if(drag){const dx=e.offsetX-drag.x,dy=e.offsetY-drag.y;if(Math.hypot(dx,dy)>6){drag.moved=true;clearTimeout(lpT);$('#tip').hidden=true}if(drag.moved){cam.x=drag.cx-dx/cam.z;cam.y=drag.cy-dy/cam.z;clampCam();dirty=true}}});
function up(e){clearTimeout(lpT);const had=ptrs.has(e.pointerId);ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=null;if(!had)return;
  if(drag&&!drag.moved&&!drag.long&&ptrs.size===0){const i=pickHex(e.offsetX,e.offsetY);if(i!=null)tapHex(i,drag.shift)}
  if(ptrs.size===0)drag=null;else{const p=[...ptrs.values()][0];drag={x:p.x,y:p.y,cx:cam.x,cy:cam.y,moved:true}}}
cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
cv.addEventListener('pointerleave',()=>{$('#tip').hidden=true});
cv.addEventListener('contextmenu',e=>{e.preventDefault();if(drag&&drag.long)return;const i=pickHex(e.offsetX,e.offsetY);if(i!=null)rightClick(i,e.clientX,e.clientY)});
cv.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.offsetX,e.offsetY,cam.z*Math.exp(-e.deltaY*0.0015))},{passive:false});
function zoomAt(sx,sy,nz){nz=Math.max(0.35,Math.min(4,nz));const wx=cam.x+sx/cam.z,wy=cam.y+sy/cam.z;cam.z=nz;cam.x=wx-sx/nz;cam.y=wy-sy/nz;clampCam();dirty=true}
function hover(e){if(hoverRAF)return;hoverRAF=requestAnimationFrame(()=>{hoverRAF=0;const i=pickHex(e.offsetX,e.offsetY);const tip=$('#tip');if(i==null){tip.hidden=true;return}
  const seen=isSeen(curW,i),h=hubAt(curW,i),pt=portalTo(curW,i);const us=G.units.filter(u=>u.w===curW&&u.i===i&&(u.o==='P'||seen));
  let t=seen?TER[tt(curW,i)]:'Unexplored';if(KNOWN.has(i))t+=' · '+depName(D[i]);
  if(h&&(h.o==='P'||seen))t+=`<br><b>${esc(h.name)}</b> · ${hubLabel(h)}${h.o==='P'?' · '+fmt(h.pop*1000):''}`;
  if(pt!=null&&seen)t+=`<br>Portal to ${G.disc[pt]?esc(G.worlds[pt].name):'an uncharted Earth'}${G.disc[pt]?' · double-click to go':''}`;
  if(us.length)t+=`<br>${us.length} force${us.length>1?'s':''}: ${esc(us.slice(0,3).map(u=>u.o==='P'?u.name:UT[u.type].n).join(', '))}${us.length>3?'…':''}`;
  if(selUnits.size&&[...selUnits].some(id=>movable(G.units.find(u=>u.id===id))))t+='<br><span class="mute">Right-click to march here</span>';
  tip.innerHTML=t;tip.hidden=false;const r=cv.getBoundingClientRect();tip.style.left=Math.min(r.width-230,e.offsetX+16)+'px';tip.style.top=(e.offsetY+18)+'px'})}

/* ================= SELECTION & ORDERS ================= */
function selectOnly(id){selUnits.clear();if(id!=null)selUnits.add(id);selUnit=id}
function orderMove(us,w,i){let worst=null;for(const u of us){u.dest={w,i};u.hold=false;if(u.auto)u.auto=null;delete pathCache[u.id]}
  for(const u of us){const tp=travelPlan(u);if(!tp){worst=null;break}if(!worst||tp.quarters>worst.quarters)worst=tp}
  const who=us.length>1?`${us.length} regiments`:us[0].name;
  toast(worst?`${esc(who)} set out for ${fmtLL(i)}: ${fmt(worst.miles)} miles${worst.crossings?`, ${worst.crossings} portal${worst.crossings>1?'s':''}`:''}, about ${worst.quarters} quarter${worst.quarters>1?'s':''}.`:`${esc(who)} ${us.length>1?'have':'has'} no known route there. Overseas destinations need a harbor with ships to embark from.`);
  refresh()}
function tapHex(i,add){
  closeCtx();
  if(mode==='airlift'){const u=G.units.find(u=>u.id===selUnit);mode=null;$('#mode').hidden=true;const h=hubAt(curW,i);
    if(!u||!h||h.o!=='P'||!R.net.has(key(curW,i)))toast('Airlifts land only at your hubs connected to the capital.');else if(G.gold<25)toast('Not enough gold.');else{G.gold-=25;u.air={w:curW,i};u.dest=null;toast(`${esc(u.name)} will be flown to ${esc(h.name)} this quarter.`)}
    selHex=i;refresh();return}
  if(mode==='tmove'){const h=G.hubs.find(x=>x.id===tmoveHub);mode=null;$('#mode').hidden=true;
    if(h){if(!T[i])toast('Traction cities cannot cross water.');else{h.dest={w:curW,i};toast(`${esc(h.name)} will roll toward ${fmtLL(i)}, about three hexes a quarter.`)}}
    selHex=i;refresh();return}
  if(mode==='move'){mode=null;$('#mode').hidden=true;const us=[...selUnits].map(id=>G.units.find(u=>u.id===id)).filter(movable);if(us.length)orderMove(us,curW,i);selHex=i;refresh();return}
  // double-click a portal to step through to its Earth
  const now=Date.now();const pt=portalTo(curW,i);
  if(lastTap&&lastTap.i===i&&lastTap.w===curW&&now-lastTap.t<400&&pt!=null&&isSeen(curW,i)){lastTap=null;
    if(G.disc[pt]){const keep=cam.z;setWorld(pt,i);cam.z=keep;centerOn(i);toast(`${esc(G.worlds[pt].name)}: ${SEASONS[seasonAt(pt,i)]}, ${hourStr(pt)} local time.`,2000)}else toast('That portal leads somewhere uncharted. Send explorers or a regiment through it first.');return}
  lastTap={i,w:curW,t:now};
  if(plan){plan=null}
  const mine=G.units.filter(u=>u.o==='P'&&u.w===curW&&u.i===i);
  if(add){for(const u of mine.filter(movable)){if(selUnits.has(u.id))selUnits.delete(u.id);else selUnits.add(u.id)}selUnit=[...selUnits][0]??null}
  else if(mine.length){const k=mine.findIndex(u=>u.id===selUnit);selectOnly((selHex===i&&k>=0)?mine[(k+1)%mine.length].id:mine[0].id)}else selectOnly(null);
  selHex=i;tab='hex';openSheet(true);refresh();
}
function rightClick(i,cx,cy){const us=[...selUnits].map(id=>G.units.find(u=>u.id===id)).filter(movable);
  if(us.length){orderMove(us,curW,i);return}openCtx(i,cx,cy)}
function openCtx(i,cx,cy){selHex=i;const items=[];const t=T[i],own=G.inf[key(curW,i)],h=hubAt(curW,i),pt=portalTo(curW,i),seen=isSeen(curW,i);
  if(pt!=null&&seen)items.push(G.disc[pt]?[`Go to ${G.worlds[pt].name}`,'goworld',{w:pt}]:['Portal to an uncharted Earth',null]);
  if(h&&(h.o==='P'||seen))items.push([`Open ${h.name}`,'openhex']);
  if(t&&!own&&allowed('P',curW,i)&&tt(curW,i)!==8&&hasLines(curW))items.push(['Survey a supply line to here · depot at the end works 1 hex','plan',{r:1}]);
  if(own==='P'&&t&&!h)items.push(['Found a depot · 40g · works 1 hex around','depot',{r:1}]);
  const eta=expEta(curW,i);if(eta!=null){items.push([`Surveyors · 40g · ~${eta+1} qtrs · chart all deposits within 6 hexes`,'expat',{f:'survey',r:6}]);items.push([`Prospectors · 70g · ~${eta+2} qtrs · find the nearest strange deposit, any distance`,'expat',{f:'prospect',p:1}])}
  const sc=G.units.filter(u=>u.o==='P'&&u.w===curW&&UT[u.type].scout);if(sc.length&&t)items.push(['Send nearest explorers here','scoutgo']);
  const here=G.units.filter(u=>u.w===curW&&u.i===i&&movable(u));if(here.length)items.push([`Select ${here.length} regiment${here.length>1?'s':''} here`,'selall']);
  items.push(['Center map here','center']);
  const m=$('#ctx');m.innerHTML=`<div class="ctx-h">${seen?TER[tt(curW,i)]:'Unexplored'} · ${fmtLL(i)}</div>`+items.map(([l,a,d])=>a?`<button data-act="${a}"${d?Object.entries(d).map(([k,v])=>` data-${k}="${v}"`).join(''):''}>${esc(l)}</button>`:`<div class="ctx-n">${esc(l)}</div>`).join('');
  m.hidden=false;const ar=$('#app').getBoundingClientRect();m.style.left=Math.min(ar.width-240,Math.max(8,cx-ar.left))+'px';m.style.top=Math.min(ar.height-m.offsetHeight-8,Math.max(8,cy-ar.top))+'px';dirty=true}
function closeCtx(){const m=$('#ctx');if(m&&!m.hidden)m.hidden=true;if(ctxPrev){ctxPrev=null;dirty=true}}
function nextIdle(){const ids=idleUnits();if(!ids.length){toast('Every regiment has orders.');return}
  const k=ids.findIndex(u=>u.id===selUnit);const u=ids[(k+1)%ids.length];if(u.w!==curW){curW=u.w;plan=null}selectOnly(u.id);selHex=u.i;centerOn(u.i);tab='hex';openSheet(true);refresh()}

/* ================= PANELS ================= */
const fmt=n=>Math.round(n).toLocaleString('en-US');
const pct=n=>Math.round(n*100)+'%';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function bar(v,cls){return `<span class="bar ${cls||''}"><i style="width:${Math.max(0,Math.min(100,v*100))}%"></i></span>`}
function refresh(){G.secured=(R=econ('P')).secured;terrV++;renderHud();renderBody();dirty=true;save()}
function renderHud(){
  const sup=R.sup;$('#h-realm').textContent=G.realm;$('#h-date').textContent=dateStr();
  const net=R.income-R.upkeep-Math.min(G.research.budget,Math.max(0,G.gold))-G.orgs.reduce((s,o)=>s+o.fund+(o.toll||0),0);
  $('#h-gold').innerHTML=`${fmt(G.gold)} <small class="${net>=0?'pos':'neg'}">${net>=0?'+':''}${fmt(net)}</small>`;
  $('#h-sup').innerHTML=`<b class="${sup>=0.95?'pos':sup>=0.7?'warn':'neg'}">${pct(sup)}</b>`;
  $('#h-load').textContent=`${fmt(R.load)} / ${fmt(R.cap)}`;
  const W0=G.worlds[curW];$('#h-world').textContent=W0.name+(W0.weird?' · fractured':'');
  $('#h-local').textContent=curW===0?'':`Here: ${SEASONS[seasonAt(curW)]}, ${hourStr(curW)} when it is noon in Varenne${W0.storm?` · ${W0.stormName} raging`:''}`;
  const idle=idleUnits().length,free=crewsMax()-crownCrews(),asks=G.petitions.length+G.orgs.filter(o=>o.demand).length;
  const parts=[];if(idle)parts.push(`<button class="chipbtn" data-hud="idle" title="N">${idle} idle</button>`);if(free>0)parts.push(`<button class="chipbtn" data-hud="crews">${free} crew${free>1?'s':''} free</button>`);if(asks)parts.push(`<button class="chipbtn" data-hud="asks">${asks} request${asks>1?'s':''}</button>`);
  $('#h-todo').innerHTML=parts.join('');
}
function openSheet(v){sheetOpen=v;$('#sheet').classList.toggle('open',v);for(const b of document.querySelectorAll('#tabs button'))b.classList.toggle('on',b.dataset.tab===tab&&v);dirty=true}
function renderBody(){
  const body=$('#body');const st=body.scrollTop;
  for(const b of document.querySelectorAll('#tabs button'))b.classList.toggle('on',b.dataset.tab===tab&&sheetOpen);
  body.innerHTML=({hex:hexTab,realm:realmTab,court:courtTab,research:researchTab,orgs:orgTab,worlds:worldTab,log:logTab}[tab])();
  body.scrollTop=st;
}
function unitCard(u){const ut=UT[u.type];const s=R.units.get(u.id)||{sup:false};
  const where=u.w===curW?fmtLL(u.i):`${fmtLL(u.i)}, ${G.worlds[u.w].name}`;
  const tp=u.dest?travelPlan(u):null;
  const dest=u.air?`Airlifting to ${fmtLL(u.air.i)} on ${G.worlds[u.air.w].name} this quarter.`:u.dest?`Marching to ${fmtLL(u.dest.i)}${u.dest.w!==u.w?' on '+G.worlds[u.dest.w].name:''}.${tp?` ${fmt(tp.miles)} miles${tp.crossings?`, ${tp.crossings} portal crossing${tp.crossings>1?'s':''}`:''}, about ${tp.quarters} quarter${tp.quarters>1?'s':''}.`:' No known route yet.'}`:u.hold?'Holding position until ordered.':'Awaiting orders.';
  const house=u.guard&&G.nobles.find(n=>n.id===u.guard);
  const corg=u.co&&G.orgs.find(o=>o.id===u.co);const kind=u.party?PARTY[u.party.kind].n:u.corps?'Royal pathfinders':u.merc?'Free company':u.guard?'Household guard':u.co?'Company troops':ut.scout?'Explorers':'Regiment';
  const onPortal=portalTo(u.w,u.i);const hub=hubAt(u.w,u.i);
  const canAir=movable(u)&&G.research.logi>=5&&hub&&hub.o==='P'&&R.net.has(key(u.w,u.i));
  const supTxt=u.party||u.corps?'Carries its own supplies':u.co?'Fed and paid by the company':u.merc?`Feeds itself · ${u.merc.turns} quarters left on contract`:u.guard?'Fed by its house estates':ut.scout?'Lives off the land':s.sup?`On your lines, ${Math.round(s.d)} hexes of haulage`:'<span class="neg">Cut off: loses strength each quarter</span>';
  const pq=u.party?partyEta(u):null;const pdest=u.party?u.party.dest:null;
  const note=u.party?`Bound for ${fmtLL(pdest.i)} on ${esc(G.worlds[pdest.w].name)}${pq?`, about ${pq} quarter${pq>1?'s':''} away`:', looking for a road'}. Travels on its own${u.party.trail>0?`, cutting trail where it meets your lines (${u.party.trail} hexes left)`:''}.${u.party.laid?` Has laid ${u.party.laid} hexes so far.`:''}`:u.corps?`${esc(u.status||'Exploring.')} Answers to the Survey Corps.`:u.co?`${esc(corg?corg.name:'')}. ${esc(u.status||'On patrol.')} Paid by the company and answers to its directors.`:u.merc?esc(u.status||'Chooses its own fights.'):u.guard?`${esc(house?house.name:'')}. ${esc(u.status||'Guards the house lands.')} Answers to its lord, not to you.`:u.auto==='explore'?esc(u.status||'Exploring.'):dest;
  const stack=G.units.filter(x=>x.w===u.w&&x.i===u.i&&movable(x));
  let acts='';
  if(u.co||u.party||u.corps)acts='';
  else if(u.merc)acts=`<div class="acts"><button data-act="companytown">Stop and build a company town</button></div>`;
  else if(!u.guard)acts=`<div class="acts"><button class="pri" data-act="march">March <kbd>M</kbd></button>${onPortal!=null?`<button data-act="transit">Cross portal → ${G.disc[onPortal]?esc(G.worlds[onPortal].name.replace('Earth ','')):'unknown'}</button>`:''}${ut.scout?`<button data-act="explore">${u.auto==='explore'?'Stop exploring':'Explore automatically'} <kbd>E</kbd></button>`:`<button data-act="hold">${u.hold?'Stop holding':'Hold position'} <kbd>F</kbd></button>`}${canAir?'<button data-act="airlift">Airlift · 25g</button>':''}${u.dest||u.air?'<button data-act="halt">Halt</button>':''}${stack.length>1&&selUnits.size<stack.length?`<button data-act="selall">Select all ${stack.length} here</button>`:''}<button class="ghost" data-act="disband">Disband</button></div>`;
  const multi=selUnits.size>1?`<p class="note">${selUnits.size} units selected. Right-click a hex (long-press on touch) to send them all.</p>`:'';
  return `<div class="card sel"><div class="row"><div><div class="eyebrow">${kind}${u.party?'':' · '+ut.n}</div><h3>${esc(u.name)}</h3></div><div class="num">${Math.round(u.str)}%</div></div>
  ${bar(u.str/100,u.str>60?'g':u.str>35?'w':'b')}
  <dl class="kv"><dt>Location</dt><dd>${where}</dd><dt>Travel</dt><dd>${travelMode(u)}</dd><dt>Attack / Defense</dt><dd class="mono">${ut.atk} / ${ut.def}</dd><dt>Supply</dt><dd>${supTxt}</dd></dl>
  <p class="note">${note}</p>${multi}${acts}</div>`}
function hexTab(){
  let out='';const su=G.units.find(u=>u.id===selUnit);
  if(su&&su.o==='P')out+=unitCard(su);
  if(selHex==null)return out+`<div class="empty"><h3>Tap a hex</h3><p>Click to select; right-click (or long-press) for orders. Drag to pan, scroll or pinch to zoom, double-click a portal to step through it. Keys: <kbd>N</kbd> next idle unit, <kbd>M</kbd> march, <kbd>F</kbd> hold, <kbd>H</kbd> capital, <kbd>Enter</kbd> end quarter.</p></div>`;
  const i=selHex,w=curW,t=T[i],k=key(w,i),own=G.inf[k],h=hubAt(w,i),pt=portalTo(w,i),seen=isSeen(w,i),ter=tt(w,i);
  if(!seen){out+=`<div class="card"><div class="eyebrow">${G.worlds[w].name} · ${fmtLL(i)}</div><h3>Unexplored</h3><p class="note">Your maps show the shape of the land, copied from Earth Prime, but nobody from your realm has seen what is here on ${esc(G.worlds[w].name)}. Send explorers, or right-click for an expedition.</p>
    ${KNOWN.has(i)?`<dl class="kv"><dt>Charted deposit</dt><dd>${depName(D[i])}</dd></dl>`:''}<div class="acts">${G.units.some(u=>u.o==='P'&&u.w===w&&UT[u.type].scout)?'<button data-act="scoutgo">Send nearest explorers</button>':''}</div></div>`;return out}
  out+=`<div class="card"><div class="eyebrow">${G.worlds[w].name} · ${fmtLL(i)} · ${t?CONTS[CONT[i]]:'Sea'}</div><h3>${TER[ter]}${pt!=null?' · portal':''}</h3><dl class="kv">`;
  if(KNOWN.has(i))out+=`<dt>Deposit</dt><dd><span class="dot" style="background:${DEP[D[i]].col}"></span>${depName(D[i])}${DEP[D[i]].gold?` · ${DEP[D[i]].gold} gold`:''}${DEP[D[i]].strange&&!G.unlocked[D[i]]?' · unknown nature':''}</dd>`;
  else if(t)out+=`<dt>Deposit</dt><dd class="mute">None charted</dd>`;
  out+=`<dt>Season</dt><dd>${SEASONS[seasonAt(w,i)]}${winterAt(w,i)?' · slows marches and farms':''}${G.worlds[w].storm?' · '+G.worlds[w].stormName:''}</dd>`;
  if(pt!=null)out+=`<dt>Portal</dt><dd>to ${G.disc[pt]?esc(G.worlds[pt].name):'an uncharted Earth'} · ${SEASONS[seasonAt(pt,i)]}, ${hourStr(pt)} there</dd><dt>Chokepoint</dt><dd>Defenders +50%, troops just through −25%</dd>`;
  if(ter===8)out+=`<dt>Rift</dt><dd>Impassable. Nothing can be built across it.</dd>`;
  else if(t)out+=`<dt>Lay line</dt><dd class="mono">${Math.round(ROADC[ter]*roadMul('P',w))} gold, ${BW[ter]} work per hex</dd>`;
  if(own&&(own==='P'||seen))out+=`<dt>Holder</dt><dd>${own==='P'?esc(G.realm):esc(G.rival)}</dd>`;
  out+='</dl>';
  if(pt!=null&&G.disc[pt])out+=`<div class="acts"><button data-act="goworld" data-w="${pt}" data-i="${i}">Step through to ${esc(G.worlds[pt].name)}</button></div>`;
  out+='</div>';
  if(h){const hi=R.hubs.find(x=>x.h===h);const org=h.org&&G.orgs.find(o=>o.id===h.org);const nob=h.noble&&G.nobles.find(n=>n.id===h.noble);
    const who=h.o!=='P'?esc(G.rival):org?esc(org.name):h.kind==='civ'?esc(h.group)+' · self-governing':h.kind==='company'?esc(h.group||'Free company'):h.kind==='estate'?esc(nob?nob.name:'Noble'):esc(G.realm);
    out+=`<div class="card"><div class="eyebrow">${who} · ${hubLabel(h)}${h.cap?' · capital':''}</div><h3>${esc(h.name)}</h3><dl class="kv"><dt>Population</dt><dd class="mono">${fmt(h.pop*1000)} souls</dd>`;
    if(h.o==='P'&&hi){
      out+=`<dt>Food</dt><dd class="mono">grows ${hi.prod.toFixed(1)} · eats ${h.pop.toFixed(1)}${h.auto?'':` <span class="${hi.def>0?'neg':'pos'}">${hi.def>0?'needs '+hi.def.toFixed(1)+' hauled in':'+'+hi.sur.toFixed(1)+' spare'}</span>`}</dd>`;
      if(h.kind==='civ')out+=`<dt>Crown's share</dt><dd class="mono">${(h.pop*0.15).toFixed(1)} gold tax</dd><dt>Status</dt><dd>${hi.conn?'Sells spare grain into your lines':'Off your military lines; looks after itself'}</dd>`;
      else if(h.kind==='estate')out+=`<dt>Crown's share</dt><dd class="mono">${(h.pop*0.1).toFixed(1)} gold tax</dd>`;
      else if(h.kind==='company')out+=`<dt>Taxes</dt><dd>None. Free companies hire here at 30% off.</dd><dt>Network</dt><dd>${hi.conn?'Serves as a hub on your lines':'Off your lines'}</dd>`;
      else if(h.mobile)out+=`<dt>Moving city</dt><dd>${h.dest?'Rolling to '+fmtLL(h.dest.i):'Parked'} · feeds itself and supplies regiments within 2 hexes</dd>`;
      else out+=`<dt>Network</dt><dd>${hi.conn?`Connected, ${Math.round(hi.d)} hexes of haulage from ${esc(G.hubs.find(x=>x.cap&&x.o==='P').name)}`:'<span class="neg">Cut off from the capital</span>'}</dd>`;
      const nx=h.pop<3?3:h.pop<10?10:h.pop<30?30:h.pop<80?80:null;
      out+=`<dt>Works the land</dt><dd>${crad(h)} hex radius, about ${fmt(crad(h)*MILES)} miles${nx&&!h.mobile?` · grows at ${fmt(nx*1000)} souls`:''}</dd>${h.port?`<dt>Harbor</dt><dd>${shipsEff('P',h.w)>0?`Linked by sea to your harbors on the same water · ${G.ships[h.w]||0} ships on this Earth`:'<span class="warn">No ships on this Earth. Commission ships before laying sea routes.</span>'}</dd>`:''}`}
    out+='</dl>';
    if(h.o==='P'&&!h.auto){const types=availUnits('P').filter(k=>tier(h)>=1||h.cap||k==='levy'||UT[k].scout);
      out+=`<div class="acts col"><label class="lab" for="raise-type">Raise here</label><div class="inline"><select id="raise-type">${types.map(k=>`<option value="${k}">${UT[k].n} · ${unitCost(k,'P')}g</option>`).join('')}</select><button class="pri" data-act="raise">Raise</button></div>
      ${tier(h)>=1||h.cap?`<button data-act="merc">Hire a free company · ${mercCost(h)}g</button>`:''}</div>`}
    if(h.o==='P'&&h.kind==='company')out+=`<div class="acts"><button class="pri" data-act="merc">Hire a free company · ${mercCost(h)}g</button></div>`;
    if(h.o==='P'){const coast=around(h.i,1).some(t=>!T[t]);const busy=G.projects.some(p=>p.o==='P'&&p.goal===h.i&&p.steps.length===1);let a='';
      if(coast&&!h.port&&!h.mobile&&R.net.has(key(h.w,h.i)))a+=busy?'<span class="note">Harbor under construction.</span>':`<button data-act="harbor"${crownCrews()<crewsMax()?'':' disabled'}>Build harbor · ${PORTC}g · ${Math.ceil(PORTW/RATE[G.research.logi])} quarter${Math.ceil(PORTW/RATE[G.research.logi])>1?'s':''}</button>`;
      if(!h.auto&&!h.mobile&&tier(h)>=2&&tractionOK())a+=`<button data-act="traction">Build traction city · 400g</button>`;
      if(h.port&&!h.mobile)a+=`<button data-act="ship">Commission a ship · 40g (${G.ships[h.w]||0} here)</button>`;
      if(h.mobile)a+=`<button class="pri" data-act="tmove">Order city to move</button>${h.dest?'<button data-act="thalt">Halt</button>':''}`;
      if(a)out+=`<div class="acts">${a}</div>`}
    out+='</div>'}
  else if(own==='P'&&t){out+=`<div class="card"><h3>Your line</h3><p class="note">A depot here becomes a supply hub that works the land around it. Its reach grows as its population does.</p><div class="acts"><button class="pri" data-act="depot">Found depot · 40g</button></div></div>`}
  else if(!own&&!t)out+=`<div class="card"><h3>Open sea</h3><p class="note">Regiments board ships at your harbors and can land on any coast of the same water. Lines cross water only from a harbor of yours with ships on this Earth; your crews build the landing harbor on the far shore.</p></div>`;
  else if(!own&&ter!==8&&allowed('P',w,i)){
    if(plan&&plan.w===w&&plan.goal===i){const nh=plan.steps.filter(x=>x.t==='hex').length,np=plan.steps.filter(x=>x.t==='port').length,ns=plan.steps.filter(x=>x.t==='sail');const seaMi=ns.reduce((a,x)=>a+x.tiles.length-2,0)*MILES;
      const free=crewsMax()-crownCrews();const rate=RATE[G.research.logi];const crews=Math.max(1,Math.min(free,planCrews));
      out+=`<div class="card"><div class="eyebrow">Survey report</div><h3>Line to ${fmtLL(i)}</h3><dl class="kv"><dt>Overland</dt><dd class="mono">${nh} hexes · ${fmt(nh*MILES)} mi</dd>${np?`<dt>Harbors</dt><dd class="mono">${np} to build</dd>`:''}${ns.length?`<dt>By sea</dt><dd class="mono">${fmt(seaMi)} mi</dd>`:''}<dt>Gold</dt><dd class="mono">${fmt(plan.cost)} as it is laid</dd><dt>Work</dt><dd class="mono">${plan.work.toFixed(1)} crew-quarters at ${LOGI[G.research.logi].toLowerCase()} pace</dd></dl>
      ${free>0?`<label class="lab" for="plan-crews">Crews (${free} free of ${crewsMax()})</label><select id="plan-crews">${Array.from({length:free},(_,k)=>`<option value="${k+1}"${k+1===crews?' selected':''}>${k+1} crew${k?'s':''} · about ${Math.ceil(plan.work/(rate*(k+1)))} quarters (${(Math.ceil(plan.work/(rate*(k+1)))/4).toFixed(1)} years)</option>`).join('')}</select>`:'<p class="note neg">All crown crews are busy. Finish or stop a project on the Realm tab, or research better logistics for more crews.</p>'}
      <p class="note">Crews lay the line hex by hex. Gold is spent as each hex is finished; work pauses if the treasury runs dry. A depot is founded at the end.</p>
      <div class="acts"><button class="pri" data-act="build"${free>0?'':' disabled'}>Begin construction</button><button class="ghost" data-act="cancelplan">Cancel</button></div></div>`}
    else out+=`<div class="card"><h3>Unclaimed ${TER[ter].toLowerCase()}</h3><p class="note">Survey the cheapest route from your nearest line on this Earth. Crossing water needs a harbor of yours with ships.</p><div class="acts"><button class="pri" data-act="plan">Survey a line to here</button></div></div>`}
  else if(!allowed('P',w,i))out+=`<div class="card"><h3>Foreign realms</h3><p class="note">${w===0?'Other kingdoms hold this land on Earth Prime. Your realm can only build within its own march.':'The '+esc(G.rival)+'’s homeland. Only its own march can be built on.'}</p></div>`;
  const here=G.units.filter(u=>u.w===w&&u.i===i&&u.id!==selUnit&&(u.o==='P'||seen));
  if(here.length)out+=`<div class="card"><div class="eyebrow">Forces in this hex</div>${here.map(u=>`<div class="urow"><span class="chip ${u.o==='P'?(u.merc?'m':u.guard?'g':u.co?'c':'p'):u.o==='M'?'x':'a'}">${UT[u.type].g}</span><span class="grow">${u.o==='P'?esc(u.name):u.o==='M'?UT[u.type].n:'Concordance '+UT[u.type].n}</span><span class="mono">${Math.round(u.str)}%</span>${u.o==='P'?`<button class="sm" data-act="selunit" data-id="${u.id}">Select</button>`:''}</div>`).join('')}</div>`;
  return out;
}
function holdingsCard(){
  const by={};for(const hi of R.hubs){const h=hi.h;if(h.o!=='P')continue;const b=by[h.w]||(by[h.w]={n:0,pop:0,food:0,works:0,cut:0});b.n++;b.pop+=h.pop;b.food+=hi.prod-h.pop;if(h.kind==='works')b.works++;if(!h.auto&&!h.mobile&&!hi.conn)b.cut++}
  const rows=Object.keys(by).map(Number).sort((a,b)=>by[b].pop-by[a].pop).map(w=>{const b=by[w];return `<tr><td><button class="link" data-act="goworld" data-w="${w}">${esc(G.worlds[w].name.replace('Earth ',''))}</button></td><td class="mono">${b.n}</td><td class="mono">${fmt(b.pop*1000)}</td><td class="mono ${b.food<0?'neg':'pos'}">${b.food>=0?'+':''}${b.food.toFixed(0)}</td><td class="mono">${b.works}</td><td class="mono ${b.cut?'neg':''}">${b.cut||''}</td></tr>`}).join('');
  const sortK=holdingsCard.k||'pop';const towns=G.hubs.filter(h=>h.o==='P').sort((a,b)=>sortK==='name'?a.name.localeCompare(b.name):sortK==='earth'?a.w-b.w||b.pop-a.pop:b.pop-a.pop);const lim=holdingsCard.all?towns.length:12;
  return `<div class="card"><div class="eyebrow">Holdings by Earth</div><div class="tbl"><table><thead><tr><th>Earth</th><th>Hubs</th><th>Souls</th><th>Food</th><th>Works</th><th>Cut off</th></tr></thead><tbody>${rows}</tbody></table></div></div>
  <div class="card"><div class="row"><div class="eyebrow">Towns · ${towns.length}</div><div class="seg"><button class="sm${sortK==='pop'?' on':''}" data-act="tsort" data-k="pop">Size</button><button class="sm${sortK==='earth'?' on':''}" data-act="tsort" data-k="earth">Earth</button><button class="sm${sortK==='name'?' on':''}" data-act="tsort" data-k="name">Name</button></div></div>
  ${towns.slice(0,lim).map(h=>`<div class="urow"><span class="dot" style="background:${hubCol(h)}"></span><span class="grow">${esc(h.name)} <span class="mute sm">· ${hubLabel(h)}</span></span><span class="mono sm">${esc(G.worlds[h.w].name.replace('Earth ',''))} · ${fmt(h.pop*1000)}</span><button class="sm" data-act="viewsite" data-w="${h.w}" data-i="${h.i}">Go</button></div>`).join('')}
  ${towns.length>12?`<div class="acts"><button class="ghost sm" data-act="tall">${holdingsCard.all?'Show fewer':'Show all '+towns.length}</button></div>`:''}</div>`}
function roadCard(){const ps=G.units.filter(u=>u.o==='P'&&(u.party||u.corps));if(!ps.length)return '';
  return `<div class="card"><div class="eyebrow">On the road · ${ps.length}</div><p class="note">Caravans, retinues, emigrants, adventurers and pathfinders travel on their own and cut short stretches of trail off your lines as they go.</p>${ps.map(u=>{const k=u.party?PARTY[u.party.kind].n:'Pathfinders';const d=u.party?u.party.dest:null;const q=u.party?partyEta(u):null;
    return `<div class="urow"><span class="chip p">${UT[u.type].g}</span><span class="grow">${esc(u.name)} <span class="mute sm">· ${k}${d?` → ${esc(G.worlds[d.w].name.replace('Earth ',''))}${q?' · '+q+'q':''}`:' · exploring '+esc(G.worlds[u.w].name.replace('Earth ',''))}</span></span><button class="sm" data-act="viewsite" data-w="${u.w}" data-i="${u.i}">Go</button></div>`}).join('')}</div>`}
function realmTab(){
  let miles=0;for(const k in G.inf)if(G.inf[k]==='P')miles+=MILES;
  return holdingsCard()+roadCard()+constructionCard()+`<div class="card"><div class="eyebrow">Realm · ${feudal()?'Feudal monarchy':'Absolute monarchy'}</div><label class="lab" for="realm-name">Name</label><input id="realm-name" value="${esc(G.realm)}" maxlength="40">
  <dl class="kv"><dt>Population</dt><dd class="mono">${fmt(G.hubs.filter(h=>h.o==='P').reduce((s,h)=>s+h.pop,0)*1000)}</dd><dt>Regiments</dt><dd class="mono">${G.units.filter(u=>movable(u)).length} + ${G.units.filter(u=>u.merc).length} free cos. + ${G.units.filter(u=>u.guard).length} guards</dd><dt>Lines laid</dt><dd class="mono">${fmt(miles)} miles</dd><dt>Earths charted</dt><dd class="mono">${G.disc.filter(Boolean).length} of ?</dd></dl></div>
  <div class="card"><div class="eyebrow">Military logistics this quarter</div>
  <div class="meter"><span>Supply delivered</span><b class="${R.sup>=0.95?'pos':R.sup>=0.7?'warn':'neg'}">${pct(R.sup)}</b></div>${bar(R.sup,R.sup>=0.95?'g':R.sup>=0.7?'w':'b')}
  <dl class="kv"><dt>Food spare at farms</dt><dd class="mono">${R.surplus.toFixed(1)}</dd><dt>Food needed elsewhere</dt><dd class="mono">${R.demand.toFixed(1)}</dd><dt>Haulage load / capacity</dt><dd class="mono">${fmt(R.load)} / ${fmt(R.cap)}</dd><dt>Reach before costs double</dt><dd class="mono">${R.reach} hexes</dd><dt>Portal crossing</dt><dd class="mono">${R.pf} hexes of haulage</dd></dl></div>
  <div class="card"><div class="eyebrow">Treasury</div><dl class="kv"><dt>Crown taxes</dt><dd class="mono">+${fmt(R.tax-R.civTax)}</dd><dt>Free towns and estates</dt><dd class="mono">+${fmt(R.civTax)}</dd><dt>Mines and deposits</dt><dd class="mono">+${fmt(R.dep)}</dd><dt>Regiment upkeep</dt><dd class="mono">−${fmt(R.upkeep)}</dd><dt>Research grants</dt><dd class="mono">−${fmt(G.research.budget)}</dd><dt>Company funding</dt><dd class="mono">−${fmt(G.orgs.reduce((s,o)=>s+o.fund,0))}</dd>${G.orgs.some(o=>o.toll)?`<dt>Company tolls</dt><dd class="mono neg">−${fmt(G.orgs.reduce((s,o)=>s+(o.toll||0),0))}</dd>`:''}</dl></div>
  <div class="card"><div class="eyebrow">Secured resources</div>${[...R.secured].map(k=>`<div class="urow"><span class="dot" style="background:${DEP[k].col}"></span><span class="grow">${depName(k)}</span><span class="mute sm">${DEP[k].bonus||(DEP[k].strange?(G.unlocked[k]?'Studied':'Unstudied'):DEP[k].gold?DEP[k].gold+' gold each':'Food')}</span></div>`).join('')||'<p class="note">None yet. Any deposit inside a hub’s worked land is secured.</p>'}</div>
  <div class="card"><div class="acts"><button class="ghost ${confirmNew?'danger':''}" data-act="newgame">${confirmNew?'Tap again to abandon this campaign':'New campaign'}</button></div></div>`}
const FIELDS=['arms','logi','agri','arc'];
function setAlloc(f,v){const al=G.research.alloc;v=Math.max(0,Math.min(100,Math.round(v)));const others=FIELDS.filter(x=>x!==f);const rest=100-v;const sum=others.reduce((s,x)=>s+al[x],0);
  al[f]=v;if(sum<=0)others.forEach(x=>al[x]=rest/3);else others.forEach(x=>al[x]=al[x]*rest/sum);
  let r=others.map(x=>al[x]=Math.round(al[x]));const diff=100-v-r.reduce((a,b)=>a+b,0);if(diff){const big=others.reduce((a,b)=>al[a]>=al[b]?a:b);al[big]+=diff}
  for(const x of FIELDS){const el=document.getElementById('r-'+x),o=document.getElementById('r-'+x+'-o');if(el&&x!==f)el.value=al[x];if(o)o.textContent=al[x]+'%'}}
function researchTab(){const r=G.research,al=r.alloc;const cal=1212+G.turn/4;
  const sl=(id,lbl,v,max,unit)=>`<div class="slider"><label for="${id}">${lbl}</label><input type="range" id="${id}" min="0" max="${max||100}" value="${v}"><output id="${id}-o" class="mono">${v}${unit||''}</output></div>`;
  const track=(name,f,lv,Y,names)=>{const yr=r.year[f],rate=r.rate[f]||0.25,nx=lv<Y.length-1?Y[lv+1]:null;
    return `<div class="track"><div class="row"><b>${name}</b><span class="mono">practice of ${Math.floor(yr)}</span></div>${bar(nx?(yr-Y[lv])/(nx-Y[lv]):1)}<div class="row sm"><span>${names[lv]}</span><span class="mute">${nx?`next breakthrough ~${Math.ceil((nx-yr)/rate)} quarters`:'Complete'}</span></div><div class="sm mute">${rate.toFixed(1)} years of progress per quarter</div></div>`};
  const sec=new Set(R.secTiles.map(s=>s.k));
  const strange=STRANGE.filter(k=>sec.has(k)||r.studies[k]);
  const g=r.budget;const share=f=>Math.round(g*al[f]/100);
  return `<div class="card"><div class="eyebrow">Grants · calendar year ${Math.floor(cal)}</div>${sl('r-budget','Gold to researchers each quarter',r.budget,400)}
  <p class="note">Unfunded, your realm advances with history, reaching each breakthrough in its real year. Grants speed this up with diminishing returns. The four shares always add up to 100%.</p>
  <div class="split">${FIELDS.map(f=>`<i style="flex:${al[f]||0.001}" class="f-${f}"></i>`).join('')}</div>
  ${sl('r-arms',`Arms & doctrine · ${share('arms')}g`,al.arms,100,'%')}${sl('r-logi',`Logistics & transport · ${share('logi')}g`,al.logi,100,'%')}${sl('r-agri',`Agriculture · ${share('agri')}g`,al.agri,100,'%')}${sl('r-arc',`Strange studies · ${share('arc')}g`,al.arc,100,'%')}</div>
  <div class="card"><div class="eyebrow">Progress</div>${track('Doctrine','arms',r.era,ERA_Y,ERAS)}${track('Logistics','logi',r.logi,LOGI_Y,LOGI)}${track('Agriculture','agri',r.agri,AGRI_Y,AGRI)}<p class="note">${LOGI_TXT[r.logi]}</p></div>
  <div class="card"><div class="eyebrow">Strange materials · ${Math.floor(r.arcPool)} study points banked</div>${strange.length?strange.map(k=>{const s=r.studies[k];const done=G.unlocked[k];return `<div class="track"><div class="row"><b><span class="dot" style="background:${DEP[k].col}"></span>${depName(k)}</b>${done?'<span class="pos sm">Mastered</span>':s?`<span class="mono">${Math.floor(s.prog)} / ${STUDY_NEED[k]}</span>`:`<button class="sm pri" data-act="study" data-k="${k}">Commission study</button>`}</div>${s&&!done?bar(s.prog/STUDY_NEED[k]):''}${done?`<p class="note">${DEP[k].reveal}</p>`:''}</div>`}).join(''):'<p class="note">Secure a strange deposit inside a hub’s worked land and your researchers can study it. Holdings on fractured Earths and slain creatures also feed these studies.</p>'}</div>
  <div class="card"><div class="eyebrow">Known regiments</div>${availUnits('P').map(k=>`<div class="urow"><span class="chip p">${UT[k].g}</span><span class="grow">${UT[k].n}</span><span class="mono sm">${UT[k].atk}/${UT[k].def} · ${UT[k].spd}mv · ${unitCost(k,'P')}g</span></div>`).join('')}</div>`}
function courtTab(){
  const pet=G.petitions.map(p=>{const n=G.nobles.find(x=>x.id===p.noble);return `<div class="track"><p class="note"><b>${esc(n.name)}</b> asks for letters patent: an estate at ${fmtLL(p.i)} in ${CONTS[CONT[p.i]]} on ${esc(G.worlds[p.w].name)}. Expires in ${p.eta} quarter${p.eta>1?'s':''}.</p><div class="acts"><button class="pri sm" data-act="grant" data-id="${p.id}">Grant</button><button class="sm" data-act="refuse" data-id="${p.id}">Refuse</button><button class="ghost sm" data-act="viewsite" data-w="${p.w}" data-i="${p.i}">View site</button></div></div>`}).join('');
  const houses=G.nobles.map(n=>{const hs=houseHubs(n);const gs=G.units.filter(u=>u.guard===n.id);const rv=G.nobles.find(x=>x.id===n.rival);const co=n.co&&G.orgs.find(o=>o.id===n.co);const sh=houseShare(n);
    return `<div class="track"><div class="row"><b>${esc(n.name)}${n.lord?` <span class="tag">Wardens of ${CONTS[n.home.c]}</span>`:''}</b><span class="mono sm">loyalty ${Math.round(n.loyalty)}</span></div>${bar(n.loyalty/100,n.loyalty>=55?'g':n.loyalty>=40?'w':'b')}
    <dl class="kv"><dt>Ambition</dt><dd>${n.home?`${CONTS[n.home.c]} on ${esc(G.worlds[n.home.w].name)} · holds ${Math.round(sh*100)}% of its towns`:'Seeking a first estate beyond Prime'}</dd><dt>Holdings</dt><dd>${hs.length} · ${fmt(hs.reduce((s,h)=>s+h.pop,0)*1000)} souls</dd><dt>House wealth</dt><dd class="mono">${fmt(n.wealth||0)}</dd>${co?`<dt>House company</dt><dd>${esc(co.name)} · ${co.works} works</dd>`:''}<dt>Guards</dt><dd>${gs.length}${gs.length?' at '+Math.round(gs.reduce((a,u)=>a+u.str,0)/gs.length)+'%':''}${rv?' · rival of '+esc(rv.name):''}</dd></dl>
    ${n.feud?`<div class="row sm"><span class="neg">Feuding with ${esc(rv.name)}</span><button class="sm" data-act="arbitrate" data-id="${n.id}">Arbitrate · 40g</button></div>`:''}</div>`}).join('');
  const civ=G.hubs.filter(h=>h.o==='P'&&h.kind==='civ'),co=G.hubs.filter(h=>h.o==='P'&&h.kind==='company');
  const row=h=>`<div class="urow"><span class="dot" style="background:${hubCol(h)}"></span><span class="grow">${esc(h.name)} · ${esc(h.group||'')}</span><span class="mono sm">${G.worlds[h.w].name.replace('Earth ','')} · ${fmt(h.pop*1000)}</span><button class="sm" data-act="viewsite" data-w="${h.w}" data-i="${h.i}">Go</button></div>`;
  return `<div class="card"><div class="eyebrow">Petitions</div>${pet||'<p class="note">No houses are petitioning this quarter.</p>'}</div>
  <div class="card"><div class="eyebrow">Great houses · ${feudal()?'feudal monarchy':'absolute monarchy'}</div><p class="note">Houses develop their estates, carve out new holdings on their chosen continent, petition for more land and, once rich, found companies confined to that continent. ${feudal()?'They keep household guards that fight invaders and each other.':'The crown now forbids new private armies.'}</p>${houses}</div>
  <div class="card"><div class="eyebrow">Free towns · ${civ.length}</div><p class="note">Emigrant peoples who govern themselves away from your military lines and pay taxes.</p>${civ.map(row).join('')}</div>
  <div class="card"><div class="eyebrow">Company towns · ${co.length}</div><p class="note">Outposts built by free companies. No taxes; free companies hire there at a discount.</p>${co.map(row).join('')}</div>`}
function worldTab(){const w=G.worlds[curW];
  const mine=G.hubs.filter(h=>h.o==='P'&&h.w===curW);const known=w.portals.filter(p=>isSeen(curW,p.i));
  const canRole=curW!==0&&curW!==G.rivalW;let seenN=0,land=0;if(curW===0)seenN=land=1;else{const a=SEEN[curW];for(let i=0;i<NT;i++)if(T[i]){land++;if(a&&a[i])seenN++}}
  const eta=selHex!=null?expEta(curW,selHex):null;
  return `<div class="card"><div class="eyebrow">Portal chain · tap an Earth</div><div class="chain">${chainSVG()}</div></div>
  <div class="card"><div class="eyebrow">Viewing</div><h3>${esc(w.name)}${w.weird?' <span class="tag odd">fractured</span>':''}</h3><dl class="kv"><dt>Explored</dt><dd class="mono">${Math.round(seenN/land*100)}%</dd><dt>Season (north)</dt><dd>${SEASONS[seasonAt(curW)]}${w.storm?' · '+w.stormName:''}</dd><dt>Local time</dt><dd>${hourStr(curW)} when it is noon in Varenne</dd><dt>Known portals</dt><dd>${known.length?known.map(p=>`<button class="link" data-act="viewsite" data-w="${curW}" data-i="${p.i}">${fmtLL(p.i)}${T[p.i]?'':' (at sea)'}</button> → ${G.disc[p.to]?esc(G.worlds[p.to].name):'uncharted'}`).join('<br>'):'None found yet'}${curW!==0&&seenN<land?'<br><span class="mute">Others may lie in unexplored land.</span>':''}</dd><dt>Ships</dt><dd class="mono">${G.ships[curW]||0}${shipsEff('P',curW)>(G.ships[curW]||0)?' · plus fleets through sea portals':''}</dd><dt>Your hubs</dt><dd class="mono">${mine.length} · ${fmt(mine.reduce((s,h)=>s+h.pop,0)*1000)} souls</dd></dl>
  ${w.weird?`<p class="note">This Earth lies far from the main chain and has come apart: rifts split the land, strange growths cover it, storms rise without warning and creatures roam. Holdings here feed your strange studies.</p>`:''}
  ${canRole?`<label class="lab" for="w-role">Designation</label><select id="w-role">${Object.entries(ROLES).map(([k,n])=>`<option value="${k}"${w.role===k?' selected':''}>${n}</option>`).join('')}</select><p class="note">${ROLE_TXT[w.role]||''}</p>`:`<p class="note">${curW===0?'Your home Earth. Other kingdoms hold all land beyond your march.':'Homeland of the '+esc(G.rival)+'.'}</p>`}
  <div class="acts">${known.length?'<button data-act="findportal">Next known portal</button>':''}${mine.length?'<button data-act="findhub">Next hub</button>':''}</div></div>
  <div class="card"><div class="eyebrow">Special interest expedition</div><label class="lab" for="ex-focus">Purpose</label><select id="ex-focus">${Object.entries(EXP).map(([k,e])=>`<option value="${k}">${e.n} · ${e.cost}g</option>`).join('')}</select>
  <p class="note">${selHex!=null?(eta!=null?`Target: ${fmtLL(selHex)}. The party travels from your nearest town and returns in about ${eta+1} quarters.`:'No known route from your towns to the selected hex.'):'Select a hex first, or right-click one on the map.'}</p><div class="acts"><button class="pri" data-act="expedition"${selHex!=null&&eta!=null?'':' disabled'}>Dispatch</button></div>
  ${G.exps.length?G.exps.map(e=>`<div class="urow"><span class="grow">${e.name} · ${EXP[e.focus].n}</span><span class="mono sm">${G.worlds[e.w].name.replace('Earth ','')} · ${e.eta}q</span></div>`).join(''):''}</div>`}
function chainSVG(){
  const ws=G.worlds.filter(w=>G.disc[w.id]);const kids={};for(const w of ws)if(w.parent>=0&&G.disc[w.parent])(kids[w.parent]=kids[w.parent]||[]).push(w.id);
  const stubs={};for(const w of ws)for(const p of w.portals)if(!G.disc[p.to]&&isSeen(w.id,p.i))(stubs[w.id]=stubs[w.id]||[]).push(p.to);
  const pos={};let leaf=0;const maxD={v:0};
  function lay(id,d){maxD.v=Math.max(maxD.v,d);const ch=(kids[id]||[]);const st=(stubs[id]||[]);if(!ch.length&&!st.length){pos[id]={x:leaf++,d};return}
    const xs=[];for(const c of ch){lay(c,d+1);xs.push(pos[c].x)}for(const s of st){pos['s'+s+'_'+id]={x:leaf++,d:d+1,stub:1,par:id};xs.push(pos['s'+s+'_'+id].x);maxD.v=Math.max(maxD.v,d+1)}pos[id]={x:(Math.min(...xs)+Math.max(...xs))/2,d}}
  lay(0,0);
  const cw=78,rh=58,Wd=Math.max(300,leaf*cw+20),Hd=(maxD.v+1)*rh+20;const X=x=>20+x*cw+cw/2-10,Y=d=>24+d*rh;
  let s=`<svg viewBox="0 0 ${Wd} ${Hd}" width="${Wd}" height="${Hd}" role="img" aria-label="Portal chain">`;
  for(const id in pos){const p=pos[id];let par=p.stub?p.par:(G.worlds[id]&&G.worlds[id].parent);if(par==null||par<0||!pos[par])continue;s+=`<line x1="${X(pos[par].x)}" y1="${Y(pos[par].d)}" x2="${X(p.x)}" y2="${Y(p.d)}" class="ln${p.stub?' st':''}"/>`}
  for(const id in pos){const p=pos[id];if(p.stub){s+=`<circle cx="${X(p.x)}" cy="${Y(p.d)}" r="9" class="nd stub"/><text x="${X(p.x)}" y="${Y(p.d)+4}" class="q">?</text>`;continue}
    const w=G.worlds[id];const has=G.hubs.some(h=>h.w==id&&h.o==='P'),en=G.hubs.some(h=>h.w==id&&h.o==='A'&&isSeen(+id,h.i))||G.units.some(u=>u.w==id&&u.o==='A'&&isSeen(+id,u.i));
    s+=`<g class="wn" data-act="goworld" data-w="${id}"><circle cx="${X(p.x)}" cy="${Y(p.d)}" r="13" class="nd ${has?'mine':''} ${en?'enemy':''} ${w.weird?'odd':''} ${+id===curW?'cur':''}"/><text x="${X(p.x)}" y="${Y(p.d)+4}" class="ab">${w.role==='home'?'P':w.role==='rivalhome'?'⚑':ROLES[w.role][0]}</text><text x="${X(p.x)}" y="${Y(p.d)+28}" class="nm">${esc(w.name.replace('Earth ',''))}</text></g>`}
  return s+'</svg>'}

function orgTab(){
  const discW=G.worlds.filter(w=>G.disc[w.id]&&w.id!==G.rivalW);
  const kinds=[...new Set([...KNOWN].map(t=>D[t]))];
  const wsel=(id,anyLbl,sel)=>`<select id="${id}">${anyLbl?`<option value="any">${anyLbl}</option>`:''}${discW.map(w=>`<option value="${w.id}"${sel==w.id?' selected':''}>${esc(w.name)}${w.role!=='colony'&&w.role!=='home'?' · '+ROLES[w.role]:''}</option>`).join('')}</select>`;
  const csel=`<label class="lab" for="of-cont">Continent</label><select id="of-cont"><option value="any">Anywhere on that Earth</option>${CONTS.map((c,k)=>`<option value="${k}">${c}</option>`).join('')}</select>`;
  const dem=G.orgs.filter(o=>o.demand).map(o=>{const d=o.demand;return `<div class="track"><p class="note"><b>${esc(o.head.name)}</b> of ${esc(o.name)} ${d.t==='toll'?`wants to charge the crown a toll of <b>${d.amt} gold a quarter</b> for the supply line across ${esc(G.worlds[d.w].name)}.`:`wants the company to keep 25% more of its profits on ${esc(G.worlds[d.w].name)}.`} Answer within ${d.eta} quarter${d.eta>1?'s':''}.</p><div class="acts"><button class="pri sm" data-act="dem-yes" data-id="${o.id}">Grant</button><button class="sm" data-act="dem-no" data-id="${o.id}">Refuse</button></div></div>`}).join('');
  const cards=G.orgs.map(o=>{const p=orgProj(o);const tot=p?p.steps.length:0;const pol=o.type==='trade'||o.type==='penal';
    const cont=o.cont!=null&&o.cont!=='any'?', '+CONTS[+o.cont]:'';
    const target=o.type==='trade'?`${o.res==='all'?'All resources':depName(o.res)} · ${esc(G.worlds[+o.w].name)}${cont}`:o.type==='penal'?`Convict labor · ${esc(G.worlds[+o.w].name)}${cont}`:o.type==='ship'?`Ships for ${esc(G.worlds[+o.w].name)} · ${G.ships[+o.w]||0} sailing`:o.type==='survey'?(o.w==='any'?'Every reachable portal':'Portals on '+esc(G.worlds[+o.w].name)):o.type==='rnd'?RD_FIELDS[o.field]:'Free companies';
    const troops=G.units.filter(u=>u.co===o.id).length;const doms=G.worlds.filter(w=>G.disc[w.id]&&pol&&dominates(o,w.id));
    return `<div class="card${o.defiant?' sel':''}"><div class="row"><div><div class="eyebrow">${COTYPES[o.type].n}${o.house?' · '+esc((G.nobles.find(n=>n.id===o.house)||{name:'a great house'}).name):''}${o.defiant?' · <span class="neg">defying the crown</span>':''}</div><h3>${esc(o.name)}</h3></div><div class="num sm">${fmt(o.purse)}g</div></div>
    <dl class="kv"><dt>Head</dt><dd>${esc(o.head.name)}, ${Math.floor(o.head.age)}</dd><dt>Character</dt><dd>${o.head.traits.map(t=>`<span title="${TRAITS[t].d}">${TRAITS[t].n}</span>`).join(', ')}</dd><dt>Assignment</dt><dd>${target}</dd>
    ${pol?`<dt>Works</dt><dd class="mono">${o.works}${troops?` · ${troops} troop${troops>1?'s':''} on patrol`:''}</dd>`:''}
    ${doms.length?`<dt>Dominates</dt><dd>${doms.map(w=>esc(w.name)).join(', ')}</dd>`:''}
    ${o.toll?`<dt>Toll</dt><dd class="neg mono">${o.toll}g / quarter on ${esc(G.worlds[o.tollW].name)}</dd>`:''}
    ${Object.keys(o.cut||{}).length?`<dt>Profit share</dt><dd class="warn">+25% on ${Object.keys(o.cut).map(w=>esc(G.worlds[+w].name)).join(', ')}</dd>`:''}</dl>
    ${pol?`<div class="row sm"><span class="mute">Standing with the crown</span><span class="mono">${Math.round(o.standing)}</span></div>${bar(o.standing/100,o.standing>=55?'g':o.standing>=30?'w':'b')}`:''}
    ${p?`${bar(tot?p.k/tot:0)}<div class="row sm mute"><span>${esc(p.name)}</span><span class="mono">${p.k}/${tot}</span></div>`:''}
    <p class="note">${esc(o.status)}</p>${sl2(`of-fund-${o.id}`,'Crown funding per quarter',o.fund,60)}<div class="acts"><button class="ghost sm" data-act="revoke" data-id="${o.id}">Revoke charter</button></div></div>`}).join('');
  const ty=orgTab.ty||'trade';
  return `${dem?`<div class="card"><div class="eyebrow">Company demands</div>${dem}<p class="note">Companies that hold most of the works on an Earth your supply line crosses may ask for tolls or a bigger share. Charter a rival company there to break their hold.</p></div>`:''}${cards}
  <div class="card"><div class="eyebrow">Grant a royal charter · 50g</div>
  <label class="lab" for="of-type">Company</label><select id="of-type">${Object.entries(COTYPES).map(([k,c])=>`<option value="${k}"${k===ty?' selected':''}>${c.n}</option>`).join('')}</select>
  <p class="note">${COTYPES[ty].b}</p>
  ${ty==='trade'?`<label class="lab" for="of-w">Earth</label>${wsel('of-w',null,curW)}${csel}<label class="lab" for="of-res">Resource</label><select id="of-res"><option value="all">All resources</option>${kinds.map(k=>`<option value="${k}">${depName(k)}</option>`).join('')}</select><p class="note">A deposit charted on one Earth is in the same place on every Earth.</p>`:''}
  ${ty==='penal'?`<label class="lab" for="of-w">Prison world</label>${wsel('of-w',null,curW)}${csel}`:''}
  ${ty==='ship'?`<label class="lab" for="of-w">Earth</label>${wsel('of-w',null,curW)}`:''}
  ${ty==='survey'?`<label class="lab" for="of-w">Theatre</label>${wsel('of-w','Every Earth your lines reach','any')}`:''}
  ${ty==='rnd'?`<label class="lab" for="of-field">Field</label><select id="of-field">${Object.entries(RD_FIELDS).map(([k,n])=>`<option value="${k}">${n}</option>`).join('')}</select>`:''}
  <label class="lab" for="of-name">Name</label><input id="of-name" placeholder="Leave blank for a default name" maxlength="40">
  <label class="lab" for="of-fund">Funding</label><select id="of-fund"><option value="10">10 gold / quarter</option><option value="20" selected>20 gold / quarter</option><option value="35">35 gold / quarter</option><option value="50">50 gold / quarter</option></select>
  <p class="note">The directors choose the company’s head. You will learn their character once the charter is granted, and it changes when they die.</p>
  <div class="acts"><button class="pri" data-act="charter">Grant charter</button></div></div>`}
function constructionCard(){
  const mine=G.projects.filter(p=>p.o==='P'&&!p.by),cos=G.projects.filter(p=>p.o==='P'&&p.by);
  const row=p=>{const L=projLeft(p);const q=Math.ceil(L.work/Math.max(0.01,projRate(p)));const tot=p.steps.length;
    return `<div class="track"><div class="row"><b>${esc(p.name)}</b><span class="mono sm">${G.worlds[p.w].name.replace('Earth ','')}</span></div>${bar(tot?p.k/tot:1,p.blocked?'b':p.stall?'w':'')}
    <div class="row sm"><span class="${p.blocked?'neg':p.stall?'warn':'mute'}">${p.blocked?'Blocked by enemy lines':p.stall==='ships'?'Needs ships on this Earth':p.stall?'Waiting for gold':`~${q} quarter${q===1?'':'s'} left`} · ${fmt(L.cost)}g to go</span>${p.by?'':`<span class="inline"><button class="sm" data-act="crew-" data-id="${p.id}"${p.crews>1?'':' disabled'}>−</button><span class="mono">${p.crews} crew${p.crews>1?'s':''}</span><button class="sm" data-act="crew+" data-id="${p.id}"${crownCrews()<crewsMax()?'':' disabled'}>+</button><button class="sm ghost" data-act="viewsite" data-w="${p.w}" data-i="${(p.steps[p.k]&&p.steps[p.k].i)??p.goal}">View</button><button class="sm ghost" data-act="cancelproj" data-id="${p.id}">Stop</button></span>`}</div></div>`};
  return `<div class="card"><div class="eyebrow">Construction · ${crownCrews()} of ${crewsMax()} crown crews at work</div>
  <p class="note">Each crew does ${RATE[G.research.logi]} work a quarter at ${LOGI[G.research.logi].toLowerCase()} pace. A plains hex is 1 work and about ${MILES} miles; mountains take 3. Better logistics multiplies the pace and adds crews.</p>
  ${mine.length?mine.map(row).join(''):'<p class="note">No crown works under way. Tap open land and choose Survey a line to here.</p>'}
  ${cos.length?`<div class="eyebrow">Company works</div>${cos.map(row).join('')}`:''}</div>`}
function sl2(id,lbl,v,max){return `<div class="slider"><label for="${id}">${lbl}</label><input type="range" id="${id}" min="0" max="${max}" value="${v}"><output id="${id}-o" class="mono">${v}</output></div>`}
function logTab(){const cls={win:'pos',loss:'neg',strange:'str',tech:'tech',org:'org',world:'wld',grow:'pos',mil:'',info:''};
  let last=-1,out='<div class="card log">';for(const l of G.log.slice(0,120)){if(l.t!==last){out+=`<div class="eyebrow">${dateStr(l.t)}</div>`;last=l.t}out+=`<p class="${cls[l.kind]||''}">${esc(l.txt)}</p>`}return out+'</div>'}

function showOver(){const o=$('#over');o.hidden=false;o.innerHTML=`<div class="card"><div class="eyebrow">${dateStr()}</div><h2>${G.over.win?'Victory':'Defeat'}</h2><p>${esc(G.over.txt)}</p><div class="acts"><button class="pri" id="over-new">Begin a new campaign</button></div></div>`;
  $('#over-new').onclick=()=>{o.hidden=true;newGame();curW=0;selHex=null;selUnit=null;centerOn(G.capP);refresh()}}


/* ================= ACTIONS ================= */
function toast(msg,ms){const t=$('#toast');t.innerHTML=msg;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,ms||3200)}
function setWorld(w,focus){curW=w;selHex=null;plan=null;const hs=G.hubs.filter(h=>h.o==='P'&&h.w===w);const kp=G.worlds[w].portals.find(p=>isSeen(w,p.i));centerOn(focus??(hs.length?hs[0].i:(kp||G.worlds[w].portals[0]).i));refresh()}
function doAct(a,b){const d=b.dataset||{};const u=G.units.find(u=>u.id===selUnit);
  if(a!=='newgame')confirmNew=false;
  switch(a){
    case 'march':mode='move';$('#mode').hidden=false;$('#mode-t').textContent=`Tap a destination for ${selUnits.size>1?selUnits.size+' units':u.name}. You can switch Earths first.`;if(window.innerWidth<900)openSheet(false);break;
    case 'transit':{const to=portalTo(u.w,u.i);u.dest={w:to,i:u.i};u.auto=null;toast(`${esc(u.name)} will cross the portal next quarter.`);break}
    case 'halt':for(const id of selUnits){const x=G.units.find(v=>v.id===id);if(!x)continue;x.dest=null;if(x.air){G.gold+=25;x.air=null}}break;
    case 'hold':{const v=!u.hold;for(const id of selUnits){const x=G.units.find(y=>y.id===id);if(movable(x)){x.hold=v;if(v)x.dest=null}}break}
    case 'explore':{const on=u.auto!=='explore';for(const id of selUnits){const x=G.units.find(y=>y.id===id);if(x&&UT[x.type].scout){x.auto=on?'explore':null;if(!on)x.dest=null;x.skip=[]}}if(on)exploreOrders();break}
    case 'selall':{const i=selHex;const st=G.units.filter(x=>x.w===curW&&x.i===i&&movable(x));selUnits.clear();for(const x of st)selUnits.add(x.id);selUnit=st[0]?st[0].id:null;break}
    case 'airlift':mode='airlift';$('#mode').hidden=false;$('#mode-t').textContent=`Tap one of your connected hubs to fly ${u.name} there.`;if(window.innerWidth<900)openSheet(false);break;
    case 'companytown':{const err=foundCompanyTown(u);if(err)toast(err);break}
    case 'grant':answerPetition(+d.id,true);break;
    case 'refuse':answerPetition(+d.id,false);break;
    case 'arbitrate':{const err=arbitrate(+d.id);if(err)toast(err);break}
    case 'viewsite':curW=+d.w;selHex=+d.i;plan=null;centerOn(selHex);tab='hex';break;
    case 'disband':G.units=G.units.filter(x=>x!==u);log(`${u.name} was disbanded.`,'mil');selUnits.delete(u.id);selUnit=[...selUnits][0]??null;break;
    case 'selunit':selectOnly(+d.id);break;
    case 'goworld':setWorld(+d.w,d.i!=null?+d.i:undefined);tab='hex';return;
    case 'openhex':tab='hex';openSheet(true);break;
    case 'center':centerOn(selHex);break;
    case 'raise':{const h=hubAt(curW,selHex);const ty=$('#raise-type').value;const err=raiseUnit(h,ty);if(err)toast(err);else{const nu=G.units[G.units.length-1];if(UT[ty].scout)nu.auto='explore';selectOnly(nu.id)}break}
    case 'merc':{const err=hireMerc(hubAt(curW,selHex));if(err)toast(err);break}
    case 'depot':if(G.gold<40){toast('Not enough gold.');break}G.gold-=40;{const h=foundHub('P',curW,selHex,{pop:0.6});log(`Depot ${h.name} founded at ${fmtLL(selHex)}, ${G.worlds[curW].name}.`,'grow')}break;
    case 'plan':{const p=roadPlan('P',curW,selHex,roadMul('P',curW));if(!p){toast(hasLines(curW)?'No route. Foreign land, rifts or enemy lines block the way, or the route crosses water and you have no harbor with ships on this Earth.':'You have no line on this Earth yet. Reach it through a portal first.');break}plan=p;planCrews=1;tab='hex';openSheet(true);break}
    case 'build':{const sel=$('#plan-crews');const c=sel?+sel.value:1;if(crownCrews()+c>crewsMax()){toast('Not enough free crews.');break}const pr=addProject('P',plan,{crews:c,name:'Line to '+fmtLL(plan.goal)});log(`Crown crews began ${pr.name} on ${G.worlds[pr.w].name}.`,'grow');plan=null;break}
    case 'crew+':{const p=G.projects.find(x=>x.id===+d.id);if(p&&crownCrews()<crewsMax())p.crews++;break}
    case 'crew-':{const p=G.projects.find(x=>x.id===+d.id);if(p&&p.crews>1)p.crews--;break}
    case 'cancelproj':{const p=G.projects.find(x=>x.id===+d.id);G.projects=G.projects.filter(x=>x!==p);if(p)log(`Work stopped on ${p.name}. What was laid stays.`,'info');break}
    case 'harbor':{const h=hubAt(curW,selHex);if(crownCrews()>=crewsMax()){toast('All crown crews are busy.');break}addProject('P',{w:h.w,path:[h.i],steps:[{t:'port',i:h.i}],goal:h.i,mul:1},{crews:1,name:'Harbor at '+h.name,done:{t:'harbor'}});toast(`Crews began a harbor at ${esc(h.name)}.`);break}
    case 'traction':{const err=buildTraction(hubAt(curW,selHex));if(err)toast(err);break}
    case 'tmove':{tmoveHub=hubAt(curW,selHex).id;mode='tmove';$('#mode').hidden=false;$('#mode-t').textContent='Tap where the traction city should roll to.';if(window.innerWidth<900)openSheet(false);break}
    case 'thalt':{const h=hubAt(curW,selHex);if(h)h.dest=null;break}
    case 'cancelplan':plan=null;break;
    case 'study':G.research.studies[d.k]={prog:0};log(`Researchers began studying the ${depName(d.k)}.`,'strange');break;
    case 'charter':{const ty=$('#of-type').value;const wv=$('#of-w')?$('#of-w').value:'any';const res=$('#of-res')?$('#of-res').value:null;const field=$('#of-field')?$('#of-field').value:null;const cont=$('#of-cont')?$('#of-cont').value:'any';
      const ws=wv==='any'?'':G.worlds[+wv].name.replace('Earth ','');const cs=cont!=='any'?CONTS[+cont]+' ':'';
      const dn={trade:`The ${ws} ${cs}${res==='all'||!res?'Trading':depName(res).split(' ')[0]} Company`,survey:ws?`${ws} Survey Corps`:'Royal Survey Corps',ship:`${ws} Shipwrights`,rnd:`Royal Institute of ${field?RD_FIELDS[field]:''}`,penal:`${ws} Penal Transport Company`,merc:'Free Company Brokers'}[ty];
      const err=charterCompany({name:$('#of-name').value.trim()||dn,type:ty,w:wv,cont,res,field,fund:+$('#of-fund').value});if(err)toast(err);break}
    case 'dem-yes':answerDemand(+d.id,true);break;
    case 'dem-no':answerDemand(+d.id,false);break;
    case 'ship':{const h=hubAt(curW,selHex);if(G.gold<40){toast('A ship costs 40 gold.');break}G.gold-=40;G.ships[h.w]=(G.ships[h.w]||0)+1;log(`A crown ship was launched at ${h.name}. ${G.ships[h.w]} ships now sail on ${G.worlds[h.w].name}.`,'grow');break}
    case 'revoke':revokeCharter(+d.id);break;
    case 'expedition':{const f=$('#ex-focus').value;const err=launchExp(curW,selHex,f);if(err)toast(err);break}
    case 'expat':{const err=launchExp(curW,selHex,d.f);toast(err||'Expedition dispatched.');break}
    case 'scoutgo':{const sc=G.units.filter(x=>x.o==='P'&&x.w===curW&&UT[x.type].scout).sort((a,b)=>(a.auto?1:0)-(b.auto?1:0)||hdist(a.i,selHex)-hdist(b.i,selHex));if(sc[0]){sc[0].auto=null;orderMove([sc[0]],curW,selHex)}break}
    case 'findportal':{const ps=G.worlds[curW].portals.filter(p=>isSeen(curW,p.i));if(!ps.length)break;const k=(worldTab.pk=((worldTab.pk||0)+1)%ps.length);centerOn(ps[k].i);selHex=ps[k].i;break}
    case 'findhub':{const hs=G.hubs.filter(h=>h.o==='P'&&h.w===curW);const k=(worldTab.hk=((worldTab.hk||0)+1)%hs.length);centerOn(hs[k].i);selHex=hs[k].i;break}
    case 'tsort':holdingsCard.k=d.k;break;
    case 'tall':holdingsCard.all=!holdingsCard.all;break;
    case 'newgame':if(!confirmNew){confirmNew=true;break}confirmNew=false;newGame();curW=0;selHex=null;selectOnly(null);centerOn(G.capP);tab='hex';break;
  }
  refresh()}
$('#body').addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b&&!b.disabled)doAct(b.dataset.act,b)});
function ctxHover(e){const b=e.target.closest&&e.target.closest('#ctx [data-act]');const r=b&&b.dataset.r!=null?+b.dataset.r:null,pr=b&&b.dataset.p;
  const nx=(r!=null||pr)&&selHex!=null?{w:curW,i:selHex,r:r||0,p:!!pr,col:b.dataset.act==='expat'?'#8fdcff':'#d9ae55'}:null;
  if(JSON.stringify(nx)!==JSON.stringify(ctxPrev)){ctxPrev=nx;dirty=true}}
$('#ctx').addEventListener('pointerover',ctxHover);$('#ctx').addEventListener('focusin',ctxHover);$('#ctx').addEventListener('pointerleave',()=>{if(ctxPrev){ctxPrev=null;dirty=true}});
$('#ctx').addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b)return;closeCtx();doAct(b.dataset.act,b)});
$('#h-todo').addEventListener('click',e=>{const b=e.target.closest('[data-hud]');if(!b)return;const k=b.dataset.hud;if(k==='idle')nextIdle();else{tab=k==='crews'?'realm':(G.petitions.length?'court':'orgs');openSheet(true);renderBody()}});
$('#body').addEventListener('input',e=>{const t=e.target;if(t.type!=='range')return;const o=document.getElementById(t.id+'-o');
  if(t.id==='r-budget'){G.research.budget=+t.value;if(o)o.textContent=t.value}
  else if(t.id.startsWith('r-')){setAlloc(t.id.slice(2),+t.value);const sp=document.querySelector('.split');if(sp)sp.innerHTML=FIELDS.map(f=>`<i style="flex:${G.research.alloc[f]||0.001}" class="f-${f}"></i>`).join('')}
  else if(t.id.startsWith('of-fund-')){if(o)o.textContent=t.value;const o2=G.orgs.find(o=>o.id===+t.id.slice(8));if(o2)o2.fund=+t.value}
  renderHud();save()});
$('#body').addEventListener('change',e=>{const t=e.target;
  if(t.id==='w-role'){G.worlds[curW].role=t.value;log(`${G.worlds[curW].name} designated a ${ROLES[t.value]}.`,'world');refresh()}
  if(t.id==='realm-name'){G.realm=t.value.trim()||G.realm;refresh()}
  if(t.id==='of-type'){orgTab.ty=t.value;renderBody()}
  if(t.id==='plan-crews'){planCrews=+t.value}
  if(t.id&&t.id.startsWith('r-'))refresh()});
document.querySelectorAll('#tabs button').forEach(b=>b.addEventListener('click',()=>{if(tab===b.dataset.tab&&sheetOpen&&window.innerWidth<900){openSheet(false);return}tab=b.dataset.tab;openSheet(true);renderBody()}));
$('#grip').addEventListener('click',()=>openSheet(!sheetOpen));
$('#h-world').addEventListener('click',()=>{tab='worlds';openSheet(true);renderBody()});
$('#mode-x').addEventListener('click',()=>{mode=null;$('#mode').hidden=true});
$('#toast').addEventListener('click',()=>{$('#toast').hidden=true;tab='log';openSheet(true);renderBody()});
function endQuarter(){if(G.over)return;const b=$('#endturn');if(b.disabled)return;b.disabled=true;closeCtx();
  setTimeout(()=>{const ev=endTurn();plan=null;b.disabled=false;lastEvents=ev;
    const key2=ev.filter(l=>['win','loss','strange','tech','world','org'].includes(l.kind)&&!/ crossed from /.test(l.txt)).slice(0,3);
    const more=ev.length-key2.length;
    toast(`<b>${dateStr()}</b>${key2.length?key2.map(l=>`<span>${esc(l.txt)}</span>`).join(''):'<span>A quiet quarter.</span>'}${more>0?`<span class="mute">${more} more in the log. Tap to open.</span>`:''}`,key2.length?6500:2200);
    if(G.over)showOver();refresh()},20)}
$('#endturn').addEventListener('click',endQuarter);
document.addEventListener('click',e=>{if(!e.target.closest('#ctx')&&e.target!==cv)closeCtx()});
window.addEventListener('keydown',e=>{const tg=e.target.tagName;if(['INPUT','SELECT','TEXTAREA'].includes(tg)&&e.key!=='Escape')return;if(e.metaKey||e.ctrlKey||e.altKey)return;
  const u=G.units.find(x=>x.id===selUnit);const k=e.key.toLowerCase();
  if(e.key==='Enter'){e.preventDefault();endQuarter();return}
  if(e.key==='Escape'){closeCtx();if(mode){mode=null;$('#mode').hidden=true}else{selectOnly(null);plan=null;refresh()}return}
  if(k==='n'||e.key==='Tab'){e.preventDefault();nextIdle();return}
  if(k==='h'){setWorld(0,G.capP);return}
  if(k==='m'&&movable(u)){doAct('march',{dataset:{}});return}
  if(k==='f'&&movable(u)&&!UT[u.type].scout){doAct('hold',{dataset:{}});return}
  if(k==='e'&&u&&UT[u.type].scout){doAct('explore',{dataset:{}});return}
  if(k===','||k==='.'){const ws=G.worlds.filter(w=>G.disc[w.id]).map(w=>w.id);const n=ws.indexOf(curW);setWorld(ws[(n+(k==='.'?1:ws.length-1))%ws.length]);return}
  const tabsK=['hex','realm','court','research','orgs','worlds','log'];if(/^[1-7]$/.test(e.key)){tab=tabsK[+e.key-1];openSheet(true);renderBody()}});
/* ================= SAVE / BOOT ================= */
function save(){try{localStorage.setItem('chain-of-earths-v5',serialize())}catch(e){}}
function boot(data){
  let loaded=false;
  if(data&&data.save){try{deserialize(data.save);loaded=true}catch(e){}}
  if(!loaded){try{const s=localStorage.getItem('chain-of-earths-v5');if(s){deserialize(s);loaded=true}}catch(e){}}
  if(!loaded)newGame();
  resize();cam.z=window.innerWidth<600?1.25:1.6;
  if(data&&data.ui){Object.assign(cam,data.ui.cam);curW=data.ui.curW||0}else centerOn(G.capP);
  tab='hex';openSheet(window.innerWidth>=900);refresh();if(G.over)showOver();
  requestAnimationFrame(loop);
}
window.addEventListener('resize',()=>{resize();clampCam()});
window.claude?.hot?.snapshot?.(()=>({save:serialize(),ui:{cam:{...cam},curW}}));
window.claude?.hot?.ready?window.claude.hot.ready(boot):boot(window.claude?.hot?.data??{});
