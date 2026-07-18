/**
 * Account operations that need server privileges.
 */
import { supabase } from '@/services/supabase';

export interface DeleteAccountResult {
  ok: boolean;
  message: string;
  removedFiles?: number;
}

/**
 * Permanently delete the signed-in user, their evidence records, and their stored
 * media. The Edge Function takes the identity from the caller's JWT, so this can
 * only ever delete your own account.
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  try {
    const { data, error } = await supabase.functions.invoke('delete-account', { body: {} });

    if (error) {
      const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
      let body: Record<string, unknown> | null = null;
      try {
        body = context?.json ? ((await context.json()) as Record<string, unknown>) : null;
      } catch {
        body = null;
      }
      return { ok: false, message: (body?.error as string) ?? error.message };
    }

    const result = data as { removedFiles?: number } | null;
    return {
      ok: true,
      message: 'Your account and all of its evidence have been deleted.',
      removedFiles: result?.removedFiles,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
