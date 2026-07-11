import { base44 } from '@/api/base44Client';

/**
 * Central audit logging helper.
 * Accepts both camelCase and snake_case parameter names for flexibility.
 */
export async function logAudit({
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

  await base44.entities.AuditLog.create(entry);
}