// ═══════════════════════════════════════════════════════════
// ══  ORB / MUSIC MODE MODULE  ══════════════════════════════
// ═══════════════════════════════════════════════════════════
// Owns: music mode toggle, vinyl record canvas animation
// Globals: orbMusicMode, toggleMusicMode
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// RECORD / MUSIC MODE
// ═══════════════════════════════════════════════════════════
var orbMusicMode=false;
var recordAngle=0,recordImg=null,recordArtUrl='',recordRafId=null,recordLastTime=0,recordSpinning=true;
var _musicModeDebounce=false;
function toggleMusicMode(){
  if(_musicModeDebounce)return;
  _musicModeDebounce=true;setTimeout(function(){_musicModeDebounce=false;},400);
  orbMusicMode=!orbMusicMode;_applyMusicMode();
}
function _applyMusicMode(){
  var orbCanvas=document.getElementById('orb-canvas');
  var recCanvas=document.getElementById('record-canvas');
  var vaultDoor=document.getElementById('vault-door-canvas');
  var footNormal=document.getElementById('orb-foot-normal');
  var footMusic=document.getElementById('orb-foot-music');
  var panel=document.getElementById('orb-panel');
  var icon=document.getElementById('orb-mode-icon');
  var lbl=document.getElementById('orb-panel-label');
  if(orbMusicMode){
    orbCanvas.style.display='none';
    if(vaultDoor)vaultDoor.style.display='none';
    recCanvas.style.display='block';
    footNormal.style.display='none';
    footMusic.style.display='block';
    panel.classList.add('music-mode');
    icon.textContent='♫';
    lbl.textContent='Now Playing';
    var _tn=document.getElementById('orb-track-name');
    var _an=document.getElementById('orb-artist-name');
    var _spOk=(typeof SP!=='undefined'&&typeof SP.isConnected==='function'&&SP.isConnected());
    if(!_spOk){if(_tn)_tn.textContent='Music Mode';if(_an)_an.textContent='Double-click again to exit';}
    _syncRecordFromState();_startRecordLoop();
  }else{
    recCanvas.style.display='none';
    footNormal.style.display='block';
    footMusic.style.display='none';
    panel.classList.remove('music-mode');
    icon.textContent='◈';
    lbl.textContent='BAKER';
    _stopRecordLoop();
    // Restore correct canvas: vault door if Fallout active, else orb
    if(typeof FALLOUT!=='undefined'&&FALLOUT.isActive()){if(vaultDoor)vaultDoor.style.display='block';}
    else{orbCanvas.style.display='block';}
    if(typeof vaultConnected!=='undefined'&&vaultConnected&&typeof graphNodes!=='undefined'&&graphNodes.length&&!graphAnim)runGraphSim();
  }
}
function _syncRecordFromState(){var state=SP.getCurrentTrack&&SP.getCurrentTrack();if(!state||!state.item)return;var it=state.item;var tn=document.getElementById('orb-track-name');var an=document.getElementById('orb-artist-name');if(tn)tn.textContent=it.name||'';if(an)an.textContent=(it.artists&&it.artists.map(function(a){return a.name;}).join(', '))||'';var pp=document.getElementById('orb-music-pp');if(pp)pp.textContent=state.is_playing?'⏸':'▶';recordSpinning=!!state.is_playing;var artUrl=(it.album&&it.album.images&&(it.album.images[1]||it.album.images[0]))?((it.album.images[1]||it.album.images[0]).url):'';if(artUrl&&artUrl!==recordArtUrl){recordArtUrl=artUrl;recordImg=new Image();recordImg.crossOrigin='anonymous';recordImg.src=artUrl;}}
function orbMusicSyncState(state){if(!orbMusicMode)return;if(!state||!state.item)return;var it=state.item;var tn=document.getElementById('orb-track-name');var an=document.getElementById('orb-artist-name');if(tn)tn.textContent=it.name||'';if(an)an.textContent=(it.artists&&it.artists.map(function(a){return a.name;}).join(', '))||'';var pp=document.getElementById('orb-music-pp');if(pp)pp.textContent=state.is_playing?'⏸':'▶';recordSpinning=!!state.is_playing;var artUrl=(it.album&&it.album.images&&(it.album.images[1]||it.album.images[0]))?((it.album.images[1]||it.album.images[0]).url):'';if(artUrl&&artUrl!==recordArtUrl){recordArtUrl=artUrl;recordImg=new Image();recordImg.crossOrigin='anonymous';recordImg.src=artUrl;}}
function orbMusicTogglePlay(){var state=SP.getCurrentTrack&&SP.getCurrentTrack();if(state&&state.is_playing){SP.pause();}else{SP.resume();}recordSpinning=!recordSpinning;var pp=document.getElementById('orb-music-pp');if(pp)pp.textContent=recordSpinning?'⏸':'▶';}
var _recordCtx=null,_recordFPS=1000/30,_recordLastDraw=0;
function _startRecordLoop(){if(recordRafId)return;recordLastTime=performance.now();function frame(now){if(!orbMusicMode){recordRafId=null;return;}recordRafId=requestAnimationFrame(frame);if(now-_recordLastDraw<_recordFPS)return;_recordLastDraw=now;var dt=(now-recordLastTime)/1000;recordLastTime=now;if(recordSpinning)recordAngle+=dt*(Math.PI*2/3);_drawRecord();}recordRafId=requestAnimationFrame(frame);}
function _stopRecordLoop(){if(recordRafId){cancelAnimationFrame(recordRafId);recordRafId=null;}}
function _drawRecord(){var canvas=document.getElementById('record-canvas');if(!canvas)return;var W=canvas.offsetWidth,H=canvas.offsetHeight;if(!W||!H)return;if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;_recordCtx=null;}if(!_recordCtx)_recordCtx=canvas.getContext('2d');var ctx=_recordCtx;ctx.clearRect(0,0,W,H);var cx=W/2,cy=H/2,maxR=Math.min(W,H)/2-8,artR=maxR*0.56,vinylR=maxR,labelR=artR*1.08,holeR=maxR*0.06;ctx.save();ctx.shadowColor='rgba(0,0,0,0.7)';ctx.shadowBlur=24;ctx.shadowOffsetX=4;ctx.shadowOffsetY=6;ctx.beginPath();ctx.arc(cx,cy,vinylR,0,Math.PI*2);ctx.fillStyle='#111';ctx.fill();ctx.restore();ctx.save();ctx.beginPath();ctx.arc(cx,cy,vinylR,0,Math.PI*2);ctx.clip();ctx.beginPath();ctx.arc(cx,cy,vinylR,0,Math.PI*2);ctx.fillStyle='#0e0e0f';ctx.fill();for(var gr=artR*1.12;gr<vinylR-2;gr+=5){ctx.beginPath();ctx.arc(cx,cy,gr,0,Math.PI*2);ctx.strokeStyle='rgba(255,255,255,0.03)';ctx.lineWidth=1;ctx.stroke();}ctx.save();ctx.translate(cx,cy);ctx.rotate(recordAngle*0.7);ctx.translate(-cx,-cy);for(var ri=0;ri<3;ri++){var gStart=(artR*1.15)+(ri*12);var gEnd=Math.min(gStart+8,vinylR-2);ctx.beginPath();ctx.arc(cx,cy,gStart,Math.PI*0.9,Math.PI*1.4);ctx.strokeStyle='rgba(255,255,255,0.07)';ctx.lineWidth=gEnd-gStart;ctx.stroke();}ctx.restore();ctx.restore();ctx.save();ctx.translate(cx,cy);ctx.rotate(recordAngle);ctx.beginPath();ctx.arc(0,0,artR,0,Math.PI*2);ctx.clip();if(recordImg&&recordImg.complete&&recordImg.naturalWidth>0){ctx.drawImage(recordImg,-artR,-artR,artR*2,artR*2);ctx.beginPath();ctx.arc(0,0,artR,0,Math.PI*2);ctx.fillStyle='rgba(0,0,0,0.18)';ctx.fill();}else{var grd=ctx.createRadialGradient(0,0,0,0,0,artR);grd.addColorStop(0,'#2a1f5e');grd.addColorStop(1,'#0f0f10');ctx.beginPath();ctx.arc(0,0,artR,0,Math.PI*2);ctx.fillStyle=grd;ctx.fill();ctx.font='bold '+(artR*0.45)+'px IBM Plex Mono, monospace';ctx.fillStyle='rgba(124,106,247,0.6)';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('♫',0,0);}ctx.restore();ctx.save();ctx.beginPath();ctx.arc(cx,cy,labelR,0,Math.PI*2);ctx.strokeStyle='rgba(124,106,247,0.25)';ctx.lineWidth=1.5;ctx.stroke();ctx.restore();ctx.save();var refGrd=ctx.createLinearGradient(cx-vinylR,cy-vinylR,cx+vinylR*0.3,cy+vinylR*0.3);refGrd.addColorStop(0,'rgba(255,255,255,0.04)');refGrd.addColorStop(0.5,'rgba(255,255,255,0.01)');refGrd.addColorStop(1,'rgba(255,255,255,0)');ctx.beginPath();ctx.arc(cx,cy,vinylR-1,0,Math.PI*2);ctx.fillStyle=refGrd;ctx.fill();ctx.restore();ctx.save();ctx.beginPath();ctx.arc(cx,cy,holeR,0,Math.PI*2);ctx.fillStyle='#0a0a0b';ctx.fill();ctx.beginPath();ctx.arc(cx,cy,holeR,0,Math.PI*2);ctx.strokeStyle='rgba(255,255,255,0.1)';ctx.lineWidth=0.8;ctx.stroke();ctx.restore();if(recordSpinning){ctx.save();var armPivotX=cx+vinylR*0.55,armPivotY=cy-vinylR*1.05,armAngle=0.38,armLen=vinylR*0.88,tipX=armPivotX+Math.sin(armAngle)*armLen,tipY=armPivotY+Math.cos(armAngle)*armLen;ctx.beginPath();ctx.moveTo(armPivotX,armPivotY);ctx.lineTo(tipX,tipY);ctx.strokeStyle='rgba(200,200,220,0.55)';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.stroke();ctx.beginPath();ctx.arc(armPivotX,armPivotY,4,0,Math.PI*2);ctx.fillStyle='rgba(200,200,220,0.7)';ctx.fill();ctx.beginPath();ctx.arc(tipX,tipY,2.5,0,Math.PI*2);ctx.fillStyle='rgba(124,106,247,0.9)';ctx.fill();ctx.restore();}}
