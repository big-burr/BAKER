// ═══════════════════════════════════════════════════════════
// ══  INBOX MODULE  ═════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// Quick capture panel — dump thoughts, ideas, tasks fast.
// Voice or type. Sort later into vault/tasks.
// Saves to 00-Capture/Inbox.md
// ═══════════════════════════════════════════════════════════
var INBOX=(function(){

  var LS_KEY='baker_inbox_v1';
  var PANEL_ID='inbox-panel';
  var items=[];

  function _load(){try{var r=localStorage.getItem(LS_KEY);if(r)items=JSON.parse(r);}catch(e){items=[];}}
  function _save(){
    try{localStorage.setItem(LS_KEY,JSON.stringify(items));}catch(e){}
    _syncToVault();
  }
  function _id(){return 'i'+Date.now().toString(36);}
  function _ts(){
    var d=new Date();
    return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  }
  function _date(){return new Date().toISOString().slice(0,10);}

  async function _syncToVault(){
    if(typeof vaultHandle==='undefined'||!vaultHandle||!vaultConnected)return;
    try{
      var open=items.filter(function(i){return!i.processed;});
      var md='---\ntype: inbox\nupdated: '+new Date().toISOString()+'\n---\n\n# BAKER Inbox\n\n';
      if(!open.length){md+='_All clear._\n';}
      else{open.forEach(function(item){md+='- [ ] '+item.text+' _('+item.date+' '+item.ts+')_\n';});}
      var processed=items.filter(function(i){return i.processed;});
      if(processed.length){
        md+='\n## Processed\n\n';
        processed.slice(-20).forEach(function(item){md+='- [x] '+item.text+'\n';});
      }
      var dir=await vaultHandle.getDirectoryHandle('00-Capture',{create:true});
      var fh=await dir.getFileHandle('Inbox.md',{create:true});
      var w=await fh.createWritable();await w.write(md);await w.close();
      if(typeof spawnBirthParticle==='function')spawnBirthParticle('daily','00-Capture/Inbox.md');
    }catch(e){}
  }

  function addItem(text){
    if(!text||!text.trim())return;
    items.unshift({id:_id(),text:text.trim(),date:_date(),ts:_ts(),processed:false});
    _save();render();
    if(typeof speakResponse==='function')speakResponse('Added to inbox, sir.');
  }

  function processItem(id){
    var item=items.find(function(i){return i.id===id;});
    if(item)item.processed=true;
    _save();render();
  }

  function sendToTasks(id){
    var item=items.find(function(i){return i.id===id;});
    if(!item)return;
    if(typeof CAL!=='undefined'&&CAL.addTask)CAL.addTask(item.text,null);
    item.processed=true;
    _save();render();
    if(typeof speakResponse==='function')speakResponse('Moved to tasks, sir.');
  }

  function deleteItem(id){
    items=items.filter(function(i){return i.id!==id;});
    _save();render();
  }

  function clearProcessed(){
    items=items.filter(function(i){return!i.processed;});
    _save();render();
  }

  function render(){
    var body=document.getElementById('inbox-body');if(!body)return;
    var open=items.filter(function(i){return!i.processed;});
    var processed=items.filter(function(i){return i.processed;});

    var html=
      // Quick add
      '<div style="display:flex;gap:6px;margin-bottom:14px">'+
        '<input id="inbox-input" placeholder="Capture a thought, idea, or task..." '+
        'style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-family:var(--mono);font-size:11px;color:var(--text);outline:none">'+
        '<button id="inbox-add" style="background:var(--accent-dim);border:1px solid var(--accent);border-radius:6px;padding:8px 14px;font-family:var(--mono);font-size:11px;color:var(--accent);cursor:pointer">+</button>'+
      '</div>'+
      // Count
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'+
        '<span style="font-family:var(--mono);font-size:9px;color:var(--muted)">'+open.length+' items to process</span>'+
        (processed.length?'<button id="inbox-clear" style="background:none;border:none;font-family:var(--mono);font-size:9px;color:var(--muted);cursor:pointer">Clear processed</button>':'')+
      '</div>';

    if(!open.length&&!processed.length){
      html+='<div style="font-family:var(--mono);font-size:11px;color:var(--muted);text-align:center;padding:24px">Inbox zero. 🎉</div>';
    }

    // Open items
    open.forEach(function(item){
      html+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:6px">'+
        '<div style="display:flex;align-items:flex-start;gap:8px">'+
          '<div style="flex:1">'+
            '<div style="font-family:var(--mono);font-size:11px;color:var(--text);margin-bottom:4px">'+item.text.replace(/</g,'&lt;')+'</div>'+
            '<div style="font-family:var(--mono);font-size:9px;color:var(--muted)">'+item.date+' '+item.ts+'</div>'+
          '</div>'+
          '<div style="display:flex;gap:4px;flex-shrink:0">'+
            '<button class="ib-task" data-id="'+item.id+'" title="Send to tasks" style="background:none;border:1px solid var(--border);border-radius:4px;padding:3px 6px;font-size:10px;color:var(--muted);cursor:pointer">&#128197;</button>'+
            '<button class="ib-done" data-id="'+item.id+'" title="Mark processed" style="background:none;border:1px solid var(--border);border-radius:4px;padding:3px 6px;font-size:10px;color:var(--muted);cursor:pointer">&#10003;</button>'+
            '<button class="ib-del" data-id="'+item.id+'" title="Delete" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:13px;padding:2px 4px">&#215;</button>'+
          '</div>'+
        '</div></div>';
    });

    // Processed (collapsed)
    if(processed.length){
      html+='<div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:.08em;margin-top:10px;margin-bottom:6px">PROCESSED ('+processed.length+')</div>';
      processed.slice(0,10).forEach(function(item){
        html+='<div style="padding:5px 8px;font-family:var(--mono);font-size:10px;color:var(--muted);text-decoration:line-through">'+item.text.replace(/</g,'&lt;')+'</div>';
      });
    }

    body.innerHTML=html;

    // Bind
    var inp=document.getElementById('inbox-input');
    var addBtn=document.getElementById('inbox-add');
    if(addBtn)addBtn.addEventListener('click',function(){if(inp)addItem(inp.value);inp&&(inp.value='');});
    if(inp)inp.addEventListener('keydown',function(e){if(e.key==='Enter'){addItem(inp.value);inp.value='';}});
    var clrBtn=document.getElementById('inbox-clear');
    if(clrBtn)clrBtn.addEventListener('click',clearProcessed);
    document.querySelectorAll('.ib-task').forEach(function(b){b.addEventListener('click',function(){sendToTasks(b.dataset.id);});});
    document.querySelectorAll('.ib-done').forEach(function(b){b.addEventListener('click',function(){processItem(b.dataset.id);});});
    document.querySelectorAll('.ib-del').forEach(function(b){b.addEventListener('click',function(){deleteItem(b.dataset.id);});});
  }

  function showPanel(){var p=document.getElementById(PANEL_ID);if(!p)return;p.classList.add('ib-vis');if(p._wbNormalise)p._wbNormalise();render();}
  function hidePanel(){var p=document.getElementById(PANEL_ID);if(p)p.classList.remove('ib-vis');}
  function togglePanel(){var p=document.getElementById(PANEL_ID);if(!p)return;if(p.classList.contains('ib-vis'))hidePanel();else showPanel();}

  function handleVoice(cmd){
    var c=cmd.toLowerCase().trim();
    if(/\b(open|show)\b.*\binbox\b|\binbox\b/.test(c)&&!/add to/.test(c)){showPanel();return'Inbox open, sir.';}
    var captureM=c.match(/(?:add to inbox|capture|note this|jot|inbox)\s*[:,]?\s*(.+)/);
    if(captureM){addItem(captureM[1].trim());return'Captured, sir.';}
    return null;
  }

  function init(){_load();}
  return{init,showPanel,hidePanel,togglePanel,handleVoice,addItem};
})();
