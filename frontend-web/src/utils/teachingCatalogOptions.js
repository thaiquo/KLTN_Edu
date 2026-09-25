import { teachingCatalogApi } from '../api/teachingRegistrations';

function uniqueById(items) {
  const byId = new Map();
  (items || []).forEach((item) => {
    if (item?.id !== undefined && item?.id !== null) byId.set(String(item.id), item);
  });
  return Array.from(byId.values());
}

function sortByName(items) {
  return [...(items || [])].sort((left, right) =>
    String(left?.name || '').localeCompare(String(right?.name || ''), 'vi', { sensitivity: 'base' })
  );
}

export async function loadTeachingSubjectOptions() {
  const [programTypes, educationLevels] = await Promise.all([
    teachingCatalogApi.programTypes().catch(() => []),
    teachingCatalogApi.educationLevels().catch(() => [])
  ]);
  const programs = Array.isArray(programTypes) ? programTypes : [];
  const levels = Array.isArray(educationLevels) ? educationLevels : [];
  const categoryRequests = programs.flatMap((programType) => [
    teachingCatalogApi.categories(programType.id).catch(() => []),
    ...levels.map((educationLevel) =>
      teachingCatalogApi.categories(programType.id, educationLevel.id).catch(() => [])
    )
  ]);
  const categoryLists = await Promise.all(categoryRequests);
  const categories = uniqueById(categoryLists.flat());
  const subjectLists = await Promise.all(
    categories.map((category) => teachingCatalogApi.subjects(category.id).catch(() => []))
  );
  const subjects = uniqueById(subjectLists.flat());
  return {
    programTypes: sortByName(programs),
    educationLevels: sortByName(levels),
    categories: sortByName(categories),
    subjects: sortByName(subjects)
  };
}
