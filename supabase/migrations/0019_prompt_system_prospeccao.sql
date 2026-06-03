-- Prompt system separado pra leads de prospeccao.
-- Inbound: tira duvidas e induz reuniao (objetivo: marcar consultoria).
-- Prospeccao: faz perguntas pra entender empresa do lead e explica nosso
-- trabalho (objetivo: gerar interesse de quem nao procurou a gente).
-- Base de conhecimento pode ser repetida ou referenciada — campos sao texto livre.
alter table organizations
  add column if not exists prompt_system_prospeccao text;
