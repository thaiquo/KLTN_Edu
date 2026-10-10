import React, { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, GraduationCap, Loader2, LockKeyhole } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { classApi } from '../../api/classes';
import { communityApi } from '../../api/community';

function formatPrice(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString('vi-VN')}đ/buổi` : null;
}

export function SharedResourceCard({ resourceType, publicShareId, caption }) {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, available: false, data: null });

  useEffect(() => {
    let active = true;
    setState({ loading: true, available: false, data: null });
    const request = resourceType === 'CLASS'
      ? classApi.getPublicClassByShareId(publicShareId)
      : communityApi.getSharedPost(publicShareId);
    request
      .then((data) => active && setState({ loading: false, available: true, data }))
      .catch(() => active && setState({ loading: false, available: false, data: null }));
    return () => { active = false; };
  }, [publicShareId, resourceType]);

  const openResource = async () => {
    if (!state.available) return;
    try {
      if (resourceType === 'CLASS') {
        await classApi.getPublicClassByShareId(publicShareId);
        navigate(`/share/classes/${publicShareId}`);
      } else {
        await communityApi.getSharedPost(publicShareId);
        navigate(`/share/posts/${publicShareId}`);
      }
    } catch {
      setState({ loading: false, available: false, data: null });
    }
  };

  if (state.loading) {
    return <div className="flex min-h-28 w-full max-w-sm items-center justify-center rounded-lg border border-slate-200 bg-white"><Loader2 className="animate-spin text-indigo-600" /></div>;
  }

  if (!state.available) {
    return (
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-slate-100 p-4 text-slate-500">
        <div className="flex items-center gap-2 text-sm font-black"><LockKeyhole size={17} /> Nội dung không còn công khai</div>
        <p className="mt-1 text-xs">Tài nguyên đã bị ẩn, xóa hoặc ngừng xuất bản.</p>
        {caption ? <p className="mt-3 border-t border-slate-200 pt-3 text-sm">{caption}</p> : null}
      </div>
    );
  }

  const data = state.data;
  const isClass = resourceType === 'CLASS';
  const title = data.name || data.title;
  const subtitle = isClass
    ? [data.registration?.subjectName, data.level?.name].filter(Boolean).join(' · ')
    : `${data.authorName || 'Thành viên EduConnect'} · ${data.postType || 'Bài viết'}`;

  return (
    <button type="button" onClick={openResource} className="block w-full max-w-sm overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md">
      <div className="flex items-start gap-3 p-4">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${isClass ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
          {isClass ? <GraduationCap size={22} /> : <BookOpen size={21} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-black uppercase text-slate-500">{isClass ? 'Lớp học' : 'Bài viết cộng đồng'}</span>
          <span className="mt-0.5 block truncate text-sm font-black text-slate-950">{title}</span>
          <span className="mt-1 block truncate text-xs font-semibold text-slate-500">{subtitle}</span>
        </span>
      </div>
      {isClass ? (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3 text-xs font-bold text-slate-600">
          {formatPrice(data.pricePerSession) ? <span>{formatPrice(data.pricePerSession)}</span> : null}
          {data.availableSlots != null ? <span>· Còn {data.availableSlots} chỗ</span> : null}
          {data.startDate ? <span>· Khai giảng {data.startDate}</span> : null}
        </div>
      ) : <p className="line-clamp-2 border-t border-slate-100 px-4 py-3 text-xs leading-5 text-slate-600">{data.content}</p>}
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-xs font-black text-indigo-700">
        <span>{isClass ? 'Xem chi tiết lớp học' : 'Xem bài viết'}</span><ArrowRight size={15} />
      </div>
      {caption ? <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-700">{caption}</p> : null}
    </button>
  );
}
