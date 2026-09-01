# Gestão Fiscal

Aplicação pessoal para organizar os documentos fiscais mensais de uma empresa (boleto, nota
fiscal, planilha de horas, etc.) sem precisar arrastar arquivos manualmente para pastas do Google
Drive todo mês.

A ideia: você faz upload de um arquivo, o app sugere uma categoria a partir do **nome do
arquivo**, e o arquivo fica salvo numa pasta real do seu computador, organizado por categoria.
Clicar num item abre o arquivo para visualização.

## Índice

- [O que o app faz](#o-que-o-app-faz)
- [Como funciona por baixo dos panos](#como-funciona-por-baixo-dos-panos)
- [Stack técnica](#stack-técnica)
- [Requisitos](#requisitos)
- [Como rodar (desenvolvimento)](#como-rodar-desenvolvimento)
- [Como buildar (produção)](#como-buildar-produção)
- [Lint e checagem de tipos](#lint-e-checagem-de-tipos)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Detalhes de implementação importantes](#detalhes-de-implementação-importantes)
- [Limitações conhecidas](#limitações-conhecidas)
- [Ideias futuras](#ideias-futuras)

## O que o app faz

- **Escolher uma pasta**: no primeiro uso, o usuário seleciona (ou cria) uma pasta no próprio
  computador. Essa pasta é a "raiz" de tudo — cada categoria vira uma subpasta dentro dela.
- **Upload de arquivo**: por clique ou arrastando (drag-and-drop). Tipos aceitos: PDF, TXT, Word
  (`.doc`/`.docx`) e Excel (`.xls`/`.xlsx`/`.xlsm`).
- **Categoria automática**: o nome sugerido de categoria é extraído do nome do arquivo. Ex.:
  `Vitor Hugo Alves(Boleto Agosto 2026).pdf` → sugere `Boleto` (remove o texto entre parênteses e
  o mês/ano do final). O usuário pode editar antes de salvar.
- **Listagem por categoria**: sidebar com categorias no desktop, chips horizontais no mobile.
  Busca por nome do arquivo.
- **Visualização**: clicar num arquivo abre um modal. PDF e TXT renderizam inline no navegador;
  Word/Excel abrem em nova aba ou baixam (o navegador não tem visualizador nativo pra esses
  formatos).
- **CRUD completo**: editar (renomear e/ou mover de categoria), baixar e excluir — tudo refletido
  diretamente na pasta real do disco.
- **Responsivo**: layout adaptado para desktop e mobile, com suporte a tema claro/escuro
  (`prefers-color-scheme`).

## Como funciona por baixo dos panos

Este é um projeto **100% front-end — sem servidor, sem banco de dados**. Ele usa a
[File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API) do
navegador para ler e escrever arquivos diretamente numa pasta real do sistema operacional:

- Cada **categoria** é literalmente uma **subpasta** dentro da pasta raiz escolhida.
- Cada **arquivo listado** é literalmente um **arquivo** dentro dessa subpasta — não existe um
  banco de dados separado guardando metadados; o próprio sistema de arquivos é a fonte da
  verdade (nome, tamanho e data vêm do próprio arquivo no disco).
- A única coisa persistida pelo navegador é a **referência (handle)** da pasta raiz escolhida,
  guardada no IndexedDB do navegador (`client/src/lib/idb.ts`), para não precisar pedir a pasta de
  novo a cada visita. Por segurança do navegador, a permissão de acesso (`readwrite`) ainda
  precisa ser reconfirmada uma vez a cada sessão do navegador — o app cuida disso sozinho com uma
  tela de "reconectar pasta" quando necessário.
- Se o usuário nunca escolheu uma pasta, ou o navegador não suporta a API, o app mostra uma tela
  de configuração em vez da lista de arquivos (`client/src/components/FolderSetup.tsx`).

Toda essa lógica de leitura/escrita no disco está isolada em
[`client/src/lib/fsAccess.ts`](client/src/lib/fsAccess.ts) — é o único módulo que sabe conversar
com a File System Access API. O resto do app (componentes React) só chama essas funções.

## Stack técnica

| Camada | Tecnologia | Observação |
|---|---|---|
| UI | [React 19](https://react.dev/) | function components + hooks, sem gerenciador de estado externo (estado local em `App.tsx`) |
| Linguagem | [TypeScript](https://www.typescriptlang.org/) | projeto inteiro tipado, incluindo tipagem própria da File System Access API (não vem no `lib.dom.d.ts` padrão) |
| Build/dev server | [Vite 8](https://vite.dev/) | `@vitejs/plugin-react` |
| Estilo | **CSS nativo** (`client/src/index.css`) | sem Tailwind, sem CSS-in-JS, sem nenhuma lib de estilo. Variáveis CSS (`:root`) para tema claro/escuro |
| Ícones | SVG inline escritos à mão (`client/src/components/icons.tsx`) | sem lib de ícones (ex: lucide, heroicons) |
| Persistência de arquivos | **File System Access API** do navegador | sem backend, sem banco de dados |
| Persistência da referência da pasta | `IndexedDB` (nativo do navegador) | guarda só o *handle*, não o conteúdo dos arquivos |
| Lint | [oxlint](https://oxc.rs/) | `npm run lint` |

Não há backend, servidor Node, API REST ou banco de dados (SQL ou NoSQL) neste projeto — só o
front-end React rodando no navegador.

## Requisitos

- Node.js 20+ (testado com Node 22) e npm.
- Um navegador **baseado em Chromium**: Chrome, Edge ou Brave. A File System Access API
  (`window.showDirectoryPicker`) **não é suportada no Firefox nem no Safari** — nesses navegadores
  o app mostra uma tela avisando que não é possível continuar.

## Como rodar (desenvolvimento)

```bash
cd client
npm install   # só na primeira vez
npm run dev
```

Abra `http://localhost:5173` no navegador. No primeiro acesso, clique em **"Escolher pasta"** e
selecione (ou crie) a pasta onde os documentos devem ficar salvos.

## Como buildar (produção)

```bash
cd client
npm run build     # gera client/dist com os arquivos estáticos otimizados
npm run preview   # serve o build de dist localmente, para conferir antes de publicar
```

Como é um app 100% estático (sem backend), o conteúdo de `client/dist` pode ser hospedado em
qualquer serviço de arquivos estáticos (Netlify, Vercel, GitHub Pages, um `nginx`, etc.) — desde
que servido via **HTTPS ou `localhost`**, já que a File System Access API exige um
[contexto seguro](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts).

## Lint e checagem de tipos

```bash
cd client
npm run lint            # oxlint
npx tsc -b --noEmit     # checagem de tipos, sem gerar arquivos
```

## Estrutura do projeto

```
gestao-fiscal/
└── client/                          # todo o projeto vive aqui (é só front-end)
    ├── index.html                   # HTML raiz do Vite; título da aba e <div id="root">
    ├── package.json                 # scripts (dev/build/lint/preview) e dependências
    ├── vite.config.ts               # config do Vite (plugin React, sem proxy — não há backend)
    ├── tsconfig*.json                # configuração do TypeScript (app + node)
    ├── public/
    │   └── favicon.svg
    └── src/
        ├── main.tsx                 # ponto de entrada, monta <App /> no DOM
        ├── App.tsx                  # componente raiz: estado global, fluxo de pasta/permissão,
        │                            # busca/filtro, orquestra todos os modais
        ├── index.css                # todo o CSS do projeto (variáveis, layout, componentes,
        │                            # responsivo, tema claro/escuro) — CSS nativo, sem framework
        ├── types.ts                 # tipos de domínio: DocumentItem, CategoryCount
        ├── types/
        │   └── file-system-access.d.ts   # tipagem manual da File System Access API
        │                                  # (showDirectoryPicker, FileSystemDirectoryHandle, etc.)
        │                                  # necessária pois o TS ainda não inclui essa API no DOM lib
        ├── lib/
        │   ├── fsAccess.ts          # TODA a lógica de acesso a disco: escolher pasta, permissão,
        │   │                        # listar categorias/arquivos, upload, renomear/mover, excluir,
        │   │                        # ler conteúdo de um arquivo
        │   ├── idb.ts               # wrapper mínimo sobre IndexedDB (get/set/delete de 1 chave),
        │   │                        # usado só para persistir o handle da pasta raiz
        │   ├── category.ts          # heurística de sugestão de categoria a partir do nome do
        │   │                        # arquivo (extrai texto entre parênteses, remove "Mês Ano")
        │   └── format.ts            # helpers de formatação: tamanho de arquivo, data, extensão,
        │                            # "tipo" do arquivo (pdf/word/excel/text/other) por extensão
        └── components/
            ├── icons.tsx            # ícones SVG inline (sem lib externa)
            ├── Modal.tsx            # shell genérico de modal (usado por todos os outros modais)
            ├── FolderSetup.tsx      # tela de onboarding: escolher pasta / reconectar permissão /
            │                        # navegador não suportado
            ├── Sidebar.tsx          # navegação lateral por categoria (desktop)
            ├── CategoryChips.tsx    # navegação por categoria em chips horizontais (mobile)
            ├── DocumentRow.tsx      # uma linha da listagem (ícone, nome, meta, ações)
            ├── UploadModal.tsx      # modal de upload: dropzone + sugestão/edição de categoria
            ├── EditModal.tsx        # modal de edição: renomear arquivo e/ou trocar categoria
            ├── ConfirmDialog.tsx    # modal genérico de confirmação (usado para exclusão)
            └── ViewerModal.tsx      # modal de visualização: iframe para PDF, <pre> para texto,
                                     # fallback de "abrir/baixar" para Word/Excel
```

## Detalhes de implementação importantes

- **Identidade de um documento**: como não há banco de dados, um arquivo é identificado pelo par
  `categoria + nome` (é o próprio caminho dele na pasta raiz). Por isso a lista usa
  `${doc.category}/${doc.name}` como `key` no React.
- **Colisão de nomes**: ao subir um arquivo com nome já existente na categoria, ou ao
  renomear/mover para um nome que já existe no destino, `fsAccess.ts` adiciona automaticamente um
  sufixo `(1)`, `(2)`, etc. antes da extensão, para nunca sobrescrever um arquivo sem querer.
  Ver `getAvailableName` em `fsAccess.ts`.
- **"Tipo" do arquivo é inferido pela extensão**, não pelo MIME type (`fileKind` em `format.ts`),
  porque o `File.type` retornado pela File System Access API às vezes vem vazio para `.docx`.
- **Permissão da pasta**: a cada carregamento do app, ele checa `queryPermission` (não pede nada
  ainda). Se não estiver `granted`, mostra a tela de "reconectar" com um botão — só ao clicar nesse
  botão (gesto do usuário) é que `requestPermission` é chamado, porque o navegador exige uma
  interação explícita para esse prompt.
- **Visualização de arquivo**: o conteúdo é lido do disco (`readFile` em `fsAccess.ts`) e
  transformado num [Object URL](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static)
  temporário (`URL.createObjectURL`), usado no `<iframe>` (PDF), lido como texto (`.txt`), ou
  oferecido como link de abrir/baixar (Word/Excel). O URL é revogado quando o modal fecha.

## Limitações conhecidas

- Só funciona em navegadores Chromium (Chrome/Edge/Brave) — File System Access API não existe no
  Firefox/Safari.
- Precisa de contexto seguro (`https://` ou `localhost`) para funcionar.
- A permissão de leitura/escrita da pasta precisa ser reconfirmada pelo usuário uma vez a cada
  sessão do navegador (limitação de segurança da própria API, não é um bug).
- Não há sincronização entre dispositivos/navegadores — os arquivos vivem só na pasta local do
  computador onde foram organizados.

## Ideias futuras

- Sincronização opcional com um servidor/nuvem (ex: se o "cliente" pagar por esse recurso) —
  hoje o app é propositalmente 100% local para manter a v1 simples.
