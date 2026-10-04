import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { passwordSignIn, sendSignInCode, verifySignInCode, submitNewPassword, oauthScheme } from './emailAuth.ts';

const require = createRequire(import.meta.url);
const { manifestHost } = require('../scripts/manifest-host.cjs');
const ok = async () => ({ error: null });

test('password authentication uses the Core 3 password-specific method', async () => {
  let params;
  const resource = { password: async value => { params = value; return { error: null }; },
    create: () => { throw new Error('generic create must not be used for passwords'); } };
  await passwordSignIn(resource, '  member@example.test  ', 'example-password');
  assert.deepEqual(params, { emailAddress: 'member@example.test', password: 'example-password' });
});

test('returned password errors are surfaced, not treated as successful sign-in', async () => {
  const error = new Error('invalid verification strategy');
  await assert.rejects(passwordSignIn({ password: async () => ({ error }) }, 'member@example.test', 'example-password'), error);
});

test('email sign-in starts a fresh attempt and uses first-factor email code, not MFA', async () => {
  const calls = [];
  await sendSignInCode({
    reset: async () => calls.push('reset'),
    emailCode: { sendCode: async params => { calls.push(params); return { error: null }; } },
    mfa: { sendEmailCode: () => { throw new Error('not a second factor'); } },
  }, ' member@example.test ', false);
  assert.deepEqual(calls, ['reset', { emailAddress: 'member@example.test' }]);
});

test('password reset identifies the account before requesting its reset code', async () => {
  const calls = [];
  await sendSignInCode({
    reset: async () => calls.push('reset'),
    create: async params => { calls.push(params); return { error: null }; },
    resetPasswordEmailCode: { sendCode: async () => { calls.push('send reset code'); return { error: null }; } },
  }, ' member@example.test ', true);
  assert.deepEqual(calls, ['reset', { identifier: 'member@example.test' }, 'send reset code']);
});

test('identifier failure prevents sending a password reset code', async () => {
  const error = new Error('identifier rejected');
  await assert.rejects(sendSignInCode({
    reset: ok,
    create: async () => ({ error }),
    resetPasswordEmailCode: { sendCode: () => { throw new Error('must not send'); } },
  }, 'member@example.test', true), error);
});

test('wrong email codes propagate errors without advancing to a new password', async () => {
  const error = new Error('invalid code');
  await assert.rejects(verifySignInCode({
    emailCode: { verifyCode: async () => ({ error }) },
  }, 'example-code', false), error);
});

test('reset verification and new password submission use the reset namespace', async () => {
  const calls = [];
  const resource = { resetPasswordEmailCode: {
    verifyCode: async params => { calls.push(params); return { error: null }; },
    submitPassword: async params => { calls.push(params); return { error: null }; },
  } };
  await verifySignInCode(resource, ' example-code ', true);
  await submitNewPassword(resource, ' example-password ');
  assert.deepEqual(calls, [{ code: 'example-code' }, { password: ' example-password ' }]);
});

test('published manifest host retains the artifact path, not a platform route', () => {
  assert.equal(manifestHost('https://example.test', '/photomatrix-native/'), 'example.test/photomatrix-native');
  assert.equal(manifestHost('https://example.test', '/'), 'example.test');
});

test('only production Expo Go switches the OAuth return scheme to HTTPS', () => {
  assert.equal(oauthScheme(true, 'https://example.test/api/__clerk'), 'exps');
  assert.equal(oauthScheme(true, undefined), undefined);
  assert.equal(oauthScheme(false, 'https://example.test/api/__clerk'), undefined);
});