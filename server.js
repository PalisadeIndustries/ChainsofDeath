'use strict';
// Chain of Earths multiplayer server: one authoritative copy of every game, simultaneous quarters,
// and per-player views that only show what that realm has seen.
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {WebSocketServer}=require('ws');
const GAME=require('./public/game.js');
const PORT=+process.env.PORT||8080;
const DATA=process.env.DATA_DIR||path.join(__dirname,'data');
fs.mkdirSync(DATA,{recursive:true});
const games=new Map();          // code -> {meta, rt}
const conns=new Set();          // live sockets
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const now=()=>Date.now();
const CODECH='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode(){let c;do{c='';for(let k=0;k<5;k++)c+=CODECH[crypto.randomInt(CODECH.length)]}while(games.has(c)||fs.existsSync(path.join(DATA,c+'.json')));return c}
const clean=(s,n)=>String(s||'').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,n||40);

/* ---------- persistence ---------- */
function file(code){return path.join(DATA,code+'.json')}
function saveGame(g){const out={meta:g.meta};if(g.rt){GAME.useGame(g.rt);out.state=GAME.serialize()}
  const tmp=file(g.meta.code)+'.tmp';fs.writeFileSync(tmp,JSON.stringify(out));fs.renameSync(tmp,file(g.meta.code))}
function loadGame(code){if(games.has(code))return games.get(code);const f=file(code);if(!fs.existsSync(f))return null;
  const raw=JSON.parse(fs.readFileSync(f,'utf8'));const g={meta:raw.meta,rt:null};
  if(raw.state){GAME.deserialize(raw.state);g.rt=GAME.snapshotRuntime()}games.set(code,g);return g}
for(const f of fs.readdirSync(DATA))if(f.endsWith('.json')){try{loadGame(f.slice(0,-5))}catch(e){console.error('Could not load',f,e.message)}}

/* ---------- helpers ---------- */
function send(ws,m){if(ws.readyState===1)ws.send(JSON.stringify(m))}
function seatsOnline(g){const on=new Set();for(const c of conns)if(c.code===g.meta.code&&c.seat!=null)on.add(c.seat);return on}
function lobbyMsg(g){const on=seatsOnline(g);const m=g.meta;
  return {t:'lobby',code:m.code,started:m.started,host:m.host,maxSeats:m.maxSeats,fillAI:m.fillAI,hours:m.hours,
    seats:m.seats.map((s,k)=>({k,name:s.name,realm:s.realm,online:on.has(k)}))}}
function statusMsg(g){const m=g.meta;const on=seatsOnline(g);let alive={};if(g.rt){GAME.useGame(g.rt);for(const id of GAME.realmIds())alive[id]=GAME.G.realms[id].alive}
  return {t:'status',turn:g.rt?GAME.G.turn:0,deadline:m.deadline||null,hours:m.hours,over:g.rt?GAME.G.over:null,
    players:m.seats.map((s,k)=>({k,name:s.name,realm:s.realm,ready:!!m.ready[k],online:on.has(k),alive:alive['r'+k]!==false}))}}
function broadcast(g,mk){for(const c of conns)if(c.code===g.meta.code)send(c,typeof mk==='function'?mk(c):mk)}
function sendView(c,g,extra){if(!g.rt||c.seat==null)return;GAME.useGame(g.rt);const rid='r'+c.seat;if(!GAME.G.realms[rid])return;
  send(c,Object.assign({t:'view',view:GAME.makeView(rid)},extra||{}))}
function humanAlive(g){GAME.useGame(g.rt);return g.meta.seats.map((s,k)=>k).filter(k=>GAME.G.realms['r'+k]&&GAME.G.realms['r'+k].alive)}

/* ---------- turns ---------- */
function resolve(g,why){if(!g.rt)return;GAME.useGame(g.rt);if(GAME.G.over)return;
  const t0=now();const ev=GAME.endTurn();g.rt=GAME.snapshotRuntime();
  g.meta.ready={};g.meta.deadline=g.meta.hours?now()+g.meta.hours*3600e3:null;g.meta.resolvedAt=now();
  saveGame(g);console.log(`[${g.meta.code}] quarter resolved (${why}) in ${now()-t0} ms, turn ${GAME.G.turn}`);
  for(const c of conns)if(c.code===g.meta.code&&c.seat!=null)sendView(c,g,{events:ev['r'+c.seat]||[],resolved:true});
  broadcast(g,statusMsg(g))}
function maybeResolve(g){if(!g.meta.started||!g.rt)return;const need=humanAlive(g);if(need.length&&need.every(k=>g.meta.ready[k]))resolve(g,'everyone ready')}
setInterval(()=>{for(const g of games.values())if(g.meta.started&&g.meta.deadline&&now()>=g.meta.deadline)resolve(g,'deadline')},30e3);

/* ---------- lobby actions ---------- */
function create(c,m){const code=newCode();const token=crypto.randomBytes(18).toString('hex');
  const meta={code,created:now(),hours:Math.max(0,Math.min(168,+m.hours||0)),maxSeats:Math.max(2,Math.min(5,+m.seats||5)),fillAI:!!m.fillAI,host:0,started:false,ready:{},deadline:null,chat:[],
    seats:[{name:clean(m.name,24)||'Host',realm:clean(m.realm,40),pin:hash(code+':'+String(m.pin||'')),token}]};
  const g={meta,rt:null};games.set(code,g);saveGame(g);c.code=code;c.seat=0;send(c,{t:'joined',code,token,seat:0});broadcast(g,lobbyMsg(g))}
function join(c,m){const code=clean(m.code,8).toUpperCase();const g=loadGame(code);if(!g)return send(c,{t:'err',msg:'No game with that code.'});
  const name=clean(m.name,24);if(!name)return send(c,{t:'err',msg:'Enter your name.'});const pin=hash(code+':'+String(m.pin||''));
  let k=g.meta.seats.findIndex(s=>s.name.toLowerCase()===name.toLowerCase());
  if(k>=0){if(g.meta.seats[k].pin!==pin)return send(c,{t:'err',msg:'That name is taken in this game. Use the same PIN to rejoin, or pick another name.'})}
  else{if(g.meta.started)return send(c,{t:'err',msg:'That game has already started.'});if(g.meta.seats.length>=g.meta.maxSeats)return send(c,{t:'err',msg:'That game is full.'});
    g.meta.seats.push({name,realm:clean(m.realm,40),pin,token:crypto.randomBytes(18).toString('hex')});k=g.meta.seats.length-1;saveGame(g)}
  c.code=code;c.seat=k;send(c,{t:'joined',code,token:g.meta.seats[k].token,seat:k});afterJoin(c,g)}
function resume(c,m){const g=loadGame(clean(m.code,8).toUpperCase());if(!g)return send(c,{t:'err',msg:'That game no longer exists.',gone:1});
  const k=g.meta.seats.findIndex(s=>s.token===m.token);if(k<0)return send(c,{t:'err',msg:'Your seat could not be found. Join again with your name and PIN.',gone:1});
  c.code=g.meta.code;c.seat=k;send(c,{t:'joined',code:g.meta.code,token:m.token,seat:k});afterJoin(c,g)}
function afterJoin(c,g){broadcast(g,lobbyMsg(g));if(g.meta.started){sendView(c,g,{events:[]});broadcast(g,statusMsg(g))}send(c,{t:'chat',msgs:g.meta.chat.slice(-60),all:1})}
function start(c){const g=games.get(c.code);if(!g||g.meta.started)return;if(c.seat!==g.meta.host)return send(c,{t:'err',msg:'Only the host can start the game.'});
  const humans=g.meta.seats.length;let total=g.meta.fillAI?g.meta.maxSeats:humans;if(total<2)total=2;
  const seats=[];for(let k=0;k<total;k++){const s=g.meta.seats[k];seats.push(s?{human:true,realm:s.realm||undefined}:{human:false})}
  GAME.newGame({seed:crypto.randomInt(1,1e9),seats});g.rt=GAME.snapshotRuntime();
  g.meta.started=true;g.meta.deadline=g.meta.hours?now()+g.meta.hours*3600e3:null;saveGame(g);
  console.log(`[${g.meta.code}] started with ${humans} players and ${total-humans} computer realms`);
  broadcast(g,lobbyMsg(g));for(const x of conns)if(x.code===g.meta.code)sendView(x,g,{events:[],started:true});broadcast(g,statusMsg(g))}

/* ---------- web server ---------- */
const PUB=path.join(__dirname,'public');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent((req.url||'/').split('?')[0]);if(p==='/'||p.startsWith('/g/'))p='/index.html';
  const f=path.normalize(path.join(PUB,p));if(!f.startsWith(PUB)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end('Not found')}
  res.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream','Cache-Control':'no-cache'});fs.createReadStream(f).pipe(res)});
const wss=new WebSocketServer({server,perMessageDeflate:true,maxPayload:256*1024});
wss.on('connection',ws=>{conns.add(ws);ws.alive=true;ws.on('pong',()=>ws.alive=true);
  ws.on('message',buf=>{let m;try{m=JSON.parse(buf)}catch(e){return}
    try{
      if(m.t==='create')return create(ws,m);
      if(m.t==='join')return join(ws,m);
      if(m.t==='resume')return resume(ws,m);
      const g=games.get(ws.code);if(!g||ws.seat==null)return send(ws,{t:'err',msg:'Join a game first.'});
      if(m.t==='start')return start(ws);
      if(m.t==='settings'&&ws.seat===g.meta.host&&!g.meta.started){g.meta.hours=Math.max(0,Math.min(168,+m.hours||0));g.meta.fillAI=!!m.fillAI;saveGame(g);return broadcast(g,lobbyMsg(g))}
      if(m.t==='chat'){const text=String(m.text||'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,300);if(!text)return;const msg={k:ws.seat,name:g.meta.seats[ws.seat].name,text,at:now()};g.meta.chat.push(msg);if(g.meta.chat.length>200)g.meta.chat.shift();saveGame(g);return broadcast(g,{t:'chat',msgs:[msg]})}
      if(!g.rt)return;
      if(m.t==='cmd'){GAME.useGame(g.rt);const r=GAME.runCmd('r'+ws.seat,String(m.name),m.args||{});g.dirty=true;sendView(ws,g,{q:m.q,res:r.res||null,err:r.err||null});return}
      if(m.t==='ready'){g.meta.ready[ws.seat]=!!m.on;broadcast(g,statusMsg(g));return maybeResolve(g)}
      if(m.t==='view')return sendView(ws,g,{});
    }catch(e){console.error(e);send(ws,{t:'err',msg:'The server could not do that.'})}});
  ws.on('close',()=>{conns.delete(ws);const g=games.get(ws.code);if(g){broadcast(g,lobbyMsg(g));if(g.meta.started)broadcast(g,statusMsg(g))}})});
setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue}ws.alive=false;ws.ping()}},30e3);
setInterval(()=>{for(const g of games.values())if(g.dirty){g.dirty=false;try{saveGame(g)}catch(e){console.error(e)}}},15e3);
process.on('SIGINT',()=>{for(const g of games.values())try{saveGame(g)}catch(e){}process.exit(0)});
process.on('SIGTERM',()=>{for(const g of games.values())try{saveGame(g)}catch(e){}process.exit(0)});
server.listen(PORT,()=>console.log(`Chain of Earths server on http://localhost:${PORT}  (saves in ${DATA})`));
