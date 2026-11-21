export type MarketCategory =
  | '全部'
  | 'AI与自动化'
  | '电商工具'
  | '社交与沟通'
  | '办公与效率'
  | '开发与数据'
  | '安全与辅助'
  | 'Web3钱包'
  | '通用工具';

export const MARKET_CATEGORIES: MarketCategory[] = [
  '全部',
  'AI与自动化',
  '电商工具',
  '社交与沟通',
  '办公与效率',
  '开发与数据',
  '安全与辅助',
  'Web3钱包',
  '通用工具',
];

export interface MarketExtensionItem {
  extensionId: string;
  name: string;
  category: Exclude<MarketCategory, '全部'>;
  description: string;
  badgeText: string;
  badgeColor: string;
}

/**
 * 精选高频 Chrome 官方扩展目录（均为 Chrome Web Store 真实官方 ID）
 * 点击下载时通过后端直连 Chrome 官方更新通道（自动走「网络配置」中转链路）拉取最新正版 CRX
 */
export const MARKET_EXTENSIONS: MarketExtensionItem[] = [
  {
    extensionId: 'aapbdbdomjkkjkaonfhkkikfgjllcleb',
    name: 'Google 翻译',
    category: '通用工具',
    description: '浏览网页时可轻松查看划词或整页翻译，跨境运营与多语种站点必备。',
    badgeText: '译',
    badgeColor: 'bg-blue-500',
  },
  {
    extensionId: 'bpoadfkcbjbfhfodiogcnhhhpibjhbnh',
    name: '沉浸式翻译 - 网页翻译插件',
    category: 'AI与自动化',
    description: '双语对照网页翻译、PDF 文档翻译与视频双语字幕，支持多种 AI 引擎。',
    badgeText: '沉',
    badgeColor: 'bg-pink-500',
  },
  {
    extensionId: 'difoiogjjojoaoomphldepapgpbgkhkb',
    name: 'Sider: ChatGPT 侧边栏',
    category: 'AI与自动化',
    description: '在任意网页侧边栏集成多款 AI 模型，支持阅读总结、写作润色与划词问答。',
    badgeText: 'AI',
    badgeColor: 'bg-violet-600',
  },
  {
    extensionId: 'ofpnmcalabcbjgholdjcjblkibolbppb',
    name: 'Monica - 您的 AI 助手',
    category: 'AI与自动化',
    description: '全能浏览器 AI 副驾驶，支持网页摘要、邮件回复、文案改写与搜索增强。',
    badgeText: 'M',
    badgeColor: 'bg-indigo-600',
  },
  {
    extensionId: 'hlkenndednhfkekhgcdicdfddnkalmdm',
    name: 'Cookie-Editor',
    category: '开发与数据',
    description: '快速查看、编辑、批量导入导出当前站点 Cookie，多账号环境调试神器。',
    badgeText: 'CK',
    badgeColor: 'bg-amber-500',
  },
  {
    extensionId: 'dhdgffkkebhmkfjojejmpbldmpobfkfo',
    name: 'Tampermonkey (油猴)',
    category: 'AI与自动化',
    description: '最流行的用户脚本管理器，可运行各类网页增强与自动化脚本。',
    badgeText: 'TM',
    badgeColor: 'bg-zinc-800',
  },
  {
    extensionId: 'nkbihfbeogaeaoehlefnkodbefgpgknn',
    name: 'MetaMask',
    category: 'Web3钱包',
    description: '主流以太坊与 EVM 兼容链浏览器钱包，Web3 交互与空投必备。',
    badgeText: 'MM',
    badgeColor: 'bg-orange-500',
  },
  {
    extensionId: 'mcohilncbfahbmgdjkbpemcciiolgcge',
    name: 'OKX Wallet (欧易 Web3 钱包)',
    category: 'Web3钱包',
    description: '支持多链资产管理、DEX 聚合交易与 DApp 连接的 Web3 钱包。',
    badgeText: 'OK',
    badgeColor: 'bg-neutral-900',
  },
  {
    extensionId: 'bfnaelmomeimhlpmgjnjophhpkkoljpa',
    name: 'Phantom',
    category: 'Web3钱包',
    description: '支持 Solana、Ethereum、Polygon 与 Bitcoin 的多链加密钱包。',
    badgeText: 'PH',
    badgeColor: 'bg-purple-600',
  },
  {
    extensionId: 'acmacodkjbdgmoleebolmdjonilkdbch',
    name: 'Rabby Wallet',
    category: 'Web3钱包',
    description: 'DeBank 出品的多链 EVM 钱包，提供交易前风险扫描与自动切链。',
    badgeText: 'RB',
    badgeColor: 'bg-indigo-500',
  },
  {
    extensionId: 'bhghoamapcdpbohphigoooaddinpkbai',
    name: 'Authenticator (2FA 身份验证器)',
    category: '安全与辅助',
    description: '在浏览器内生成两步验证 TOTP 验证码，多平台账号登录免掏手机。',
    badgeText: '2FA',
    badgeColor: 'bg-emerald-600',
  },
  {
    extensionId: 'nngceckbapebfimnlniiiahkandclblb',
    name: 'Bitwarden 密码管理器',
    category: '安全与辅助',
    description: '开源安全的跨平台密码管理器，支持自动填充与多账号凭证管理。',
    badgeText: 'BW',
    badgeColor: 'bg-blue-600',
  },
  {
    extensionId: 'gighmmpiobklfepjocnamgkkbiglidom',
    name: 'AdBlock - 拦截整个网络的广告',
    category: '安全与辅助',
    description: '拦截弹窗广告、视频贴片广告与跟踪器，提升页面加载速度。',
    badgeText: 'AD',
    badgeColor: 'bg-rose-600',
  },
  {
    extensionId: 'cjpalhdlnbpafiamejdnhcphjbkeiagm',
    name: 'uBlock Origin',
    category: '安全与辅助',
    description: '轻量高效的内容拦截器，极低内存与 CPU 占用。',
    badgeText: 'uB',
    badgeColor: 'bg-red-700',
  },
  {
    extensionId: 'neebplgakaahbhdphmkckjjcegoiijjo',
    name: 'Keepa - Amazon Price Tracker',
    category: '电商工具',
    description: '亚马逊商品历史价格曲线、BSR 排名追踪与降价提醒，跨境选品核心工具。',
    badgeText: 'KP',
    badgeColor: 'bg-sky-600',
  },
  {
    extensionId: 'njmehopjdpcckochcggncklnlmikcbnb',
    name: 'Helium 10',
    category: '电商工具',
    description: '亚马逊卖家全套运营工具，支持选品分析、销量预估、关键词反查与利润计算。',
    badgeText: 'H10',
    badgeColor: 'bg-blue-700',
  },
  {
    extensionId: 'kbfnbcaeplbcioakkpcpgfkobkghlhen',
    name: 'Grammarly: AI Writing Assistant',
    category: '办公与效率',
    description: '英文语法纠错、地道润色与邮件写作辅助，海外沟通与社媒发帖必备。',
    badgeText: 'G',
    badgeColor: 'bg-emerald-500',
  },
  {
    extensionId: 'cofdbpoegempjloogbagkncekinflcnj',
    name: 'DeepL 翻译',
    category: '办公与效率',
    description: '高精度神经网络翻译，支持网页阅读翻译与输入框内一键写作翻译。',
    badgeText: 'DL',
    badgeColor: 'bg-slate-800',
  },
  {
    extensionId: 'chphlpgkkbolifaimnlloiipkdnihall',
    name: 'OneTab',
    category: '办公与效率',
    description: '一键将大量标签页收起为清单，节省高达 95% 的浏览器内存占用。',
    badgeText: '1T',
    badgeColor: 'bg-cyan-600',
  },
  {
    extensionId: 'fdpohaocaechififmbbbbbknoalclacl',
    name: 'GoFullPage - 全页截图',
    category: '通用工具',
    description: '一键滚动截取完整长网页，支持导出 PNG 与 PDF。',
    badgeText: 'FP',
    badgeColor: 'bg-teal-600',
  },
  {
    extensionId: 'idgpnmonknjnojddfkpgkljpfnnfcklj',
    name: 'ModHeader - Modify HTTP headers',
    category: '开发与数据',
    description: '自定义修改请求头与响应头，接口调试与自动化测试常用工具。',
    badgeText: 'MH',
    badgeColor: 'bg-amber-600',
  },
  {
    extensionId: 'ndgimibanhlabgdgjcpbbndiehljcpfh',
    name: 'SelectorsHub - XPath Helper',
    category: '开发与数据',
    description: '快速生成与验证 XPath、CSS Selector，配合 RPA 自动化流程开发极高效。',
    badgeText: 'SH',
    badgeColor: 'bg-violet-500',
  },
  {
    extensionId: 'bcjindcccaagfpapjjmafapmmgkkhgoa',
    name: 'JSON Formatter',
    category: '开发与数据',
    description: '自动美化高亮页面中的 JSON 数据，支持折叠展开与一键复制。',
    badgeText: '{}',
    badgeColor: 'bg-emerald-600',
  },
  {
    extensionId: 'efaidnbmnnnibpcajpcglclefindmkaj',
    name: 'Adobe Acrobat: PDF 编辑与查看',
    category: '办公与效率',
    description: '在浏览器中直接阅读、批注、填写表单和转换 PDF 文档。',
    badgeText: 'PDF',
    badgeColor: 'bg-red-600',
  },
  {
    extensionId: 'pkehgijcmpdhfbdbbnkijodmdjhbjlgp',
    name: 'Privacy Badger',
    category: '安全与辅助',
    description: 'EFF 出品的隐私保护插件，自动识别并拦截第三方隐形追踪器。',
    badgeText: 'PB',
    badgeColor: 'bg-orange-600',
  },
  {
    extensionId: 'eimadpbcbfnmbkopoojfekhnkhdbieeh',
    name: 'Dark Reader (深色模式)',
    category: '通用工具',
    description: '为所有网站智能启用护眼深色主题，可按站点单独调节亮度与对比度。',
    badgeText: 'DR',
    badgeColor: 'bg-slate-700',
  },
];
