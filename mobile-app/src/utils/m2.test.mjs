import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTutorMatchPayload, emptyTutorFilters, patchAiRequirement, tutorSearchPath, updateTutorFilter } from './m2.ts';

test('upstream catalog and online mode clear invalid dependent filters', () => {
  const full = { ...emptyTutorFilters, programTypeId: '1', educationLevelId: '2', categoryId: '3', subjectId: '4', levelId: '5', provinceCode: '79', communeCode: '123' };
  const changed = updateTutorFilter(full, 'programTypeId', '6');
  assert.equal(changed.educationLevelId, ''); assert.equal(changed.categoryId, '');
  assert.equal(changed.subjectId, ''); assert.equal(changed.levelId, '');
  const online = updateTutorFilter(full, 'teachingMode', 'ONLINE');
  assert.equal(online.provinceCode, ''); assert.equal(online.communeCode, '');
});

test('search v2 preserves backend filter, sort and pagination contract', () => {
  const path = tutorSearchPath({ ...emptyTutorFilters, keyword: ' Toán ', subjectId: '42', teachingMode: 'ONLINE' }, 2, 'rating,desc');
  const url = new URL(path, 'http://example.test');
  assert.equal(url.searchParams.get('keyword'), 'Toán'); assert.equal(url.searchParams.get('subjectId'), '42');
  assert.equal(url.searchParams.get('page'), '2'); assert.equal(url.searchParams.get('size'), '9');
  assert.equal(url.searchParams.get('sort'), 'rating,desc');
});

test('AI clarification patches analyzed hints then match payload uses grounded IDs and optional detail', () => {
  const changed = patchAiRequirement({ subjectHint: 'toán' }, { field: 'LEVEL', reason: 'MISSING', blocking: true }, { name: 'Lớp 12' });
  assert.equal(changed.levelHint, 'Lớp 12');
  const payload = buildTutorMatchPayload({ subject: { id: 5, name: 'Toán' }, level: { id: 9, name: 'Lớp 12' }, teachingMode: 'ONLINE',
    budget: { target: 250000 }, preferredSchedules: [{ dayOfWeek: 2, startTime: '19:00', endTime: '20:00' }],
    location: { provinceCode: '79', communeCode: '123' } }, { weakTopics: 'Hình học, Hàm số', tutorPreferences: 'giảng chậm' });
  assert.equal(payload.subjectId, 5); assert.equal(payload.levelId, 9);
  assert.equal(payload.provinceCode, null); assert.equal(payload.budgetMin, 250000);
  assert.deepEqual(payload.weakTopics, ['Hình học', 'Hàm số']);
  assert.deepEqual(payload.preferredSchedules, [{ dayOfWeek: 2, startTime: '19:00', endTime: '20:00' }]);
});
