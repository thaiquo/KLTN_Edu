import test from 'node:test';
import assert from 'node:assert/strict';
import { communityEventDecision, currentRevision, moderationDisplay, pollInput, standardPollOptions, validatePost } from './community.ts';

const post = { id: 7, contentRevision: 2, pendingContentRevision: 3, moderationStatus: 'ALLOWED', pendingModerationStatus: 'MODERATING' };

test('pending revision is authoritative for edit and moderation display', () => {
  assert.equal(currentRevision(post), 3);
  assert.deepEqual(moderationDisplay(post), { status: 'MODERATING', reason: undefined, pending: true });
});

test('stale and duplicate moderation events are ignored', () => {
  const seen = new Set();
  const stale = { type: 'COMMUNITY_POST_MODERATION_COMPLETED', entityId: 7, payload: { postId: 7, contentRevision: 2, moderationStatus: 'ALLOWED' } };
  const fresh = { ...stale, payload: { ...stale.payload, contentRevision: 3 } };
  assert.equal(communityEventDecision(stale, [post], seen), 'ignore');
  assert.equal(communityEventDecision(fresh, [post], seen), 'refresh');
  assert.equal(communityEventDecision(fresh, [post], seen), 'ignore');
});

test('poll uses standard seven-day three-period schedule', () => {
  const options = standardPollOptions();
  assert.equal(options.length, 21);
  assert.deepEqual(options.map(option => option.dayOfWeek).filter((day, index, all) => index === 0 || day !== all[index - 1]), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(pollInput('  Lịch nào?  ', 2, 90, 10).maxVotesPerUser, 2);
  assert.equal(pollInput('Lịch nào?', 3, 90, 10, { totalVotes: 1, maxVotesPerUser: 2, options: options.map((option, id) => ({ ...option, id })) }).maxVotesPerUser, 2);
});

test('student post requires authoritative catalog selection', () => {
  const input = { postType: 'STUDENT_FIND_TUTOR', title: 'Tìm gia sư Toán', content: 'Ôn thi học kỳ', catalogSubjectId: null, catalogLevelId: null, learningMode: 'ONLINE' };
  assert.match(validatePost(input), /môn học/);
  assert.equal(validatePost({ ...input, catalogSubjectId: 1, catalogLevelId: 2 }), null);
  assert.match(validatePost({ ...input, catalogSubjectId: 1, catalogLevelId: 2, learningMode: 'OFFLINE' }), /địa chỉ/);
});
