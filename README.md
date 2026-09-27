# CHRONUS Portal v3

Portal online para a ficha CHRONUS. O editor preserva a ficha original e adiciona autenticação, campanha, salvamento em nuvem, autosave, recuperação local e armazenamento privado de arte.

## Ordem de instalação
1. No Supabase, abra SQL Editor e execute `supabase.sql` em um projeto limpo.
2. Em Authentication > Providers, habilite Email. Para testes, você pode desabilitar a confirmação de e-mail; em produção, prefira confirmação.
3. Crie `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (ou publishable key). Nunca use `service_role` no navegador.
4. `npm install`
5. `npm run dev`
6. Entre/crie uma conta. O mestre cria a campanha e fornece o código de 8 caracteres.
7. Cada jogador cria sua própria conta e usa o código para entrar. A campanha limita a 10 jogadores.
8. O mestre abre Jogadores para acessar as fichas existentes.
9. A arte do personagem fica no bucket privado `character-art` e é exibida por URL assinada.
10. Na Vercel, configure as mesmas variáveis e faça o deploy. Em Supabase Auth > URL Configuration, adicione a URL do site e o redirect da Vercel.

## Salvamento
A ficha é salva localmente imediatamente como contingência e enviada ao Supabase com debounce de 700 ms. O topo mostra `Salvando…`, `Salvo HH:MM:SS` ou `Erro ao salvar`. O registro é um `upsert` por `(campaign_id,user_id)`, impedindo duplicatas.
