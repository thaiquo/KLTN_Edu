export function buildTutorMatchingPayload(requirement) {
  const budget = requirement?.budget || {};
  const target = budget.target ?? null;
  return {
    subjectId: requirement.subject.id,
    levelId: requirement.level.id,
    teachingMode: requirement.teachingMode,
    budgetMin: budget.min ?? target,
    budgetMax: budget.max ?? target,
    provinceCode: requirement.teachingMode === 'OFFLINE' ? requirement.location?.provinceCode || null : null,
    communeCode: requirement.teachingMode === 'OFFLINE' ? requirement.location?.communeCode || null : null,
    preferredSchedules: (requirement.preferredSchedules || [])
      .filter((slot) => slot?.dayOfWeek)
      .map((slot) => ({
        dayOfWeek: Number(slot.dayOfWeek),
        startTime: slot.startTime || null,
        endTime: slot.endTime || null,
        timeOfDayHint: slot.timeOfDayHint || null
      })),
    learningGoal: requirement.learningGoal || null,
    weakTopics: Array.isArray(requirement.weakTopics) ? requirement.weakTopics.filter(Boolean) : [],
    tutorPreferences: Array.isArray(requirement.tutorPreferences) ? requirement.tutorPreferences.filter(Boolean) : [],
    scheduleConstraintMode: requirement.scheduleConstraintMode || 'SOFT',
    budgetConstraintMode: requirement.budgetConstraintMode || 'SOFT'
  };
}
