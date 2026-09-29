import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { clearPrivateAccountCaches } from './privateCache.ts';

async function until(condition) {
  const deadline = Date.now() + 2000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('New account data did not load');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

test('sign-out and sign-in as another member cannot show the previous member’s cached photos or likes', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const profileKey = ['/api/me'];
  const photosKey = ['my-photos', 11];
  const likeKey = ['photo-like', 42];
  const generatedLikeKey = ['/api/photos/42/like'];
  const galleryKey = ['/api/photos/gallery', { limit: 24 }];
  const gallery = { pages: [{ photos: [{ id: 42 }] }], pageParams: [undefined] };

  // First signed-in account has already populated its private queries.
  client.setQueryData(profileKey, { name: 'Member A' });
  client.setQueryData(photosKey, [{ title: 'Member A private list' }]);
  client.setQueryData(likeKey, { liked: true });
  client.setQueryData(generatedLikeKey, { liked: true });
  client.setQueryData(galleryKey, gallery);
  client.setQueryData(['/api/photos/42'], { title: 'Public photo' });
  client.setQueryData(['/api/photographers'], [{ name: 'Public photographer' }]);

  // Clerk changes from A to signed out. The navigation subtree is hidden and
  // its observers unmounted before this removal runs.
  clearPrivateAccountCaches(client);
  for (const key of [profileKey, photosKey, likeKey, generatedLikeKey]) {
    assert.equal(client.getQueryData(key), undefined);
  }
  assert.deepEqual(client.getQueryData(galleryKey), gallery);
  assert.equal(client.getQueryData(['/api/photos/42']).title, 'Public photo');
  assert.equal(client.getQueryData(['/api/photographers'])[0].name, 'Public photographer');

  // Clerk signs in account B. A newly mounted observer must have no A data
  // before B's request completes, even with a long staleTime.
  const profile = new QueryObserver(client, {
    queryKey: profileKey, queryFn: async () => ({ name: 'Member B' }),
  });
  const like = new QueryObserver(client, {
    queryKey: likeKey, queryFn: async () => ({ liked: false }),
  });
  const stopProfile = profile.subscribe(() => {});
  const stopLike = like.subscribe(() => {});
  try {
    assert.notEqual(profile.getCurrentResult().data?.name, 'Member A');
    assert.notEqual(like.getCurrentResult().data?.liked, true);
    await until(() => profile.getCurrentResult().data?.name === 'Member B');
    await until(() => like.getCurrentResult().data?.liked === false);
    client.setQueryData(['my-photos', 22], [{ title: 'Member B list' }]);
  } finally {
    stopProfile();
    stopLike();
  }

  // Switching directly to another identity also drops B, not public Gallery.
  clearPrivateAccountCaches(client);
  assert.equal(client.getQueryData(profileKey), undefined);
  assert.equal(client.getQueryData(['my-photos', 22]), undefined);
  assert.equal(client.getQueryData(likeKey), undefined);
  assert.deepEqual(client.getQueryData(galleryKey), gallery);
  client.clear();
});

test('an earlier account’s in-flight profile response cannot restore its removed cache', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let finishOldRequest;
  const oldRequest = new Promise(resolve => { finishOldRequest = resolve; });
  const oldProfile = new QueryObserver(client, {
    queryKey: ['/api/me'],
    queryFn: async () => { await oldRequest; return { name: 'Member A' }; },
  });
  const stopOld = oldProfile.subscribe(() => {});
  await until(() => client.getQueryState(['/api/me'])?.fetchStatus === 'fetching');

  // On identity change the old navigation subtree is unmounted first.
  stopOld();
  clearPrivateAccountCaches(client);
  const newProfile = new QueryObserver(client, {
    queryKey: ['/api/me'],
    queryFn: async () => ({ name: 'Member B' }),
  });
  const stopNew = newProfile.subscribe(() => {});
  try {
    finishOldRequest();
    await until(() => newProfile.getCurrentResult().data?.name === 'Member B');
    assert.equal(client.getQueryData(['/api/me']).name, 'Member B');
  } finally {
    stopNew();
    client.clear();
  }
});