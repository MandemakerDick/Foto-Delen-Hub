import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AccountEpoch } from './accountEpoch.ts';
import { QueryClient } from '@tanstack/react-query';

test('late callbacks from the first A are rejected after A -> B -> A', () => {
  const session = new AccountEpoch('A');
  const original = session.observe('A');
  assert.equal(session.observe('A'), original);
  session.observe('B');
  const returned = session.observe('A');
  assert.equal(session.isCurrent(original), false);
  assert.equal(session.isCurrent(returned), true);
});

test('sign-out invalidates work immediately, before cache cleanup effects', () => {
  const session = new AccountEpoch('A');
  const pending = session.observe('A');
  session.observe(null);
  assert.equal(session.isCurrent(pending), false);
});

test('a late profile-save callback cannot replace the returned account’s current profile', async () => {
  const client = new QueryClient();
  const session = new AccountEpoch('A');
  const captured = session.observe('A');
  let complete;
  const pending = new Promise(resolve => { complete = resolve; });
  const callback = pending.then(profile => {
    if (session.isCurrent(captured)) client.setQueryData(['/api/me'], profile);
  });
  session.observe('B');
  session.observe('A');
  client.setQueryData(['/api/me'], { name: 'Current profile' });
  complete({ name: 'Obsolete saved profile' });
  await callback;
  assert.equal(client.getQueryData(['/api/me']).name, 'Current profile');
  client.clear();
});