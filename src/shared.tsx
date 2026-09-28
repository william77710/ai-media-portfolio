import { useState, useEffect, useMemo, type ChangeEvent, type MouseEvent, type ReactNode } from 'react';
import { Plus, Trash2, Edit3, X, Settings, CheckCircle2, AlertCircle, RefreshCw, Sparkles, BookOpen } from 'lucide-react';

const LS = localStorage;
export const lsGet = <T,>(k: string, d: T): T => { try { const v = LS.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
export const lsSet = (k: string, v: unknown) => { try { LS.setItem(k, JSON.stringify(v)); } catch {} };
export const cn = (...a: unknown[]) => a.filter(Boolean).join(' ');
export const uid = () => Math.random().toString(36).slice(2, 10);
export const fmtTime = (s: number) => { const m = Math.floor(s / 60), r = Math.floor(s % 60), ms = Math.floor((s % 1) * 100); return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}.${String(ms).padStart(2, '0')}`; };
export const parseT = (t: string) => { const p = t.trim().split(':'); if (p.length < 2) return 0; const [h, m, s] = p.length === 3 ? p : ['0', p[0], p[1]]; return Number(h) * 3600 + Number(m) * 60 + parseFloat(s.replace(',', '.')); };
export const dlFile = (n: string, c: string, type = 'text/markdown') => { const b = new Blob([c], { type }), u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = n; a.click(); URL.revokeObjectURL(u); };

// DOM Toast
let toastTimer: number | null = null;
export function toast(msg: string) {
  let el = document.getElementById('__toast');
  if (!el) {
    el = document.createElement('div');
    el.id = '__toast';
    el.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-3.5 py-2 rounded-lg bg-foreground text-background text-xs shadow-lg transition-all duration-200 pointer-events-none flex items-center gap-2 border border-border/20';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  el.style.transform = 'translate(-50%, 0)';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    if (el) {
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%, -10px)';
    }
  }, 2400);
}

// ========== 鲁棒 JSON 解析器 ==========
export function robustJSONParse<T>(raw: string, fallback: T): T {
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    let clean = raw.trim();
    if (clean.includes('```')) {
      const match = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match && match[1]) clean = match[1].trim();
    }
    const firstBrace = clean.indexOf('{');
    const firstBracket = clean.indexOf('[');
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      const lastBrace = clean.lastIndexOf('}');
      if (lastBrace !== -1 && lastBrace > firstBrace) {
        clean = clean.substring(firstBrace, lastBrace + 1);
      }
    } else if (firstBracket !== -1) {
      const lastBracket = clean.lastIndexOf(']');
      if (lastBracket !== -1 && lastBracket > firstBracket) {
        clean = clean.substring(firstBracket, lastBracket + 1);
      }
    }
    return JSON.parse(clean) as T;
  } catch (err) {
    console.warn('robustJSONParse fallback:', err);
    return fallback;
  }
}

// ========== 全局 API Key 与 Provider 设置 ==========
export interface AISettings {
  provider: 'demo' | 'deepseek' | 'kimi' | 'openai' | 'custom';
  apiKey: string;
  baseUrl: string;
  model: string;
}

const DEFAULT_SETTINGS: AISettings = {
  provider: 'demo',
  apiKey: '',
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
};

const PROVIDER_PRESETS: Record<string, { baseUrl: string; model: string; label: string }> = {
  demo: { baseUrl: '', model: '内置高质量语料库', label: '演示 Demo 模式' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', label: 'DeepSeek 官方 API' },
  kimi: { baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k', label: 'Kimi / Moonshot' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', label: 'OpenAI 官方' },
  custom: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', label: '自定义 OpenAI 格式端点' },
};

export const getAISettings = (): AISettings => lsGet<AISettings>('amp_ai_settings', DEFAULT_SETTINGS);
export const setAISettings = (s: AISettings) => lsSet('amp_ai_settings', s);

// ========== 统一 AI 请求调用（支持 OpenAI 规范 + Demo 自动回退） ==========
export async function proxyOrDemo(
  task: string,
  payload: unknown,
  systemPrompt?: string
): Promise<{ ok: boolean; data?: any; fromAI: boolean; errorMsg?: string }> {
  const settings = getAISettings();
  if (settings.provider === 'demo' || !settings.apiKey.trim()) {
    return { ok: true, fromAI: false };
  }

  const cleanBase = settings.baseUrl.trim().replace(//+$/, '');
  const endpoint = cleanBase + '/chat/completions';
  const defaultSys = '你是一位资深融媒体采编主任、影视编导与纪录片剪辑专家。请严格按照任务要求的结构化 JSON 格式返回，不输出任何与 JSON 无关的客套话。';

  try {
    const userContent = '任务名称: ' + task + '
输入参数: ' + JSON.stringify(payload, null, 2);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + settings.apiKey.trim(),
      },
      body: JSON.stringify({
        model: settings.model || 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt || defaultSys },
          { role: 'user', content: userContent },
        ],
        temperature: 0.7,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error('API 响应错误 HTTP ' + res.status + ': ' + errText.slice(0, 150));
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content || '';
    if (!content) throw new Error('API 返回内容为空');

    return { ok: true, data: content, fromAI: true };
  } catch (err: any) {
    console.warn('Real AI Call Failed:', err);
    return {
      ok: true,
      fromAI: false,
      errorMsg: err.name === 'AbortError' ? '请求超时，已回退至案例库' : (err.message || '网络连接异常，已回退至案例库')
    };
  }
}

// ========== ⚙️ 全局 API 设置弹窗组件 ==========
export function AISettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [settings, setS] = useState<AISettings>(getAISettings);
  const [testing, setTesting] = useState(false);
  const [testRes, setTestRes] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => { if (open) { setS(getAISettings()); setTestRes(null); } }, [open]);

  const handleProviderChange = (p: AISettings['provider']) => {
    const preset = PROVIDER_PRESETS[p];
    setS(prev => ({ ...prev, provider: p, baseUrl: preset.baseUrl || prev.baseUrl, model: preset.model || prev.model }));
    setTestRes(null);
  };

  const handleSave = () => {
    setAISettings(settings);
    toast(settings.provider === 'demo' || !settings.apiKey.trim() ? '已切换为 Demo 案例模式' : '已配置并启用 ' + settings.provider + ' 真实模型');
    onClose();
  };

  const handleTest = async () => {
    if (!settings.apiKey.trim()) {
      setTestRes({ ok: false, msg: '请先填写 API Key' });
      return;
    }
    setTesting(true);
    setTestRes(null);
    try {
      const cleanBase = settings.baseUrl.trim().replace(//+$/, '');
      const endpoint = cleanBase + '/chat/completions';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + settings.apiKey.trim() },
        body: JSON.stringify({ model: settings.model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
      });
      if (res.ok) {
        setTestRes({ ok: true, msg: '连通性测试成功！可正常使用真实 AI。' });
      } else {
        const text = await res.text();
        setTestRes({ ok: false, msg: '连接失败 (HTTP ' + res.status + '): ' + text.slice(0, 80) });
      }
    } catch (e: any) {
      setTestRes({ ok: false, msg: 'CORS 或网络阻断: ' + (e.message || '请检查 Base URL 是否支持跨域') });
    } finally {
      setTesting(false);
    }
  };

  if (!open) return null;
  return (
    <Modal t="大模型与 API 配置（前端安全直连）" onClose={onClose} w="max-w-lg">
      <div className="space-y-3.5 text-xs">
        <div className="p-2.5 bg-muted/40 rounded-lg text-muted-foreground leading-relaxed flex items-start gap-2">
          <Settings className="size-4 shrink-0 text-primary mt-0.5" />
          <span><b>纯前端安全设计</b>：你的 API Key 仅保存在当前浏览器的 <code>localStorage</code> 中，直接在浏览器端发起请求，绝不经过任何第三方服务器中转。</span>
        </div>

        <div>
          <label className="font-semibold block mb-1">选择模型服务商</label>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.entries(PROVIDER_PRESETS) as [AISettings['provider'], typeof PROVIDER_PRESETS[string]][]).map(([k, v]) => (
              <button
                key={k}
                type="button"
                onClick={() => handleProviderChange(k)}
                className={cn('p-2 rounded-lg border text-left transition-all', settings.provider === k ? 'border-primary bg-primary/5 text-primary font-medium ring-1 ring-primary/20' : 'border-border/60 hover:bg-accent/40')}
              >
                <div className="text-[11px] font-semibold">{v.label}</div>
                <div className="text-[10px] text-muted-foreground truncate">{v.model}</div>
              </button>
            ))}
          </div>
        </div>

        {settings.provider !== 'demo' && (
          <div>
            <div>
              <label className="font-semibold block mb-1">API Key</label>
              <Input
                type="password"
                value={settings.apiKey}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setS({ ...settings, apiKey: e.target.value })}
                placeholder="sk-..."
              />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <label className="font-semibold block mb-1">Base URL</label>
                <Input
                  value={settings.baseUrl}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setS({ ...settings, baseUrl: e.target.value })}
                  placeholder="https://api.deepseek.com/v1"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Model Name</label>
                <Input
                  value={settings.model}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setS({ ...settings, model: e.target.value })}
                  placeholder="deepseek-chat"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <B variant="outline" onClick={handleTest} disabled={testing}>
                <RefreshCw className={cn('size-3.5', testing && 'animate-spin')} />
                {testing ? '测试中...' : '测试连通性'}
              </B>
              {testRes && (
                <div className={cn('text-[11px] flex items-center gap-1', testRes.ok ? 'text-green-600' : 'text-red-500')}>
                  {testRes.ok ? <CheckCircle2 className="size-3.5" /> : <AlertCircle className="size-3.5" />}
                  <span className="truncate max-w-[240px]">{testRes.msg}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-border/40">
          <B variant="ghost" onClick={() => { setS(DEFAULT_SETTINGS); setAISettings(DEFAULT_SETTINGS); toast('已重置为默认 Demo 模式'); onClose(); }}>
            清除密钥并重置
          </B>
          <div className="flex gap-2">
            <B variant="outline" onClick={onClose}>取消</B>
            <B onClick={handleSave}>保存配置</B>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ========== 📚 场景案例库选择器抽屉组件 ==========
export function ScenarioPickerModal({
  open,
  onClose,
  title,
  scenarios,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  scenarios: Array<{ id: string; category: string; title: string; brief: string; input: Record<string, any> }>;
  onSelect: (scenario: any) => void;
}) {
  const [selectedCat, setSelectedCat] = useState('全部');
  const categories = useMemo(() => ['全部', ...Array.from(new Set(scenarios.map(s => s.category)))], [scenarios]);
  const filtered = useMemo(() => selectedCat === '全部' ? scenarios : scenarios.filter(s => s.category === selectedCat), [scenarios, selectedCat]);

  if (!open) return null;
  return (
    <Modal t={'📚 ' + title + '（20组场景）'} onClose={onClose} w="max-w-2xl">
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 flex-wrap border-b border-border/40 pb-2">
          {categories.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setSelectedCat(c)}
              className={cn('px-2.5 py-1 rounded-md text-xs font-medium transition-all', selectedCat === c ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[55vh] overflow-y-auto pr-1">
          {filtered.map(s => (
            <div
              key={s.id}
              onClick={() => { onSelect(s); onClose(); toast('已载入场景：' + s.title); }}
              className="p-2.5 rounded-lg border border-border/50 bg-card hover:border-primary/40 hover:shadow-sm cursor-pointer transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <Badge v="outline" c="text-[10px]">{s.category}</Badge>
                  <span className="text-[10px] text-muted-foreground font-mono">#{s.id.slice(-2)}</span>
                </div>
                <h4 className="text-xs font-semibold group-hover:text-primary transition-colors leading-tight mb-1">{s.title}</h4>
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{s.brief}</p>
              </div>
              <div className="mt-2 text-[10px] text-primary flex items-center gap-1 font-medium">
                <Sparkles className="size-3" /> 一键载入此场景
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// ========== 项目管理 Hook & 基础组件 ==========
export function usePM<T extends { id: string; title?: string }>(k: string, ak: string) {
  const [list, setList] = useState<T[]>(() => lsGet<T[]>(k, []));
  const [aid, setAid] = useState<string>(() => lsGet<string>(ak, ''));
  useEffect(() => { lsSet(k, list); }, [list, k]);
  useEffect(() => { lsSet(ak, aid); }, [aid, ak]);
  const active = useMemo(() => list.find(p => p.id === aid) || null, [list, aid]);
  return { list, setList, aid, setAid, active };
}

export const B = ({ c, children, variant = 'default', size = 'sm', ...p }: any) => {
  const va: any = { default: 'bg-primary text-primary-foreground hover:bg-primary/90', outline: 'border border-border/60 bg-background hover:bg-accent/50', ghost: 'hover:bg-accent/50 text-muted-foreground' };
  const sz: any = { sm: 'h-8 px-3 text-xs', icon: 'h-8 w-8' };
  return <button className={cn('inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50 disabled:pointer-events-none cursor-pointer', va[variant], sz[size], c)} {...p}>{children}</button>;
};

export const Badge = ({ c, children, v = 'default' }: any) => {
  const vs: any = { default: 'bg-primary/10 text-primary', outline: 'border border-border/60 text-foreground/70', amber: 'bg-amber-100 text-amber-800 border border-amber-200', green: 'bg-green-100 text-green-800 border border-green-200', red: 'bg-red-100 text-red-700 border border-red-200' };
  return <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md', vs[v], c)}>{children}</span>;
};

export const Card = ({ c, children }: any) => <div className={cn('rounded-lg border border-border/40 bg-card shadow-sm', c)}>{children}</div>;
export const Input = ({ c, ...p }: any) => <input className={cn('w-full h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/30', c)} {...p} />;
export const TA = ({ value, onChange, c, ...p }: any) => <textarea value={value} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange?.(e.target.value)} className={cn('w-full px-3 py-2 text-sm rounded-md border border-input bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring/30', c)} {...p} />;

export const Modal = ({ t, children, onClose, w }: any) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs" onClick={onClose}>
    <div className={cn('w-full bg-card rounded-xl shadow-2xl max-h-[88vh] flex flex-col border border-border/60', w || 'max-w-md')} onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">{t}</h3>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-accent text-muted-foreground cursor-pointer" aria-label="关闭"><X className="size-4" /></button>
      </div>
      <div className="p-4 overflow-y-auto flex-1">{children}</div>
    </div>
  </div>
);

export function ProjModal({ open, onClose, list, aid, setAid, onNew, onDel, onRen, Icon, sub, npn, setNpn, renOpen, setRenOpen }: any) {
  if (!open) return null;
  return (
    <Modal t="项目管理" onClose={onClose}>
      <div className="flex gap-2 mb-3">
        <Input value={npn} onChange={(e: ChangeEvent<HTMLInputElement>) => setNpn(e.target.value)} placeholder="新项目名称" />
        <B onClick={onNew}><Plus className="size-3.5" />新建</B>
      </div>
      {!list.length && <p className="text-xs text-muted-foreground text-center py-4">暂无项目，请新建</p>}
      <div className="space-y-1 max-h-[50vh] overflow-y-auto">
        {list.map((p: any) => (
          <div key={p.id} className={cn('p-2.5 rounded-lg flex items-center gap-2 cursor-pointer transition-colors', p.id === aid ? 'bg-primary/10 border border-primary/20' : 'hover:bg-accent/50 border border-transparent')} onClick={() => { setAid(p.id); onClose(); }}>
            <Icon className="size-4 text-muted-foreground shrink-0" />
            <span className="flex-1 truncate text-sm font-medium">{p.title || '未命名'}</span>
            <span className="text-[10px] text-muted-foreground">{typeof sub === 'function' ? sub(p) : sub}</span>
            <button onClick={(e: MouseEvent) => { e.stopPropagation(); setNpn(p.title || ''); setAid(p.id); setRenOpen(true); }} className="p-1 hover:bg-accent rounded text-muted-foreground" aria-label="重命名"><Edit3 className="size-3.5" /></button>
            <button onClick={(e: MouseEvent) => { e.stopPropagation(); onDel(p.id); }} className="p-1 hover:bg-red-100 rounded text-red-500" aria-label="删除项目"><Trash2 className="size-3.5" /></button>
          </div>
        ))}
      </div>
      {renOpen && (
        <Modal t="重命名项目" onClose={() => setRenOpen(false)}>
          <Input value={npn} onChange={(e: ChangeEvent<HTMLInputElement>) => setNpn(e.target.value)} />
          <div className="flex justify-end gap-2 mt-3">
            <B variant="outline" onClick={() => setRenOpen(false)}>取消</B>
            <B onClick={onRen}>确定</B>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
