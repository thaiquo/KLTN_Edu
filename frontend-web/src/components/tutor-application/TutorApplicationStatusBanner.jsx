import { AlertCircle, CheckCircle2, Clock3, FileEdit } from 'lucide-react';

const STATUS_COPY = {
  DRAFT: {
    icon: FileEdit,
    title: 'Hồ sơ nháp',
    description: 'Bạn có thể hoàn thiện từng bước và quay lại chỉnh sửa trước khi gửi xét duyệt.',
    className: 'border-blue-100 bg-blue-50 text-blue-800'
  },
  REJECTED: {
    icon: AlertCircle,
    title: 'Hồ sơ cần chỉnh sửa',
    description: 'Staff đã phản hồi hồ sơ. Bạn có thể chỉnh sửa và gửi lại ở phase tiếp theo.',
    className: 'border-amber-200 bg-amber-50 text-amber-800'
  },
  PENDING: {
    icon: Clock3,
    title: 'Hồ sơ đang được xét duyệt',
    description: 'Hồ sơ đã được gửi và hiện ở trạng thái chỉ đọc.',
    className: 'border-slate-200 bg-slate-50 text-slate-700'
  },
  APPROVED: {
    icon: CheckCircle2,
    title: 'Hồ sơ gia sư đã được phê duyệt',
    description: 'Tài khoản của bạn đã sẵn sàng cho các bước Tutor Profile ở phase sau.',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800'
  }
};

export function TutorApplicationStatusBanner({ application }) {
  const copy = STATUS_COPY[application?.status] || STATUS_COPY.DRAFT;
  const Icon = copy.icon;

  return (
    <section className={`rounded-[8px] border p-5 ${copy.className}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-white/70">
          <Icon size={20} />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-extrabold">{copy.title}</h2>
          <p className="mt-1 text-sm font-semibold leading-6 opacity-85">{copy.description}</p>
          {application?.status === 'REJECTED' && (application.rejectionReason || application.reviewNote) && (
            <div className="mt-4 rounded-[8px] border border-amber-200 bg-white/70 p-4 text-sm font-semibold">
              {application.rejectionReason && <p><b>Lý do:</b> {application.rejectionReason}</p>}
              {application.reviewNote && <p className="mt-1"><b>Ghi chú:</b> {application.reviewNote}</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
