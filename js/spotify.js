// ═══════════════════════════════════════════════════════════
// ══  SPOTIFY MODULE (SP)  ══════════════════════════════════
// ═══════════════════════════════════════════════════════════
var SP=(function(){
  var LS={TOKEN:'baker_spotify_token',REFRESH:'baker_spotify_refresh',EXPIRY:'baker_spotify_expiry',ID:'baker_spotify_id',DEVICE:'baker_spotify_device',CV:'baker_spotify_cv'};
  var SCOPES='user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private playlist-read-collaborative user-library-read user-read-recently-played streaming';
  var currentState=null,pollTimer=null,progressTimer=null,progressEpoch=0,devices=[];

  // ── Auth ──────────────────────────────────────────────────
  function getRedirectUri(){return window.location.origin+window.location.pathname;}
  async function sha256(s){var e=new TextEncoder().encode(s);return crypto.subtle.digest('SHA-256',e);}
  function b64url(b){return btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');}
  function genVerifier(){var a=new Uint8Array(64);crypto.getRandomValues(a);return b64url(a);}
  async function genChallenge(v){return b64url(await sha256(v));}

  async function connect(){
    var id=localStorage.getItem(LS.ID);
    if(!id){alert('Paste your Spotify Client ID in Settings first.');return;}
    var v=genVerifier(),c=await genChallenge(v);
    localStorage.setItem(LS.CV,v);
    var p=new URLSearchParams({client_id:id,response_type:'code',redirect_uri:getRedirectUri(),code_challenge_method:'S256',code_challenge:c,scope:SCOPES});
    window.location.href='https://accounts.spotify.com/authorize?'+p;
  }

  async function exchangeCode(code){
    var id=localStorage.getItem(LS.ID),v=localStorage.getItem(LS.CV);
    var r=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:getRedirectUri(),client_id:id,code_verifier:v})});
    if(!r.ok)throw new Error('Token exchange failed');
    saveTokens(await r.json());localStorage.removeItem(LS.CV);
    window.history.replaceState({},''  ,window.location.pathname);
  }

  async function refreshToken(){
    var id=localStorage.getItem(LS.ID),ref=localStorage.getItem(LS.REFRESH);
    if(!ref||!id)return false;
    try{
      var r=await fetch('https://accounts.spotify.com/api/token',{
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({grant_type:'refresh_token',refresh_token:ref,client_id:id})
      });
      if(r.status===400||r.status===401){
        // Invalid refresh token — clear everything and stop polling
        [LS.TOKEN,LS.REFRESH,LS.EXPIRY,LS.CV].forEach(function(k){localStorage.removeItem(k);});
        stopPolling();
        updateNav();
        console.warn('[SP] Refresh token invalid — re-authorize Spotify in settings');
        return false;
      }
      if(!r.ok)return false;
      saveTokens(await r.json());return true;
    }catch(e){return false;}
  }

  function saveTokens(d){localStorage.setItem(LS.TOKEN,d.access_token);if(d.refresh_token)localStorage.setItem(LS.REFRESH,d.refresh_token);localStorage.setItem(LS.EXPIRY,Date.now()+d.expires_in*1000);}

  async function getToken(){
    var exp=parseInt(localStorage.getItem(LS.EXPIRY)||'0');
    if(Date.now()>exp-60000){var ok=await refreshToken();if(!ok)return null;}
    return localStorage.getItem(LS.TOKEN);
  }

  function isConnected(){return !!(localStorage.getItem(LS.TOKEN)&&localStorage.getItem(LS.REFRESH));}

  function disconnect(){
    [LS.TOKEN,LS.REFRESH,LS.EXPIRY,LS.CV].forEach(k=>localStorage.removeItem(k));
    currentState=null;stopPolling();render();updateSettingsUI();updateNavBtn();
  }

  // ── API ───────────────────────────────────────────────────
  async function api(path,opts={}){
    var token=await getToken();if(!token)return null;
    var r=await fetch('https://api.spotify.com/v1'+path,{...opts,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(opts.headers||{})}});
    if(r.status===401){disconnect();return null;}
    if(r.status===204||r.status===202)return{};
    if(!r.ok)return null;
    try{return await r.json();}catch{return{};}
  }

  // ── Controls ──────────────────────────────────────────────
  function devParam(){var d=localStorage.getItem(LS.DEVICE);return d?'?device_id='+d:'';}
  async function play(uri,devId){var d=devId||localStorage.getItem(LS.DEVICE);var body=uri?(uri.includes(':track:')?{uris:[uri]}:{context_uri:uri}):{};await api('/me/player/play'+(d?'?device_id='+d:''),{method:'PUT',body:JSON.stringify(body)});setTimeout(poll,600);}
  async function pause(){await api('/me/player/pause'+devParam(),{method:'PUT'});setTimeout(poll,400);}
  async function resume(){await api('/me/player/play'+devParam(),{method:'PUT'});setTimeout(poll,400);}
  async function next(){await api('/me/player/next'+devParam(),{method:'POST'});setTimeout(poll,900);}
  async function prev(){await api('/me/player/previous'+devParam(),{method:'POST'});setTimeout(poll,900);}
  async function seek(ms){await api('/me/player/seek?position_ms='+Math.round(ms)+devParam().replace('?','&'),{method:'PUT'});}
  async function setVol(pct){await api('/me/player/volume?volume_percent='+Math.round(pct)+devParam().replace('?','&'),{method:'PUT'});}
  async function transferTo(devId){localStorage.setItem(LS.DEVICE,devId);await api('/me/player',{method:'PUT',body:JSON.stringify({device_ids:[devId],play:false})});setTimeout(poll,1200);renderDeviceList();}

  // ── Fetch ─────────────────────────────────────────────────
  async function poll(){
    if(!isConnected())return;
    var s=await api('/me/player?additional_types=track,episode');
    if(!s)return;currentState=s;progressEpoch=Date.now();renderNP();updateNavBtn();
    if(typeof orbMusicSyncState==='function')orbMusicSyncState(s);
  }
  function _tickProgress(){
    if(!currentState||!currentState.is_playing)return;
    var elapsed=Date.now()-progressEpoch;
    var prog=Math.min((currentState.progress_ms||0)+elapsed,(currentState.item&&currentState.item.duration_ms)||999999);
    var dur=(currentState.item&&currentState.item.duration_ms)||1;
    var pct=Math.min(100,(prog/dur)*100);
    var elEl=document.getElementById('spp-elapsed');
    var fillEl=document.getElementById('spp-fill');
    if(elEl)elEl.textContent=fmtMs(prog);
    if(fillEl)fillEl.style.width=pct+'%';
  }
  function startPolling(){
    if(pollTimer)return;
    poll();
    pollTimer=setInterval(poll,5000);
    if(!progressTimer)progressTimer=setInterval(_tickProgress,1000);
  }
  function stopPolling(){
    if(pollTimer){clearInterval(pollTimer);pollTimer=null;}
    if(progressTimer){clearInterval(progressTimer);progressTimer=null;}
  }
  async function fetchDevices(){var d=await api('/me/player/devices');devices=d?.devices||[];return devices;}
  async function search(q,types='track,album,playlist',limit=7){return api('/search?q='+encodeURIComponent(q)+'&type='+types+'&limit='+limit);}
  async function fetchPlaylists(){return api('/me/playlists?limit=30');}
  async function fetchLiked(){return api('/me/tracks?limit=30');}
  async function fetchRecent(){return api('/me/player/recently-played?limit=20');}

  // ── Voice ─────────────────────────────────────────────────
  async function handleVoice(cmd){
    var c=cmd.toLowerCase().trim();
    if(c.includes('pause')||c.includes('stop music')){await pause();return'Paused, sir.';}
    if(c.includes('resume')||c.includes('play music')){await resume();return'Resuming, sir.';}
    if(c.includes('skip')||c.includes('next song')||c.includes('next track')){await next();return'Skipping, sir.';}
    if(c.includes('previous')||c.includes('go back')||c.includes('last song')){await prev();return'Going back, sir.';}
    if(c.includes("what's playing")||c.includes('now playing')||c.includes('whats playing')){
      if(!currentState||!currentState.item)await poll();
      var t=currentState?.item;if(!t)return'Nothing playing right now, sir.';
      var name=t.name,artist=t.artists?.[0]?.name||'';return artist?name+' by '+artist+'.':name+'.';
    }
    var pm=c.match(/^play\s+(.+)$/);
    if(pm){
      var raw=pm[1];
      // Parse "song by artist" or "song from artist" patterns
      var byMatch=raw.match(/^(.+?)\s+(?:by|from)\s+(.+)$/i);
      var searchQ;
      if(byMatch){
        var songPart=byMatch[1].trim();
        var artistPart=byMatch[2].trim();
        searchQ='track:"'+songPart+'" artist:"'+artistPart+'"';
      } else {
        searchQ=raw;
      }
      var r=await search(searchQ,'track',5);
      var items=r?.tracks?.items||[];
      // If exact search returned nothing, fall back to plain search
      if(!items.length&&byMatch){
        r=await search(raw,'track',5);
        items=r?.tracks?.items||[];
      }
      var tr=items[0];
      if(tr){await play(tr.uri);showPanel();return'Playing '+tr.name+' by '+tr.artists[0].name+'.';}
      return'Could not find that track, sir.';
    }
    return null;
  }

  // ── Panel ─────────────────────────────────────────────────
  function showPanel(){
    var p=document.getElementById('spotify-panel');
    p.classList.add('sp-vis');
    // Normalise position now that it's visible so drag/resize work immediately
    if(p._wbNormalise)p._wbNormalise();
    render();
    // Immediately refresh state so we don't sit on stale/null for 5s
    if(isConnected())poll();
  }
  function hidePanel(){document.getElementById('spotify-panel').classList.remove('sp-vis');}
  function togglePanel(){
    var p=document.getElementById('spotify-panel');
    p.classList.toggle('sp-vis');
    if(p.classList.contains('sp-vis')){
      if(p._wbNormalise)p._wbNormalise();
      render();
      if(isConnected())poll();
    }
  }

  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function fmtMs(ms){var s=Math.floor(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}

  // ── Render router ─────────────────────────────────────────
  function render(){
    var body=document.getElementById('spp-body');if(!body)return;
    if(!isConnected()){renderNotConnected(body);return;}
    if(!body.querySelector('.spp-tabs')){buildTabs(body);}
    renderNP();
  }

  function buildTabs(body){
    body.innerHTML=`
      <div class="spp-tabs">
        <button class="spp-tab act" data-t="np">▶ Now</button>
        <button class="spp-tab" data-t="search">⌕ Search</button>
        <button class="spp-tab" data-t="lib">♫ Library</button>
        <button class="spp-tab" data-t="dev">⊕ Devices</button>
      </div>
      <div class="spp-view act" id="spp-v-np"></div>
      <div class="spp-view" id="spp-v-search"></div>
      <div class="spp-view" id="spp-v-lib"></div>
      <div class="spp-view" id="spp-v-dev"></div>
    `;
    body.querySelectorAll('.spp-tab').forEach(tab=>{
      tab.addEventListener('click',()=>switchTab(tab.dataset.t));
    });
    buildSearchView();buildLibView();buildDevView();
  }

  function switchTab(name){
    document.querySelectorAll('.spp-tab').forEach(t=>t.classList.toggle('act',t.dataset.t===name));
    document.querySelectorAll('.spp-view').forEach(v=>v.classList.toggle('act',v.id==='spp-v-'+name));
    if(name==='dev')renderDeviceList();
    if(name==='lib')loadLib('pl');
  }

  // ── Now Playing ───────────────────────────────────────────
  function renderNP(){
    var view=document.getElementById('spp-v-np');if(!view)return;
    var s=currentState;
    if(!s||!s.item){view.innerHTML='<div class="spp-idle">♫<br>Nothing playing.<br><small style="font-size:10px;opacity:.6">Open Spotify on a device, then search or pick from Library.</small></div>';return;}
    var it=s.item,playing=s.is_playing,prog=s.progress_ms||0,dur=it.duration_ms||1;
    var pct=Math.min(100,(prog/dur)*100);
    var art=it.album?.images?.[1]?.url||it.album?.images?.[0]?.url||'';
    var artist=it.artists?.map(a=>a.name).join(', ')||'';
    var vol=s.device?.volume_percent??50;
    view.innerHTML=`
      <div class="spp-np">
        <div class="spp-trow">
          ${art?`<img class="spp-art" src="${esc(art)}" alt="">`:'<div class="spp-art-ph">♫</div>'}
          <div class="spp-meta">
            <div class="spp-tn" title="${esc(it.name)}">${esc(it.name)}</div>
            <div class="spp-an">${esc(artist)}</div>
            <div class="spp-aln">${esc(it.album?.name||'')}</div>
          </div>
        </div>
        <div class="spp-prog-wrap">
          <span class="spp-t" id="spp-elapsed">${fmtMs(prog)}</span>
          <div class="spp-prog" id="spp-prog">
            <div class="spp-fill" id="spp-fill" style="width:${pct}%"></div>
          </div>
          <span class="spp-t r">${fmtMs(dur)}</span>
        </div>
        <div class="spp-ctrls">
          <button class="spp-btn" id="spp-prev">⏮</button>
          <button class="spp-btn spp-main" id="spp-pp">${playing?'⏸':'▶'}</button>
          <button class="spp-btn" id="spp-next">⏭</button>
        </div>
        <div class="spp-vol">
          <span class="spp-vi">🔈</span>
          <input type="range" class="spp-slider" id="spp-vol" min="0" max="100" value="${vol}">
          <span class="spp-vi">🔊</span>
        </div>
      </div>`;
    document.getElementById('spp-pp').addEventListener('click',()=>{playing?pause():resume();});
    document.getElementById('spp-prev').addEventListener('click',prev);
    document.getElementById('spp-next').addEventListener('click',next);
    document.getElementById('spp-prog').addEventListener('click',e=>{seek((e.offsetX/e.currentTarget.offsetWidth)*dur);});
    var vt;document.getElementById('spp-vol').addEventListener('input',e=>{clearTimeout(vt);vt=setTimeout(()=>setVol(+e.target.value),300);});
  }

  // ── Search ────────────────────────────────────────────────
  function buildSearchView(){
    var v=document.getElementById('spp-v-search');if(!v)return;
    v.innerHTML=`<div class="spp-sw"><div class="spp-srow"><input class="spp-si" id="spp-si" placeholder="Search tracks, albums, playlists…" type="text"><button class="spp-sg" id="spp-sg">⌕</button></div><div class="spp-res" id="spp-res"></div></div>`;
    document.getElementById('spp-sg').addEventListener('click',doSearch);
    document.getElementById('spp-si').addEventListener('keydown',e=>{if(e.key==='Enter')doSearch();});
  }

  async function doSearch(){
    var q=document.getElementById('spp-si')?.value?.trim();if(!q)return;
    var res=document.getElementById('spp-res');res.innerHTML='<div style="padding:10px;font-size:11px;color:var(--muted)">Searching…</div>';
    var d=await search(q,'track,album,playlist',6);
    if(!d){res.innerHTML='<div style="padding:10px;font-size:11px;color:var(--red)">Search failed.</div>';return;}
    var html='';
var tracks=(d.tracks?.items||[]).filter(Boolean);
    if(tracks.length){html+='<div class="spp-rsec">Tracks</div>';tracks.forEach(t=>{var a=t.album?.images?.[2]?.url||t.album?.images?.[0]?.url||'';html+=`<div class="spp-ri" data-uri="${t.uri}">${a?`<img class="spp-rthumb" src="${a}">`:'<div class="spp-rthumb"></div>'}<div class="spp-rm"><div class="spp-rn">${esc(t.name)}</div><div class="spp-rs">${esc(t.artists?.map(a=>a.name).join(', ')||'')}</div></div></div>`;});}
    var albums=(d.albums?.items||[]).filter(Boolean);
    if(albums.length){html+='<div class="spp-rsec">Albums</div>';albums.slice(0,3).forEach(a=>{var img=a.images?.[2]?.url||a.images?.[0]?.url||'';html+=`<div class="spp-ri" data-uri="${a.uri}">${img?`<img class="spp-rthumb" src="${img}">`:'<div class="spp-rthumb"></div>'}<div class="spp-rm"><div class="spp-rn">${esc(a.name)}</div><div class="spp-rs">${esc(a.artists?.map(x=>x.name).join(', ')||'')}</div></div></div>`;});}
    var playlists=(d.playlists?.items||[]).filter(Boolean);
    if(playlists.length){html+='<div class="spp-rsec">Playlists</div>';playlists.slice(0,3).forEach(p=>{var img=p.images?.[0]?.url||'';html+=`<div class="spp-ri" data-uri="${p.uri}">${img?`<img class="spp-rthumb" src="${img}">`:'<div class="spp-rthumb"></div>'}<div class="spp-rm"><div class="spp-rn">${esc(p.name)}</div><div class="spp-rs">${esc(p.description||'')}</div></div></div>`;});}
    if(!html){res.innerHTML='<div style="padding:10px;font-size:11px;color:var(--muted)">No results.</div>';return;}
    res.innerHTML=html;
    res.querySelectorAll('.spp-ri').forEach(item=>{item.addEventListener('click',()=>{play(item.dataset.uri);switchTab('np');});});
  }

  // ── Library ───────────────────────────────────────────────
  function buildLibView(){
    var v=document.getElementById('spp-v-lib');if(!v)return;
    v.innerHTML=`<div class="spp-lw"><div class="spp-ltabs"><button class="spp-ltab lact" data-lb="pl">Playlists</button><button class="spp-ltab" data-lb="liked">Liked</button><button class="spp-ltab" data-lb="recent">Recent</button></div><div class="spp-li" id="spp-li"></div></div>`;
    v.querySelectorAll('.spp-ltab').forEach(t=>{t.addEventListener('click',()=>{v.querySelectorAll('.spp-ltab').forEach(x=>x.classList.remove('lact'));t.classList.add('lact');loadLib(t.dataset.lb);});});
  }

  async function loadLib(type){
    var c=document.getElementById('spp-li');if(!c)return;
    c.innerHTML='<div style="padding:10px;font-size:11px;color:var(--muted)">Loading…</div>';
    var items=[];
    var _d;
    if(type==='pl'){_d=await fetchPlaylists();items=(_d?.items||[]).map(p=>({uri:p.uri,name:p.name,sub:(p.tracks?.total||'?')+' tracks',art:p.images?.[0]?.url||''}));}
    else if(type==='liked'){_d=await fetchLiked();items=(_d?.items||[]).map(i=>({uri:i.track.uri,name:i.track.name,sub:i.track.artists?.map(a=>a.name).join(', ')||'',art:i.track.album?.images?.[2]?.url||''}));}
    else{_d=await fetchRecent();items=(_d?.items||[]).map(i=>({uri:i.track.uri,name:i.track.name,sub:i.track.artists?.map(a=>a.name).join(', ')||'',art:i.track.album?.images?.[2]?.url||''}));}
    if(!items.length){c.innerHTML='<div style="padding:10px;font-size:11px;color:var(--muted)">Nothing here yet.</div>';return;}
    c.innerHTML=items.map(i=>`<div class="spp-ri" data-uri="${i.uri}">${i.art?`<img class="spp-rthumb" src="${i.art}">`:'<div class="spp-rthumb"></div>'}<div class="spp-rm"><div class="spp-rn">${esc(i.name)}</div><div class="spp-rs">${esc(i.sub)}</div></div></div>`).join('');
    c.querySelectorAll('.spp-ri').forEach(item=>{item.addEventListener('click',()=>{play(item.dataset.uri);switchTab('np');});});
  }

  // ── Devices ───────────────────────────────────────────────
  function buildDevView(){
    var v=document.getElementById('spp-v-dev');if(!v)return;
    v.innerHTML=`<div class="spp-dw"><div class="spp-dhdr"><span class="spp-dlbl">Available Devices</span><button class="spp-dref" id="spp-dref" title="Refresh">↺</button></div><div id="spp-dlist"></div></div>`;
    document.getElementById('spp-dref').addEventListener('click',renderDeviceList);
    renderDeviceList();
  }

  async function renderDeviceList(){
    var list=document.getElementById('spp-dlist');if(!list)return;
    list.innerHTML='<div style="padding:7px 0;font-size:11px;color:var(--muted)">Refreshing…</div>';
    var devs=await fetchDevices();
    if(!devs.length){list.innerHTML='<div style="padding:7px 0;font-size:11px;color:var(--muted)">No devices found.<br><span style="opacity:.6;font-size:10px">Open Spotify on a device first.</span></div>';return;}
    var activeId=localStorage.getItem(LS.DEVICE);
    list.innerHTML=devs.map(d=>{
      var isAct=d.id===activeId||d.is_active;
      var ico=d.type==='Smartphone'?'📱':d.type==='Computer'?'💻':'🔊';
      return`<div class="spp-di${isAct?' spp-dact':''}" data-id="${d.id}"><span class="spp-dico">${ico}</span><div class="spp-dinfo"><div class="spp-dname">${esc(d.name)}</div><div class="spp-dtype">${esc(d.type)}</div></div>${isAct?'<div class="spp-ddot"></div>':''}</div>`;
    }).join('');
    list.querySelectorAll('.spp-di').forEach(item=>{item.addEventListener('click',()=>{transferTo(item.dataset.id);list.querySelectorAll('.spp-di').forEach(x=>{x.classList.remove('spp-dact');x.querySelector('.spp-ddot')?.remove();});item.classList.add('spp-dact');item.insertAdjacentHTML('beforeend','<div class="spp-ddot"></div>');});});
  }

  // ── Not connected ─────────────────────────────────────────
  function renderNotConnected(body){
    var hasId=!!localStorage.getItem(LS.ID);
    body.innerHTML=`<div class="spp-nc"><svg width="36" height="36" viewBox="0 0 24 24" fill="#1db954" opacity="0.5"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg><div class="spp-nct">Connect Spotify</div><div class="spp-ncs">${!hasId?'Open Settings (⚙) and paste your<br>Spotify Client ID first.':'Tap below to authorize BAKER.'}</div><button class="spp-ncbtn" id="spp-conn-btn" ${!hasId?'disabled':''}>Connect with Spotify</button></div>`;
    if(hasId)document.getElementById('spp-conn-btn').addEventListener('click',connect);
  }

  // ── Settings UI ───────────────────────────────────────────
  function saveClientId(){
    var v=document.getElementById('sp-set-id-inp')?.value?.trim();
    if(v){localStorage.setItem(LS.ID,v);updateSettingsUI();}
  }

  function updateSettingsUI(){
    var statusEl=document.getElementById('sp-set-status');
    var authRow=document.getElementById('sp-set-auth-row');
    if(!statusEl||!authRow)return;
    if(isConnected()){
      statusEl.className='sp-set-status ok';statusEl.textContent='✓ Connected to Spotify';
      authRow.innerHTML='<button class="sp-disc" id="sp-disc-btn">Disconnect Spotify</button>';
      document.getElementById('sp-disc-btn').addEventListener('click',disconnect);
    } else {
      var hasId=!!localStorage.getItem(LS.ID);
      statusEl.className='sp-set-status';statusEl.textContent=hasId?'Not connected — tap Connect to authorize':'Enter Client ID above';
      authRow.innerHTML=hasId?'<button class="sp-set-gbtn" id="sp-conn-settings-btn" style="width:100%;padding:8px">Connect Spotify</button>':'';
      if(hasId)document.getElementById('sp-conn-settings-btn').addEventListener('click',connect);
    }
  }

  // ── Nav button ────────────────────────────────────────────
  function updateNavBtn(){
    var btn=document.getElementById('sp-nav-btn');var lbl=document.getElementById('sp-nav-lbl');if(!btn||!lbl)return;
    if(currentState?.is_playing&&currentState.item){
      btn.classList.add('sp-playing');
      var n=currentState.item.name;lbl.textContent=n.length>16?n.slice(0,14)+'…':n;
    } else {
      btn.classList.remove('sp-playing');lbl.textContent='Music';
    }
  }

  // ── Init ──────────────────────────────────────────────────
  async function init(){
    var params=new URLSearchParams(window.location.search);
    if(params.has('code')){
      try{await exchangeCode(params.get('code'));}catch(e){console.error('[SP] Auth failed',e);}
    }
    if(isConnected())startPolling();
    var idInp=document.getElementById('sp-set-id-inp');
    if(idInp){var saved=localStorage.getItem(LS.ID);if(saved)idInp.value=saved;}
    updateSettingsUI();updateNavBtn();
  }

  return{init,connect,disconnect,play,pause,resume,next,prev,seek,setVol,transferTo,search,showPanel,hidePanel,togglePanel,handleVoice,isConnected,saveClientId,updateSettingsUI,updateNavBtn,getCurrentTrack:()=>currentState};
})();
