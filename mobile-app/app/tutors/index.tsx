import React, { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, ChevronLeft, ChevronRight, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react-native';
import { useAuth } from '../../src/auth/AuthProvider';
import { emptyTutorFilters, tutorM2, tutorSortOptions, type Page, type TutorFilters as FilterState, type TutorProfile } from '../../src/api/m2';
import { AppShell } from '../../src/components/AppShell';
import { TutorCard } from '../../src/components/m2/TutorCard';
import { TutorFiltersModal } from '../../src/components/m2/TutorFilters';
import { base } from '../../src/theme/tokens';

type SearchState = { filters: FilterState; page: number; sort: string };
const remembered = new Map<string, SearchState>();
const defaultState = (): SearchState => ({ filters: { ...emptyTutorFilters }, page: 0, sort: 'name,asc' });

export default function TutorMarketplace() {
  const { user } = useAuth();
  const key = user ? String(user.id) : 'guest';
  const [state, setState] = useState<SearchState>(() => remembered.get(key) || defaultState());
  const [keyword, setKeyword] = useState(state.filters.keyword);
  const [result, setResult] = useState<Page<TutorProfile> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const listRef = useRef<FlatList<TutorProfile>>(null);

  useEffect(() => { const next = remembered.get(key) || defaultState(); setState(next); setKeyword(next.filters.keyword); }, [key]);
  useEffect(() => { remembered.set(key, state); }, [key, state]);
  useEffect(() => {
    let active = true; setLoading(true); setResult(null); setError('');
    const timer = setTimeout(() => {
      tutorM2.search(state.filters, state.page, state.sort)
        .then(data => { if (active) setResult(data); })
        .catch(cause => { if (active) { setError(cause instanceof Error ? cause.message : 'Không thể tải gia sư.'); setResult(null); } })
        .finally(() => { if (active) setLoading(false); });
    }, 180);
    return () => { active = false; clearTimeout(timer); };
  }, [state, refresh]);
  useEffect(() => { listRef.current?.scrollToOffset({ offset: 0, animated: false }); }, [state.page]);

  const changeState = useCallback((next: SearchState) => { setState(next); }, []);
  function search() { changeState({ ...state, filters: { ...state.filters, keyword: keyword.trim() }, page: 0 }); }
  function clear() { setKeyword(''); changeState({ ...defaultState(), sort: state.sort }); }
  const filterCount = Object.entries(state.filters).filter(([, value]) => Boolean(value)).length;

  function openAi() {
    if (!user) { router.push({ pathname: '/(auth)/sign-in', params: { returnTo: '/matching' } }); return; }
    if (user.activeRole !== 'STUDENT') { setError('Tìm gia sư bằng AI chỉ dành cho học viên.'); return; }
    router.push('/matching');
  }

  return <AppShell active="explore" title="Tìm gia sư" role={user?.activeRole === 'TUTOR' ? 'TUTOR' : user ? 'STUDENT' : null}>
    <FlatList ref={listRef} data={result?.content || []} keyExtractor={item => String(item.tutorId)} contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled" onRefresh={() => setRefresh(value => value + 1)} refreshing={loading && !!result}
      renderItem={({ item }) => <TutorCard tutor={item} selectedSubjectId={Number(state.filters.subjectId) || undefined} />}
      ListHeaderComponent={<>
        <Pressable onPress={() => router.back()} style={styles.back}><ArrowLeft size={17} color={base.muted} /><Text style={styles.backText}>Quay lại Khám phá</Text></Pressable>
        <Text style={styles.eyebrow}>MARKETPLACE GIA SƯ</Text><Text style={styles.heading}>Tìm gia sư phù hợp</Text>
        <Text style={styles.subheading}>So sánh chuyên môn, mức nhận dạy và lịch rảnh từ hồ sơ đã xét duyệt.</Text>
        <View style={styles.search}><Search size={18} color={base.muted} /><TextInput accessibilityLabel="Tìm theo tên gia sư" value={keyword} onChangeText={setKeyword} onSubmitEditing={search} returnKeyType="search" placeholder="Tìm theo tên gia sư" placeholderTextColor="#8999a4" style={styles.searchInput} />
          {keyword ? <Pressable accessibilityLabel="Xóa từ khóa" onPress={() => { setKeyword(''); changeState({ ...state, filters: { ...state.filters, keyword: '' }, page: 0 }); }}><X size={17} color={base.muted} /></Pressable> : null}
          <Pressable accessibilityLabel="Tìm kiếm" onPress={search} style={styles.searchButton}><Search size={18} color="#fff" /></Pressable></View>
        <Pressable onPress={openAi} style={styles.aiBanner}><View style={styles.aiText}><Text style={styles.aiTitle}>Chưa biết nên chọn ai?</Text><Text style={styles.aiDetail}>Mô tả nhu cầu để AI gợi ý từ gia sư thật.</Text></View><Sparkles size={22} color="#2463ae" /></Pressable>
        <View style={styles.toolbar}><Pressable onPress={() => setFiltersOpen(true)} style={styles.tool}><SlidersHorizontal size={17} color="#2463ae" /><Text style={styles.toolText}>Bộ lọc{filterCount ? ` (${filterCount})` : ''}</Text></Pressable>
          <Pressable onPress={() => setSortOpen(true)} style={styles.tool}><Text style={styles.toolText}>{tutorSortOptions.find(item => item.value === state.sort)?.label}</Text><ChevronRight size={16} color={base.muted} /></Pressable></View>
        {filterCount ? <View style={styles.chips}>{Object.entries(state.filters).filter(([, value]) => Boolean(value)).map(([keyName, value]) => <Pressable key={keyName} onPress={() => {
          const filters = { ...state.filters, [keyName]: '' };
          if (keyName === 'programTypeId') Object.assign(filters, { educationLevelId: '', categoryId: '', subjectId: '', levelId: '' });
          if (keyName === 'educationLevelId') Object.assign(filters, { categoryId: '', subjectId: '', levelId: '' });
          if (keyName === 'categoryId') Object.assign(filters, { subjectId: '', levelId: '' });
          if (keyName === 'subjectId') filters.levelId = '';
          if (keyName === 'provinceCode') filters.communeCode = '';
          changeState({ ...state, filters, page: 0 }); if (keyName === 'keyword') setKeyword('');
        }} style={styles.chip}><Text style={styles.chipText}>{keyName === 'keyword' ? `“${value}”` : filterLabels[keyName] || keyName}{['teachingMode', 'minPrice', 'maxPrice', 'minRating', 'minExperience'].includes(keyName) ? `: ${value}` : ''} ×</Text></Pressable>)}<Pressable onPress={clear} style={styles.chip}><Text style={styles.clearText}>Xóa tất cả</Text></Pressable></View> : null}
        <Text style={styles.resultTitle}>{loading && !result ? 'Đang tải gia sư...' : `${result?.totalElements || 0} gia sư phù hợp`}</Text>
        {error ? <View style={styles.message}><Text style={styles.error}>{error}</Text><Pressable onPress={() => setRefresh(value => value + 1)}><Text style={styles.link}>Thử lại</Text></Pressable></View> : null}
        {loading && !result ? <ActivityIndicator color="#2463ae" style={{ margin: 30 }} /> : null}
      </>}
      ListEmptyComponent={!loading && !error ? <View style={styles.message}><Text style={styles.emptyTitle}>Chưa tìm thấy gia sư</Text><Text style={styles.emptyText}>Thử đổi từ khóa hoặc bớt tiêu chí lọc.</Text><Pressable onPress={clear}><Text style={styles.link}>Xóa bộ lọc</Text></Pressable></View> : null}
      ListFooterComponent={result && result.totalPages > 1 ? <View style={styles.pager}><Pressable disabled={state.page <= 0} onPress={() => changeState({ ...state, page: state.page - 1 })} style={[styles.pageButton, state.page <= 0 && styles.disabled]}><ChevronLeft color="#2463ae" size={19} /></Pressable><Text style={styles.pageText}>Trang {state.page + 1}/{result.totalPages}</Text><Pressable disabled={result.last} onPress={() => changeState({ ...state, page: state.page + 1 })} style={[styles.pageButton, result.last && styles.disabled]}><ChevronRight color="#2463ae" size={19} /></Pressable></View> : null}
    />
    <TutorFiltersModal visible={filtersOpen} filters={state.filters} onClose={() => setFiltersOpen(false)} onApply={filters => { changeState({ ...state, filters, page: 0 }); setFiltersOpen(false); }} />
    <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}><View style={styles.overlay}><Pressable onPress={() => setSortOpen(false)} style={{ flex: 1 }} accessibilityLabel="Đóng sắp xếp" /><View style={styles.sortSheet}><Text style={styles.sortTitle}>Sắp xếp gia sư</Text><ScrollView>{tutorSortOptions.map(item => <Pressable key={item.value} onPress={() => { changeState({ ...state, sort: item.value, page: 0 }); setSortOpen(false); }} style={styles.sortOption}><Text style={[styles.sortText, state.sort === item.value && { color: '#2463ae', fontWeight: '800' }]}>{item.label}</Text></Pressable>)}</ScrollView></View></View></Modal>
  </AppShell>;
}

const filterLabels: Record<string, string> = { programTypeId: 'Chương trình', educationLevelId: 'Cấp học', categoryId: 'Nhóm môn', subjectId: 'Môn', levelId: 'Cấp độ', teachingMode: 'Hình thức', provinceCode: 'Tỉnh', communeCode: 'Phường', minPrice: 'Từ', maxPrice: 'Đến', minRating: 'Đánh giá', minExperience: 'Kinh nghiệm' };
const styles = StyleSheet.create({
  content: { maxWidth: 620, width: '100%', alignSelf: 'center', padding: 18, paddingBottom: 35, flexGrow: 1 },
  back: { flexDirection: 'row', gap: 7, alignItems: 'center', marginBottom: 20 }, backText: { color: base.muted, fontSize: 13, fontWeight: '700' },
  eyebrow: { color: '#237d76', fontSize: 11, fontWeight: '800' }, heading: { color: base.ink, fontSize: 27, fontWeight: '800', marginTop: 5 },
  subheading: { color: base.muted, fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 18 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: base.line, backgroundColor: '#fff', borderRadius: 8, paddingLeft: 12 },
  searchInput: { flex: 1, minHeight: 50, color: base.ink, fontSize: 14 }, searchButton: { width: 48, height: 48, backgroundColor: '#2463ae', borderTopRightRadius: 7, borderBottomRightRadius: 7, alignItems: 'center', justifyContent: 'center' },
  aiBanner: { marginTop: 13, marginBottom: 19, padding: 16, backgroundColor: '#e8f1fb', borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiText: { flex: 1 }, aiTitle: { color: base.ink, fontWeight: '800', fontSize: 15 }, aiDetail: { color: base.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  toolbar: { flexDirection: 'row', gap: 8, marginBottom: 15 }, tool: { minHeight: 44, flex: 1, borderWidth: 1, borderColor: base.line, borderRadius: 8, backgroundColor: '#fff', flexDirection: 'row', gap: 5, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 7 }, toolText: { color: base.ink, fontSize: 12, fontWeight: '700', flexShrink: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }, chip: { backgroundColor: '#e8f1fb', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 }, chipText: { color: '#2463ae', fontSize: 11, fontWeight: '700' }, clearText: { color: base.danger, fontSize: 11, fontWeight: '800' },
  resultTitle: { color: base.ink, fontSize: 18, fontWeight: '800', marginBottom: 12 }, message: { padding: 20, borderWidth: 1, borderColor: base.line, borderRadius: 8, backgroundColor: '#fff', marginBottom: 14, gap: 8 },
  error: { color: base.danger, fontSize: 13 }, link: { color: '#2463ae', fontWeight: '800', fontSize: 13 }, emptyTitle: { color: base.ink, fontSize: 16, fontWeight: '800' }, emptyText: { color: base.muted, fontSize: 13 },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22, marginTop: 8 }, pageButton: { minWidth: 44, minHeight: 44, borderWidth: 1, borderColor: base.line, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: .35 }, pageText: { color: base.ink, fontWeight: '700' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0007' }, sortSheet: { backgroundColor: '#fff', borderTopLeftRadius: 8, borderTopRightRadius: 8, padding: 20, maxHeight: '70%' }, sortTitle: { color: base.ink, fontSize: 18, fontWeight: '800', marginBottom: 10 }, sortOption: { minHeight: 50, borderTopWidth: 1, borderColor: base.line, justifyContent: 'center' }, sortText: { color: base.ink, fontSize: 14 },
});
