const STATUS_LABEL = {
  PENDING: 'Ho so dang cho Staff xet duyet',
  APPROVED: 'Ho so da duoc phe duyet',
  REJECTED: 'Ho so bi tu choi'
};

const STATUS_CLASS = {
  PENDING: 'status-badge pending',
  APPROVED: 'status-badge approved',
  REJECTED: 'status-badge rejected'
};

export function TutorStatusBadge({ status }) {
  if (!status) return null;

  return (
    <div className={STATUS_CLASS[status] || STATUS_CLASS.PENDING}>
      {STATUS_LABEL[status] || status}
    </div>
  );
}
