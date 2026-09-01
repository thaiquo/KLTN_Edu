import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tutorApplicationApi } from '../api/tutorApplications';

export const tutorApplicationKeys = {
  all: ['tutorApplication'],
  mine: () => ['tutorApplication', 'me']
};

export function useTutorApplication(options = {}) {
  return useQuery({
    queryKey: tutorApplicationKeys.mine(),
    queryFn: tutorApplicationApi.getMyTutorApplication,
    staleTime: 30_000,
    retry: 1,
    ...options
  });
}

export function useCreateTutorApplication(options = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, ...mutationOptions } = options;

  return useMutation({
    mutationFn: async () => {
      try {
        return await tutorApplicationApi.createTutorApplication();
      } catch (err) {
        if (err?.status === 409) {
          return tutorApplicationApi.getMyTutorApplication();
        }
        throw err;
      }
    },
    onSuccess: (application, variables, context) => {
      if (application) {
        queryClient.setQueryData(tutorApplicationKeys.mine(), application);
      }
      queryClient.invalidateQueries({ queryKey: tutorApplicationKeys.mine() });
      onSuccess?.(application, variables, context);
    },
    ...mutationOptions
  });
}

export function useInvalidateTutorApplication() {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: tutorApplicationKeys.mine() });
}
