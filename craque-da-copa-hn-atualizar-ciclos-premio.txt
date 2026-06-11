-- ============================================================
-- Craque da Copa HN - Atualização de ciclos e prêmio
-- Rode no SQL Editor do Supabase.
-- Observação: considerei 18/06 no Ciclo 1, porque o Ciclo 2 começa em 19/06.
-- ============================================================

-- CICLO 1
insert into quiz_cycles (
  title,
  slug,
  stage,
  stage_label,
  stage_order,
  is_brazil_dependent,
  start_at,
  end_at,
  draw_at,
  status,
  questions_per_attempt,
  minimum_correct_answers,
  public_notes
)
values (
  'Ciclo 1 — Estreia do Brasil',
  'ciclo-1-estreia-do-brasil',
  'group_stage',
  'Fase de grupos',
  1,
  true,
  '2026-06-13 00:00:00-03',
  '2026-06-18 23:59:59-03',
  '2026-06-19 09:00:00-03',
  'active',
  20,
  11,
  'Primeiro ciclo do Craque da Copa HN, acompanhando a estreia do Brasil.'
)
on conflict (slug) do update set
  title = excluded.title,
  stage = excluded.stage,
  stage_label = excluded.stage_label,
  stage_order = excluded.stage_order,
  is_brazil_dependent = excluded.is_brazil_dependent,
  start_at = excluded.start_at,
  end_at = excluded.end_at,
  draw_at = excluded.draw_at,
  status = excluded.status,
  questions_per_attempt = excluded.questions_per_attempt,
  minimum_correct_answers = excluded.minimum_correct_answers,
  public_notes = excluded.public_notes,
  updated_at = now();

insert into quiz_cycle_prizes (
  cycle_id,
  prize_name,
  prize_description,
  partner_name,
  partner_instagram_url,
  partner_button_text
)
select
  id,
  '30 litros de combustível',
  'Neste primeiro ciclo, os classificados concorrem a 30 litros de combustível.',
  'Rádio Vertical FM',
  'https://www.instagram.com/radioverticalfm',
  'Seguir Rádio Vertical FM'
from quiz_cycles
where slug = 'ciclo-1-estreia-do-brasil'
on conflict (cycle_id) do update set
  prize_name = excluded.prize_name,
  prize_description = excluded.prize_description,
  partner_name = excluded.partner_name,
  partner_instagram_url = excluded.partner_instagram_url,
  partner_button_text = excluded.partner_button_text,
  updated_at = now();

-- CICLO 2
insert into quiz_cycles (
  title,
  slug,
  stage,
  stage_label,
  stage_order,
  is_brazil_dependent,
  start_at,
  end_at,
  draw_at,
  status,
  questions_per_attempt,
  minimum_correct_answers,
  public_notes
)
values (
  'Ciclo 2 — Segundo jogo do Brasil',
  'ciclo-2-segundo-jogo-do-brasil',
  'group_stage',
  'Fase de grupos',
  2,
  true,
  '2026-06-19 00:00:00-03',
  '2026-06-23 23:59:59-03',
  '2026-06-24 09:00:00-03',
  'draft',
  20,
  11,
  'Segundo ciclo do Craque da Copa HN, acompanhando o segundo jogo do Brasil.'
)
on conflict (slug) do update set
  title = excluded.title,
  stage = excluded.stage,
  stage_label = excluded.stage_label,
  stage_order = excluded.stage_order,
  is_brazil_dependent = excluded.is_brazil_dependent,
  start_at = excluded.start_at,
  end_at = excluded.end_at,
  draw_at = excluded.draw_at,
  status = excluded.status,
  questions_per_attempt = excluded.questions_per_attempt,
  minimum_correct_answers = excluded.minimum_correct_answers,
  public_notes = excluded.public_notes,
  updated_at = now();

insert into quiz_cycle_prizes (
  cycle_id,
  prize_name,
  prize_description,
  partner_name,
  partner_instagram_url,
  partner_button_text
)
select
  id,
  'Prêmio do ciclo a definir',
  'O prêmio deste ciclo será divulgado em breve.',
  'Parceiro da semana',
  null,
  'Seguir parceiro da semana'
from quiz_cycles
where slug = 'ciclo-2-segundo-jogo-do-brasil'
on conflict (cycle_id) do update set
  prize_name = excluded.prize_name,
  prize_description = excluded.prize_description,
  partner_name = excluded.partner_name,
  partner_instagram_url = excluded.partner_instagram_url,
  partner_button_text = excluded.partner_button_text,
  updated_at = now();

-- CICLO 3
insert into quiz_cycles (
  title,
  slug,
  stage,
  stage_label,
  stage_order,
  is_brazil_dependent,
  start_at,
  end_at,
  draw_at,
  status,
  questions_per_attempt,
  minimum_correct_answers,
  public_notes
)
values (
  'Ciclo 3 — Terceiro jogo do Brasil',
  'ciclo-3-terceiro-jogo-do-brasil',
  'group_stage',
  'Fase de grupos',
  3,
  true,
  '2026-06-24 00:00:00-03',
  null,
  null,
  'draft',
  20,
  11,
  'Terceiro ciclo do Craque da Copa HN, acompanhando o terceiro jogo do Brasil e aguardando a próxima fase.'
)
on conflict (slug) do update set
  title = excluded.title,
  stage = excluded.stage,
  stage_label = excluded.stage_label,
  stage_order = excluded.stage_order,
  is_brazil_dependent = excluded.is_brazil_dependent,
  start_at = excluded.start_at,
  end_at = excluded.end_at,
  draw_at = excluded.draw_at,
  status = excluded.status,
  questions_per_attempt = excluded.questions_per_attempt,
  minimum_correct_answers = excluded.minimum_correct_answers,
  public_notes = excluded.public_notes,
  updated_at = now();

insert into quiz_cycle_prizes (
  cycle_id,
  prize_name,
  prize_description,
  partner_name,
  partner_instagram_url,
  partner_button_text
)
select
  id,
  'Prêmio do ciclo a definir',
  'O prêmio deste ciclo será divulgado em breve.',
  'Parceiro da semana',
  null,
  'Seguir parceiro da semana'
from quiz_cycles
where slug = 'ciclo-3-terceiro-jogo-do-brasil'
on conflict (cycle_id) do update set
  prize_name = excluded.prize_name,
  prize_description = excluded.prize_description,
  partner_name = excluded.partner_name,
  partner_instagram_url = excluded.partner_instagram_url,
  partner_button_text = excluded.partner_button_text,
  updated_at = now();

-- ============================================================
-- FIM
-- ============================================================
