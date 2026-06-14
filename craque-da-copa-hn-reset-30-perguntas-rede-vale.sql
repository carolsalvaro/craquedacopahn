-- ============================================================
-- Craque da Copa HN Notícias e Rede Vale de Postos
-- Reset de perguntas/participações + novo banco com 30 perguntas
--
-- Composição:
-- 18 fáceis, 9 médias, 3 difíceis.
-- O sorteio das tentativas passa a priorizar 6 fáceis, 3 médias e 1 difícil.
--
-- Rode no Supabase → SQL Editor.
-- Mantém ciclos, prêmios e configurações. Apaga participações/testes,
-- perguntas antigas e vínculos antigos de perguntas.
-- ============================================================

begin;

-- 1) Zera participações, tentativas, respostas e vencedores.
delete from quiz_winners;
delete from quiz_question_participant_usage;
delete from quiz_attempt_questions;
delete from quiz_attempts;
delete from quiz_participants;

-- 2) Remove vínculos e perguntas antigas.
delete from quiz_cycle_questions;
delete from quiz_questions;

-- 3) Garante ciclos Rede Vale com 10 perguntas e 6 acertos.
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

-- 4) Insere novo banco de 30 perguntas.
with question_data (
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_option,
  category,
  difficulty
) as (
  values
    ('Quantas Copas do Mundo masculinas o Brasil já venceu?', '3', '4', '5', '6', 'C', 'Brasil em Copas', 'easy'),
    ('Qual é o apelido mais conhecido da Seleção Brasileira?', 'La Roja', 'Canarinho', 'Azzurra', 'Celeste', 'B', 'Brasil em Copas', 'easy'),
    ('Em que ano o Brasil conquistou sua primeira Copa do Mundo?', '1950', '1958', '1962', '1970', 'B', 'Brasil em Copas', 'easy'),
    ('Quem é conhecido como o Rei do Futebol?', 'Romário', 'Pelé', 'Ronaldo', 'Neymar', 'B', 'Jogadores do Brasil', 'easy'),
    ('Qual seleção o Brasil venceu na final da Copa de 2002?', 'Argentina', 'Alemanha', 'França', 'Itália', 'B', 'Brasil em Copas', 'easy'),
    ('Quem marcou os dois gols do Brasil na final da Copa de 2002?', 'Rivaldo', 'Ronaldinho', 'Ronaldo', 'Kaká', 'C', 'Brasil em Copas', 'easy'),
    ('Em qual país foi disputada a Copa do Mundo de 2014?', 'Brasil', 'Rússia', 'Catar', 'África do Sul', 'A', 'Copas recentes', 'easy'),
    ('Qual seleção venceu a Copa do Mundo de 2022?', 'Brasil', 'França', 'Argentina', 'Croácia', 'C', 'Copas recentes', 'easy'),
    ('Qual país sediou a Copa do Mundo de 2022?', 'Catar', 'Rússia', 'Japão', 'Alemanha', 'A', 'Copas recentes', 'easy'),
    ('Qual é a cor principal da camisa tradicional da Seleção Brasileira?', 'Azul', 'Vermelha', 'Amarela', 'Branca', 'C', 'Brasil em Copas', 'easy'),
    ('A Copa do Mundo masculina costuma acontecer de quantos em quantos anos?', '2 anos', '3 anos', '4 anos', '5 anos', 'C', 'Curiosidades', 'easy'),
    ('Qual goleiro brasileiro foi titular no título mundial de 1994?', 'Dida', 'Marcos', 'Taffarel', 'Júlio César', 'C', 'Brasil em Copas', 'easy'),
    ('Qual foi o placar da final da Copa de 2002 entre Brasil e Alemanha?', '1 a 0', '2 a 0', '3 a 1', '4 a 2', 'B', 'Brasil em Copas', 'easy'),
    ('Qual seleção eliminou o Brasil na Copa de 2018?', 'Bélgica', 'França', 'Croácia', 'Holanda', 'A', 'Brasil em Copas', 'easy'),
    ('Em que fase o Brasil foi eliminado na Copa de 2022?', 'Fase de grupos', 'Oitavas de final', 'Quartas de final', 'Semifinal', 'C', 'Brasil em Copas', 'easy'),
    ('Qual seleção venceu a Copa do Mundo de 2018?', 'França', 'Croácia', 'Alemanha', 'Argentina', 'A', 'Copas recentes', 'easy'),
    ('Qual seleção é conhecida como Azzurra?', 'Itália', 'Espanha', 'França', 'Portugal', 'A', 'Seleções', 'easy'),
    ('Na Copa do Mundo, o que significa avançar ao mata-mata?', 'Ser eliminado', 'Passar para a fase eliminatória', 'Ganhar o título', 'Jogar amistosos', 'B', 'Regras e fases', 'easy'),
    ('Quem foi o técnico do Brasil no título da Copa de 2002?', 'Parreira', 'Felipão', 'Dunga', 'Tite', 'B', 'Brasil em Copas', 'medium'),
    ('Quem foi o capitão do Brasil na conquista da Copa de 1994?', 'Romário', 'Bebeto', 'Dunga', 'Taffarel', 'C', 'Brasil em Copas', 'medium'),
    ('Contra qual seleção o Brasil venceu a final da Copa de 1970?', 'Alemanha', 'Itália', 'Uruguai', 'Inglaterra', 'B', 'Brasil em Copas', 'medium'),
    ('Qual foi a final da Copa do Mundo de 1994?', 'Brasil x Itália', 'Brasil x Alemanha', 'Argentina x Alemanha', 'França x Brasil', 'A', 'Brasil em Copas', 'medium'),
    ('Qual seleção venceu a Copa do Mundo de 2010?', 'Holanda', 'Alemanha', 'Espanha', 'Brasil', 'C', 'Copas recentes', 'medium'),
    ('Qual seleção venceu o Brasil por 7 a 1 na Copa de 2014?', 'Argentina', 'Alemanha', 'Holanda', 'França', 'B', 'Brasil em Copas', 'medium'),
    ('Qual seleção foi vice-campeã da Copa do Mundo de 2022?', 'Croácia', 'França', 'Marrocos', 'Alemanha', 'B', 'Copas recentes', 'medium'),
    ('Qual foi o primeiro país africano a chegar a uma semifinal de Copa do Mundo masculina?', 'Camarões', 'Gana', 'Marrocos', 'Senegal', 'C', 'História das Copas', 'medium'),
    ('Qual seleção venceu a Copa do Mundo de 1986?', 'Brasil', 'Alemanha', 'Argentina', 'França', 'C', 'História das Copas', 'medium'),
    ('Quem é o maior artilheiro da história das Copas do Mundo masculinas?', 'Pelé', 'Ronaldo', 'Miroslav Klose', 'Gerd Müller', 'C', 'História das Copas', 'hard'),
    ('Qual foi o adversário do Brasil na final da Copa de 1958?', 'Alemanha', 'Suécia', 'França', 'Uruguai', 'B', 'Brasil em Copas', 'hard'),
    ('Qual jogador marcou o gol do título da Alemanha na final da Copa de 2014?', 'Klose', 'Müller', 'Götze', 'Özil', 'C', 'História das Copas', 'hard')
),
inserted_questions as (
  insert into quiz_questions (
    question_text,
    option_a,
    option_b,
    option_c,
    option_d,
    correct_option,
    category,
    difficulty,
    status,
    reusable
  )
  select
    question_text,
    option_a,
    option_b,
    option_c,
    option_d,
    correct_option,
    category,
    difficulty::question_difficulty,
    'active'::question_status,
    true
  from question_data
  returning id
),
vale_cycles as (
  select id
  from quiz_cycles
  where slug in (
    'rede-vale-ciclo-1',
    'rede-vale-ciclo-2',
    'rede-vale-ciclo-3',
    'rede-vale-ciclo-4',
    'rede-vale-ciclo-5'
  )
)
insert into quiz_cycle_questions (
  cycle_id,
  question_id,
  status
)
select
  vale_cycles.id,
  inserted_questions.id,
  'active'::question_status
from vale_cycles
cross join inserted_questions;

commit;

-- 5) Conferência geral.
select
  difficulty,
  count(*) as quantidade
from quiz_questions
group by difficulty
order by
  case difficulty
    when 'easy' then 1
    when 'medium' then 2
    when 'hard' then 3
    else 4
  end;

-- 6) Conferência por ciclo: cada ciclo deve mostrar 30 perguntas vinculadas.
select
  c.title,
  c.slug,
  c.status,
  c.questions_per_attempt,
  c.minimum_correct_answers,
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
