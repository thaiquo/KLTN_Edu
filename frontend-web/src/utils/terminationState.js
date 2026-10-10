/** Select the newest applicable case; a rejected request must not keep a class on hold. */
export function selectTerminationCase(cases, { classroomId, agreementId = null, wholeClassOnly = false }) {
  return (cases || []).filter(({ request, items }) => {
    if (!request || request.status === 'REJECTED') return false;
    if (wholeClassOnly && !request.wholeClass) return false;
    if (agreementId) return String(request.anchorAgreementId) === String(agreementId)
      || (items || []).some((item) => String(item.agreementId) === String(agreementId));
    return request.wholeClass && String(request.classroomId) === String(classroomId);
  }).sort((a, b) => String(b.request.createdAt || '').localeCompare(String(a.request.createdAt || '')))[0];
}
