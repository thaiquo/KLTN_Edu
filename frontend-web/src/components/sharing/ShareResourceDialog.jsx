import React, { useEffect, useState } from 'react';
import { Check, Copy, Loader2, MessageCircle, Send, X } from 'lucide-react';
import { chatApi } from '../../api/chatApi';
import { copyToClipboard } from '../../utils/shareLinks';

export function ShareResourceDialog({
  open,
  onClose,
  resourceType,
  publicShareId,
  title,
  shareUrl,
  authenticated,
  caption = undefined,
  copyText = undefined
}) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const [sentId, setSentId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !authenticated) return;
    setLoading(true);
    setError('');
    chatApi.getConversations()
      .then(setConversations)
      .catch(() => setError('Không thể tải danh sách cuộc trò chuyện.'))
      .finally(() => setLoading(false));
  }, [authenticated, open]);

  if (!open) return null;

  const handleCopy = async () => {
    await copyToClipboard(copyText || shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async (conversationId) => {
    if (!publicShareId || sendingId) return;
    setSendingId(conversationId);
    setError('');
    try {
      await chatApi.sendSharedResource(conversationId, resourceType, publicShareId, caption);
      setSentId(conversationId);
    } catch (err) {
      setError(err?.message || 'Không thể gửi danh thiếp lúc này.');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/45 p-4" onMouseDown={onClose}>
      <section className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-indigo-600">Chia sẻ {resourceType === 'CLASS' ? 'lớp học' : 'bài viết'}</p>
            <h2 className="truncate text-base font-black text-slate-950">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-slate-100" title="Đóng"><X size={18} /></button>
        </header>

        <div className="p-5">
          <button type="button" onClick={handleCopy} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
            {copied ? <Check size={17} className="text-emerald-600" /> : <Copy size={17} />}
            {copied ? 'Đã sao chép liên kết' : 'Sao chép liên kết'}
          </button>

          {authenticated ? (
            <div className="mt-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900"><MessageCircle size={17} /> Gửi vào tin nhắn</div>
              {loading ? <div className="grid place-items-center py-8"><Loader2 className="animate-spin text-indigo-600" /></div> : null}
              {!loading && conversations.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Bạn chưa có cuộc trò chuyện nào.</p> : null}
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {conversations.map((conversation) => (
                  <button key={conversation.id} type="button" onClick={() => handleSend(conversation.id)} disabled={Boolean(sendingId)} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 p-3 text-left hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-60">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-100 font-black text-indigo-700">{(conversation.counterpartDisplayName || 'U').charAt(0).toUpperCase()}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{conversation.counterpartDisplayName || conversation.counterpartEmail}</span>
                    {sendingId === conversation.id ? <Loader2 size={17} className="animate-spin" /> : sentId === conversation.id ? <Check size={18} className="text-emerald-600" /> : <Send size={17} className="text-indigo-600" />}
                  </button>
                ))}
              </div>
            </div>
          ) : <p className="mt-4 text-sm text-slate-500">Đăng nhập để gửi danh thiếp trực tiếp vào cuộc trò chuyện.</p>}
          {error ? <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p> : null}
        </div>
      </section>
    </div>
  );
}
