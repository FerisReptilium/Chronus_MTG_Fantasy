# CHRONUS MTG Fantasy

Portal web da ficha CHRONUS — Magic: The Gathering Fantasy RPG.

A ficha visual permanece em `index.html`; a lógica do portal está em `src/app.js` e o complemento visual em `src/style.css`.

## Recursos
- Autenticação Supabase por e-mail/senha.
- Link mágico por e-mail.
- Criação de campanhas pelo mestre.
- Código de convite de 8 caracteres.
- Limite de 10 jogadores por campanha.
- Uma ficha por jogador em cada campanha.
- Autosave com debounce de 700 ms.
- Backup imediato em LocalStorage.
- Salvamento no Supabase por `(campaign_id, user_id)`.
- Atualização em tempo real da própria ficha.
- Rolagem de testes CHRONUS com abordagem, personalidade, habilidade e Determinação.
- Registro de rolagens em `dice_logs`.
- Importação/exportação JSON.
- Arte do personagem em bucket privado `character-art`.
- Temas de mana: Branco, Azul, Preto, Vermelho, Verde e Artefato/Incolor.
- Aba de Background & Diário.

## Configuração Supabase
1. Crie/abra o projeto Supabase correto.
2. Execute `supabase.sql` no SQL Editor.
3. Em Authentication, habilite Email.
4. Copie `.env.example` para `.env.local`.
5. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (ou publishable key).
6. Nunca coloque `service_role` ou Secret Key no navegador.
7. Em Authentication > URL Configuration, configure a URL local e a URL da Vercel.

## Desenvolvimento
```bash
npm install
npm run dev
```

Build de produção:
```bash
npm run build
npm run preview
```

## Vercel
Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no projeto Vercel e faça o deploy.

## Modelo de dados
- `campaigns`: campanhas e códigos de convite.
- `campaign_members`: membros e papel de mestre/jogador.
- `characters`: ficha completa em JSONB.
- `dice_logs`: histórico de rolagens.
- `character-art`: bucket privado para retratos.

A ficha é salva localmente antes do envio à nuvem para reduzir risco de perda de dados.