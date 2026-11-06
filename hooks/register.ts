const preview = (text, n = 160) => {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n) + '…' : s;
};

const clip = (value, n) => {
  const t = String(value === null || value === undefined ? '' : value);
  return t.length > n ? t.slice(0, n) + '\n…[截断 ' + (t.length - n) + ' 字]' : t;
};

const safeJson = (value) => {
  try { return JSON.stringify(value, null, 2); } catch (e) { return String(value); }
};

const estTok = (s) => {
  const str = String(s || '');
  const c = (str.match(/[\u3400-\u9FFF]/g) || []).length;
  return Math.round(c + (str.length - c) / 4);
};

const KEY = 'sections-v1';
const FILE = 'system-prompt.json';
const sections = new Map();
let capturedAt = 0;
let dirty = false;
let lastFile = '';

const snapshot = () => {
  const out = {};
  for (const [k, v] of sections.entries()) out[k] = v;
  return out;
};

const envGet = async ($, name) => {
  try { return await $.env.get(name); } catch (e) { return undefined; }
};

const rootPath = async ($) => {
  const cfg = await envGet($, 'CODEBUDDY_CONFIG_DIR');
  const home = (await envGet($, 'USERPROFILE')) || (await envGet($, 'HOME')) || '';
  return (cfg && typeof cfg === 'string') ? cfg : (home ? home + '\\.codebuddy' : '.');
};

const dirPath = async ($) => (await rootPath($)) + '\\context-panel';
const filePath = async ($) => (await dirPath($)) + '\\' + FILE;
const settingsPath = async ($) => (await rootPath($)) + '\\settings.json';

const readDebugFlag = async ($) => {
  try {
    const p = await settingsPath($);
    const text = await $.fs.read(p);
    const data = JSON.parse(String(text));
    const raw = data && data.env ? data.env.CODEBUDDY_DEBUG_REQUEST : undefined;
    const on = raw === '1' || raw === 1 || raw === true;
    return { enabled: on, path: p };
  } catch (e) {
    return { enabled: false, error: String((e && e.message) || e) };
  }
};

const writeDebugFlag = async ($, on) => {
  try {
    const p = await settingsPath($);
    const text = await $.fs.read(p);
    const data = JSON.parse(String(text));
    if (!data.env || typeof data.env !== 'object') data.env = {};
    if (on) data.env.CODEBUDDY_DEBUG_REQUEST = '1';
    else delete data.env.CODEBUDDY_DEBUG_REQUEST;
    await $.fs.write(p, JSON.stringify(data, null, 2));
    return { enabled: !!on, path: p, needRestart: true };
  } catch (e) {
    return { enabled: !on, error: String((e && e.message) || e) };
  }
};

const merge = (secs, savedAt) => {
  if (!secs || typeof secs !== 'object') return;
  for (const k of Object.keys(secs)) {
    const entry = secs[k];
    if (!entry || !entry.text) continue;
    const cur = sections.get(k);
    if (!cur || (entry.at || 0) > (cur.at || 0)) { sections.set(k, entry); dirty = true; }
  }
  const times = [...sections.values()].map((s) => s.at || 0).filter(Boolean);
  if (times.length) capturedAt = Math.max(capturedAt, ...times);
  if (savedAt && savedAt > capturedAt) capturedAt = savedAt;
};

const loadFromStore = async ($) => {
  try {
    const saved = await $.store.get(KEY);
    if (saved && typeof saved === 'object') merge(saved, 0);
    return true;
  } catch (e) { return false; }
};

const loadFromFile = async ($) => {
  try {
    const p = await filePath($);
    const ex = await $.fs.exists(p);
    if (!ex) return false;
    lastFile = p;
    const text = await $.fs.read(p);
    const data = JSON.parse(String(text));
    merge(data && data.sections, data && data.savedAt);
    dirty = false;
    return true;
  } catch (e) { return false; }
};

const writeFile = async ($) => {
  try {
    const p = await filePath($);
    const payload = { version: 1, savedAt: Date.now(), sections: snapshot() };
    await $.fs.write(p, JSON.stringify(payload, null, 2));
    lastFile = p;
    dirty = false;
    return p;
  } catch (e) { return null; }
};

const persist = ($) => {
  try { Promise.resolve($.store.set(KEY, snapshot())).catch(() => {}); } catch (e) {}
  writeFile($);
};

const collect = async ($) => {
  const out = { at: Date.now(), ok: true };
  try { out.model = await $.session.model(); } catch (e) { out.modelError = String((e && e.message) || e); }
  try { out.usage = await $.session.usage(); } catch (e) {}
  try { out.turns = await $.session.turns(); } catch (e) {}
  let msgs = [];
  try { msgs = await $.session.messages(); } catch (e) { out.messagesError = String((e && e.message) || e); }
  const arr = Array.isArray(msgs) ? msgs : [];
  const counts = { total: arr.length, toolCalls: 0, errors: 0 };
  const toolMap = new Map();
  const recent = [];
  for (let i = 0; i < arr.length; i++) {
    const m = arr[i];
    const text = String((m && m.text) || '');
    const uses = Array.isArray(m && m.toolUses) ? m.toolUses : [];
    const results = Array.isArray(m && m.toolResults) ? m.toolResults : [];
    counts.toolCalls += uses.length;
    for (const u of uses) {
      const name = String((u && u.tool) || 'unknown');
      toolMap.set(name, (toolMap.get(name) || 0) + 1);
    }
    for (const r of results) {
      if (/^\s*(error|failed|exception)/i.test(String((r && r.text) || ''))) counts.errors++;
    }
    recent.push({ i, role: m && m.role, len: text.length, preview: preview(text), tools: uses.map((u) => String((u && u.tool) || '?')) });
  }
  out.counts = counts;
  out.tools = [...toolMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([name, count]) => ({ name, count }));
  out.recent = recent.slice(-60);
  return out;
};

const detail = async ($, index) => {
  const arr = (await $.session.messages()) || [];
  const m = arr[index];
  if (!m) return { error: '消息不存在' };
  return {
    i: index,
    role: m.role,
    text: clip(m.text, 6000),
    toolUses: (m.toolUses || []).map((u) => ({ tool: u && u.tool, input: clip(safeJson(u && u.input), 3000) })),
    toolResults: (m.toolResults || []).map((r) => ({ text: clip(r && r.text, 3000) }))
  };
};

const systemRows = () => [...sections.values()].map((s) => ({ name: s.name, len: s.len, est: estTok(s.text) }));

const trajectory = async ($) => {
  const arr = (await $.session.messages()) || [];
  const turns = [];
  let cur = null;
  for (let i = 0; i < arr.length; i++) {
    const m = arr[i];
    const results = Array.isArray(m && m.toolResults) ? m.toolResults : [];
    const startsTurn = m && m.role === 'user' && results.length === 0;
    if (!cur || startsTurn) { cur = { n: turns.length + 1, items: [] }; turns.push(cur); }
    const text = String((m && m.text) || '');
    const uses = Array.isArray(m && m.toolUses) ? m.toolUses : [];
    cur.items.push({
      i,
      role: m && m.role,
      len: text.length,
      preview: preview(text),
      tools: uses.map((u) => String((u && u.tool) || '?')),
      resultLen: results.reduce((sum, r) => sum + String((r && r.text) || '').length, 0)
    });
  }
  const rows = systemRows();
  return {
    count: turns.length,
    turns: turns.slice(-40),
    system: { count: rows.length, est: rows.reduce((a, b) => a + b.est, 0), sections: rows }
  };
};

const dna = async ($) => {
  const items = [];
  let n = 0;
  let sysTok = 0;
  for (const s of sections.values()) {
    const tok = estTok(s.text);
    sysTok += tok;
    n++;
    items.push({ n, kind: 'system', name: s.name, len: s.len, est: tok });
  }
  const arr = (await $.session.messages()) || [];
  const LIMIT = 300;
  const start = Math.max(0, arr.length - (LIMIT - items.length));
  let msgTok = 0;
  for (let i = start; i < arr.length; i++) {
    const m = arr[i];
    const text = String((m && m.text) || '');
    const uses = Array.isArray(m && m.toolUses) ? m.toolUses : [];
    const results = Array.isArray(m && m.toolResults) ? m.toolResults : [];
    const kind = results.length ? 'tool' : (m && m.role === 'user' ? 'user' : 'assistant');
    let chars = text.length;
    let tok = estTok(text);
    for (const u of uses) { const j = safeJson(u && u.input); chars += j.length; tok += estTok(j); }
    for (const r of results) { const t = String((r && r.text) || ''); chars += t.length; tok += estTok(t); }
    msgTok += tok;
    n++;
    items.push({
      n,
      kind,
      i,
      len: chars,
      est: tok,
      tools: uses.map((u) => String((u && u.tool) || '?')),
      preview: preview(text || (results[0] && results[0].text) || '')
    });
  }
  return {
    count: items.length,
    total: sysTok + msgTok,
    sysTok,
    msgTok,
    skipped: start,
    toolDefs: 34,
    toolDefsCollected: false,
    items
  };
};

export function register(on) {
  on('prompt.section', { name: /.*/ }, async ($, e, next) => {
    const beneath = await next(e);
    try {
      const name = String((e && e.name) || 'unknown');
      const text = String(beneath && beneath.text != null ? beneath.text : ((e && e.text) || ''));
      if (text) {
        sections.set(name, { name, len: text.length, at: Date.now(), text: clip(text, 60000) });
        capturedAt = Date.now();
        dirty = true;
      }
    } catch (err) {}
    return beneath;
  });

  on('engine.create', async (_$, e, next) => {
    const beneath = await next(e);
    await loadFromFile(beneath);
    await loadFromStore(beneath);
    return {
      ...beneath,
      context_data: {
        debugState: () => readDebugFlag(beneath),
        setDebug: (v) => writeDebugFlag(beneath, !!v),
        get: () => collect(beneath),
        detail: (index) => detail(beneath, index),
        trajectory: () => trajectory(beneath),
        dna: () => dna(beneath),
        sysprompt: async () => {
          await loadFromFile(beneath);
          await loadFromStore(beneath);
          if (dirty || !lastFile) persist(beneath);
          return {
            at: capturedAt,
            count: sections.size,
            total: [...sections.values()].reduce((sum, s) => sum + s.len, 0),
            file: lastFile,
            sections: [...sections.values()].sort((a, b) => (a.name < b.name ? -1 : 1))
          };
        }
      }
    };
  });
}
