import Log from '../models/Log.js';

export async function logAdminAction(req, action, target_type = '', target_id = '', details = '') {
  try {
    await Log.create({
      admin_id: req.user?.user_id,
      admin_name: req.user?.user_name || 'Unknown',
      action,
      target_type,
      target_id: String(target_id),
      details,
    });
  } catch (err) {
    console.error('Failed to log admin action:', err.message);
  }
}
