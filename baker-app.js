// BAKER conversation app — all JS in one external file
(function(){
  var canvas=document.getElementById('orb-canvas');
  var gl=canvas&&canvas.getContext('webgl');
  if(gl){
    var W=0,H=0;
    function resize(){W=canvas.offsetWidth;H=canvas.offsetHeight;canvas.width=W;canvas.height=H;}
    resize();window.addEventListener('resize',resize);
    var vert='attribute vec2 a;void main(){gl_Position=vec4(a,0,1);}';
    var fragOrb=['precision highp float;','uniform vec2 R;uniform float T;uniform sampler2D C0;','#define PI 3.14159265359','const vec3 theme=vec3(0.118,0.580,0.643);','float gR=(1.0+pow(5.0,0.5))/2.0;','float h11(float p){p=fract(p*.1031);p*=p+33.33;p*=p+p;return fract(p);}','float circ(vec2 uv,float r,float b){return smoothstep(r,r-b,length(uv)-r);}','void main(){','  vec2 uv=(2.0*gl_FragCoord.xy-R)/R.y;float bias=8.0/R.x;','  vec3 col=vec3(0.0);float t=(T+80.0)/3.0;','  for(float i=0.0;i<300.0;i++){','    float th=2.0*PI*i/gR;float ph=sin(acos(1.0-2.0*i/300.0))*0.475;','    float rd=(h11(i)>0.5?1.0:-1.0);th-=t*rd;','    col+=circ(uv+vec2(cos(th)*ph,sin(th)*ph),14.0/R.x,bias)*theme*((abs(sin(th)*ph)+abs(cos(th)*ph))/5.0);','  }','  col+=circ(uv,0.25,bias);col-=circ(uv,0.25-(3.0/R.y),bias);','  vec3 prv=texture2D(C0,gl_FragCoord.xy/R).rgb;col=mix(col,prv,0.95);','  gl_FragColor=vec4(col,1.0);}'].join('\n');
    var fragComp=['precision highp float;','uniform vec2 R;uniform float T;uniform float AU;uniform float SPD;uniform sampler2D C0;','#define PI 3.14159265359','#define TAU 6.28318530718','const vec3 theme=vec3(0.118,0.580,0.643);','vec3 hsb2rgb(vec3 c){vec3 rgb=clamp(abs(mod(c.x*6.0+vec3(0,4,2),6.0)-3.0)-1.0,0.0,1.0);rgb*=rgb*(3.0-2.0*rgb);return c.z*mix(vec3(1),rgb,c.y);}','float circ(vec2 uv,float r,float b){return smoothstep(r,r-b,length(uv)-r);}','vec2 sv=vec2(1.0,1.7320508);','float hexSDF(vec2 p){p=abs(p);return max(dot(p,sv*0.5),p.x);}','vec4 getHex(vec2 p){vec4 hC=floor(vec4(p,p-vec2(0.5,1.0))/sv.xyxy)+0.5;vec4 h=vec4(p-hC.xy*sv,p-(hC.zw+0.5)*sv);return dot(h.xy,h.xy)<dot(h.zw,h.zw)?vec4(h.xy,hC.xy):vec4(h.zw,hC.zw+0.5);}','vec3 hexLayer(vec2 uv,float sc,vec3 col){float asp=R.x/R.y;vec2 hv=getHex(sc*uv*vec2(asp,1.0)).xy;float d=hexSDF(hv);return mix(vec3(0),vec3(1),smoothstep(0.0,0.03,d-0.5+0.04))*col;}','vec3 arcLayer(vec2 p,float r,float o,vec3 col,float bias){float d=circ(p,r,bias);d-=circ(p,r-o,bias);float angle=atan(p.y,p.x)+PI+T*SPD;float lA=TAU/3.0,sA=TAU/48.0;if(abs(mod(angle,lA)-lA/2.0)<0.06)d-=1.0;if(abs(mod(angle,sA)-sA/2.0)<0.01)d-=1.0;return max(0.0,d)*col*0.2;}','void main(){','  vec2 uv=gl_FragCoord.xy/R;vec2 p=(uv-0.5)*vec2(R.x/R.y,1.0);float bias=8.0/R.x;vec3 col=vec3(0.0);','  col+=arcLayer(p,0.18,0.025,theme*vec3(0.75,0.75,1.25),bias);','  col+=texture2D(C0,uv).rgb;','  float audio=pow(AU,3.5);float d=length(p)-0.4;','  vec3 wm=vec3(1.0);wm*=smoothstep(0.2,0.4,uv.x);wm*=smoothstep(0.2,0.4,1.0-uv.x);','  col+=(1.0-smoothstep(0.0,0.02,abs(audio-d)))*theme*max(0.001,audio*5.0)*wm;','  col+=pow(abs(0.025/d*audio),1.2)*theme*wm;','  vec3 hl=hexLayer(uv,25.0,theme*1.5);col+=col*hl;','  float ga=atan(p.y,p.x)+PI-T;col*=hsb2rgb(vec3(ga/TAU,length(p)*1.25,0.8));','  col=(col*(2.51*col+0.03))/(col*(2.43*col+0.59)+0.14);col=pow(col,vec3(1.0/2.2));','  gl_FragColor=vec4(col,1.0);}'].join('\n');
    var fragBlit='precision mediump float;uniform sampler2D uT;uniform vec2 R;void main(){gl_FragColor=texture2D(uT,gl_FragCoord.xy/R);}';
    function mkProg(fs){function sh(t,src){var s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);return s;}var p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,vert));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);return p;}
    var orbProg=mkProg(fragOrb),compProg=mkProg(fragComp),blitProg=mkProg(fragBlit);
    var buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    function bindQ(p){var l=gl.getAttribLocation(p,'a');gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,2,gl.FLOAT,false,0,0);}
    function mkFBO(){var tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);var fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);return{tex:tex,fb:fb};}
    var orbA=mkFBO(),orbB=mkFBO(),compFBO=mkFBO();
    function resizeFBO(f){gl.bindTexture(gl.TEXTURE_2D,f.tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,null);}
    var oU={R:gl.getUniformLocation(orbProg,'R'),T:gl.getUniformLocation(orbProg,'T'),C0:gl.getUniformLocation(orbProg,'C0')};
    var cU={R:gl.getUniformLocation(compProg,'R'),T:gl.getUniformLocation(compProg,'T'),AU:gl.getUniformLocation(compProg,'AU'),SPD:gl.getUniformLocation(compProg,'SPD'),C0:gl.getUniformLocation(compProg,'C0')};
    var bU={uT:gl.getUniformLocation(blitProg,'uT'),R:gl.getUniformLocation(blitProg,'R')};
    var analyser=null,dataArr=null,audioCtx=null,audioLevel=0;
    window.orbInitAudio=function(){if(audioCtx)return;try{audioCtx=new AudioContext();navigator.mediaDevices.getUserMedia({audio:true}).then(function(s){var src=audioCtx.createMediaStreamSource(s);analyser=audioCtx.createAnalyser();analyser.fftSize=256;dataArr=new Uint8Array(analyser.frequencyBinCount);src.connect(analyser);}).catch(function(){});}catch(e){}};
    function getMicLevel(){if(!analyser)return 0;analyser.getByteFrequencyData(dataArr);var sum=0;for(var i=0;i<dataArr.length;i++)sum+=dataArr[i];return(sum/dataArr.length)/255;}
    window.orbState='idle';
    var start=performance.now(),interval=1000/15,last=0,lastW=0,lastH=0;
    function draw(now){
      requestAnimationFrame(draw);
      if(now-last<interval)return;last=now;
      var cW=canvas.offsetWidth,cH=canvas.offsetHeight;
      if(cW!==lastW||cH!==lastH){W=canvas.width=cW;H=canvas.height=cH;resizeFBO(orbA);resizeFBO(orbB);resizeFBO(compFBO);lastW=cW;lastH=cH;}
      if(!W||!H)return;
      var t=(now-start)/1000,s=window.orbState||'idle',a=0;
      if(s==='listening'){a=getMicLevel();if(a<0.02)a=0.04+0.03*Math.abs(Math.sin(t*2.1));}
      else if(s==='speaking'){a=0.12+0.10*Math.abs(Math.sin(t*4.5))+0.06*Math.abs(Math.sin(t*7.3));}
      else if(s==='thinking'){a=0.06+0.04*Math.abs(Math.sin(t*3.0));}
      else{a=0.03+0.02*Math.abs(Math.sin(t*1.3));}
      audioLevel=audioLevel*0.75+a*0.25;
      var spd=s==='thinking'?3.0:s==='speaking'?1.8:s==='listening'?1.2:0.5;
      gl.useProgram(orbProg);bindQ(orbProg);gl.bindFramebuffer(gl.FRAMEBUFFER,orbB.fb);gl.viewport(0,0,W,H);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,orbA.tex);gl.uniform1i(oU.C0,0);gl.uniform2f(oU.R,W,H);gl.uniform1f(oU.T,t);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      var tmp=orbA;orbA=orbB;orbB=tmp;
      gl.useProgram(compProg);bindQ(compProg);gl.bindFramebuffer(gl.FRAMEBUFFER,compFBO.fb);gl.viewport(0,0,W,H);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,orbA.tex);gl.uniform1i(cU.C0,0);gl.uniform2f(cU.R,W,H);gl.uniform1f(cU.T,t);gl.uniform1f(cU.AU,audioLevel);gl.uniform1f(cU.SPD,spd);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      gl.useProgram(blitProg);bindQ(blitProg);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,W,H);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,compFBO.tex);gl.uniform1i(bU.uT,0);gl.uniform2f(bU.R,W,H);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    }
    requestAnimationFrame(draw);
  }
})();

function setOrbState(s){window.orbState=s;var l=document.getElementById('orb-label');if(l)l.textContent=s;}

var state={history:[],busy:false,vaultHandle:null,vaultIndex:[],vaultConnected:false,autoNotes:[],manualNotes:[],noteStore:{},skipHotWord:false};
var hasFS=('showDirectoryPicker' in window);
var voiceMode=false,voiceRec=null,voiceActive=false,isSpeaking=false;
var voiceFinal='',speechRate=0.92,silenceTimer=null,wakeRec=null;
var constantMic=localStorage.getItem('baker_constant_mic')==='true';
var HOT_WORDS=['hey baker','baker','yo baker','ok baker'];
var spotifyToken=null,spotifyClientId=localStorage.getItem('baker_spotify_id')||'';

function getTimeGreeting(){var h=new Date().getHours();if(h>=5&&h<12)return 'Good morning, sir.';if(h>=12&&h<17)return 'Good afternoon, sir.';if(h>=17&&h<21)return 'Good evening, sir.';return "You're up late, sir.";}
function getContextBlock(){var now=new Date();return '[Date: '+now.toLocaleDateString([],{weekday:'long',year:'numeric',month:'long',day:'numeric'})+' | Time: '+now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+']';}

document.addEventListener('DOMContentLoaded',function(){
  document.getElementById('send-btn').addEventListener('click',sendMessage);
  document.getElementById('vault-btn').addEventListener('click',handleVaultBtn);
  document.getElementById('load-btn').addEventListener('click',function(){document.getElementById('manual-file-input').click();});
  document.getElementById('manual-file-input').addEventListener('change',loadManualNotes);
  document.getElementById('dl-btn').addEventListener('click',downloadNote);
  document.getElementById('msg-input').addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}});
  document.getElementById('msg-input').addEventListener('input',function(){this.style.height='auto';this.style.height=Math.min(this.scrollHeight,120)+'px';});
  var starters={s1:'Help me think through a project idea',s2:'I want to reflect on my day',s3:'Help me understand something I am studying',s4:'What do my notes say about my current projects?',s5:'Create a new project note for me',s6:'__weather__',s7:'__spotify__'};
  Object.keys(starters).forEach(function(id){var el=document.getElementById(id);if(el)el.addEventListener('click',function(){if(starters[id]==='__weather__')fetchWeatherAndReport();else if(starters[id]==='__spotify__')fetchSpotifyAndReport();else sendStarter(starters[id]);});});
  var effort=localStorage.getItem('baker_effort')||'standard';
  document.getElementById('effort-pill').textContent=effort;
  var wt=document.getElementById('welcome-title');if(wt)wt.textContent=getTimeGreeting();
  var ws=document.getElementById('welcome-sub');if(ws)ws.textContent='Vault and voice ready when you are, sir.';
  var sr=parseFloat(localStorage.getItem('baker_speech_rate'));if(!isNaN(sr))speechRate=sr;
  var ctxRaw=sessionStorage.getItem('baker_convo_context');
  if(ctxRaw){sessionStorage.removeItem('baker_convo_context');try{var ctx=JSON.parse(ctxRaw);if(ctx.topic)document.getElementById('topic').value=ctx.topic;if(ctx.context){state.history.push({role:'user',content:'System information: '+ctx.context+(ctx.instruction?' '+ctx.instruction:'')});state.history.push({role:'assistant',content:'Understood, sir. Context loaded and ready.'});appendSys('Context loaded from '+(ctx.source||'BAKER')+'.');document.getElementById('dl-btn').disabled=false;}}catch(e){}}
  checkSpotifyCallback();
  if(constantMic){startWakeWord();setMode('voice');}
  if(hasFS){tryReconnectVault();}else{document.getElementById('vault-btn').textContent='⬡ Vault (Chrome only)';document.getElementById('vault-btn').disabled=true;setSb('','Automatic vault scanning requires Chrome on desktop');}
});

function openDB(){return new Promise(function(res,rej){var r=indexedDB.open('baker-vault',1);r.onupgradeneeded=function(e){e.target.result.createObjectStore('handles',{keyPath:'id'});};r.onsuccess=function(e){res(e.target.result);};r.onerror=function(){rej(r.error);};});}
async function storeHandle(h){try{var db=await openDB();db.transaction('handles','readwrite').objectStore('handles').put({id:'vault',handle:h});}catch(e){}}
async function getStoredHandle(){try{var db=await openDB();return new Promise(function(res){var r=db.transaction('handles','readonly').objectStore('handles').get('vault');r.onsuccess=function(){res(r.result?r.result.handle:null);};r.onerror=function(){res(null);};});}catch(e){return null;}}
async function clearHandle(){try{var db=await openDB();db.transaction('handles','readwrite').objectStore('handles').delete('vault');}catch(e){}}

async function tryReconnectVault(){var stored=await getStoredHandle();if(!stored)return;setVaultBtn('scanning');setSb('amber','⟳ Reconnecting vault...');try{var perm=await stored.requestPermission({mode:'readwrite'});if(perm==='granted'){await doConnect(stored);}else{await clearHandle();setVaultBtn('off');setSb('','Click Connect Vault to connect your BAKER folder');}}catch(e){await clearHandle();setVaultBtn('off');setSb('','Click Connect Vault to connect your BAKER folder');}}
async function handleVaultBtn(){if(!hasFS){alert('Requires Chrome on desktop.');return;}if(state.vaultConnected){state.vaultHandle=null;state.vaultIndex=[];state.vaultConnected=false;state.autoNotes=[];await clearHandle();setVaultBtn('off');setSb('','Vault disconnected');renderStatusBar();appendSys('Vault disconnected.');}else{try{var handle=await window.showDirectoryPicker({mode:'readwrite'});await doConnect(handle);}catch(e){if(e.name!=='AbortError')setSb('','Connection failed: '+e.message);setVaultBtn('off');}}}
async function doConnect(handle){state.vaultHandle=handle;await storeHandle(handle);setVaultBtn('scanning');setSb('amber','⟳ Scanning vault...');state.vaultIndex=[];await scanDir(handle,'');state.vaultConnected=true;setVaultBtn('on');setSb('ok','⬡ '+state.vaultIndex.length+' notes indexed · auto-retrieval on');appendSys('Vault connected, sir. '+state.vaultIndex.length+' notes indexed.');}
async function scanDir(dir,path){try{for await(var entry of dir.values()){if(entry.name.startsWith('.'))continue;if(entry.kind==='file'&&entry.name.endsWith('.md')){try{var f=await entry.getFile();var content=await f.text();state.vaultIndex.push({name:entry.name,path:path?path+'/'+entry.name:entry.name,content:content});}catch(e){}}else if(entry.kind==='directory'){await scanDir(entry,path?path+'/'+entry.name:entry.name);}}}catch(e){}}
async function writeToVault(relPath,content){if(!state.vaultHandle)return false;try{var parts=relPath.replace(/^\/+/,'').split('/');var fileName=parts.pop();var dir=state.vaultHandle;for(var i=0;i<parts.length;i++)dir=await dir.getDirectoryHandle(parts[i],{create:true});var fh=await dir.getFileHandle(fileName,{create:true});var w=await fh.createWritable();await w.write(content);await w.close();var idx=state.vaultIndex.findIndex(function(n){return n.path===relPath;});if(idx>=0)state.vaultIndex[idx].content=content;else state.vaultIndex.push({name:fileName,path:relPath,content:content});return true;}catch(e){return false;}}

var STOP=new Set(['the','and','for','are','but','not','you','all','can','had','her','was','one','our','out','get','has','him','his','how','its','may','now','see','way','who','did','too','use','she','that','this','with','have','from','they','will','been','were','said','each','into','than','your','more','then','some','them','what','when','also','just','know','take','year','after','could','think','about','would','these','those','other','well','want','very','much','still','while','even','back','come','made','only','over','such','here','down','does','like','time','most']);
function findRelevant(query){if(!state.vaultIndex.length)return[];var words=query.toLowerCase().split(/\W+/).filter(function(w){return w.length>2&&!STOP.has(w);});if(!words.length)return[];var scored=state.vaultIndex.map(function(note){var text=(note.name+' '+note.content).toLowerCase();var score=0;words.forEach(function(w){var m=text.match(new RegExp(w,'g'));if(m){var tm=note.name.toLowerCase().match(new RegExp(w,'g'));score+=m.length+(tm?tm.length*3:0);}});return{note:note,score:score};});return scored.filter(function(s){return s.score>1;}).sort(function(a,b){return b.score-a.score;}).slice(0,5).map(function(s){return s.note;});}
function loadManualNotes(e){Array.from(e.target.files).forEach(function(file){var r=new FileReader();r.onload=function(ev){var i=state.manualNotes.findIndex(function(n){return n.name===file.name;});if(i>=0)state.manualNotes[i].content=ev.target.result;else state.manualNotes.push({name:file.name,content:ev.target.result});renderStatusBar();};r.readAsText(file);});e.target.value='';}
function removeManual(name){state.manualNotes=state.manualNotes.filter(function(n){return n.name!==name;});renderStatusBar();}

var WMO_CODES={0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',80:'Light showers',81:'Showers',82:'Heavy showers',95:'Thunderstorm'};
async function fetchWeather(){return new Promise(function(res,rej){if(!navigator.geolocation){rej(new Error('Geolocation not available'));return;}navigator.geolocation.getCurrentPosition(async function(pos){try{var lat=pos.coords.latitude.toFixed(4),lon=pos.coords.longitude.toFixed(4);var url='https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+'&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto';var r=await fetch(url);var d=await r.json();var c=d.current;res({temp:Math.round(c.temperature_2m),feels:Math.round(c.apparent_temperature),desc:WMO_CODES[c.weather_code]||'Unknown',wind:Math.round(c.wind_speed_10m),humidity:c.relative_humidity_2m});}catch(e){rej(e);}},function(e){rej(new Error('Location denied'));});})}
async function fetchWeatherAndReport(){appendSys('Fetching weather...');setOrbState('thinking');try{var w=await fetchWeather();var sysInfo='System information: Current weather — '+w.temp+'°F (feels like '+w.feels+'°F), '+w.desc+', wind '+w.wind+' mph, humidity '+w.humidity+'%.';showWeatherCard(w);await sendSystemInfo(sysInfo,'Tell the user the current weather in one natural sentence as JARVIS would.');}catch(e){appendSys('Weather unavailable: '+e.message);setOrbState('idle');}}
function showWeatherCard(w){var msgs=document.getElementById('messages');removeWelcome();var card=document.createElement('div');card.className='weather-card';card.innerHTML='<div class="weather-temp">'+w.temp+'°F</div><div class="weather-desc">'+w.desc+'<br>Feels like '+w.feels+'°F<br>Wind: '+w.wind+' mph · Humidity: '+w.humidity+'%</div>';var wrap=document.createElement('div');wrap.className='msg baker';wrap.appendChild(card);msgs.appendChild(wrap);msgs.scrollTop=msgs.scrollHeight;}

// PKCE helpers
async function generateCodeVerifier(){var array=new Uint8Array(32);window.crypto.getRandomValues(array);return btoa(String.fromCharCode.apply(null,array)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');}
async function generateCodeChallenge(verifier){var data=new TextEncoder().encode(verifier);var digest=await window.crypto.subtle.digest('SHA-256',data);return btoa(String.fromCharCode.apply(null,new Uint8Array(digest))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');}

function handleSpotifyBtn(){if(spotifyToken){fetchSpotifyAndReport();}else{initSpotify();}}

async function initSpotify(){
  spotifyClientId=localStorage.getItem('baker_spotify_id')||'';
  if(!spotifyClientId){spotifyClientId=prompt('Enter your Spotify Client ID (from developer.spotify.com):');if(!spotifyClientId)return;localStorage.setItem('baker_spotify_id',spotifyClientId);}
  var verifier=await generateCodeVerifier();
  var challenge=await generateCodeChallenge(verifier);
  localStorage.setItem('spotify_verifier',verifier);
  var redirect=encodeURIComponent('https://big-burr.github.io/BAKER/conversation.html');
  var scopes=encodeURIComponent('user-read-currently-playing user-read-playback-state user-modify-playback-state streaming app-remote-control user-read-private playlist-read-private playlist-modify-public playlist-modify-private');
  window.location.href='https://accounts.spotify.com/authorize?client_id='+spotifyClientId+'&response_type=code&redirect_uri='+redirect+'&scope='+scopes+'&code_challenge_method=S256&code_challenge='+challenge;
}

async function checkSpotifyCallback(){
  var params=new URLSearchParams(window.location.search);
  var code=params.get('code');
  if(!code)return;
  window.history.replaceState(null,'',window.location.pathname);
  var verifier=localStorage.getItem('spotify_verifier');
  if(!verifier)return;
  spotifyClientId=localStorage.getItem('baker_spotify_id')||'';
  try{
    var resp=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:spotifyClientId,grant_type:'authorization_code',code:code,redirect_uri:'https://big-burr.github.io/BAKER/conversation.html',code_verifier:verifier})});
    var data=await resp.json();
    if(data.access_token){
      spotifyToken=data.access_token;
      localStorage.setItem('baker_spotify_token',data.access_token);
      if(data.refresh_token)localStorage.setItem('baker_spotify_refresh',data.refresh_token);
      localStorage.setItem('baker_spotify_expiry',Date.now()+(data.expires_in*1000));
      localStorage.removeItem('spotify_verifier');
      document.getElementById('spotify-btn').className='hbtn spotify-on';
      document.getElementById('spotify-btn').textContent='♫ Spotify on';
      appendSys('Spotify connected, sir.');
    }
  }catch(e){appendSys('Spotify auth failed: '+e.message);}
}

async function refreshSpotifyToken(){
  var refresh=localStorage.getItem('baker_spotify_refresh');
  if(!refresh)return false;
  spotifyClientId=localStorage.getItem('baker_spotify_id')||'';
  try{
    var resp=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:spotifyClientId,grant_type:'refresh_token',refresh_token:refresh})});
    var data=await resp.json();
    if(data.access_token){
      spotifyToken=data.access_token;
      localStorage.setItem('baker_spotify_token',data.access_token);
      localStorage.setItem('baker_spotify_expiry',Date.now()+(data.expires_in*1000));
      if(data.refresh_token)localStorage.setItem('baker_spotify_refresh',data.refresh_token);
      return true;
    }
  }catch(e){}
  return false;
}

async function spotifyAPI(endpoint,method,body){
  if(!spotifyToken){
    var saved=localStorage.getItem('baker_spotify_token');
    var expiry=parseInt(localStorage.getItem('baker_spotify_expiry')||'0');
    if(saved&&Date.now()<expiry){spotifyToken=saved;}
    else if(localStorage.getItem('baker_spotify_refresh')){var ok=await refreshSpotifyToken();if(!ok)return null;}
    else return null;
  }
  try{
    var opts={method:method||'GET',headers:{Authorization:'Bearer '+spotifyToken}};
    if(body){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(body);}
    var r=await fetch('https://api.spotify.com/v1/'+endpoint,opts);
    if(r.status===401){var ok=await refreshSpotifyToken();if(!ok){appendSys('Spotify disconnected — reconnect.');return null;}return spotifyAPI(endpoint,method,body);}
    if(r.status===204||r.status===202)return{ok:true};
    if(r.ok)return await r.json();
    return null;
  }catch(e){return null;}
}
async function fetchSpotifyAndReport(){if(!spotifyToken){appendSys('Connect Spotify first using the ♫ button.');return;}setOrbState('thinking');var d=await spotifyAPI('me/player/currently-playing');if(!d||!d.item){appendSys('Nothing playing on Spotify right now.');setOrbState('idle');return;}var track={title:d.item.name,artist:d.item.artists.map(function(a){return a.name;}).join(', '),album:d.item.album.name,playing:d.is_playing};showSpotifyCard(track);var sysInfo='System information: Spotify is currently '+(track.playing?'playing':'paused')+' "'+track.title+'" by '+track.artist+'.';await sendSystemInfo(sysInfo,'Comment on the currently playing track as JARVIS would — brief, witty, one sentence.');}
function showSpotifyCard(track){removeWelcome();var card=document.createElement('div');card.className='spotify-card';card.innerHTML='<div class="spotify-track">♫ '+track.title+'</div><div class="spotify-artist">'+track.artist+' · '+track.album+'</div><div class="spotify-controls"><button class="sp-btn" onclick="spotifyControl(\'previous\')">⏮</button><button class="sp-btn" onclick="spotifyControl(\'toggle\')">'+( track.playing?'⏸':'▶')+'</button><button class="sp-btn" onclick="spotifyControl(\'next\')">⏭</button></div>';var wrap=document.createElement('div');wrap.className='msg baker';wrap.appendChild(card);var msgs=document.getElementById('messages');msgs.appendChild(wrap);msgs.scrollTop=msgs.scrollHeight;}
// ── Spotify device management ─────────────────────────────
var preferredDeviceId=localStorage.getItem('baker_spotify_device')||null;

async function getSpotifyDevices(){
  var d=await spotifyAPI('me/player/devices');
  if(!d||!d.devices)return[];
  return d.devices;
}

async function pickDevice(){
  var devices=await getSpotifyDevices();
  if(!devices.length){appendSys('No Spotify devices found — open Spotify on any device first.');return null;}
  // Use preferred device if still available
  if(preferredDeviceId){
    var pref=devices.find(function(d){return d.id===preferredDeviceId;});
    if(pref)return pref;
  }
  // If only one device, use it
  if(devices.length===1){preferredDeviceId=devices[0].id;localStorage.setItem('baker_spotify_device',preferredDeviceId);return devices[0];}
  // Show device picker card
  showDevicePicker(devices);
  return null;
}

function showDevicePicker(devices){
  removeWelcome();
  var msgs=document.getElementById('messages');
  var card=document.createElement('div');
  card.className='spotify-card';
  card.style.maxWidth='360px';
  var title=document.createElement('div');
  title.className='spotify-track';
  title.textContent='🎵 Choose a Spotify device:';
  card.appendChild(title);
  devices.forEach(function(device){
    var btn=document.createElement('button');
    btn.className='sp-btn';
    btn.style.cssText='display:block;width:100%;margin-top:6px;padding:8px;text-align:left;font-size:11px;';
    btn.textContent=(device.is_active?'▶ ':'○ ')+device.name+' ('+device.type+')';
    btn.addEventListener('click',function(){
      preferredDeviceId=device.id;
      localStorage.setItem('baker_spotify_device',device.id);
      card.innerHTML='<div class="spotify-track">✓ Using: '+device.name+'</div>';
      setTimeout(function(){card.closest('.msg').remove();},1500);
      appendSys('Got it — using '+device.name+' from now on, sir.');
    });
    card.appendChild(btn);
  });
  var wrap=document.createElement('div');wrap.className='msg baker';wrap.appendChild(card);
  msgs.appendChild(wrap);msgs.scrollTop=msgs.scrollHeight;
}

async function spotifySearch(query,type){
  type=type||'track';
  var results=await spotifyAPI('search?q='+encodeURIComponent(query)+'&type='+type+'&limit=5');
  if(!results)return null;
  if(type==='track')return results.tracks&&results.tracks.items.length?results.tracks.items[0]:null;
  if(type==='playlist')return results.playlists&&results.playlists.items.length?results.playlists.items:null;
  return null;
}

async function spotifyPlay(uri){
  var device=await pickDevice();
  if(!device)return false;
  // Play specific track URI directly on device
  var result=await spotifyAPI('me/player/play?device_id='+device.id,'PUT',{uris:[uri],position_ms:0});
  return result!==null;
}

async function spotifySearchAndPlay(query){
  appendSys('Searching Spotify for: '+query);
  setOrbState('thinking');
  // Use the API key to ask BAKER to extract a clean search query first
  var key=localStorage.getItem('baker_api_key');
  var searchQuery=query;
  if(key){
    try{
      var r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:50,system:'Extract the song title and artist from the user request and return ONLY a Spotify search query in format: track:"song title" artist:"artist name". If no artist mentioned just return track:"song title". No explanation, no punctuation, just the query.',messages:[{role:'user',content:query}]})});
      var d=await r.json();
      if(d.content&&d.content[0])searchQuery=d.content[0].text.trim();
    }catch(e){}
  }
  var track=await spotifySearch(searchQuery,'track');
  if(!track){
    // Fallback to raw query
    track=await spotifySearch(query,'track');
  }
  if(!track){appendSys('No results found for: '+query);setOrbState('idle');return;}
  var ok=await spotifyPlay(track.uri);
  if(ok){
    var sysInfo='System information: Now playing "'+track.name+'" by '+track.artists.map(function(a){return a.name;}).join(', ')+' on Spotify.';
    showSpotifyCard({title:track.name,artist:track.artists.map(function(a){return a.name;}).join(', '),album:track.album.name,playing:true});
    await sendSystemInfo(sysInfo,'Confirm what you just queued as JARVIS would — one brief sentence.');
  } else {
    setOrbState('idle');
  }
}

// ── Playlist management ───────────────────────────────────
async function getMyPlaylists(){
  var d=await spotifyAPI('me/playlists?limit=50');
  if(!d||!d.items)return[];
  return d.items;
}

async function getUserId(){
  var d=await spotifyAPI('me');
  return d?d.id:null;
}

async function showPlaylists(){
  appendSys('Fetching your playlists...');
  var playlists=await getMyPlaylists();
  if(!playlists.length){appendSys('No playlists found.');return;}
  removeWelcome();
  var msgs=document.getElementById('messages');
  var card=document.createElement('div');
  card.className='spotify-card';
  card.style.maxWidth='380px';
  var title=document.createElement('div');title.className='spotify-track';title.textContent='📋 Your playlists ('+playlists.length+'):';card.appendChild(title);
  playlists.slice(0,10).forEach(function(pl){
    var row=document.createElement('div');
    row.className='spotify-artist';
    row.style.marginTop='4px';
    row.textContent='• '+pl.name+' ('+pl.tracks.total+' tracks)';
    card.appendChild(row);
  });
  if(playlists.length>10){var more=document.createElement('div');more.className='spotify-artist';more.style.marginTop='4px';more.textContent='...and '+(playlists.length-10)+' more';card.appendChild(more);}
  var wrap=document.createElement('div');wrap.className='msg baker';wrap.appendChild(card);
  msgs.appendChild(wrap);msgs.scrollTop=msgs.scrollHeight;
  var sysInfo='System information: User has '+playlists.length+' Spotify playlists: '+playlists.slice(0,5).map(function(p){return p.name;}).join(', ')+(playlists.length>5?'...':'.')+'.';
  await sendSystemInfo(sysInfo,'Acknowledge the playlists briefly as JARVIS would.');
}

async function addCurrentToPlaylist(playlistName){
  appendSys('Adding to playlist: '+playlistName);
  setOrbState('thinking');
  // Get currently playing track
  var current=await spotifyAPI('me/player/currently-playing');
  if(!current||!current.item){appendSys('Nothing is currently playing.');setOrbState('idle');return;}
  var trackUri=current.item.uri;
  var trackName=current.item.name;
  // Find playlist by name
  var playlists=await getMyPlaylists();
  var pl=playlists.find(function(p){return p.name.toLowerCase().includes(playlistName.toLowerCase());});
  if(!pl){appendSys('Could not find playlist: '+playlistName);setOrbState('idle');return;}
  // Add track
  var result=await spotifyAPI('playlists/'+pl.id+'/tracks','POST',{uris:[trackUri]});
  if(result){
    var sysInfo='System information: Added "'+trackName+'" to playlist "'+pl.name+'" successfully.';
    await sendSystemInfo(sysInfo,'Confirm you added the track to the playlist as JARVIS would — one sentence.');
  } else {
    appendSys('Failed to add track to playlist.');
    setOrbState('idle');
  }
}

async function createPlaylist(name){
  appendSys('Creating playlist: '+name);
  setOrbState('thinking');
  var userId=await getUserId();
  if(!userId){appendSys('Could not get user ID.');setOrbState('idle');return;}
  var result=await spotifyAPI('users/'+userId+'/playlists','POST',{name:name,public:false,description:'Created by BAKER'});
  if(result&&result.id){
    var sysInfo='System information: Created new Spotify playlist "'+name+'" successfully.';
    await sendSystemInfo(sysInfo,'Confirm playlist creation as JARVIS would — one sentence.');
  } else {
    appendSys('Failed to create playlist.');
    setOrbState('idle');
  }
}

async function removeCurrentFromPlaylist(playlistName){
  appendSys('Removing from playlist: '+playlistName);
  setOrbState('thinking');
  var current=await spotifyAPI('me/player/currently-playing');
  if(!current||!current.item){appendSys('Nothing is currently playing.');setOrbState('idle');return;}
  var trackUri=current.item.uri;
  var trackName=current.item.name;
  var playlists=await getMyPlaylists();
  var pl=playlists.find(function(p){return p.name.toLowerCase().includes(playlistName.toLowerCase());});
  if(!pl){appendSys('Could not find playlist: '+playlistName);setOrbState('idle');return;}
  var result=await spotifyAPI('playlists/'+pl.id+'/tracks','DELETE',{tracks:[{uri:trackUri}]});
  if(result){
    var sysInfo='System information: Removed "'+trackName+'" from playlist "'+pl.name+'".';
    await sendSystemInfo(sysInfo,'Confirm removal as JARVIS would — one sentence.');
  } else {
    appendSys('Failed to remove track.');
    setOrbState('idle');
  }
}

async function spotifyControl(action){if(!spotifyToken)return;if(action==='next')await spotifyAPI('me/player/next','POST');else if(action==='previous')await spotifyAPI('me/player/previous','POST');else if(action==='toggle'){var s=await spotifyAPI('me/player');if(s&&s.is_playing)await spotifyAPI('me/player/pause','PUT');else await spotifyAPI('me/player/play','PUT');}setTimeout(fetchSpotifyAndReport,800);}

async function sendSystemInfo(sysInfo,instruction){var key=localStorage.getItem('baker_api_key');if(!key){setOrbState('idle');return;}var effort=localStorage.getItem('baker_effort')||'standard';var maxTok={deep:1500,standard:800,quick:400,minimal:150}[effort]||800;state.history.push({role:'user',content:sysInfo+' '+instruction});showThinking();try{var resp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:maxTok,system:buildSystem(),messages:state.history})});var data=await resp.json();if(data.error)throw new Error(data.error.message);var raw=data.content.map(function(b){return b.text||'';}).join('').trim();var parsed=parseResponse(raw);removeThinking();appendMsg('baker',parsed.txt,parsed.note);state.history.push({role:'assistant',content:raw});document.getElementById('dl-btn').disabled=false;if(voiceMode)speakText(parsed.txt);else setOrbState('idle');state.skipHotWord=parsed.txt.trim().endsWith('?');}catch(err){removeThinking();appendMsg('baker','System info failed: '+err.message);setOrbState('idle');}if(state.history.length>40)state.history=state.history.slice(-40);}

function parseResponse(raw){var noteResult=parseNote(raw);var txt=noteResult.txt;var cmdMatch=txt.match(/<<BAKER:([^>]+)>>$/);if(cmdMatch){txt=txt.replace(/<<BAKER:[^>]+>>$/,'').trim();var parts=cmdMatch[1].split(':');setTimeout(function(){dispatchBAKERCommand(parts[0],parts.slice(1));},100);}return{txt:txt,note:noteResult.note};}
function dispatchBAKERCommand(cmd,args){
  if(cmd==='weather')fetchWeatherAndReport();
  else if(cmd==='spotify')fetchSpotifyAndReport();
  else if(cmd==='spotify_next')spotifyControl('next');
  else if(cmd==='spotify_prev')spotifyControl('previous');
  else if(cmd==='spotify_pause')spotifyControl('toggle');
  else if(cmd==='spotify_play'&&args.length)spotifySearchAndPlay(args.join(' '));
  else if(cmd==='spotify_add'&&args.length)addCurrentToPlaylist(args.join(' '));
  else if(cmd==='spotify_remove'&&args.length)removeCurrentFromPlaylist(args.join(' '));
  else if(cmd==='spotify_playlists')showPlaylists();
  else if(cmd==='spotify_create'&&args.length)createPlaylist(args.join(' '));
  else if(cmd==='spotify_device')pickDevice();
}
function parseNote(raw){var s=raw.indexOf('<<<NOTE_START>>>'),e=raw.indexOf('<<<NOTE_END>>>');if(s===-1||e===-1)return{txt:raw,note:null};var block=raw.slice(s+16,e).trim(),chat=raw.slice(0,s).trim();var fm=block.match(/FILENAME:\s*(.+)/),pm=block.match(/PATH:\s*(.+)/),ci=block.indexOf('<<<CONTENT>>>');if(!fm||!pm||ci===-1)return{txt:raw,note:null};return{txt:chat||raw,note:{filename:fm[1].trim(),path:pm[1].trim(),content:block.slice(ci+13).trim()}};}

function buildSystem(){var now=new Date();var h=now.getHours();var tod=h>=5&&h<12?'morning':h>=12&&h<17?'afternoon':h>=17&&h<21?'evening':'night';var sys='You are BAKER, an intelligent AI assistant modelled after JARVIS from Iron Man.\n\nPersonality: precise, composed, quietly witty. Address the user as "sir" occasionally. Lead with the answer. Dry humour when appropriate. Do not pad responses.\n\nIt is currently '+tod+'. Use time-aware greetings naturally but NEVER state the specific time unless asked.\n\n';if(voiceMode){sys+='VOICE MODE: Responses are read aloud. No markdown, no bullets, no headers. Flowing spoken sentences only. 1-3 sentences max unless asked for more. End with "?" if you need clarification.\n\n';}sys+='Command tags (append to END of response only, never mid-sentence):\n<<BAKER:weather>> — fetch weather\n<<BAKER:spotify>> — show Spotify track\n<<BAKER:spotify_next>> — skip track\n<<BAKER:spotify_prev>> — previous track\n<<BAKER:spotify_pause>> — pause/resume\n<<BAKER:spotify_play:song name>> — search and play a song\n<<BAKER:spotify_playlists>> — show user playlists\n<<BAKER:spotify_add:playlist name>> — add current song to playlist\n<<BAKER:spotify_remove:playlist name>> — remove current song from playlist\n<<BAKER:spotify_create:playlist name>> — create new playlist\n<<BAKER:spotify_device>> — show device picker\nOnly use when user explicitly asks.\n\n';sys+='To create vault notes end your reply with:\n<<<NOTE_START>>>\nFILENAME: Title.md\nPATH: 01-Projects/Title.md\n<<<CONTENT>>>\n[markdown note]\n<<<NOTE_END>>>\n\nFolders: Projects->01-Projects/, Daily->07-System/Daily/, Lectures->00-Capture/Lectures/, Conversations->00-Capture/Conversations/, Ideas->05-Notes/Atomic/, General->00-Capture/Inbox/\nAlways include YAML frontmatter and [[HOME]] link.';var all=state.autoNotes.concat(state.manualNotes);if(all.length){sys+='\n\n--- VAULT NOTES IN CONTEXT ---\n';all.forEach(function(n){var trimmed=n.content.length>2000?n.content.slice(0,2000)+'\n...[truncated]':n.content;sys+='\n### '+(n.path||n.name)+'\n'+trimmed+'\n';});sys+='\n--- END VAULT NOTES ---';}return sys;}

var effortTokens={deep:1500,standard:800,quick:400,minimal:150};
async function sendMessage(){if(state.busy)return;var input=document.getElementById('msg-input');var txt=input.value.trim();if(!txt)return;var key=localStorage.getItem('baker_api_key');if(!key){alert('No API key — go to BAKER Settings first.');return;}input.value='';input.style.height='auto';appendMsg('user',txt);
  // Spotify intent detection
  if(spotifyToken){
    var lowerTxt=txt.toLowerCase().trim();
    if(/^(?:hey baker[,.]?\s*)?(?:play|put on|queue)\s+/i.test(txt)){spotifySearchAndPlay(txt.replace(/^(?:hey baker[,.]?\s*)?(?:play|put on|queue)\s+/i,''));return;}
    if(/show(?:my)? playlists?|list(?:my)? playlists?/i.test(lowerTxt)){showPlaylists();return;}
    if(/change device|switch device|which device|pick device/i.test(lowerTxt)){pickDevice();return;}
    var addMatch=txt.match(/add (?:this|current|song) to (?:my )?(?:playlist )?(.+)/i);
    if(addMatch){addCurrentToPlaylist(addMatch[1].trim());return;}
    var removeMatch=txt.match(/remove (?:this|current|song) from (?:my )?(?:playlist )?(.+)/i);
    if(removeMatch){removeCurrentFromPlaylist(removeMatch[1].trim());return;}
    var createMatch=txt.match(/create (?:a )?(?:new )?playlist (?:called|named) (.+)/i);
    if(createMatch){createPlaylist(createMatch[1].trim());return;}
  }
  state.history.push({role:'user',content:txt+' '+getContextBlock()});if(state.vaultConnected){var rel=findRelevant(txt);var newN=rel.filter(function(r){return !state.autoNotes.find(function(a){return a.path===r.path;});});if(newN.length){state.autoNotes=state.autoNotes.concat(newN).slice(0,8);renderStatusBar();appendSys(newN.length===1?'Pulled: '+newN[0].name.replace('.md',''):'Pulled '+newN.length+' relevant notes');}}state.busy=true;document.getElementById('send-btn').disabled=true;showThinking();setOrbState('thinking');var effort=localStorage.getItem('baker_effort')||'standard';var maxTok=effortTokens[effort]||800;try{var resp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:maxTok,system:buildSystem(),messages:state.history})});var data=await resp.json();if(data.error)throw new Error(data.error.message);var raw=data.content.map(function(b){return b.text||'';}).join('').trim();var parsed=parseResponse(raw);removeThinking();appendMsg('baker',parsed.txt,parsed.note);state.history.push({role:'assistant',content:raw});document.getElementById('dl-btn').disabled=false;state.skipHotWord=parsed.txt.trim().endsWith('?');}catch(err){removeThinking();appendMsg('baker','I appear to have encountered a fault, sir. '+err.message);}state.busy=false;setOrbState('idle');document.getElementById('send-btn').disabled=false;document.getElementById('msg-input').focus();if(state.history.length>40)state.history=state.history.slice(-40);}

function openEnd(){if(!state.history.length){alert('Nothing to save yet, sir.');return;}document.getElementById('end-sub').textContent=state.vaultConnected?'BAKER will summarize and save to your vault. Chat will clear.':'No vault connected — BAKER will download the note.';document.getElementById('end-overlay').classList.add('open');}
function closeEnd(){document.getElementById('end-overlay').classList.remove('open');}
var endPrompts={deep:'Create a comprehensive vault note summary: overview, key topics, insights, decisions, action items (checkbox format), connections.',standard:'Create a vault note summary: brief overview, key points, action items (checkbox format).',quick:'Brief vault note summary with key points and action items.',minimal:'2-3 sentence summary and action items.'};
async function endConvo(){closeEnd();var key=localStorage.getItem('baker_api_key');if(!key){alert('No API key set.');return;}var topic=document.getElementById('topic').value.trim()||'Conversation';var effort=localStorage.getItem('baker_effort')||'standard';var date=new Date().toISOString().split('T')[0];var fname=date+'-Conversation-'+topic.replace(/\s+/g,'-')+'.md';var fpath='00-Capture/Conversations/'+fname;appendSys('Generating summary...');setOrbState('thinking');var transcript=state.history.map(function(m){return(m.role==='user'?'User':'BAKER')+': '+m.content;}).join('\n\n');try{var prompt=endPrompts[effort]||endPrompts.standard;var sysMsg='You are BAKER. '+prompt+'\n\nStart with:\n---\ndate: '+date+'\ntype: conversation\nwith: BAKER\ncontext: '+topic+'\ntags: [conversation, baker]\n---\n\n# Conversation: '+topic+'\n\nThen summary. End with:\n\n---\n*[[HOME]] - [[00-Capture/Conversations]]*';var resp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1000,system:sysMsg,messages:[{role:'user',content:'Summarize:\n\n'+transcript}]})});var data=await resp.json();if(data.error)throw new Error(data.error.message);var note=data.content.map(function(b){return b.text||'';}).join('').trim();if(state.vaultConnected){var ok=await writeToVault(fpath,note);appendSys(ok?'Saved to vault: '+fpath:'Vault write failed — downloading.');if(!ok)downloadBlob(note,fname);}else{downloadBlob(note,fname);appendSys('Downloaded — move to 00-Capture/Conversations/ in your vault.');}setTimeout(function(){state.history=[];state.autoNotes=[];state.manualNotes=[];state.noteStore={};state.skipHotWord=false;renderStatusBar();document.getElementById('messages').innerHTML='<div class="welcome" id="welcome"><div class="welcome-icon">◈</div><div class="welcome-title">'+getTimeGreeting()+'</div><div class="welcome-sub">Conversation saved. What shall we work through next, sir?</div><div class="starters"><div class="starter" id="s1">💡 Project idea</div><div class="starter" id="s2">📅 Daily reflection</div><div class="starter" id="s3">📚 Study help</div><div class="starter" id="s4">📂 Check my notes</div><div class="starter" id="s5">✏ Create a note</div><div class="starter" id="s6">🌤 Weather</div><div class="starter" id="s7">🎵 Now playing</div></div></div>';document.getElementById('dl-btn').disabled=true;document.getElementById('topic').value='';setOrbState('idle');rewireStarters();},2000);}catch(err){appendSys('Summary failed: '+err.message);setOrbState('idle');}}

function rewireStarters(){var map={s1:'Help me think through a project idea',s2:'I want to reflect on my day',s3:'Help me understand something I am studying',s4:'What do my notes say about my current projects?',s5:'Create a new project note for me',s6:'__weather__',s7:'__spotify__'};Object.keys(map).forEach(function(id){var el=document.getElementById(id);if(el)el.addEventListener('click',function(){if(map[id]==='__weather__')fetchWeatherAndReport();else if(map[id]==='__spotify__')fetchSpotifyAndReport();else sendStarter(map[id]);});});}
function downloadBlob(content,filename){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type:'text/markdown'}));a.download=filename;a.click();}
function downloadNote(){if(!state.history.length)return;var topic=document.getElementById('topic').value.trim()||'Conversation';var date=new Date().toISOString().split('T')[0];var t=state.history.map(function(m){return '**'+(m.role==='user'?'Me':'BAKER')+':** '+m.content;}).join('\n\n');downloadBlob('---\ndate: '+date+'\ntype: conversation\nwith: BAKER\ncontext: '+topic+'\ntags: [conversation, baker]\n---\n\n# Conversation — '+topic+'\n\n'+t+'\n\n---\n*[[HOME]]*\n',date+'-Conversation-'+topic.replace(/\s+/g,'-')+'.md');}
function clearChat(){if(state.history.length&&!confirm('Clear this conversation?'))return;state.history=[];state.autoNotes=[];state.manualNotes=[];state.noteStore={};state.skipHotWord=false;renderStatusBar();document.getElementById('messages').innerHTML='<div class="welcome" id="welcome"><div class="welcome-icon">◈</div><div class="welcome-title">'+getTimeGreeting()+'</div><div class="welcome-sub">Good to have you, sir. Ready when you are.</div><div class="starters"><div class="starter" id="s1">💡 Project idea</div><div class="starter" id="s2">📅 Daily reflection</div><div class="starter" id="s3">📚 Study help</div><div class="starter" id="s4">📂 Check my notes</div><div class="starter" id="s5">✏ Create a note</div><div class="starter" id="s6">🌤 Weather</div><div class="starter" id="s7">🎵 Now playing</div></div></div>';document.getElementById('dl-btn').disabled=true;document.getElementById('topic').value='';setOrbState('idle');rewireStarters();}

function setVaultBtn(s){var b=document.getElementById('vault-btn');b.className='hbtn'+(s==='on'?' vault-on':s==='scanning'?' vault-scanning':'');b.textContent=s==='on'?'⬡ Vault on':s==='scanning'?'⟳ Scanning...':'⬡ Connect Vault';}
function setSb(cls,txt){var el=document.getElementById('sb-txt');el.className='sb-txt'+(cls?' '+cls:'');el.textContent=txt;}
function renderStatusBar(){var bar=document.getElementById('status-bar');bar.querySelectorAll('.chip').forEach(function(e){e.remove();});state.autoNotes.forEach(function(n){var c=document.createElement('div');c.className='chip auto';c.textContent='⬡ '+n.name.replace('.md','');bar.appendChild(c);});state.manualNotes.forEach(function(n){var c=document.createElement('div');c.className='chip manual';var nm=n.name;c.innerHTML='📄 '+nm.replace('.md','');var x=document.createElement('button');x.textContent='×';x.addEventListener('click',function(){removeManual(nm);});c.appendChild(x);bar.appendChild(c);});}
function removeWelcome(){var w=document.getElementById('welcome');if(w)w.remove();}
function getTime(){return new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
function appendSys(txt){removeWelcome();var msgs=document.getElementById('messages');var d=document.createElement('div');d.className='sys-msg';d.textContent=txt;msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;}
function sendStarter(msg){document.getElementById('msg-input').value=msg;sendMessage();}
function appendMsg(role,txt,noteData){removeWelcome();var msgs=document.getElementById('messages');var wrap=document.createElement('div');wrap.className='msg '+role;var bub=document.createElement('div');bub.className='bubble';bub.textContent=txt;var ts=document.createElement('div');ts.className='msg-time';ts.textContent=role==='user'?'You · '+getTime():'BAKER · '+getTime();wrap.appendChild(bub);wrap.appendChild(ts);if(noteData){var nid='nc'+Date.now();state.noteStore[nid]=noteData;var card=document.createElement('div');card.className='note-card';var t=document.createElement('div');t.className='nc-title';t.textContent='📄 '+noteData.filename;var p=document.createElement('div');p.className='nc-path';p.textContent='→ '+noteData.path;var prev=document.createElement('div');prev.className='nc-preview';prev.textContent=noteData.content.slice(0,300)+(noteData.content.length>300?'\n...':'');var acts=document.createElement('div');acts.className='nc-actions';var dis=document.createElement('button');dis.className='nc-btn';dis.textContent='Dismiss';dis.addEventListener('click',function(){card.remove();});var sav=document.createElement('button');sav.className='nc-btn primary';sav.id=nid;sav.textContent=state.vaultConnected?'Save to Vault':'Download .md';(function(id){sav.addEventListener('click',function(){doSaveNote(id);});})(nid);acts.appendChild(dis);acts.appendChild(sav);card.appendChild(t);card.appendChild(p);card.appendChild(prev);card.appendChild(acts);wrap.appendChild(card);}msgs.appendChild(wrap);msgs.scrollTop=msgs.scrollHeight;}
async function doSaveNote(nid){var nd=state.noteStore[nid];if(!nd)return;var btn=document.getElementById(nid);if(!btn)return;if(state.vaultConnected){btn.textContent='Saving...';btn.disabled=true;var ok=await writeToVault(nd.path,nd.content);if(ok){btn.className='nc-btn done';btn.textContent='✓ Saved to vault';appendSys('Saved: '+nd.path);}else{btn.disabled=false;btn.textContent='⬇ Failed — click to download';btn.addEventListener('click',function(){downloadBlob(nd.content,nd.filename);});}}else{downloadBlob(nd.content,nd.filename);btn.className='nc-btn done';btn.textContent='✓ Downloaded';}delete state.noteStore[nid];}
function showThinking(){var msgs=document.getElementById('messages');var d=document.createElement('div');d.className='msg baker';d.id='thinking-msg';d.innerHTML='<div class="thinking-wrap"><div class="dots"><span></span><span></span><span></span></div></div>';msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;}
function removeThinking(){var t=document.getElementById('thinking-msg');if(t)t.remove();}

function setMode(mode){voiceMode=(mode==='voice');var tT=document.getElementById('tab-text'),tV=document.getElementById('tab-voice');var iA=document.getElementById('input-area'),vA=document.getElementById('voice-area');if(tT)tT.className='mode-tab'+(voiceMode?'':' active');if(tV)tV.className='mode-tab'+(voiceMode?' active':'');if(iA)iA.style.display=voiceMode?'none':'flex';if(vA)vA.style.display=voiceMode?'flex':'none';if(voiceMode&&window.orbInitAudio)window.orbInitAudio();if(!voiceMode){stopVoice();stopSpeaking();if(constantMic)setTimeout(startWakeWord,500);}}
function handleMicClick(){if(isSpeaking){stopSpeaking();return;}if(voiceActive){stopVoice();}else{startVoice();}}
function startVoice(){
  var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){alert('Voice input requires Chrome.');return;}
  if(state.busy)return;
  try{var w=new SpeechSynthesisUtterance('');w.volume=0;speechSynthesis.speak(w);}catch(e){}
  if(window.orbInitAudio)window.orbInitAudio();
  voiceFinal='';
  document.getElementById('voice-live').textContent='';
  voiceRec=new SR();
  voiceRec.continuous=true;voiceRec.interimResults=true;voiceRec.lang='en-US';
  voiceRec.onstart=function(){voiceActive=true;setMicState('listening');setVoiceStatus('Listening...',true);setOrbState('listening');};
  voiceRec.onresult=function(e){
    var interim='';
    for(var i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)voiceFinal+=e.results[i][0].transcript+' ';else interim+=e.results[i][0].transcript;}
    document.getElementById('voice-live').textContent=voiceFinal+interim;
    if(silenceTimer)clearTimeout(silenceTimer);
    silenceTimer=setTimeout(function(){if(voiceActive)stopVoice();},800);
    if(/over\s*$/i.test(voiceFinal.trim())){voiceFinal=voiceFinal.replace(/\s*over\s*$/i,'').trim()+' ';if(silenceTimer)clearTimeout(silenceTimer);stopVoice();}
  };
  voiceRec.onend=function(){if(voiceActive){try{voiceRec.start();}catch(e){}}};
  voiceRec.onerror=function(e){if(e.error==='not-allowed'){setVoiceStatus('Microphone access denied',false);stopVoice();}};
  try{voiceRec.start();}catch(e){setVoiceStatus('Could not start — try Chrome',false);}
}
function stopVoice(){voiceActive=false;if(silenceTimer){clearTimeout(silenceTimer);silenceTimer=null;}if(voiceRec){voiceRec.stop();voiceRec=null;}var txt=voiceFinal.trim();voiceFinal='';document.getElementById('voice-live').textContent='';setMicState('idle');setOrbState('idle');if(txt){setVoiceStatus('Sending...',true);sendVoiceMessage(txt);}else{setVoiceStatus('Tap to speak',false);}}
async function sendVoiceMessage(txt){if(state.busy)return;var key=localStorage.getItem('baker_api_key');if(!key){setVoiceStatus('No API key — check Settings',false);return;}if(checkGoodbye(txt)){appendMsg('user',txt);var farewell='It has been a pleasure, sir. Saving our conversation now.';appendMsg('baker',farewell);speakText(farewell);setTimeout(function(){endConvo();},2000);return;}var speedChange=checkSpeedCommand(txt);if(speedChange){var msg=speedChange==='faster'?'Understood, sir. Speaking rate increased to '+Math.round(speechRate*100)+'.':'Of course, sir. Speaking rate decreased to '+Math.round(speechRate*100)+'.';appendMsg('baker',msg);speakText(msg);setMicState('idle');setVoiceStatus('Tap to speak',false);return;}appendMsg('user',txt);
  // Spotify intent detection in voice
  if(spotifyToken){
    var lowerTxt=txt.toLowerCase().trim();
    if(/^(?:hey baker[,.]?\s*)?(?:play|put on|queue)\s+/i.test(txt)){spotifySearchAndPlay(txt.replace(/^(?:hey baker[,.]?\s*)?(?:play|put on|queue)\s+/i,''));return;}
    if(/show(?:my)? playlists?|list(?:my)? playlists?/i.test(lowerTxt)){showPlaylists();return;}
    if(/change device|switch device|which device|pick device/i.test(lowerTxt)){pickDevice();return;}
    var addMatch=txt.match(/add (?:this|current|song) to (?:my )?(?:playlist )?(.+)/i);
    if(addMatch){addCurrentToPlaylist(addMatch[1].trim());return;}
    var removeMatch=txt.match(/remove (?:this|current|song) from (?:my )?(?:playlist )?(.+)/i);
    if(removeMatch){removeCurrentFromPlaylist(removeMatch[1].trim());return;}
    var createMatch=txt.match(/create (?:a )?(?:new )?playlist (?:called|named) (.+)/i);
    if(createMatch){createPlaylist(createMatch[1].trim());return;}
  }
  state.history.push({role:'user',content:txt+' '+getContextBlock()});if(state.vaultConnected){var rel=findRelevant(txt);var newN=rel.filter(function(r){return !state.autoNotes.find(function(a){return a.path===r.path;});});if(newN.length){state.autoNotes=state.autoNotes.concat(newN).slice(0,8);renderStatusBar();}}state.busy=true;setMicState('speaking');setVoiceStatus('BAKER is thinking...',true);setOrbState('thinking');var effort=localStorage.getItem('baker_effort')||'standard';var maxTok={deep:1500,standard:800,quick:400,minimal:150}[effort]||800;try{var resp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:maxTok,system:buildSystem(),messages:state.history})});var data=await resp.json();if(data.error)throw new Error(data.error.message);var raw=data.content.map(function(b){return b.text||'';}).join('').trim();var parsed=parseResponse(raw);appendMsg('baker',parsed.txt,parsed.note);state.history.push({role:'assistant',content:raw});document.getElementById('dl-btn').disabled=false;state.skipHotWord=parsed.txt.trim().endsWith('?');speakText(parsed.txt);}catch(err){appendMsg('baker','I appear to have encountered a fault, sir. '+err.message);setMicState('idle');setVoiceStatus('Tap to speak',false);setOrbState('idle');state.busy=false;}if(state.history.length>40)state.history=state.history.slice(-40);}

function checkSpeedCommand(txt){var lower=txt.toLowerCase();var faster=['talk faster','speak faster','faster','speed up','too slow','go faster'];var slower=['talk slower','speak slower','slower','slow down','too fast','go slower'];var matched=null;faster.forEach(function(p){if(!matched&&lower.indexOf(p)!==-1){speechRate=Math.min(2.0,Math.round((speechRate+0.1)*10)/10);localStorage.setItem('baker_speech_rate',speechRate);matched='faster';}});slower.forEach(function(p){if(!matched&&lower.indexOf(p)!==-1){speechRate=Math.max(0.3,Math.round((speechRate-0.1)*10)/10);localStorage.setItem('baker_speech_rate',speechRate);matched='slower';}});return matched;}
var goodbyePhrases=['goodbye baker','goodnight baker','sign off baker','peace out baker','good night baker'];
function checkGoodbye(txt){var lower=txt.toLowerCase().trim();return goodbyePhrases.some(function(p){return lower.indexOf(p)!==-1;});}

var cachedVoices=[];
function loadVoices(){cachedVoices=speechSynthesis.getVoices();}
loadVoices();
if(speechSynthesis.onvoiceschanged!==undefined)speechSynthesis.onvoiceschanged=loadVoices;
function speakText(txt){if(!voiceMode){state.busy=false;return;}stopSpeaking();var clean=txt.replace(/#{1,6} /g,'').replace(/\*\*(.*?)\*\*/g,'$1').replace(/\*(.*?)\*/g,'$1').replace(/\[\[([^\]]+)\]\]/g,'$1').replace(/`([^`]+)`/g,'$1').replace(/^[-*] /gm,'').replace(/<<BAKER:[^>]+>>/g,'').trim();var utt=new SpeechSynthesisUtterance(clean);var voices=cachedVoices.length?cachedVoices:speechSynthesis.getVoices();var preferred=['Daniel','Google UK English Male','Microsoft George','Microsoft David','Alex'];var chosen=null;preferred.forEach(function(pref){if(!chosen)chosen=voices.find(function(v){return v.name.indexOf(pref)!==-1;});});if(!chosen)chosen=voices.find(function(v){return v.lang&&v.lang.indexOf('en')===0;});if(chosen)utt.voice=chosen;utt.rate=speechRate;utt.pitch=0.85;utt.volume=1;isSpeaking=true;setMicState('speaking');setVoiceStatus('BAKER is speaking... tap to stop',true);setOrbState('speaking');utt.onend=function(){isSpeaking=false;state.busy=false;setMicState('idle');if(voiceMode){setVoiceStatus(state.skipHotWord?'Listening for your answer...':'Listening again...',true);setOrbState('listening');setTimeout(function(){if(voiceMode&&!state.busy&&!isSpeaking)startVoice();},300);}else if(constantMic){setOrbState('idle');setTimeout(startWakeWord,600);}};utt.onerror=function(){isSpeaking=false;state.busy=false;setMicState('idle');setVoiceStatus('Tap to speak',false);setOrbState('idle');};speechSynthesis.speak(utt);}
function stopSpeaking(){if(isSpeaking){speechSynthesis.cancel();isSpeaking=false;}setOrbState('idle');}
function setMicState(s){var ring=document.getElementById('mic-ring'),icon=document.getElementById('mic-icon');ring.className='mic-ring'+(s==='listening'?' listening':s==='speaking'?' speaking':'');icon.textContent=s==='listening'?'⏹':s==='speaking'?'🔊':'🎙';}

function startWakeWord(){var SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR||!constantMic)return;stopWakeWord();var el=document.getElementById('wake-status');if(el)el.textContent='👂 Listening for "Hey BAKER"...';wakeRec=new SR();wakeRec.continuous=true;wakeRec.interimResults=false;wakeRec.lang='en-US';wakeRec.onresult=function(e){var txt=e.results[e.results.length-1][0].transcript.toLowerCase().trim();if(HOT_WORDS.some(function(w){return txt.includes(w);})){stopWakeWord();setMode('voice');var el2=document.getElementById('wake-status');if(el2)el2.textContent='';setTimeout(function(){if(!voiceActive&&!state.busy)startVoice();},400);}};wakeRec.onend=function(){if(constantMic&&!voiceMode){try{wakeRec.start();}catch(e){}}};try{wakeRec.start();}catch(e){}}
function stopWakeWord(){if(wakeRec){wakeRec.stop();wakeRec=null;}var el=document.getElementById('wake-status');if(el)el.textContent='';}
function setVoiceStatus(txt,active){var el=document.getElementById('voice-status');el.textContent=txt;el.className='voice-status'+(active?' active':'');}
