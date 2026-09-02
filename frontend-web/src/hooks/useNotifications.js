import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '../api/notifications';

function normalizeListParams(params = {}) {
  return {
    page: Number(params.page ?? 0),
    size: Number(params.size ?? 8),
    unreadOnly: Boolean(params.unreadOnly ?? false),
    ...(params.targetRole ? { targetRole: params.targetRole } : {})
  };
}

function normalizeCountParams(params = {}) {
  return params.targetRole ? { targetRole: params.targetRole } : {};
}

export const notificationKeys = {
  all: ['notifications'],
  lists: () => [...notificationKeys.all, 'list'],
  list: (params = {}) => [...notificationKeys.lists(), normalizeListParams(params)],
  unreadCounts: () => [...notificationKeys.all, 'unread-count'],
  unreadCount: (params = {}) => [...notificationKeys.unreadCounts(), normalizeCountParams(params)]
};

export function useNotifications(params = {}, options = {}) {
  const normalizedParams = normalizeListParams(params);

  return useQuery({
    queryKey: notificationKeys.list(normalizedParams),
    queryFn: () => notificationApi.getNotifications(normalizedParams),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    ...options
  });
}

export function useNotificationUnreadCount(params = {}, options = {}) {
  const normalizedParams = normalizeCountParams(params);

  return useQuery({
    queryKey: notificationKeys.unreadCount(normalizedParams),
    queryFn: () => notificationApi.getUnreadCount(normalizedParams),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    ...options
  });
}

export function useMarkNotificationRead(options = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, ...mutationOptions } = options;

  return useMutation({
    mutationFn: notificationApi.markRead,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      onSuccess?.(data, variables, context);
    },
    ...mutationOptions
  });
}

export function useMarkAllNotificationsRead(options = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, ...mutationOptions } = options;

  return useMutation({
    mutationFn: notificationApi.markAllRead,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      onSuccess?.(data, variables, context);
    },
    ...mutationOptions
  });
}
