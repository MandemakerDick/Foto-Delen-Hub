import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { invalidatePhotoCaches } from './photoCache.ts';

async function until(condition) {
  const deadline = Date.now() + 2000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('Cached photo count did not refresh');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

test('photo create/delete refreshes mounted directory counts and cached screens on return', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  let serverCount = 4;
  const fetchCount = async () => ({ photoCount: serverCount });
  const photographerList = ['/api/photographers'];
  const mountedDirectory = ['directory-photographer', 7];
  const inactiveKeys = [
    ['/api/photographers/7'], ['/api/clubs'], ['/api/clubs/2'],
    ['/api/themes'], ['/api/themes/3'], ['/api/photos'],
    ['/api/photos/gallery', { sort: 'newest' }], ['/api/photos/9'],
    ['directory-club', 2], ['directory-theme', 3],
    ['directory-photos', 'clubs', 2], ['my-photos', 7],
  ];
  for (const key of [photographerList, mountedDirectory, ...inactiveKeys]) {
    client.setQueryData(key, { photoCount: serverCount });
  }
  client.setQueryData(['/api/me'], { name: 'Unrelated profile' });
  const list = new QueryObserver(client, { queryKey: photographerList, queryFn: fetchCount });
  const detail = new QueryObserver(client, { queryKey: mountedDirectory, queryFn: fetchCount });
  const stopList = list.subscribe(() => {});
  const stopDetail = detail.subscribe(() => {});

  try {
    serverCount = 5; // upload completed
    await invalidatePhotoCaches(client);
    assert.equal(list.getCurrentResult().data.photoCount, 5);
    assert.equal(detail.getCurrentResult().data.photoCount, 5);
    for (const key of inactiveKeys) assert.equal(client.getQueryState(key)?.isInvalidated, true);
    assert.equal(client.getQueryState(['/api/me'])?.isInvalidated, false);

    // Returning to a discovery detail that was inactive at upload time should
    // refetch without a manual refresh, despite its otherwise infinite staleTime.
    const club = new QueryObserver(client, { queryKey: ['/api/clubs/2'], queryFn: fetchCount });
    const stopClub = club.subscribe(() => {});
    try {
      await until(() => club.getCurrentResult().data?.photoCount === 5);
      serverCount = 4; // delete completed
      await invalidatePhotoCaches(client);
      assert.equal(list.getCurrentResult().data.photoCount, 4);
      assert.equal(detail.getCurrentResult().data.photoCount, 4);
      assert.equal(club.getCurrentResult().data.photoCount, 4);
    } finally {
      stopClub();
    }
  } finally {
    stopList();
    stopDetail();
    client.clear();
  }
});