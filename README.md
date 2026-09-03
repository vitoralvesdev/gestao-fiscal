# Gestão Fiscal

Aplicação pessoal para organizar os documentos fiscais mensais de uma empresa (boleto, nota
fiscal, planilha de horas, etc.) sem precisar arrastar arquivos manualmente para pastas do Google
Drive todo mês.

A ideia: você faz login com sua conta Google, sobe um ou vários arquivos, o app sugere uma
categoria a partir do **nome do arquivo** (ou da estrutura de pastas, se você subir uma pasta
inteira), e tudo fica salvo na nuvem — organizado, buscável e com um botão pra gerar um link
público quando precisar mandar um arquivo pra alguém que não tem conta.

## Índice

- [O que o app faz](#o-que-o-app-faz)
- [Como funciona por baixo dos panos](#como-funciona-por-baixo-dos-panos)
- [Stack técnica](#stack-técnica)
- [Requisitos](#requisitos)
- [Configurando o Firebase](#configurando-o-firebase)
- [Como rodar (desenvolvimento)](#como-rodar-desenvolvimento)
- [Como buildar (produção)](#como-buildar-produção)
- [Lint e checagem de tipos](#lint-e-checagem-de-tipos)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Modelo de dados](#modelo-de-dados)
- [Compartilhamento público](#compartilhamento-público)
- [Categorização e agrupamento automático](#categorização-e-agrupamento-automático)
- [Modos de visualização](#modos-de-visualização)
- [Detalhes de implementação importantes](#detalhes-de-implementação-importantes)
- [Limitações conhecidas](#limitações-conhecidas)
- [Ideias futuras](#ideias-futuras)

## O que o app faz

- **Login com Google**: única forma de acesso — sem cadastro de senha, sem conta própria do app.
- **Upload em lote**: por clique, arrastando arquivos, ou selecionando uma **pasta inteira**
  (estrutura de subpastas vira categorias/subcategorias automaticamente). Mostra uma barra de
  progresso e continua mesmo se um arquivo individual falhar, acumulando os erros no final.
  Tipos aceitos: PDF, TXT, Word (`.doc`/`.docx`) e Excel (`.xls`/`.xlsx`/`.xlsm`).
- **Categoria automática**: sugerida a partir do nome do arquivo (ex.:
  `Vitor Hugo Alves(Boleto Agosto 2026).pdf` → `Boleto`) ou, no upload por pasta, a partir do
  caminho das subpastas (`Documentos/Agosto/boleto.pdf` → `Documentos/Agosto`). Sempre editável
  antes de enviar.
- **Três modos de visualização**, com um seletor de 3 botões ao lado do "Expandir/Recolher tudo":
  **Categoria** (agrupamento automático por padrão detectado no nome — mês/ano, ano, trimestre ou
  prefixo), **Lista** (lista simples, sem agrupar) e **Tabela**. A escolha fica salva no
  navegador.
- **Busca e paginação**: busca por nome do arquivo ou por categoria, 20 arquivos por página.
- **Categorias hierárquicas**: categorias com "/" (ex. `Docs/NF/Sub`) aparecem como árvore
  expansível na barra lateral.
- **Visualização**: clicar num arquivo abre um modal — PDF e TXT renderizam inline; Word/Excel
  abrem em nova aba ou baixam.
- **CRUD completo**: editar (renomear e/ou mover de categoria — move o arquivo de verdade no
  Storage), baixar e excluir.
- **Compartilhamento público**: gera um link (`/share/:token`) que qualquer pessoa pode abrir sem
  login, com opção de permitir ou não o download. Dá pra revogar o link a qualquer momento, e um
  painel no topo mostra todos os links ativos.
- **Responsivo**: layout adaptado para desktop e mobile, com suporte a tema claro/escuro.

## Como funciona por baixo dos panos

É um projeto **de front-end**, sem servidor próprio (sem Node/Express, sem API REST) — o
"backend" é inteiramente o **Firebase**:

- **Firebase Authentication** (provedor Google) identifica o usuário.
- **Cloud Firestore** guarda os metadados de cada documento (nome, categoria, tamanho, data de
  envio, dados de compartilhamento) na coleção `users/{uid}/documents/{docId}`.
- **Cloud Storage** guarda o arquivo em si, em `users/{uid}/{categoria}/{nome do arquivo}`.
- A listagem usa `onSnapshot` (tempo real): qualquer mudança no Firestore — feita neste
  dispositivo ou em outro — atualiza a tela na hora, sem precisar recarregar.
- **Security Rules** (`firestore.rules` e `storage.rules`, na raiz do repo) restringem leitura e
  escrita ao próprio dono (`request.auth.uid == uid`), com uma exceção: um documento do Firestore
  com `sharedToken` preenchido pode ser **lido por qualquer um**, autenticado ou não — é isso que
  sustenta o link público (mais detalhes em [Compartilhamento público](#compartilhamento-público)).

Toda a lógica de acesso ao Firestore/Storage está isolada em
[`client/src/lib/documents.ts`](client/src/lib/documents.ts) e
[`client/src/lib/auth.ts`](client/src/lib/auth.ts) — são os únicos módulos que importam do SDK do
Firebase além de [`client/src/lib/firebase.ts`](client/src/lib/firebase.ts) (inicialização). O
resto do app (componentes React) só chama essas funções.

## Stack técnica

| Camada | Tecnologia | Observação |
|---|---|---|
| UI | [React 19](https://react.dev/) | function components + hooks, sem gerenciador de estado externo (estado vive em `App.tsx`) |
| Linguagem | [TypeScript](https://www.typescriptlang.org/) | projeto inteiro tipado |
| Build/dev server | [Vite 8](https://vite.dev/) | `@vitejs/plugin-react` |
| Estilo | **CSS nativo** (`client/src/index.css`) | sem Tailwind, sem CSS-in-JS, sem nenhuma lib de estilo. Variáveis CSS (`:root`) para tema claro/escuro |
| Ícones | SVG inline escritos à mão (`client/src/components/icons.tsx`) | sem lib de ícones (ex: lucide, heroicons) |
| Autenticação | [Firebase Authentication](https://firebase.google.com/docs/auth) (Google) | `client/src/lib/auth.ts` |
| Banco de dados | [Cloud Firestore](https://firebase.google.com/docs/firestore) | metadados dos documentos, tempo real via `onSnapshot` |
| Armazenamento de arquivos | [Cloud Storage for Firebase](https://firebase.google.com/docs/storage) | os arquivos em si |
| Analytics | [Firebase Analytics](https://firebase.google.com/docs/analytics) | opcional, falha graciosamente se o navegador bloquear |
| Lint | [oxlint](https://oxc.rs/) | `npm run lint` |

Não há servidor Node/Express nem banco de dados próprio — o único "backend" é o projeto Firebase
`gestao-fiscal-38b30` (Auth + Firestore + Storage).

## Requisitos

- Node.js 20+ (testado com Node 22) e npm.
- Um navegador moderno qualquer (Chrome, Edge, Firefox, Safari) — diferente de uma versão anterior
  deste projeto, não há mais dependência da File System Access API, então não há restrição a
  navegadores Chromium.
- Um projeto no [Firebase Console](https://console.firebase.google.com) com **Authentication**
  (provedor Google), **Firestore Database** e **Cloud Storage** habilitados.

## Configurando o Firebase

1. Copie `client/.env.example` para `client/.env` e preencha com as credenciais do seu app web
   (Firebase Console → Configurações do projeto → Seus apps → Web):

   ```bash
   cp client/.env.example client/.env
   ```

2. No Firebase Console, habilite:
   - **Authentication → Sign-in method → Google**
   - **Firestore Database** (criar banco, modo produção)
   - **Storage** (ativar o bucket padrão, se ainda não estiver)
3. Garanta que `localhost` está na lista de **domínios autorizados** em Authentication → Settings
   (normalmente já vem habilitado por padrão) — necessário para o popup de login funcionar em
   desenvolvimento.
4. Publique as regras de segurança (`firestore.rules` e `storage.rules`, na raiz do repo) usando o
   [Firebase CLI](https://firebase.google.com/docs/cli):

   ```bash
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules,storage:rules
   ```

   (Alternativamente, copie o conteúdo de cada arquivo direto no editor de regras do Console.)
   `.firebaserc` já aponta para o projeto `gestao-fiscal-38b30` por padrão — troque se for usar
   outro projeto.
5. (Opcional) `firebase.json` já vem com uma configuração de
   [emuladores locais](https://firebase.google.com/docs/emulator-suite) (Auth/Firestore/Storage)
   para testar sem tocar nos dados de produção: `npx firebase-tools emulators:start`.

## Como rodar (desenvolvimento)

```bash
cd client
npm install   # só na primeira vez
npm run dev
```

Abra `http://localhost:5173`, clique em **"Entrar com Google"** e comece a usar.

## Como buildar (produção)

```bash
cd client
npm run build     # gera client/dist com os arquivos estáticos otimizados
npm run preview   # serve o build de dist localmente, para conferir antes de publicar
```

É um app 100% estático do lado do front — `client/dist` pode ser hospedado em qualquer serviço de
arquivos estáticos (Firebase Hosting, Netlify, Vercel, GitHub Pages, etc.). Se hospedar num domínio
próprio, lembre de adicioná-lo em **Authentication → Settings → Domínios autorizados** no Firebase
Console, senão o login com Google falha nesse domínio.

## Lint e checagem de tipos

```bash
cd client
npm run lint            # oxlint
npx tsc -b --noEmit     # checagem de tipos, sem gerar arquivos
```

## Estrutura do projeto

```
gestao-fiscal/
├── firebase.json                 # config do Firebase CLI: caminho das regras + emuladores locais
├── firestore.rules               # regras de segurança do Firestore
├── storage.rules                 # regras de segurança do Cloud Storage
├── .firebaserc                   # projeto Firebase padrão (gestao-fiscal-38b30)
└── client/                       # todo o código do app (é só front-end)
    ├── index.html                # HTML raiz do Vite; título da aba e <div id="root">
    ├── package.json              # scripts (dev/build/lint/preview) e dependências
    ├── vite.config.ts            # config do Vite (plugin React)
    ├── .env.example              # modelo das variáveis de ambiente do Firebase
    ├── .env                      # suas credenciais reais (git-ignored, você cria)
    └── src/
        ├── main.tsx              # ponto de entrada, monta <App /> no DOM
        ├── App.tsx                # componente raiz: roteia entre app autenticado e /share/:token,
        │                         # estado global (auth, documentos via onSnapshot, filtros,
        │                         # busca, paginação), orquestra todos os modais
        ├── index.css              # todo o CSS do projeto — variáveis, layout, componentes,
        │                         # responsivo, tema claro/escuro — CSS nativo, sem framework
        ├── types.ts               # tipos de domínio: DocumentItem (incl. campos de
        │                         # compartilhamento), CategoryCount
        ├── lib/
        │   ├── firebase.ts        # inicializa app/auth/db/storage/analytics a partir das
        │   │                     # variáveis de ambiente (VITE_FIREBASE_*)
        │   ├── auth.ts            # login/logout com Google, assinatura do estado de autenticação
        │   ├── documents.ts       # TODA a lógica de Firestore + Storage: upload (único e em
        │   │                     # lote), listar em tempo real, renomear/mover, excluir, baixar,
        │   │                     # gerar/revogar link público, buscar por token
        │   ├── category.ts        # heurísticas de sugestão de categoria: pelo nome do arquivo
        │   │                     # (texto entre parênteses) ou pelo caminho de uma pasta
        │   │                     # enviada (subpastas viram subcategorias)
        │   ├── grouping.ts        # detecta o melhor padrão para agrupar uma lista de arquivos
        │   │                     # (mês/ano, ano, trimestre ou prefixo) para o modo "Categoria"
        │   ├── useGroupExpansion.ts  # hook: estado de expandir/recolher por chave de grupo,
        │   │                        # mesclado (nunca substituído inteiro) para sobreviver a
        │   │                        # trocas de página/filtro
        │   └── format.ts          # helpers: tamanho de arquivo, data, extensão, "tipo" do
        │                         # arquivo (pdf/word/excel/text/other), extensões aceitas
        └── components/
            ├── icons.tsx          # ícones SVG inline (sem lib externa)
            ├── Modal.tsx          # shell genérico de modal (usado por todos os outros modais)
            ├── SignIn.tsx         # tela de login com Google
            ├── TopBar.tsx         # barra superior: marca, painel de links compartilhados
            │                     # (com opção de revogar cada um), avatar + nome + sair
            ├── Sidebar.tsx        # navegação lateral em árvore (categorias com "/" viram
            │                     # subcategorias expansíveis)
            ├── CategoryChips.tsx  # navegação por categoria em chips horizontais (mobile)
            ├── DocumentsView.tsx  # os 3 modos de visualização (Categoria/Lista/Tabela), o
            │                     # seletor entre eles e o "Expandir/Recolher tudo"
            ├── DocumentRow.tsx    # uma linha da listagem (ícone, nome, meta, ações: baixar,
            │                     # compartilhar, editar, excluir)
            ├── UploadModal.tsx    # modal de upload em lote: dropzone (arquivos ou pasta), fila
            │                     # editável com categoria por item, barra de progresso
            ├── EditModal.tsx      # modal de edição: renomear arquivo e/ou trocar categoria
            ├── ConfirmDialog.tsx  # modal genérico de confirmação (usado para exclusão)
            ├── ViewerModal.tsx    # modal de visualização: iframe para PDF, <pre> para texto,
            │                     # fallback de "abrir/baixar" para Word/Excel
            ├── ShareModal.tsx     # modal de compartilhamento: gerar/revogar link, toggle de
            │                     # permissão de download, copiar link
            └── SharedViewer.tsx   # página pública (/share/:token) — sem login, busca o
                                  # documento pelo token e mostra o mesmo tipo de visualizador
```

## Modelo de dados

**Firestore** — coleção `users/{uid}/documents/{docId}`:

```ts
{
  name: string,               // nome do arquivo
  category: string,           // categoria (pode ter "/" para subcategorias)
  size: number,                // bytes
  mimeType: string,
  storagePath: string,         // caminho no Cloud Storage
  uploadedAt: Timestamp,        // serverTimestamp()
  sharedToken?: string,         // presente só quando o link público está ativo
  sharedAllowDownload?: boolean,
  sharedFileUrl?: string,       // URL de download pré-gerada no momento do compartilhamento
}
```

**Cloud Storage** — um arquivo por documento, em `users/{uid}/{category}/{name}` (mesmo `name` e
`category` salvos no Firestore).

Não existe um documento "pai" com dados do usuário — `users/{uid}` só existe como caminho para a
subcoleção `documents` (a regra do Firestore precisa de uma entrada para esse caminho por exigência
técnica das Security Rules, mas nenhum dado é guardado nele).

## Compartilhamento público

O fluxo de "gerar link" (`shareDocument` em `documents.ts`) faz duas coisas de uma vez:

1. Gera um `sharedToken` (UUID) e salva no documento do Firestore.
2. Busca (ou reaproveita) a `sharedFileUrl` do Storage — a URL de download assinada — e **também
   salva no Firestore**.

Isso é proposital: o Cloud Storage nunca fica com leitura pública. Quem abre `/share/:token` (veja
`SharedViewer.tsx`) nunca fala com o Storage diretamente — o app busca o documento no Firestore via
uma [`collectionGroup`](https://firebase.google.com/docs/firestore/query-data/queries#collection-group-query)
query por `sharedToken` (permitida pelas regras só para documentos com token preenchido) e usa a
`sharedFileUrl` já pronta que está lá dentro. Revogar o link (`unshareDocument`) apaga os três
campos, invalidando o acesso imediatamente.

A query por `collectionGroup` exige um índice do Firestore — ele é criado automaticamente na
primeira vez que a query roda (o Firestore mostra um link no console/erro para criá-lo se ainda não
existir).

## Categorização e agrupamento automático

Duas heurísticas independentes, ambas em `client/src/lib/category.ts`:

- **`suggestCategory`**: usada em upload de arquivo avulso. Extrai o texto entre parênteses do
  nome (ex. `Fulano(Boleto Agosto 2026).pdf` → `Boleto Agosto 2026`) e remove o sufixo de mês/ano,
  sobrando `Boleto`.
- **`suggestCategoryFromPath`**: usada em upload de pasta inteira. Usa a estrutura de subpastas do
  `webkitRelativePath` do navegador como categoria, com "/" separando níveis
  (`Documentos/Agosto/boleto.pdf` → categoria `Documentos/Agosto`).

Já o **agrupamento automático** (modo de visualização "Categoria", em `grouping.ts`) é uma
heurística diferente e independente da categoria salva: ele varre os *nomes dos arquivos já
carregados na página atual* procurando o padrão mais recorrente — mês/ano, ano isolado, trimestre
(`Q1 2024`, `1T2024`) ou prefixo alfabético (`NF_001`) — e só agrupa se esse padrão cobrir pelo
menos 40% dos arquivos visíveis em pelo menos 2 grupos distintos. Arquivos que não batem com o
padrão escolhido caem numa seção "Outros".

## Modos de visualização

O seletor de 3 botões em `DocumentsView.tsx` (ao lado do "Expandir/Recolher tudo") alterna entre:

- **Categoria** — agrupamento automático descrito acima. Cada grupo (e a seção "Outros") pode ser
  expandido/recolhido individualmente ou todos de uma vez.
- **Lista** — todos os arquivos da página atual, um em seguida do outro, sem agrupar.
- **Tabela** — mesmas informações em formato de tabela (Nome, Categoria, Tamanho, Enviado em,
  Ações), com rolagem horizontal em telas estreitas.

A escolha do modo é salva em `localStorage` (`gestao-fiscal:view-mode`) e sobrevive a recarregar a
página.

## Detalhes de implementação importantes

- **Identidade de um documento**: cada documento tem um `id` de verdade (o ID do documento no
  Firestore) — diferente de uma versão anterior deste projeto (baseada em pasta local), não é mais
  necessário compor `categoria + nome` como chave.
- **Colisão de nomes**: ao subir um arquivo com nome já existente na categoria (ou ao
  renomear/mover para um nome que já existe no destino), `getAvailableName` em `documents.ts`
  adiciona automaticamente um sufixo `(1)`, `(2)`, etc. antes da extensão.
- **Renomear/mover é ler-e-reescrever**: o Cloud Storage não tem operação nativa de "mover" um
  objeto — `updateDocument` lê os bytes do arquivo antigo (`getBytes`), escreve no novo caminho e
  só então apaga o antigo, atualizando o Firestore por último.
- **"Tipo" do arquivo é inferido pela extensão**, não pelo MIME type (`fileKind` em `format.ts`),
  porque o `File.type` do navegador às vezes vem vazio ou genérico para `.docx`/`.xlsx`.
- **Estado de expansão nunca é substituído inteiro**: `useGroupExpansion` mescla chaves novas no
  estado existente em vez de recriar o objeto do zero — isso evita um bug onde trocar de
  página/filtro (grupos com chaves diferentes) fazia o botão "Expandir/Recolher tudo" parecer
  travado ou esquecer o estado de grupos vistos antes. A seção "Outros" participa do mesmo estado
  (via uma chave virtual `__ungrouped__`) pelo mesmo motivo.
- **Visualização de arquivo**: para PDF, o `<iframe>` aponta direto para a URL assinada do
  Storage; para TXT, o conteúdo é buscado via `fetch` e mostrado como texto; Word/Excel não têm
  visualizador nativo no navegador, então só oferecem abrir em nova aba ou baixar.

## Limitações conhecidas

- Cada usuário só vê os próprios arquivos — não há conceito de equipe/organização compartilhando
  uma mesma lista (o compartilhamento público por link é a única forma de dar acesso a terceiros).
- O bundle final é relativamente grande (~800 KB antes de gzip) por incluir o SDK completo do
  Firebase (Auth + Firestore + Storage + Analytics); dá para reduzir com code-splitting se algum
  dia isso incomodar no tempo de carregamento.
- Sem suporte offline — todas as operações exigem conexão com os servidores do Firebase.
- Link público não expira sozinho — fica ativo até alguém revogar manualmente.

## Ideias futuras

- Expiração automática de links compartilhados.
- Convite de outro usuário para ver (ou editar) a mesma lista de documentos.
- Notificação por e-mail quando um novo documento do mês ainda não foi enviado.
