import { useRef } from 'react';
import { Camera, Upload } from 'lucide-react';

export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const AVATAR_MAX_SIZE = 2 * 1024 * 1024;

export function validateAvatarFile(file) {
  if (!file) return 'Vui lòng chọn ảnh đại diện.';
  if (!AVATAR_TYPES.includes(file.type)) {
    return 'Ảnh đại diện chỉ hỗ trợ JPG, PNG hoặc WEBP.';
  }
  if (file.size > AVATAR_MAX_SIZE) {
    return 'Ảnh đại diện không được vượt quá 2 MB.';
  }
  return '';
}

export function AvatarUploader({ avatarUrl, initials, name, uploading, onUpload, error }) {
  const inputRef = useRef(null);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
      <div className="relative h-24 w-24 shrink-0 rounded-[20px] border-4 border-white bg-slate-900 shadow-[0_12px_28px_rgba(15,23,42,.15)]">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={`Ảnh đại diện của ${name || 'người dùng'}`}
            className="h-full w-full rounded-[16px] object-cover"
          />
        ) : (
          <span className="grid h-full w-full place-items-center rounded-[16px] font-display text-2xl font-extrabold text-white">
            {initials}
          </span>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute -bottom-2 -right-2 grid h-9 w-9 place-items-center rounded-[12px] border-2 border-white bg-primary text-white transition-colors hover:bg-[#ff695f] disabled:opacity-60"
          aria-label="Đổi ảnh đại diện"
          title="Đổi ảnh đại diện"
        >
          <Camera size={16} />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) onUpload(file);
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-60"
          >
            <Upload size={16} />
            {uploading ? 'Đang tải ảnh...' : avatarUrl ? 'Thay đổi ảnh đại diện' : 'Tải lên ảnh đại diện'}
          </button>
        </div>
        <p className="text-xs font-semibold leading-5 text-slate-500">
          Định dạng hỗ trợ: JPG, PNG, WEBP (Tối đa 2MB).
        </p>
        {error && <p className="text-xs font-extrabold text-red-600">{error}</p>}
      </div>
    </div>
  );
}
