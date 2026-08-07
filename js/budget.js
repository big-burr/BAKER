// ═══════════════════════════════════════════════════════════
// BAKER BUDGET MODULE
// ═══════════════════════════════════════════════════════════
var BUDGET=(function(){

  // ── Constants ────────────────────────────────────────────
  var STORAGE_KEY='baker_budget_v1';
  var CAT_COLORS={
    'Food':        '#f87171',
    'Savings':     '#60a5fa',
    'Investments': '#a78bfa',
    'Bills':       '#fbbf24',
    'College':     '#34d399',
    'Fun Fund':    '#f472b6'
  };
  var CATEGORIES=['Food','Savings','Investments','Bills','College','Fun Fund'];
  var MONTH_NAMES=['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];

  // ── State ─────────────────────────────────────────────────
  var viewYear, viewMonth;
  var currentTab='log';
  var logFilter='All';
  // data shape: { 'YYYY-MM': { income, budgets:{}, transactions:[], billsApplied:bool } }
  // global bills: data._bills = [{id,name,cat,amount,day}]
  var data={};

  // ── Storage ───────────────────────────────────────────────
  function load(){
    try{
      var raw=localStorage.getItem(STORAGE_KEY);
      if(raw) data=JSON.parse(raw);
    }catch(e){ data={}; }
    if(!data._bills) data._bills=[];
    var now=new Date();
    viewYear=now.getFullYear();
    viewMonth=now.getMonth();
  }

  function save(){
    try{ localStorage.setItem(STORAGE_KEY,JSON.stringify(data)); }catch(e){}
  }

  function monthKey(y,m){
    return y+'-'+String(m+1).padStart(2,'0');
  }

  // Carry budgets forward from last month if current month has none set
  function getMonth(y,m){
    var k=monthKey(y,m);
    if(!data[k]){
      // Find most recent prior month with budgets set
      var prevBudgets={};
      for(var pm=m-1; pm>=m-12; pm--){
        var py=y; var pmo=pm;
        if(pmo<0){pmo+=12;py--;}
        var pk=monthKey(py,pmo);
        if(data[pk]&&data[pk].budgets&&Object.keys(data[pk].budgets).length){
          prevBudgets=JSON.parse(JSON.stringify(data[pk].budgets));
          break;
        }
      }
      data[k]={ income:0, budgets:prevBudgets, transactions:[], billsApplied:false };
    }
    return data[k];
  }

  // Auto-apply recurring bills for this month if not already done
  function applyRecurringBills(md, y, m){
    if(md.billsApplied) return;
    md.billsApplied=true;
    var bills=data._bills||[];
    if(!bills.length) return;
    var now=new Date();
    // Only auto-apply for current or past months, not future
    if(y>now.getFullYear()||(y===now.getFullYear()&&m>now.getMonth())) return;
    bills.forEach(function(bill){
      var dateStr=y+'-'+String(m+1).padStart(2,'0')+'-'+String(bill.day||1).padStart(2,'0');
      // Check not already added this month (by bill id)
      var exists=(md.transactions||[]).some(function(tx){return tx.billId===bill.id;});
      if(!exists){
        md.transactions=md.transactions||[];
        md.transactions.push({
          id: Date.now().toString(36)+Math.random().toString(36).slice(2,5),
          billId: bill.id,
          date: dateStr,
          cat: bill.cat,
          amount: bill.amount,
          note: bill.name+' (auto)',
          type: 'expense'
        });
      }
    });
    save();
  }

  // ── Calculations ──────────────────────────────────────────
  function calcSpentByCat(md){
    var out={};
    CATEGORIES.forEach(function(c){ out[c]=0; });
    (md.transactions||[]).forEach(function(tx){
      if(tx.type==='expense' && out[tx.cat]!==undefined) out[tx.cat]+=tx.amount;
    });
    return out;
  }

  function calcTotals(md){
    var spent=0, saved=0, income=md.income||0;
    (md.transactions||[]).forEach(function(tx){
      if(tx.type==='expense'){
        spent+=tx.amount;
        if(tx.cat==='Savings'||tx.cat==='Investments') saved+=tx.amount;
      }
    });
    return{ income:income, spent:spent, saved:saved, left:income-spent };
  }

  // ── Pie / Donut Chart ─────────────────────────────────────
  function drawPie(md){
    var canvas=document.getElementById('bp-pie-canvas');
    if(!canvas) return;
    // Size canvas to actual CSS display size
    var rect=canvas.getBoundingClientRect();
    var dpr=window.devicePixelRatio||1;
    var dispW=rect.width||268, dispH=rect.height||268;
    canvas.width=Math.round(dispW*dpr);
    canvas.height=Math.round(dispH*dpr);
    var ctx=canvas.getContext('2d');
    ctx.scale(dpr,dpr);

    var W=dispW, H=dispH;
    var cx=W/2, cy=H/2;
    var R=Math.min(W,H)/2-10;
    var innerR=R*0.52;
    ctx.clearRect(0,0,W,H);

    var spent=calcSpentByCat(md);
    var total=CATEGORIES.reduce(function(s,c){ return s+(spent[c]||0); },0);
    var legend=document.getElementById('bp-legend');
    if(legend) legend.innerHTML='';

    if(total===0){
      ctx.beginPath();
      ctx.arc(cx,cy,R,0,Math.PI*2);
      ctx.arc(cx,cy,innerR,0,Math.PI*2,true);
      ctx.fillStyle='rgba(255,255,255,.06)';
      ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.25)';
      ctx.font='bold 13px IBM Plex Mono,monospace';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('No data',cx,cy);
      return;
    }

    // Draw slices — collect all first, then punch hole once
    var startAngle=-Math.PI/2;
    var slices=[];
    CATEGORIES.forEach(function(cat){
      var val=spent[cat]||0;
      if(val<=0) return;
      var slice=(val/total)*(Math.PI*2);
      slices.push({ cat:cat, val:val, start:startAngle, end:startAngle+slice });
      startAngle+=slice;
    });

    // Draw each slice
    slices.forEach(function(s){
      var color=CAT_COLORS[s.cat]||'#7c6af7';
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.arc(cx,cy,R,s.start,s.end);
      ctx.closePath();
      ctx.fillStyle=color;
      ctx.fill();
      // Thin separator line
      ctx.strokeStyle='rgba(15,15,16,.4)';
      ctx.lineWidth=1.5;
      ctx.stroke();
    });

    // Single clean donut punch
    ctx.beginPath();
    ctx.arc(cx,cy,innerR,0,Math.PI*2);
    ctx.fillStyle='#0f0f10';
    ctx.fill();

    // Center text — total spent
    ctx.fillStyle='#e8e6f0';
    ctx.font='bold 17px IBM Plex Mono,monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('$'+total.toFixed(0),cx,cy-8);
    ctx.font='9px IBM Plex Mono,monospace';
    ctx.fillStyle='#7a7880';
    ctx.fillText('SPENT',cx,cy+10);

    // Legend
    if(legend){
      slices.forEach(function(s){
        var color=CAT_COLORS[s.cat]||'#7c6af7';
        var pct=Math.round((s.val/total)*100);
        var row=document.createElement('div'); row.className='bp-legend-row';
        row.innerHTML=
          '<span class="bp-legend-label">'+
            '<span class="bp-legend-dot" style="background:'+color+'"></span>'+
            s.cat+
          '</span>'+
          '<span class="bp-legend-val">$'+s.val.toFixed(2)+'</span>'+
          '<span class="bp-legend-pct">'+pct+'%</span>';
        legend.appendChild(row);
      });
    }
  }

  // ── Totals ────────────────────────────────────────────────
  function renderTotals(md){
    var t=calcTotals(md);
    function el(id){ return document.getElementById(id); }
    function fmt(v){ return '$'+Math.abs(v).toFixed(2); }
    if(el('bp-total-income')) el('bp-total-income').textContent=fmt(t.income);
    if(el('bp-total-spent'))  el('bp-total-spent').textContent=fmt(t.spent);
    var leftEl=el('bp-total-left');
    if(leftEl){
      leftEl.textContent=(t.left<0?'-':'')+fmt(t.left);
      leftEl.className='bp-total-val left '+(t.left>=0?'positive':'negative');
    }
    if(el('bp-total-saved')) el('bp-total-saved').textContent=fmt(t.saved);
  }

  function renderMonthLabel(){
    var el=document.getElementById('bp-month-label');
    if(el) el.textContent=MONTH_NAMES[viewMonth]+' '+viewYear;
  }

  // ── Log tab ───────────────────────────────────────────────
  function renderLog(md){
    var el=document.getElementById('bp-tab-content');
    if(!el) return;

    // Filter bar
    var filterOpts=['All'].concat(CATEGORIES);
    var filterHtml='<div style="display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap">'+
      filterOpts.map(function(f){
        var active=f===logFilter;
        var col=f==='All'?'var(--accent)':(CAT_COLORS[f]||'var(--accent)');
        return '<button onclick="BUDGET._setLogFilter(\''+f+'\')" style="'+
          'font-family:var(--mono);font-size:9px;padding:3px 8px;border-radius:10px;cursor:pointer;'+
          'border:1px solid '+(active?col:'var(--border)')+';'+
          'background:'+(active?col+'22':'none')+';'+
          'color:'+(active?col:'var(--muted)')+'">'+f+'</button>';
      }).join('')+
    '</div>';

    // Add form — compact two-row layout
    var today=new Date().toISOString().split('T')[0];
    var formHtml='<div class="bp-add">'+
      '<div class="bp-add-row">'+
        '<select class="bp-select" id="bp-add-type" style="flex:0.7">'+
          '<option value="expense">Expense</option>'+
          '<option value="income">Income</option>'+
        '</select>'+
        '<select class="bp-select" id="bp-add-cat">'+
          CATEGORIES.map(function(c){return'<option>'+c+'</option>';}).join('')+
        '</select>'+
        '<input class="bp-input" id="bp-add-amount" type="number" min="0" step="0.01" placeholder="$0.00" style="width:80px;flex:none">'+
      '</div>'+
      '<div class="bp-add-row">'+
        '<input class="bp-input" id="bp-add-note" type="text" placeholder="Note (e.g. Grocery run)">'+
        '<input class="bp-input" id="bp-add-date" type="date" value="'+today+'" style="width:130px;flex:none">'+
        '<button class="bp-add-submit" id="bp-add-submit">+ Add</button>'+
      '</div>'+
      '<div class="bp-add-row" style="margin-top:2px;padding-top:8px;border-top:1px solid var(--border)">'+
        '<span class="bp-add-label" style="color:var(--green)">Income</span>'+
        '<input class="bp-input" id="bp-income-input" type="number" min="0" step="0.01" placeholder="Set monthly income..." value="'+(md.income||'')+'">'+
        '<button class="bp-add-submit" id="bp-income-submit" style="background:#16a34a">Set</button>'+
      '</div>'+
    '</div>';

    // Transaction list with running balance
    var txs=(md.transactions||[]).slice().sort(function(a,b){
      return a.date>b.date?-1:a.date<b.date?1:0;
    });
    if(logFilter!=='All') txs=txs.filter(function(tx){return tx.cat===logFilter;});

    var listHtml='';
    if(!txs.length){
      listHtml='<div style="font-family:var(--mono);font-size:11px;color:var(--muted);text-align:center;padding:20px 0">'+
        (logFilter==='All'?'No transactions this month':'No '+logFilter+' transactions')+'</div>';
    } else {
      // Compute running balance forward (oldest to newest), display newest first
      var allTxs=(md.transactions||[]).slice().sort(function(a,b){return a.date>b.date?1:-1;});
      var balanceMap={};
      var running=md.income||0;
      allTxs.forEach(function(tx){
        running+=tx.type==='income'?tx.amount:-tx.amount;
        balanceMap[tx.id]=running;
      });

      txs.forEach(function(tx){
        var color=CAT_COLORS[tx.cat]||'#7c6af7';
        var isIncome=tx.type==='income';
        var bal=balanceMap[tx.id];
        var balColor=bal>=0?'var(--green)':'var(--red)';
        listHtml+='<div class="bp-tx-row">'+
          '<span class="bp-tx-dot" style="background:'+color+'"></span>'+
          '<span class="bp-tx-cat">'+tx.cat+'</span>'+
          '<span class="bp-tx-note" title="'+tx.note+'">'+tx.note+'</span>'+
          '<span class="bp-tx-amount'+(isIncome?' income':'')+'">'+
            (isIncome?'+':'-')+'$'+tx.amount.toFixed(2)+'</span>'+
          '<span style="font-family:var(--mono);font-size:9px;color:'+balColor+';width:60px;text-align:right;flex-shrink:0">'+
            '$'+Math.abs(bal).toFixed(0)+'</span>'+
          '<span class="bp-tx-date">'+tx.date.slice(5)+'</span>'+
          '<button class="bp-tx-del" data-id="'+tx.id+'">&#215;</button>'+
        '</div>';
      });
    }

    el.innerHTML=filterHtml+formHtml+listHtml;

    // Wire events
    var addBtn=document.getElementById('bp-add-submit');
    if(addBtn) addBtn.addEventListener('click',function(){ addTransaction(md); });
    var incBtn=document.getElementById('bp-income-submit');
    if(incBtn) incBtn.addEventListener('click',function(){ setIncome(md); });
    el.querySelectorAll('.bp-tx-del').forEach(function(btn){
      btn.addEventListener('click',function(){
        var id=btn.getAttribute('data-id');
        md.transactions=(md.transactions||[]).filter(function(tx){return tx.id!==id;});
        save(); render();
      });
    });
    var amtEl=document.getElementById('bp-add-amount');
    var noteEl=document.getElementById('bp-add-note');
    if(amtEl) amtEl.addEventListener('keydown',function(e){if(e.key==='Enter')noteEl&&noteEl.focus();});
    if(noteEl) noteEl.addEventListener('keydown',function(e){if(e.key==='Enter')addTransaction(md);});
  }

  // ── Categories tab ────────────────────────────────────────
  function renderCats(md){
    var el=document.getElementById('bp-tab-content');
    if(!el) return;
    var spent=calcSpentByCat(md);
    var t=calcTotals(md);

    var html='<div style="font-family:var(--mono);font-size:9px;color:var(--muted);'+
      'text-transform:uppercase;letter-spacing:.08em;padding-bottom:8px;'+
      'display:flex;gap:8px;border-bottom:1px solid var(--border);margin-bottom:8px">'+
      '<span style="flex:1;margin-left:18px">Category</span>'+
      '<span style="width:70px;text-align:right">Budget</span>'+
      '<span style="width:55px;text-align:right">Spent</span>'+
      '<span style="width:55px;text-align:right">Left</span>'+
      '<span style="width:80px;text-align:center">Progress</span>'+
    '</div>';

    // Total row
    var totalBudget=CATEGORIES.reduce(function(s,c){ return s+(md.budgets&&md.budgets[c]?md.budgets[c]:0); },0);
    html+='<div style="display:flex;align-items:center;gap:8px;padding:6px 0 10px;'+
      'border-bottom:1px solid var(--border);margin-bottom:6px;font-family:var(--mono);font-size:10px">'+
      '<span style="flex:1;color:var(--muted);font-size:9px;text-transform:uppercase;margin-left:18px">Total</span>'+
      '<span style="width:70px;text-align:right;color:var(--text)">$'+(totalBudget?totalBudget.toFixed(0):'—')+'</span>'+
      '<span style="width:55px;text-align:right;color:var(--amber)">$'+t.spent.toFixed(0)+'</span>'+
      '<span style="width:55px;text-align:right;color:'+(t.left>=0?'var(--green)':'var(--red)')+'">'+
        (t.left<0?'-':'')+'$'+Math.abs(t.left).toFixed(0)+'</span>'+
      '<div style="width:80px;padding:0 10px">'+
        '<div style="height:6px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden">'+
          '<div style="height:100%;border-radius:3px;background:'+(totalBudget&&t.spent/totalBudget>=1?'var(--red)':totalBudget&&t.spent/totalBudget>=0.8?'var(--amber)':'var(--accent)')+
          ';width:'+Math.min(totalBudget?Math.round((t.spent/totalBudget)*100):0,100)+'%"></div>'+
        '</div>'+
      '</div>'+
    '</div>';

    CATEGORIES.forEach(function(cat){
      var color=CAT_COLORS[cat]||'#7c6af7';
      var budget=md.budgets&&md.budgets[cat]?md.budgets[cat]:0;
      var spentAmt=spent[cat]||0;
      var leftAmt=budget-spentAmt;
      var pct=budget>0?Math.min(Math.round((spentAmt/budget)*100),100):0;
      var barColor=pct>=100?'var(--red)':pct>=80?'var(--amber)':color;
      html+='<div class="bp-cat-row">'+
        '<span class="bp-cat-color" style="background:'+color+'"></span>'+
        '<span class="bp-cat-name">'+cat+'</span>'+
        '<input class="bp-cat-budget-input" type="number" min="0" step="1" '+
          'value="'+(budget||'')+'" placeholder="—" data-cat="'+cat+'">'+
        '<span class="bp-cat-spent" style="color:var(--amber)">$'+spentAmt.toFixed(0)+'</span>'+
        '<span style="font-family:var(--mono);font-size:10px;width:55px;text-align:right;'+
          'color:'+(budget?(leftAmt>=0?'var(--green)':'var(--red)'):'var(--muted)')+'">'+
          (budget?(leftAmt<0?'-':'')+'$'+Math.abs(leftAmt).toFixed(0):'—')+'</span>'+
        '<div class="bp-cat-bar-wrap">'+
          '<div class="bp-cat-bar" style="width:'+pct+'%;background:'+barColor+'"></div>'+
        '</div>'+
      '</div>';
    });

    el.innerHTML=html;
    el.querySelectorAll('.bp-cat-budget-input').forEach(function(inp){
      inp.addEventListener('change',function(){
        var cat=inp.getAttribute('data-cat');
        var val=parseFloat(inp.value)||0;
        if(!md.budgets) md.budgets={};
        md.budgets[cat]=val;
        save(); drawPie(md); renderTotals(md); renderCats(md);
      });
    });
  }

  // ── Bills tab ─────────────────────────────────────────────
  function renderBills(){
    var el=document.getElementById('bp-tab-content');
    if(!el) return;
    var bills=data._bills||[];

    var html='<div style="font-family:var(--mono);font-size:10px;color:var(--muted);'+
      'padding-bottom:8px;margin-bottom:8px;border-bottom:1px solid var(--border)">'+
      'Recurring bills auto-log on their due date each month.</div>';

    // Add bill form
    html+='<div class="bp-add" style="margin-bottom:12px">'+
      '<div class="bp-add-row">'+
        '<span class="bp-add-label">Name</span>'+
        '<input class="bp-input" id="bp-bill-name" type="text" placeholder="e.g. Spotify">'+
      '</div>'+
      '<div class="bp-add-row">'+
        '<span class="bp-add-label">Category</span>'+
        '<select class="bp-select" id="bp-bill-cat">'+
          CATEGORIES.map(function(c){return'<option>'+c+'</option>';}).join('')+
        '</select>'+
        '<input class="bp-input" id="bp-bill-amount" type="number" min="0" step="0.01" placeholder="$0.00" style="width:80px;flex:none">'+
        '<input class="bp-input" id="bp-bill-day" type="number" min="1" max="28" placeholder="Day" style="width:60px;flex:none">'+
        '<button class="bp-add-submit" id="bp-bill-add">+ Add</button>'+
      '</div>'+
    '</div>';

    if(!bills.length){
      html+='<div style="font-family:var(--mono);font-size:11px;color:var(--muted);text-align:center;padding:16px 0">No recurring bills set up</div>';
    } else {
      var monthlyTotal=bills.reduce(function(s,b){return s+b.amount;},0);
      html+='<div style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-bottom:8px">'+
        bills.length+' bill'+(bills.length!==1?'s':'')+' · $'+monthlyTotal.toFixed(2)+'/month</div>';
      bills.forEach(function(bill){
        var color=CAT_COLORS[bill.cat]||'#7c6af7';
        html+='<div class="bp-tx-row">'+
          '<span class="bp-tx-dot" style="background:'+color+'"></span>'+
          '<span class="bp-tx-cat">'+bill.cat+'</span>'+
          '<span class="bp-tx-note">'+bill.name+'</span>'+
          '<span class="bp-tx-amount">$'+bill.amount.toFixed(2)+'</span>'+
          '<span class="bp-tx-date">Day '+bill.day+'</span>'+
          '<button class="bp-tx-del" data-bill-id="'+bill.id+'">&#215;</button>'+
        '</div>';
      });
    }

    el.innerHTML=html;

    var addBillBtn=document.getElementById('bp-bill-add');
    if(addBillBtn) addBillBtn.addEventListener('click',addBill);
    el.querySelectorAll('[data-bill-id]').forEach(function(btn){
      btn.addEventListener('click',function(){
        var id=btn.getAttribute('data-bill-id');
        data._bills=(data._bills||[]).filter(function(b){return b.id!==id;});
        save(); renderBills();
      });
    });
  }

  function addBill(){
    var name=(document.getElementById('bp-bill-name')||{}).value||'';
    var cat=(document.getElementById('bp-bill-cat')||{}).value||'Bills';
    var amount=parseFloat((document.getElementById('bp-bill-amount')||{}).value)||0;
    var day=parseInt((document.getElementById('bp-bill-day')||{}).value)||1;
    if(!name||amount<=0) return;
    if(!data._bills) data._bills=[];
    data._bills.push({
      id:Date.now().toString(36)+Math.random().toString(36).slice(2,4),
      name:name, cat:cat, amount:amount, day:Math.min(Math.max(day,1),28)
    });
    save(); renderBills();
  }

  // ── Add transaction ───────────────────────────────────────
  function addTransaction(md){
    var amtEl=document.getElementById('bp-add-amount');
    var catEl=document.getElementById('bp-add-cat');
    var noteEl=document.getElementById('bp-add-note');
    var typeEl=document.getElementById('bp-add-type');
    var dateEl=document.getElementById('bp-add-date');
    if(!amtEl||!catEl) return;
    var amt=parseFloat(amtEl.value);
    if(!amt||amt<=0) return;
    var cat=catEl.value;
    var note=(noteEl?noteEl.value.trim():'')||cat;
    var type=typeEl?typeEl.value:'expense';
    var date=dateEl?dateEl.value:(new Date().toISOString().split('T')[0]);
    var tx={
      id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),
      date:date, cat:cat, amount:amt, note:note, type:type
    };
    if(!md.transactions) md.transactions=[];
    md.transactions.push(tx);
    save();
    logTxToVault(tx);
    if(amtEl) amtEl.value='';
    if(noteEl) noteEl.value='';
    render();
  }

  function setIncome(md){
    var inp=document.getElementById('bp-income-input');
    if(!inp) return;
    var val=parseFloat(inp.value)||0;
    md.income=val;
    save(); render();
  }

  // ── Vault logging ─────────────────────────────────────────
  function logTxToVault(tx){
    if(typeof vaultConnected==='undefined'||!vaultConnected) return;
    if(typeof vaultWrite!=='function') return;
    var sign=tx.type==='income'?'+':'-';
    var bullet='- \uD83D\uDCB0 '+sign+'$'+tx.amount.toFixed(2)+
      ' ['+tx.cat+']'+(tx.note&&tx.note!==tx.cat?' \u2014 '+tx.note:'')+'\n';
    var fname=tx.date+'.md';
    var path='00-Capture/'+fname;
    // Read existing content from vaultIndex (both backends keep it current)
    var ex=(typeof vaultIndex!=='undefined')?vaultIndex.find(function(n){return n.path===path;}):null;
    var existing=ex?ex.content:'';
    var newContent;
    if(existing.trim().length){
      newContent=existing.includes('## Transactions')
        ? existing.trimEnd()+'\n'+bullet
        : existing.trimEnd()+'\n\n## Transactions\n'+bullet;
    } else {
      newContent='---\ntype: daily\ndate: '+tx.date+'\nweek: \nmood: \nenergy: \n---\n\n'+
        '# Daily Log \u2014 '+tx.date+'\n\n## Top 3\n- \n- \n- \n\n'+
        '## Notes\n\n## Done\n\n## Tomorrow\n\n## Conversations\n\n## Transactions\n'+bullet;
    }
    vaultWrite(path,newContent);
  }

  // ── Render ────────────────────────────────────────────────
  function render(){
    var md=getMonth(viewYear,viewMonth);
    applyRecurringBills(md,viewYear,viewMonth);
    renderMonthLabel();
    renderTotals(md);
    drawPie(md);
    if(currentTab==='log')      renderLog(md);
    else if(currentTab==='cats') renderCats(md);
    else if(currentTab==='bills') renderBills();
  }

  function switchTab(tab){
    currentTab=tab;
    ['log','cats','bills'].forEach(function(t){
      var el=document.getElementById('bp-tab-'+t);
      if(el) el.className='bp-tab'+(t===tab?' active':'');
    });
    render();
  }

  function _setLogFilter(f){ logFilter=f; render(); }

  // ── Month nav ─────────────────────────────────────────────
  function prevMonth(){
    viewMonth--; if(viewMonth<0){viewMonth=11;viewYear--;} render();
  }
  function nextMonth(){
    viewMonth++; if(viewMonth>11){viewMonth=0;viewYear++;} render();
  }

  // ── Panel ─────────────────────────────────────────────────
  function showPanel(){
    var p=document.getElementById('budget-panel'); if(!p) return;
    // Set absolute pixel position before making visible so normalise() reads correct coords
    var pw=Math.min(780,window.innerWidth-48);
    var ph=Math.min(680,window.innerHeight-88);
    p.style.transform='none';
    p.style.left=Math.round((window.innerWidth-pw)/2)+'px';
    p.style.top='64px';
    p.style.width=pw+'px';
    p.style.height=ph+'px';
    p.classList.add('bp-vis');
    if(p._wbNormalise) p._wbNormalise();
    render();
  }
  function hidePanel(){
    var p=document.getElementById('budget-panel'); if(p) p.classList.remove('bp-vis');
  }
  function togglePanel(){
    var p=document.getElementById('budget-panel'); if(!p) return;
    p.classList.toggle('bp-vis');
    if(p.classList.contains('bp-vis')){ if(p._wbNormalise) p._wbNormalise(); render(); }
  }

  // ── Init ──────────────────────────────────────────────────
  function init(){
    load();
    var prev=document.getElementById('bp-prev-month');
    var next=document.getElementById('bp-next-month');
    if(prev) prev.addEventListener('click',prevMonth);
    if(next) next.addEventListener('click',nextMonth);
  }

  return{ init,showPanel,hidePanel,togglePanel,switchTab,_setLogFilter };
})();
