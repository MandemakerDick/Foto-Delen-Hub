import { useInfiniteQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, Pressable, RefreshControl, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { getListGalleryPhotosQueryKey, listGalleryPhotos, useListClubs, useListThemes, useListPhotographers } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useLocale } from '@/context/locale';
import { resolveMediaUrl } from '@/utils/media';
import { useTabPressReset } from '@/context/tab-reset';

export const sorts = ['newest', 'oldest', 'photographer', 'likes', 'comments', 'random'] as const;
export type Sort = typeof sorts[number];
export type Group = 'none' | 'club' | 'photographer' | 'theme';
const groups: Group[] = ['none', 'club', 'photographer', 'theme'];
const one = (v?: string | string[]) => Array.isArray(v) ? v[0] : v;
const ids = (v?: string | string[]) => (one(v) ?? '').split(',').filter(x => /^\d+$/.test(x)).map(Number);
const date = (v?: string | string[]) => { const x = one(v) ?? ''; if (!/^\d{4}-\d{2}-\d{2}$/.test(x)) return ''; const [y, m, d] = x.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === x ? x : ''; };
export function serializeGalleryQuery(state: { search?: string; clubs?: (string | number)[]; themes?: (string | number)[]; photographer?: string | number; from?: string; to?: string; group?: Group; sort?: Sort; seed?: number }) {
  const p = new URLSearchParams(); if (state.search?.trim()) p.set('search', state.search.trim());
  if (state.clubs?.length) p.set('clubs', state.clubs.join(',')); if (state.themes?.length) p.set('themes', state.themes.join(','));
  if (state.photographer && String(state.photographer) !== 'all') p.set('photographer', String(state.photographer));
  if (state.from) p.set('from', state.from); if (state.to) p.set('to', state.to); if (state.group && state.group !== 'none') p.set('group', state.group);
  if (state.sort && state.sort !== 'newest') p.set('sort', state.sort); if (state.sort === 'random' && state.seed) p.set('seed', String(state.seed)); return p.toString();
}
export function galleryUrl(state: Parameters<typeof serializeGalleryQuery>[0]) { const query = serializeGalleryQuery(state); return `photomatrix-native://gallery${query ? `?${query}` : ''}`; }

function parseSharedGalleryLink(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'photomatrix-native:' || url.hostname !== 'gallery' || (url.pathname !== '' && url.pathname !== '/')) return null;
    const p = url.searchParams;
    const readIds = (key: string) => {
      const text = p.get(key);
      if (!text) return [];
      const parts = text.split(',');
      return parts.every(part => /^[1-9]\d*$/.test(part) && Number.isSafeInteger(Number(part))) ? parts.map(Number) : null;
    };
    const clubIds = readIds('clubs'); const themeIds = readIds('themes');
    const photographer = p.get('photographer') ?? 'all';
    const group = p.get('group') ?? 'none'; const sort = p.get('sort') ?? 'newest';
    const from = p.get('from') ?? ''; const to = p.get('to') ?? '';
    const rawSeed = p.get('seed');
    const seed = rawSeed ? Number(rawSeed) : Date.now();
    if (!clubIds || !themeIds || (photographer !== 'all' && (!/^[1-9]\d*$/.test(photographer) || !Number.isSafeInteger(Number(photographer))))
      || !groups.includes(group as Group) || !sorts.includes(sort as Sort)
      || (from && !date(from)) || (to && !date(to))
      || !Number.isSafeInteger(seed) || seed <= 0 || (rawSeed && !/^[1-9]\d*$/.test(rawSeed))) return null;
    return { search: p.get('search') ?? '', clubIds, themeIds, photographer, from, to, group: group as Group, sort: sort as Sort, seed };
  } catch { return null; }
}

export default function GalleryScreen() {
  const c = useColors(); const { t } = useLocale(); const insets = useSafeAreaInsets(); const router = useRouter();
  const list = useRef<FlatList>(null);
  useTabPressReset('gallery', () => list.current?.scrollToOffset({ offset: 0, animated: false }));
  const p = useLocalSearchParams<{ search?: string | string[]; clubs?: string | string[]; themes?: string | string[]; photographer?: string | string[]; from?: string | string[]; to?: string | string[]; group?: string | string[]; sort?: string | string[]; seed?: string | string[] }>();
  const initialSort = one(p.sort); const initialGroup = one(p.group);
  const [search, setSearch] = useState(one(p.search) ?? ''); const [clubIds, setClubIds] = useState<number[]>(() => ids(p.clubs)); const [themeIds, setThemeIds] = useState<number[]>(() => ids(p.themes));
  const [photographer, setPhotographer] = useState(one(p.photographer) && /^\d+$/.test(one(p.photographer)!) ? one(p.photographer)! : 'all');
  const [fromDraft, setFromDraft] = useState(() => one(p.from) ?? ''); const [toDraft, setToDraft] = useState(() => one(p.to) ?? '');
  const from = date(fromDraft); const to = date(toDraft);
  const [group, setGroup] = useState<Group>(groups.includes(initialGroup as Group) ? initialGroup as Group : 'none');
  const [sort, setSort] = useState<Sort>(sorts.includes(initialSort as Sort) ? initialSort as Sort : 'newest');
  const [seed, setSeed] = useState(() => { const n = Number(one(p.seed)); return Number.isSafeInteger(n) && n > 0 ? n : Date.now(); });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<'clubs' | 'themes' | 'photographers' | null>(null);
  const [sharedLinkOpen, setSharedLinkOpen] = useState(false);
  const [sharedLink, setSharedLink] = useState('');
  const closeSharedSelection = () => {
    Keyboard.dismiss();
    setSharedLink('');
    setSharedLinkOpen(false);
  };
  const routeSelection = JSON.stringify([one(p.search), one(p.clubs), one(p.themes), one(p.photographer), one(p.from), one(p.to), one(p.group), one(p.sort), one(p.seed)]);
  useEffect(() => {
    setSearch(one(p.search) ?? '');
    setClubIds(ids(p.clubs)); setThemeIds(ids(p.themes));
    const incomingPhotographer = one(p.photographer);
    setPhotographer(incomingPhotographer && /^[1-9]\d*$/.test(incomingPhotographer) ? incomingPhotographer : 'all');
    setFromDraft(one(p.from) ?? ''); setToDraft(one(p.to) ?? '');
    setGroup(groups.includes(one(p.group) as Group) ? one(p.group) as Group : 'none');
    setSort(sorts.includes(one(p.sort) as Sort) ? one(p.sort) as Sort : 'newest');
    const incomingSeed = Number(one(p.seed));
    setSeed(Number.isSafeInteger(incomingSeed) && incomingSeed > 0 ? incomingSeed : Date.now());
  }, [routeSelection]);
  const openSharedSelection = () => {
    const selection = parseSharedGalleryLink(sharedLink);
    if (!selection) {
      Alert.alert(t('invalidGalleryLink'), t('invalidGalleryLinkBody'));
      return;
    }
    setSearch(selection.search); setClubIds(selection.clubIds); setThemeIds(selection.themeIds);
    setPhotographer(selection.photographer); setFromDraft(selection.from); setToDraft(selection.to);
    setGroup(selection.group); setSort(selection.sort); setSeed(selection.seed);
    setPickerOpen(null); setFiltersOpen(true); closeSharedSelection();
  };
  const hasSelection = !!search || clubIds.length > 0 || themeIds.length > 0 || photographer !== 'all'
    || !!fromDraft || !!toDraft || group !== 'none' || sort !== 'newest';
  const resetSelection = () => {
    setSearch(''); setClubIds([]); setThemeIds([]); setPhotographer('all');
    setFromDraft(''); setToDraft(''); setGroup('none'); setSort('newest'); setSeed(Date.now());
    setPickerOpen(null); setFiltersOpen(false); closeSharedSelection();
    router.setParams({ search: undefined, clubs: undefined, themes: undefined, photographer: undefined,
      from: undefined, to: undefined, group: undefined, sort: undefined, seed: undefined });
    list.current?.scrollToOffset({ offset: 0, animated: false });
  };
  const clubs = useListClubs(); const themes = useListThemes(); const photographers = useListPhotographers();
  const query = useMemo(() => ({ search: search.trim() || undefined, clubIds: clubIds.length ? clubIds.join(',') : undefined, themeIds: themeIds.length ? themeIds.join(',') : undefined, photographerId: photographer === 'all' ? undefined : Number(photographer), from: from || undefined, to: to || undefined, group, sort, seed: sort === 'random' ? seed : undefined, limit: 24 as const }), [search, clubIds, themeIds, photographer, from, to, group, sort, seed]);
  const selection = serializeGalleryQuery({ search, clubs: clubIds, themes: themeIds, photographer, from, to, group, sort, seed });
  const q = useInfiniteQuery({ queryKey: getListGalleryPhotosQueryKey(query), initialPageParam: undefined as string | undefined, queryFn: ({ pageParam, signal }) => listGalleryPhotos({ ...query, cursor: pageParam }, { signal }), getNextPageParam: page => page.hasMore ? page.nextCursor ?? undefined : undefined });
  const photos = q.data?.pages.flatMap(x => x.items) ?? [];
  const clubName = new Map((clubs.data ?? []).map(x => [x.id, x.name])); const themeName = new Map((themes.data ?? []).map(x => [x.id, x.name]));
  const heading = (photo: (typeof photos)[number]) => group === 'club' ? clubName.get(photo.clubId ?? 0) ?? t('club') : group === 'theme' ? themeName.get(photo.themeId ?? 0) ?? t('theme') : group === 'photographer' ? photo.photographerName ?? t('unknown') : '';
   const renderItem = ({ item, index }: { item: (typeof photos)[number]; index: number }) => {
     const h = heading(item);
     const previous = index ? heading(photos[index - 1]) : '';
     return <View style={[styles.cell, group !== 'none' && styles.groupedCell]}>
       {h && h !== previous ? <Text style={[styles.heading, { color: c.primary }]}>{h}</Text> : null}
       <Pressable onPress={() => router.push({ pathname: '/(tabs)/gallery/photo/[id]', params: { id: String(item.id), gallery: selection } })}>
         <Image source={resolveMediaUrl(item.imageUrl)} style={styles.image} contentFit="cover" transition={200} />
         <Text numberOfLines={1} style={[styles.photoTitle, { color: c.foreground }]}>{item.title}</Text>
         <Text numberOfLines={1} style={{ color: c.mutedForeground, fontSize: 12 }}>{item.photographerName ?? t('unknown')}</Text>
         <Text numberOfLines={1} style={{ color: c.mutedForeground, fontSize: 12 }}>{t('club')}: {item.clubName ?? t('noClub')}</Text>
       </Pressable>
     </View>;
   };
  const invalidFrom = fromDraft.length === 10 && !from;
  const invalidTo = toDraft.length === 10 && !to;
  const picker = (kind: 'clubs' | 'themes' | 'photographers', label: string, count: number) => <View>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${count}`} onPress={() => setPickerOpen(pickerOpen === kind ? null : kind)} style={[styles.picker, { borderColor: c.border }]}>
      <Text style={{ color: c.foreground }}>{label}{count ? ` (${count})` : ''}</Text><Feather name={pickerOpen === kind ? 'chevron-up' : 'chevron-down'} size={18} color={c.foreground} />
    </Pressable>
    {pickerOpen === kind ? <View style={[styles.options, { borderColor: c.border }]}>
      {kind === 'photographers' && <Pressable onPress={() => { setPhotographer('all'); setPickerOpen(null); }} style={styles.option}><Text style={{ color: c.foreground }}>{photographer === 'all' ? '✓ ' : ''}{t('allPhotographers')}</Text></Pressable>}
      {(kind === 'clubs' ? clubs.data ?? [] : kind === 'themes' ? themes.data ?? [] : photographers.data ?? []).map(x => {
        const selected = kind === 'clubs' ? clubIds.includes(x.id) : kind === 'themes' ? themeIds.includes(x.id) : photographer === String(x.id);
        return <Pressable key={x.id} onPress={() => {
          if (kind === 'clubs') setClubIds(v => v.includes(x.id) ? v.filter(id => id !== x.id) : [...v, x.id]);
          else if (kind === 'themes') setThemeIds(v => v.includes(x.id) ? v.filter(id => id !== x.id) : [...v, x.id]);
          else { setPhotographer(String(x.id)); setPickerOpen(null); }
        }} style={styles.option}><Text style={{ color: selected ? c.primary : c.foreground }}>{selected ? '✓ ' : ''}{x.name}</Text></Pressable>;
      })}
    </View> : null}
  </View>;
  const filterHeader = <View>
    <TextInput value={search} onChangeText={setSearch} placeholder={t('search')} placeholderTextColor={c.mutedForeground} style={[styles.search, { color: c.foreground, backgroundColor: c.card, borderColor: c.border }]} />
    <Pressable accessibilityRole="button" onPress={() => setFiltersOpen(v => !v)} style={styles.filterToggle}><Feather name="sliders" size={17} color={c.primary} /><Text style={{ color: c.primary }}>{t('filters')} · {t(sort)} · {t('group')}: {t(group)}</Text><Feather name={filtersOpen ? 'chevron-up' : 'chevron-down'} size={18} color={c.primary} /></Pressable>
    {hasSelection && <Pressable accessibilityRole="button" accessibilityLabel={t('resetSelection')} onPress={resetSelection} style={styles.resetSelection}><Feather name="rotate-ccw" size={16} color={c.primary} /><Text style={{ color: c.primary }}>{t('resetSelection')}</Text></Pressable>}
    <Pressable accessibilityRole="button" onPress={() => Share.share({ message: galleryUrl({ search, clubs: clubIds, themes: themeIds, photographer, from, to, group, sort, seed }) })} style={styles.share}><Feather name="share-2" size={15} color={c.primary} /><Text style={{ color: c.primary, marginLeft: 7 }}>{t('share')}</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => sharedLinkOpen ? closeSharedSelection() : setSharedLinkOpen(true)} style={styles.openShared}><Feather name={sharedLinkOpen ? 'x' : 'link'} size={16} color={c.primary} /><Text style={{ color: c.primary }}>{t(sharedLinkOpen ? 'closeSharedSelection' : 'openSharedSelection')}</Text></Pressable>
    {sharedLinkOpen && <View style={styles.linkForm}>
      <TextInput value={sharedLink} onChangeText={setSharedLink} placeholder={t('pasteGalleryLink')} placeholderTextColor={c.mutedForeground} autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="go" onSubmitEditing={openSharedSelection} style={[styles.search, styles.linkInput, { color: c.foreground, backgroundColor: c.card, borderColor: c.border }]} />
      <Pressable accessibilityRole="button" onPress={openSharedSelection} style={[styles.openLinkButton, { backgroundColor: c.primary }]}><Text style={{ color: c.primaryForeground, fontWeight: '700' }}>{t('openSelection')}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={closeSharedSelection} style={[styles.openLinkButton, { borderColor: c.border, borderWidth: 1, marginTop: 8 }]}><Text style={{ color: c.foreground }}>{t('cancel')}</Text></Pressable>
    </View>}
    {filtersOpen && <View>
      <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>{t('sortBy')}</Text>
      <View style={styles.controls}>{sorts.map(x => <Pressable key={x} onPress={() => setSort(x)} style={[styles.chip, { borderColor: sort === x ? c.primary : c.border, backgroundColor: sort === x ? c.primary : c.card }]}><Text style={{ color: sort === x ? c.primaryForeground : c.mutedForeground, fontSize: 12 }}>{t(x)}</Text></Pressable>)}</View>
      <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>{t('group')}</Text>
      <View style={styles.controls}>{groups.map(x => <Pressable key={x} onPress={() => setGroup(x)} style={[styles.chip, { borderColor: group === x ? c.primary : c.border, backgroundColor: group === x ? c.primary : c.card }]}><Text style={{ color: group === x ? c.primaryForeground : c.mutedForeground, fontSize: 12 }}>{t(x)}</Text></Pressable>)}</View>
      <View style={styles.pickers}>{picker('clubs', t('clubs'), clubIds.length)}{picker('themes', t('themes'), themeIds.length)}{picker('photographers', t('photographers'), photographer === 'all' ? 0 : 1)}</View>
      <View style={styles.controls}><TextInput value={fromDraft} onChangeText={setFromDraft} placeholder={t('from')} placeholderTextColor={c.mutedForeground} style={[styles.date, { color: c.foreground, borderColor: invalidFrom ? c.primary : c.border }]} /><TextInput value={toDraft} onChangeText={setToDraft} placeholder={t('to')} placeholderTextColor={c.mutedForeground} style={[styles.date, { color: c.foreground, borderColor: invalidTo ? c.primary : c.border }]} /></View>
    </View>}
  </View>;
  return <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top }]}><Stack.Screen options={{ title: t('gallery') }} />
    <View style={styles.header}><View><Text style={[styles.kicker, { color: c.primary }]}>{t('darkroom')}</Text><Text style={[styles.title, { color: c.foreground }]}>{t('gallery')}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={t('shufflePhotos')} onPress={() => { setSeed(Date.now()); setSort('random'); }} style={styles.shuffle}><Feather name="shuffle" size={20} color={c.foreground} /><Text style={{ color: c.foreground, fontSize: 12 }}>{t('shufflePhotos')}</Text></Pressable></View>
    <FlatList
       ref={list}
      key={`gallery-${group}`}
      keyboardShouldPersistTaps="handled"
      data={photos}
      numColumns={group === 'none' ? 2 : 1}
      keyExtractor={x => String(x.id)}
      renderItem={renderItem}
      ListHeaderComponent={filterHeader}
      contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
      columnWrapperStyle={group === 'none' ? { gap: 10 } : undefined}
      refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      ListFooterComponent={q.isFetchingNextPage
        ? <ActivityIndicator color={c.primary} />
        : q.isFetchNextPageError
          ? <Pressable accessibilityRole="button" onPress={() => q.fetchNextPage()} style={styles.empty}><Text style={{ color: c.primary }}>{t('retry')}</Text></Pressable>
          : q.hasNextPage
            ? <Pressable accessibilityRole="button" onPress={() => q.fetchNextPage()} style={styles.empty}><Text style={{ color: c.primary, fontWeight: '700' }}>{t('loadMore')}</Text></Pressable>
            : null}
      ListEmptyComponent={<View style={styles.empty}>{q.isLoading ? <ActivityIndicator color={c.primary} /> : q.isError ? <><Feather name="wifi-off" color={c.mutedForeground} size={28} /><Text style={{ color: c.mutedForeground, marginTop: 12 }}>{t('error')}</Text><Pressable onPress={() => q.refetch()}><Text style={{ color: c.primary, marginTop: 12 }}>{t('retry')}</Text></Pressable></> : <Text style={{ color: c.mutedForeground }}>{t('empty')}</Text>}</View>}
    /></View>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, header: { padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, kicker: { letterSpacing: 2, fontSize: 10, fontWeight: '700' }, title: { fontSize: 34, fontWeight: '700', marginTop: 5 }, shuffle: { alignItems: 'center', gap: 3, minWidth: 64 }, search: { marginHorizontal: 20, borderWidth: 1, borderRadius: 7, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 }, filterToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 16 }, resetSelection: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, minHeight: 44 }, openShared: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 16, minHeight: 44 }, linkForm: { paddingBottom: 16 }, linkInput: { marginBottom: 10 }, openLinkButton: { marginHorizontal: 20, padding: 12, borderRadius: 7, alignItems: 'center', minHeight: 44 }, sectionLabel: { marginHorizontal: 20, marginTop: 10, fontWeight: '700', fontSize: 12 }, pickers: { paddingHorizontal: 20, gap: 8, marginVertical: 10 }, picker: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderWidth: 1, borderRadius: 7 }, options: { borderWidth: 1, borderRadius: 7, marginTop: 3 }, option: { padding: 13 }, controls: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingVertical: 8, flexWrap: 'wrap' }, chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, borderWidth: 1 }, date: { flex: 1, minWidth: 100, borderWidth: 1, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 8, fontSize: 12 }, share: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 20 }, cell: { flex: 1, marginBottom: 18, maxWidth: '50%' }, groupedCell: { maxWidth: '100%' }, image: { width: '100%', aspectRatio: 1, borderRadius: 5 }, photoTitle: { marginTop: 7, fontWeight: '600' }, heading: { fontWeight: '700', fontSize: 12, marginBottom: 5 }, empty: { alignItems: 'center', padding: 40 } });