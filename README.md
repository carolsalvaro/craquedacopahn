# Craque da Copa HN

Sistema independente do quiz **Craque da Copa HN**, com frontend estático, Netlify Functions e Supabase.

## 1. O que já precisa existir

No Supabase, rode primeiro o arquivo SQL do banco que criamos.

## 2. Variáveis de ambiente no Netlify

Em **Site configuration > Environment variables**, crie:

```txt
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
ADMIN_PASSWORD=uma_senha_forte_para_o_admin
```

A `SUPABASE_SERVICE_ROLE_KEY` deve ficar apenas no Netlify. Não coloque essa chave em arquivo público.

## 3. Publicação

1. Suba esta pasta para um repositório no GitHub.
2. No Netlify, escolha **Add new site > Import an existing project**.
3. Conecte ao repositório.
4. Configure as variáveis de ambiente.
5. Faça o deploy.

## 4. URLs

- `/` — página pública do quiz
- `/admin.html` — área administrativa
- `/api/active-cycle` — função do ciclo ativo

## 5. Observação

Este é um MVP funcional inicial. Ele já separa frontend e backend, evita expor respostas corretas no navegador e usa o CPF como chave de participação.
