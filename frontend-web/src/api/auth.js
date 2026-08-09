import { apiRequest } from './client';
export const authApi={register:p=>apiRequest('/auth/register',{method:'POST',body:JSON.stringify(p)}),login:p=>apiRequest('/auth/login',{method:'POST',body:JSON.stringify(p)}),me:()=>apiRequest('/auth/me')};
