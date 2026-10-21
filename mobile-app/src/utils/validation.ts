export const emailValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
export const otpValid = (value: string) => /^\d{6}$/.test(value);
export const passwordValid = (value: string) => value.length >= 8 && value.length <= 100;
export const phoneValid = (value: string) => !value || /^\+?[0-9]{8,15}$/.test(value.trim());
