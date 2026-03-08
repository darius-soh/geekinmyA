import {
  CLAIM_INPUT_TYPES,
  CLAIM_VERDICTS,
} from '../../shared/claimCheckModel.js';

function normalizeKey(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';

  try {
    const parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    parsed.hash = '';
    parsed.search = '';
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return parsed.toString();
  } catch {
    return raw;
  }
}

export const claimCheckFixtures = [
  {
    id: 'lawrence-wong-prime-minister',
    match: {
      text: [
        'is pm lawrence wong the prime minister of singapore?',
        'is lawrence wong the prime minister of singapore?',
      ],
    },
    result: {
      inputType: CLAIM_INPUT_TYPES.OPEN_ENDED_QUESTION,
      normalizedClaim: 'Lawrence Wong is the Prime Minister of Singapore.',
      sourceCredibilityScore: null,
      claimSupportScore: 94,
      verdict: CLAIM_VERDICTS.SUPPORTED,
      confidence: 90,
      explanation: 'Official Singapore government material identifies Lawrence Wong as the Prime Minister of Singapore.',
      evidence: [
        {
          title: 'Prime Minister Lawrence Wong',
          url: 'https://www.pmo.gov.sg/',
          source: 'Prime Minister\'s Office Singapore',
          snippet: 'The Prime Minister\'s Office identifies Lawrence Wong as Prime Minister of Singapore.',
          stance: 'supports',
        },
        {
          title: 'Lawrence Wong',
          url: 'https://www.gov.sg/',
          source: 'Government of Singapore',
          snippet: 'Government of Singapore pages list Lawrence Wong as the Prime Minister.',
          stance: 'supports',
        },
      ],
      limitations: [],
    },
  },
  {
    id: 'moon-cheese',
    match: {
      text: [
        'the moon is made of cheese.',
        'the moon is made of cheese',
      ],
    },
    result: {
      inputType: CLAIM_INPUT_TYPES.PLAIN_CLAIM,
      normalizedClaim: 'The moon is made of cheese.',
      sourceCredibilityScore: null,
      claimSupportScore: 3,
      verdict: CLAIM_VERDICTS.UNSUPPORTED,
      confidence: 96,
      explanation: 'Primary science sources describe the Moon as a rocky natural satellite, not a food product.',
      evidence: [
        {
          title: 'Moon',
          url: 'https://science.nasa.gov/moon/',
          source: 'NASA',
          snippet: 'NASA describes the Moon as a rocky body formed from debris after an impact event.',
          stance: 'contradicts',
        },
        {
          title: 'The Moon',
          url: 'https://solarsystem.nasa.gov/moons/earths-moon/overview/',
          source: 'NASA Solar System Exploration',
          snippet: 'NASA materials explain the Moon\'s formation and geology, contradicting the cheese claim.',
          stance: 'contradicts',
        },
      ],
      limitations: [],
    },
  },
  {
    id: 'reputable-source-misleading-headline',
    match: {
      url: [
        'https://www.reuters.com/world/asia-pacific/sample-misleading-headline/',
      ],
    },
    result: {
      inputType: CLAIM_INPUT_TYPES.URL_ARTICLE,
      normalizedClaim: null,
      sourceCredibilityScore: 90,
      claimSupportScore: 31,
      verdict: CLAIM_VERDICTS.LIKELY_UNSUPPORTED,
      confidence: 74,
      explanation: 'The publication is reputable, but the article headline overstates what the supporting evidence confirms.',
      evidence: [
        {
          title: 'Official statement clarifying the policy scope',
          url: 'https://www.gov.sg/',
          source: 'Government of Singapore',
          snippet: 'The official statement contradicts the broader headline claim and limits the announcement to a narrower measure.',
          stance: 'contradicts',
        },
      ],
      limitations: [
        'Headline framing can diverge from the underlying evidence even on reputable sites.',
      ],
    },
  },
  {
    id: 'weak-source-accurate-quote',
    match: {
      url: [
        'https://rumour-mill.example/accurate-gov-statement',
      ],
    },
    result: {
      inputType: CLAIM_INPUT_TYPES.URL_ARTICLE,
      normalizedClaim: null,
      sourceCredibilityScore: 22,
      claimSupportScore: 89,
      verdict: CLAIM_VERDICTS.SUPPORTED,
      confidence: 76,
      explanation: 'The source itself is weak, but the article accurately reproduces an official statement that is supported by primary evidence.',
      evidence: [
        {
          title: 'Official government statement',
          url: 'https://www.gov.sg/',
          source: 'Government of Singapore',
          snippet: 'The official statement confirms the quoted factual claim.',
          stance: 'supports',
        },
      ],
      limitations: [
        'A weak source can still repeat a true claim when primary evidence is available.',
      ],
    },
  },
];

export function findClaimCheckFixture({ text = '', url = '' } = {}) {
  const normalizedText = normalizeKey(text);
  const normalizedUrl = normalizeKey(url);

  return claimCheckFixtures.find((fixture) => {
    const textMatch = fixture.match?.text?.some(entry => normalizeKey(entry) === normalizedText);
    const urlMatch = fixture.match?.url?.some(entry => normalizeKey(entry) === normalizedUrl);
    return Boolean(textMatch || urlMatch);
  }) || null;
}
