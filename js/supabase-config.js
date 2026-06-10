// Supabase client — configuración del proyecto
// Project URL y Anon Key: Supabase Dashboard → tu proyecto → Settings → API
// IMPORTANTE: nunca incluir la service_role key en archivos del frontend —
//             esa key solo va en variables de entorno del servidor/backend.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL     = 'https://umdcgevousxaopxljgae.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtZGNnZXZvdXN4YW9weGxqZ2FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMDg3NzYsImV4cCI6MjA5NjY4NDc3Nn0.YRAvRwliE1AqXWJlwxad-4zRXipE0loAsff6VCquEmU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
