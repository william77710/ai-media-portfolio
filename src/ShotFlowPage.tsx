import { useState, useMemo, useEffect, type DragEvent, type ChangeEvent } from 'react';
import { Film, Sparkles, Plus, Trash2, Edit3, Download, GripVertical, Lock, Unlock, Clock, Save, Eye, History, BookMarked, AlertTriangle } from 'lucide-react';
import { usePM, uid, cn, B, Badge, Card, Input, TA, Modal, ProjModal, dlFile, proxyOrDemo, toast, ScenarioPickerModal, getAISettings, robustJSONParse } from './shared';
import { SHOTFLOW_SCENARIOS } from './corpus';

export type Shot = {
  id: string;
  n: number;
  dur: number;
  st: string;
  cam: string;
  desc: string;
  act: string;
  vo: string;
  sub: string;
  audio: string;
  tr: string;
  prompt: string;
  locked?: boolean;
};

export type SFProj = {
  id: string;
  title: string;
  brief: { topic: string; platform: string; duration: number; audience: string; type: string; text: string };
  shots: Shot[];
  versions: { id: string; name: string; ts: number; shots: Shot[] }[];
};

const SF_BASE_DEMO: Shot[] = [
  { id: 's1', n: 1, dur: 5, st: '全景', cam: '固定机位', desc: '清晨薄雾笼罩古镇河面，石板路向远方延伸', act: '空镜，晨光初现', vo: '这是一座依水而建的江南古镇。', sub: '清晨 6:00 · 古镇', audio: '流水声 + 鸟鸣清脆', tr: '淡入', prompt: 'ancient chinese town river morning mist, cinematic wide shot' },
  { id: 's2', n: 2, dur: 8, st: '中景', cam: '跟拍', desc: '青年创作者背着包推门走进工作室', act: '推开木门，在工作台前坐下开机', vo: '作为广电专业大四学生，小李正在用AI探索毕业创作。', sub: '创作者工作日常', audio: '推门吱呀声 + 键盘敲击声渐入', tr: '切', prompt: 'young creator entering cozy studio, morning light, medium shot' },
  { id: 's3', n: 3, dur: 10, st: '近景', cam: '过肩镜头', desc: '电脑屏幕显示AI辅助脚本与分镜生成界面', act: '快速输入提示词，查看生成的结构化分镜', vo: '以往耗费两三天的案头分镜，现在几分钟就能推演初版。', sub: 'AI辅助设计 · 效率提速', audio: '轻快科技感背景音乐', tr: '叠化', prompt: 'over shoulder view of computer screen with AI interface, close up' },
  { id: 's4', n: 4, dur: 7, st: '特写', cam: '固定', desc: '创作者对照分镜表在纸上做红色标注与细节修改', act: '手持红笔圈画，神情专注', vo: '但AI只是助手，真正对视听语言与审美把关的还是人。', sub: '人工审核 · 细节把关', audio: '笔尖书写沙沙声', tr: '切', prompt: 'close up of hands marking notes on storyboard paper with red pen' },
  { id: 's5', n: 5, dur: 12, st: '全景', cam: '无人机航拍拉升', desc: '夕阳洒在古镇河流与现代城市交界处', act: '镜头缓缓拉高，展现传统与现代交融', vo: '技术在演进，不变的是对真实世界与好故事的热爱。', sub: '尾声 · 走向未来', audio: '温暖抒情音乐推向高潮', tr: '淡出', prompt: 'aerial sunset view of ancient town river merging into modern city' },
];

const expCSV = (shots: Shot[], name: string) => {
  const h = '镜头号,时长(秒),景别,机位,画面描述,人物动作,旁白台词,字幕花字,音效配乐,转场,AI生图提示词';
  const r = shots.map(s => [s.n, s.dur, s.st, s.cam, s.desc, s.act, s.vo, s.sub, s.audio, s.tr, s.prompt].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
  dlFile(`${name}.csv`, '\ufeff' + h + '
' + r.join('
'), 'text/csv');
};

const expShoot = (shots: Shot[], name: string) => {
  const md = `# ${name} - 拍摄清单与场记表

## 拍摄基础信息
- 镜头总数：${shots.length} 镜
- 预估成片时长：${shots.reduce((s, x) => s + x.dur, 0)} 秒
- 导出时间：${new Date().toLocaleString()}

## 镜头执行清单

${shots.map(s => `### 镜头 ${s.n} · 【${s.st}】${s.cam}（${s.dur}秒）
- **画面**：${s.desc}
- **动作**：${s.act}
- **旁白/台词**：${s.vo || '无'}
- **字幕**：${s.sub || '无'}
- **声音**：${s.audio || '现场原声'}
- **转场**：${s.tr}
- **Prompt**：\`${s.prompt}\`
- [ ] 拍摄完成 / [ ] 备选素材确认
`).join('
')}`;
  dlFile(`${name}-拍摄清单.md`, md);
};

function mergeLocked(locked: Shot[], newGenerated: Shot[], targetTotal: number): Shot[] {
  const count = Math.max(targetTotal, ...locked.map(s => s.n), locked.length, newGenerated.length);
  const result: Shot[] = [];
  const lockedByN = new Map(locked.map(s => [s.n, s]));
  let newIdx = 0;

  for (let i = 1; i <= count; i++) {
    if (lockedByN.has(i)) {
      result.push({ ...lockedByN.get(i)!, n: i });
    } else {
      const src = newGenerated[newIdx % newGenerated.length] || SF_BASE_DEMO[newIdx % SF_BASE_DEMO.length];
      result.push({ ...src, id: uid(), n: i });
      newIdx++;
    }
  }
  return result;
}

function ShotCard({ s, onEdit, onLock, onDel, onRegen, onDS, onDO, onDr, loading }: any) {
  return (
    <div
      draggable
      onDragStart={(e: DragEvent) => onDS(e, s.id)}
      onDragOver={(e: DragEvent) => onDO(e)}
      onDrop={(e: DragEvent) => onDr(e, s.id)}
      className={cn('p-3 rounded-lg border transition-all', s.locked ? 'border-green-400 bg-green-50/50' : 'border-border/50 bg-card hover:border-primary/40', loading === s.id && 'opacity-60')}
    >
      <div className="flex items-start gap-2.5">
        <div className="cursor-move text-muted-foreground/40 hover:text-foreground pt-1" title="按住拖拽排序">
          <GripVertical className="size-4" />
        </div>
        <div className="w-7 h-7 shrink-0 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-bold font-mono">
          {s.n}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <Badge v="outline" c="text-[10px]">{s.st || '中景'}</Badge>
            <Badge v="outline" c="text-[10px]">{s.cam || '固定'}</Badge>
            <Badge v="outline" c="text-[10px] font-mono">{s.dur}s</Badge>
            {s.locked && <Badge v="green" c="text-[10px]"><Lock className="size-2.5" />锁定保真</Badge>}
          </div>
          <div className="text-xs font-medium leading-snug">{s.desc}</div>
          {s.act && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">🎭 动作：{s.act}</div>}
          {s.vo && <div className="text-[11px] text-primary/80 mt-0.5 line-clamp-1">🎙 旁白：{s.vo}</div>}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => onRegen(s.id)} className="p-1 rounded hover:bg-accent text-primary cursor-pointer" title="重新生成本镜头" aria-label="重新生成本镜头">
            <Sparkles className="size-3.5" />
          </button>
          <button onClick={() => onLock(s.id)} className="p-1 rounded hover:bg-accent cursor-pointer" title={s.locked ? '解锁' : '锁定保留'} aria-label={s.locked ? '解锁镜头' : '锁定镜头'}>
            {s.locked ? <Unlock className="size-3.5 text-green-600" /> : <Lock className="size-3.5 text-muted-foreground" />}
          </button>
          <button onClick={() => onEdit(s.id)} className="p-1 rounded hover:bg-accent text-muted-foreground cursor-pointer" title="编辑镜头细节" aria-label="编辑镜头">
            <Edit3 className="size-3.5" />
          </button>
          <button onClick={() => onDel(s.id)} className="p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-500 cursor-pointer" disabled={s.locked} title="删除镜头" aria-label="删除镜头">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      {loading === s.id && <div className="mt-2 text-[10px] text-primary flex items-center gap-1"><Sparkles className="size-3 animate-spin" />正在重新设计本镜头视听参数...</div>}
    </div>
  );
}

export default function ShotFlowPage() {
  const { list, setList, aid, setAid, active } = usePM<SFProj>('gh-sf-list', 'gh-sf-active');
  const [brief, setBrief] = useState({ topic: '', platform: '抖音', duration: 60, audience: '', type: 'vlog', text: '' });
  const [shots, setShots] = useState<Shot[]>(active?.shots || []);
  const [loading, setLoading] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [showP, setShowP] = useState(false);
  const [showV, setShowV] = useState(false);
  const [showC, setShowC] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [cmpV1, setCmpV1] = useState('curr');
  const [cmpV2, setCmpV2] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [npn, setNpn] = useState('');
  const [renO, setRenO] = useState(false);
  const [vn, setVn] = useState('');

  useEffect(() => {
    if (active) {
      setBrief(active.brief || { topic: '', platform: '抖音', duration: 60, audience: '', type: 'vlog', text: '' });
      setShots(active.shots || []);
    }
  }, [active?.id]);

  const save = (sh: Shot[], b = brief) => {
    setShots(sh);
    if (active) setList(list.map(p => p.id === aid ? { ...p, brief: b, shots: sh } : p));
  };

  const updB = (k: string, v: unknown) => {
    const nb = { ...brief, [k]: v };
    setBrief(nb);
    if (active) setList(list.map(p => p.id === aid ? { ...p, brief: nb } : p));
  };

  const total = useMemo(() => shots.reduce((s, x) => s + (x.dur || 0), 0), [shots]);
  const max = brief.duration || 60;
  const over = total > max;

  const newP = () => {
    const id = uid();
    const t = npn.trim() || '未命名分镜项目';
    setList([...list, { id, title: t, brief: { topic: '', platform: '抖音', duration: 60, audience: '', type: 'vlog', text: '' }, shots: [], versions: [] }]);
    setAid(id);
    setShowP(false);
    setNpn('');
  };

  const delP = (id: string) => {
    if (list.length <= 1) return toast('至少保留一个项目');
    setList(list.filter(p => p.id !== id));
    if (aid === id) setAid(list.find(p => p.id !== id)?.id || '');
  };

  const renP = () => {
    if (!active || !npn.trim()) return;
    setList(list.map(p => p.id === aid ? { ...p, title: npn.trim() } : p));
    setRenO(false);
    setNpn('');
  };

  const genAll = async () => {
    const d = Number(brief.duration);
    if (!Number.isInteger(d) || d < 15) {
      toast('目标时长必须为不小于 15 秒的正整数');
      return;
    }
    if (!brief.topic.trim()) {
      toast('请先填写视频主题');
      return;
    }

    setLoading('all');
    try {
      const res = await proxyOrDemo('shotflow_generate', { ...brief, duration: d });
      let generatedShots: Shot[] = SF_BASE_DEMO;

      if (res.fromAI && res.data) {
        const parsed = robustJSONParse<any[]>(res.data, []);
        if (Array.isArray(parsed) && parsed.length > 0) {
          generatedShots = parsed.map((item, idx) => ({
            id: uid(),
            n: idx + 1,
            dur: item.dur || item.duration || 5,
            st: item.st || item.shotSize || '中景',
            cam: item.cam || item.camera || '固定',
            desc: item.desc || item.description || '画面描述',
            act: item.act || item.action || '',
            vo: item.vo || item.voiceover || item.narration || '',
            sub: item.sub || item.subtitle || '',
            audio: item.audio || item.sound || '原声',
            tr: item.tr || item.transition || '切',
            prompt: item.prompt || item.aiPrompt || '',
          }));
        }
      }

      const locked = shots.filter(s => s.locked);
      const merged = mergeLocked(locked, generatedShots, Math.max(5, Math.ceil(d / 8)));
      save(merged);
      toast(res.fromAI ? '✨ 真实 AI 分镜脚本已生成' : '已载入结构化分镜方案（Demo模式）');
    } finally {
      setLoading(null);
    }
  };

  const genOne = async (id: string) => {
    setLoading(id);
    try {
      const idx = shots.findIndex(s => s.id === id);
      if (idx < 0) return;
      const res = await proxyOrDemo('shotflow_regenerate', { shotId: id, currentShot: shots[idx], brief });
      let updatedShot = { ...shots[idx] };

      if (res.fromAI && res.data) {
        const parsed = robustJSONParse<any>(res.data, null);
        if (parsed && typeof parsed === 'object') {
          updatedShot = { ...updatedShot, ...parsed };
        }
      } else {
        const demo = SF_BASE_DEMO[idx % SF_BASE_DEMO.length];
        updatedShot = { ...updatedShot, desc: demo.desc + '（AI重生成）', vo: demo.vo, act: demo.act, prompt: demo.prompt };
      }

      const ns = [...shots];
      ns[idx] = updatedShot;
      save(ns);
      toast('本镜头视听方案已刷新');
    } finally {
      setLoading(null);
    }
  };

  const delShot = (id: string) => save(shots.filter(s => s.id !== id).map((s, i) => ({ ...s, n: i + 1 })));
  const addShot = () => save([...shots, { id: uid(), n: shots.length + 1, dur: 5, st: '中景', cam: '固定', desc: '新镜头描述...', act: '', vo: '', sub: '', audio: '环境音', tr: '切', prompt: '' }]);
  const toggleLock = (id: string) => save(shots.map(s => s.id === id ? { ...s, locked: !s.locked } : s));

  const onDS = (_e: DragEvent, id: string) => { setDragId(id); };
  const onDO = (e: DragEvent) => { e.preventDefault(); };
  const onDr = (_e: DragEvent, tgt: string) => {
    if (!dragId || dragId === tgt) return;
    const si = shots.findIndex(s => s.id === dragId), ti = shots.findIndex(s => s.id === tgt);
    const ns = [...shots];
    const [m] = ns.splice(si, 1);
    ns.splice(ti, 0, m);
    save(ns.map((s, i) => ({ ...s, n: i + 1 })));
    setDragId(null);
  };

  const updShot = (id: string, k: string, v: unknown) => {
    if (k === 'dur') {
      const n = Number(v);
      if (!Number.isInteger(n) || n <= 0) return;
      save(shots.map(s => s.id === id ? { ...s, dur: n } : s));
    } else {
      save(shots.map(s => s.id === id ? { ...s, [k]: v } : s));
    }
  };

  const saveVer = () => {
    if (!active || !vn.trim()) return;
    const v = { id: uid(), name: vn.trim(), ts: Date.now(), shots: JSON.parse(JSON.stringify(shots)) };
    setList(list.map(p => p.id === aid ? { ...p, versions: [...(p.versions || []), v] } : p));
    setVn('');
    setShowV(false);
    toast(`已保存版本：${v.name}`);
  };

  const loadScenario = (s: typeof SHOTFLOW_SCENARIOS[0]) => {
    const nb = { topic: s.input.topic, platform: s.input.platform, duration: s.input.duration, audience: s.input.audience, type: s.input.type, text: s.input.text };
    setBrief(nb);
    const demoShots = SF_BASE_DEMO.map((x, i) => ({ ...x, id: uid(), n: i + 1, desc: `${s.title} - ${x.desc}` }));
    save(demoShots, nb);
  };

  const cmpRes = useMemo(() => {
    if (!active) return { a: 0, d: 0, m: 0, u: 0 };
    const s1: Shot[] = cmpV1 === 'curr' ? shots : (active.versions?.find(v => v.id === cmpV1)?.shots || []);
    const s2: Shot[] = cmpV2 === 'curr' ? shots : (active.versions?.find(v => v.id === cmpV2)?.shots || []);
    if (!s1.length || !s2.length) return { a: 0, d: 0, m: 0, u: 0 };
    let a = 0, d = 0, m = 0, u = 0;
    const m1 = new Map(s1.map(s => [s.n, s])), m2 = new Map(s2.map(s => [s.n, s]));
    m2.forEach((s, n) => {
      if (!m1.has(n)) a++;
      else {
        const o = m1.get(n)!;
        (o.desc !== s.desc || o.dur !== s.dur || o.vo !== s.vo || o.st !== s.st) ? m++ : u++;
      }
    });
    m1.forEach((_, n) => { if (!m2.has(n)) d++; });
    return { a, d, m, u };
  }, [cmpV1, cmpV2, shots, active]);

  if (!active) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <Film className="size-12 mx-auto mb-3 text-purple-300" />
        <h2 className="text-lg font-serif font-bold">镜序 ShotFlow</h2>
        <p className="text-sm text-muted-foreground mb-4">AI 短视频脚本与分镜工作台 · 20组短视频分镜场景</p>
        <B onClick={() => setShowP(true)}><Plus className="size-4" />新建或打开项目</B>
        <ProjModal open={showP} onClose={() => setShowP(false)} list={list} aid={aid} setAid={setAid} onNew={newP} onDel={delP} onRen={renP} Icon={Film} sub={(p: SFProj) => `${p.shots?.length || 0}镜`} npn={npn} setNpn={setNpn} renOpen={renO} setRenOpen={setRenO} />
      </div>
    );
  }

  const aiSettings = getAISettings();
  const isRealAI = aiSettings.provider !== 'demo' && !!aiSettings.apiKey.trim();

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-serif font-bold flex items-center gap-1.5">
            镜序 ShotFlow <Badge v="amber">第一主项目</Badge>
          </h1>
          <p className="text-[11px] text-muted-foreground">AI 短视频脚本与视听分镜工作台</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <B variant="outline" onClick={() => setScenarioOpen(true)}>
            <BookMarked className="size-3.5 text-primary" /> 20组分镜场景
          </B>
          <B variant="outline" onClick={() => setShowP(true)}>📁 {active.title}</B>
          <B variant="outline" onClick={() => setShowV(true)}><History className="size-3.5" />版本 ({active.versions?.length || 0})</B>
          <B variant="outline" onClick={() => setShowC(true)}><Eye className="size-3.5" />对比</B>
          <B variant="outline" onClick={() => expCSV(shots, active.title)}><Download className="size-3.5" />CSV</B>
          <B variant="outline" onClick={() => expShoot(shots, active.title)}>拍摄清单</B>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card c="p-4 space-y-2.5">
          <div className="flex items-center justify-between pb-1 border-b border-border/30">
            <h2 className="text-xs font-semibold">视频 Brief</h2>
            <Badge v={isRealAI ? 'green' : 'default'} c="text-[10px]">
              {isRealAI ? `🟢 ${aiSettings.provider} 真实AI` : '🔵 Demo案例库'}
            </Badge>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block mb-0.5">主题</label>
            <Input value={brief.topic} onChange={(e: ChangeEvent<HTMLInputElement>) => updB('topic', e.target.value)} placeholder="例如：手冲精品咖啡概念宣传片" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-muted-foreground block mb-0.5">平台</label>
              <select value={brief.platform} onChange={(e: ChangeEvent<HTMLSelectElement>) => updB('platform', e.target.value)} className="w-full h-9 px-2 text-xs rounded-md border border-input bg-background outline-none">
                {['抖音', '视频号', 'B站', '小红书', 'YouTube'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground block mb-0.5">体裁</label>
              <select value={brief.type} onChange={(e: ChangeEvent<HTMLSelectElement>) => updB('type', e.target.value)} className="w-full h-9 px-2 text-xs rounded-md border border-input bg-background outline-none">
                {['vlog', '纪录片', '新闻', '产品介绍', '知识科普'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block mb-0.5">目标时长（≥15秒正整数）</label>
            <Input type="number" value={brief.duration} onChange={(e: ChangeEvent<HTMLInputElement>) => updB('duration', Number(e.target.value) || 0)} />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block mb-0.5">已有文字 / 文案</label>
            <TA value={brief.text} onChange={(v: string) => updB('text', v)} rows={3} placeholder="可粘贴文案作为分镜参考..." c="text-xs" />
          </div>
          <B c="w-full" onClick={genAll} disabled={loading === 'all'}>
            <Sparkles className={cn('size-3.5', loading === 'all' && 'animate-spin')} />
            {loading === 'all' ? '生成中...' : (isRealAI ? '调用真实 AI 生成分镜' : '智能生成分镜表')}
          </B>
          <B variant="outline" c="w-full" onClick={() => setScenarioOpen(true)}>
            <BookMarked className="size-3.5" /> 载入 20 组短视频场景案例
          </B>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1 pt-1">
            <Lock className="size-3 text-green-600" /> 锁定的镜头在全量重新生成时保持位置与内容不变。
          </p>
        </Card>

        <div className="lg:col-span-2 space-y-3">
          <Card c="p-3 flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <span className="text-sm font-semibold font-mono">{total}s</span>
              <span className="text-xs text-muted-foreground">/ 目标 {max}s</span>
              <span className="text-xs text-muted-foreground font-mono">（共 {shots.length} 镜）</span>
            </div>
            <div className="flex items-center gap-1.5">
              {over ? <Badge v="red">已超限 {total - max}s</Badge> : total > 0 && <Badge v="green">时长合适</Badge>}
              <B variant="outline" onClick={addShot}><Plus className="size-3.5" />添加镜头</B>
            </div>
          </Card>

          <div className="space-y-2">
            {!shots.length ? (
              <Card c="p-12 text-center text-sm text-muted-foreground">
                <Film className="size-10 mx-auto mb-2 text-muted-foreground/30" />
                暂无分镜数据，点击“智能生成分镜表”或从“20组分镜场景”载入
              </Card>
            ) : (
              shots.map(s => (
                <ShotCard key={s.id} s={s} onEdit={setEditId} onLock={toggleLock} onDel={delShot} onRegen={genOne} onDS={onDS} onDO={onDO} onDr={onDr} loading={loading} />
              ))
            )}
          </div>
        </div>
      </div>

      {editId && (() => {
        const s = shots.find(x => x.id === editId);
        if (!s) return null;
        return (
          <Modal t={`编辑镜头 ${s.n}`} onClose={() => setEditId(null)} w="max-w-lg">
            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">时长(秒)</label>
                  <Input type="number" value={s.dur} onChange={(e: ChangeEvent<HTMLInputElement>) => updShot(s.id, 'dur', e.target.value)} />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">景别</label>
                  <Input value={s.st} onChange={(e: ChangeEvent<HTMLInputElement>) => updShot(s.id, 'st', e.target.value)} />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">机位</label>
                  <Input value={s.cam} onChange={(e: ChangeEvent<HTMLInputElement>) => updShot(s.id, 'cam', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">画面描述</label>
                <TA value={s.desc} onChange={(v: string) => updShot(s.id, 'desc', v)} rows={2} />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">人物动作</label>
                <Input value={s.act} onChange={(e: ChangeEvent<HTMLInputElement>) => updShot(s.id, 'act', e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">旁白 / 对白</label>
                <TA value={s.vo} onChange={(v: string) => updShot(s.id, 'vo', v)} rows={2} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">字幕</label>
                  <Input value={s.sub} onChange={(e: ChangeEvent<HTMLInputElement>) => updShot(s.id, 'sub', e.target.value)} />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">音效</label>
                  <Input value={s.audio} onChange={(e: ChangeEvent<HTMLInputElement>) => updShot(s.id, 'audio', e.target.value)} />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">转场</label>
                  <Input value={s.tr} onChange={(e: ChangeEvent<HTMLInputElement>) => updShot(s.id, 'tr', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">AI 生图 Prompt</label>
                <TA value={s.prompt} onChange={(v: string) => updShot(s.id, 'prompt', v)} rows={2} c="font-mono text-[11px]" />
              </div>
            </div>
          </Modal>
        );
      })()}

      <ProjModal open={showP} onClose={() => setShowP(false)} list={list} aid={aid} setAid={setAid} onNew={newP} onDel={delP} onRen={renP} Icon={Film} sub={(p: SFProj) => `${p.shots?.length || 0}镜`} npn={npn} setNpn={setNpn} renOpen={renO} setRenOpen={setRenOpen} />
      <ScenarioPickerModal open={scenarioOpen} onClose={() => setScenarioOpen(false)} title="镜序短视频分镜场景库" scenarios={SHOTFLOW_SCENARIOS} onSelect={loadScenario} />

      {showV && (
        <Modal t="版本管理" onClose={() => setShowV(false)}>
          <div className="flex gap-2 mb-3">
            <Input value={vn} onChange={(e: ChangeEvent<HTMLInputElement>) => setVn(e.target.value)} placeholder="版本备注（例如：第1版粗剪脚本）" />
            <B onClick={saveVer}><Save className="size-3.5" />保存当前版本</B>
          </div>
          {(!active.versions || !active.versions.length) && <p className="text-xs text-muted-foreground text-center py-4">暂无历史版本</p>}
          <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
            {active.versions?.map((v, i) => (
              <div key={v.id} className="p-2.5 bg-muted/40 rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-semibold text-xs">{v.name}</span>
                  <span className="text-[10px] text-muted-foreground ml-2 font-mono">({v.shots.length}镜 · {new Date(v.ts).toLocaleTimeString()})</span>
                </div>
                <B variant="outline" size="sm" onClick={() => { save(v.shots); setShowV(false); toast(`已恢复版本：${v.name}`); }}>恢复</B>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {showC && (
        <Modal t="任意两版本 Diff 对比" onClose={() => setShowC(false)} w="max-w-lg">
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[['版本 A', cmpV1, setCmpV1], ['版本 B', cmpV2, setCmpV2]].map(([l, v, setV]: any) => {
              const opts = [{ id: 'curr', name: '当前状态' }, ...(active.versions || [])];
              return (
                <div key={l}>
                  <label className="text-xs text-muted-foreground block mb-1">{l}</label>
                  <select value={v} onChange={(e: ChangeEvent<HTMLSelectElement>) => setV(e.target.value)} className="w-full h-9 px-2 text-xs rounded-md border border-input bg-background outline-none">
                    <option value="">请选择对比版本</option>
                    {opts.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
          {cmpV1 && cmpV2 && (
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/40">
              {[['新增', cmpRes.a, 'green'], ['删除', cmpRes.d, 'red'], ['修改', cmpRes.m, 'amber'], ['不变', cmpRes.u, 'outline']].map(([l, n, v]: any) => (
                <div key={l} className="text-center p-2 rounded-lg bg-muted/30">
                  <div className="text-base font-bold font-mono">{n}</div>
                  <Badge v={v} c="text-[10px] mt-1">{l}</Badge>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
