'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { isRole } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import type { Role } from '@/lib/supabase/types';

/** Admin only. Guarded again here, not just by the page that renders the form. */
export async function changeUserRole(userId: string, role: Role) {
  const { user: currentUser } = await requirePermission('manageRoles');

  if (!isRole(role)) return { error: 'บทบาทไม่ถูกต้อง', ok: null };

  // Removing your own Admin rights would lock everyone out of this page, so
  // require another Admin to do it.
  if (userId === currentUser.id && role !== 'Admin') {
    return { error: 'ไม่สามารถลดสิทธิ์ของตัวเองได้', ok: null };
  }

  const supabase = createClient();
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);

  if (error) {
    console.error('changeUserRole failed', error);
    return { error: `เปลี่ยนบทบาทไม่สำเร็จ: ${error.message}`, ok: null };
  }

  revalidatePath('/dashboard/team');
  revalidatePath('/dashboard');
  return { error: null, ok: 'เปลี่ยนบทบาทเรียบร้อย' };
}
