import test from 'node:test';
import assert from 'node:assert/strict';

import { claimCheckFixtures, findClaimCheckFixture } from '../src/data/claimCheckFixtures.js';
import {
  buildClaimCheckResult,
  CLAIM_INPUT_TYPES,
  detectClaimInputType,
  normalizeQuestionToClaim,
} from '../shared/claimCheckModel.js';

test('case 1: open-ended question becomes a claim and is supported', () => {
  const fixture = findClaimCheckFixture({
    text: 'Is PM Lawrence Wong the prime minister of Singapore?',
  });

  assert.ok(fixture, 'fixture should exist');
  assert.equal(
    detectClaimInputType({ text: 'Is PM Lawrence Wong the prime minister of Singapore?' }),
    CLAIM_INPUT_TYPES.OPEN_ENDED_QUESTION
  );

  const normalized = normalizeQuestionToClaim('Is PM Lawrence Wong the prime minister of Singapore?');
  assert.equal(normalized.normalizedClaim, 'Lawrence Wong is the Prime Minister of Singapore.');

  const result = buildClaimCheckResult({
    ...fixture.result,
    originalInput: 'Is PM Lawrence Wong the prime minister of Singapore?',
  });

  assert.equal(result.verdict, 'supported');
  assert.equal(result.sourceCredibilityScore, null);
});

test('case 2: unsupported plain claim stays unsupported', () => {
  const fixture = findClaimCheckFixture({
    text: 'The moon is made of cheese.',
  });

  assert.ok(fixture, 'fixture should exist');
  assert.equal(
    detectClaimInputType({ text: 'The moon is made of cheese.' }),
    CLAIM_INPUT_TYPES.PLAIN_CLAIM
  );

  const result = buildClaimCheckResult({
    ...fixture.result,
    originalInput: 'The moon is made of cheese.',
  });

  assert.equal(result.verdict, 'unsupported');
  assert.equal(result.claimSupportScore, 3);
});

test('case 3: strong source reputation does not force a supported verdict', () => {
  const fixture = claimCheckFixtures.find(item => item.id === 'reputable-source-misleading-headline');
  assert.ok(fixture, 'fixture should exist');

  const result = buildClaimCheckResult({
    ...fixture.result,
    originalInput: fixture.match.url[0],
  });

  assert.equal(
    detectClaimInputType({ url: fixture.match.url[0] }),
    CLAIM_INPUT_TYPES.URL_ARTICLE
  );
  assert.ok((result.sourceCredibilityScore || 0) >= 85);
  assert.ok(result.claimSupportScore < 40);
  assert.equal(result.verdict, 'likely_unsupported');
});

test('case 4: weak source can still carry a supported claim', () => {
  const fixture = claimCheckFixtures.find(item => item.id === 'weak-source-accurate-quote');
  assert.ok(fixture, 'fixture should exist');

  const result = buildClaimCheckResult({
    ...fixture.result,
    originalInput: fixture.match.url[0],
  });

  assert.ok((result.sourceCredibilityScore || 100) < 40);
  assert.ok(result.claimSupportScore >= 85);
  assert.equal(result.verdict, 'supported');
});

