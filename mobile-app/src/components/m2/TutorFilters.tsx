import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, ChevronRight, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { catalogM2, emptyTutorFilters, type CatalogItem, type LocationItem, type TutorFilters, updateTutorFilter } from '../../api/m2';
import { base } from '../../theme/tokens';

type Item = { id: string; name: string };
type Picker = { title: string; key: keyof TutorFilters; options: Item[] };
const toItems = (items: CatalogItem[] | LocationItem[], key: 'id' | 'code') => items.map(item => ({ id: key === 'id' ? String((item as CatalogItem).id) : (item as LocationItem).code, name: item.name }));
const requestCache = new Map<string, Promise<unknown>>();
function cached<T>(key: string, call: () => Promise<T>): Promise<T> {
  if (!requestCache.has(key)) requestCache.set(key, call().catch(error => { requestCache.delete(key); throw error; }));
  return requestCache.get(key) as Promise<T>;
}

export function TutorFiltersModal({ visible, filters, onApply, onClose }: { visible: boolean; filters: TutorFilters; onApply: (filters: TutorFilters) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(filters);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [catalog, setCatalog] = useState<{ programs: Item[]; education: Item[]; categories: Item[]; subjects: Item[]; levels: Item[]; provinces: Item[]; communes: Item[] }>({ programs: [], education: [], categories: [], subjects: [], levels: [], provinces: [], communes: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => { if (visible) { setDraft(filters); setPicker(null); setAdvanced(Boolean(filters.levelId || filters.minRating || filters.minExperience)); } }, [visible]);
  useEffect(() => {
    if (!visible) return;
    let active = true; setLoading(true); setError('');
    Promise.all([
      cached('programs', catalogM2.programs), cached('education', catalogM2.education), cached('provinces', catalogM2.provinces),
    ]).then(([programs, education, provinces]) => {
      if (active) setCatalog(current => ({ ...current, programs: toItems(programs, 'id'), education: toItems(education, 'id'), provinces: toItems(provinces, 'code') }));
    }).catch(() => { if (active) setError('Không thể tải danh mục. Vui lòng thử lại.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [visible, reload]);
  useEffect(() => {
    if (!visible || !draft.programTypeId) { setCatalog(current => ({ ...current, categories: [] })); return; }
    let active = true;
    cached(`categories:${draft.programTypeId}:${draft.educationLevelId}`, () => catalogM2.categories(draft.programTypeId, draft.educationLevelId))
      .then(items => { if (active) setCatalog(current => ({ ...current, categories: toItems(items, 'id') })); })
      .catch(() => { if (active) setError('Không thể tải nhóm môn.'); });
    return () => { active = false; };
  }, [visible, draft.programTypeId, draft.educationLevelId]);
  useEffect(() => {
    if (!visible || !draft.categoryId) { setCatalog(current => ({ ...current, subjects: [] })); return; }
    let active = true;
    cached(`subjects:${draft.categoryId}`, () => catalogM2.subjects(draft.categoryId))
      .then(items => { if (active) setCatalog(current => ({ ...current, subjects: toItems(items, 'id') })); })
      .catch(() => { if (active) setError('Không thể tải môn học.'); });
    return () => { active = false; };
  }, [visible, draft.categoryId]);
  useEffect(() => {
    if (!visible || !draft.subjectId) { setCatalog(current => ({ ...current, levels: [] })); return; }
    let active = true;
    cached(`levels:${draft.subjectId}`, () => catalogM2.levels(draft.subjectId))
      .then(items => { if (active) setCatalog(current => ({ ...current, levels: toItems(items, 'id') })); })
      .catch(() => { if (active) setError('Không thể tải cấp độ.'); });
    return () => { active = false; };
  }, [visible, draft.subjectId]);
  useEffect(() => {
    if (!visible || !draft.provinceCode) { setCatalog(current => ({ ...current, communes: [] })); return; }
    let active = true;
    cached(`communes:${draft.provinceCode}`, () => catalogM2.communes(draft.provinceCode))
      .then(items => { if (active) setCatalog(current => ({ ...current, communes: toItems(items, 'code') })); })
      .catch(() => { if (active) setError('Không thể tải phường/xã.'); });
    return () => { active = false; };
  }, [visible, draft.provinceCode]);

  function change(key: keyof TutorFilters, value: string) { setDraft(current => updateTutorFilter(current, key, value)); setError(''); }
  function select(title: string, key: keyof TutorFilters, options: Item[], disabled = false) { if (!disabled) setPicker({ title, key, options }); }
  function row(title: string, key: keyof TutorFilters, options: Item[], disabled = false) {
    const selected = options.find(item => item.id === draft[key]);
    return <Pressable key={key} disabled={disabled} onPress={() => select(title, key, options, disabled)} style={[styles.row, disabled && styles.disabled]}><View style={styles.rowText}><Text style={styles.label}>{title}</Text><Text style={styles.value}>{selected?.name || 'Tất cả'}</Text></View><ChevronRight size={17} color={base.muted} /></Pressable>;
  }

  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={picker ? () => setPicker(null) : onClose}>
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}><Pressable onPress={picker ? () => setPicker(null) : onClose} accessibilityLabel="Đóng bộ lọc" style={styles.iconButton}><X size={21} color={base.ink} /></Pressable><Text style={styles.title}>{picker?.title || 'Bộ lọc gia sư'}</Text><View style={styles.iconButton} /></View>
      {picker ? <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => { change(picker.key, ''); setPicker(null); }} style={styles.option}><Text style={styles.optionText}>Tất cả</Text>{!draft[picker.key] ? <Check color="#2463ae" size={18} /> : null}</Pressable>
        {picker.options.map(item => <Pressable key={item.id} onPress={() => { change(picker.key, item.id); setPicker(null); }} style={styles.option}><Text style={styles.optionText}>{item.name}</Text>{draft[picker.key] === item.id ? <Check color="#2463ae" size={18} /> : null}</Pressable>)}
        {!picker.options.length ? <Text style={styles.hint}>Chưa có lựa chọn phù hợp.</Text> : null}
      </ScrollView> : <><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {loading ? <ActivityIndicator color="#2463ae" style={{ margin: 16 }} /> : null}
        {error ? <Pressable onPress={() => { setReload(value => value + 1); setError(''); }}><Text style={styles.error}>{error} Nhấn để thử lại.</Text></Pressable> : null}
        {row('Chương trình', 'programTypeId', catalog.programs)}
        {row('Cấp học', 'educationLevelId', catalog.education, !draft.programTypeId)}
        {row('Nhóm môn', 'categoryId', catalog.categories, !draft.programTypeId || !catalog.categories.length)}
        {row('Môn học', 'subjectId', catalog.subjects, !draft.categoryId || !catalog.subjects.length)}
        <Text style={styles.section}>Hình thức học</Text>
        <View style={styles.modes}>{[{ key: '', label: 'Tất cả' }, { key: 'ONLINE', label: 'Online' }, { key: 'OFFLINE', label: 'Trực tiếp' }].map(item => <Pressable key={item.key} onPress={() => change('teachingMode', item.key)} style={[styles.mode, draft.teachingMode === item.key && styles.modeActive]}><Text style={[styles.modeText, draft.teachingMode === item.key && styles.modeTextActive]}>{item.label}</Text></Pressable>)}</View>
        {draft.teachingMode !== 'ONLINE' ? <>{row('Tỉnh / thành', 'provinceCode', catalog.provinces)}{row('Phường / xã', 'communeCode', catalog.communes, !draft.provinceCode)}</> : null}
        <Text style={styles.section}>Mức nhận dạy / buổi (VND)</Text>
        <View style={styles.modes}><TextInput accessibilityLabel="Từ VND" keyboardType="numeric" placeholder="Từ" value={draft.minPrice} onChangeText={value => change('minPrice', value.replace(/\D/g, ''))} style={styles.number} /><TextInput accessibilityLabel="Đến VND" keyboardType="numeric" placeholder="Đến" value={draft.maxPrice} onChangeText={value => change('maxPrice', value.replace(/\D/g, ''))} style={styles.number} /></View>
        <Pressable onPress={() => setAdvanced(value => !value)} style={styles.advanced}><Text style={styles.label}>Bộ lọc thêm</Text><Text style={styles.value}>{advanced ? 'Thu gọn' : 'Mở'}</Text></Pressable>
        {advanced ? <>{row('Cấp độ', 'levelId', catalog.levels, !draft.subjectId || !catalog.levels.length)}{row('Đánh giá tối thiểu', 'minRating', [2, 3, 4].map(n => ({ id: String(n), name: `Từ ${n} sao` })))}{row('Kinh nghiệm tối thiểu', 'minExperience', [1, 3, 5, 7].map(n => ({ id: String(n), name: `Từ ${n} năm` })))}</> : null}
      </ScrollView><View style={styles.footer}><Pressable onPress={() => { setDraft({ ...emptyTutorFilters, keyword: draft.keyword }); setError(''); }} style={styles.clear}><Text style={styles.clearText}>Xóa bộ lọc</Text></Pressable><Pressable onPress={() => {
        if (draft.minPrice && draft.maxPrice && Number(draft.minPrice) > Number(draft.maxPrice)) { setError('Mức thấp nhất không thể lớn hơn mức cao nhất.'); return; }
        onApply(draft);
      }} style={styles.apply}><Text style={styles.applyText}>Xem kết quả</Text></Pressable></View></>}
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' }, header: { minHeight: 54, borderBottomWidth: 1, borderColor: base.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, title: { color: base.ink, fontSize: 17, fontWeight: '800' },
  content: { paddingHorizontal: 20, paddingVertical: 8, paddingBottom: 30, maxWidth: 560, width: '100%', alignSelf: 'center' },
  row: { minHeight: 65, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: base.line, gap: 10 }, rowText: { flex: 1 },
  disabled: { opacity: .45 }, label: { color: base.ink, fontSize: 14, fontWeight: '700' }, value: { color: base.muted, fontSize: 13, marginTop: 4 },
  section: { color: base.ink, fontSize: 14, fontWeight: '800', marginTop: 23, marginBottom: 10 },
  modes: { flexDirection: 'row', gap: 8 }, mode: { minHeight: 43, flex: 1, borderWidth: 1, borderColor: base.line, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  modeActive: { borderColor: '#2463ae', backgroundColor: '#e8f1fb' }, modeText: { color: base.muted, fontSize: 12, fontWeight: '700' }, modeTextActive: { color: '#2463ae' },
  number: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: base.line, borderRadius: 8, paddingHorizontal: 12, color: base.ink },
  advanced: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25, paddingVertical: 14, borderTopWidth: 1, borderColor: base.line },
  option: { minHeight: 52, borderBottomWidth: 1, borderColor: base.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionText: { color: base.ink, fontSize: 14, flex: 1 }, hint: { color: base.muted, marginTop: 20 }, error: { color: base.danger, fontSize: 13, paddingVertical: 10 },
  footer: { flexDirection: 'row', gap: 10, padding: 14, borderTopWidth: 1, borderColor: base.line },
  clear: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: base.line, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, clearText: { color: base.ink, fontWeight: '700' },
  apply: { flex: 1, minHeight: 48, borderRadius: 8, backgroundColor: '#2463ae', alignItems: 'center', justifyContent: 'center' }, applyText: { color: '#fff', fontWeight: '800' },
});
