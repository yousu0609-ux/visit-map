import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  'https://luyjgoniphfsedqunlec.supabase.co'

const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1eWpnb25pcGhmc2VkcXVubGVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzMyODAsImV4cCI6MjA5NzgwOTI4MH0.QTtwX9s9C_e59U3v3-aghuM1xyw1C0y3mlE99B4OZ0E'

export const supabase =
  createClient(
    supabaseUrl,
    supabaseKey
  )