// AI Provider：前端无密钥，默认 Demo；可选可信后端代理。
export interface StreamCallbacks { onChunk:(text:string)=>void; onDone:()=>void; onError:(err:Error)=>void }
export interface AIProvider { name:string; isDemo:boolean; generateStream(prompt:string,callbacks:StreamCallbacks):()=>void }

class DemoProvider implements AIProvider {
  name='Demo'; isDemo=true;
  generateStream(prompt:string,callbacks:StreamCallbacks):()=>void {
    const text=pickDemoText(prompt); let i=0; let cancelled=false;
    const tick=()=>{ if(cancelled)return; if(i>=text.length){callbacks.onDone();return;} const step=3+Math.floor(Math.random()*6); callbacks.onChunk(text.slice(i,i+step)); i+=step; setTimeout(tick,20+Math.random()*40); };
    setTimeout(tick,100); return()=>{cancelled=true;};
  }
}
function pickDemoText(prompt:string):string {
  const p=prompt.toLowerCase();
  if(p.includes('分镜')||p.includes('shot')||p.includes('镜序')) return '[{"shotNo":1,"shotSize":"全景","camera":"固定机位","description":"清晨的古镇街道，雾气朦胧","action":"空镜","voiceover":"在江南的一座古镇上，清晨的雾气还未散去……","subtitle":"清晨 · 古镇","sound":"鸟鸣与流水声","transition":"淡入","duration":5,"aiPrompt":"ancient chinese town at dawn, cinematic wide shot"}]';
  if(p.includes('逐字稿')||p.includes('金句')||p.includes('声迹')||p.includes('quote')) return '## 主题分段\n\n### 为什么使用 AI\n**金句**：AI 是工具，最后拍板的还得是人。\n- 分类：观点\n- 理由：核心观点句，适合做结尾升华。';
  if(p.includes('选题')||p.includes('报道')||p.includes('媒眼')||p.includes('media')) return '## 选题价值\n本选题关注 AI 在融媒体生产中的应用。\n\n## 待核实\n- AI 工具的实际使用率\n- 对内容效率的真实影响\n\n## 事实核查清单\n- [ ] 核实数据来源与统计口径\n- [ ] 核实受访者身份';
  return 'Demo 模式使用内置示例数据。真实 AI 需通过安全后端代理接入，前端不保存密钥。';
}

class ProxyProvider implements AIProvider {
  name='Proxy'; isDemo=false; private proxyUrl:string;
  constructor(){this.proxyUrl=(import.meta.env.VITE_AI_PROXY_URL||'').replace(/\/$/,'');}
  configured(){return Boolean(this.proxyUrl);}
  generateStream(prompt:string,callbacks:StreamCallbacks):()=>void {
    const controller=new AbortController();
    (async()=>{try{
      if(!this.proxyUrl)throw new Error('代理服务地址未配置');
      const res=await fetch(this.proxyUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,stream:true}),signal:controller.signal});
      if(!res.ok)throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const reader=res.body?.getReader(); if(!reader)throw new Error('No response body');
      const decoder=new TextDecoder(); let buffer='';
      while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop()||'';
        for(const line of lines){const t=line.trim();if(!t)continue;if(t.startsWith('data:')){const data=t.slice(5).trim();if(data==='[DONE]'){callbacks.onDone();return;}try{const json=JSON.parse(data);const delta=json.choices?.[0]?.delta?.content;if(delta)callbacks.onChunk(delta);}catch{/* skip */}}else{try{const json=JSON.parse(t);const content=json.content??json.delta??json.text;if(content)callbacks.onChunk(content);}catch{/* skip */}}}
      }
      callbacks.onDone();
    }catch(err){if((err as Error).name!=='AbortError')callbacks.onError(err as Error);}})();
    return()=>controller.abort();
  }
}
let cachedProvider:AIProvider|null=null;
export function getAIProvider():AIProvider {
  if(cachedProvider)return cachedProvider;
  if((import.meta.env.VITE_AI_PROVIDER||'demo').toLowerCase()==='proxy'){const p=new ProxyProvider();cachedProvider=p.configured()?p:new DemoProvider();}
  else cachedProvider=new DemoProvider();
  return cachedProvider;
}
