const __mod = (function () {
return {
  slotContract: 'strict',
  inject: ['slots','timer','sessions','chat'],
  apply(ctx){
    const fmt = n => { const v = Number(n) || 0; return v >= 1e6 ? (v/1e6).toFixed(2)+'M' : v >= 1000 ? (v/1000).toFixed(1)+'k' : String(v); };
    const dt = (ts) => { const d = new Date(ts); const p = n => (n < 10 ? '0' + n : '' + n); return p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds()); };
    const tm = (ts) => new Date(ts).toLocaleTimeString();
    const chip = (text, color) => React.createElement('span',{style:{fontSize:11,padding:'2px 7px',borderRadius:999,background:'var(--color-bg-tertiary)',color:color||'var(--color-text-secondary)'}},text);
    const pre = (text, maxH) => React.createElement('pre',{style:{margin:0,maxHeight:maxH||260,overflow:'auto',fontSize:11,lineHeight:1.45,whiteSpace:'pre-wrap',wordBreak:'break-all',color:'var(--color-text-secondary)',background:'var(--color-bg-tertiary)',padding:8,borderRadius:8}},text);
    const PALETTE = ['#3b82f6','#a855f7','#f59e0b','#22c55e','#ef4444','#14b8a6','#e879f9','#84cc16','#f97316','#06b6d4','#8b5cf6','#ec4899','#10b981','#eab308'];
    const est = (s) => { const str = String(s||''); const c = (str.match(/[\u3400-\u9FFF]/g)||[]).length; return Math.round(c + (str.length - c)/4); };
    const lbl = (t) => React.createElement('div',{key:String(t),style:{fontSize:12,fontWeight:600,color:'var(--color-text-primary)'}},t);
    const kv = (k,v) => React.createElement('div',{key:k,style:{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--color-text-secondary)'}},React.createElement('span',null,k),React.createElement('span',{style:{color:'var(--color-text-primary)'}},String(v)));
    const cardStyle = {display:'flex',flexDirection:'column',gap:6,padding:10,border:'1px solid var(--color-border-muted)',borderRadius:10,background:'var(--color-bg-card)'};
    const btnStyle = {alignSelf:'flex-start',padding:'5px 10px',borderRadius:8,border:'1px solid var(--color-border-muted)',background:'var(--color-bg-secondary)',color:'var(--color-text-primary)',cursor:'pointer',fontSize:12};
    const pill = (label, color, onClick, title) => React.createElement('button',{type:'button',className:'ctx-btn',onClick,title,style:{display:'inline-flex',alignItems:'center',gap:7,border:'1px solid var(--color-border-muted)',background:'var(--color-bg-secondary)',borderRadius:999,padding:'4px 11px 4px 8px',cursor:'pointer',fontSize:10,letterSpacing:'0.04em',color:'var(--color-text-primary)'}},
      React.createElement('span',{style:{position:'relative',width:14,height:14,borderRadius:'50%',background:'conic-gradient('+color+' 0deg 270deg, transparent 270deg 360deg)',transition:'background .2s'}},
        React.createElement('span',{style:{position:'absolute',inset:3,borderRadius:'50%',background:'var(--color-bg-secondary)'}})),
      React.createElement('span',null,label));
    const debugSwitch = (on, onClick) => pill('DEBUG REQUEST', on ? '#22c55e' : '#6b7280', onClick, on ? '已开启：settings.json 中 CODEBUDDY_DEBUG_REQUEST=1' : '已关闭：settings.json 中不写入该变量');
    const stop = { onClick: (e) => { try { e.stopPropagation(); } catch (err) {} } };
    try { styles.insert('.ctx-btn{transition:background .15s ease,border-color .15s ease,color .15s ease}.ctx-btn:hover{background:var(--color-bg-hover)!important;border-color:var(--color-border-default)!important}.ctx-btn:active{opacity:.85}.ctx-split:hover>div{background:var(--color-accent-brand)!important}'); } catch (e) {}

    const Panel = () => {
      const [data,setData] = React.useState(null);
      const [err,setErr] = React.useState('');
      const [open,setOpen] = React.useState(null);
      const [sys,setSys] = React.useState(null);
      const [busySys,setBusySys] = React.useState(false);
      const [busyBoot,setBusyBoot] = React.useState(false);
      const [sysTick,setSysTick] = React.useState(0);
      const [sec,setSec] = React.useState(null);
      const [hover,setHover] = React.useState(null);
      const [debugOn,setDebugOn] = React.useState(null);
      const [debugBase,setDebugBase] = React.useState(null);
      const load = React.useCallback(() => {
        Promise.resolve(host.call('context_data','get')).then(v => { setData(v); setErr(''); }).catch(e => setErr(String((e && e.message) || e)));
      }, []);
      const loadSys = React.useCallback((manual) => {
        if (manual) setBusySys(true);
        return Promise.resolve(host.call('context_data','sysprompt'))
          .then(v => { setSys(v); setSysTick(Date.now()); })
          .catch(e => setSys({ error: String((e && e.message) || e) }))
          .then(() => { if (manual) setBusySys(false); });
      }, []);
      const loadDebug = React.useCallback(() => {
        Promise.resolve(host.call('context_data','debugState'))
          .then(v => { const on = !!(v && v.enabled); setDebugOn(on); setDebugBase(prev => (prev === null ? on : prev)); })
          .catch(() => setDebugOn(false));
      }, []);
      const toggleDebug = () => {
        const next = !(debugOn === true);
        Promise.resolve(host.call('context_data','setDebug',[next])).then(v => setDebugOn(!!(v && v.enabled))).catch(() => {});
      };
      const boot = () => {
        setBusyBoot(true);
        Promise.resolve(ctx.sessions.createForeground())
          .then(() => {
            setTimeout(() => {
              try { ctx.chat.submit('上下文快照采集：请只回复 ok'); } catch (e) {}
              setTimeout(() => { loadSys(true); setBusyBoot(false); }, 4000);
            }, 1200);
          })
          .catch(() => setBusyBoot(false));
      };
      React.useEffect(() => { loadDebug(); }, [loadDebug]);
      React.useEffect(() => {
        load(); loadSys(false);
        let a, b; try { a = ctx.timer.every(5000, load); b = ctx.timer.every(5000, () => loadSys(false)); } catch (e) {}
        return () => { try { a && a(); b && b(); } catch (e) {} };
      }, [load, loadSys]);
      const toggle = (i) => {
        if (open && open.i === i) { setOpen(null); return; }
        setOpen({ i, loading: true });
        Promise.resolve(host.call('context_data','detail',[i])).then(d => setOpen({ i, d })).catch(e => setOpen({ i, d: { error: String((e && e.message) || e) } }));
      };
      const u = data && data.usage && data.usage.context;
      const pct = u ? (Number(u.percent) || 0) : 0;
      const tokens = u ? Number(u.tokens) || 0 : 0;
      const window = u ? Number(u.window) || 0 : 0;
      const c = (data && data.counts) || {};
      const tools = (data && data.tools) || [];
      const recent = (data && data.recent) || [];
      const secs = (sys && sys.sections) ? sys.sections.map((s,idx) => ({ name: s.name, len: s.len, tok: est(s.text || ''), color: PALETTE[idx % PALETTE.length], text: s.text })).sort((a,b) => b.tok - a.tok) : [];
      const secTotal = secs.reduce((sum, s) => sum + s.tok, 0) || 1;
      const debugDirty = debugOn !== null && debugBase !== null && debugOn !== debugBase;
      return React.createElement('div',{style:{position:'relative',display:'flex',flexDirection:'column',gap:10,padding:14,height:'100%',overflow:'auto'}},
        React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}},
          React.createElement('div',{style:{fontSize:15,fontWeight:600,color:'var(--color-text-primary)'}},'上下文'),
          debugOn === null ? null : React.createElement('div',{style:{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3}},
            debugSwitch(debugOn, toggleDebug),
            debugDirty ? React.createElement('div',{style:{fontSize:10,color:'var(--color-text-tertiary)',whiteSpace:'nowrap'}},'重启 CodeBuddy 生效',React.createElement('span',{style:{color:'#eab308'}},'（非网页）')) : null)),
        React.createElement('div',null,
          React.createElement('div',{style:{fontSize:26,fontWeight:700,color:'var(--color-text-primary)'}},fmt(tokens),
            React.createElement('span',{style:{fontSize:13,color:'var(--color-text-secondary)'}},' / '+fmt(window)+'  ·  '+pct+'%')),
          React.createElement('div',{style:{height:8,borderRadius:999,background:'var(--color-bg-tertiary)',overflow:'hidden',marginTop:6}},
            React.createElement('div',{style:{height:'100%',width:pct+'%',background:pct>85?'#ef4444':pct>65?'#f59e0b':'#3b82f6'}}))),
        React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:6}},
          chip('轮次 '+(data?data.turns:'—')), chip('消息 '+(c.total||0)), chip('工具 '+(c.toolCalls||0)),
          c.errors ? chip('错误 '+c.errors,'#ef4444') : null,
          chip(data && data.model ? data.model : '—')),
        React.createElement('div',{style:cardStyle},
          React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center'}},
            lbl('分节原文'),
            React.createElement('span',{style:{fontSize:10,color:'var(--color-text-tertiary)'}},sysTick?('刷新于 '+tm(sysTick)):'')),
          React.createElement('div',{style:{display:'flex',gap:6,flexWrap:'wrap'}},
            React.createElement('button',{type:'button',className:'ctx-btn',disabled:busySys,onClick:()=>loadSys(true),style:btnStyle},busySys?'读取中…':'重新读取分节'),
            React.createElement('button',{type:'button',className:'ctx-btn',disabled:busyBoot,onClick:boot,style:btnStyle},busyBoot?'采集中…':'新开会话采集')),
          sys && sys.error ? React.createElement('div',{style:{fontSize:11,color:'var(--color-accent-red)'}},sys.error) : null,
          sys && !sys.error ? React.createElement('div',{style:{fontSize:11,color:'var(--color-text-tertiary)'}},(sys.count||0)+' 个分节 · '+(sys.total||0)+' 字 · ≈'+fmt(secTotal)+' tok'+(sys.at?' · 捕获于 '+dt(sys.at):'')) : null,
          sys && sys.file ? React.createElement('div',{style:{fontSize:10,color:'var(--color-text-tertiary)',wordBreak:'break-all',fontFamily:'var(--font-mono,monospace)'}},sys.file) : null,
          sys && sys.count === 0 ? React.createElement('div',{style:{fontSize:11,color:'var(--color-text-tertiary)',lineHeight:1.5}},'点击「新开会话采集」：会开一个前台会话并自动发一句话，触发完整组装后缓存到本地文件，之后永久秒读。') : null,
          secs.length ? React.createElement('div',{style:{display:'flex',height:10,borderRadius:999,overflow:'hidden',background:'var(--color-bg-tertiary)',marginTop:2}},
            secs.map(s => React.createElement('div',{key:s.name,title:s.name+' · '+(s.tok/secTotal*100).toFixed(1)+'%',onClick:()=>setSec(sec===s.name?null:s.name),onMouseEnter:()=>setHover(s.name),onMouseLeave:()=>setHover(null),style:{width:(s.tok/secTotal*100)+'%',background:s.color,cursor:'pointer',opacity:hover&&hover!==s.name?0.3:1,transition:'opacity 90ms ease'}}))) : null,
          secs.map(s => React.createElement('div',{key:s.name,onClick:()=>setSec(sec===s.name?null:s.name),onMouseEnter:()=>setHover(s.name),onMouseLeave:()=>setHover(null),style:{padding:'5px 0',borderTop:'1px solid var(--color-border-muted)',cursor:'pointer',opacity:hover&&hover!==s.name?0.35:1,transition:'opacity 90ms ease'}},
            React.createElement('div',{style:{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--color-text-secondary)'}},
              React.createElement('span',{style:{display:'flex',alignItems:'center',gap:6,fontWeight:600,color:'var(--color-text-primary)'}},
                React.createElement('span',{style:{width:8,height:8,borderRadius:2,background:s.color}}),s.name),
              React.createElement('span',null,s.len+' 字'+(sec===s.name?' · 收起':' · 展开'))),
            React.createElement('div',{style:{fontSize:10,color:'var(--color-text-tertiary)',marginTop:2,marginLeft:14}},s.tok+' tok · '+(s.tok/secTotal*100).toFixed(0)+'%'),
            sec===s.name ? React.createElement('div',stop, pre(s.text, 340)) : null))),
        tools.length ? React.createElement('div',{style:cardStyle},
          lbl('工具调用'),
          tools.slice(0,10).map(t => kv(t.name, t.count))) : null,
        React.createElement('div',{style:cardStyle},
          lbl('最近消息 · 点击展开'),
          recent.slice(-40).reverse().map((m,k) => React.createElement('div',{key:m.i,style:{display:'flex',flexDirection:'column',gap:3,padding:'6px 0',borderTop:k?'1px solid var(--color-border-muted)':'none',cursor:'pointer'},onClick:()=>toggle(m.i)},
            React.createElement('div',{style:{display:'flex',gap:6,alignItems:'center'}},
              React.createElement('span',{style:{fontSize:10,padding:'1px 6px',borderRadius:999,background:m.role==='user'?'#3b82f622':'#22c55e22',color:m.role==='user'?'#3b82f6':'#22c55e'}},m.role||'?'),
              React.createElement('span',{style:{fontSize:10,color:'var(--color-text-tertiary)'}},m.len+' 字'),
              m.tools.slice(0,3).map((t,j) => React.createElement('span',{key:j,style:{fontSize:10,color:'var(--color-text-tertiary)'}},'· '+t)),
              React.createElement('span',{style:{marginLeft:'auto',fontSize:10,color:'var(--color-text-tertiary)'}},open&&open.i===m.i?'收起':'展开')),
            m.preview ? React.createElement('div',{style:{fontSize:11,color:'var(--color-text-secondary)',lineHeight:1.4}},m.preview) : null,
            open && open.i === m.i ? React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:6,marginTop:6},onClick:(e)=>{try{e.stopPropagation();}catch(err){}}},
              open.loading ? React.createElement('div',{style:{fontSize:11,color:'var(--color-text-tertiary)'}},'加载中…') : null,
              open.d && open.d.error ? React.createElement('div',{style:{fontSize:11,color:'var(--color-accent-red)'}},open.d.error) : null,
              open.d && open.d.text ? pre(open.d.text, 320) : null,
              open.d && open.d.toolUses ? open.d.toolUses.map((t,j) => React.createElement('div',{key:'u'+j,style:{display:'flex',flexDirection:'column',gap:3}},React.createElement('div',{style:{fontSize:11,color:'var(--color-accent-blue)'}},t.tool||'?'), pre(t.input, 180))) : null,
              open.d && open.d.toolResults ? open.d.toolResults.map((r,j) => React.createElement('div',{key:'r'+j},pre(r.text, 200))) : null
            ) : null))),
        err ? React.createElement('div',{style:{fontSize:11,color:'var(--color-accent-red)'}},err) : null);
    };

    const Trail = () => {
      const [mode,setMode] = React.useState('traj');
      const [modeVis,setModeVis] = React.useState(1);
      const busyMode = React.useRef(false);
      const [t,setT] = React.useState(null);
      const [sys,setSys] = React.useState(null);
      const [filter,setFilter] = React.useState('all');
      const [sel,setSel] = React.useState(null);
      const [alive,setAlive] = React.useState(false);
      const [vis,setVis] = React.useState(false);
      const [paneW,setPaneW] = React.useState(42);
      const wrapRef = React.useRef(null);
      const [d,setD] = React.useState(null);
      const [dfilter,setDfilter] = React.useState('all');
      const [limit,setLimit] = React.useState(80);

      const loadTraj = React.useCallback(() => {
        Promise.resolve(host.call('context_data','trajectory')).then(setT).catch(() => {});
        Promise.resolve(host.call('context_data','sysprompt')).then(setSys).catch(() => {});
      }, []);
      const loadDna = React.useCallback(() => {
        Promise.resolve(host.call('context_data','dna')).then(setD).catch(() => {});
      }, []);
      React.useEffect(() => {
        loadTraj();
        let off; try { off = ctx.timer.every(8000, loadTraj); } catch (e) {}
        return () => { try { off && off(); } catch (e) {} };
      }, [loadTraj]);
      React.useEffect(() => {
        if (mode !== 'dna') return;
        loadDna();
        let off; try { off = ctx.timer.every(10000, loadDna); } catch (e) {}
        return () => { try { off && off(); } catch (e) {} };
      }, [mode, loadDna]);
      React.useEffect(() => {
        if (sel) {
          setAlive(true);
          const t1 = setTimeout(() => setVis(true), 10);
          return () => clearTimeout(t1);
        }
        setVis(false);
        const t2 = setTimeout(() => setAlive(false), 100);
        return () => clearTimeout(t2);
      }, [sel]);

      const switchMode = (next) => {
        if (next === mode || busyMode.current) return;
        busyMode.current = true;
        setSel(null);
        setModeVis(0);
        setTimeout(() => {
          setMode(next);
          if (next === 'dna') loadDna();
          requestAnimationFrame(() => requestAnimationFrame(() => {
            setModeVis(1);
            busyMode.current = false;
          }));
        }, 90);
      };

      const startDrag = (ev) => {
        try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {}
        const rect = wrapRef.current ? wrapRef.current.getBoundingClientRect() : null;
        if (!rect) return;
        const move = (e) => {
          const pct = 100 - ((e.clientX - rect.left) / rect.width) * 100;
          setPaneW(Math.max(18, Math.min(72, pct)));
        };
        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
      };

      const pickSys = (name, len, estTok) => {
        if (sel && sel.kind === 'sys' && sel.name === name) { setSel(null); return; }
        setSel({ kind: 'sys', name, len, est: estTok });
      };
      const pickMsg = (i, m, n) => {
        if (sel && sel.kind === 'msg' && sel.i === i) return;
        setSel({ kind: 'msg', i, m, n, loading: true });
        Promise.resolve(host.call('context_data','detail',[i])).then(dd => setSel({ kind: 'msg', i, m, n, d: dd })).catch(e => setSel({ kind: 'msg', i, m, n, d: { error: String((e && e.message) || e) } }));
      };
      const match = (m) => {
        if (filter === 'tool') return m.tools && m.tools.length > 0;
        if (filter === 'user') return m.role === 'user' && (!m.tools || m.tools.length === 0);
        if (filter === 'assistant') return m.role === 'assistant' && (!m.tools || m.tools.length === 0);
        return true;
      };
      const tabBtn = (key, label, cur, set) => React.createElement('button',{key,type:'button',className:'ctx-btn',onClick:()=>set(key),style:{padding:'3px 10px',borderRadius:999,border:'1px solid var(--color-border-muted)',background:cur===key?'var(--color-bg-tertiary)':'transparent',color:cur===key?'var(--color-text-primary)':'var(--color-text-secondary)',cursor:'pointer',fontSize:11}},label);
      const turns = (t && t.turns) || [];
      const sysOf = (name) => (sys && sys.sections ? sys.sections.find(x => x.name === name) : null);

      const paneItems = sel ? (sel.kind === 'sys' ? [
        React.createElement('div',{key:'h',style:{display:'flex',justifyContent:'space-between',alignItems:'center'}},
          React.createElement('div',{style:{fontSize:12,fontWeight:600,color:'var(--color-text-primary)'}},'系统 · '+sel.name),
          React.createElement('button',{type:'button',className:'ctx-btn',onClick:()=>setSel(null),style:{border:'1px solid var(--color-border-muted)',background:'var(--color-bg-secondary)',borderRadius:6,color:'var(--color-text-secondary)',cursor:'pointer',fontSize:12,padding:'1px 8px'}},'×')),
        React.createElement('div',{key:'kv',style:cardStyle}, kv('字符', sel.len), kv('估算', fmt(sel.est)+' tok')),
        React.createElement('div',{key:'raw',style:cardStyle}, lbl('原文'),
          (function(){ const s = sysOf(sel.name); return s ? pre(s.text, 460) : React.createElement('div',{style:{fontSize:11,color:'var(--color-text-tertiary)'}},'（未找到该分节原文）'); })())
      ] : [
        React.createElement('div',{key:'h',style:{display:'flex',justifyContent:'space-between',alignItems:'center'}},
          React.createElement('div',{style:{fontSize:12,fontWeight:600,color:'var(--color-text-primary)'}},(sel.n?'第 '+sel.n+' 轮 · ':'')+(sel.m.role||'?')),
          React.createElement('button',{type:'button',className:'ctx-btn',onClick:()=>setSel(null),style:{border:'1px solid var(--color-border-muted)',background:'var(--color-bg-secondary)',borderRadius:6,color:'var(--color-text-secondary)',cursor:'pointer',fontSize:12,padding:'1px 8px'}},'×')),
        React.createElement('div',{key:'kv',style:cardStyle}, kv('字符', sel.m.len), kv('工具', (sel.m.tools||[]).length), kv('结果字符', sel.m.resultLen||0)),
        React.createElement('div',{key:'raw',style:cardStyle}, lbl('原始内容'),
          sel.loading ? React.createElement('div',{style:{fontSize:11,color:'var(--color-text-tertiary)'}},'加载中…') : null,
          sel.d && sel.d.error ? React.createElement('div',{style:{fontSize:11,color:'var(--color-accent-red)'}},sel.d.error) : null,
          sel.d && sel.d.text ? pre(sel.d.text, 420) : null,
          sel.d && sel.d.toolUses && sel.d.toolUses.length ? lbl('工具入参') : null,
          sel.d && sel.d.toolUses ? sel.d.toolUses.map((x,j) => React.createElement('div',{key:'u'+j,style:{display:'flex',flexDirection:'column',gap:3}},React.createElement('div',{key:'n',style:{fontSize:11,color:'var(--color-accent-blue)'}},x.tool||'?'), pre(x.input, 220))) : null,
          sel.d && sel.d.toolResults && sel.d.toolResults.length ? lbl('工具输出') : null,
          sel.d && sel.d.toolResults ? sel.d.toolResults.map((x,j) => React.createElement('div',{key:'r'+j},pre(x.text, 240))) : null)
      ]) : null;
      const pane = sel ? React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:8}}, paneItems) : null;
      const overlay = alive ? React.createElement('div',{style:{position:'absolute',top:0,right:0,bottom:0,width:paneW+'%',background:'var(--color-bg-card)',borderLeft:'1px solid var(--color-border-muted)',boxShadow:'-12px 0 28px rgba(0,0,0,0.22)',padding:14,overflow:'auto',display:'flex',flexDirection:'column',zIndex:2,opacity:vis?1:0,transition:'opacity 90ms ease',pointerEvents:vis?'auto':'none'}}, pane) : null;
      const handle = alive ? React.createElement('div',{className:'ctx-split',title:'拖动调整宽度',onMouseDown:startDrag,style:{position:'absolute',top:0,bottom:0,right:paneW+'%',width:7,cursor:'col-resize',background:'transparent',zIndex:3}},
        React.createElement('div',{style:{position:'absolute',left:3,top:10,bottom:10,width:1,background:'var(--color-border-muted)',borderRadius:1}})) : null;

      const KIND = { system: '#8b5cf6', user: '#3b82f6', assistant: '#22c55e', tool: '#f59e0b' };
      const NAME = { system: '系统', user: '用户', assistant: '助手', tool: '工具' };
      const all = (d && d.items) || [];
      const ditems = all.filter(it => dfilter === 'all' ? true : it.kind === dfilter);
      const dshown = ditems.slice(Math.max(0, ditems.length - limit)).reverse();

      const head = React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center'}},
        React.createElement('div',{style:{fontSize:15,fontWeight:600,color:'var(--color-text-primary)'}}, mode === 'dna' ? 'DNA' : '轨迹'),
        React.createElement('div',{style:{display:'flex',gap:8,alignItems:'center'}},
          React.createElement('span',{style:{fontSize:11,color:'var(--color-text-tertiary)'}}, mode === 'dna' ? ((d?d.count:0)+' 项 · ≈'+fmt(d?d.total:0)+' tok') : ((t?t.count:0)+' 轮')),
          mode === 'dna'
            ? pill('轨迹', '#22c55e', () => switchMode('traj'), '切换回轨迹')
            : pill('DNA', '#3b82f6', () => switchMode('dna'), '切换到 DNA')));

      const trajBody = React.createElement('div',{ref:wrapRef,style:{position:'relative',display:'flex',flex:1,minHeight:0,overflow:'hidden'}},
        React.createElement('div',{style:{flex:'1 1 auto',minWidth:0,display:'flex',flexDirection:'column',gap:10,padding:12,overflow:'auto'}},
          React.createElement('div',{style:{display:'flex',gap:6,flexWrap:'wrap'}},[tabBtn('all','全部',filter,setFilter),tabBtn('user','用户',filter,setFilter),tabBtn('assistant','助手',filter,setFilter),tabBtn('tool','工具',filter,setFilter)]),
          (t && t.system) ? React.createElement('div',{style:cardStyle},
            React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center'}},
              React.createElement('div',{style:{fontSize:12,fontWeight:600,color:'var(--color-text-primary)'}},'系统提示词'),
              React.createElement('div',{style:{fontSize:10,color:'var(--color-text-tertiary)'}},t.system.count+' 节 · ≈'+fmt(t.system.est)+' tok')),
            t.system.sections.map(s => React.createElement('div',{key:s.name,style:{display:'flex',alignItems:'center',gap:6,padding:'4px 0',borderTop:'1px solid var(--color-border-muted)',cursor:'pointer',background:sel&&sel.kind==='sys'&&sel.name===s.name?'var(--color-bg-tertiary)':'transparent',borderRadius:6},onClick:()=>pickSys(s.name, s.len, s.est)},
              React.createElement('span',{style:{fontSize:10,padding:'1px 6px',borderRadius:999,background:'#8b5cf622',color:'#8b5cf6'}},'system'),
              React.createElement('span',{style:{fontSize:11,color:'var(--color-text-primary)'}},s.name),
              React.createElement('span',{style:{marginLeft:'auto',fontSize:10,color:'var(--color-text-tertiary)'}},fmt(s.est)+' tok · '+(sel&&sel.kind==='sys'&&sel.name===s.name?'收起':'展开'))))) : null,
          turns.map(turn => {
            const items = turn.items.filter(match);
            if (!items.length) return null;
            return React.createElement('div',{key:turn.n,style:{display:'flex',flexDirection:'column',gap:4}},
              React.createElement('div',{style:{fontSize:11,color:'var(--color-text-tertiary)',marginTop:4}},'第 '+turn.n+' 轮 · '+items.length+' 条'),
              React.createElement('div',{style:cardStyle},
                items.map(m => React.createElement('div',{key:m.i,style:{display:'flex',flexDirection:'column',gap:3,padding:'5px 0',borderTop:'1px solid var(--color-border-muted)',cursor:'pointer',background:sel&&sel.kind==='msg'&&sel.i===m.i?'var(--color-bg-tertiary)':'transparent',borderRadius:6},onClick:()=>pickMsg(m.i, m, turn.n)},
                  React.createElement('div',{style:{display:'flex',gap:6,alignItems:'center'}},
                    React.createElement('span',{style:{fontSize:10,padding:'1px 6px',borderRadius:999,background:m.role==='user'?'#3b82f622':'#22c55e22',color:m.role==='user'?'#3b82f6':'#22c55e'}},m.role||'?'),
                    React.createElement('span',{style:{fontSize:10,color:'var(--color-text-tertiary)'}},m.len+' 字'),
                    m.tools.slice(0,4).map((x,j) => React.createElement('span',{key:j,style:{fontSize:10,color:'var(--color-accent-blue)'}},'· '+x)),
                    m.resultLen ? React.createElement('span',{style:{fontSize:10,color:'var(--color-text-tertiary)'}},'↩ '+fmt(m.resultLen)+' 字') : null),
                  m.preview ? React.createElement('div',{style:{fontSize:11,color:'var(--color-text-secondary)',lineHeight:1.4}},m.preview) : null))));
          }),
          (!t || !t.count) ? React.createElement('div',{style:{fontSize:11,color:'var(--color-text-tertiary)'}},'还没有消息') : null),
        overlay, handle);

      const dnaBody = React.createElement('div',{style:{position:'relative',display:'flex',flex:1,minHeight:0,overflow:'hidden'}},
        React.createElement('div',{style:{flex:'1 1 auto',minWidth:0,display:'flex',flexDirection:'column',gap:10,padding:12,overflow:'auto'}},
          React.createElement('div',{style:{display:'flex',gap:6,flexWrap:'wrap'}},[tabBtn('all','全部',dfilter,setDfilter),tabBtn('system','系统',dfilter,setDfilter),tabBtn('user','用户',dfilter,setDfilter),tabBtn('assistant','助手',dfilter,setDfilter),tabBtn('tool','工具',dfilter,setDfilter)]),
          React.createElement('div',{style:cardStyle},
            dshown.map(it => React.createElement('div',{key:it.n,style:{display:'flex',gap:6,alignItems:'center',padding:'5px 0',borderTop:'1px solid var(--color-border-muted)',cursor:'pointer',minWidth:0},onClick:()=>{ if (it.kind==='system') pickSys(it.name, it.len, it.est); else pickMsg(it.i, { role: it.kind, len: it.len, tools: it.tools||[], resultLen: 0 }, null); }},
              React.createElement('span',{style:{fontSize:10,color:'var(--color-text-tertiary)',minWidth:30}},'#'+it.n),
              React.createElement('span',{style:{fontSize:10,padding:'1px 6px',borderRadius:999,background:KIND[it.kind]+'22',color:KIND[it.kind],whiteSpace:'nowrap'}},NAME[it.kind]),
              React.createElement('span',{style:{fontSize:11,color:'var(--color-text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},it.kind==='system'?it.name:(it.tools&&it.tools.length?it.tools.join(', '):(it.preview||'—'))),
              React.createElement('span',{style:{marginLeft:'auto',fontSize:10,color:'var(--color-text-tertiary)',whiteSpace:'nowrap'}},fmt(it.est)+' tok')))),
          React.createElement('div',{style:cardStyle},
            React.createElement('div',{style:{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--color-text-secondary)'}},
              React.createElement('span',null,'系统 ≈'+fmt(d?d.sysTok:0)+' tok'),
              React.createElement('span',null,'消息 ≈'+fmt(d?d.msgTok:0)+' tok')),
            React.createElement('div',{style:{fontSize:10,color:'var(--color-text-tertiary)',lineHeight:1.6}},'工具定义 34 个：未采集')),
          (ditems.length > dshown.length) ? React.createElement('button',{type:'button',className:'ctx-btn',onClick:()=>setLimit(l => l + 80),style:btnStyle},'加载更多（'+dshown.length+' / '+ditems.length+'）') : null),
        overlay, handle);

      return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',minHeight:0}},
        React.createElement('div',{style:{padding:'10px 12px 0'}}, head),
        React.createElement('div',{style:{display:'flex',flex:1,minHeight:0,opacity:modeVis,transition:'opacity 90ms ease'}},
          mode === 'dna' ? dnaBody : trajBody));
    };

    ctx.slots.register({ name:'app.dock.tabs.item', id:'context-panel', order:40, label:'上下文' }, Panel);
    ctx.slots.register({ name:'app.dock.tabs.item', id:'trajectory-panel', order:41, label:'轨迹' }, Trail);
  }
};

})();

export const inject = __mod.inject;
export const apply = __mod.apply;

