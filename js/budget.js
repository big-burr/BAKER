// ═══════════════════════════════════════════════════════════
// BAKER BUDGET MODULE
// ═══════════════════════════════════════════════════════════
var BUDGET=(function(){

  // ── Constants ────────────────────────────────────────────
  var STORAGE_KEY='baker_budget_v1';
  var CAT_COLORS={
    'Food':       '#f87171',
    'Savings':    '#60a5fa',
    'Investments':'#a78bfa',
    'Bills':      '#fbbf24',
    'College':    '#34d399',
    'Fun Fund':   '#f472b6',
    'Income':     '#4ade80'
  };
  var CATEGORIES=['Food','Savings','Investments','Bills','College','Fun Fund'];

  // ── State ─────────────────────────────────────────────────
  var viewYear,viewMonth; // currently viewed month
  var data={}; // { 'YYYY-MM': { income:0, budgets:{cat:num}, transactions:[{id,date,cat,amount,note,type}] } }
  var currentTab='log';

  // ── Storage ───────────────────────────────────────────────
  function load(){
    try{
      var raw=localStorage.getItem(STORAGE_KEY);
      if(raw)data=JSON.parse(raw);
    }catch(e){data={};}
    // Init current month view
    var now=new Date();
    viewYear=now.getFullYear();
    viewMonth=now.getMonth(); // 0-indexed
  }

  function save(){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}catch(e){}
  }

  function monthKey(y,m){
    return y+'-'+String(m+1).padStart(2,'0');
  }

  function getMonth(y,m){
    var k=monthKey(y,m);
    if(!data[k])data[k]={income:0,budgets:{},transactions:[]};
    return data[k];
  }

  // ── Calculations ──────────────────────────────────────────
  function calcSpentByCat(md){
    var out={};
    CATEGORIES.forEach(function(c){out[c]=0;});
    (md.transactions||[]).forEach(function(tx){
      if(tx.type==='expense'&&out[tx.cat]!==undefined)out[tx.cat]+=tx.amount;
    });
    return out;
  }

  function calcTotals(md){
    var spent=0,saved=0,income=md.income||0;
    (md.transactions||[]).forEach(function(tx){
      if(tx.type==='expense'){
        spent+=tx.amount;
        if(tx.cat==='Savings'||tx.cat==='Investments')saved+=tx.amount;
      }
    });
    return{income:income,spent:spent,saved:saved,left:income-spent};
  }

  // ── Pie Chart ─────────────────────────────────────────────
  function drawPie(md){
    var canvas=document.getElementById('bp-pie-canvas');
    if(!canvas)return;
    var ctx=canvas.getContext('2d');
    var W=canvas.width,H=canvas.height;
    var cx=W/2,cy=H/2,R=Math.min(W,H)/2-8,innerR=R*0.5;
    ctx.clearRect(0,0,W,H);

    var spent=calcSpentByCat(md);
    var total=Object.values(spent).reduce(function(s,v){return s+v;},0);

    if(total===0){
      // Empty state — grey ring
      ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);
      ctx.arc(cx,cy,innerR,0,Math.PI*2,true);
      ctx.fillStyle='rgba(255,255,255,.06)';ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.2)';
      ctx.font='bold 13px IBM Plex Mono,monospace';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('No data',cx,cy);
      return;
    }

    var startAngle=-Math.PI/2;
    var legend=document.getElementById('bp-legend');
    if(legend)legend.innerHTML='';

    CATEGORIES.forEach(function(cat){
      var val=spent[cat]||0;
      if(val<=0)return;
      var slice=(val/total)*(Math.PI*2);
      var color=CAT_COLORS[cat]||'#7c6af7';

      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.arc(cx,cy,R,startAngle,startAngle+slice);
      ctx.closePath();
      ctx.fillStyle=color;
      ctx.fill();

      // Donut hole
      ctx.beginPath();
      ctx.arc(cx,cy,innerR,0,Math.PI*2);
      ctx.fillStyle='rgba(22,22,25,.97)';
      ctx.fill();

      startAngle+=slice;

      // Legend row
      if(legend){
        var pct=Math.round((val/total)*100);
        var row=document.createElement('div');row.className='bp-legend-row';
        row.innerHTML='<span class="bp-legend-label"><span class="bp-legend-dot" style="background:'+color+'"></span>'+cat+'</span>'+
          '<span class="bp-legend-val">$'+val.toFixed(2)+'</span>'+
          '<span class="bp-legend-pct">'+pct+'%</span>';
        legend.appendChild(row);
      }
    });

    // Center text
    var totals=calcTotals(md);
    ctx.fillStyle='var(--text)';
    ctx.font='bold 18px IBM Plex Mono,monospace';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle='#e8e6f0';
    ctx.fillText('$'+total.toFixed(0),cx,cy-8);
    ctx.font='10px IBM Plex Mono,monospace';
    ctx.fillStyle='#7a7880';
    ctx.fillText('spent',cx,cy+10);
  }

  // ── Totals display ────────────────────────────────────────
  function renderTotals(md){
    var t=calcTotals(md);
    function el(id){return document.getElementById(id);}
    function fmt(v){return'$'+Math.abs(v).toFixed(2);}
    if(el('bp-total-income'))el('bp-total-income').textContent=fmt(t.income);
    if(el('bp-total-spent'))el('bp-total-spent').textContent=fmt(t.spent);
    var leftEl=el('bp-total-left');
    if(leftEl){
      leftEl.textContent=(t.left<0?'-':'')+fmt(t.left);
      leftEl.className='bp-total-val left '+(t.left>=0?'positive':'negative');
    }
    if(el('bp-total-saved'))el('bp-total-saved').textContent=fmt(t.saved);
  }

  // ── Month label ───────────────────────────────────────────
  function renderMonthLabel(){
    var el=document.getElementById('bp-month-label');
    if(!el)return;
    var names=['January','February','March','April','May','June',
               'July','August','September','October','November','December'];
    el.textContent=names[viewMonth]+' '+viewYear;
  }

  // ── Log tab ───────────────────────────────────────────────
  function renderLog(md){
    var el=document.getElementById('bp-tab-content');
    if(!el)return;
    var html='';

    // Add transaction form
    html+='<div class="bp-add">'+
      '<div class="bp-add-row">'+
        '<span class="bp-add-label">Type</span>'+
        '<select class="bp-select" id="bp-add-type">'+
          '<option value="expense">Expense</option>'+
          '<option value="income">Income</option>'+
        '</select>'+
      '</div>'+
      '<div class="bp-add-row">'+
        '<span class="bp-add-label">Category</span>'+
        '<select class="bp-select" id="bp-add-cat">'+
          CATEGORIES.map(function(c){return'<option>'+c+'</option>';}).join('')+
        '</select>'+
      '</div>'+
      '<div class="bp-add-row">'+
        '<span class="bp-add-label">Amount</span>'+
        '<input class="bp-input" id="bp-add-amount" type="number" min="0" step="0.01" placeholder="0.00">'+
      '</div>'+
      '<div class="bp-add-row">'+
        '<span class="bp-add-label">Note</span>'+
        '<input class="bp-input" id="bp-add-note" type="text" placeholder="e.g. Grocery run">'+
        '<button class="bp-add-submit" id="bp-add-submit">+ Add</button>'+
      '</div>'+
      // Income quick-set
      '<div class="bp-add-row" style="margin-top:4px;padding-top:8px;border-top:1px solid var(--border)">'+
        '<span class="bp-add-label" style="color:var(--green)">Income</span>'+
        '<input class="bp-input" id="bp-income-input" type="number" min="0" step="0.01" placeholder="Set monthly income..." value="'+(md.income||'')+'">'+
        '<button class="bp-add-submit" id="bp-income-submit" style="background:#16a34a">Set</button>'+
      '</div>'+
    '</div>';

    // Transaction list — newest first
    var txs=(md.transactions||[]).slice().reverse();
    if(txs.length===0){
      html+='<div style="font-family:var(--mono);font-size:11px;color:var(--muted);text-align:center;padding:24px 0">No transactions this month</div>';
    }else{
      txs.forEach(function(tx){
        var color=CAT_COLORS[tx.cat]||'#7c6af7';
        var isIncome=tx.type==='income';
        html+='<div class="bp-tx-row">'+
          '<span class="bp-tx-dot" style="background:'+color+'"></span>'+
          '<span class="bp-tx-cat">'+tx.cat+'</span>'+
          '<span class="bp-tx-note">'+tx.note+'</span>'+
          '<span class="bp-tx-amount'+(isIncome?' income':'')+'">'+
            (isIncome?'+':'-')+'$'+tx.amount.toFixed(2)+'</span>'+
          '<span class="bp-tx-date">'+tx.date.slice(5)+'</span>'+
          '<button class="bp-tx-del" data-id="'+tx.id+'">&#215;</button>'+
        '</div>';
      });
    }

    el.innerHTML=html;

    // Wire add button
    var addBtn=document.getElementById('bp-add-submit');
    if(addBtn)addBtn.addEventListener('click',function(){addTransaction(md);});
    var incBtn=document.getElementById('bp-income-submit');
    if(incBtn)incBtn.addEventListener('click',function(){setIncome(md);});

    // Wire delete buttons
    el.querySelectorAll('.bp-tx-del').forEach(function(btn){
      btn.addEventListener('click',function(){
        var id=btn.getAttribute('data-id');
        md.transactions=(md.transactions||[]).filter(function(tx){return tx.id!==id;});
        save();render();
      });
    });

    // Enter key on amount/note
    var amtInput=document.getElementById('bp-add-amount');
    var noteInput=document.getElementById('bp-add-note');
    if(noteInput)noteInput.addEventListener('keydown',function(e){if(e.key==='Enter')addTransaction(md);});
    if(amtInput)amtInput.addEventListener('keydown',function(e){if(e.key==='Enter'){document.getElementById('bp-add-note').focus();}});
  }

  // ── Categories tab ────────────────────────────────────────
  function renderCats(md){
    var el=document.getElementById('bp-tab-content');
    if(!el)return;
    var spent=calcSpentByCat(md);
    var html='<div style="font-family:var(--mono);font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;padding-bottom:8px;display:flex;gap:8px">'+
      '<span style="flex:1;margin-left:18px">Category</span>'+
      '<span style="width:70px;text-align:right">Budget</span>'+
      '<span style="width:60px;text-align:right">Spent</span>'+
      '<span style="width:80px;text-align:center">Progress</span>'+
    '</div>';

    CATEGORIES.forEach(function(cat){
      var color=CAT_COLORS[cat]||'#7c6af7';
      var budget=md.budgets&&md.budgets[cat]?md.budgets[cat]:0;
      var spentAmt=spent[cat]||0;
      var pct=budget>0?Math.min((spentAmt/budget)*100,100):0;
      var barColor=pct>=100?'var(--red)':pct>=80?'var(--amber)':color;
      html+='<div class="bp-cat-row">'+
        '<span class="bp-cat-color" style="background:'+color+'"></span>'+
        '<span class="bp-cat-name">'+cat+'</span>'+
        '<input class="bp-cat-budget-input" type="number" min="0" step="1" '+
          'value="'+(budget||'')+'" placeholder="—" data-cat="'+cat+'">'+
        '<span class="bp-cat-spent">$'+spentAmt.toFixed(0)+'</span>'+
        '<div class="bp-cat-bar-wrap">'+
          '<div class="bp-cat-bar" style="width:'+pct+'%;background:'+barColor+'"></div>'+
        '</div>'+
      '</div>';
    });

    el.innerHTML=html;

    // Wire budget inputs — save on blur
    el.querySelectorAll('.bp-cat-budget-input').forEach(function(inp){
      inp.addEventListener('change',function(){
        var cat=inp.getAttribute('data-cat');
        var val=parseFloat(inp.value)||0;
        if(!md.budgets)md.budgets={};
        md.budgets[cat]=val;
        save();
        drawPie(md);
      });
    });
  }

  // ── Add transaction ───────────────────────────────────────
  function addTransaction(md){
    var amtEl=document.getElementById('bp-add-amount');
    var catEl=document.getElementById('bp-add-cat');
    var noteEl=document.getElementById('bp-add-note');
    var typeEl=document.getElementById('bp-add-type');
    if(!amtEl||!catEl)return;
    var amt=parseFloat(amtEl.value);
    if(!amt||amt<=0)return;
    var cat=catEl.value;
    var note=noteEl?noteEl.value.trim():'';
    var type=typeEl?typeEl.value:'expense';
    var now=new Date();
    var date=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
    var tx={
      id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),
      date:date,cat:cat,amount:amt,note:note||cat,type:type
    };
    if(!md.transactions)md.transactions=[];
    md.transactions.push(tx);
    save();
    // Log to vault calendar if connected
    logTxToVault(tx);
    // Clear fields
    if(amtEl)amtEl.value='';
    if(noteEl)noteEl.value='';
    render();
  }

  function setIncome(md){
    var inp=document.getElementById('bp-income-input');
    if(!inp)return;
    var val=parseFloat(inp.value)||0;
    md.income=val;
    save();render();
  }

  // ── Log transaction to vault daily log ────────────────────
  function logTxToVault(tx){
    if(typeof vaultHandle==='undefined'||!vaultHandle||!vaultConnected)return;
    var sign=tx.type==='income'?'+':'-';
    var bullet='- 💰 '+sign+'$'+tx.amount.toFixed(2)+' ['+tx.cat+']'+(tx.note&&tx.note!==tx.cat?' — '+tx.note:'')+'\n';
    var dateParts=tx.date.split('-');
    var fname=tx.date+'.md';
    vaultHandle.getDirectoryHandle('00-Capture',{create:true})
    .then(function(dir){return dir.getFileHandle(fname,{create:true});})
    .then(function(fh){
      return fh.getFile().then(function(f){return f.text();}).then(function(existing){
        var newContent;
        if(existing.trim().length){
          // Append under ## Transactions section or at end
          if(existing.includes('## Transactions')){
            newContent=existing.trimEnd()+'\n'+bullet;
          }else{
            newContent=existing.trimEnd()+'\n\n## Transactions\n'+bullet;
          }
        }else{
          var tmpl='---\ntype: daily\ndate: '+tx.date+'\nweek: \nmood: \nenergy: \n---\n\n'+
            '# Daily Log \u2014 '+tx.date+'\n\n## Top 3\n- \n- \n- \n\n'+
            '## Notes\n\n## Done\n\n## Tomorrow\n\n## Conversations\n\n## Transactions\n'+bullet;
          newContent=tmpl;
        }
        return fh.createWritable().then(function(w){return w.write(newContent).then(function(){return w.close();});})
        .then(function(){
          // Update vaultIndex
          if(typeof vaultIndex!=='undefined'){
            var idx=vaultIndex.findIndex(function(n){return n.path==='00-Capture/'+fname;});
            if(idx>=0)vaultIndex[idx].content=newContent;
            else vaultIndex.push({name:fname,path:'00-Capture/'+fname,content:newContent});
          }
        });
      });
    }).catch(function(){});
  }

  // ── Full render ───────────────────────────────────────────
  function render(){
    var md=getMonth(viewYear,viewMonth);
    renderMonthLabel();
    renderTotals(md);
    drawPie(md);
    if(currentTab==='log')renderLog(md);
    else renderCats(md);
  }

  // ── Tab switch ────────────────────────────────────────────
  function switchTab(tab){
    currentTab=tab;
    ['log','cats'].forEach(function(t){
      var el=document.getElementById('bp-tab-'+t);
      if(el)el.className='bp-tab'+(t===tab?' active':'');
    });
    render();
  }

  // ── Month navigation ──────────────────────────────────────
  function prevMonth(){
    viewMonth--;
    if(viewMonth<0){viewMonth=11;viewYear--;}
    render();
  }
  function nextMonth(){
    viewMonth++;
    if(viewMonth>11){viewMonth=0;viewYear++;}
    render();
  }

  // ── Panel show/hide ───────────────────────────────────────
  function showPanel(){
    var p=document.getElementById('budget-panel');
    if(!p)return;
    p.classList.add('bp-vis');
    if(p._wbNormalise)p._wbNormalise();
    render();
  }
  function hidePanel(){
    var p=document.getElementById('budget-panel');
    if(p)p.classList.remove('bp-vis');
  }
  function togglePanel(){
    var p=document.getElementById('budget-panel');
    if(!p)return;
    p.classList.toggle('bp-vis');
    if(p.classList.contains('bp-vis')){
      if(p._wbNormalise)p._wbNormalise();
      render();
    }
  }

  // ── Init ─────────────────────────────────────────────────
  function init(){
    load();
    var prev=document.getElementById('bp-prev-month');
    var next=document.getElementById('bp-next-month');
    if(prev)prev.addEventListener('click',prevMonth);
    if(next)next.addEventListener('click',nextMonth);
  }

  return{init,showPanel,hidePanel,togglePanel,switchTab,addTransaction:function(){
    var md=getMonth(viewYear,viewMonth);addTransaction(md);
  }};
})();
