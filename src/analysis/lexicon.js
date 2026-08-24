

export const POSITIVE_WORDS = {
  amazing: 3, awesome: 3, excellent: 3, fantastic: 3, outstanding: 3,
  perfect: 3, incredible: 3, brilliant: 3, superb: 3, phenomenal: 3,
  love: 3, loves: 3, loved: 3, flawless: 3, lifesaver: 3, gamechanger: 3,

  great: 2, good: 2, solid: 2, reliable: 2, impressive: 2, smooth: 2,
  intuitive: 2, polished: 2, seamless: 2, fast: 2, responsive: 2,
  helpful: 2, useful: 2, worth: 2, recommend: 2, recommended: 2,
  enjoy: 2, enjoyed: 2, happy: 2, satisfied: 2, pleased: 2, stable: 2,
  affordable: 2, generous: 2, thoughtful: 2, elegant: 2, clean: 2,
  powerful: 2, robust: 2, delightful: 2, refreshing: 2, wins: 2,

  nice: 1, fine: 1, decent: 1, okay: 1, ok: 1,
  better: 1, improved: 1, improving: 1, easy: 1, simple: 1, handy: 1,
  convenient: 1, cheap: 1, quick: 1, friendly: 1, sleek: 1, neat: 1,
  like: 1, likes: 1, liked: 1, appreciate: 1, glad: 1, upgrade: 1,
}

export const NEGATIVE_WORDS = {
  terrible: -3, awful: -3, horrible: -3, garbage: -3, useless: -3,
  disaster: -3, scam: -3, fraud: -3, atrocious: -3, unusable: -3,
  hate: -3, hates: -3, hated: -3, worst: -3, abysmal: -3, disgusting: -3,
  infuriating: -3, nightmare: -3, betrayal: -3, predatory: -3,

  bad: -2, poor: -2, broken: -2, buggy: -2, slow: -2, laggy: -2,
  crash: -2, crashes: -2, crashed: -2, crashing: -2, fails: -2,
  failing: -2, failed: -2, failure: -2, unreliable: -2, frustrating: -2,
  frustrated: -2, annoying: -2, annoyed: -2, disappointing: -2,
  disappointed: -2, overpriced: -2, expensive: -2, pricey: -2,
  confusing: -2, clunky: -2, bloated: -2, sluggish: -2, unstable: -2,
  regret: -2, avoid: -2, cancel: -2, cancelled: -2, canceling: -2,
  cancelling: -2, downgrade: -2, ripoff: -2, greedy: -2, ignored: -2,
  misleading: -2, outage: -2, downtime: -2,

  meh: -1, mediocre: -1, lacking: -1, missing: -1, limited: -1,
  worse: -1, glitch: -1, glitchy: -1, glitches: -1, bug: -1, bugs: -1,
  issue: -1, issues: -1, problem: -1, problems: -1, complaint: -1,
  complaints: -1, wish: -1, unfortunately: -1, struggle: -1,
  struggling: -1, difficult: -1, hard: -1, hassle: -1, clutter: -1,
  cluttered: -1, dated: -1, stale: -1, wait: -1, waiting: -1,
}

export const NEGATIONS = new Set([
  'not', 'no', 'never', 'none', 'nothing', 'neither', 'nor', 'cannot',
  "can't", 'cant', "won't", 'wont', "doesn't", 'doesnt', "didn't", 'didnt',
  "isn't", 'isnt', "aren't", 'arent', "wasn't", 'wasnt', "wouldn't",
  'wouldnt', "couldn't", 'couldnt', "shouldn't", 'shouldnt', 'without',
  'hardly', 'barely', 'rarely', 'lacks', 'lack',
])

export const INTENSIFIERS = {
  very: 1.4, really: 1.35, extremely: 1.6, incredibly: 1.6, absolutely: 1.5,
  completely: 1.4, totally: 1.4, super: 1.35, so: 1.25, quite: 1.15,
  particularly: 1.2, especially: 1.2, insanely: 1.5, ridiculously: 1.45,
  seriously: 1.3, genuinely: 1.25, truly: 1.3, way: 1.3, far: 1.25,
  slightly: 0.6, somewhat: 0.7, kinda: 0.7, kind: 0.8, sort: 0.8,
  a: 1, bit: 0.65, little: 0.7, mildly: 0.6, fairly: 0.85, pretty: 1.1,
}

export const STOPWORDS = new Set([
  'a','about','above','after','again','all','also','am','an','and','any','are',
  'as','at','be','been','before','being','below','between','both','but','by',
  'can','did','do','does','doing','down','during','each','few','for','from',
  'further','had','has','have','having','he','her','here','hers','him','his',
  'how','i','if','in','into','is','it','its','just','me','more','most','my',
  'no','nor','not','now','of','off','on','once','only','or','other','our',
  'out','over','own','same','she','should','so','some','such','than','that',
  'the','their','them','then','there','these','they','this','those','through',
  'to','too','under','until','up','very','was','we','were','what','when',
  'where','which','while','who','whom','why','will','with','would','you',
  'your','yours','im','ive','id','dont','doesnt','didnt','thats','theres',
  'youre','theyre','isnt','wasnt','cant','wont','really','get','got','getting',
  'like','one','two','make','makes','made','use','used','using','still','even',
  'much','many','lot','lots','way','thing','things','stuff','actually','pretty',
  'need','needs','want','wants','know','think','see','say','said','going','go',
  'well','back','around','something','anything','everything','someone','people',
  'guy','guys','edit','tldr','yeah','yes','okay','ok','maybe','probably','sure',
  'every','since','though','although','because','anyone','ever','never','always',
  'new','last','first','next','old','day','days','week','weeks','month',
  'months','year','years','time','times','today','long','short','big',
  'able','give','gives','takes','take','come','comes','put','keep','keeps',
])

export const TOPIC_TAXONOMY = [
  {
    id: 'pricing',
    label: 'Pricing & Value',
    keywords: ['price', 'pricing', 'cost', 'costs', 'expensive', 'cheap',
      'affordable', 'subscription', 'paywall', 'free tier', 'refund',
      'billing', 'charge', 'charged', 'overpriced', 'worth the money',
      'value for money', 'per month', 'per seat', 'renewal', 'discount'],
  },
  {
    id: 'performance',
    label: 'Performance & Speed',
    keywords: ['slow', 'fast', 'speed', 'performance', 'lag', 'laggy',
      'latency', 'load time', 'loading', 'freeze', 'freezes', 'memory',
      'ram', 'cpu', 'battery', 'sluggish', 'snappy', 'responsive',
      'optimized', 'bloated'],
  },
  {
    id: 'reliability',
    label: 'Reliability & Bugs',
    keywords: ['bug', 'bugs', 'buggy', 'crash', 'crashes', 'crashed',
      'crashing', 'broken', 'breaks', 'outage', 'downtime', 'unstable',
      'stable', 'glitch', 'glitches', 'glitchy', 'error', 'errors',
      'data loss', 'sync issue', 'reliability', 'reliable', 'unreliable',
      'uptime', 'regression', 'freezes', 'freezing'],
  },
  {
    id: 'ux',
    label: 'UX & Design',
    keywords: ['ui', 'ux', 'interface', 'design', 'layout', 'usability',
      'intuitive', 'confusing', 'clunky', 'clean', 'dark mode', 'theme',
      'navigation', 'onboarding', 'learning curve', 'workflow', 'cluttered',
      'polished', 'redesign'],
  },
  {
    id: 'support',
    label: 'Customer Support',
    keywords: ['support', 'customer service', 'help desk', 'ticket',
      'response time', 'chatbot', 'refund request', 'agent', 'rep',
      'escalate', 'no reply', 'ignored', 'support team'],
  },
  {
    id: 'features',
    label: 'Features & Roadmap',
    keywords: ['feature', 'features', 'roadmap', 'update', 'updates',
      'release', 'new version', 'missing feature', 'feature request',
      'integration', 'integrations', 'api', 'plugin', 'extension',
      'customization', 'templates', 'automation'],
  },
  {
    id: 'privacy',
    label: 'Privacy & Trust',
    keywords: ['privacy', 'data', 'tracking', 'telemetry', 'gdpr',
      'security', 'breach', 'encryption', 'sells data', 'trust',
      'terms of service', 'policy change', 'ads', 'advertising'],
  },
  {
    id: 'ai',
    label: 'AI Capabilities',
    keywords: ['ai', 'llm', 'model', 'gpt', 'copilot', 'assistant',
      'hallucinate', 'hallucination', 'prompt', 'machine learning',
      'ai features', 'autocomplete', 'agent mode'],
  },
  {
    id: 'migration',
    label: 'Switching & Migration',
    keywords: ['switch', 'switched', 'switching', 'migrate', 'migrated',
      'migration', 'moved to', 'moving to', 'alternative', 'alternatives',
      'replace', 'replaced', 'export', 'import', 'lock-in', 'leaving'],
  },
  {
    id: 'mobile',
    label: 'Mobile Experience',
    keywords: ['mobile', 'ios', 'android', 'app store', 'play store',
      'phone', 'tablet', 'ipad', 'mobile app', 'notifications'],
  },
]

export const BRAND_GROUPS = [
  {
    market: 'Productivity & Notes',
    brands: ['Notion', 'Obsidian', 'Evernote', 'OneNote', 'Roam Research',
      'Craft', 'Bear', 'Logseq', 'Apple Notes', 'Coda'],
  },
  {
    market: 'Project Management',
    brands: ['Asana', 'Trello', 'Jira', 'Linear', 'ClickUp', 'Monday.com',
      'Basecamp', 'Height', 'Shortcut'],
  },
  {
    market: 'Team Communication',
    brands: ['Slack', 'Microsoft Teams', 'Discord', 'Zoom', 'Google Meet',
      'Mattermost', 'Zulip'],
  },
  {
    market: 'Design Tools',
    brands: ['Figma', 'Sketch', 'Adobe XD', 'Framer', 'Penpot', 'Canva',
      'Photoshop', 'Illustrator', 'Affinity'],
  },
  {
    market: 'Cloud & Hosting',
    brands: ['AWS', 'Google Cloud', 'Azure', 'Vercel', 'Netlify',
      'Cloudflare', 'DigitalOcean', 'Heroku', 'Render', 'Fly.io'],
  },
  {
    market: 'Streaming',
    brands: ['Netflix', 'Disney+', 'Hulu', 'HBO Max', 'Max', 'Prime Video',
      'Apple TV+', 'Peacock', 'Paramount+', 'Spotify', 'YouTube Premium'],
  },
  {
    market: 'Consumer Tech',
    brands: ['Apple', 'Samsung', 'Google', 'Microsoft', 'Sony', 'OnePlus',
      'Pixel', 'iPhone', 'Xiaomi', 'Nothing'],
  },
  {
    market: 'Automotive',
    brands: ['Tesla', 'Rivian', 'Lucid', 'Ford', 'BMW', 'Mercedes',
      'Hyundai', 'Kia', 'Toyota', 'Polestar'],
  },
  {
    market: 'Finance & Fintech',
    brands: ['Revolut', 'Monzo', 'Chase', 'Wise', 'PayPal', 'Stripe',
      'Robinhood', 'Coinbase', 'Cash App', 'Venmo'],
  },
  {
    market: 'AI Assistants',
    brands: ['ChatGPT', 'Claude', 'Gemini', 'Copilot', 'Perplexity',
      'Midjourney', 'Cursor', 'Llama', 'Mistral'],
  },
  {
    market: 'E-commerce & Retail',
    brands: ['Amazon', 'Shopify', 'Etsy', 'eBay', 'Walmart', 'Target',
      'Temu', 'Shein', 'Costco'],
  },
  {
    market: 'Ride & Delivery',
    brands: ['Uber', 'Lyft', 'DoorDash', 'Grubhub', 'Instacart', 'Bolt',
      'Uber Eats'],
  },
]

export const ALL_BRANDS = [...new Set(BRAND_GROUPS.flatMap((g) => g.brands))]

export const COMPARISON_PATTERNS = [
  { id: 'versus', label: 'Direct comparison', regex: /\b(?:vs\.?|versus)\b/i },
  { id: 'switched', label: 'Switched away', regex: /\b(?:switched|moved|migrated|jumped)\s+(?:from|to|over to)\b/i },
  { id: 'better', label: 'Rated better', regex: /\b(?:better|superior|nicer|smoother|cleaner)\s+than\b/i },
  { id: 'worse', label: 'Rated worse', regex: /\b(?:worse|clunkier|slower|uglier)\s+than\b/i },
  { id: 'alternative', label: 'Seeking alternative', regex: /\b(?:alternative|alternatives|replacement|instead of|in place of)\b/i },
  { id: 'cheaper', label: 'Price comparison', regex: /\b(?:cheaper|pricier|more expensive|less expensive|costs? (?:more|less))\b/i },
]

export const THEME_BUCKETS = [
  { id: 'ease-of-use', label: 'Ease of use', keywords: ['intuitive', 'easy', 'simple', 'straightforward', 'learning curve', 'onboarding', 'confusing', 'clunky', 'complicated'] },
  { id: 'speed', label: 'Speed', keywords: ['fast', 'quick', 'snappy', 'slow', 'lag', 'laggy', 'sluggish', 'load time', 'performance'] },
  { id: 'price', label: 'Price', keywords: ['price', 'pricing', 'cost', 'expensive', 'cheap', 'affordable', 'overpriced', 'worth', 'subscription', 'free tier'] },
  { id: 'stability', label: 'Stability', keywords: ['stable', 'reliable', 'crash', 'bug', 'buggy', 'broken', 'outage', 'downtime', 'glitch'] },
  { id: 'design', label: 'Design', keywords: ['design', 'ui', 'interface', 'beautiful', 'polished', 'clean', 'ugly', 'cluttered', 'dated'] },
  { id: 'support-quality', label: 'Support quality', keywords: ['support', 'customer service', 'help', 'response', 'ticket', 'ignored', 'refund'] },
  { id: 'feature-depth', label: 'Feature depth', keywords: ['feature', 'features', 'powerful', 'flexible', 'customization', 'missing', 'limited', 'lacking'] },
  { id: 'integrations', label: 'Integrations', keywords: ['integration', 'integrations', 'api', 'plugin', 'extension', 'export', 'import', 'sync'] },
  { id: 'trust', label: 'Trust & privacy', keywords: ['privacy', 'trust', 'data', 'tracking', 'ads', 'security', 'breach', 'policy'] },
  { id: 'value', label: 'Overall value', keywords: ['worth it', 'value', 'recommend', 'regret', 'cancel', 'renew', 'keeping', 'staying'] },
]
