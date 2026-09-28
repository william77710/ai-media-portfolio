import { StrictMode, useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { AlertTriangle, ChevronRight, Download, Film, Home, Layers, Plus, Search, Sparkles, XCircle, Settings, BookMarked, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import ShotFlowPage from './ShotFlowPage';
import { B, Badge, Card, Input, ProjModal, TA, cn, dlFile, proxyOrDemo, toast, uid, usePM, AISettingsModal, ScenarioPickerModal, getAISettings, robustJSONParse } from './shared';
import { MEDIALENS_SCENARIOS } from './corpus';
import './index.css';

type Block = { id: string; title: string; items: string[]; verify?: boolean };
type MLProj = { id: string; title: string; topic: string; bg: string; blocks: Block[] };

const defs: [string, string, boolean][] = [
  ['value', '选题价值与社会共鸣', false], ['audience', '目标受众与圈层画像', false], ['angles', '多维报道与切入角度', false],
  ['sources', '多元信源与采访对象', false], ['questions', '阶梯式采访提纲', false], ['facts', '已知客观事实', true],
  ['opinions', '各方观点与利益博弈', true], ['verify', '待核实疑点与风险信息', true], ['checklist', '事实核查 Checklist', true],
  ['titles', '跨媒介多平台标题矩阵', false],
];

const genMLBlocks = (topic: string, bg: string): Block[] => [
  { id: 'value', title: '选题价值与社会共鸣', verify: false, items: [`聚焦「${topic || '该主题'}」在当下的现实痛点与行业变革`, '兼具一线微观人物叙事与宏观公共议题思考', '具备较强的多平台跨媒介分发与深度讨论价值'] },
  { id: 'audience', title: '目标受众与圈层画像', verify: false, items: ['青年从业者与行业关注人群', '内容创作、媒体与技术产品从业者', '关注社会民生变迁与新生活方式的泛受众'] },
  { id: 'angles', title: '多维报道与切入角度', verify: false, items: [`微观特写：一线当事人的真实处境与日常选择`, `中观透视：行业效率、成本结构与生存空间对比`, `宏观反思：新技术与新业态介入下的规则与伦理边界`, '发展展望：人机协作与未来内容生产的新范式'] },
  { id: 'sources', title: '多元信源与采访对象', verify: false, items: ['一线亲历者 / 当事人核心代表', '相关高校与科研机构专家学者', '行业资深从业者 / 运营业务负责人', '平台技术与监管合规专家'] },
  { id: 'questions', title: '阶梯式采访提纲', verify: false, items: ['最初进入该领域或做出选择的核心契机是什么？', '当前面临的最主要矛盾、阻碍与真实痛点是什么？', '新技术与新工具的介入带来了哪些具体效率与体验改变？', '在整个工作流中，哪些环节你认为始终需要人的专业把关？'] },
  { id: 'facts', title: '已知客观事实', verify: true, items: ['相关领域正在经历智能化与数字化工作流升级', '行业多地已出台扶持引导或合规治理政策'] },
  { id: 'opinions', title: '各方观点与利益博弈', verify: true, items: ['“技术是生产力杠杆，核心审美与深度洞察仍取决于人”', '“真正拉开差距的不是工具本身，而是人机协同的工作流设计”'] },
  { id: 'verify', title: '待核实疑点与风险信息', verify: true, items: ['受访主体机构资质与职务信息的真实性', '引用统计数据、行业报告的发布时间与统计口径', '涉及商业推广与赞助合作条款的透明度'] },
  { id: 'checklist', title: '事实核查 Checklist', verify: true, items: ['[ ] 核心事实交叉核对至少 2 个独立信息源', '[ ] 明确标注所有援引数据的时间点与权威出处', '[ ] 涉及争议观点调取一手书面或影像凭证'] },
  { id: 'titles', title: '跨媒介多平台标题矩阵', verify: false, items: [`短视频端：“${topic || '这个话题'}背后，真实的日常究竟是怎样？”`, `深度专栏：《${topic || '时代切片'}：一次人机协同的创作观察》`, `社媒图文：全流程拆解｜${topic || '深度选题'}采编与核查手记`] },
];

function MediaLens() {
  const { list, setList, aid, setAid, active } = usePM<MLProj>('ml-list', 'ml-active');
  const [topic, setTopic] = useState('');
  const [bg, setBg] = useState('');
  const [blocks, setBlocks] = useState<Block[]>(active?.blocks || []);
  const [loading, setLoading] = useState('');
  const [show, setShow] = useState(false);
  const [ren, setRen] = useState(false);
  const [name, setName] = useState('');
  const [scenarioOpen, setScenarioOpen] = useState(false);

  useEffect(() => {
    if (active) {
      setTopic(active.topic || '');
      setBg(active.bg || '');
      setBlocks(active.blocks || []);
    }
  }, [active?.id]);

  const persist = (bs = blocks, t = topic, b = bg) => {
    setBlocks(bs);
    if (active) setList(list.map(p => p.id === aid ? { ...p, topic: t, bg: b, blocks: bs } : p));
  };

  const create = () => {
    const id = uid();
    const newTitle = name.trim() || '媒眼选题项目';
    setList([...list, { id, title: newTitle, topic: '', bg: '', blocks: [] }]);
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

  const generate = async (targetId?: string) => {
    if (!topic.trim()) return toast('请先输入选题主题');
    setLoading(targetId || 'all');
    try {
      const res = await proxyOrDemo('medialens_generate', { topic, bg, section: targetId });

      if (res.fromAI && res.data) {
        const parsed = robustJSONParse<any>(res.data, null);
        if (parsed && typeof parsed === 'object') {
          if (targetId) {
            const val = parsed[targetId] || parsed.items || parsed.value;
            const items = Array.isArray(val) ? val : [String(val)];
            persist(blocks.map(b => b.id === targetId ? { ...b, items } : b));
          } else {
            const newBs = defs.map(([id, title, verify]) => {
              const val = parsed[id] || parsed[title];
              const items = Array.isArray(val) ? val : (val ? [String(val)] : genMLBlocks(topic, bg).find(x => x.id === id)?.items || []);
              return { id, title, verify, items };
            });
            persist(newBs);
          }
          toast('✨ 真实 AI 深度策划生成成功');
          return;
        }
      }

      if (targetId) {
        const d = genMLBlocks(topic, bg).find(x => x.id === targetId);
        if (d) persist(blocks.map(x => x.id === targetId ? { ...d, items: d.items.map((v, i) => i === 0 ? v + '（重生成）' : v) } : x));
      } else {
        persist(genMLBlocks(topic, bg));
      }
      toast(res.fromAI ? '生成完成' : '已载入场景策划框架（Demo模式）');
    } finally {
      setLoading('');
    }
  };

  const loadScenario = (s: typeof MEDIALENS_SCENARIOS[0]) => {
    setTopic(s.input.topic);
    setBg(s.input.bg);
    const bs = genMLBlocks(s.input.topic, s.input.bg);
    persist(bs, s.input.topic, s.input.bg);
  };

  const exp = () => {
    if (!active) return;
    dlFile(`${active.title}.md`, `# ${active.title} - 采编策划与事实核查案

## 基本信息
- 生成时间：${new Date().toLocaleString()}
- 选题主题：${topic}
- 背景资料：${bg || '无'}

${blocks.map(b => `### ${b.title}${b.verify ? '（⚠️ 需人工核查）' : ''}
${b.items.map(x => `- ${x}`).join('
')}`).join('

')}`);
  };

  if (!active) {
    return (
      <Empty
        icon={Search}
        title="媒眼 MediaLens"
        text="智能选题策划与事实框架工作台 · 20组垂直场景"
        onClick={() => setShow(true)}
        modal={
          <ProjModal open={show} onClose={() => setShow(false)} list={list} aid={aid} setAid={setAid} onNew={create} onDel={remove} onRen={rename} Icon={Search} sub={(p: MLProj) => `${p.blocks.length}类`} npn={name} setNpn={setName} renOpen={ren} setRenOpen={setRen} />
        }
      />
    );
  }

  const aiSettings = getAISettings();
  const isRealAI = aiSettings.provider !== 'demo' && !!aiSettings.apiKey.trim();

  return (
    <Page
      title="媒眼 MediaLens"
      sub="智能选题策划 · 10维事实核查框架"
      icon={Search}
      actions={
        <>
          <B variant="outline" onClick={() => setScenarioOpen(true)}>
            <BookMarked className="size-3.5 text-primary" /> 20组场景案例
          </B>
          <B variant="outline" onClick={() => setShow(true)}>项目：{active.title}</B>
          <B variant="outline" onClick={exp}><Download className="size-3.5" />导出策划案</B>
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card c="p-4 space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-border/30">
            <h2 className="text-xs font-semibold">选题输入</h2>
            <Badge v={isRealAI ? 'green' : 'default'} c="text-[10px]">
              {isRealAI ? `🟢 ${aiSettings.provider} 真实AI` : '🔵 场景案例库'}
            </Badge>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">主题核心</label>
            <Input value={topic} onChange={(e: ChangeEvent<HTMLInputElement>) => { setTopic(e.target.value); persist(blocks, e.target.value, bg); }} placeholder="例如：新消费业态下的折扣零售观察" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">背景材料与线索</label>
            <TA value={bg} onChange={(v: string) => { setBg(v); persist(blocks, topic, v); }} rows={4} placeholder="粘贴背景资料、社媒线索或前期调研记录..." />
          </div>
          <B c="w-full" disabled={!!loading} onClick={() => generate()}>
            <Sparkles className={cn('size-3.5', loading && 'animate-spin')} />
            {loading === 'all' ? '生成中...' : (isRealAI ? '调用真实 AI 生成策划' : '智能生成策划框架')}
          </B>
          <B variant="outline" c="w-full" onClick={() => setScenarioOpen(true)}>
            <BookMarked className="size-3.5" /> 载入 20 组垂直场景案例
          </B>
          <div className="text-[11px] text-amber-800 leading-relaxed bg-amber-50/70 p-2.5 rounded-lg border border-amber-200/60 flex items-start gap-1.5">
            <ShieldCheck className="size-4 shrink-0 text-amber-600 mt-0.5" />
            <span><b>事实风控机制</b>：客观事实、观点引语与核查清单强制标为「待核实」，需人工双信源把关。</span>
          </div>
        </Card>

        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {!blocks.length && (
            <Card c="p-12 text-center text-sm text-muted-foreground md:col-span-2">
              <Search className="size-10 mx-auto mb-2 text-muted-foreground/30" />
              点击左侧“智能生成策划框架”或从“20组场景案例”直接载入
            </Card>
          )}
          {blocks.map(b => (
            <Card key={b.id} c="p-3">
              <div className="flex justify-between items-center gap-2 mb-2 pb-1.5 border-b border-border/30">
                <input
                  value={b.title}
                  onChange={e => persist(blocks.map(x => x.id === b.id ? { ...x, title: e.target.value } : x))}
                  className="font-semibold text-xs bg-transparent min-w-0 flex-1 outline-none"
                />
                <div className="flex items-center gap-1">
                  {b.verify && <Badge v="amber">需核实</Badge>}
                  <button aria-label="重新生成本项" onClick={() => generate(b.id)} className="p-1 hover:bg-accent rounded text-primary cursor-pointer" title="重新生成此模块">
                    <Sparkles className={cn('size-3.5', loading === b.id && 'animate-spin')} />
                  </button>
                  <button aria-label="添加条目" onClick={() => persist(blocks.map(x => x.id === b.id ? { ...x, items: [...x.items, ''] } : x))} className="p-1 hover:bg-accent rounded text-muted-foreground cursor-pointer" title="添加一项">
                    <Plus className="size-3.5" />
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {b.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-1">
                    <span className="text-muted-foreground/40 text-xs mt-1">•</span>
                    <input
                      value={item}
                      onChange={e => persist(blocks.map(x => x.id === b.id ? { ...x, items: x.items.map((v, j) => i === j ? e.target.value : v) } : x))}
                      className="text-xs flex-1 min-w-0 bg-transparent py-0.5 outline-none"
                    />
                    <button aria-label="删除条目" onClick={() => persist(blocks.map(x => x.id === b.id ? { ...x, items: x.items.filter((_, j) => j !== i) } : x))} className="p-0.5 hover:bg-red-50 text-muted-foreground hover:text-red-500 rounded shrink-0 cursor-pointer">
                      <XCircle className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>

      <ProjModal open={show} onClose={() => setShow(false)} list={list} aid={aid} setAid={setAid} onNew={create} onDel={remove} onRen={rename} Icon={Search} sub={(p: MLProj) => `${p.blocks.length}类`} npn={name} setNpn={setName} renOpen={ren} setRenOpen={setRen} />
      <ScenarioPickerModal open={scenarioOpen} onClose={() => setScenarioOpen(false)} title="媒眼选题策划场景库" scenarios={MEDIALENS_SCENARIOS} onSelect={loadScenario} />
    </Page>
  );
}

function Empty({ icon: Icon, title, text, onClick, modal }: { icon: any; title: string; text: string; onClick: () => void; modal: ReactNode }) {
  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <Icon className="size-12 mx-auto text-primary/40" />
      <h2 className="text-xl font-serif font-bold mt-3">{title}</h2>
      <p className="text-sm text-muted-foreground my-3">{text}</p>
      <B onClick={onClick}><Plus className="size-4" />新建或打开项目</B>
      {modal}
    </div>
  );
}

function Page({ title, sub, icon: Icon, actions, children }: { title: string; sub: string; icon: any; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center gap-2 flex-wrap mb-4">
        <div className="flex items-center gap-2.5">
          <Icon className="size-9 p-2 rounded-lg bg-primary/10 text-primary" />
          <div>
            <h1 className="text-lg font-serif font-bold leading-none">{title}</h1>
            <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">{actions}</div>
      </div>
      {children}
    </div>
  );
}

const nav = [
  ['/', '工作流总览', Home],
  ['/medialens', '媒眼 MediaLens', Search],
  ['/shotflow', '镜序 ShotFlow', Film],
] as const;

function Layout({ children }: { children: ReactNode }) {
  const [apiModal, setApiModal] = useState(false);
  const settings = getAISettings();
  const isOnline = settings.provider !== 'demo' && !!settings.apiKey.trim();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex justify-between items-center">
          <Link to="/" className="font-serif font-bold text-sm flex items-center gap-2">
            <div className="size-7 rounded-lg bg-gradient-to-br from-teal-500 to-indigo-600 flex items-center justify-center text-xs text-white font-bold shadow-xs">AI</div>
            <span>MediaFlow 智能创作工作流</span>
          </Link>
          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1">
              {nav.map(([p, l, I]) => (
                <NavLink key={p} to={p} end={p === '/'} className={({ isActive }) => cn('px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors', isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-accent/60')}>
                  <I className="size-3.5" />{l}
                </NavLink>
              ))}
            </nav>
            <button
              onClick={() => setApiModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border/60 hover:bg-accent/60 text-xs font-medium text-foreground/80 cursor-pointer transition-all ml-1"
              title="配置大模型 API Key"
            >
              <Settings className="size-3.5 text-primary" />
              <span className="hidden sm:inline">{isOnline ? settings.provider : 'API 设置'}</span>
              <span className={cn('size-2 rounded-full', isOnline ? 'bg-green-500' : 'bg-amber-400')} />
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border/30 py-4 text-center text-[11px] text-muted-foreground">
        MediaFlow 智能创作工作流工作台 · 前期采编策划 × 视听分镜生成
      </footer>
      <AISettingsModal open={apiModal} onClose={() => setApiModal(false)} />
    </div>
  );
}

function HomePage() {
  const [apiModal, setApiModal] = useState(false);
  return (
    <>
      <section className="py-16 text-center bg-gradient-to-br from-teal-500/5 via-background to-indigo-500/5 border-b border-border/30">
        <Badge v="outline" c="mb-3">端到端智能创作工作流</Badge>
        <h1 className="text-2xl md:text-4xl font-serif font-bold mb-3 leading-tight">
          用 AI 重新定义<span className="text-teal-700">内容生产双引擎</span>
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground max-w-xl mx-auto mb-6 leading-relaxed">
          打通从「前期选题策划与事实风控」到「视听分镜生成与锁定保真」的完整创作闭环。内置 40 组专业场景案例库，支持前端安全直连大模型。
        </p>
        <div className="flex items-center justify-center gap-2.5 flex-wrap">
          <Link to="/medialens"><B size="sm"><Search className="size-3.5" />媒眼 MediaLens（选题策划）</B></Link>
          <Link to="/shotflow"><B variant="outline" size="sm"><Film className="size-3.5" />镜序 ShotFlow（视听分镜）</B></Link>
          <B variant="outline" size="sm" onClick={() => setApiModal(true)}><Settings className="size-3.5" />配置实时 AI</B>
        </div>
      </section>

      <section className="max-w-5xl mx-auto p-4 py-12">
        <div className="text-center mb-10">
          <h2 className="text-lg font-serif font-bold">两大核心生产力工具链</h2>
          <p className="text-xs text-muted-foreground mt-1">发现需求 → 事实风控 → 视听转化 → 锁定微调 → 工业导出</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card c="p-6 flex flex-col justify-between hover:border-primary/40 hover:shadow-md transition-all">
            <div>
              <div className="size-11 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white mb-4 shadow-sm">
                <Search className="size-6" />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-base">媒眼 MediaLens</h3>
                <Badge v="outline">前期策划</Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                解决前期选题发散无序与事实失真痛点。提供 10 维全景采编策划矩阵与强制事实核查机制，确保内容深度与真实性底线。
              </p>
              <div className="space-y-1.5 text-xs text-muted-foreground mb-4">
                <div className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-teal-600" /> 10 维结构化采编策划案输出</div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-teal-600" /> 事实类信息强制「待核实」标记</div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-teal-600" /> 20 组多领域垂直采编场景语料</div>
              </div>
            </div>
            <Link to="/medialens" className="pt-3 border-t border-border/40 flex items-center justify-between text-xs font-semibold text-primary hover:underline">
              <span>进入媒眼工作台</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </Card>

          <Card c="p-6 flex flex-col justify-between hover:border-primary/40 hover:shadow-md transition-all">
            <div>
              <div className="size-11 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center text-white mb-4 shadow-sm">
                <Film className="size-6" />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-base">镜序 ShotFlow</h3>
                <Badge v="amber">视听分镜</Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                解决剧本文案向专业视听语言转化难题。支持 9 维广播级镜头参数、锁定保真占位合成算法与双版本 Diff 协同对比。
              </p>
              <div className="space-y-1.5 text-xs text-muted-foreground mb-4">
                <div className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-teal-600" /> 9 维影视视听参数（景别/运镜/生图Prompt）</div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-teal-600" /> 锁定镜头位置与参数保真合成</div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-teal-600" /> 双版本 Diff 对比与制作级 CSV 导出</div>
              </div>
            </div>
            <Link to="/shotflow" className="pt-3 border-t border-border/40 flex items-center justify-between text-xs font-semibold text-primary hover:underline">
              <span>进入镜序工作台</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </Card>
        </div>

        <div className="mt-8 p-4 rounded-xl bg-card border border-border/50 text-xs text-muted-foreground flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-green-600 shrink-0" />
            <span><b>双模式运行保障</b>：默认内置 40 组专业场景语料库直接体验；支持配置自定义大模型 API Key 本地安全直连。</span>
          </div>
          <button onClick={() => setApiModal(true)} className="text-primary font-medium hover:underline text-xs cursor-pointer">
            配置 API 密钥 →
          </button>
        </div>
      </section>
      <AISettingsModal open={apiModal} onClose={() => setApiModal(false)} />
    </>
  );
}

function NotFound() {
  return (
    <div className="py-24 text-center">
      <h1 className="text-5xl font-bold text-muted-foreground/30">404</h1>
      <p className="text-sm text-muted-foreground my-3">页面不存在</p>
      <Link to="/"><B>返回首页</B></Link>
    </div>
  );
}

function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/medialens" element={<MediaLens />} />
          <Route path="/shotflow" element={<ShotFlowPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
