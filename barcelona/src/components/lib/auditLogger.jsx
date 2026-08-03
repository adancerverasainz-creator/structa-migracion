import { base44, supabase } from '@/api/base44Client';

/**
 * Central audit logging helper.
 * Accepts both camelCase and snake_case parameter names for flexibility.
 */
/**
 * REGLA DE ORO (estilo SAP/Dynamics): la bitácora NUNCA debe bloquear la
 * operación de negocio. Si el log falla (RLS, red, etc.) se reporta en consola
 * y la operación continúa. Por eso este helper jamás lanza excepción.
 */
export async function logAudit(params) {
  try {
    await _logAudit(params);
  } catch (err) {
    console.error('[auditoría] no se pudo registrar el evento (la operación de negocio NO se afectó):', err?.message || err);
  }
}

async function _logAudit({
  action,
  module,
  // Accept both camelCase and snake_case
  entityType, entity_type,
  entityId, entity_id,
  entityName, entity_name,
  previousValue, previousData, previous_value,
  newValue, newData, new_value,
  monetaryDiff, monetary_diff,
  details = ''
}) {
  const user = await base44.auth.me();

  const resolvedEntityType = entityType || entity_type;
  const resolvedEntityId = entityId || entity_id;
  const resolvedEntityName = entityName || entity_name;
  const resolvedPreviousValue = previousValue ?? previousData ?? previous_value ?? null;
  const resolvedNewValue = newValue ?? newData ?? new_value ?? null;
  const resolvedMonetaryDiff = monetaryDiff ?? monetary_diff ?? null;

  const entry = {
    action,
    module,
    entity_type: resolvedEntityType,
    entity_id: String(resolvedEntityId || ''),
    entity_name: resolvedEntityName || '',
    user_email: user.email,
    details: details || '',
  };

  if (resolvedPreviousValue !== null) {
    entry.previous_value = typeof resolvedPreviousValue === 'string'
      ? resolvedPreviousValue
      : JSON.stringify(resolvedPreviousValue);
  }
  if (resolvedNewValue !== null) {
    entry.new_value = typeof resolvedNewValue === 'string'
      ? resolvedNewValue
      : JSON.stringify(resolvedNewValue);
  }
  if (resolvedMonetaryDiff !== null) {
    entry.monetary_diff = resolvedMonetaryDiff;
  }

  // Insert sin RETURNING: no requiere permiso de lectura sobre audit_logs
  const { error } = await supabase.from('audit_logs').insert(entry);
  if (error) throw error;
}