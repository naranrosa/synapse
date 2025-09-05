// src/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yymfevuotlpuiphoxqct.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bWZldnVvdGxwdWlwaG94cWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwODUwNDEsImV4cCI6MjA3MjY2MTA0MX0.ZohAonNmnLFq9Y8mUjnfA0Gpkx2fKiIcmeu0CFlvQeA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);