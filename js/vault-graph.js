// ═══════════════════════════════════════════════════════════
// ══  VAULT GRAPH  ══════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
var graphNodes=[],graphEdges=[],graphAnim=null;
var graphTransform={x:0,y:0,scale:1};
var graphPanning=false,graphPanStart={x:0,y:0};
var hoveredNode=null,simTick=0;
var pinnedNodes={};
var typeColors={
  conversation:'#c084fc',
  project:'#38bdf8',
  lecture:'#facc15',
  daily:'#4ade80',
  general:'#fb923c'
};
var ORPHAN_COLOR='#00e5cc';

// ── Note Birth Particle System ────────────────────────────
var birthParticles=[];
var BIRTH_FPS=1000/30;

// Called externally when a note is created
// type: note type string, targetNodeId: the id of the new node in graphNodes
function spawnBirthParticle(type,targetPath){
  // Find target node by path - may not exist yet, retry for 2s
  var attempts=0;
  function trySpawn(){
    var fname=targetPath.split('/').pop();
    var node=graphNodes.find(function(n){return n.path===targetPath||n.name===fname;});
    if(!node&&attempts<15){attempts++;setTimeout(trySpawn,150);return;}
    var canvas=document.getElementById('vault-graph-canvas');
    if(!canvas)return;
    var W=canvas.width,H=canvas.height;
    // Start from top-center of canvas (screen coords, not graph coords)
    var sx=W*0.5,sy=20;
    var tx=node?node.x:W*0.5;
    var ty=node?node.y:H*0.5;
    birthParticles.push({
      sx:sx,sy:sy,          // start
      tx:tx,ty:ty,          // target
      x:sx,y:sy,            // current
      t:0,                  // 0..1 progress
      col:typeColors[type]||'#7c6af7',
      life:1.2,             // seconds total
      elapsed:0,
      done:false,
      popped:false
    });
  }
  trySpawn();
}

function _tickBirthParticles(dt){
  for(var i=birthParticles.length-1;i>=0;i--){
    var p=birthParticles[i];
    p.elapsed+=dt;
    p.t=Math.min(p.elapsed/p.life,1);
    // Ease in-out cubic
    var e=p.t<0.5?4*p.t*p.t*p.t:(1-Math.pow(-2*p.t+2,3)/2);
    // Arc: add a parabolic lift that rises then falls
    var arc=Math.sin(p.t*Math.PI)*0.18;
    var cx=(p.sx+p.tx)/2;
    var cy=Math.min(p.sy,p.ty)-H_REF*arc;
    // Quadratic bezier
    p.x=(1-e)*(1-e)*p.sx+2*(1-e)*e*cx+e*e*p.tx;
    p.y=(1-e)*(1-e)*p.sy+2*(1-e)*e*cy+e*e*p.ty;
    if(p.t>=1){p.done=true;p.popped=true;}
    if(p.elapsed>p.life+0.3)birthParticles.splice(i,1);
  }
}
var H_REF=0; // updated each frame from canvas height


// ── Sap flow particle system ──────────────────────────────
var sapParticles=[];
function _initSapParticles(){
  sapParticles=[];
  if(!GraphSettings.treeMode&&!GraphSettings.yggdrasilMode)return;
  graphEdges.forEach(function(e){
    if(Math.random()<0.6){
      sapParticles.push({
        edgeA:e.a,edgeB:e.b,
        t:Math.random(),       // 0..1 position along edge
        speed:(0.003+Math.random()*0.005)*(Math.random()<0.5?1:-1),
        size:1.5+Math.random()*1.5,
        alpha:0.4+Math.random()*0.4
      });
    }
  });
}

// ── Leaf sway state ───────────────────────────────────────
var swayTime=0;

function getPreviewLines(content,n){
  if(!content)return'';
  var stripped=content.replace(/^---[\s\S]*?---\s*/,'').trim();
  return stripped.split('\n').filter(function(l){return l.trim().length>0;}).slice(0,n).join('\n');
}

function initGraphCanvas(){
  var canvas=document.getElementById('vault-graph-canvas');
  canvas.width=window.innerWidth;canvas.height=window.innerHeight;
  window.addEventListener('resize',function(){
    canvas.width=window.innerWidth;canvas.height=window.innerHeight;
  });

  // Pan
  canvas.addEventListener('mousedown',function(e){
    if(e.target!==canvas)return;
    graphPanning=true;
    graphPanStart={x:e.clientX-graphTransform.x,y:e.clientY-graphTransform.y};
  });

  // Pinch-to-zoom (touch)
  var lastPinchDist=null;
  canvas.addEventListener('touchstart',function(e){
    if(e.touches.length===2){
      lastPinchDist=Math.hypot(
        e.touches[0].clientX-e.touches[1].clientX,
        e.touches[0].clientY-e.touches[1].clientY
      );
    }
  },{passive:true});
  canvas.addEventListener('touchmove',function(e){
    if(e.touches.length===2&&lastPinchDist!==null){
      e.preventDefault();
      var dist=Math.hypot(
        e.touches[0].clientX-e.touches[1].clientX,
        e.touches[0].clientY-e.touches[1].clientY
      );
      var factor=dist/lastPinchDist;
      var mx=(e.touches[0].clientX+e.touches[1].clientX)/2;
      var my=(e.touches[0].clientY+e.touches[1].clientY)/2;
      graphTransform.x=mx-(mx-graphTransform.x)*factor;
      graphTransform.y=my-(my-graphTransform.y)*factor;
      graphTransform.scale=Math.max(0.1,Math.min(5,graphTransform.scale*factor));
      lastPinchDist=dist;
    }
  },{passive:false});
  canvas.addEventListener('touchend',function(){lastPinchDist=null;});

  // Hover + tooltip
  window.addEventListener('mousemove',function(e){
    if(graphPanning){
      graphTransform.x=e.clientX-graphPanStart.x;
      graphTransform.y=e.clientY-graphPanStart.y;
    }
    if(graphNodes.length){
      var mx=(e.clientX-graphTransform.x)/graphTransform.scale;
      var my=(e.clientY-graphTransform.y)/graphTransform.scale;
      hoveredNode=null;
      for(var i=0;i<graphNodes.length;i++){
        var n=graphNodes[i];var dx=mx-n.x,dy=my-n.y;
        if(Math.sqrt(dx*dx+dy*dy)<n.radius+6){hoveredNode=n;break;}
      }
      var tip=document.getElementById('graph-tooltip');
      if(hoveredNode){
        document.getElementById('tt-name').textContent=hoveredNode.name;
        document.getElementById('tt-path').textContent=hoveredNode.path;
        var typeEl=document.getElementById('tt-type');
        var linkCount=graphEdges.filter(function(e){return e.a===hoveredNode.id||e.b===hoveredNode.id;}).length;
        typeEl.textContent=hoveredNode.type+(hoveredNode.orphan?' · orphan':'')+(pinnedNodes[hoveredNode.id]?' · pinned':'')+' · '+linkCount+' links';
        var col=hoveredNode.orphan?ORPHAN_COLOR:(typeColors[hoveredNode.type]||'#7c6af7');
        typeEl.style.background=col+'22';typeEl.style.color=col;
        typeEl.style.border='1px solid '+col+'44';
        // Preview + last modified
        var previewEl=document.getElementById('tt-preview');
        if(previewEl){
          var note=vaultIndex[hoveredNode.srcIdx];
          var preview=getPreviewLines(hoveredNode.content,3);
          var modLine='';
          if(note&&note.mtime){
            var d=new Date(note.mtime);
            modLine='\n— '+d.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});
          }
          previewEl.textContent=preview+(modLine?'\n'+modLine:'');
        }
        tip.style.display='block';
        tip.style.left=Math.min(e.clientX+14,window.innerWidth-270)+'px';
        tip.style.top=Math.min(e.clientY-10,window.innerHeight-130)+'px';
        canvas.style.cursor='pointer';
      }else{
        tip.style.display='none';
        canvas.style.cursor=graphPanning?'grabbing':'grab';
      }
    }
  });

  window.addEventListener('mouseup',function(){graphPanning=false;});

  // Scroll zoom
  canvas.addEventListener('wheel',function(e){
    e.preventDefault();
    var factor=e.deltaY>0?0.9:1.1;
    var mx=e.clientX,my=e.clientY;
    graphTransform.x=mx-(mx-graphTransform.x)*factor;
    graphTransform.y=my-(my-graphTransform.y)*factor;
    graphTransform.scale=Math.max(0.1,Math.min(5,graphTransform.scale*factor));
  },{passive:false});

  // Click → open note
  canvas.addEventListener('click',function(e){
    if(!hoveredNode)return;
    var note=vaultIndex[hoveredNode.srcIdx!==undefined?hoveredNode.srcIdx:hoveredNode.id];
    if(!note)return;
    if(typeof VAULTUI!=='undefined'&&VAULTUI.showPanel){
      VAULTUI.showPanel();
      setTimeout(function(){
        var idx=vaultIndex.indexOf(note);
        if(idx>=0&&VAULTUI._openNoteByIdx)VAULTUI._openNoteByIdx(idx);
      },80);
    }
  });

  // Double-click → pin/unpin
  canvas.addEventListener('dblclick',function(e){
    if(!hoveredNode)return;
    var id=hoveredNode.id;
    if(pinnedNodes[id]){delete pinnedNodes[id];hoveredNode.pinned=false;}
    else{pinnedNodes[id]=true;hoveredNode.pinned=true;}
  });
}

function buildGraph(){
  document.getElementById('graph-overlay').classList.add('hidden');
  document.getElementById('graph-stats').style.display='flex';

  var candidates=vaultIndex.slice(0,150).map(function(note,i){
    return{srcIdx:i,name:note.name.replace('.md',''),path:note.path,
           type:detectType(note.path,note.content),content:note.content};
  });
  var filtered=candidates.filter(function(c){return GraphSettings.typeFilter[c.type]!==false;});

  graphNodes=filtered.map(function(c,i){
    return{id:i,srcIdx:c.srcIdx,name:c.name,path:c.path,type:c.type,
           content:c.content,x:0,y:0,vx:0,vy:0,
           radius:(4+Math.min(c.content.length/600,7))*(GraphSettings.nodeSizeScale||1),
           connCount:0,orphan:false,pinned:!!pinnedNodes[i],
           swayOffset:Math.random()*Math.PI*2};
  });

  var edgeMap={};graphEdges=[];
  var nameMap={};graphNodes.forEach(function(n){nameMap[n.name.toLowerCase()]=n.id;});
  graphNodes.forEach(function(n){
    var note=vaultIndex[n.srcIdx];
    var links=note.content.match(/\[\[([^\]|]+)/g)||[];
    links.forEach(function(l){
      var target=l.replace('[[','').toLowerCase();
      if(nameMap[target]!==undefined&&nameMap[target]!==n.id){
        var a=Math.min(n.id,nameMap[target]),b=Math.max(n.id,nameMap[target]);
        var key=a+'-'+b;
        if(edgeMap[key]){edgeMap[key].weight++;}
        else{edgeMap[key]={a:n.id,b:nameMap[target],weight:1};graphEdges.push(edgeMap[key]);}
      }
    });
  });

  graphEdges.forEach(function(e){
    if(graphNodes[e.a])graphNodes[e.a].connCount++;
    if(graphNodes[e.b])graphNodes[e.b].connCount++;
  });
  graphNodes.forEach(function(n){
  // Only send to orphan grove if unlinked AND untyped (general)
  // Typed notes (daily, lecture, conversation, project) always stay in their tree
  n.orphan=(n.connCount===0&&n.type==='general');
});

  if(GraphSettings.sizeByConnections){
    var maxConn=Math.max(1,Math.max.apply(null,graphNodes.map(function(n){return n.connCount;})));
    graphNodes.forEach(function(n){
      n.radius=(3+Math.min((n.connCount/maxConn)*10,10))*(GraphSettings.nodeSizeScale||1);
    });
  }

  document.getElementById('stat-notes').textContent=graphNodes.length;
  document.getElementById('stat-links').textContent=graphEdges.length;
  _updateModeLabel();

  var _canvas=document.getElementById('vault-graph-canvas');
  var W=window.innerWidth;
  var H=window.innerHeight;
  // Sync canvas pixel buffer to match — critical so sim loop uses same coords
  if(_canvas){
    if(_canvas.offsetWidth>100)W=_canvas.offsetWidth;
    if(_canvas.offsetHeight>100)H=_canvas.offsetHeight;
    _canvas.width=W;_canvas.height=H;
  }

  if(GraphSettings.yggdrasilMode){_layoutYggdrasil(W,H);}
  else if(GraphSettings.treeMode){_layoutForest(W,H);}
  else if(GraphSettings.gridMode){_layoutGrid(W,H);}
  else if(GraphSettings.clusterMode){_layoutCluster(W,H);}
  else{
    _scatterNodes(W,H);
  }

  _initSapParticles();
  simTick=0;if(graphAnim)cancelAnimationFrame(graphAnim);runGraphSim();
}

function _scatterNodes(W,H){
  // Ensure canvas pixel buffer matches layout size
  var canvas=document.getElementById('vault-graph-canvas');
  var cW=W||window.innerWidth;
  var cH=H||window.innerHeight;
  if(canvas){
    // Re-sync canvas pixel buffer in case it hasn't been set yet
    if(canvas.width<100||canvas.height<100){
      canvas.width=cW;canvas.height=cH;
    }
    // Always prefer actual canvas buffer size for consistency with sim loop
    if(canvas.width>100)cW=canvas.width;
    if(canvas.height>100)cH=canvas.height;
  }
  var spread=Math.min(0.95,0.7*(GraphSettings.graphArea||1));
  var margin=(1-spread)/2;
  graphNodes.forEach(function(n){
    n.x=cW*margin+Math.random()*(cW*spread);
    n.y=cH*(0.15+margin)+Math.random()*(cH*(spread*0.7));
  });
}

function _updateModeLabel(){
  var el=document.getElementById('stat-mode');
  if(!el)return;
  var mode=GraphSettings.yggdrasilMode?'🌳 Yggdrasil':
            GraphSettings.treeMode?'🌲 Forest':
            GraphSettings.gridMode?'⊞ Grid':
            GraphSettings.clusterMode?'⬡ Cluster':'◎ Default';
  el.textContent=mode;
}

// ── GRID LAYOUT ───────────────────────────────────────────
function _layoutGrid(W,H){
  var sorted=graphNodes.slice().sort(function(a,b){return b.connCount-a.connCount;});
  var cols=Math.ceil(Math.sqrt(sorted.length*1.6));
  var spread=Math.min(0.90,0.7*(GraphSettings.graphArea||1));
  sorted.forEach(function(n,i){
    var col=i%cols,row=Math.floor(i/cols);
    n.x=W*(0.05+spread*(col/(cols-1||1)));
    n.y=H*(0.10+0.80*(row/Math.max(1,Math.ceil(sorted.length/cols)-1)));
  });
}

// ── FOREST LAYOUT ─────────────────────────────────────────
function _layoutForest(W,H){
  var TYPE_ORDER=['conversation','project','lecture','daily','general'];
  var USABLE_LEFT=0.06,USABLE_RIGHT=0.94;
  var USABLE_TOP=0.08,USABLE_BOTTOM=0.86;
  var GAP_FRAC=0.04;

  var groups={};
  TYPE_ORDER.forEach(function(t){groups[t]=[];});
  var orphans=[];
  graphNodes.forEach(function(n){
    if(n.orphan)orphans.push(n);
    else groups[n.type].push(n);
  });

  var activeGroups=TYPE_ORDER.filter(function(t){return groups[t].length>0;});
  activeGroups.sort(function(a,b){return groups[b].length-groups[a].length;});
  var ordered=_centerLargest(activeGroups);

  var numSlots=ordered.length+(orphans.length>0?1:0);
  var totalGap=GAP_FRAC*(numSlots-1);
  var usableW=(USABLE_RIGHT-USABLE_LEFT)-totalGap;
  var slotW=usableW/Math.max(numSlots,1);
  var treeH=H*(USABLE_BOTTOM-USABLE_TOP);
  var baseY=H*USABLE_BOTTOM;

  ordered.forEach(function(type,treeIdx){
    var members=groups[type];
    var treeCX=W*(USABLE_LEFT+(treeIdx*(slotW+GAP_FRAC)+slotW*0.5));
    if(members.length===1){members[0].x=treeCX;members[0].y=baseY-treeH*0.3;return;}
    members.sort(function(a,b){return b.connCount-a.connCount;});
    var layers=_buildLayers(members);
    var numLayers=layers.length;
    layers.forEach(function(layer,li){
      var yFrac=li/(Math.max(numLayers-1,1));
      var y=baseY-yFrac*treeH*0.85;
      var spreadFrac=0.12+yFrac*0.42;
      var maxSpread=(slotW*W)*spreadFrac*0.5;
      layer.forEach(function(node,ni){
        var xFrac=layer.length===1?0.5:(ni/(layer.length-1));
        node.x=treeCX-maxSpread+xFrac*(maxSpread*2)+(Math.random()-0.5)*8;
        node.y=y+(Math.random()-0.5)*10;
        // Tag leaf nodes for sway
        node.isLeaf=(li===numLayers-1);
      });
    });
  });

  if(orphans.length>0){
    var groveCX=W*(USABLE_LEFT+(ordered.length*(slotW+GAP_FRAC)+slotW*0.5));
    orphans.forEach(function(n,i){
      var angle=(i/Math.max(orphans.length,1))*Math.PI*2;
      var r=25+Math.random()*35;
      n.x=groveCX+Math.cos(angle)*r;
      n.y=baseY-treeH*0.22+Math.sin(angle)*r*0.5;
      n.isLeaf=true;
    });
  }
}

// ── YGGDRASIL LAYOUT ──────────────────────────────────────
function _layoutYggdrasil(W,H){
  var CX=W*0.5;
  var TRUNK_Y=H*0.78;
  var CANOPY_TOP=H*0.06;
  var ROOT_BOT=H*0.95;

  var orphans=graphNodes.filter(function(n){return n.orphan;});
  var nonOrphans=graphNodes.filter(function(n){return!n.orphan;});
  nonOrphans.sort(function(a,b){return b.connCount-a.connCount;});

  if(nonOrphans.length>0){
    nonOrphans[0].x=CX;nonOrphans[0].y=TRUNK_Y;
    nonOrphans[0].isLeaf=false;
  }

  var TYPE_ORDER=['conversation','project','lecture','daily','general'];
  var typeGroups={};
  TYPE_ORDER.forEach(function(t){typeGroups[t]=[];});
  nonOrphans.slice(1).forEach(function(n){typeGroups[n.type].push(n);});

  var activeTypes=TYPE_ORDER.filter(function(t){return typeGroups[t].length>0;});
  var numBranches=activeTypes.length;
  var angleStart=-Math.PI*0.88,angleEnd=-Math.PI*0.12;
  var trunkTreeH=TRUNK_Y-CANOPY_TOP;

  activeTypes.forEach(function(type,bi){
    var members=typeGroups[type];if(!members.length)return;
    var t=numBranches===1?0.5:(bi/(numBranches-1));
    var branchAngle=angleStart+(angleEnd-angleStart)*t;
    members.sort(function(a,b){return b.connCount-a.connCount;});
    var layers=_buildLayers(members);
    var numLayers=layers.length;
    layers.forEach(function(layer,li){
      var distFrac=(li+1)/(numLayers+1);
      var dist=distFrac*trunkTreeH*0.88;
      var spreadW=dist*0.28*(1+distFrac*0.5);
      var bx=CX+Math.cos(branchAngle)*dist;
      var by=TRUNK_Y+Math.sin(branchAngle)*dist;
      layer.forEach(function(node,ni){
        var xFrac=layer.length===1?0:(ni/(layer.length-1)-0.5);
        var perpAngle=branchAngle+Math.PI/2;
        node.x=bx+Math.cos(perpAngle)*xFrac*spreadW*2+(Math.random()-0.5)*10;
        node.y=by+Math.sin(perpAngle)*xFrac*spreadW*2+(Math.random()-0.5)*8;
        node.isLeaf=(li===numLayers-1);
      });
    });
  });

  // Roots
  orphans.forEach(function(n,i){
    var angle=Math.PI*0.3+((i/(Math.max(orphans.length-1,1)))*Math.PI*0.4);
    var dist=(0.15+Math.random()*0.55)*(ROOT_BOT-TRUNK_Y);
    n.x=CX+Math.cos(angle)*dist*0.7+(Math.random()-0.5)*40;
    n.y=TRUNK_Y+Math.sin(angle)*dist;
    n.isLeaf=false;
  });
}

// ── CLUSTER LAYOUT ────────────────────────────────────────
function _layoutCluster(W,H){
  var typeOrder=['conversation','project','lecture','daily','general'];
  var groupCenters={};
  var activeTypes=typeOrder.filter(function(t){
    return graphNodes.some(function(n){return n.type===t&&!n.orphan;});
  });
  activeTypes.forEach(function(t,gi){
    var angle=(gi/activeTypes.length)*Math.PI*2-Math.PI/2;
    groupCenters[t]={x:W/2+Math.cos(angle)*W*0.28,y:H/2+Math.sin(angle)*H*0.28};
  });
  graphNodes.forEach(function(n){
    if(n.orphan){
      var angle=(graphNodes.indexOf(n)/Math.max(1,graphNodes.filter(function(x){return x.orphan;}).length))*Math.PI*2;
      n.x=W*0.12+Math.cos(angle)*45;n.y=H*0.82+Math.sin(angle)*45;
    }else{
      var center=groupCenters[n.type]||{x:W/2,y:H/2};
      n.x=center.x+(Math.random()-0.5)*160;
      n.y=center.y+(Math.random()-0.5)*160;
    }
  });
}

// ── Helpers ───────────────────────────────────────────────
function _centerLargest(arr){
  if(arr.length<=1)return arr;
  var mid=Math.floor(arr.length/2);
  var result=arr.slice();
  var biggest=result.splice(0,1)[0];
  result.splice(mid,0,biggest);
  return result;
}
function _buildLayers(members){
  var layers=[];var i=0;var layerSize=1;
  while(i<members.length){
    layers.push(members.slice(i,i+layerSize));
    i+=layerSize;layerSize=Math.min(Math.ceil(layerSize*1.6),6);
  }
  return layers;
}

function detectType(path,content){
  var p=(path||'').toLowerCase();var c=(content||'').toLowerCase();
  var fname=(path||'').split('/').pop().toLowerCase();
  if(p.includes('conversation')||c.includes('type: conversation'))return'conversation';
  if(p.includes('01-projects')||c.includes('type: project'))return'project';
  if(p.includes('lecture')||c.includes('type: lecture'))return'lecture';
  // daily: explicit type tag, daily-log folder, 00-capture with date filename, or YYYY-MM-DD.md anywhere
  if(c.includes('type: daily')||c.includes('type: daily log')||c.includes('type: daily-log'))return'daily';
  if(p.includes('07-system/daily')||p.includes('daily-log')||p.includes('daily log'))return'daily';
  if(p.includes('00-capture')&&/^\d{4}-\d{2}-\d{2}\.md$/.test(fname))return'daily';
  if(/^\d{4}-\d{2}-\d{2}\.md$/.test(fname))return'daily';
  return'general';
}

// ── SIMULATION + DRAW LOOP ────────────────────────────────
var GRAPH_FPS=1000/30,lastGraphFrame=0;
function runGraphSim(){
  graphAnim=requestAnimationFrame(function(now){
    runGraphSim();if(now-lastGraphFrame<GRAPH_FPS)return;lastGraphFrame=now;
    var dt=1/30;
    swayTime+=dt;
    H_REF=H;
    _tickBirthParticles(dt);

    var canvas=document.getElementById('vault-graph-canvas');
    var ctx=canvas.getContext('2d');
    var W=canvas.width,H=canvas.height;
    var linkDist=GraphSettings.linkDistance||90;
    var repulsion=(GraphSettings.repulsion||100)/100;
    var query=GraphSettings.searchQuery||'';
    var treeMode=GraphSettings.treeMode||false;
    var clusterMode=GraphSettings.clusterMode||false;
    var gridMode=GraphSettings.gridMode||false;
    var yggMode=GraphSettings.yggdrasilMode||false;
    var brightness=GraphSettings.nodeBrightness!==undefined?GraphSettings.nodeBrightness:1.0;
    var staticLayout=treeMode||gridMode||yggMode;

    // Physics sim (default + cluster only)
    if(simTick<300&&!staticLayout){
      var k=Math.sqrt((W*H)/Math.max(graphNodes.length,1))*0.9*repulsion;
      for(var i=0;i<graphNodes.length;i++){
        graphNodes[i].vx=0;graphNodes[i].vy=0;
        for(var j=0;j<graphNodes.length;j++){
          if(i===j)continue;
          var dx=graphNodes[i].x-graphNodes[j].x;
          var dy=graphNodes[i].y-graphNodes[j].y;
          var dist=Math.sqrt(dx*dx+dy*dy)||1;
          var f=(k*k)/dist;
          graphNodes[i].vx+=dx/dist*f*0.008;
          graphNodes[i].vy+=dy/dist*f*0.008;
        }
      }
      graphEdges.forEach(function(e){
        var a=graphNodes[e.a],b=graphNodes[e.b];if(!a||!b)return;
        var dx=b.x-a.x,dy=b.y-a.y;
        var dist=Math.sqrt(dx*dx+dy*dy)||1;
        var diff=(dist-linkDist)/dist;
        var w=0.04*(1+Math.min(e.weight-1,3)*0.15);
        a.vx+=dx*w*diff;a.vy+=dy*w*diff;
        b.vx-=dx*w*diff;b.vy-=dy*w*diff;
      });
      if(clusterMode){
        var typeOrder=['conversation','project','lecture','daily','general'];
        var activeCenters={};
        typeOrder.forEach(function(t){
          var m=graphNodes.filter(function(n){return n.type===t&&!n.orphan;});
          if(!m.length)return;
          activeCenters[t]={
            x:m.reduce(function(s,n){return s+n.x;},0)/m.length,
            y:m.reduce(function(s,n){return s+n.y;},0)/m.length
          };
        });
        graphNodes.forEach(function(n){
          if(n.orphan){n.vx+=(W*0.12-n.x)*0.002;n.vy+=(H*0.82-n.y)*0.002;}
          else if(activeCenters[n.type]){
            var tc=activeCenters[n.type];
            n.vx+=(tc.x-n.x)*0.0008;n.vy+=(tc.y-n.y)*0.0008;
          }
        });
      }
      graphNodes.forEach(function(n){
        if(n.pinned)return;
        n.x+=Math.max(-8,Math.min(8,n.vx));
        n.y+=Math.max(-8,Math.min(8,n.vy));
        n.x=Math.max(30,Math.min(W/graphTransform.scale-30,n.x));
        n.y=Math.max(30,Math.min(H/graphTransform.scale-30,n.y));
      });
      simTick++;
    }

    // Advance sap particles
    sapParticles.forEach(function(p){
      p.t+=p.speed;
      if(p.t>1)p.t=0;
      if(p.t<0)p.t=1;
    });

    // ── DRAW ──────────────────────────────────────────────
    ctx.clearRect(0,0,W,H);
    ctx.save();
    ctx.translate(graphTransform.x,graphTransform.y);
    ctx.scale(graphTransform.scale,graphTransform.scale);

    if(treeMode)_drawForest(ctx,W,H);
    if(yggMode)_drawYggdrasil(ctx,W,H);
    if(clusterMode&&!treeMode&&!yggMode)_drawClusterHalos(ctx);

    var matchedNodes=null;
    if(query){
      matchedNodes={};
      graphNodes.forEach(function(n){if(n.name.toLowerCase().includes(query))matchedNodes[n.id]=true;});
    }

    // Cross-type edges arc over in tree/ygg modes
    graphEdges.forEach(function(e){
      var a=graphNodes[e.a],b=graphNodes[e.b];if(!a||!b)return;
      var isHL=hoveredNode&&(e.a===hoveredNode.id||e.b===hoveredNode.id);
      var baseW=0.5+Math.min(e.weight-1,4)*0.6;
      var col=typeColors[a.type]||'#7c6af7';
      var sameType=a.type===b.type;

      if((treeMode||yggMode)&&sameType){
        _drawBranchEdge(ctx,a,b,col,isHL,baseW);
      }else if((treeMode||yggMode)&&!sameType){
        // Cross-type: arc gracefully over the scene
        _drawArcEdge(ctx,a,b,isHL,baseW);
      }else{
        ctx.beginPath();
        ctx.strokeStyle=isHL?(col+'cc'):'rgba(124,106,247,0.08)';
        ctx.lineWidth=isHL?Math.max(baseW,1.5):baseW;
        if(isHL){ctx.shadowColor=col+'66';ctx.shadowBlur=4;}else{ctx.shadowBlur=0;}
        ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      }
    });
    ctx.shadowBlur=0;

    // Sap flow particles (tree + ygg modes)
    if(treeMode||yggMode){
      sapParticles.forEach(function(p){
        var a=graphNodes[p.edgeA],b=graphNodes[p.edgeB];
        if(!a||!b)return;
        var px=a.x+(b.x-a.x)*p.t;
        var py=a.y+(b.y-a.y)*p.t;
        var col=typeColors[a.type]||'#7c6af7';
        ctx.beginPath();ctx.arc(px,py,p.size,0,Math.PI*2);
        ctx.fillStyle=col+(Math.round(p.alpha*255).toString(16).padStart(2,'0'));
        ctx.shadowColor=col;ctx.shadowBlur=4;
        ctx.fill();ctx.shadowBlur=0;
      });
    }

    // Nodes with leaf sway
    graphNodes.forEach(function(n){_drawNode(ctx,n,matchedNodes,brightness);});

    ctx.restore();

    // Birth particles drawn in screen space (after restore, ignores transform)
    _drawBirthParticles(ctx);
  });
}

// ── Draw curved branch edge ───────────────────────────────
