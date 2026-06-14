// ═══════════════════════════════════════════════════════════
// VAULT GRAPH
// ═══════════════════════════════════════════════════════════
var graphNodes=[],graphEdges=[],graphAnim=null;
var graphTransform={x:0,y:0,scale:1};
var graphPanning=false,graphPanStart={x:0,y:0};
var hoveredNode=null,simTick=0;
var typeColors={conversation:'#a78bfa',project:'#60a5fa',lecture:'#fde047',daily:'#4ade80',general:'#7c6af7'};

function initGraphCanvas(){
  var canvas=document.getElementById('vault-graph-canvas');
  canvas.width=window.innerWidth;canvas.height=window.innerHeight;
  window.addEventListener('resize',function(){canvas.width=window.innerWidth;canvas.height=window.innerHeight;});
  canvas.addEventListener('mousedown',function(e){if(e.target!==canvas)return;graphPanning=true;graphPanStart={x:e.clientX-graphTransform.x,y:e.clientY-graphTransform.y};});
  window.addEventListener('mousemove',function(e){
    if(graphPanning){graphTransform.x=e.clientX-graphPanStart.x;graphTransform.y=e.clientY-graphPanStart.y;}
    if(graphNodes.length){
      var mx=(e.clientX-graphTransform.x)/graphTransform.scale;var my=(e.clientY-graphTransform.y)/graphTransform.scale;hoveredNode=null;
      for(var i=0;i<graphNodes.length;i++){var n=graphNodes[i];var dx=mx-n.x,dy=my-n.y;if(Math.sqrt(dx*dx+dy*dy)<n.radius+6){hoveredNode=n;break;}}
      var tip=document.getElementById('graph-tooltip');
      if(hoveredNode){document.getElementById('tt-name').textContent=hoveredNode.name;document.getElementById('tt-path').textContent=hoveredNode.path;var typeEl=document.getElementById('tt-type');typeEl.textContent=hoveredNode.type;typeEl.style.background=typeColors[hoveredNode.type]+'22';typeEl.style.color=typeColors[hoveredNode.type];typeEl.style.border='1px solid '+typeColors[hoveredNode.type]+'44';tip.style.display='block';tip.style.left=Math.min(e.clientX+14,window.innerWidth-260)+'px';tip.style.top=Math.min(e.clientY-10,window.innerHeight-100)+'px';canvas.style.cursor='pointer';}
      else{tip.style.display='none';canvas.style.cursor=graphPanning?'grabbing':'grab';}
    }
  });
  window.addEventListener('mouseup',function(){graphPanning=false;});
  canvas.addEventListener('wheel',function(e){e.preventDefault();var factor=e.deltaY>0?0.9:1.1;var mx=e.clientX,my=e.clientY;graphTransform.x=mx-(mx-graphTransform.x)*factor;graphTransform.y=my-(my-graphTransform.y)*factor;graphTransform.scale=Math.max(0.1,Math.min(5,graphTransform.scale*factor));},{passive:false});
  canvas.addEventListener('click',function(e){
    if(!hoveredNode)return;var note=vaultIndex[hoveredNode.srcIdx!==undefined?hoveredNode.srcIdx:hoveredNode.id];if(!note)return;
    document.getElementById('note-panel-title').textContent=hoveredNode.name;
    document.getElementById('note-content').textContent=note.content;
    openPanel('note-panel');
  });
}

function buildGraph(){
  document.getElementById('graph-overlay').classList.add('hidden');
  document.getElementById('graph-stats').style.display='flex';
  var candidates=vaultIndex.slice(0,150).map(function(note,i){return{srcIdx:i,name:note.name.replace('.md',''),path:note.path,type:detectType(note.path,note.content),content:note.content};});
  var filtered=candidates.filter(function(c){return GraphSettings.typeFilter[c.type]!==false;});
  graphNodes=filtered.map(function(c,i){return{id:i,srcIdx:c.srcIdx,name:c.name,path:c.path,type:c.type,x:0,y:0,vx:0,vy:0,radius:(4+Math.min(c.content.length/600,7))*GraphSettings.nodeSizeScale,connCount:0};});
  graphEdges=[];
  var nameMap={};graphNodes.forEach(function(n){nameMap[n.name.toLowerCase()]=n.id;});
  graphNodes.forEach(function(n){
    var note=vaultIndex[n.srcIdx];
    var links=note.content.match(/\[\[([^\]|]+)/g)||[];
    links.forEach(function(l){
      var target=l.replace('[[','').toLowerCase();
      if(nameMap[target]!==undefined&&nameMap[target]!==n.id)graphEdges.push({a:n.id,b:nameMap[target]});
    });
  });
  graphEdges.forEach(function(e){
    if(graphNodes[e.a])graphNodes[e.a].connCount++;
    if(graphNodes[e.b])graphNodes[e.b].connCount++;
  });
  if(GraphSettings.sizeByConnections){
    var maxConn=Math.max(1,Math.max.apply(null,graphNodes.map(function(n){return n.connCount;})));
    graphNodes.forEach(function(n){n.radius=(3+Math.min((n.connCount/maxConn)*10,10))*GraphSettings.nodeSizeScale;});
  }
  document.getElementById('stat-notes').textContent=graphNodes.length;
  document.getElementById('stat-links').textContent=graphEdges.length;
  var W=window.innerWidth,H=window.innerHeight;
  var spread=Math.min(0.95,0.7*GraphSettings.graphArea);var margin=(1-spread)/2;
  graphNodes.forEach(function(n){n.x=W*margin+Math.random()*(W*spread);n.y=H*margin+Math.random()*(H*spread);});
  simTick=0;if(graphAnim)cancelAnimationFrame(graphAnim);runGraphSim();
}

function detectType(path,content){
  var p=(path||'').toLowerCase();var c=(content||'').toLowerCase();
  if(p.includes('conversation')||c.includes('type: conversation'))return'conversation';
  if(p.includes('01-projects')||c.includes('type: project'))return'project';
  if(p.includes('lecture')||c.includes('type: lecture'))return'lecture';
  if(p.includes('07-system/daily'))return'daily';
  return'general';
}

var GRAPH_FPS=1000/30,lastGraphFrame=0;
function runGraphSim(){
  graphAnim=requestAnimationFrame(function(now){
    runGraphSim();if(now-lastGraphFrame<GRAPH_FPS)return;lastGraphFrame=now;
    var canvas=document.getElementById('vault-graph-canvas');var ctx=canvas.getContext('2d');var W=canvas.width,H=canvas.height;
    var linkDist=GraphSettings.linkDistance||90;
    var repulsion=(GraphSettings.repulsion||100)/100;
    var query=GraphSettings.searchQuery||'';
    if(simTick<300){
      var k=Math.sqrt((W*H)/Math.max(graphNodes.length,1))*0.9*repulsion;
      for(var i=0;i<graphNodes.length;i++){graphNodes[i].vx=0;graphNodes[i].vy=0;for(var j=0;j<graphNodes.length;j++){if(i===j)continue;var dx=graphNodes[i].x-graphNodes[j].x;var dy=graphNodes[i].y-graphNodes[j].y;var dist=Math.sqrt(dx*dx+dy*dy)||1;var f=(k*k)/dist;graphNodes[i].vx+=dx/dist*f*0.008;graphNodes[i].vy+=dy/dist*f*0.008;}}
      graphEdges.forEach(function(e){var a=graphNodes[e.a],b=graphNodes[e.b];if(!a||!b)return;var dx=b.x-a.x,dy=b.y-a.y;var dist=Math.sqrt(dx*dx+dy*dy)||1;var target=linkDist;var diff=(dist-target)/dist;var f=diff*0.04;a.vx+=dx*f;a.vy+=dy*f;b.vx-=dx*f;b.vy-=dy*f;});
      graphNodes.forEach(function(n){n.x+=Math.max(-8,Math.min(8,n.vx));n.y+=Math.max(-8,Math.min(8,n.vy));n.x=Math.max(30,Math.min(W/graphTransform.scale-30,n.x));n.y=Math.max(30,Math.min(H/graphTransform.scale-30,n.y));});
      simTick++;
    }
    ctx.clearRect(0,0,W,H);ctx.save();ctx.translate(graphTransform.x,graphTransform.y);ctx.scale(graphTransform.scale,graphTransform.scale);
    var matchedNodes=null;
    if(query){matchedNodes={};graphNodes.forEach(function(n){if(n.name.toLowerCase().includes(query))matchedNodes[n.id]=true;});}
    graphEdges.forEach(function(e){var a=graphNodes[e.a],b=graphNodes[e.b];if(!a||!b)return;var isHL=hoveredNode&&(e.a===hoveredNode.id||e.b===hoveredNode.id);ctx.beginPath();ctx.strokeStyle=isHL?'rgba(124,106,247,0.5)':'rgba(124,106,247,0.08)';ctx.lineWidth=isHL?1.5:0.5;if(isHL){ctx.shadowColor='rgba(124,106,247,0.4)';ctx.shadowBlur=4;}else{ctx.shadowBlur=0;}ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();});
    ctx.shadowBlur=0;
    graphNodes.forEach(function(n){
      var color=typeColors[n.type]||'#7c6af7';
      var isHv=hoveredNode&&hoveredNode.id===n.id;
      var isCn=hoveredNode&&graphEdges.some(function(e){return(e.a===hoveredNode.id&&e.b===n.id)||(e.b===hoveredNode.id&&e.a===n.id);});
      var isMatch=matchedNodes&&matchedNodes[n.id];
      var r=isHv?n.radius*2.2:isCn?n.radius*1.4:isMatch?n.radius*1.8:n.radius;
      if(isHv){ctx.shadowColor=color;ctx.shadowBlur=12;}
      else if(isMatch){ctx.shadowColor='#fde047';ctx.shadowBlur=14;}
      else if(isCn){ctx.shadowColor=color;ctx.shadowBlur=6;}
      else{ctx.shadowBlur=0;}
      ctx.beginPath();ctx.arc(n.x,n.y,r,0,Math.PI*2);
      var alpha=query?(isMatch?'ff':'22'):(isHv?'':isCn?'cc':'55');
      ctx.fillStyle=isHv?color:(alpha?color+alpha:color);
      ctx.fill();
      var showLabel=isHv||isMatch||GraphSettings.showLabels||(graphTransform.scale>1.8);
      if(showLabel){ctx.shadowBlur=0;ctx.font=(isHv||isMatch?'bold ':'')+'10px IBM Plex Mono, monospace';ctx.fillStyle=(isHv||isMatch)?'rgba(232,230,240,1)':'rgba(232,230,240,0.5)';ctx.fillText(n.name,n.x+r+3,n.y+3);}
    });
    ctx.restore();
  });
}
