import { supabase } from './supabase.js';

export async function dashboardSummary() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.functions.invoke('dashboard-summary', {
    body: { action: 'summary' },
  });
  if (error) {
    const response = error.context;
    if (response && typeof response.json === 'function') {
      try {
        const body = await response.json();
        if (body?.error) throw new Error(body.error);
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message !== error.message) throw parseError;
      }
    }
    throw new Error(error.message || 'Dashboard summary could not be loaded.');
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
