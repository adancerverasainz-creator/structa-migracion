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

-- Seguridad (aplicar SIEMPRE al final del provisionamiento):
-- revoke execute a anon/public de TODOS los RPCs financieros y grant a authenticated.
-- EXCEPCIÓN ÚNICA Y DELIBERADA: verificar_movimiento(p_id uuid) conserva grant a
-- anon — es la verificación pública de vales por QR (/Verificar?id=<uuid>) y por
-- contrato devuelve SOLO {encontrado,tipo,folio,fecha,monto,concepto,metodo,
-- estado,club} — jamás datos personales. Cualquier cambio a esa función se
-- revisa contra ese contrato antes de publicar.
