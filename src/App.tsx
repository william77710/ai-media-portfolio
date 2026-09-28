import { StrictMode, useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import { AlertTriangle, Download, Film, Home, Plus, Search, Sparkles, XCircle, Settings, BookMarked, ArrowRight } from 'lucide-react';
import ShotFlowPage from './ShotFlowPage';
import { B, Badge, Card, Input, ProjModal, TA, cn, dlFile, proxyOrDemo, toast, uid, usePM, AISettingsModal, ScenarioPickerModal, getAISettings, robustJSONParse } from './shared';
import { MEDIALENS_SCENARIOS } from './corpus';
import './index.css';

type Block = { id: string; title: string; items: string[]; verify?: boolean };
type MLProj = { id: string; title: string; topic: string; bg: string; blocks: Block[] };

const defs: [string, string, boolean][] = [
  ['value', '选题价值', false], ['audience', '目标受众', false], ['angles', '报道角度', false],
  ['sources', '采访对象', false], ['questions', '采访提纲', false], ['facts', '已知事实', true],
  ['opinions', '各方观点', true], ['verify', '待核实信息', true], ['checklist', '事实核查清单', true],
  ['titles', '平台标题方向', false],
];

const genMLBlocks = (topic: string, _bg: string): Block[] => [
  { id: 'value', title: '选题价值', verify: false, items: ['聚焦 ' + (topic || '该主题') + ' 的核心痛点与行业变革趋势', '兼具一线人物叙事温度与公共议题深度', '具备多平台跨媒介二次分发传播潜力'] },
  { id: 'audience', title: '目标受众', verify: false, items: ['关注行业趋势与新生活方式的年轻受众', '内容制作、媒体传播与数字技术从业者', '寻求理性分析与深度事实的普通公众'] },
  { id: 'angles', title: '报道角度', verify: false, items: ['微观特写：亲历者的真实日常与转型困境', '中观透视：行业现状与成本效率对比分析', '宏观反思：技术与制度演进下的伦理底线', '未来展望：人机协作的新内容生产生态'] },
  { id: 'sources', title: '采访对象', verify: false, items: ['核心当事人与一线实践者', '行业分析师与专业学者', '相关平台与机构运营负责人', '一线技术开发与风控专家'] },
  { id: 'questions', title: '采访提纲', verify: false, items: ['最初投身或关注该领域的契机是什么？', '当前面临的最核心矛盾与阻碍在哪里？', '新技术与新工具给日常工作带来了哪些改变？', '有哪些环节您认为永远需要人工主导把关？'] },
  { id: 'facts', title: '已知事实', verify: true, items: ['相关领域正在经历快速数字化与智能化重塑', '多地已出台对应扶持与合规指引政策'] },
  { id: 'opinions', title: '各方观点', verify: true, items: ['“技术是提升效率的抓手，核心判断依然取决于人”', '“真正被淘汰的不是传统人员，而是拒绝掌握新工具的人”'] },
  { id: 'verify', title: '待核实信息', verify: true, items: ['受访者身份资质与机构真实运营数据', '引用行业报告的数据口径与统计来源', '涉及商业合作或协议条款的公开透明度'] },
  { id: 'checklist', title: '事实核查清单', verify: true, items: ['[ ] 交叉验证至少两个独立信源', '[ ] 标注所有引用数据的时间与出处', '[ ] 对涉及争议的关键事实调取一手证明材料'] },
  { id: 'titles', title: '平台标题方向', verify: false, items: ['短视频：“' + (topic || '这个选题') + '背后，你不知道的真相”', '深度图文：《' + (topic || '时代观察') + '：一次深度的生产力实测》', '社交媒体：干货拆解｜' + (topic || '选题策划') + '全流程执行手记'] },
];

function MediaLens() {
  const { list, setList, aid, setAid, active } = usePM<MLProj>('ml-proj-list', 'ml-proj-active');
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
    const newTitle = name.trim() || '选题策划项目';
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
    dlFile(active.title + '.md', '# ' + active.title + '

'
      + '主题：' + topic + '

'
      + '背景：' + bg + '

'
      + blocks.map(b => '## ' + b.title + (b.verify ? '（待核实）' : '') + '
' + b.items.map(x => '- ' + x).join('
')).join('

'));
  };

  if (!active) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <Search className="size-12 mx-auto text-primary/40" />
        <h2 className="text-xl font-serif font-bold mt-3">媒眼 MediaLens</h2>
        <p className="text-sm text-muted-foreground my-3">融媒体选题策划与事实框架助手 · 20组垂直场景</p>
        <B onClick={() => setShow(true)}><Plus className="size-4" />新建或打开项目</B>
        <ProjModal open={show} onClose={() => setShow(false)} list={list} aid={aid} setAid={setAid} onNew={create} onDel={remove} onRen={rename} Icon={Search} sub={(p: MLProj) => p.blocks.length + '类'} npn={name} setNpn={setName} renOpen={ren} setRenOpen={setRen} />
      </div>
    );
  }

  const aiSettings = getAISettings();
  const isRealAI = aiSettings.provider !== 'demo' && !!aiSettings.apiKey.trim();

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center gap-2 flex-wrap mb-4">
        <div className="flex items-center gap-2.5">
          <Search className="size-9 p-2 rounded-lg bg-primary/10 text-primary" />
          <div>
            <h1 className="text-lg font-serif font-bold leading-none">媒眼 MediaLens</h1>
            <p className="text-[11px] text-muted-foreground mt-1">10维选题策划 · 事实风控框架</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <B variant="outline" onClick={() => setScenarioOpen(true)}>
            <BookMarked className="size-3.5 text-primary" /> 20组场景案例
          </B>
          <B variant="outline" onClick={() => setShow(true)}>项目：{active.title}</B>
          <B variant="outline" onClick={exp}><Download className="size-3.5" />导出</B>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card c="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold">选题输入</h2>
            <Badge v={isRealAI ? 'green' : 'default'} c="text-[10px]">
              {isRealAI ? '🟢 ' + aiSettings.provider + ' 真实AI' : '🔵 Demo语料库'}
            </Badge>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">选题主题</label>
            <Input value={topic} onChange={(e: ChangeEvent<HTMLInputElement>) => { setTopic(e.target.value); persist(blocks, e.target.value, bg); }} placeholder="例如：00后自由职业者的数字游民实验" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">背景材料与线索</label>
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
            <AlertTriangle className="inline size-3 mr-1" /> 事实类与引语信息已强制标记为待核实，保障采编真实性。
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

      <ProjModal open={show} onClose={() => setShow(false)} list={list} aid={aid} setAid={setAid} onNew={create} onDel={remove} onRen={rename} Icon={Search} sub={(p: MLProj) => p.blocks.length + '类'} npn={name} setNpn={setName} renOpen={ren} setRenOpen={setRen} />
      <ScenarioPickerModal open={scenarioOpen} onClose={() => setScenarioOpen(false)} title="媒眼选题策划场景库" scenarios={MEDIALENS_SCENARIOS} onSelect={loadScenario} />
    </div>
  );
}

function Layout({ children }: { children: ReactNode }) {
  const [apiModal, setApiModal] = useState(false);
  const settings = getAISettings();
  const isOnline = settings.provider !== 'demo' && !!settings.apiKey.trim();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex justify-between items-center">
          <Link to="/" className="font-serif font-bold text-sm flex items-center gap-2">
            <div className="size-7 rounded bg-gradient-to-br from-teal-500 to-purple-600 flex items-center justify-center text-xs text-white font-bold">MF</div>
            <span>MediaFlow 融媒体创作工作台</span>
          </Link>
          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1">
              <NavLink to="/" end className={({ isActive }) => cn('px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors', isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent/50')}>
                <Home className="size-3.5" />首页
              </NavLink>
              <NavLink to="/medialens" className={({ isActive }) => cn('px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors', isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent/50')}>
                <Search className="size-3.5" />媒眼选题
              </NavLink>
              <NavLink to="/shotflow" className={({ isActive }) => cn('px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors', isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent/50')}>
                <Film className="size-3.5" />镜序分镜
              </NavLink>
            </nav>
            <button
              onClick={() => setApiModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border/60 hover:bg-accent/60 text-xs font-medium text-foreground/80 cursor-pointer transition-all ml-2"
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
        MediaFlow Suite · 智能融媒体采编与视听创作工作流系统
      </footer>
      <AISettingsModal open={apiModal} onClose={() => setApiModal(false)} />
    </div>
  );
}

function HomePage() {
  const [apiModal, setApiModal] = useState(false);
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <Badge v="outline" c="mb-3">AI 赋能融媒体工业化生产</Badge>
        <h1 className="text-3xl md:text-5xl font-serif font-bold tracking-tight mb-4">
          用 AI 重塑<span className="text-teal-600">采编策划</span>与<span className="text-purple-600">视听分镜</span>工作流
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          专为内容创作者打造的双核生产力工作台：从前期 10 维选题事实风控，到中后期 9 维视听分镜生成与锁定保真微调。内置 40 组垂直场景案例库，支持纯前端 API 直连。
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link to="/medialens"><B size="sm" c="h-9 px-4 text-xs"><Search className="size-3.5" />进入媒眼选题</B></Link>
          <Link to="/shotflow"><B variant="outline" size="sm" c="h-9 px-4 text-xs"><Film className="size-3.5" />进入镜序分镜</B></Link>
          <B variant="outline" size="sm" c="h-9 px-4 text-xs" onClick={() => setApiModal(true)}><Settings className="size-3.5" />配置大模型 API</B>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <Card c="p-6 flex flex-col justify-between hover:border-primary/40 hover:shadow-md transition-all group">
          <div>
            <div className="size-10 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center mb-4">
              <Search className="size-5" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-base font-bold">媒眼 MediaLens</h3>
              <Badge v="outline">前期策划</Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              针对选题发散混乱与 AI 幻觉痛点，构建 10 维全景策划矩阵与双轨事实风控机制。强制标明待核实数据与信源，生成可执行的核查清单。
            </p>
            <div className="space-y-1.5 text-xs text-muted-foreground/80 mb-6">
              <div>✓ 10 维全景采编策划矩阵与跨平台标题</div>
              <div>✓ 事实/引语信息强制黄色高亮待核实</div>
              <div>✓ 20 组垂直领域场景案例库一键载入</div>
            </div>
          </div>
          <Link to="/medialens" className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
            打开媒眼工作台 <ArrowRight className="size-3.5" />
          </Link>
        </Card>

        <Card c="p-6 flex flex-col justify-between hover:border-primary/40 hover:shadow-md transition-all group">
          <div>
            <div className="size-10 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center mb-4">
              <Film className="size-5" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-base font-bold">镜序 ShotFlow</h3>
              <Badge v="outline">视听分镜</Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              针对短视频视听语言缺失与 AI 抽卡随机痛点，提供 9 维专业视听参数体系与独创锁定保真（Lock-Preserved）占位替换合成算法。
            </p>
            <div className="space-y-1.5 text-xs text-muted-foreground/80 mb-6">
              <div>✓ 景别/机位/动作/台词/音效 9 维视听参数</div>
              <div>✓ 锁定镜头保真合并，重新生成位置内容不变</div>
              <div>✓ 动态时长控制（≥15s）与双版本 Diff 对比</div>
            </div>
          </div>
          <Link to="/shotflow" className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
            打开镜序工作台 <ArrowRight className="size-3.5" />
          </Link>
        </Card>
      </div>

      <Card c="p-4 bg-muted/30 border-border/40 text-xs text-muted-foreground text-center">
        💡 <b>运行模式提示</b>：系统默认内置 40 组精编场景案例，可零配置即开即用；如需使用实时大模型生成，可随时在右上角「API 设置」中配置个人模型 Key（纯本地存储，安全直连）。
      </Card>
      <AISettingsModal open={apiModal} onClose={() => setApiModal(false)} />
    </div>
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
