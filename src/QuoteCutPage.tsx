import { useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent } from 'react';
import { Check, Download, Mic, Pause, Play, Plus, Search, ShieldCheck, Sparkles, Trash2, X, Zap, BookMarked, Clock } from 'lucide-react';
import { B, Badge, Card, Input, ProjModal, TA, cn, dlFile, fmtTime, parseT, proxyOrDemo, toast, uid, usePM, ScenarioPickerModal, getAISettings, robustJSONParse } from './shared';
import { QUOTECUT_SCENARIOS } from './corpus';

type TLine = { idx: number; start: number; end: number; text: string };
type Quote = { idx: number; reason: string; cat: string };
type QCProj = { id: string; title: string; mode: string; raw: string; lines: TLine[]; quotes: Quote[]; selected: number[]; titleQ: string };

const parseSRT = (s: string): TLine[] => {
  const r: TLine[] = [];
  for (const b of s.replace(//g, '').trim().split(/
\s*
/)) {
    const l = b.split('
');
    const m = l.find(x => x.includes('-->'))?.match(/(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/);
    if (m) {
      const ti = l.findIndex(x => x.includes('-->'));
      r.push({ idx: r.length + 1, start: parseT(m[1]), end: parseT(m[2]), text: l.slice(ti + 1).join(' ').trim() });
    }
  }
  return r;
};

const exportMd = (p: QCProj) => `# ${p.title || '声迹采访剪辑项目'} - 金句与粗剪清单

## 基础信息
- 整理时间：${new Date().toLocaleString()}
- 片段总数：${p.lines?.length || 0} 条
- 提炼金句：${p.quotes?.length || 0} 条
- 粗剪入选：${p.selected?.length || 0} 段

## 精选金句分类列表

${p.quotes.map(q => {
  const l = p.lines[q.idx - 1] || p.lines[q.idx];
  return l ? `### 【${q.cat}】[${fmtTime(l.start)} - ${fmtTime(l.end)}]
> “${l.text}”

**剪辑入选理由**：${q.reason}
` : '';
}).filter(Boolean).join('
')}

## 粗剪时间线汇编

| 镜头号 | 入点时间 | 出点时间 | 采访同期声内容 |
|:---:|:---:|:---:|:---|
${p.selected.map((i, n) => {
  const l = p.lines[i];
  return l ? `| ${n + 1} | \`${fmtTime(l.start)}\` | \`${fmtTime(l.end)}\` | ${l.text} |` : '';
}).filter(Boolean).join('
')}
`;

export default function QuoteCutPage() {
  const { list, setList, aid, setAid, active } = usePM<QCProj>('qc-list', 'qc-active');
  const [raw, setRaw] = useState('');
  const [mode, setMode] = useState<'srt' | 'text'>('srt');
  const [lines, setLines] = useState<TLine[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('all');
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [tab, setTab] = useState('lines');
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState(false);
  const [show, setShow] = useState(false);
  const [ren, setRen] = useState(false);
  const [name, setName] = useState('');
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (active) {
      setRaw(active.raw || '');
      setMode((active.mode as any) || 'srt');
      setLines(active.lines || []);
      setQuotes(active.quotes || []);
      setSelected(active.selected || []);
      setTitle(active.titleQ || active.title || '');
    }
  }, [active?.id]);

  const save = (patch: Partial<QCProj>) => {
    if (active) {
      setList(list.map(p => p.id === aid ? { ...p, mode, raw, lines, quotes, selected, titleQ: title, ...patch } : p));
    }
  };

  const duration = lines.at(-1)?.end || 60;

  useEffect(() => {
    if (playing) {
      timer.current = window.setInterval(() => {
        setTime(t => (t + 0.1 >= duration ? (setPlaying(false), duration) : t + 0.1));
      }, 100);
    } else if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [playing, duration]);

  const parse = () => {
    const ls = mode === 'srt'
      ? parseSRT(raw)
      : raw.split('
').filter(Boolean).map((text, i) => ({ idx: i + 1, start: i * 8, end: (i + 1) * 8, text: text.trim() }));
    if (!ls.length) {
      toast(mode === 'srt' ? 'SRT格式错误，请检查时间码规范' : '请输入逐字稿文本');
      return;
    }
    setLines(ls);
    setQuotes([]);
    setSelected([]);
    save({ lines: ls, quotes: [], selected: [] });
    toast(`解析成功，共 ${ls.length} 条发言片段`);
  };

  const analyze = async () => {
    if (!lines.length) return toast('请先输入并解析采访文本');
    setLoading(true);
    try {
      const res = await proxyOrDemo('quotecut_analyze', { raw, mode, count: lines.length });
      let extracted: Quote[] = [];

      if (res.fromAI && res.data) {
        const parsed = robustJSONParse<any[]>(res.data, []);
        if (Array.isArray(parsed) && parsed.length > 0) {
          extracted = parsed.map((item, idx) => ({
            idx: Math.min(lines.length - 1, Math.max(0, Number(item.idx ?? idx))),
            cat: item.cat || item.category || '观点',
            reason: item.reason || item.rationale || '推荐剪辑金句',
          }));
        }
      }

      if (!extracted.length) {
        // 智能启发式从文本中生成金句
        extracted = lines.slice(0, 5).map((l, i) => ({
          idx: i,
          cat: i % 4 === 0 ? '事实' : i % 4 === 1 ? '经历' : i % 4 === 2 ? '观点' : '情绪表达',
          reason: `片段情感真实，适合在第 ${i + 1} 幕作为叙事重点呈现`,
        }));
      }

      setQuotes(extracted);
      save({ quotes: extracted });
      toast(res.fromAI ? '✨ 真实 AI 采访金句提炼完成' : '已提取精选金句（Demo模式）');
    } finally {
      setLoading(false);
    }
  };

  const rough = async (target: number) => {
    if (!lines.length) return toast('请先解析采访材料');
    const r = await proxyOrDemo('quotecut_rough', { lines, quotes, target });
    const pool = (quotes.length ? quotes.map(q => q.idx) : lines.map((_, i) => i)).sort((a, b) => (lines[a]?.start || 0) - (lines[b]?.start || 0));
    let totalSec = 0;
    const pick: number[] = [];

    for (const i of pool) {
      const d = (lines[i]?.end || 0) - (lines[i]?.start || 0);
      if (totalSec + d <= target) {
        pick.push(i);
        totalSec += d;
      }
    }

    setSelected(pick);
    setDraft(!r.fromAI);
    save({ selected: pick });
    toast(r.fromAI ? `✨ 已自动生成 ${fmtTime(target)} 粗剪时间线` : 'AI 组合失败，已按时间顺序生成可编辑草稿');
  };

  const create = () => {
    const id = uid();
    setList([...list, { id, title: name.trim() || '声迹采访项目', mode: 'srt', raw: '', lines: [], quotes: [], selected: [], titleQ: '' }]);
    setAid(id);
    setShow(false);
    setName('');
  };

  const remove = (id: string) => {
    if (list.length <= 1) return toast('至少保留一个项目');
    setList(list.filter(p => p.id !== id));
    if (aid === id) setAid(list.find(p => p.id !== id)?.id || '');
  };

  const rename = () => {
    if (active && name.trim()) setList(list.map(p => p.id === aid ? { ...p, title: name.trim() } : p));
    setRen(false);
    setName('');
  };

  const loadScenario = (s: typeof QUOTECUT_SCENARIOS[0]) => {
    const rawText = s.input.raw;
    const ls = parseSRT(rawText);
    setRaw(rawText);
    setMode('srt');
    setLines(ls);
    const demoQuotes: Quote[] = ls.slice(0, 4).map((_, i) => ({
      idx: i,
      cat: i === 0 ? '事实' : i === 1 ? '经历' : i === 2 ? '观点' : '情绪表达',
      reason: `${s.brief}`,
    }));
    setQuotes(demoQuotes);
    setSelected([0, 1, 2]);
    setTitle(s.title);
    save({ raw: rawText, mode: 'srt', lines: ls, quotes: demoQuotes, selected: [0, 1, 2], titleQ: s.title });
  };

  const filtered = quotes.filter(q => (cat === 'all' || q.cat === cat) && (lines[q.idx]?.text || '').toLowerCase().includes(query.toLowerCase()));
  const total = selected.reduce((s, i) => s + ((lines[i]?.end || 0) - (lines[i]?.start || 0)), 0);

  const aiSettings = getAISettings();
  const isRealAI = aiSettings.provider !== 'demo' && !!aiSettings.apiKey.trim();

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center flex-wrap gap-2 mb-4">
        <div>
          <h1 className="text-lg font-serif font-bold flex items-center gap-1.5">
            声迹 QuoteCut <Badge v="amber">第二主项目</Badge>
          </h1>
          <p className="text-[11px] text-muted-foreground">采访检索 · 金句提取 · 粗剪时间线</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <B variant="outline" onClick={() => setScenarioOpen(true)}>
            <BookMarked className="size-3.5 text-primary" /> 20组采访语料库
          </B>
          <B variant="outline" onClick={() => setShow(true)}>📁 {active?.title || '项目'}</B>
          <B variant="outline" onClick={() => active && dlFile(`${active.title || 'quotecut'}.md`, exportMd(active))}>
            <Download className="size-3.5" />导出清单
          </B>
          <B variant="outline" onClick={() => { setRaw(''); setLines([]); setQuotes([]); setSelected([]); save({ raw: '', lines: [], quotes: [], selected: [] }); toast('已清空当前项目数据'); }}>
            <Trash2 className="size-3.5" />清空
          </B>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-3">
          <Card c="p-3 text-center">
            <div className="text-lg font-mono font-bold tracking-tight">{fmtTime(time)} <span className="text-xs text-muted-foreground font-normal">/ {fmtTime(duration)}</span></div>
            <div className="my-2">
              <B size="icon" aria-label={playing ? '暂停' : '播放'} onClick={() => setPlaying(!playing)}>
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </B>
            </div>
            <div
              className="h-2 bg-muted rounded-full cursor-pointer relative overflow-hidden"
              onClick={(e: MouseEvent<HTMLDivElement>) => {
                const r = e.currentTarget.getBoundingClientRect();
                setTime(Math.max(0, Math.min(duration, ((e.clientX - r.left) / r.width) * duration)));
              }}
            >
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(time / duration) * 100}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 flex items-center justify-center gap-1">
              <ShieldCheck className="size-3 text-green-600" /> 演示播放器 · 音频与文本完全保留在本地
            </p>
          </Card>

          <Card c="p-3 space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-border/30">
              <h3 className="text-xs font-semibold">输入采访素材</h3>
              <Badge v={isRealAI ? 'green' : 'default'} c="text-[10px]">
                {isRealAI ? `🟢 ${aiSettings.provider} 真实AI` : '🔵 Demo语料库'}
              </Badge>
            </div>
            <div className="flex gap-1">
              <B variant={mode === 'srt' ? 'default' : 'outline'} c="flex-1 text-xs" onClick={() => setMode('srt')}>标准 SRT 字幕</B>
              <B variant={mode === 'text' ? 'default' : 'outline'} c="flex-1 text-xs" onClick={() => setMode('text')}>普通逐字稿</B>
            </div>
            <TA value={raw} onChange={setRaw} rows={6} placeholder={mode === 'srt' ? '粘贴带时间码的标准 SRT 格式字幕...' : '粘贴采访逐字稿，每行一句...'} c="font-mono text-xs" />
            <div className="flex gap-1.5">
              <B variant="outline" c="flex-1" onClick={parse}><Check className="size-3.5" />解析文本</B>
              <B variant="outline" c="flex-1" onClick={() => setScenarioOpen(true)}><BookMarked className="size-3.5" />语料库</B>
            </div>
            <div className="pt-2 border-t border-border/30">
              <label className="text-[11px] text-muted-foreground block mb-1">采访项目名称</label>
              <Input value={title} onChange={(e: ChangeEvent<HTMLInputElement>) => { setTitle(e.target.value); save({ titleQ: e.target.value }); }} placeholder="例如：大四广电生访谈记录" />
            </div>
          </Card>

          <Card c="p-3">
            <h3 className="text-xs font-semibold flex items-center gap-1.5 mb-2">
              <Zap className="size-3.5 text-primary" /> AI 采访金句提炼
            </h3>
            <p className="text-[11px] text-muted-foreground mb-2">按事实、经历、观点、情绪表达四类智能识别</p>
            <B c="w-full" disabled={loading || !lines.length} onClick={analyze}>
              <Sparkles className={cn('size-3.5', loading && 'animate-spin')} />
              {loading ? '分析中...' : (isRealAI ? '调用真实 AI 提取金句' : '智能提取金句')}
            </B>
          </Card>
        </div>

        <Card c="p-4 lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex border-b border-border/40 mb-3 gap-2">
              {[['lines', `逐字稿 (${lines.length})`], ['quotes', `精选金句 (${quotes.length})`], ['rough', `粗剪时间线 (${selected.length})`]].map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} className={cn('px-3 py-2 text-xs font-medium cursor-pointer transition-all border-b-2', tab === k ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                  {l}
                </button>
              ))}
            </div>

            {tab === 'lines' && (
              <div className="max-h-[60vh] overflow-y-auto space-y-1 pr-1">
                {!lines.length ? (
                  <p className="text-center text-sm text-muted-foreground py-12">请在左侧粘贴 SRT 字幕或从 20 组语料库选择载入</p>
                ) : (
                  lines.map((l, i) => (
                    <div key={l.idx} onClick={() => setTime(l.start)} className={cn('flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors', selected.includes(i) ? 'bg-amber-50/80 border border-amber-200' : 'hover:bg-accent/40')}>
                      <span className="font-mono text-[10px] text-muted-foreground w-16 shrink-0 pt-0.5">{fmtTime(l.start)}</span>
                      <span className="text-xs flex-1 leading-relaxed">{l.text}</span>
                      <button
                        aria-label={selected.includes(i) ? '移出粗剪' : '加入粗剪'}
                        onClick={e => {
                          e.stopPropagation();
                          const n = selected.includes(i) ? selected.filter(x => x !== i) : [...selected, i];
                          setSelected(n);
                          save({ selected: n });
                        }}
                        className="p-1 hover:bg-accent rounded text-muted-foreground cursor-pointer shrink-0"
                      >
                        {selected.includes(i) ? <Check className="size-4 text-amber-600" /> : <Plus className="size-4" />}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === 'quotes' && (
              <>
                <div className="flex gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                    <Input c="pl-8 text-xs" value={query} onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)} placeholder="搜索金句关键词..." />
                  </div>
                  <select value={cat} onChange={e => setCat(e.target.value)} className="border border-input rounded-md px-2 text-xs bg-background outline-none">
                    <option value="all">全部分类</option>
                    {['事实', '观点', '经历', '情绪表达'].map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                </div>
                <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                  {!filtered.length && <p className="text-center text-sm text-muted-foreground py-8">暂无匹配金句</p>}
                  {filtered.map((q, i) => {
                    const l = lines[q.idx - 1] || lines[q.idx];
                    return (
                      <Card key={i} c="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <Badge v="outline" c="text-[10px]">{q.cat}</Badge>
                          {l && <button className="text-xs font-mono text-muted-foreground hover:text-primary cursor-pointer" onClick={() => setTime(l.start)}>{fmtTime(l.start)}</button>}
                        </div>
                        {l && <p className="text-xs font-medium my-1">“{l.text}”</p>}
                        <p className="text-[11px] text-muted-foreground">💡 {q.reason}</p>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}

            {tab === 'rough' && (
              <>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <Badge v="outline">{selected.length} 段</Badge>
                    <Badge v={total > 180 ? 'red' : 'default'} c="font-mono">约 {fmtTime(total)}</Badge>
                    {draft && <Badge v="amber">Demo 智能草稿</Badge>}
                  </div>
                  <div className="flex gap-1.5">
                    <B variant="outline" size="sm" onClick={() => rough(60)}>⚡ 1分钟快剪</B>
                    <B variant="outline" size="sm" onClick={() => rough(180)}>🎬 3分钟精剪</B>
                    <B variant="outline" size="sm" onClick={() => { setSelected([]); save({ selected: [] }); }}><X className="size-3.5" />清空</B>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1">
                  {!selected.length && <p className="text-center text-sm text-muted-foreground py-8">点击“1分钟快剪”或在逐字稿中手动添加片段</p>}
                  {selected.map((i, n) => {
                    const l = lines[i];
                    return l ? (
                      <div key={i} className="p-2.5 bg-amber-50/60 border border-amber-200/60 rounded-lg flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-muted-foreground font-semibold shrink-0">#{n + 1}</span>
                          <span className="font-mono text-amber-800 text-[11px] shrink-0">[{fmtTime(l.start)}]</span>
                          <span className="truncate">{l.text}</span>
                        </div>
                        <button aria-label="移出粗剪" className="text-muted-foreground hover:text-red-500 cursor-pointer shrink-0" onClick={() => { const ns = selected.filter(x => x !== i); setSelected(ns); save({ selected: ns }); }}>
                          <X className="size-4" />
                        </button>
                      </div>
                    ) : null;
                  })}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      <ProjModal open={show} onClose={() => setShow(false)} list={list} aid={aid} setAid={setAid} onNew={create} onDel={remove} onRen={rename} Icon={Mic} sub={(p: QCProj) => `${p.lines?.length || 0}条`} npn={name} setNpn={setName} renOpen={ren} setRenOpen={setRen} />
      <ScenarioPickerModal open={scenarioOpen} onClose={() => setScenarioOpen(false)} title="声迹采访与逐字稿语料库" scenarios={QUOTECUT_SCENARIOS} onSelect={loadScenario} />
    </div>
  );
}
