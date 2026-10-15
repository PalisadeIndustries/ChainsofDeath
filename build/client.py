#!/usr/bin/env python3
"""Turn the single-player UI (ui.js) into the networked client UI.
Every change is an exact replacement that must match, so a mismatch fails loudly."""
import re, sys, pathlib
SRC = pathlib.Path(sys.argv[1]).read_text()
OUT = pathlib.Path(sys.argv[2])
s = SRC

def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        sys.exit(f"expected {count} of {old[:70]!r}, found {n}")
    s = s.replace(old, new)

def case(name, body):
    """Replace the whole `case 'name':...` line inside doAct."""
    global s
    pat = re.compile(r"^    case '" + re.escape(name) + r"':.*$", re.M)
    if len(pat.findall(s)) != 1:
        sys.exit(f"case {name} not found once")
    s = pat.sub(lambda m: "    case '" + name + "':" + body, s)

# ---- realm identity -------------------------------------------------------
rep("const hubCol=h=>h.o!=='P'?COL.A:", "const hubCol=h=>h.o!=='P'?oc(h.o):")
rep("if(h.o!=='P')return ['A',COL.A];", "if(h.o!=='P')return ['R'+h.o,oc(h.o)];")
rep("ctx.strokeStyle=o==='P'?COL.P:COL.A;", "ctx.strokeStyle=oc(o);")
rep("u.o==='M'?COL.M:COL.A;", "oc(u.o);")
rep("'Concordance '+UT[u.type].n", "esc(rname(u.o))+' '+UT[u.type].n")
rep("esc(G.rival)+'’s homeland.", "esc(rname(homeOwner(w)))+'’s homeland.")
rep("${own==='P'?esc(G.realm):esc(G.rival", "${own==='P'?esc(G.realm):esc(rname(own)")
rep("h.o!=='P'?esc(G.rival):", "h.o!=='P'?esc(rname(h.o)):")
rep("'Homeland of the '+esc(G.rival)+'.'", "'Homeland of '+esc(rname(homeOwner(curW)))+'.'")
s = s.replace("'P'", "ME")
# The holder line above used G.rival...; finish it if the original had a ternary tail
s = s.replace("esc(rname(own)||'')", "esc(rname(own))")

# ---- home world instead of Earth 0 -------------------------------------------
rep("const ctr=w===0?G.capP:G.capA;", "const ho=homeOwner(w);const cp=ho&&G.realms[ho].cap;if(!cp)return null;const ctr=cp.i;")
rep("if(curW===0||curW===G.rivalW)for(const k of ks)ctx.drawImage(foreignLayer(curW),k,0);",
    "{const fl=homeOwner(curW)?foreignLayer(curW):null;if(fl)for(const k of ks)ctx.drawImage(fl,k,0)}")
rep("function fogLayer(){if(curW===0)return null;", "function fogLayer(){if(curW===RM.home)return null;")
rep("$('#h-local').textContent=curW===0?'':", "$('#h-local').textContent=curW===RM.home?'':")
rep("${hourStr(curW)} when it is noon in Varenne", "${hourStr(curW,36-(G.worlds[RM.home].hoff||0))} when it is noon at home", 2)
rep("${w===0?'Other kingdoms hold this land on Earth Prime.", "${w===RM.home?'Other kingdoms hold this land on your home Earth.")
rep("else if(curW>0&&curW!==G.rivalW){", "else if(!homeOwner(curW)){")
rep("const canRole=curW!==0&&curW!==G.rivalW;", "const canRole=!homeOwner(curW);")
rep("if(curW===0)seenN=land=1;", "if(curW===RM.home)seenN=land=1;")
rep("${curW!==0&&seenN<land?", "${curW!==RM.home&&seenN<land?")
rep("${curW===0?'Your home Earth.", "${curW===RM.home?'Your home Earth.")
rep("const discW=G.worlds.filter(w=>G.disc[w.id]&&w.id!==G.rivalW);", "const discW=G.worlds.filter(w=>G.disc[w.id]&&!w.hidden&&(!homeOwner(w.id)||homeOwner(w.id)===ME));")
rep("if(k==='h'){setWorld(0,G.capP);return}", "if(k==='h'){setWorld(RM.home,capOf(ME).i);return}")
rep("const kp=G.worlds[w].portals.find(p=>isSeen(w,p.i));centerOn(focus??(hs.length?hs[0].i:(kp||G.worlds[w].portals[0]).i));",
    "const kp=G.worlds[w].portals.find(p=>isSeen(w,p.i));const uu=G.units.find(u=>u.w===w&&u.o===ME);centerOn(focus??(hs.length?hs[0].i:kp?kp.i:uu?uu.i:capOf(ME).i));")
rep("const ws=G.worlds.filter(w=>G.disc[w.id]).map(w=>w.id);", "const ws=G.worlds.filter(w=>G.disc[w.id]&&!w.hidden).map(w=>w.id);")

# ---- the portal chain, laid out from my home ------------------------------------
a = s.index("function chainSVG(){")
b = s.index("function orgTab(){")
s = s[:a] + r"""function chainSVG(){
  const home=RM.home;const pos={},kids={},stubs={},seenW=new Set([home]);const q=[home];
  while(q.length){const id=q.shift();for(const p of G.worlds[id].portals){if(G.disc[p.to]&&!G.worlds[p.to].hidden){if(!seenW.has(p.to)){seenW.add(p.to);(kids[id]=kids[id]||[]).push(p.to);q.push(p.to)}}else (stubs[id]=stubs[id]||[]).push(p.to)}}
  const par={};for(const id in kids)for(const c of kids[id])par[c]=+id;
  let leaf=0;const maxD={v:0};
  function lay(id,d){maxD.v=Math.max(maxD.v,d);const ch=(kids[id]||[]);const st=(stubs[id]||[]);if(!ch.length&&!st.length){pos[id]={x:leaf++,d};return}
    const xs=[];for(const c of ch){lay(c,d+1);xs.push(pos[c].x)}for(const s2 of st){const k='s'+s2+'_'+id;pos[k]={x:leaf++,d:d+1,stub:1,par:id};xs.push(pos[k].x);maxD.v=Math.max(maxD.v,d+1)}pos[id]={x:(Math.min(...xs)+Math.max(...xs))/2,d}}
  lay(home,0);
  const cw=78,rh=58,Wd=Math.max(300,leaf*cw+20),Hd=(maxD.v+1)*rh+20;const X=x=>20+x*cw+cw/2-10,Y=d=>24+d*rh;
  let s=`<svg viewBox="0 0 ${Wd} ${Hd}" width="${Wd}" height="${Hd}" role="img" aria-label="Portal chain">`;
  for(const id in pos){const p=pos[id];const pa=p.stub?p.par:par[id];if(pa==null||!pos[pa])continue;s+=`<line x1="${X(pos[pa].x)}" y1="${Y(pos[pa].d)}" x2="${X(p.x)}" y2="${Y(p.d)}" class="ln${p.stub?' st':''}"/>`}
  for(const id in pos){const p=pos[id];if(p.stub){s+=`<circle cx="${X(p.x)}" cy="${Y(p.d)}" r="9" class="nd stub"/><text x="${X(p.x)}" y="${Y(p.d)+4}" class="q">?</text>`;continue}
    const w=G.worlds[id];const has=G.hubs.some(h=>h.w==id&&h.o===ME),en=G.hubs.some(h=>h.w==id&&isFoe(h.o))||G.units.some(u=>u.w==id&&isFoe(u.o)&&u.o!=='M');
    const ho=homeOwner(+id);const lbl=+id===home?'H':ho?'⚑':(ROLES[w.role]||'C')[0];
    s+=`<g class="wn" data-act="goworld" data-w="${id}"><title>${esc(w.name)}${ho&&ho!==ME?' · '+esc(rname(ho)):''}</title><circle cx="${X(p.x)}" cy="${Y(p.d)}" r="13" class="nd ${has?'mine':''} ${en?'enemy':''} ${w.weird?'odd':''} ${+id===curW?'cur':''}"${ho&&ho!==ME?` style="stroke:${oc(ho)}"`:''}/><text x="${X(p.x)}" y="${Y(p.d)+4}" class="ab">${lbl}</text><text x="${X(p.x)}" y="${Y(p.d)+28}" class="nm">${esc(w.name.replace('Earth ','').slice(0,10))}</text></g>`}
  return s+'</svg>'}

""" + s[b:]

# ---- orders go to the server ---------------------------------------------------
rep("function orderMove(us,w,i){let worst=null;for(const u of us){u.dest={w,i};u.hold=false;if(u.auto)u.auto=null;delete pathCache[u.id]}",
    "function orderMove(us,w,i){let worst=null;cmd('move',{ids:us.map(u=>u.id),w,i});for(const u of us){u.dest={w,i};u.hold=false;if(u.auto)u.auto=null;delete pathCache[u.id]}")
rep("else{G.gold-=25;u.air={w:curW,i};u.dest=null;toast(", "else{cmd('airlift',{id:u.id,w:curW,i});toast(")
rep("else{h.dest={w:curW,i};toast(", "else{cmd('tmove',{hub:h.id,w:curW,i});h.dest={w:curW,i};toast(")

case('transit', "cmd('transit',{id:u.id});toast(`${esc(u.name)} will cross the portal next quarter.`);break;")
case('halt', "cmd('halt',{ids:[...selUnits]});break;")
case('hold', "cmd('hold',{ids:[...selUnits],on:!u.hold});break;")
case('explore', "cmd('explore',{ids:[...selUnits],on:u.auto!=='explore'});break;")
case('companytown', "cmd('companytown',{id:u.id});break;")
case('grant', "cmd('petition',{id:+d.id,yes:true});break;")
case('refuse', "cmd('petition',{id:+d.id,yes:false});break;")
case('arbitrate', "cmd('arbitrate',{id:+d.id});break;")
case('disband', "cmd('disband',{id:u.id});selUnits.delete(u.id);selUnit=[...selUnits][0]??null;break;")
case('raise', "{const h=hubAt(curW,selHex);const ty=$('#raise-type').value;cmd('raise',{hub:h.id,type:ty},r=>{if(r&&r.id)selectOnly(r.id)});break}")
case('merc', "cmd('merc',{hub:hubAt(curW,selHex).id});break;")
case('depot', "cmd('depot',{w:curW,i:selHex});break;")
case('build', "{const sel=$('#plan-crews');const c=sel?+sel.value:1;cmd('build',{w:plan.w,i:plan.goal,crews:c});plan=null;break}")
case('crew+', "cmd('crew',{pid:+d.id,d:1});break;")
case('crew-', "cmd('crew',{pid:+d.id,d:-1});break;")
case('cancelproj', "cmd('cancelproj',{pid:+d.id});break;")
case('harbor', "cmd('harbor',{hub:hubAt(curW,selHex).id},()=>toast('Crews began a harbor.'));break;")
case('traction', "cmd('traction',{hub:hubAt(curW,selHex).id});break;")
case('thalt', "cmd('thalt',{hub:hubAt(curW,selHex).id});break;")
case('study', "cmd('study',{k:d.k});break;")
rep("const err=charterCompany({name:$('#of-name').value.trim()||dn,type:ty,w:wv,cont,res,field,fund:+$('#of-fund').value});if(err)toast(err);break}",
    "cmd('charter',{name:$('#of-name').value.trim()||dn,type:ty,w:wv,cont,res,field,fund:+$('#of-fund').value});break}")
case('dem-yes', "cmd('demand',{id:+d.id,yes:true});break;")
case('dem-no', "cmd('demand',{id:+d.id,yes:false});break;")
case('ship', "cmd('ship',{hub:hubAt(curW,selHex).id});break;")
case('revoke', "cmd('revoke',{id:+d.id});break;")
case('expedition', "cmd('expedition',{w:curW,i:selHex,f:$('#ex-focus').value},()=>toast('Expedition dispatched.'));break;")
case('expat', "cmd('expedition',{w:curW,i:selHex,f:d.f},()=>toast('Expedition dispatched.'));break;")
case('scoutgo', "cmd('scoutgo',{w:curW,i:selHex},r=>{if(r&&r.id)selectOnly(r.id)});break;")
case('newgame', "break;")
rep("if(a!=='newgame')confirmNew=false;", "")

# sliders and selects: change locally for feel, send debounced
rep("if(t.id==='r-budget'){G.research.budget=+t.value;if(o)o.textContent=t.value}",
    "if(t.id==='r-budget'){G.research.budget=+t.value;if(o)o.textContent=t.value;later('research',()=>cmd('research',{budget:G.research.budget}))}")
rep("else if(t.id.startsWith('r-')){setAlloc(t.id.slice(2),+t.value);",
    "else if(t.id.startsWith('r-')){setAlloc(t.id.slice(2),+t.value);later('alloc',()=>cmd('research',{alloc:G.research.alloc}));")
rep("if(o2)o2.fund=+t.value}", "if(o2){o2.fund=+t.value;later('fund'+o2.id,()=>cmd('fund',{id:o2.id,fund:o2.fund}))}}")
rep("renderHud();save()});", "renderHud()});")
a = s.index("  if(t.id==='w-role'){")
b = s.index("\n", a)
s = s[:a] + "  if(t.id==='w-role'){cmd('role',{w:curW,role:t.value})}" + s[b:]
rep("if(t.id==='realm-name'){G.realm=t.value.trim()||G.realm;refresh()}", "if(t.id==='realm-name'){cmd('rename',{name:t.value})}")

# ---- end of quarter becomes Ready ------------------------------------------------
a = s.index("function endQuarter(){")
b = s.index("$('#endturn').addEventListener('click',endQuarter);")
s = s[:a] + "function endQuarter(){if(G.over||!NET.started)return;closeCtx();NET.send({t:'ready',on:!NET.ready})}\n" + s[b:]

rep("function refresh(){G.secured=(R=econ(ME)).secured;terrV++;renderHud();renderBody();dirty=true;save()}",
    "function refresh(){if(!G)return;G.secured=(R=econ(ME)).secured;terrV++;renderHud();renderBody();renderNet();dirty=true}")

a = s.index("function showOver(){")
b = s.index("\n", s.index("$('#over-new').onclick", a))
s = s[:a] + r"""function showOver(){const o=$('#over');o.hidden=false;const win=G.over.winner===ME;const fell=!RM.alive;
  o.innerHTML=`<div class="card"><div class="eyebrow">${dateStr()}</div><h2>${win?'Victory':fell?'Your realm has fallen':'The war is over'}</h2><p>${esc(G.over.txt||'')}</p><div class="acts"><button class="pri" id="over-x">Look at the map</button><button class="ghost" id="over-leave">Leave this game</button></div></div>`;
  $('#over-x').onclick=()=>{o.hidden=true};$('#over-leave').onclick=()=>NET.leave()}""" + s[b:]

# ---- saving and booting are the network's job -------------------------------------
a = s.index("/* ================= SAVE / BOOT ================= */")
b = s.index("window.addEventListener('resize',()=>{resize();clampCam()});")
s = s[:a] + r"""/* ================= BOOT (networked) ================= */
function save(){}
let booted=false;
function bootView(){if(!booted){booted=true;resize();cam.z=window.innerWidth<600?1.25:1.6;curW=RM.home;centerOn(capOf(ME).i);tab='hex';openSheet(window.innerWidth>=900);requestAnimationFrame(loop)}
  if(!G.disc[curW]||G.worlds[curW].hidden)curW=RM.home;
  for(const id of [...selUnits])if(!G.units.some(u=>u.id===id))selUnits.delete(id);if(selUnit!=null&&!G.units.some(u=>u.id===selUnit))selUnit=[...selUnits][0]??null;
  for(const k in pathCache)delete pathCache[k];for(const k in foreignCache)delete foreignCache[k];FOGC=null;TERR=null;refresh()}
""" + s[b:]
a = s.index("window.claude?.hot?.snapshot")
s = s[:a]

for bad in ["G.capP", "G.capA", "G.rivalW", "G.rival", "newGame(", "endTurn(", "localStorage.setItem('chain", "'A'", "Varenne"]:
    if bad in s:
        i = s.index(bad)
        sys.exit(f"leftover {bad!r}: ...{s[max(0,i-80):i+60]}")
OUT.write_text(s)
print("client ui ok", len(s))
