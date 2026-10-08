export function buildCommunityPostShareUrl(postId) {
  const encodedId = encodeURIComponent(String(postId));
  return `${window.location.origin}/community?postId=${encodedId}#post-${encodedId}`;
}

export function buildClassShareUrl(classId) {
  return `${window.location.origin}/classes/${encodeURIComponent(String(classId))}`;
}

export function extractCommunityPostId(location) {
  if (!location) return null;
  const searchParams = new URLSearchParams(location.search || '');
  const queryId = searchParams.get('postId');
  if (queryId && /^\d+$/.test(queryId)) return queryId;

  const hash = (location.hash || '').replace(/^#/, '');
  const postHashMatch = hash.match(/^post-(\d+)$/);
  if (postHashMatch) return postHashMatch[1];
  if (/^\d+$/.test(hash)) return hash;
  return null;
}

export async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
