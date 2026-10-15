/* ================= NETWORK, LOBBY AND DISPATCHES ================= */
const NET={ws:null,code:null,token:null,seat:null,started:false,ready:false,q:0,cbs:{},status:null,lobby:null,chat:[],unread:0,tries:0,overShown:false,
  send(m){if(this.ws&&this.ws.readyState===1){this.ws.send(JSON.stringify(m));return true}toast('Not connected. Retrying…');return false},
  leave(){try{localStorage.removeItem('coe-seat')}catch(e){}location.href='/'}};
function cmd(name,args,cb){const q=++NET.q;if(cb)NET.cbs[q]=cb;NET.send({t:'cmd',name,args:args||{},q})}
const LATER={};function later(k,f){clearTimeout(LATER[k]);LATER[k]=setTimeout(f,400)}
function oc(o){return o===ME?COL.P:o==='M'?COL.M:(G&&G.realms[o]&&G.realms[o].color)||COL.A}
const seatColor=k=>(G&&G.realms['r'+k]&&G.realms['r'+k].color)||'#8a9499';
function savedSeat(){try{return JSON.parse(localStorage.getItem('coe-seat')||'null')}catch(e){return null}}
function storeSeat(code,token){try{localStorage.setItem('coe-seat',JSON.stringify({code,token}))}catch(e){}}

function connect(){
  const ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');NET.ws=ws;
  ws.onopen=()=>{NET.tries=0;$('#net-down').hidden=true;const sv=savedSeat();const urlCode=(location.pathname.match(/^\/g\/([A-Za-z0-9]{4,8})/)||[])[1];
    if(sv&&(!urlCode||urlCode.toUpperCase()===sv.code))ws.send(JSON.stringify({t:'resume',code:sv.code,token:sv.token}));else showLobby(urlCode)};
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch(x){return}onNet(m)};
  ws.onclose=()=>{NET.ws=null;if(NET.code)$('#net-down').hidden=false;const d=Math.min(15000,800*Math.pow(1.6,NET.tries++));setTimeout(connect,d)}}

function onNet(m){
  if(m.t==='joined'){NET.code=m.code;NET.token=m.token;NET.seat=m.seat;storeSeat(m.code,m.token);if(!location.pathname.startsWith('/g/'))history.replaceState(null,'','/g/'+m.code);return}
  if(m.t==='err'){if(m.gone){try{localStorage.removeItem('coe-seat')}catch(e){}NET.code=null;showLobby()}lobbyErr(m.msg);if(NET.started)toast(esc(m.msg));return}
  if(m.t==='lobby'){NET.lobby=m;if(m.started){NET.started=true;$('#lobby').hidden=true}else renderLobby();return}
  if(m.t==='status'){NET.status=m;const me=m.players.find(p=>p.k===NET.seat);NET.ready=!!(me&&me.ready);renderNet();return}
  if(m.t==='chat'){if(m.all)NET.chat=m.msgs;else{NET.chat.push(...m.msgs);if(NET.chat.length>200)NET.chat.shift();if($('#chat').hidden&&m.msgs.some(x=>x.k!==NET.seat))NET.unread+=m.msgs.length}renderChat();renderNet();return}
  if(m.t==='view'){NET.started=true;$('#lobby').hidden=true;loadView(m.view);bootView();
    if(m.err)toast(esc(m.err));
    if(m.q&&NET.cbs[m.q]){const f=NET.cbs[m.q];delete NET.cbs[m.q];if(!m.err)f(m.res)}
    if(m.resolved){plan=null;NET.ready=false;const ev=m.events||[];lastEvents=ev;
      const key2=ev.filter(l=>['win','loss','strange','tech','world','org'].includes(l.kind)&&!/ crossed from /.test(l.txt)).slice(0,3);const more=ev.length-key2.length;
      toast(`<b>${dateStr()}</b>${key2.length?key2.map(l=>`<span>${esc(l.txt)}</span>`).join(''):'<span>A quiet quarter.</span>'}${more>0?`<span class="mute">${more} more in the log. Tap to open.</span>`:''}`,key2.length?6500:2200)}
    if(G.over&&!NET.overShown){NET.overShown=true;showOver()}
    return}}

/* ---------- HUD: who is ready, and the deadline ---------- */
function fmtLeft(ms){if(ms<=0)return 'any moment';const h=Math.floor(ms/3600e3),mi=Math.floor(ms%3600e3/60e3);return h?`${h}h ${mi}m`:mi?`${mi}m`:'under a minute'}
function renderNet(){const st=NET.status;const b=$('#endturn');if(!b)return;
  if(!st||!G){b.textContent='Ready';return}
  const live=st.players.filter(p=>p.alive);const nr=live.filter(p=>p.ready).length;
  b.textContent=G.over?'War over':NET.ready?`Waiting · ${nr}/${live.length}`:'Ready';b.classList.toggle('on',NET.ready);b.disabled=!!G.over||!RM.alive;
  $('#h-net').innerHTML=st.players.map(p=>`<span class="pl${p.ready?' rd':''}${p.online?'':' off'}${p.alive?'':' dead'}" title="${esc(p.name)}${p.realm?' · '+esc(p.realm):''}${p.online?'':' (offline)'}${p.ready?' · ready':''}"><i style="background:${seatColor(p.k)}"></i>${esc(p.name)}${p.ready?' ✓':''}</span>`).join('')
    +(st.deadline?`<span class="dl mono">${fmtLeft(st.deadline-Date.now())} left</span>`:'')
    +`<button class="chipbtn" id="chat-open">Dispatches${NET.unread?` · ${NET.unread}`:''}</button>`;
  $('#chat-open').onclick=()=>{const c=$('#chat');c.hidden=!c.hidden;if(!c.hidden){NET.unread=0;renderChat();renderNet();$('#chat-in').focus()}}}
setInterval(()=>{if(NET.status&&NET.status.deadline)renderNet()},30e3);

/* ---------- dispatches (chat) ---------- */
function renderChat(){const l=$('#chat-log');if(!l)return;const at=l.scrollTop+l.clientHeight>=l.scrollHeight-8;
  l.innerHTML=NET.chat.length?NET.chat.map(c=>`<p><b style="color:${seatColor(c.k)}">${esc(c.name)}</b> ${esc(c.text)}</p>`).join(''):'<p class="mute">No dispatches yet. Messages here go to every player in this game.</p>';
  if(at)l.scrollTop=l.scrollHeight}
$('#chat-f').addEventListener('submit',e=>{e.preventDefault();const i=$('#chat-in');const v=i.value.trim();if(!v)return;if(NET.send({t:'chat',text:v}))i.value=''});
$('#chat-x').addEventListener('click',()=>{$('#chat').hidden=true});

/* ---------- lobby ---------- */
function lobbyErr(msg){const e=$('#lb-err');if(e){e.textContent=msg||'';e.hidden=!msg}}
let lobbyMode='new';
function showLobby(code){$('#lobby').hidden=false;if(code){lobbyMode='join';NET.prefill=code.toUpperCase()}NET.lobby=null;renderLobby()}
function renderLobby(){const L=$('#lobby');L.hidden=false;const lb=NET.lobby;
  if(lb&&NET.code){const host=NET.seat===lb.host;const link=location.origin+'/g/'+lb.code;
    L.innerHTML=`<div class="card"><div class="eyebrow">Waiting room</div><h2>Game ${esc(lb.code)}</h2>
      <p class="note">Send friends this link, or the code. They join with a name and a PIN they choose; the same name and PIN gets them back in later.</p>
      <div class="row"><input id="lb-link" readonly value="${esc(link)}"><button class="ghost sm" id="lb-copy">Copy</button></div>
      <div class="eyebrow">Seats · ${lb.seats.length} of ${lb.maxSeats}</div>
      ${lb.seats.map(s=>`<div class="urow"><span class="dot${s.online?' on':''}"></span><span class="grow">${esc(s.name)}${s.k===lb.host?' <span class="tag">host</span>':''}</span><span class="mute">${esc(s.realm||'realm name chosen at start')}</span></div>`).join('')}
      ${host?`<label class="lab" for="lb-hours">Time limit per quarter</label><select id="lb-hours">${[[0,'None · resolve when everyone is ready'],[1,'1 hour'],[4,'4 hours'],[12,'12 hours'],[24,'1 day'],[48,'2 days']].map(([v,n])=>`<option value="${v}"${+lb.hours===v?' selected':''}>${n}</option>`).join('')}</select>
      <label class="chk"><input type="checkbox" id="lb-ai"${lb.fillAI?' checked':''}> Fill empty seats with computer realms</label>
      <div class="acts"><button class="pri" id="lb-start"${lb.seats.length<2&&!lb.fillAI?' disabled':''}>Start the war</button><button class="ghost" id="lb-leave">Leave</button></div>
      ${lb.seats.length<2&&!lb.fillAI?'<p class="note">Wait for at least one more player, or fill empty seats with computer realms.</p>':''}`
      :`<p class="note">Waiting for the host to start. Time limit: ${+lb.hours?lb.hours+' h per quarter':'none'}${lb.fillAI?' · empty seats go to computer realms':''}.</p><div class="acts"><button class="ghost" id="lb-leave">Leave</button></div>`}
      <p class="neg" id="lb-err" hidden></p></div>`;
    $('#lb-copy').onclick=()=>{const i=$('#lb-link');i.select();try{navigator.clipboard.writeText(i.value)}catch(e){document.execCommand('copy')}$('#lb-copy').textContent='Copied'};
    $('#lb-leave').onclick=()=>NET.leave();
    if(host){const upd=()=>NET.send({t:'settings',hours:+$('#lb-hours').value,fillAI:$('#lb-ai').checked});$('#lb-hours').onchange=upd;$('#lb-ai').onchange=upd;
      $('#lb-start').onclick=()=>{$('#lb-start').disabled=true;$('#lb-start').textContent='Building the worlds…';NET.send({t:'start'})}}
    return}
  const nm=(()=>{try{return localStorage.getItem('coe-name')||''}catch(e){return ''}})();
  L.innerHTML=`<div class="card"><div class="eyebrow">Chain of Earths · multiplayer</div><h2>${lobbyMode==='new'?'Start a game':'Join a game'}</h2>
    <div class="seg"><button class="${lobbyMode==='new'?'on':''}" data-lm="new">New game</button><button class="${lobbyMode==='join'?'on':''}" data-lm="join">Join with a code</button></div>
    ${lobbyMode==='join'?`<label class="lab" for="lb-code">Game code</label><input id="lb-code" maxlength="8" autocomplete="off" value="${esc(NET.prefill||'')}" style="text-transform:uppercase">`:''}
    <label class="lab" for="lb-name">Your name</label><input id="lb-name" maxlength="24" value="${esc(nm)}">
    <label class="lab" for="lb-realm">Realm name <span class="mute">(optional)</span></label><input id="lb-realm" maxlength="40" placeholder="A name is chosen for you if blank">
    <label class="lab" for="lb-pin">PIN <span class="mute">(lets you rejoin from another device)</span></label><input id="lb-pin" maxlength="12" inputmode="numeric" autocomplete="off">
    ${lobbyMode==='new'?`<label class="lab" for="lb-seats">Seats</label><select id="lb-seats">${[2,3,4,5].map(n=>`<option value="${n}"${n===5?' selected':''}>${n} realms</option>`).join('')}</select>
    <label class="lab" for="lb-hours">Time limit per quarter</label><select id="lb-hours"><option value="0">None · resolve when everyone is ready</option><option value="1">1 hour</option><option value="4">4 hours</option><option value="12">12 hours</option><option value="24" >1 day</option><option value="48">2 days</option></select>
    <label class="chk"><input type="checkbox" id="lb-ai"> Fill empty seats with computer realms</label>`:''}
    <div class="acts"><button class="pri" id="lb-go">${lobbyMode==='new'?'Create game':'Join game'}</button></div><p class="neg" id="lb-err" hidden></p></div>`;
  L.querySelectorAll('[data-lm]').forEach(b=>b.onclick=()=>{lobbyMode=b.dataset.lm;renderLobby()});
  $('#lb-go').onclick=()=>{const name=$('#lb-name').value.trim();if(!name)return lobbyErr('Enter your name.');try{localStorage.setItem('coe-name',name)}catch(e){}
    const base={name,realm:$('#lb-realm').value.trim(),pin:$('#lb-pin').value};
    if(lobbyMode==='new')NET.send(Object.assign(base,{t:'create',seats:+$('#lb-seats').value,hours:+$('#lb-hours').value,fillAI:$('#lb-ai').checked}));
    else{const code=$('#lb-code').value.trim().toUpperCase();if(!code)return lobbyErr('Enter the game code.');NET.send(Object.assign(base,{t:'join',code}))}}}
connect();
