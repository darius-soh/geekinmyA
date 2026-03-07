// Mock credibility analysis data for Sure Bo?
// Maps article IDs to detailed analysis results

const mockAnalysis = {
  'art-001': {
    credibility: 'credible',
    confidence: 92,
    explanation: 'This article reports on official government policy announcements with direct quotes from named officials. The information is consistent with publicly available government documents and has been covered by multiple credible news outlets.',
    summary: [
      'Singapore has updated its Green Plan with 2035 targets',
      'Solar energy capacity to double to 4 GWp',
      'EV charging network to expand to 60,000 points',
      'S$5 billion committed to green bonds',
    ],
    signals: {
      sourceReputation: 'high',
      consistency: 'high',
      crossSource: true,
      evidencePresent: true,
      headlineTone: 'neutral',
      recency: 'recent',
      officialSources: true,
    },
    recommendation: {
      action: 'This appears to be reliable reporting on official government policy. You can share this with confidence.',
      resources: [
        { name: 'Singapore Green Plan Official Website', url: 'https://www.greenplan.gov.sg/' },
        { name: 'NEA Official Page', url: 'https://www.nea.gov.sg/' },
      ],
      relatedArticleIds: ['art-004', 'art-010'],
    },
  },

  'art-002': {
    credibility: 'credible',
    confidence: 95,
    explanation: 'This article covers an official LTA announcement with specific verifiable details including dates, station names, and quotes from named officials. The information aligns with LTA\'s publicly available construction timeline.',
    summary: [
      'TEL Stage 5 will open 6 months early — September 2026',
      '4 new stations: Bayshore, Bedok South, Sungei Bedok, Tanjong Katong',
      'Expected to serve 100,000 daily commuters',
      'Property values along corridor already rising',
    ],
    signals: {
      sourceReputation: 'high',
      consistency: 'high',
      crossSource: true,
      evidencePresent: true,
      headlineTone: 'neutral',
      recency: 'recent',
      officialSources: true,
    },
    recommendation: {
      action: 'This is a well-sourced report on a government infrastructure announcement. The information is verifiable through LTA\'s official channels.',
      resources: [
        { name: 'LTA Official Website', url: 'https://www.lta.gov.sg/' },
        { name: 'Thomson-East Coast Line Info', url: 'https://www.lta.gov.sg/content/ltagov/en/upcoming_projects/rail_expansion/thomson_east_coast_line.html' },
      ],
      relatedArticleIds: ['art-001'],
    },
  },

  'art-003': {
    credibility: 'notCredible',
    confidence: 96,
    explanation: 'The original viral claims about water contamination are false. PUB has officially debunked these claims. The misinformation appears to stem from misinterpreted routine maintenance reports and doctored documents. This article correctly identifies the claims as false.',
    summary: [
      'Viral messages claiming water contamination are FALSE',
      'PUB confirms water supply is safe and meets WHO standards',
      'False claims originated from misinterpreted maintenance reports',
      'POFMA investigation underway',
    ],
    signals: {
      sourceReputation: 'high',
      consistency: 'high',
      crossSource: true,
      evidencePresent: true,
      headlineTone: 'neutral',
      recency: 'recent',
      officialSources: true,
    },
    recommendation: {
      action: 'The water contamination claims are confirmed false by official sources. Do not share the original rumours. If you see these messages, you can help by directing people to PUB\'s official statement.',
      resources: [
        { name: 'PUB Official Website', url: 'https://www.pub.gov.sg/' },
        { name: 'Gov.sg Factually', url: 'https://www.gov.sg/factually' },
        { name: 'ScamShield', url: 'https://www.scamshield.org.sg/' },
      ],
      relatedArticleIds: [],
    },
  },

  'art-004': {
    credibility: 'credible',
    confidence: 90,
    explanation: 'This article reports on verifiable corporate announcements with specific investment figures and job creation numbers. The companies mentioned have publicly confirmed these investments, and the reporting is consistent across multiple business news outlets.',
    summary: [
      'Google investing US$1.5B in AI research centre at Punggol',
      'Microsoft doubling Azure data centre capacity in Jurong',
      'NVIDIA establishing first SEA chip design lab at one-north',
      'Over 3,000 new jobs expected in 3 years',
    ],
    signals: {
      sourceReputation: 'high',
      consistency: 'high',
      crossSource: true,
      evidencePresent: true,
      headlineTone: 'neutral',
      recency: 'recent',
      officialSources: true,
    },
    recommendation: {
      action: 'Well-sourced business reporting. The investment announcements are verifiable through corporate press releases.',
      resources: [
        { name: 'EDB Singapore', url: 'https://www.edb.gov.sg/' },
        { name: 'IMDA Singapore', url: 'https://www.imda.gov.sg/' },
      ],
      relatedArticleIds: ['art-010', 'art-001'],
    },
  },

  'art-005': {
    credibility: 'credible',
    confidence: 88,
    explanation: 'Financial reporting based on publicly available quarterly earnings results from listed companies. The earnings figures are verifiable through SGX filings and the banks\' investor relations pages.',
    summary: [
      'DBS net profit: S$3.2B, OCBC: S$1.9B, UOB: S$1.7B — all records',
      'STI surpassed 3,800 — highest in 5 years',
      'STI up 12% year-to-date',
      'Foreign investors net buyers for 8 consecutive weeks',
    ],
    signals: {
      sourceReputation: 'high',
      consistency: 'high',
      crossSource: true,
      evidencePresent: true,
      headlineTone: 'neutral',
      recency: 'recent',
      officialSources: true,
    },
    recommendation: {
      action: 'Reliable financial reporting based on public company filings. Note that analyst predictions about future performance involve inherent uncertainty.',
      resources: [
        { name: 'SGX Market Data', url: 'https://www.sgx.com/' },
        { name: 'MAS Statistics', url: 'https://www.mas.gov.sg/' },
      ],
      relatedArticleIds: ['art-012'],
    },
  },

  'art-006': {
    credibility: 'mixed',
    confidence: 72,
    explanation: 'This article correctly identifies that the viral post mixes real and false claims. The HDB policy changes referenced are real, but the claim that prices will "double" is unsupported. The article does a good job distinguishing verified facts from speculation.',
    summary: [
      'EHG and income ceiling changes are real — confirmed by HDB',
      'Claim that prices will "double" is unsupported and exaggerated',
      'Property analysts project moderate 3-5% increase at most',
      'Original viral post mixed real facts with wild speculation',
    ],
    signals: {
      sourceReputation: 'medium',
      consistency: 'medium',
      crossSource: true,
      evidencePresent: true,
      headlineTone: 'neutral',
      recency: 'recent',
      officialSources: true,
    },
    recommendation: {
      action: 'The underlying HDB policy changes are real, but the "doubling" claim is false. Check HDB\'s official website for accurate policy details before making housing decisions.',
      resources: [
        { name: 'HDB Official Website', url: 'https://www.hdb.gov.sg/' },
        { name: 'HDB BTO Information', url: 'https://www.hdb.gov.sg/residential/buying-a-flat/buying-procedure-for-new-flats' },
        { name: 'Gov.sg Factually', url: 'https://www.gov.sg/factually' },
      ],
      relatedArticleIds: ['art-003', 'art-013'],
    },
  },

  'art-007': {
    credibility: 'credible',
    confidence: 91,
    explanation: 'Official announcement about sports infrastructure investment with specific budget figures and timelines. The information is consistent with Singapore\'s publicly stated plans to host the 2027 SEA Games.',
    summary: [
      'S$200M investment in Sports Hub upgrades',
      'Capacity expanding from 55,000 to 62,000 seats',
      'New retractable roof and broadcast facilities',
      'Completion expected Q1 2027, ahead of July Games',
    ],
    signals: {
      sourceReputation: 'high',
      consistency: 'high',
      crossSource: true,
      evidencePresent: true,
      headlineTone: 'neutral',
      recency: 'recent',
      officialSources: true,
    },
    recommendation: {
      action: 'Reliable reporting on government infrastructure project. Details are verifiable through Sport Singapore and MCCY.',
      resources: [
        { name: 'Sport Singapore', url: 'https://www.sportsingapore.gov.sg/' },
      ],
      relatedArticleIds: ['art-014'],
    },
  },

  'art-008': {
    credibility: 'credible',
    confidence: 87,
    explanation: 'This article reports on WHO policy changes and Singapore\'s MOH response. Both are verifiable through official channels. The reporting is balanced and notes that local policy adjustments are still pending review.',
    summary: [
      'WHO has updated COVID-19 surveillance guidelines',
      'Reduced testing for mild cases, updated booster schedules',
      'Singapore MOH reviewing — will announce changes in 2 weeks',
      'SG maintains voluntary masking in healthcare settings',
    ],
    signals: {
      sourceReputation: 'high',
      consistency: 'high',
      crossSource: true,
      evidencePresent: true,
      headlineTone: 'neutral',
      recency: 'recent',
      officialSources: true,
    },
    recommendation: {
      action: 'Reliable health reporting. Policy changes are still being reviewed by MOH, so wait for official Singapore-specific announcements before changing behaviour.',
      resources: [
        { name: 'MOH Official Website', url: 'https://www.moh.gov.sg/' },
        { name: 'WHO COVID-19 Dashboard', url: 'https://www.who.int/' },
      ],
      relatedArticleIds: ['art-011'],
    },
  },

  'art-009': {
    credibility: 'credible',
    confidence: 94,
    explanation: 'This is a legitimate police advisory about an ongoing scam operation. The information comes from the Singapore Police Force\'s official channels and MAS. The scam itself is well-documented and has been covered by multiple credible outlets.',
    summary: [
      'Coordinated crypto investment scam via WhatsApp',
      'Uses AI deepfakes of local celebrities',
      'Over 150 reports, S$8M+ in losses',
      'Three domains added to MAS investor alert list',
    ],
    signals: {
      sourceReputation: 'high',
      consistency: 'high',
      crossSource: true,
      evidencePresent: true,
      headlineTone: 'neutral',
      recency: 'recent',
      officialSources: true,
    },
    recommendation: {
      action: 'This is a verified police advisory. If you or someone you know has been approached by similar schemes, report to SPF and contact your bank immediately. Share this advisory to help protect others.',
      resources: [
        { name: 'MAS Investor Alert List', url: 'https://www.mas.gov.sg/investor-alert-list' },
        { name: 'ScamShield App', url: 'https://www.scamshield.org.sg/' },
        { name: 'SPF Police Report', url: 'https://eservices.police.gov.sg/' },
      ],
      relatedArticleIds: [],
    },
  },

  'art-010': {
    credibility: 'credible',
    confidence: 89,
    explanation: 'Coverage of an upcoming government-hosted international event with confirmed participation from named organizations. The reporting is consistent with Singapore\'s stated digital policy goals.',
    summary: [
      'Global AI Regulation Summit in Singapore — April 2026',
      'Over 40 countries confirmed participation',
      'Major AI companies including OpenAI, DeepMind, Anthropic attending',
      'Will include public forums for citizen input',
    ],
    signals: {
      sourceReputation: 'high',
      consistency: 'high',
      crossSource: true,
      evidencePresent: true,
      headlineTone: 'neutral',
      recency: 'recent',
      officialSources: true,
    },
    recommendation: {
      action: 'Reliable reporting on an upcoming diplomatic event. Details may evolve as the event date approaches.',
      resources: [
        { name: 'IMDA AI Governance', url: 'https://www.imda.gov.sg/' },
      ],
      relatedArticleIds: ['art-004'],
    },
  },

  'art-011': {
    credibility: 'notCredible',
    confidence: 97,
    explanation: 'The health supplement\'s claims of curing diabetes, cancer, and heart disease have no clinical evidence. The product is not registered with HSA and has not undergone any regulatory review. Medical professionals have publicly warned against it.',
    summary: [
      'Unlicensed supplement claims to cure multiple chronic diseases',
      'No clinical evidence or HSA registration',
      'Patients reportedly stopping prescribed medication — dangerous',
      'HSA investigating distribution channels',
    ],
    signals: {
      sourceReputation: 'high',
      consistency: 'high',
      crossSource: true,
      evidencePresent: true,
      headlineTone: 'neutral',
      recency: 'recent',
      officialSources: true,
    },
    recommendation: {
      action: 'The health claims about this supplement are not supported by evidence. Do NOT stop taking prescribed medication. Consult your doctor before taking any supplements. Report suspicious health products to HSA.',
      resources: [
        { name: 'HSA Official Website', url: 'https://www.hsa.gov.sg/' },
        { name: 'MOH Singapore', url: 'https://www.moh.gov.sg/' },
        { name: 'HealthHub', url: 'https://www.healthhub.sg/' },
      ],
      relatedArticleIds: [],
    },
  },

  'art-012': {
    credibility: 'credible',
    confidence: 85,
    explanation: 'This article provides balanced analysis of trade tensions with citations from government officials, economists, and industry groups. The GDP impact estimates are attributed to specific analysts. The article acknowledges uncertainty about future developments.',
    summary: [
      'New US tariffs on Chinese tech exports, China retaliates on rare earths',
      'Singapore\'s trade sector (170% of GDP) potentially affected',
      'MTI monitoring situation — FTAs provide buffer',
      'Electronics/semiconductor sector most vulnerable',
    ],
    signals: {
      sourceReputation: 'high',
      consistency: 'high',
      crossSource: true,
      evidencePresent: true,
      headlineTone: 'neutral',
      recency: 'recent',
      officialSources: true,
    },
    recommendation: {
      action: 'Reliable analysis of an evolving geopolitical situation. Economic predictions involve inherent uncertainty — the actual impact will depend on how trade negotiations develop.',
      resources: [
        { name: 'MTI Singapore', url: 'https://www.mti.gov.sg/' },
        { name: 'Enterprise Singapore', url: 'https://www.enterprisesg.gov.sg/' },
      ],
      relatedArticleIds: ['art-005'],
    },
  },

  'art-013': {
    credibility: 'notCredible',
    confidence: 98,
    explanation: 'The "underground city" claim is entirely false. The construction activity cited as evidence is the publicly announced Cross Island Line project. URA has officially denied the claim. The conspiracy theory originated from a satirical post taken out of context.',
    summary: [
      'Conspiracy theory about secret underground city is FALSE',
      'Construction is the publicly announced Cross Island Line',
      'URA officially denied the claim',
      'Originated from satirical post shared without context',
    ],
    signals: {
      sourceReputation: 'medium',
      consistency: 'high',
      crossSource: true,
      evidencePresent: true,
      headlineTone: 'neutral',
      recency: 'outdated',
      officialSources: true,
    },
    recommendation: {
      action: 'This conspiracy theory has been officially debunked. The construction activity has a straightforward explanation. Do not share the false claim.',
      resources: [
        { name: 'URA Official Website', url: 'https://www.ura.gov.sg/' },
        { name: 'Cross Island Line Info', url: 'https://www.lta.gov.sg/content/ltagov/en/upcoming_projects/rail_expansion/cross_island_line.html' },
        { name: 'Gov.sg Factually', url: 'https://www.gov.sg/factually' },
      ],
      relatedArticleIds: [],
    },
  },

  'art-014': {
    credibility: 'credible',
    confidence: 86,
    explanation: 'Standard sports preview article from a reputable outlet. The team information and schedule details are verifiable through the Football Association of Singapore.',
    summary: [
      '2026 SPL season kicks off this weekend',
      'Albirex Niigata defending, Lion City Sailors and Tampines challenging',
      'FAS CEO calls it "most competitive season"',
      'Matches available on Mediacorp streaming',
    ],
    signals: {
      sourceReputation: 'high',
      consistency: 'high',
      crossSource: true,
      evidencePresent: true,
      headlineTone: 'neutral',
      recency: 'recent',
      officialSources: false,
    },
    recommendation: {
      action: 'Reliable sports reporting. Check FAS for official match schedules and team updates.',
      resources: [
        { name: 'Football Association of Singapore', url: 'https://www.fas.org.sg/' },
      ],
      relatedArticleIds: ['art-007'],
    },
  },

  'art-015': {
    credibility: 'mixed',
    confidence: 75,
    explanation: 'The underlying study is real and peer-reviewed, but social media posts have misrepresented correlation as causation. The article correctly notes the distinction. The study\'s findings are valid but limited — the researchers themselves warn against overinterpretation.',
    summary: [
      'NUS study: teens with 4+ hours screen time report 35% more sleep issues',
      'Study surveyed 5,000 students across 40 schools',
      'Researchers explicitly caution: correlation ≠ causation',
      'Social media posts misrepresenting findings as definitive proof',
    ],
    signals: {
      sourceReputation: 'high',
      consistency: 'medium',
      crossSource: true,
      evidencePresent: true,
      headlineTone: 'neutral',
      recency: 'recent',
      officialSources: true,
    },
    recommendation: {
      action: 'The study is real, but be cautious about overstating its conclusions. The researchers themselves warn against interpreting correlation as causation. The findings suggest a relationship worth monitoring, not a definitive cause-and-effect.',
      resources: [
        { name: 'Singapore Medical Journal', url: 'https://www.smj.org.sg/' },
        { name: 'HealthHub Sleep Tips', url: 'https://www.healthhub.sg/' },
      ],
      relatedArticleIds: ['art-008', 'art-011'],
    },
  },
};

export { mockAnalysis };
export default mockAnalysis;
