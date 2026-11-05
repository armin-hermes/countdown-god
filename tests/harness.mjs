// Headless DOM-stub harness: loads the real inline script from public/index.html
// and verifies planner/timer sync behaviour end-to-end.
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf-8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

const realNow = Date.now;
let fakeNow = realNow();

class El {
  constructor(tag='div'){ this.tagName=(tag||'div').toUpperCase(); this.children=[]; this.dataset={}; this.style={setProperty(){},removeProperty(){}}; this._cls=new Set(); this._qc={};
    this.classList={add:(...c)=>c.forEach(x=>this._cls.add(x)),remove:(...c)=>c.forEach(x=>this._cls.delete(x)),toggle:(c,f)=>{ if(f===undefined) f=!this._cls.has(c); f?this._cls.add(c):this._cls.delete(c); return f; },contains:c=>this._cls.has(c)};
    let _html='';
    Object.defineProperty(this,'innerHTML',{get:()=>_html,set:(v)=>{ _html=String(v); this._qc={}; }});
    this.textContent=''; this.value=''; this.hidden=false; this.parentNode=null; }
  querySelector(){ return new El(); }
  querySelectorAll(sel){
    const m=/\[data-([a-zA-Z-]+)\]/.exec(sel||''); if(!m) return [];
    if(this._qc[sel]) return this._qc[sel];
    const re=new RegExp('data-'+m[1]+'="(\\d+)"','g'); const out=[]; let mm;
    while((mm=re.exec(this.innerHTML))){ const el=new El('button'); el.dataset[m[1]]=mm[1]; out.push(el); }
    this._qc[sel]=out; return out;
  }
  addEventListener(){}
  appendChild(c){ this.children.push(c); c.parentNode=this; return c; }
  focus(){} select(){} click(){ if(this.onclick) this.onclick({stopPropagation(){}}); }
  setAttribute(){} getAttribute(){ return null; } removeAttribute(){}
}

export function loadApp(seed){
  fakeNow = realNow();
  const store = new Map(Object.entries(seed||{}));
  const localStorage = { getItem:k=>store.has(k)?store.get(k):null, setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
  const cache = new Map();
  const qs = sel => { if(!cache.has(sel)) cache.set(sel, new El(sel.startsWith('#')?'div':'div')); return cache.get(sel); };
  const documentElement = new El('html');
  const body = new El('body');
  const document = {
    querySelector: qs,
    querySelectorAll: ()=>[],
    getElementById: id=>qs('#'+id),
    createElement: tag=>new El(tag),
    addEventListener(){},
    documentElement, body, title:'', activeElement:null,
  };
  const intervals=[];
  const sandbox = {
    document, localStorage, navigator:{}, location:{search:'',href:''},
    setInterval:(fn)=>{ intervals.push(fn); return intervals.length; },
    clearInterval:(id)=>{ if(id>=1) intervals[id-1]=null; },
    setTimeout:(fn)=>0, clearTimeout:()=>{},
    console, Intl, JSON, Math, Object, Array, String, Number, Date, RegExp, Error, Promise,
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  sandbox.window.confirm = ()=>true; sandbox.window.scrollTo = ()=>{}; sandbox.window.addEventListener=()=>{};
  sandbox.Date.now = ()=>fakeNow;
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);
  return { qs, store, advance:(ms)=>{ fakeNow+=ms; }, pump:()=>{ intervals.slice().forEach(fn=>{ if(fn) fn(); }); }, sandbox };
}
export const FA='0123456789'; // UI digits are Latin per user preference
export const fa = n => String(n).replace(/\d/g,d=>FA[d]);
