# Facilita Plus — Painel SaaS

Painel multi-tenant da **Facilita Plus** — IA aplicada para facilitar processos da sua empresa.

## Stack

- **Next.js 16** (App Router + Turbopack)
- **TypeScript** strict
- **Tailwind CSS 4** com tema customizado (cores oficiais Facilita Plus)
- **Supabase** (Postgres + Auth + Realtime + RLS)
- **shadcn/ui** princípios (componentes próprios usando Tailwind)
- **Work Sans + Manrope** (fontes oficiais do manual da marca)

## Como rodar

```bash
# Instalar dependências (já feito)
npm install

# Servidor de dev
npm run dev

# Acessa em http://localhost:3000
```

## Variáveis de ambiente

Criar `.env.local` (já criado):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://zqmmiussjnkwxapirmcp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxx
```

## Estrutura

```
src/
├── app/
│   ├── (root) page.tsx              # Redirect / → /login ou /dashboard
│   ├── layout.tsx                   # Root layout com fontes oficiais
│   ├── globals.css                  # Tema Tailwind 4 + cores Facilita Plus
│   │
│   ├── login/                       # Autenticação
│   │   ├── page.tsx
│   │   ├── login-form.tsx
│   │   └── actions.ts               # Server Action de login/logout
│   │
│   ├── dashboard/                   # Área do cliente (protegida)
│   │   ├── layout.tsx               # Valida auth, header com nome do cliente
│   │   ├── page.tsx                 # Métricas do cliente
│   │   ├── leads/
│   │   │   ├── page.tsx             # Lista com filtros
│   │   │   └── [id]/page.tsx        # Detalhe do lead
│   │   └── agenda/
│   │       └── page.tsx             # Próximas + histórico
│   │
│   ├── admin/                       # Área do admin (Lucas)
│   │   ├── layout.tsx               # Valida role='admin'
│   │   ├── page.tsx                 # Lista clientes
│   │   ├── metricas/page.tsx        # Métricas globais
│   │   └── clientes/
│   │       ├── novo/                # Cadastrar cliente
│   │       │   ├── page.tsx
│   │       │   ├── form.tsx
│   │       │   └── actions.ts
│   │       └── [id]/
│   │           ├── page.tsx         # Detalhes
│   │           └── editar/          # Editar prompt, voice, status
│   │               ├── page.tsx
│   │               ├── form.tsx
│   │               └── actions.ts
│   │
│   └── proxy.ts                     # Next 16 "proxy" (era middleware)
│
├── components/
│   ├── logo.tsx                     # Logo Facilita Plus (texto + plus)
│   ├── status-badge.tsx             # Badge colorido por status do lead
│   ├── empty-state.tsx              # Placeholder de lista vazia
│   └── page-header.tsx              # Header de página com título + ação
│
└── lib/
    ├── supabase/
    │   ├── client.ts                # Cliente browser (createBrowserClient)
    │   ├── server.ts                # Cliente server (createServerClient)
    │   └── middleware.ts            # Atualiza sessão (chamado pelo proxy)
    └── status-config.ts             # Config centralizada de status

supabase/
└── migrations/
    └── 0001_initial_schema.sql      # Schema multi-tenant + RLS + triggers
└── seed_dados_teste.sql             # Dados fictícios pra testar UI
```

## Multi-tenant — como funciona

1. Cada **organization** = 1 cliente (empresa que usa a Facilita Plus)
2. Cada **profile** tem `organization_id` + `role` (`admin` ou `client`)
3. **Row Level Security** no Supabase garante isolamento de dados
4. **Admin** (Lucas) vê tudo. **Cliente** vê só dados da própria org.

## Identidade visual

Cores e fontes vêm do **Manual da Marca Facilita Plus** ([`facilita/identidade-visual.md`](../../facilita/identidade-visual.md)).

Cores no Tailwind 4:
- `bg-laranja` (#E8501C)
- `bg-preto` (#0A0A0A)
- `bg-offwhite` (#F5F1EB)
- `text-cinza-medio` (#6F6F6F)
- Tipografia: `font-heading` (Work Sans), `font-body` (Manrope)

## Próximos passos

Ver `saas/PROGRESSO.md` pra checklist completo do que falta.

Próximo bloco crítico: **provisionamento automático ao cadastrar cliente** (Auth + Evolution + Chatwoot + Asaas).
