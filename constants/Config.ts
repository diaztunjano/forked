import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

export const SUPABASE_URL: string = extra.supabaseUrl ?? '';
export const SUPABASE_ANON_KEY: string = extra.supabaseAnonKey ?? '';
export const REVENUECAT_IOS_KEY: string = extra.revenuecatIosKey ?? '';
