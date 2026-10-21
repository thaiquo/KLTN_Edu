import { Platform } from 'react-native';

const value = process.env.EXPO_PUBLIC_API_URL?.trim();

const localGateway = Platform.OS === 'ios' ? 'http://localhost:8080' : 'http://10.0.2.2:8080';
export const gatewayUrl = (value || localGateway).replace(/\/$/, '');
export const websocketUrl = gatewayUrl.replace(/^http/, 'ws');
const configuredWebUrl = process.env.EXPO_PUBLIC_WEB_URL?.trim();
export const publicWebUrl = (configuredWebUrl || (__DEV__ ? gatewayUrl.replace(/:8080$/, ':5173') : '')).replace(/\/$/, '');
