import { StrictMode, useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { AlertTriangle, BookOpen, ChevronRight, Download, Film, Home, Layers, Mic, Plus, Search, Sparkles, XCircle, Settings, BookMarked, Zap } from 'lucide-react';
import ShotFlowPage from './ShotFlowPage';
import QuoteCutPage from './QuoteCutPage';
import { B, Badge, Card, Input, ProjModal, TA, cn, dlFile, proxyOrDemo, toast, uid, usePM, AISettingsModal, ScenarioPickerModal, getAISettings, robustJSONParse } from './shared';
import { MEDIALENS_SCENARIOS } from './corpus';
import './index.css';

type Block = { id: string; title: string; items: string[]; verify?: boolean };
type MLProj = { id: string; title: string; topic: string; bg: string; blocks: Block[] };

const defs: [string, string, boolean][] = [
  ['value', '选题价值', false], ['audience', '目标受众', false], ['angles', '报道角度', false],
  ['sources', '采访对象', false], ['questions', '采访问题', false], ['facts', '已知事实', true],
  ['opinions', '各方观点', true], ['verify', '待核实信息', true], ['checklist', '事实核查清单', true],
  ['titles', '平台标题方向', false],
];

const genMLBlocks = (topic: string, bg: string): Block[] => [
  { id: 'value', title: '选题价值', verify: false, items: [`聚焦 ${topic || '该主题'} 的社会痛点与行业变革`, '兼具一线人物叙事与公共议题思考', '适合多平台跨媒介分发传播'] },
  { id: 'audience', title: '目标受众', verify: false, items: ['青年群体与高校应届生', '传媒、内容与AI产品从业者', '关注社会议题与生活方式的普通受众'] },
  { id: 'angles', title: '报道角度', verify: false, items: [`人物特写：一线亲历者的真实日常与转型`, `数据透视：行业现状与成本效率对比`, `边界反思：技术介入下的真实性与伦理底线`, '未来展望：人机协作的新内容生态'] },
  { id: 'sources', title: '采访对象', verify: false, items: ['青年实践者 / 当事人', '高校新闻与传播学院学者', '一线行业资深编导 / 运营负责人', '技术平台行业专家'] },
  { id: 'questions', title: '采访问题', verify: false, items: ['最初接触或投身该领域的契机是什么？', '当前最核心的矛盾与痛点在哪里？', 'AI等新技术给你的工作带来了哪些改变？', '有哪些环节你认为永远无法被机器替代？'] },
  { id: 'facts', title: '已知事实', verify: true, items: ['相关行业正在经历数字化与智能化转型', '多地已出台扶持或规范政策'] },
  { id: 'opinions', title: '各方观点', verify: true, items: ['“技术是工具，核心判断与审美依然取决于人”', '“真正被替代的不是人，而是不会使用新工具的人”'] },
  { id: 'verify', title: '待核实信息', verify: true, items: ['受访者身份职务及机构真实资质', '引用数据口径与统计来源真实性', '涉及商业合作的协议条款透明度'] },
  { id: 'checklist', title: '事实核查清单', verify: true, items: ['[ ] 交叉验证至少两个独立信源', '[ ] 标明所有引用数据的时间与出处', '[ ] 涉及关键争议事实调取一手证明材料'] },
  { id: 'titles', title: '平台标题方向', verify: false, items: [`短视频：“${topic || '这个选题'}背后，你不知道的真相”`, `深度稿：《${topic || '时代切片'}：一次人机协作的深度观察》`, `小红书：干货整理｜${topic || '选题拆解'}全流程手记`] },
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
    const newTitle = name.trim() || '媒眼项目';
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
      toast(res.fromAI ? '生成完成' : '已载入高质量场景语料（Demo模式）');
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
    dlFile(`${active.title}.md`, `# ${active.title}

主题：${topic}

背景：${bg}

${blocks.map(b => `## ${b.title}${b.verify ? '（待核实）' : ''}
${b.items.map(x => `- ${x}`).join('
')}`).join('

')}`);
  };

  if (!active) {
    return (
      <Empty
        icon={Search}
        title="媒眼 MediaLens"
        text="融媒体选题策划与事实框架助手 · 20组垂直场景"
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
      sub="选题策划 · 事实框架助手"
      icon={Search}
      actions={
        <>
          <B variant="outline" onClick={() => setScenarioOpen(true)}>
            <BookMarked className="size-3.5 text-primary" /> 20组场景案例
          </B>
          <B variant="outline" onClick={() => setShow(true)}>项目：{active.title}</B>
          <B variant="outline" onClick={exp}><Download className="size-3.5" />导出</B>
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card c="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold">选题输入</h2>
            <Badge v={isRealAI ? 'green' : 'default'} c="text-[10px]">
              {isRealAI ? `🟢 ${aiSettings.provider} 真实AI` : '🔵 Demo语料库'}
            </Badge>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">主题</label>
            <Input value={topic} onChange={(e: ChangeEvent<HTMLInputElement>) => { setTopic(e.target.value); persist(blocks, e.target.value, bg); }} placeholder="例如：00后毕业生的数字游民实验" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">背景材料</label>
            <TA value={bg} onChange={(v: string) => { setBg(v); persist(blocks, topic, v); }} rows={4} placeholder="粘贴背景新闻或调研线索..." />
          </div>
          <B c="w-full" disabled={!!loading} onClick={() => generate()}>
            <Sparkles className={cn('size-3.5', loading && 'animate-spin')} />
            {loading === 'all' ? '生成中...' : (isRealAI ? '调用真实 AI 生成' : '智能生成策划方案')}
          </B>
          <B variant="outline" c="w-full" onClick={() => setScenarioOpen(true)}>
            <BookMarked className="size-3.5" /> 载入 20 组垂直场景案例
          </B>
          <p className="text-[11px] text-amber-800 leading-relaxed bg-amber-50/60 p-2 rounded border border-amber-200/50">
            <AlertTriangle className="inline size-3 mr-1" /> 事实类信息已强制标记为待核实，需人工把关。
          </p>
        </Card>

        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {!blocks.length && (
            <Card c="p-12 text-center text-sm text-muted-foreground md:col-span-2">
              <Search className="size-10 mx-auto mb-2 text-muted-foreground/30" />
              点击“智能生成”或从“20组场景案例”载入示范
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
                  {b.verify && <Badge v="amber">待核实</Badge>}
                  <button aria-label="重新生成本项" onClick={() => generate(b.id)} className="p-1 hover:bg-accent rounded text-primary cursor-pointer" title="重新生成">
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
  ['/', '首页', Home],
  ['/medialens', '媒眼', Search],
  ['/shotflow', '镜序', Film],
  ['/quotecut', '声迹', Mic],
  ['/documentary', '微纪录片', BookOpen],
  ['/narrative-exp', '叙事实验', Layers],
] as const;

function Layout({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const [apiModal, setApiModal] = useState(false);
  const settings = getAISettings();
  const isOnline = settings.provider !== 'demo' && !!settings.apiKey.trim();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex justify-between items-center">
          <Link to="/" className="font-serif font-bold text-sm flex items-center gap-2">
            <div className="size-7 rounded bg-gradient-to-br from-teal-500 via-amber-500 to-purple-500 flex items-center justify-center text-xs text-white font-bold">AI</div>
            <span>AI × 融媒体作品集</span>
          </Link>
          <div className="flex items-center gap-2">
            <nav className="hidden md:flex items-center gap-0.5">
              {nav.map(([p, l, I]) => (
                <NavLink key={p} to={p} end={p === '/'} className={({ isActive }) => cn('px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors', isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent/50')}>
                  <I className="size-3.5" />{l}
                </NavLink>
              ))}
            </nav>
            <button
              onClick={() => setApiModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border/60 hover:bg-accent/60 text-xs font-medium text-foreground/80 cursor-pointer transition-all"
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
      <footer className="border-t border-border/30 py-4 text-center text-[10px] text-muted-foreground">
        河海大学 2027 届广播电视学 · AI 产品经理候选人作品集｜姓名、邮箱、简历待补充
      </footer>
      <AISettingsModal open={apiModal} onClose={() => setApiModal(false)} />
    </div>
  );
}

const projects = [
  ['/medialens', '媒眼 MediaLens', '融媒体选题策划与事实框架（20场景）', Search, 'from-blue-500 to-cyan-500', ['选题策划', '事实核查', '20组场景']],
  ['/shotflow', '镜序 ShotFlow', '短视频脚本与分镜工作台（20场景）', Film, 'from-teal-500 to-emerald-500', ['第一主项目', '分镜设计', '双版本对比']],
  ['/quotecut', '声迹 QuoteCut', '采访检索与金句粗剪（20场景）', Mic, 'from-purple-500 to-pink-500', ['第二主项目', '时间码SRT', '粗剪时间线']],
  ['/documentary', '《河流边的青春切片》', '互动微纪录片 · 待采访验证', BookOpen, 'from-amber-500 to-orange-500', ['真实内容', '四原则', '人工把关']],
  ['/narrative-exp', '一份素材，三种叙事', '跨平台叙事对比实验 · 待补充', Layers, 'from-rose-500 to-red-500', ['跨媒介', '叙事差异', '对比框架']],
] as const;

function HomePage() {
  const [apiModal, setApiModal] = useState(false);
  return (
    <>
      <section className="py-16 text-center bg-gradient-to-br from-teal-500/5 via-background to-purple-500/5 border-b border-border/30">
        <Badge v="outline" c="mb-3">广播电视学 × AI 产品经理候选人</Badge>
        <h1 className="text-2xl md:text-4xl font-serif font-bold mb-3 leading-tight">
          用 AI 重新定义<span className="text-teal-700">内容生产工作流</span>
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground max-w-xl mx-auto mb-5">
          关注生成式 AI 如何提升选题策划、视听表达和采访后期效率。内置 60 组融媒体垂直场景案例库，支持前端直连真实模型。
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap mb-4">
          <Link to="/shotflow"><B><Sparkles className="size-3.5" />主项目·镜序</B></Link>
          <Link to="/medialens"><B variant="outline">媒眼选题</B></Link>
          <Link to="/quotecut"><B variant="outline">声迹粗剪</B></Link>
          <B variant="outline" onClick={() => setApiModal(true)}><Settings className="size-3.5" />配置真实 AI</B>
        </div>
      </section>

      <section className="max-w-6xl mx-auto p-4 py-10">
        <div className="text-center mb-8">
          <h2 className="text-lg font-serif font-bold">完整证据链与产品矩阵</h2>
          <p className="text-xs text-muted-foreground mt-1">发现问题 → 定义方案 → Coding实现 → 内容验证 → 反馈迭代</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(([p, t, s, I, col, badges]) => (
            <Link key={p} to={p} className="group">
              <Card c="p-5 h-full hover:border-primary/40 hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className={cn('size-10 rounded-lg bg-gradient-to-br flex items-center justify-center text-white mb-3', col)}>
                    <I className="size-5" />
                  </div>
                  <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{t}</h3>
                  <p className="text-xs text-muted-foreground mt-1 mb-3 leading-relaxed">{s}</p>
                </div>
                <div className="flex items-center gap-1 flex-wrap pt-2 border-t border-border/30">
                  {badges.map(b => <Badge key={b} v="outline" c="text-[10px]">{b}</Badge>)}
                </div>
              </Card>
            </Link>
          ))}
        </div>

        <Card c="p-4 mt-6 bg-amber-50/70 border-amber-200 text-xs text-amber-800 flex items-start gap-2">
          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600" />
          <span><b>真实性与伦理声明</b>：所有未完成真实数据、个人履历和采访材料均标记“待补充”，不编造事实。所有工具默认内置60组精编案例，可零配置即开即用体验。</span>
        </Card>
      </section>
      <AISettingsModal open={apiModal} onClose={() => setApiModal(false)} />
    </>
  );
}

function Documentary() {
  return (
    <Page title="《河流边的青春切片》" sub="互动微纪录片 · 待采访验证" icon={BookOpen}>
      <Card c="p-4 bg-amber-50 border-amber-200 text-xs text-amber-800 mb-4">
        所有人物、故事和数据均为待采访占位。内容原则：一个核心人物、一个具体场景、一个明确问题、一条可验证叙事线。
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[['媒眼 MediaLens', '负责前期选题价值与采访提纲事实核查', Search], ['镜序 ShotFlow', '负责6个镜头视听分镜生成与时长平衡', Film], ['声迹 QuoteCut', '负责采访逐字稿金句提取与1分/3分粗剪', Mic]].map(([t, d, I]: any) => (
          <Card key={t} c="p-4 text-center">
            <I className="size-6 text-primary mx-auto mb-2" />
            <h4 className="text-xs font-semibold">{t}</h4>
            <p className="text-[11px] text-muted-foreground mt-1">{d}</p>
          </Card>
        ))}
      </div>
    </Page>
  );
}

function Narrative() {
  const [t, setT] = useState(0);
  const tabs = ['电视新闻版', '竖屏短视频', '播客版'];
  return (
    <Page title="一份素材，三种叙事" sub="跨平台叙事对比实验 · 待补充" icon={Layers}>
      <div className="flex gap-1 mb-3">
        {tabs.map((x, i) => (
          <button key={x} onClick={() => setT(i)} className={cn('flex-1 p-2 rounded-md border text-xs font-medium transition-all cursor-pointer', t === i ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border/60 hover:bg-accent/40')}>
            {x}
          </button>
        ))}
      </div>
      <Card c="p-4 text-sm space-y-2">
        <p className="text-xs text-muted-foreground">同一组采访素材在不同媒介渠道下的叙事重构实验：</p>
        <div className="space-y-1.5 text-xs">
          {['标题设计', '开场抓手', '内容推进顺序', '片段取舍原则', '字幕与音效密度', '目标受众画像', '人工修改量占比'].map(label => (
            <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
              <span className="text-muted-foreground">{label}</span>
              <Badge v="amber">待真实采访后补充</Badge>
            </div>
          ))}
        </div>
      </Card>
    </Page>
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
          <Route path="/quotecut" element={<QuoteCutPage />} />
          <Route path="/documentary" element={<Documentary />} />
          <Route path="/narrative-exp" element={<Narrative />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
