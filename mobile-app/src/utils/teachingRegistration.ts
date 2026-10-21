export type StepId = 'program' | 'education' | 'category' | 'subject' | 'level' | 'proposal' | 'details' | 'evidence' | 'review';

export function registrationSteps(programCode?: string, proposal = false): StepId[] {
  return [
    'program',
    ...(programCode === 'ACADEMIC' ? ['education' as const] : []),
    'category', 'subject', proposal ? 'proposal' : 'level', 'details', 'evidence', 'review',
  ];
}

export function normalizedSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

export function validTeachingDetails(years: string, min: string, max: string, description: string): string | null {
  if (!years.trim() || !Number.isInteger(Number(years)) || Number(years) < 0 || Number(years) > 60) return 'Số năm kinh nghiệm cần từ 0 đến 60.';
  if (!min.trim() || !max.trim() || !Number.isFinite(Number(min)) || !Number.isFinite(Number(max)) || Number(min) < 1 || Number(max) < Number(min)) return 'Học phí cần lớn hơn 0 và mức tối đa không thấp hơn tối thiểu.';
  if (!description.trim() || description.trim().length > 1500) return 'Mô tả năng lực cần có và không quá 1500 ký tự.';
  return null;
}

export function statusLabel(status: string): string {
  return ({ PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Bị từ chối' } as Record<string, string>)[status] || 'Đang cập nhật';
}
