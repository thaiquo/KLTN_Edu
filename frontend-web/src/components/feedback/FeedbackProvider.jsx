import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmModal } from './ConfirmModal';
import { ImportantSuccessModal } from './ImportantSuccessModal';
import { ToastViewport } from './ToastViewport';
import { CONFIRM_VARIANTS, DEFAULT_TOAST_DURATION, ERROR_TOAST_DURATION, FEEDBACK_TYPES } from './feedbackTypes';

const FeedbackContext = createContext(null);

function normalizeToast(input, defaults = {}) {
  if (typeof input === 'string') {
    return { ...defaults, message: input };
  }
  return { ...defaults, ...(input || {}) };
}

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const [successState, setSuccessState] = useState(null);
  const confirmResolver = useRef(null);
  const successResolver = useRef(null);
  const toastTimers = useRef(new Map());

  const dismissToast = useCallback((id) => {
    const timer = toastTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((input = {}) => {
    const next = normalizeToast(input, {
      type: FEEDBACK_TYPES.INFO,
      duration: DEFAULT_TOAST_DURATION
    });
    const type = next.type || next.tone || FEEDBACK_TYPES.INFO;
    const duration = next.duration ?? (type === FEEDBACK_TYPES.ERROR ? ERROR_TOAST_DURATION : DEFAULT_TOAST_DURATION);
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setToasts((current) => {
      const duplicated = current.some((toast) =>
        toast.type === type && toast.title === next.title && toast.message === next.message
      );
      if (duplicated) return current;
      return [...current, { ...next, type, id }].slice(-4);
    });

    if (duration > 0) {
      const timer = setTimeout(() => dismissToast(id), duration);
      toastTimers.current.set(id, timer);
    }

    return id;
  }, [dismissToast]);

  const confirm = useCallback((options = {}) => {
    if (confirmResolver.current) {
      confirmResolver.current(false);
    }
    setConfirmState({
      variant: CONFIRM_VARIANTS.DEFAULT,
      confirmText: 'Xác nhận',
      cancelText: 'Hủy',
      closeOnOutside: true,
      loading: false,
      ...options
    });
    return new Promise((resolve) => {
      confirmResolver.current = resolve;
    });
  }, []);

  const closeConfirm = useCallback((result) => {
    confirmResolver.current?.(result);
    confirmResolver.current = null;
    setConfirmState(null);
  }, []);

  const showImportantSuccess = useCallback((options = {}) => {
    if (successResolver.current) {
      successResolver.current();
    }
    setSuccessState(options);
    return new Promise((resolve) => {
      successResolver.current = resolve;
    });
  }, []);

  const closeImportantSuccess = useCallback(() => {
    const onAction = successState?.onAction;
    successResolver.current?.();
    successResolver.current = null;
    setSuccessState(null);
    onAction?.();
  }, [successState]);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key !== 'Escape') return;
      if (confirmState) closeConfirm(false);
      if (successState) closeImportantSuccess();
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [closeConfirm, closeImportantSuccess, confirmState, successState]);

  useEffect(() => {
    const timers = toastTimers.current;
    return () => {
      timers.forEach(clearTimeout);
      confirmResolver.current?.(false);
      successResolver.current?.();
    };
  }, []);

  const value = useMemo(() => ({
    showToast,
    success: (input) => showToast(normalizeToast(input, { type: FEEDBACK_TYPES.SUCCESS })),
    error: (input) => showToast(normalizeToast(input, { type: FEEDBACK_TYPES.ERROR })),
    warning: (input) => showToast(normalizeToast(input, { type: FEEDBACK_TYPES.WARNING })),
    info: (input) => showToast(normalizeToast(input, { type: FEEDBACK_TYPES.INFO })),
    confirm,
    showImportantSuccess,
    dismissToast
  }), [confirm, dismissToast, showImportantSuccess, showToast]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      <ConfirmModal
        state={confirmState}
        onCancel={() => closeConfirm(false)}
        onConfirm={() => closeConfirm(true)}
      />
      <ImportantSuccessModal state={successState} onClose={closeImportantSuccess} />
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within FeedbackProvider');
  }
  return context;
}
