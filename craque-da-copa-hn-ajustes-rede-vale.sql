-- ============================================================
-- Craque da Copa HN - Ajustes Rede Vale
-- 5 ciclos, 10 perguntas, 6 acertos, prêmio limitado a 40L.
-- Rode no SQL Editor do Supabase.
-- ============================================================

-- 1) Garante que apenas um ciclo fique ativo.
update quiz_cycles
set status = 'draft'
where status = 'active'
  and slug <> 'rede-vale-ciclo-1';

create or replace function ensure_single_active_cycle()
returns trigger as $$
begin
  if new.status = 'active' then
    update quiz_cycles
    set status = 'draft',
        updated_at = now()
    where id <> new.id
      and status = 'active';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_ensure_single_active_cycle on quiz_cycles;

create trigger trg_ensure_single_active_cycle
before insert or update of status on quiz_cycles
for each row
execute function ensure_single_active_cycle();

drop index if exists uq_only_one_active_cycle;

create unique index uq_only_one_active_cycle
on quiz_cycles ((status))
where status = 'active';

-- 2) Configura os 5 ciclos.
with cycle_data (
  title,
  slug,
  stage_order,
  start_at,
  end_at,
  draw_at,
  status,
  public_notes
) as (
  values
    (
      'Ciclo 1 — Rede Vale',
      'rede-vale-ciclo-1',
      1,
      '2026-06-15 00:00:00-03'::timestamptz,
      '2026-06-18 23:59:59-03'::timestamptz,
      '2026-06-19 11:00:00-03'::timestamptz,
      'active'::cycle_status,
      'Para validar a classificação neste ciclo, o participante deverá seguir a Rede Vale e o HN Notícias no Instagram.'
    ),
    (
      'Ciclo 2 — Rede Vale',
      'rede-vale-ciclo-2',
      2,
      '2026-06-20 00:00:00-03'::timestamptz,
      '2026-06-25 23:59:59-03'::timestamptz,
      '2026-06-26 11:00:00-03'::timestamptz,
      'scheduled'::cycle_status,
      'Para validar a classificação neste ciclo, o participante deverá estar em um dos grupos de notícias do HN no WhatsApp e ter baixado o aplicativo de descontos da Rede Vale.'
    ),
    (
      'Ciclo 3 — Rede Vale',
      'rede-vale-ciclo-3',
      3,
      '2026-06-27 00:00:00-03'::timestamptz,
      '2026-07-02 23:59:59-03'::timestamptz,
      '2026-07-03 11:00:00-03'::timestamptz,
      'scheduled'::cycle_status,
      'Para validar a classificação neste ciclo, o participante deverá seguir a Rede Vale e o HN Notícias no Instagram.'
    ),
    (
      'Ciclo 4 — Rede Vale',
      'rede-vale-ciclo-4',
      4,
      '2026-07-06 00:00:00-03'::timestamptz,
      '2026-07-11 23:59:59-03'::timestamptz,
      '2026-07-17 11:00:00-03'::timestamptz,
      'scheduled'::cycle_status,
      'Para validar a classificação neste ciclo, o participante deverá estar em um dos grupos de notícias do HN no WhatsApp e ter baixado o aplicativo de descontos da Rede Vale.'
    ),
    (
      'Ciclo 5 — Rede Vale',
      'rede-vale-ciclo-5',
      5,
      '2026-07-13 00:00:00-03'::timestamptz,
      '2026-07-18 23:59:59-03'::timestamptz,
      '2026-07-24 11:00:00-03'::timestamptz,
      'scheduled'::cycle_status,
      'Para validar a classificação neste ciclo, o participante deverá seguir a Rede Vale e o HN Notícias no Instagram ou cumprir a regra indicada pela organização antes do sorteio.'
    )
),
upserted_cycles as (
  insert into quiz_cycles (
    title,
    slug,
    stage,
    stage_label,
    stage_order,
    start_at,
    end_at,
    draw_at,
    status,
    questions_per_attempt,
    minimum_correct_answers,
    is_brazil_dependent,
    public_notes
  )
  select
    title,
    slug,
    'special'::cycle_stage,
    'Promoção Rede Vale',
    stage_order,
    start_at,
    end_at,
    draw_at,
    status,
    10,
    6,
    false,
    public_notes
  from cycle_data
  on conflict (slug) do update set
    title = excluded.title,
    stage = excluded.stage,
    stage_label = excluded.stage_label,
    stage_order = excluded.stage_order,
    start_at = excluded.start_at,
    end_at = excluded.end_at,
    draw_at = excluded.draw_at,
    status = excluded.status,
    questions_per_attempt = excluded.questions_per_attempt,
    minimum_correct_answers = excluded.minimum_correct_answers,
    is_brazil_dependent = excluded.is_brazil_dependent,
    public_notes = excluded.public_notes,
    updated_at = now()
  returning id, slug
)
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
  'Um tanque de combustível',
  'Cada ciclo sorteia um tanque de combustível, limitado a 40 litros de gasolina comum. A autorização de abastecimento indicará em qual dos três postos da Rede Vale em Criciúma deverá acontecer o abastecimento.',
  'Rede Vale',
  'https://www.instagram.com/redevalepostos/',
  'Seguir Rede Vale'
from upserted_cycles
on conflict (cycle_id) do update set
  prize_name = excluded.prize_name,
  prize_description = excluded.prize_description,
  partner_name = excluded.partner_name,
  partner_instagram_url = excluded.partner_instagram_url,
  partner_button_text = excluded.partner_button_text;

-- 3) Deixa os ciclos antigos como rascunho, para evitar confusão.
update quiz_cycles
set status = 'draft'
where slug not in (
  'rede-vale-ciclo-1',
  'rede-vale-ciclo-2',
  'rede-vale-ciclo-3',
  'rede-vale-ciclo-4',
  'rede-vale-ciclo-5'
)
and status = 'active';

-- 4) Atualiza ciclos existentes para 10 perguntas e 6 acertos.
update quiz_cycles
set
  questions_per_attempt = 10,
  minimum_correct_answers = 6
where slug in (
  'rede-vale-ciclo-1',
  'rede-vale-ciclo-2',
  'rede-vale-ciclo-3',
  'rede-vale-ciclo-4',
  'rede-vale-ciclo-5'
);

-- 5) Vincula as perguntas ativas existentes aos cinco ciclos da promoção.
with vale_cycles as (
  select id from quiz_cycles
  where slug in (
    'rede-vale-ciclo-1',
    'rede-vale-ciclo-2',
    'rede-vale-ciclo-3',
    'rede-vale-ciclo-4',
    'rede-vale-ciclo-5'
  )
),
active_questions as (
  select id from quiz_questions
  where status = 'active'
)
insert into quiz_cycle_questions (
  cycle_id,
  question_id,
  status
)
select
  vale_cycles.id,
  active_questions.id,
  'active'::question_status
from vale_cycles
cross join active_questions
on conflict (cycle_id, question_id) do update set
  status = 'active',
  updated_at = now();

-- 6) Conferência final.
select
  c.title,
  c.slug,
  c.status,
  c.questions_per_attempt,
  c.minimum_correct_answers,
  c.start_at,
  c.end_at,
  c.draw_at,
  count(cq.question_id) filter (where cq.status = 'active') as perguntas_vinculadas
from quiz_cycles c
left join quiz_cycle_questions cq on cq.cycle_id = c.id
where c.slug in (
  'rede-vale-ciclo-1',
  'rede-vale-ciclo-2',
  'rede-vale-ciclo-3',
  'rede-vale-ciclo-4',
  'rede-vale-ciclo-5'
)
group by c.id
order by c.stage_order;
