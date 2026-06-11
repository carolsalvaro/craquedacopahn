-- Perguntas de teste para validar o sistema.
-- Rode este arquivo no SQL Editor apenas se quiser criar perguntas exemplo.
-- Depois você pode apagar/editar pelo admin.

with q as (
  insert into quiz_questions (question_text, option_a, option_b, option_c, option_d, correct_option, category, difficulty)
  values
    ('Qual seleção venceu a Copa do Mundo de 2002?', 'Brasil', 'Alemanha', 'França', 'Itália', 'A', 'Brasil em Copas', 'easy'),
    ('Quantos títulos mundiais o Brasil possui no futebol masculino?', '3', '4', '5', '6', 'C', 'Brasil em Copas', 'easy'),
    ('Em qual país foi disputada a Copa do Mundo de 2014?', 'África do Sul', 'Brasil', 'Rússia', 'Alemanha', 'B', 'História das Copas', 'easy'),
    ('Quem marcou dois gols na final da Copa de 2002?', 'Rivaldo', 'Ronaldinho', 'Ronaldo', 'Kaká', 'C', 'Brasil em Copas', 'easy'),
    ('Qual seleção venceu a Copa do Mundo de 2018?', 'França', 'Croácia', 'Alemanha', 'Argentina', 'A', 'História das Copas', 'easy'),
    ('Qual país sediou a Copa do Mundo de 2022?', 'Catar', 'Rússia', 'Estados Unidos', 'Japão', 'A', 'História das Copas', 'easy'),
    ('Qual jogador argentino foi campeão mundial em 2022?', 'Maradona', 'Messi', 'Di María', 'Agüero', 'B', 'Jogadores históricos', 'easy'),
    ('A Copa do Mundo acontece normalmente a cada quantos anos?', '2', '3', '4', '5', 'C', 'Curiosidades', 'easy'),

    ('Qual foi a final da Copa do Mundo de 1994?', 'Brasil x Itália', 'Brasil x Alemanha', 'Argentina x Alemanha', 'França x Brasil', 'A', 'História das Copas', 'medium'),
    ('Qual seleção é conhecida como Azzurra?', 'França', 'Itália', 'Espanha', 'Uruguai', 'B', 'Seleções', 'medium'),
    ('Em 2010, qual seleção foi campeã mundial?', 'Holanda', 'Espanha', 'Alemanha', 'Argentina', 'B', 'História das Copas', 'medium'),
    ('Quem foi o técnico do Brasil no título de 2002?', 'Dunga', 'Felipão', 'Tite', 'Parreira', 'B', 'Brasil em Copas', 'medium'),
    ('Qual país venceu a primeira Copa do Mundo, em 1930?', 'Brasil', 'Argentina', 'Uruguai', 'Itália', 'C', 'História das Copas', 'medium'),
    ('Qual seleção eliminou o Brasil na Copa de 2018?', 'Bélgica', 'França', 'Croácia', 'Holanda', 'A', 'Brasil em Copas', 'medium'),
    ('Qual goleiro brasileiro defendeu pênalti na final de 1994?', 'Taffarel', 'Marcos', 'Dida', 'Júlio César', 'A', 'Brasil em Copas', 'medium'),
    ('Qual seleção ficou conhecida pelo “Carrossel Holandês”?', 'Holanda', 'Alemanha', 'Espanha', 'Portugal', 'A', 'História das Copas', 'medium'),

    ('Qual jogador é conhecido como o maior artilheiro da história das Copas?', 'Pelé', 'Miroslav Klose', 'Ronaldo', 'Gerd Müller', 'B', 'Jogadores históricos', 'hard'),
    ('Em que ano o Brasil conquistou seu primeiro título mundial?', '1950', '1954', '1958', '1962', 'C', 'Brasil em Copas', 'hard'),
    ('Qual seleção venceu a Copa de 1966?', 'Inglaterra', 'Alemanha', 'Brasil', 'Argentina', 'A', 'História das Copas', 'hard'),
    ('Qual foi a seleção vice-campeã da Copa de 1982?', 'Itália', 'Alemanha Ocidental', 'Brasil', 'Argentina', 'B', 'História das Copas', 'hard'),
    ('Contra qual seleção o Brasil venceu a final da Copa de 1970?', 'Itália', 'Alemanha', 'Uruguai', 'Inglaterra', 'A', 'Brasil em Copas', 'hard'),
    ('Qual país sediou as Copas de 1970 e 1986?', 'México', 'Estados Unidos', 'Chile', 'Espanha', 'A', 'História das Copas', 'hard'),
    ('Quem foi o capitão do Brasil no título mundial de 1994?', 'Romário', 'Dunga', 'Bebeto', 'Taffarel', 'B', 'Brasil em Copas', 'hard'),
    ('Qual seleção venceu a Copa de 2006?', 'França', 'Itália', 'Alemanha', 'Espanha', 'B', 'História das Copas', 'hard')
  returning id
)
insert into quiz_cycle_questions (cycle_id, question_id)
select c.id, q.id
from quiz_cycles c
cross join q
where c.slug = 'ciclo-1-estreia-do-brasil'
on conflict do nothing;
