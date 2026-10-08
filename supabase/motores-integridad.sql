-- ═══════════════════════════════════════════════════════════════════════════
-- STRUCTA ERP CLUBES — MOTORES DE INTEGRIDAD E IDEMPOTENCIA (esquema canónico)
-- Generado del catálogo vivo de Barcelona Inter Academy el 07/ago/2026.
-- provision-club.sh debe aplicar este archivo a cada club nuevo DESPUÉS del
-- esquema base de tablas. Requiere: has_perm(), get_my_role(), fn_audit_row(),
-- saldos_por_cuenta(), pg_cron.
--
-- Contenido:
--  1. Columnas op_key + índices únicos (idempotencia física, 9 tablas)
--  2. Candados anti doble-reverso (storno, 4 tablas)
--  3. es_mismo_dia_local() — ventana de corrección en hora local del club
--  4. Motor CxP: estatus y egreso derivados por triggers
--  5. normalizar_mes() + month_norm (deuda a prueba de texto libre)
--  6. Auditoría total en BD + dedupe
--  7. RPCs atómicos: abonar_cxp, traspasar_a_fondos, registrar_pagos_summer,
--     revertir_traspaso (abonar_partida y corte_de_caja viven en el esquema base)
--  8. Verificador de invariantes + reconciliación diaria pg_cron
--  9. Folio secuencial de vales de caja (V-000123) — serie global entre módulos
-- 10. verificar_movimiento — verificación pública de vales por QR (único RPC anon)
-- 11. Motor de cortes de caja: entrega calculada por el sistema + confirmación
--     de recepción (doble firma inmutable) + gemelo automático Efectivo→Fondos
-- 12. Reversos (storno) por capturista/admin, motor CxP, verificar_movimiento v4,
--     política de fecha de ingreso y regla de hora local (America/Cancun, no UTC)
--
-- REGLAS AL EXTENDER (no negociables):
--  · Toda operación de negocio con >=2 escrituras = RPC/trigger, jamás cliente.
--  · Todo RPC nuevo: SECURITY DEFINER + set search_path=public + REVOKE anon.
--  · La garantía de no-duplicidad es el índice único, no validaciones de app.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1-2) Columnas e índices de idempotencia y storno --------------------------
alter table payments add column if not exists op_key uuid;
alter table general_payments add column if not exists op_key uuid;
alter table tournament_payments add column if not exists op_key uuid;
alter table league_payments add column if not exists op_key uuid;
alter table summer_camp_payments add column if not exists op_key uuid;
alter table expenses add column if not exists op_key uuid;
alter table account_payable_payments add column if not exists op_key uuid;
alter table caja_cortes add column if not exists op_key uuid;
alter table cash_registers add column if not exists op_key uuid;

create unique index if not exists payments_op_key_uq on payments(op_key) where op_key is not null;
create unique index if not exists general_payments_op_key_uq on general_payments(op_key) where op_key is not null;
create unique index if not exists tournament_payments_op_key_uq on tournament_payments(op_key) where op_key is not null;
create unique index if not exists league_payments_op_key_uq on league_payments(op_key) where op_key is not null;
create unique index if not exists summer_camp_payments_op_key_uq on summer_camp_payments(op_key) where op_key is not null;
create unique index if not exists expenses_op_key_uq on expenses(op_key) where op_key is not null;
create unique index if not exists account_payable_payments_op_key_uq on account_payable_payments(op_key) where op_key is not null;
create unique index if not exists caja_cortes_op_key_uq on caja_cortes(op_key) where op_key is not null;
create unique index if not exists cash_registers_op_key_uq on cash_registers(op_key) where op_key is not null;

create unique index if not exists payments_reversal_of_uq on payments(reversal_of) where reversal_of is not null;
create unique index if not exists general_payments_reversal_of_uq on general_payments(reversal_of) where reversal_of is not null;
create unique index if not exists tournament_payments_reversal_of_uq on tournament_payments(reversal_of) where reversal_of is not null;
create unique index if not exists summer_camp_payments_reversal_of_uq on summer_camp_payments(reversal_of) where reversal_of is not null;

-- Storno de traspasos (Tesorería → Revertir): el contra-movimiento se enlaza al
-- original por reversal_of; el índice único impide revertir dos veces.
alter table expenses add column if not exists reversal_of uuid;
create unique index if not exists ux_expenses_reversal_of on expenses(reversal_of) where reversal_of is not null;

alter table account_payable_payments add column if not exists caja text;
alter table expenses add column if not exists cxp_payment_id uuid;
create unique index if not exists expenses_cxp_payment_id_uq on expenses (cxp_payment_id) where cxp_payment_id is not null;
alter table expenses drop constraint if exists expenses_cxp_payment_fk;
alter table expenses add constraint expenses_cxp_payment_fk
  foreign key (cxp_payment_id) references account_payable_payments(id) on delete cascade;
alter table payments add column if not exists month_norm text;
create index if not exists payments_month_norm_idx on payments(month_norm);

-- 9) Folio secuencial de vales de caja (libro de caja V-000123) ---------------
-- Serie ÚNICA y global entre los 5 módulos de dinero; el trigger asigna nextval
-- al insertar. Los huecos por rollbacks/reversos son legítimos (norma contable:
-- la serie garantiza orden y unicidad, no continuidad perfecta).
create sequence if not exists seq_folio_vale;
alter table payments add column if not exists folio bigint;
alter table general_payments add column if not exists folio bigint;
alter table tournament_payments add column if not exists folio bigint;
alter table summer_camp_payments add column if not exists folio bigint;
alter table expenses add column if not exists folio bigint;
create unique index if not exists ux_payments_folio on payments(folio) where folio is not null;
create unique index if not exists ux_genpay_folio on general_payments(folio) where folio is not null;
create unique index if not exists ux_tourpay_folio on tournament_payments(folio) where folio is not null;
create unique index if not exists ux_scpay_folio on summer_camp_payments(folio) where folio is not null;
create unique index if not exists ux_expenses_folio on expenses(folio) where folio is not null;

-- 3..8) Funciones, triggers y reloj ------------------------------------------
-- NOTA: las definiciones completas y VIGENTES de las funciones se extraen del
-- catálogo del club plantilla con el generador de abajo. Para provisionar un
-- club nuevo, ejecutar el generador contra la plantilla y aplicar su salida:
--
--   select string_agg(pg_get_functiondef(p.oid) || ';', E'\n\n')
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname in (
--     'es_mismo_dia_local','normalizar_mes','fn_payments_month_norm',
--     'fn_cxp_recalcular_status','fn_cxp_crear_egreso','fn_audit_dedup',
--     'abonar_partida','abonar_cxp','traspasar_a_fondos','registrar_pagos_summer',
--     'corte_de_caja','reversar_pago','reversar_pago_summer','reversar_pago_torneo',
--     'reversar_pago_general','fn_integridad_chequeos',
--     'verificar_integridad_financiera','cron_reconciliacion_diaria',
--     'revertir_traspaso','fn_asigna_folio_vale','verificar_movimiento');

-- Triggers (idénticos en cada club):
drop trigger if exists trg_cxp_recalcular_status on account_payable_payments;
create trigger trg_cxp_recalcular_status after insert or update or delete on account_payable_payments
  for each row execute function fn_cxp_recalcular_status();
drop trigger if exists trg_cxp_crear_egreso on account_payable_payments;
create trigger trg_cxp_crear_egreso after insert on account_payable_payments
  for each row execute function fn_cxp_crear_egreso();
drop trigger if exists trg_payments_month_norm on payments;
create trigger trg_payments_month_norm before insert or update of month on payments
  for each row execute function fn_payments_month_norm();
drop trigger if exists trg_audit_dedup on audit_logs;
create trigger trg_audit_dedup before insert on audit_logs
  for each row execute function fn_audit_dedup();
drop trigger if exists trg_audit_payments on payments;
create trigger trg_audit_payments after insert or update or delete on payments
  for each row execute function fn_audit_row('Pagos', 'Payment');
drop trigger if exists trg_audit_general_payments on general_payments;
create trigger trg_audit_general_payments after insert or update or delete on general_payments
  for each row execute function fn_audit_row('Pagos Generales', 'GeneralPayment');
drop trigger if exists trg_audit_summer_payments on summer_camp_payments;
create trigger trg_audit_summer_payments after insert or update or delete on summer_camp_payments
  for each row execute function fn_audit_row('Summer Camp', 'SummerCampPayment');
drop trigger if exists trg_audit_expenses on expenses;
create trigger trg_audit_expenses after insert or update or delete on expenses
  for each row execute function fn_audit_row('Egresos', 'Expense');
drop trigger if exists trg_audit_players on players;
create trigger trg_audit_players after insert or update or delete on players
  for each row execute function fn_audit_row('Jugadores', 'Player');

-- Folio secuencial (BEFORE INSERT: asigna nextval('seq_folio_vale') si viene null):
drop trigger if exists trg_folio_payments on payments;
create trigger trg_folio_payments before insert on payments
  for each row execute function fn_asigna_folio_vale();
drop trigger if exists trg_folio_genpay on general_payments;
create trigger trg_folio_genpay before insert on general_payments
  for each row execute function fn_asigna_folio_vale();
drop trigger if exists trg_folio_tourpay on tournament_payments;
create trigger trg_folio_tourpay before insert on tournament_payments
  for each row execute function fn_asigna_folio_vale();
drop trigger if exists trg_folio_scpay on summer_camp_payments;
create trigger trg_folio_scpay before insert on summer_camp_payments
  for each row execute function fn_asigna_folio_vale();
drop trigger if exists trg_folio_expenses on expenses;
create trigger trg_folio_expenses before insert on expenses
  for each row execute function fn_asigna_folio_vale();

-- Reloj de reconciliación (05:00 America/Cancun = 10:00 UTC):
create extension if not exists pg_cron;
-- select cron.schedule('reconciliacion-diaria', '0 10 * * *', 'select cron_reconciliacion_diaria()');

-- 11) Motor de cortes de caja (Tesorería → Fondos) --------------------------
-- Diseño: el corte NO se captura. El sistema calcula el neto por día de
-- operación (cobros efectivo de caja chica − gastos efectivo de caja chica),
-- la cajera lo ENTREGA con un clic y el admin lo CONFIRMA como recibido
-- (doble firma, inmutable). Reglas:
--  · una entrega por día de operación (uq_cash_registers_corte_fecha)
--  · lo anterior al 2026-10-02 se considera conciliado (fecha de arranque; en
--    un club nuevo ajustar esa constante en cortes_pendientes/entregar_corte)
--  · el día en curso se entrega al día siguiente
--  · diferencias por pagos retro-fechados se suman por UPDATE si la entrega
--    sigue en tránsito; si ya fue confirmada, error claro
--  · confirmar solo admin y solo si neto vigente = entregado
--  · el egreso gemelo (Efectivo → Fondos) lo crea SIEMPRE el trigger
--    trg_corte_doble_asiento; jamás insertar egresos 'corte' a mano.
alter table cash_registers add column if not exists corte_fecha date;
alter table cash_registers add column if not exists recibido_por text;
alter table cash_registers add column if not exists recibido_at timestamptz;
create unique index if not exists uq_cash_registers_corte_fecha
  on cash_registers(corte_fecha) where corte_fecha is not null;
create index if not exists ix_cash_registers_corte_fecha
  on cash_registers(corte_fecha) where corte_fecha is not null;

-- Gemelo automático del corte (debita Efectivo; Fondos se acredita con el corte)
create or replace function fn_corte_doble_asiento() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
begin
  if tg_op = 'INSERT' then
    insert into expenses (concept, amount, expense_date, category, payment_method, account,
                          is_transfer, transfer_to, source_module, op_key, notes, created_by)
    select 'Corte de caja — depósito a Fondos', new.cash_amount, new.register_date, 'otros', 'efectivo', null,
           true, 'Fondos', 'corte', new.id,
           'Gemelo automático del corte de caja del ' || to_char(new.register_date,'DD/MM/YYYY') || ' (debita Efectivo; Fondos se acredita con el corte).',
           coalesce(new.created_by, 'corte-doble-asiento')
    where not exists (select 1 from expenses e where e.op_key = new.id and e.source_module = 'corte');
    return new;
  elsif tg_op = 'UPDATE' then
    update expenses set amount = new.cash_amount, expense_date = new.register_date
      where op_key = new.id and source_module = 'corte';
    return new;
  elsif tg_op = 'DELETE' then
    delete from expenses where op_key = old.id and source_module = 'corte';
    return old;
  end if;
  return null;
end $function$;
drop trigger if exists trg_corte_doble_asiento on cash_registers;
create trigger trg_corte_doble_asiento after insert or delete or update on cash_registers
  for each row execute function fn_corte_doble_asiento();

-- Una entrega confirmada (doble firma) es inmutable
create or replace function trg_proteger_corte_confirmado() returns trigger
language plpgsql as $function$
begin
  if tg_op = 'DELETE' then
    if old.recibido_at is not null then
      raise exception 'Esta entrega de corte ya fue confirmada (doble firma): no se puede eliminar';
    end if;
    return old;
  end if;
  if old.recibido_at is not null and (
       new.cash_amount is distinct from old.cash_amount
    or new.corte_fecha is distinct from old.corte_fecha
    or new.register_date is distinct from old.register_date
    or new.recibido_at is distinct from old.recibido_at
    or new.recibido_por is distinct from old.recibido_por
  ) then
    raise exception 'Esta entrega de corte ya fue confirmada (doble firma): no se puede modificar';
  end if;
  return new;
end $function$;
drop trigger if exists trg_proteger_corte_confirmado on cash_registers;
create trigger trg_proteger_corte_confirmado before delete or update on cash_registers
  for each row when (old.corte_fecha is not null)
  execute function trg_proteger_corte_confirmado();

-- Fórmula del corte: cobros efectivo vigentes de caja chica (bank_name<>'Fondos',
-- sin reversos ni reversados) MENOS gastos efectivo de caja chica (account<>'Fondos',
-- sin nómina, sin traspasos, source_module null/'egresos'/'cxp': los abonos CxP en
-- efectivo salen de la caja chica porque el motor CxP guarda los pagados desde
-- Fondos como transferencia/'Fondos'). Fix CxP 06/10/2026.
create or replace function corte_neto_por_dia(p_desde date)
returns table(fecha date, cobros numeric, gastos numeric, neto numeric)
language sql security definer set search_path to 'public' as $function$
with rev_pay as (
  select reversal_of as id from payments where reversal_of is not null
  union select reversal_of from general_payments where reversal_of is not null
  union select reversal_of from tournament_payments where reversal_of is not null
  union select reversal_of from summer_camp_payments where reversal_of is not null
),
cobros as (
  select payment_date d, amount + coalesce(surcharge,0) as m from payments
    where payment_method='efectivo' and coalesce(bank_name,'')<>'Fondos' and reversal_of is null
      and id not in (select id from rev_pay)
  union all
  select payment_date, amount from general_payments
    where payment_method='efectivo' and coalesce(bank_name,'')<>'Fondos' and reversal_of is null
      and id not in (select id from rev_pay)
  union all
  select payment_date, coalesce(paid_amount, amount) from tournament_payments
    where payment_method='efectivo' and coalesce(bank_name,'')<>'Fondos' and reversal_of is null
      and id not in (select id from rev_pay)
  union all
  select payment_date, amount from league_payments
    where payment_method='efectivo' and coalesce(bank_name,'')<>'Fondos'
  union all
  select payment_date, amount from summer_camp_payments
    where payment_method='efectivo' and coalesce(bank_name,'')<>'Fondos' and reversal_of is null
      and id not in (select id from rev_pay)
),
rev_exp as (select reversal_of as id from expenses where reversal_of is not null),
gastos as (
  select expense_date d, amount m from expenses
  where payment_method='efectivo' and coalesce(account,'')<>'Fondos'
    and payroll_item_id is null and coalesce(is_transfer,false)=false
    and (source_module is null or source_module in ('egresos','cxp'))
    and reversal_of is null and id not in (select id from rev_exp)
)
select t.d::date, coalesce(sum(t.cobro),0), coalesce(sum(t.gasto),0),
       coalesce(sum(t.cobro),0)-coalesce(sum(t.gasto),0)
from (
  select d, m as cobro, null::numeric as gasto from cobros
  union all
  select d, null, m from gastos
) t
where t.d::date >= p_desde
group by t.d::date
$function$;

create or replace function cortes_pendientes()
returns table(fecha date, cobros numeric, gastos numeric, neto numeric, entregado numeric, pendiente numeric, es_hoy boolean)
language plpgsql security definer set search_path to 'public' as $function$
declare v_hoy date := (now() at time zone 'America/Cancun')::date;
begin
  if not has_perm('payments','create') then
    raise exception 'Sin permiso para consultar cortes';
  end if;
  return query
  select n.fecha, n.cobros, n.gastos, n.neto,
         coalesce(e.total,0) as entregado,
         n.neto - coalesce(e.total,0) as pendiente,
         (n.fecha = v_hoy) as es_hoy
  from corte_neto_por_dia('2026-10-02'::date) n
  left join (
    select corte_fecha, sum(cash_amount) total
    from cash_registers where corte_fecha is not null group by corte_fecha
  ) e on e.corte_fecha = n.fecha
  where (n.neto - coalesce(e.total,0)) <> 0 or n.fecha = v_hoy
  order by n.fecha;
end $function$;

create or replace function entregar_corte(p_fecha date, p_op_key uuid default null)
returns uuid
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_hoy date := (now() at time zone 'America/Cancun')::date;
  v_email text; v_neto numeric; v_entregado numeric; v_pendiente numeric;
  v_row cash_registers%rowtype; v_id uuid; v_twin uuid;
begin
  if not has_perm('payments','create') then
    raise exception 'Sin permiso para registrar entregas de corte';
  end if;
  if p_fecha is null or p_fecha < '2026-10-02'::date then
    raise exception 'Fecha fuera del rango de cortes (lo anterior al 02/10/2026 ya está conciliado)';
  end if;
  if p_fecha >= v_hoy then
    raise exception 'El corte del día en curso se entrega al día siguiente, cuando el día esté cerrado';
  end if;
  if p_op_key is not null then
    select id into v_id from cash_registers where op_key = p_op_key;
    if found then return v_id; end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('entregar_corte_' || p_fecha::text));

  select neto into v_neto from corte_neto_por_dia(p_fecha) where fecha = p_fecha;
  v_neto := coalesce(v_neto, 0);
  select * into v_row from cash_registers where corte_fecha = p_fecha for update;
  v_entregado := coalesce(v_row.cash_amount, 0);
  v_pendiente := v_neto - v_entregado;

  if v_pendiente <= 0 then
    raise exception 'No hay corte pendiente para el % (neto del día: %, ya entregado: %)',
      to_char(p_fecha,'DD/MM/YYYY'), v_neto, v_entregado;
  end if;

  select email into v_email from profiles where id = auth.uid();

  if v_row.id is not null then
    if v_row.recibido_at is not null then
      raise exception 'El corte del % ya fue confirmado con doble firma por %. La diferencia de % proviene de un registro retro-fechado: captúralo con fecha de hoy o reversa el registro que la causó.',
        to_char(p_fecha,'DD/MM/YYYY'), v_row.recibido_por, v_pendiente;
    end if;
    -- En tránsito: se suma la diferencia (el trigger ajusta el egreso gemelo)
    update cash_registers
       set cash_amount = v_row.cash_amount + v_pendiente,
           notes = coalesce(v_row.notes,'') || ' | +' || v_pendiente || ' (diferencia ' ||
                   to_char(v_hoy,'DD/MM/YYYY') || ', ' || coalesce(v_email,'desconocido') || ')'
     where id = v_row.id;
    v_id := v_row.id;
  else
    insert into cash_registers (cash_amount, register_date, source, notes, created_by, corte_fecha, op_key)
    values (v_pendiente, v_hoy, 'Corte de caja',
            'Corte del ' || to_char(p_fecha,'DD/MM/YYYY') || ' — monto calculado por el sistema. Entrega: ' || coalesce(v_email,'desconocido'),
            v_email, p_fecha, p_op_key)
    returning id into v_id;
  end if;

  -- Candado: el gemelo del trigger debe existir y cuadrar con lo entregado
  select id into v_twin from expenses
   where op_key = v_id and source_module = 'corte'
     and abs(amount - (v_entregado + v_pendiente)) <= 0.005
   limit 1;
  if v_twin is null then
    raise exception 'El egreso gemelo del corte no existe o no cuadra (¿trigger deshabilitado?). Operación cancelada.';
  end if;

  return v_id;
end $function$;

create or replace function confirmar_recepcion_corte(p_cash_id uuid)
returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_row cash_registers%rowtype;
  v_email text;
  v_neto numeric;
  v_entregado numeric;
begin
  if get_my_role() <> 'admin' then
    raise exception 'Solo un administrador puede confirmar la recepción de un corte';
  end if;

  select * into v_row from cash_registers where id = p_cash_id for update;
  if not found then raise exception 'Entrega no encontrada'; end if;
  if v_row.corte_fecha is null then
    raise exception 'Este registro no es una entrega de corte (no tiene día de operación vinculado)';
  end if;
  if v_row.recibido_at is not null then
    raise exception 'Esta entrega ya fue confirmada por % el %', v_row.recibido_por, to_char(v_row.recibido_at,'DD/MM/YYYY HH24:MI');
  end if;

  -- Regla del CEO: no se confirma si el dinero no está completo con datos
  -- vigentes. Si hubo reversos después de la entrega, primero se corrige.
  select neto into v_neto from corte_neto_por_dia(v_row.corte_fecha) where fecha = v_row.corte_fecha;
  v_neto := coalesce(v_neto, 0);
  select coalesce(sum(cash_amount),0) into v_entregado
    from cash_registers where corte_fecha = v_row.corte_fecha;

  if abs(v_neto - v_entregado) > 0.005 then
    raise exception 'El corte del % ya no cuadra: neto vigente % vs entregado %. Reversa o corrige los registros del día antes de confirmar la recepción.',
      to_char(v_row.corte_fecha,'DD/MM/YYYY'), v_neto, v_entregado;
  end if;

  select email into v_email from profiles where id = auth.uid();

  update cash_registers
     set recibido_por = coalesce(v_email,'admin'), recibido_at = now()
   where id = p_cash_id;
end $function$;

-- corte_de_caja v2 (flujo manual/legacy con arqueo): ya NO inserta egreso propio;
-- el gemelo lo crea trg_corte_doble_asiento y aquí solo se valida que exista.
create or replace function corte_de_caja(p_saldo_sistema numeric, p_contado numeric, p_monto numeric,
  p_recibe text, p_notas text default null, p_op_key uuid default null)
returns uuid
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_email text; v_arqueo_id uuid; v_expense_id uuid; v_cash_id uuid; v_corte_id uuid;
begin
  if not has_perm('payments','create') then
    raise exception 'No tienes permiso para realizar cortes de caja';
  end if;
  if p_monto is null or p_monto <= 0 then raise exception 'El monto a entregar debe ser mayor a cero'; end if;
  if p_monto > p_contado then
    raise exception 'No puedes entregar más de lo contado físicamente (contado: %)', p_contado;
  end if;
  if p_recibe is null or length(trim(p_recibe)) < 3 then
    raise exception 'Indica quién recibe el efectivo en custodia';
  end if;
  if p_op_key is not null then
    select id into v_corte_id from caja_cortes where op_key = p_op_key;
    if found then return v_corte_id; end if;
  end if;

  select email into v_email from profiles where id = auth.uid();

  insert into caja_arqueos (saldo_sistema, efectivo_contado, notas, contado_por)
  values (p_saldo_sistema, p_contado, 'CORTE DE CAJA — ' || coalesce(trim(p_notas), 'sin notas'), coalesce(v_email,'desconocido'))
  returning id into v_arqueo_id;

  insert into cash_registers (cash_amount, register_date, source, notes, created_by)
  values (p_monto, (now() at time zone 'America/Cancun')::date, 'Corte de Caja — entrega en custodia',
          'Entrega: ' || coalesce(v_email,'desconocido') || ' → Recibe: ' || trim(p_recibe), v_email)
  returning id into v_cash_id;

  select id into v_expense_id from expenses
  where op_key = v_cash_id and source_module = 'corte' limit 1;
  if v_expense_id is null then
    raise exception 'No se generó el egreso gemelo del corte (¿trigger trg_corte_doble_asiento deshabilitado?). Corte cancelado.';
  end if;

  insert into caja_cortes (saldo_sistema, efectivo_contado, monto_entregado, entrega, recibe, notas,
                           expense_id, cash_register_id, arqueo_id, created_by, op_key)
  values (p_saldo_sistema, p_contado, p_monto, coalesce(v_email,'desconocido'), trim(p_recibe), p_notas,
          v_expense_id, v_cash_id, v_arqueo_id, v_email, p_op_key)
  returning id into v_corte_id;

  return v_corte_id;
end $function$;

-- Seguridad del motor de cortes: REVOKE FROM PUBLIC (no basta anon/authenticated:
-- el permiso por defecto viene de PUBLIC). Internas sin grant a clientes.
revoke execute on function corte_neto_por_dia(date) from public;
revoke execute on function fn_corte_doble_asiento() from public;
revoke execute on function trg_proteger_corte_confirmado() from public;
revoke execute on function cortes_pendientes() from public;
revoke execute on function entregar_corte(date, uuid) from public;
revoke execute on function confirmar_recepcion_corte(uuid) from public;
revoke execute on function corte_de_caja(numeric, numeric, numeric, text, text, uuid) from public;
grant execute on function cortes_pendientes() to authenticated;
grant execute on function entregar_corte(date, uuid) to authenticated;
grant execute on function confirmar_recepcion_corte(uuid) to authenticated;
grant execute on function corte_de_caja(numeric, numeric, numeric, text, text, uuid) to authenticated;

-- 12) Motores de reversos (storno), CxP, vales y política de fecha ----------
-- Zona horaria: TODA fecha "de hoy" que asienta la BD usa
--   (now() at time zone 'America/Cancun')::date
-- JAMÁS current_date (la BD corre en UTC: después de las 19:00 en Cancún
-- current_date ya es el día siguiente y corre reversos/altas al día equivocado).
-- Ajustar la zona si el club no está en Cancún.
--
-- Reversos (storno): el pasado no se reescribe; el contra-movimiento (monto en
-- negativo, reversal_of = id original) se asienta HOY. El índice único
-- *_reversal_of_uq impide reversar dos veces. Permiso: admin o QUIEN CAPTURÓ el
-- movimiento. Motivo obligatorio (>=5 caracteres).
create or replace function es_mismo_dia_local(ts timestamptz) returns boolean
language sql stable set search_path to 'public' as $function$
  select (ts at time zone 'America/Cancun')::date = (now() at time zone 'America/Cancun')::date
$function$;

create or replace function reversar_pago(p_payment_id uuid, p_motivo text) returns uuid
language plpgsql security definer set search_path to 'public' as $function$
declare v_orig payments%rowtype; v_new_id uuid; v_email text;
begin
  select email into v_email from profiles where id = auth.uid();
  if p_motivo is null or length(trim(p_motivo)) < 5 then
    raise exception 'El motivo del reverso es obligatorio (mínimo 5 caracteres)';
  end if;
  select * into v_orig from payments where id = p_payment_id for update;
  if not found then raise exception 'Pago no encontrado'; end if;
  if get_my_role() <> 'admin' and coalesce(v_orig.created_by,'') <> coalesce(v_email,'??') then
    raise exception 'Solo un administrador o quien capturó el movimiento puede reversarlo';
  end if;
  if v_orig.reversal_of is not null then raise exception 'Este movimiento ya es un reverso: no se puede reversar un reverso'; end if;
  if exists (select 1 from payments where reversal_of = p_payment_id) then raise exception 'Este pago ya fue reversado'; end if;
  insert into payments (player_id, payment_type, amount, surcharge, payment_date, month,
    payment_method, bank_name, reference_number, notes, status, created_by, reversal_of)
  values (v_orig.player_id, v_orig.payment_type, -v_orig.amount, -coalesce(v_orig.surcharge,0),
    (now() at time zone 'America/Cancun')::date, v_orig.month, v_orig.payment_method, v_orig.bank_name, v_orig.reference_number,
    'REVERSO — ' || trim(p_motivo), 'pagado', v_email, p_payment_id)
  returning id into v_new_id;
  return v_new_id;
end; $function$;

create or replace function reversar_pago_general(p_id uuid, p_motivo text) returns uuid
language plpgsql security definer set search_path to 'public' as $function$
declare v_o general_payments%rowtype; v_new uuid; v_email text;
begin
  select email into v_email from profiles where id = auth.uid();
  if p_motivo is null or length(trim(p_motivo)) < 5 then raise exception 'El motivo del reverso es obligatorio (mínimo 5 caracteres)'; end if;
  select * into v_o from general_payments where id = p_id for update;
  if not found then raise exception 'Pago no encontrado'; end if;
  if get_my_role() <> 'admin' and coalesce(v_o.created_by,'') <> coalesce(v_email,'??') then
    raise exception 'Solo un administrador o quien capturó el movimiento puede reversarlo';
  end if;
  if v_o.reversal_of is not null then raise exception 'Este movimiento ya es un reverso'; end if;
  if exists (select 1 from general_payments where reversal_of = p_id) then raise exception 'Este pago ya fue reversado'; end if;
  insert into general_payments (concept, amount, payment_date, payment_method, bank_name, reference_number,
    category, notes, created_by, reversal_of)
  values ('REVERSO: ' || v_o.concept, -coalesce(v_o.amount,0), (now() at time zone 'America/Cancun')::date, v_o.payment_method, v_o.bank_name,
    v_o.reference_number, v_o.category, 'REVERSO — ' || trim(p_motivo), v_email, p_id)
  returning id into v_new;
  return v_new;
end; $function$;

create or replace function reversar_pago_summer(p_id uuid, p_motivo text) returns uuid
language plpgsql security definer set search_path to 'public' as $function$
declare v_o summer_camp_payments%rowtype; v_new uuid; v_email text;
begin
  select email into v_email from profiles where id = auth.uid();
  if p_motivo is null or length(trim(p_motivo)) < 5 then raise exception 'El motivo del reverso es obligatorio (mínimo 5 caracteres)'; end if;
  select * into v_o from summer_camp_payments where id = p_id for update;
  if not found then raise exception 'Pago no encontrado'; end if;
  if get_my_role() <> 'admin' and coalesce(v_o.created_by,'') <> coalesce(v_email,'??') then
    raise exception 'Solo un administrador o quien capturó el movimiento puede reversarlo';
  end if;
  if v_o.reversal_of is not null then raise exception 'Este movimiento ya es un reverso'; end if;
  if exists (select 1 from summer_camp_payments where reversal_of = p_id) then raise exception 'Este pago ya fue reversado'; end if;
  insert into summer_camp_payments (player_id, external_player_id, player_name, payment_type, week_number,
    base_amount, discount, discount_reason, amount, payment_date, payment_method, bank_name, reference_number,
    status, notes, created_by, reversal_of)
  values (v_o.player_id, v_o.external_player_id, v_o.player_name, v_o.payment_type, v_o.week_number,
    -coalesce(v_o.base_amount,0), 0, null, -coalesce(v_o.amount,0), (now() at time zone 'America/Cancun')::date, v_o.payment_method, v_o.bank_name,
    v_o.reference_number, 'pagado', 'REVERSO — ' || trim(p_motivo), v_email, p_id)
  returning id into v_new;
  return v_new;
end; $function$;

create or replace function reversar_pago_torneo(p_id uuid, p_motivo text) returns uuid
language plpgsql security definer set search_path to 'public' as $function$
declare v_o tournament_payments%rowtype; v_new uuid; v_email text;
begin
  select email into v_email from profiles where id = auth.uid();
  if p_motivo is null or length(trim(p_motivo)) < 5 then raise exception 'El motivo del reverso es obligatorio (mínimo 5 caracteres)'; end if;
  select * into v_o from tournament_payments where id = p_id for update;
  if not found then raise exception 'Pago no encontrado'; end if;
  if get_my_role() <> 'admin' and coalesce(v_o.created_by,'') <> coalesce(v_email,'??') then
    raise exception 'Solo un administrador o quien capturó el movimiento puede reversarlo';
  end if;
  if v_o.reversal_of is not null then raise exception 'Este movimiento ya es un reverso'; end if;
  if exists (select 1 from tournament_payments where reversal_of = p_id) then raise exception 'Este pago ya fue reversado'; end if;
  insert into tournament_payments (player_id, external_attendee_id, external_name, tournament_id, amount, paid_amount,
    payment_date, payment_method, bank_name, reference_number, notes, status, created_by, reversal_of)
  values (v_o.player_id, v_o.external_attendee_id, v_o.external_name, v_o.tournament_id, -coalesce(v_o.amount,0),
    -coalesce(v_o.paid_amount, v_o.amount, 0), (now() at time zone 'America/Cancun')::date, v_o.payment_method, v_o.bank_name, v_o.reference_number,
    'REVERSO — ' || trim(p_motivo), 'pagado', v_email, p_id)
  returning id into v_new;
  return v_new;
end; $function$;

-- Egresos: solo los capturados a mano (source_module null/'egresos'). Los de
-- Nómina, CxP, traspasos y otros módulos se corrigen en su módulo de origen.
create or replace function reversar_egreso(p_id uuid, p_motivo text) returns uuid
language plpgsql security definer set search_path to 'public' as $function$
declare v_o expenses%rowtype; v_new uuid; v_email text;
begin
  select email into v_email from profiles where id = auth.uid();
  if p_motivo is null or length(trim(p_motivo)) < 5 then raise exception 'El motivo del reverso es obligatorio (mínimo 5 caracteres)'; end if;
  select * into v_o from expenses where id = p_id for update;
  if not found then raise exception 'Egreso no encontrado'; end if;
  if get_my_role() <> 'admin' and coalesce(v_o.created_by,'') <> coalesce(v_email,'??') then
    raise exception 'Solo un administrador o quien capturó el egreso puede reversarlo';
  end if;
  if v_o.payroll_item_id is not null then raise exception 'Este egreso lo generó Nómina: se corrige desde el módulo de Nómina'; end if;
  if v_o.cxp_payment_id is not null then raise exception 'Este egreso lo generó Cuentas por Pagar: el abono se reversa desde CxP'; end if;
  if v_o.is_transfer then raise exception 'Los traspasos se revierten desde Tesorería (botón Revertir)'; end if;
  if v_o.source_module is not null and v_o.source_module <> 'egresos' then raise exception 'Este egreso lo generó otro módulo (%): se corrige ahí', v_o.source_module; end if;
  if v_o.reversal_of is not null then raise exception 'Este movimiento ya es un reverso'; end if;
  if exists (select 1 from expenses where reversal_of = p_id) then raise exception 'Este egreso ya fue reversado'; end if;
  insert into expenses (concept, amount, expense_date, category, payment_method, account,
    notes, created_by, reversal_of, source_module)
  values ('REVERSO — ' || v_o.concept, -coalesce(v_o.amount,0), (now() at time zone 'America/Cancun')::date, v_o.category, v_o.payment_method,
    v_o.account, 'REVERSO — ' || trim(p_motivo), v_email, p_id, 'egresos')
  returning id into v_new;
  return v_new;
end; $function$;

-- Motor CxP: el abono tiene candado de sobregiro; el egreso lo crea el trigger.
-- Un abono en EFECTIVO desde caja_principal se guarda como transferencia/'Fondos'
-- (sale de Fondos); cualquier otro abono en efectivo sale de la caja chica y SÍ
-- descuenta el corte (corte_neto_por_dia incluye source_module 'cxp').
create or replace function abonar_cxp(p_account_id uuid, p_monto numeric, p_metodo text,
  p_banco text default null, p_referencia text default null, p_fecha date default null,
  p_notas text default null, p_caja text default null, p_op_key uuid default null)
returns uuid
language plpgsql security definer set search_path to 'public' as $function$
declare v_email text; v_payment_id uuid; v_total numeric; v_pagado numeric; v_pendiente numeric;
begin
  if not has_perm('cxp','create') then
    raise exception 'No tienes permiso para registrar abonos en Cuentas por Pagar';
  end if;
  if p_monto is null or p_monto <= 0 then raise exception 'El monto del abono debe ser mayor a cero'; end if;
  if p_metodo is null or p_metodo not in ('efectivo','tarjeta','transferencia') then
    raise exception 'Método de pago inválido';
  end if;
  select total_amount into v_total from accounts_payable where id = p_account_id for update;
  if not found then raise exception 'Cuenta por pagar no encontrada'; end if;
  if p_op_key is not null then
    select id into v_payment_id from account_payable_payments where op_key = p_op_key;
    if found then return v_payment_id; end if;
  end if;
  select coalesce(sum(amount),0) into v_pagado from account_payable_payments where account_payable_id = p_account_id;
  v_pendiente := coalesce(v_total,0) - v_pagado;
  if p_monto > v_pendiente + 0.005 then
    raise exception 'El abono ($%) excede el pendiente de esta cuenta ($%). Si pagaste de más a este proveedor, el excedente se registra como abono en OTRA cuenta por pagar del mismo proveedor.', p_monto, v_pendiente;
  end if;
  select email into v_email from profiles where id = auth.uid();
  insert into account_payable_payments (account_payable_id, amount, payment_date, payment_method,
                                        bank_name, reference_number, notes, caja, created_by, op_key)
  values (p_account_id, p_monto, coalesce(p_fecha, (now() at time zone 'America/Cancun')::date),
          p_metodo, p_banco, p_referencia, p_notas, p_caja, v_email, p_op_key)
  returning id into v_payment_id;
  return v_payment_id;
end $function$;

create or replace function fn_cxp_crear_egreso() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_ap accounts_payable%rowtype;
begin
  select * into v_ap from accounts_payable where id = new.account_payable_id;
  insert into expenses (concept, amount, expense_date, category, payment_method, account,
                        notes, source_module, is_transfer, created_by, cxp_payment_id)
  values (
    'Abono CxP: ' || coalesce(trim(v_ap.concept),'') || coalesce(' - ' || nullif(trim(v_ap.supplier),''), ''),
    new.amount,
    coalesce(new.payment_date, (now() at time zone 'America/Cancun')::date),
    coalesce(v_ap.category,'otros'),
    case when new.payment_method = 'efectivo' and new.caja = 'caja_principal' then 'transferencia' else new.payment_method end,
    case when new.payment_method = 'efectivo' and new.caja = 'caja_principal' then 'Fondos'
         when new.payment_method = 'transferencia' then new.bank_name else null end,
    'Egreso automático (motor de integridad CxP)'
      || coalesce(' | Ref: ' || nullif(new.reference_number,''), '')
      || coalesce(' | ' || nullif(new.notes,''), ''),
    'cxp', false, new.created_by, new.id
  )
  on conflict (cxp_payment_id) where cxp_payment_id is not null do nothing;
  return null;
end;
$function$;

-- Política de fecha de ingreso de jugadores: solo admin puede dar altas o mover
-- la fecha a un día pasado. "Hoy" se mide en hora de Cancún, NO current_date UTC
-- (con UTC, Carmen quedaba bloqueada después de las 19:00 — incidente 07/10/2026).
create or replace function enforce_join_date_policy() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_hoy date := (now() at time zone 'America/Cancun')::date;
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    if new.join_date is not null and new.join_date < v_hoy and not is_admin() then
      raise exception 'Solo un administrador puede dar de alta jugadores con fecha de ingreso retroactiva';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.join_date is distinct from old.join_date
       and new.join_date is not null and new.join_date < v_hoy and not is_admin() then
      raise exception 'Solo un administrador puede modificar la fecha de ingreso a una fecha retroactiva';
    end if;
  end if;
  return new;
end;
$function$;
drop trigger if exists trg_join_date_policy on players;
create trigger trg_join_date_policy before insert or update on players
  for each row execute function enforce_join_date_policy();

-- verificar_movimiento v4: verificación PÚBLICA de vales por QR (único RPC con
-- grant a anon). Contrato: devuelve SOLO {encontrado,tipo,folio,fecha,monto,
-- concepto,metodo,estado,club} — jamás datos personales. Un movimiento con
-- reverso se muestra como 'REVERSADO'.
create or replace function verificar_movimiento(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $function$
declare r jsonb; b jsonb;
begin
  select value into b from club_settings where key = 'branding';
  b := coalesce(b, '{}'::jsonb);

  select jsonb_build_object('encontrado', true, 'tipo', 'INGRESO',
    'folio', case when folio is not null then 'V-' || lpad(folio::text, 6, '0') end,
    'fecha', payment_date::date, 'monto', amount,
    'concepto', initcap(coalesce(payment_type,'pago')) || coalesce(' ' || month, ''),
    'metodo', payment_method,
    'estado', case when exists (select 1 from payments rev where rev.reversal_of = p_id) then 'REVERSADO' else 'VIGENTE' end)
  into r from payments where id = p_id and reversal_of is null;
  if r is not null then return r || jsonb_build_object('club', b); end if;

  select jsonb_build_object('encontrado', true, 'tipo', 'INGRESO',
    'folio', case when folio is not null then 'V-' || lpad(folio::text, 6, '0') end,
    'fecha', payment_date::date, 'monto', amount,
    'concepto', coalesce(concept, 'Pago general'), 'metodo', payment_method,
    'estado', case when exists (select 1 from general_payments rev where rev.reversal_of = p_id) then 'REVERSADO' else 'VIGENTE' end)
  into r from general_payments where id = p_id and reversal_of is null;
  if r is not null then return r || jsonb_build_object('club', b); end if;

  select jsonb_build_object('encontrado', true, 'tipo', 'INGRESO',
    'folio', case when folio is not null then 'V-' || lpad(folio::text, 6, '0') end,
    'fecha', payment_date::date, 'monto', coalesce(paid_amount, amount),
    'concepto', 'Pago de torneo', 'metodo', payment_method,
    'estado', case when exists (select 1 from tournament_payments rev where rev.reversal_of = p_id) then 'REVERSADO' else 'VIGENTE' end)
  into r from tournament_payments where id = p_id and reversal_of is null;
  if r is not null then return r || jsonb_build_object('club', b); end if;

  select jsonb_build_object('encontrado', true, 'tipo', 'INGRESO',
    'folio', case when folio is not null then 'V-' || lpad(folio::text, 6, '0') end,
    'fecha', payment_date::date, 'monto', amount,
    'concepto', 'Summer Camp', 'metodo', payment_method,
    'estado', case when exists (select 1 from summer_camp_payments rev where rev.reversal_of = p_id) then 'REVERSADO' else 'VIGENTE' end)
  into r from summer_camp_payments where id = p_id and status = 'pagado' and reversal_of is null;
  if r is not null then return r || jsonb_build_object('club', b); end if;

  select jsonb_build_object('encontrado', true, 'tipo', 'EGRESO',
    'folio', case when folio is not null then 'V-' || lpad(folio::text, 6, '0') end,
    'fecha', expense_date, 'monto', amount,
    'concepto', coalesce(concept, 'Gasto'), 'metodo', payment_method,
    'estado', case when exists (select 1 from expenses rev where rev.reversal_of = p_id) then 'REVERSADO' else 'VIGENTE' end)
  into r from expenses where id = p_id and reversal_of is null;
  if r is not null then return r || jsonb_build_object('club', b); end if;

  return jsonb_build_object('encontrado', false, 'club', b);
end $function$;

-- Permisos de este bloque: REVOKE FROM PUBLIC en todo; clientes autenticados
-- ejecutan los RPC; los trigger-functions quedan sin grant; verificar_movimiento
-- conserva su grant a anon (excepción documentada al final del archivo).
revoke execute on function reversar_pago(uuid, text) from public;
revoke execute on function reversar_pago_general(uuid, text) from public;
revoke execute on function reversar_pago_summer(uuid, text) from public;
revoke execute on function reversar_pago_torneo(uuid, text) from public;
revoke execute on function reversar_egreso(uuid, text) from public;
revoke execute on function abonar_cxp(uuid, numeric, text, text, text, date, text, text, uuid) from public;
revoke execute on function fn_cxp_crear_egreso() from public;
revoke execute on function enforce_join_date_policy() from public;
grant execute on function reversar_pago(uuid, text) to authenticated;
grant execute on function reversar_pago_general(uuid, text) to authenticated;
grant execute on function reversar_pago_summer(uuid, text) to authenticated;
grant execute on function reversar_pago_torneo(uuid, text) to authenticated;
grant execute on function reversar_egreso(uuid, text) to authenticated;
grant execute on function abonar_cxp(uuid, numeric, text, text, text, date, text, text, uuid) to authenticated;
grant execute on function verificar_movimiento(uuid) to anon, authenticated;

-- Seguridad (aplicar SIEMPRE al final del provisionamiento):
-- revoke execute a anon/public de TODOS los RPCs financieros y grant a authenticated.
-- EXCEPCIÓN ÚNICA Y DELIBERADA: verificar_movimiento(p_id uuid) conserva grant a
-- anon — es la verificación pública de vales por QR (/Verificar?id=<uuid>) y por
-- contrato devuelve SOLO {encontrado,tipo,folio,fecha,monto,concepto,metodo,
-- estado,club} — jamás datos personales. Cualquier cambio a esa función se
-- revisa contra ese contrato antes de publicar.
