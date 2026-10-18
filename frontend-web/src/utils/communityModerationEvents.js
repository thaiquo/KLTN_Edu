export function currentCommunityRevision(post) {
  return Math.max(
    Number(post?.contentRevision || 0),
    Number(post?.pendingContentRevision || 0)
  );
}

export function evaluateCommunityModerationEvent(detail, posts, seenEvents) {
  if (detail?.type !== 'COMMUNITY_POST_MODERATION_COMPLETED') {
    return { decision: 'ignore' };
  }

  const postId = Number(detail?.payload?.postId ?? detail?.entityId);
  const revision = Number(detail?.payload?.contentRevision);
  if (!postId || !Number.isFinite(revision)) {
    return { decision: 'refresh' };
  }

  const eventKey = `${postId}:${revision}:${detail?.payload?.moderationStatus || ''}`;
  if (seenEvents.has(eventKey)) {
    return { decision: 'ignore' };
  }

  const localPost = posts.find(post => Number(post.id) === postId);
  if (!localPost) {
    seenEvents.add(eventKey);
    if (seenEvents.size > 200) seenEvents.delete(seenEvents.values().next().value);
    return { decision: 'refresh' };
  }
  if (revision < currentCommunityRevision(localPost)) {
    return { decision: 'ignore' };
  }

  seenEvents.add(eventKey);
  if (seenEvents.size > 200) {
    seenEvents.delete(seenEvents.values().next().value);
  }
  return { decision: 'accept', postId, revision };
}

