INICIAR PROJETO DO ZERO: CATÁLOGO INTERNO DE BALCÃO (LOCALIZADOR VISUAL DE CAIXAS, CÓDIGOS INTERNOS E MIUDEZAS AUTOMOTIVAS) A PARTIR DE DOCUMENTOS WORD (.DOCX) — PADRÃO OFICIAL 10/10

Atue como Arquiteto de Software Sênior, Especialista em Engenharia Reversa de Documentos `.docx` (OpenXML / `python-docx` / `zipfile` + `Pillow`) e Principal UI/UX Designer (`ui-ux-pro-max-skill`).

Sua missão é construir um sistema completo, ultra-rápido e simplificado de **Catálogo Interno de Balcão Offline-First (PWA + Aplicativo Nativo Windows `.exe` e `.msi` via Tauri v2)** a partir dos arquivos Microsoft Word (`.docx`) presentes nesta pasta (`GRAMPOS,PRESILHAS,BATENTES E ACABAMENTOS...docx`, `PEÇAS (MIUDEZAS) CATALOGO 2.docx` e eventuais outros `.docx`).

OBJETIVO CENTRAL DESTE SISTEMA (FOCO 100% EM VELOCIDADE DE BALCÃO INTERNO):
Este catálogo é de uso interno no balcão da autopeças para que o atendente possa:
1) **Olhar a foto real da peça em alta nitidez** (muitas vezes comparando visualmente com o grampo, presilha, bucha, porca, conector ou reparo que o cliente trouxe na mão na amostra).
2) **Saber em menos de 1 segundo em qual CAIXA / GAVETA o produto está guardado** (ex.: `CAIXA 940`, `CAIXA 10309`, `CAIXA 916AGR`, `GAVETA LF1125A`) e qual é o **CÓDIGO INTERNO** (`MU392`, `MU10309`, `LT-2340`, `COR54`) e o **Código de Referência** (`P-185`, `LF0437`, `D100.83`, `JAHU 08271-9`, `QC030`).
3) Adicionar novas fotos em múltiplos ângulos colando com **`Ctrl+V`**, editar descrições/caixas/códigos/preços facilmente em um Modal Completo e funcionar 100% offline.

Siga rigorosamente os 6 Passos e aprove todos os 10 Quality Gates abaixo:

================================================================================
PASSO 1 — AUDITORIA DO AMBIENTE E DESIGN SYSTEM AUTOMÁTICO (`ui-ux-pro-max`)
================================================================================
1. Inspecione a pasta atual, localize todos os arquivos `.docx`, verifique Python (`python-docx`, `Pillow`, `lxml`), Bun, Rust/Cargo e inicialize o repositório Git com `.gitignore`.
2. Instale e consulte automaticamente a skill oficial de UI/UX:
   `bunx skills add https://github.com/nextlevelbuilder/ui-ux-pro-max-skill --skill ui-ux-pro-max`
3. Configure o **Daylight Counter Mode (Alto Contraste Industrial)** como padrão + alternador para Dark Mode:
   - Nos cards de produto, a informação de maior destaque visual absoluto deve ser o **BADGE GIGANTE DA CAIXA (`CAIXA 10309`)** em cores de altíssimo contraste (ex.: Azul Royal / Verde Esmeralda / Âmbar Industrial com fonte `font-mono text-2xl font-black`) e o **CÓDIGO INTERNO (`MU10309`)**, seguidos da **Foto Grande da Peça** e da Descrição/Aplicação limpa.
   - **Modo "Mural Visual de Identificação" (Toggle na Barra Superior):** Além da Grade Padrão de Balcão, adicione um botão de alternância para o **Modo Comparador Visual (Fotos Grandes)**, ideal para quando o balconista está com um grampo/bucha na mão procurando visualmente qual foto é igual à amostra do cliente!
   - **Zero Emojis:** Crie `src/ui/icons.ts` exclusivamente com ícones vetoriais SVG inline estilo Lucide. Jamais bloqueie as setas `ArrowUp` / `ArrowDown` na rolagem da página.

================================================================================
PASSO 2 — ENGENHARIA REVERSA DE ARQUIVOS WORD `.DOCX` (`scripts/extract_docx_catalogs.py`)
================================================================================
Construa e execute `scripts/extract_docx_catalogs.py` inspecionando a estrutura XML interna (`w:body`, `w:p`, `w:tbl`, `w:tr`, `w:tc`, `a:blip[@r:embed]`, `v:imagedata[@r:id]` e relacionamentos `word/_rels/document.xml.rels` -> `word/media/`):

2.1 Leitura de Seções/Categorias e Tabelas de 6 Colunas (Lado Esquerdo + Lado Direito):
- Rastreie os parágrafos de título que antecedem ou dividem as tabelas para classificar automaticamente a **Categoria / Seção** de cada peça:
  * Exemplos reais nos documentos: `Grampos, Presilhas, Batentes e Acabamentos`, `Porca Rápida e Buchas de Fixação`, `Molas em Geral`, `Alças, Moldura e Kits Banco`, `Parafuso Fixação e Regulagem de Farol`, `Reparos de Trambulador e Câmbio`, `Castelo Vela (Tucho)`, `Calota Cubo Roda`, `Porcas Ponta Eixo / Homocinética / Amortecedor`, `Bujão e Anéis de Cárter e Caixa`, `Parafuso Suspensão / Balança / Motor`, `Kit Embreagem e Kits de Pedal`, `Bucha Caixa Direção`, `Conexões e Engates Rápidos`, `Regulagem de Freio`.
- Cada linha (`<w:tr>`) das tabelas possui **6 colunas** representando **2 produtos lado a lado**:
  * **Produto Esquerdo:** Coluna 0 (`ITEM` / `IMAGEM`), Coluna 1 (`DESCRIÇÃO`), Coluna 2 (`CAIXA`).
  * **Produto Direito:** Coluna 3 (`ITEM` / `IMAGEM`), Coluna 4 (`DESCRIÇÃO`), Coluna 5 (`CAIXA`).
  * Ignore linhas de cabeçalho (`ITEM | DESCRIÇAO | CAIXA` ou `IMAGEM | DESCRIÇÃO | CAIXA`) e slots totalmente vazios nas 3 colunas do lado.

2.2 Extração Exata de Imagens por Célula (`<w:tc>`) + `webp_studio_converter.py`:
- Para a célula de imagem de cada slot (Coluna 0 para o esquerdo; Coluna 3 para o direito), localize todas as tags `<a:blip r:embed="rId..."/>` e `<v:imagedata r:id="rId..."/>` dentro daquele `<w:tc>`.
- Extraia os bytes originais da imagem correspondente dentro do pacote ZIP do `.docx` (`word/media/imageX.png`, `.jpeg`, `.gif`, etc.).
- Passe todas as imagens pelo módulo `scripts/webp_studio_converter.py` (compondo transparências sobre fundo branco puro `#FFFFFF`, limpeza de cantos, *Smart Trim* com padding de `16px` mantendo 100% da proporção original e codificando em `.webp` sem perda visual `quality=96, method=6`).
- Salve com nomes 100% `lowercase` em `public/catalog-images/miudezas/{id_unico_lowercase}.webp`.

2.3 Inteligência de Parsing para `CAIXA`, `CÓDIGO INTERNO` e `DESCRIÇÃO`:
- **Coluna `CAIXA` (Colunas 2 e 5):**
  * Muitas células contêm **2 linhas** (ex.: `392 \n MU392`, `10309 \n MU10309`, `1048B \n LT-2340`, `39 \n 22839`, `58 \n AJ7124`, `54 \n COR54`, `121 \n FT1380`, `526 \n 526GR`, `GAVETA \n LF1125A`).
  * Separe intelligentemente em:
    - `boxNumber`: O número/identificador da caixa física (ex.: `392`, `10309`, `1048B`, `916AGR`, `975E`, `10334` limpando prefixo `Cx.`, `824C`, `GAVETA`).
    - `internalCode`: O código interno da loja quando presente na 2ª linha ou com prefixo `MU`, `COR`, `LT`, `LF`, `FT`, `AJ`, `GR` (ex.: `MU392`, `MU10309`, `LT-2340`, `526GR`).
- **Coluna `DESCRIÇÃO` (Colunas 1 e 4):**
  * Extraia automaticamente códigos de referência/fabricante que vêm no início ou no meio da descrição, inclusive quando estiverem grudados sem espaço no texto (ex.: `"P111PRESILHA..."` -> código `P-111` e texto `"PRESILHA..."`; `"P-194PORCA..."` -> `P-194`; `"P-261GRAMPO..."` -> `P-261`; `"P-557PRESILHA..."` -> `P-557`; `"LF0984-BBUCHA..."` -> `LF0984-B`).
  * Reconheça códigos de referência como `P-xxx`, `LFxxxx`, `LTxxxx`, `LTCxxxx`, `D100.xxx`, `D200.xxx`, `D300.xxx`, `D400.xxx`, `D600.xxx`, `JAHU xxxxx`, `CORCERAMA xxxxx`, `KIT&CIA xxxxx`, `EMO-xxxxx`, `KPAxxxxxxx`, `K-xx`, `T-xx`, `AP-xxx`, `VWxxx`, `FDxxx`, `FTxxx`, `GMxxx`, `QCxxx`, `QCWxxxx`, `GMGxxxx`, `DCxxxx`, `DV-xxxxx`, `ETE7242`, `IN3301` e códigos OEM (`XS6171586AA`, `013.141.719.2`, `307.419.063-5`, `100164475`).
  * Se a imagem contiver especificações conhecidas ou o texto trouxer medidas (ex.: `12X19X9X0,60MM`, `M20X1,50X43`, `5/16" x 5/16"`, `8mm`, `90°`, `Pino: 8,0 | Corpo: 13,0 | Cabeça: 18,0`), estruture-as nos atributos técnicos e tokens de busca!
- **REGRA CRÍTICA — Preservação de Itens Visuais (Foto + Caixa sem Descrição):**
  * Nos arquivos `.docx` existem dezenas de células que possuem **a Foto da peça e o Número da Caixa** (ex.: `Caixa 10144`, `Caixa 10146`, `Caixa 82`, `Caixa 67`, `Caixa 1089`, `Caixa 450`, `Caixa 853`), mas estão com a coluna `DESCRIÇÃO` em branco.
  * **NUNCA descarte esses itens!** Cadastre-os normalmente no `catalog-master-seed.json` com a foto `.webp` extraída, o `boxNumber` exato, uma flag `needsDescriptionReview: true` e uma descrição provisória clara (`"[Identificação Visual] ${categoria} — Caixa ${boxNumber}"`). Assim o balconista encontra a peça pela Caixa ou olhando a foto no Mural Visual, e pode completar o nome no Modal de Edição quando quiser!

================================================================================
PASSO 3 — DUPLO PIPELINE DE CONVERSÃO AUTOMÁTICA `.WEBP` SEM PERDA VISUAL
================================================================================
1. **Build-Time (`scripts/webp_studio_converter.py`):** Converte todas as imagens extraídas dos `.docx` para `.webp` (`quality=96, method=6, exact=True`), compondo transparências sobre `#FFFFFF`, aplicando trim inteligente com margem de `16px` e auditando 100% dos pixels (zero imagens pretas ou corrompidas).
2. **Client-Side (`src/media/webp-converter.ts`):** Permite que o balconista cole qualquer foto nova com **`Ctrl+V`** (ex.: print `Win+Shift+S` ou foto da câmera/WhatsApp) ou **Drag & Drop** diretamente no produto, convertendo em tempo real no navegador para `.webp` de alta nitidez (`quality: 0.96`) + miniatura (`0.90`) com deduplicação `SHA-256` no IndexedDB.

================================================================================
PASSO 4 — APLICATIVO DE BALCÃO INTERNO (BUSCA DE CAIXAS SUB-50MS + MODAL CRUD)
================================================================================
Construa a aplicação com **Bun + Vite + TypeScript (`strict: true`) + Tailwind CSS + IndexedDB + Tauri v2**:
1. **Barra de Busca Omnibox Especializada para Balcão de Miudezas:**
   - Busca instantânea (`< 50ms`) por:
     * **Número da Caixa** (digitar `940`, `10309`, `916AGR` ou `Cx 940` traz imediatamente todos os itens guardados naquela caixa!).
     * **Código Interno** (`MU392`, `MU10309`, `LT-2340`, `COR54`).
     * **Código de Referência / Fabricante** (`P-185`, `P185`, `P16`, `LF0437`, `D100.83`, `JAHU`, `QC030`).
     * **Descrição, Tipo de Peça, Medida ou Veículo** (`grampo parabarro civic`, `presilha forro porta onix`, `reparo trambulador corsa`, `bujão carter`, `porca homocinética`, `conector 5/16`).
2. **Filtros Rápidos de 1 Clique:**
   - Filtro por **Categoria / Seção** (As 15 seções dos 2 catálogos: Grampos/Presilhas, Porcas Rápidas/Buchas, Molas, Kits de Banco, Parafusos de Farol, Trambulador/Câmbio, Castelo de Vela, Calotas de Cubo, Porcas de Eixo/Homocinética, Bujões de Cárter, Embreagem/Pedal, Caixa de Direção, Conexões/Injeção, Regulagem de Freio).
   - Filtro por **Montadora** (`VW`, `GM`, `Fiat`, `Ford`, `Toyota`, `Honda`, `Renault`, `Peugeot/Citroën`, `Hyundai`, `Mitsubishi`, `Nissan`, `Universal`).
   - Filtro de **Status Visual**: `Todos os Itens`, `Com Foto`, `Sem Foto (Para Fotografar)`, `Apenas Foto + Caixa (Sem Descrição)`.
   - Alternador de Visualização: **Grade Detalhada de Balcão** vs. **Mural Visual de Fotos Grandes (Comparador de Amostra)**.
3. **Design do Card de Balcão:**
   - **Foto `.webp` ampla e nítida** (com carrossel se tiver múltiplos ângulos e clique para abrir o **Lightbox com Zoom de 50% a 400%**).
   - **Bloco de Localização Gigante:** `CAIXA: [ 10309 ]` e `CÓD. INTERNO: [ MU10309 ]` com edição rápida em 1 clique!
   - **Badges de Códigos de Referência:** `P-185`, `LF0437`, `JAHU 08271-9` com botão de copiar em 1 clique.
   - Botão **"Ocultar / Mostrar Preços"** no topo (caso o cliente esteja olhando a tela) + botão **"Editar Peça / + Foto Ctrl+V"**.
4. **Modal Completo de Cadastro, Edição, Duplicação e Importação de Novos `.docx`:**
   - Modal CRUD (`src/ui/product-form-modal.ts`) para criar novos itens, editar Caixa, Código Interno, Códigos de Referência, Descrição, Categoria, Preço opcional e **Galeria Multi-Ângulos (`Ctrl+V` / Drag & Drop)**.
   - Persistência blindada no IndexedDB (`syncStaticCatalogUpdates`) que nunca apaga fotos manuais ou edições de caixa/código feitas no balcão, além de **Backup/Restore completo (`.json` com hash `SHA-256`)** e **Exportação/Impressão de Mapa de Caixas**.

================================================================================
PASSO 5 — OS 10 QUALITY GATES OBRIGATÓRIOS (`scripts/verify_all_10_quality_gates.py`)
================================================================================
Crie e execute `scripts/verify_all_10_quality_gates.py` validando com status `PASS` todos os 10 Gates:
1. **Gate 1 — Design System (`ui-ux-pro-max`):** Daylight Counter Mode ativo, badges gigantes de `CAIXA`, modo Mural Visual, 100% ícones SVG Lucide (`emojis=0, arrowTraps=0`).
2. **Gate 2 — Extração `.DOCX` Completa & Pixels `#FFFFFF`:** 100% dos itens dos dois arquivos `.docx` extraídos (incluindo os itens visuais de Foto + Caixa), todas as imagens originais de `word/media/` extraídas e convertidas para `.webp` com `fundosPretos=0` e `falhasPixel=0`.
3. **Gate 3 — Separação Exata de `CAIXA`, `CÓDIGO INTERNO` e `REFERÊNCIA` + 100% `lowercase`:** Validação de que células do tipo `392 \n MU392` foram separadas corretamente em `boxNumber: "392"` e `internalCode: "MU392"`, códigos grudados (`P111PRESILHA`) foram higienizados e 100% dos caminhos de imagem estão em `lowercase`.
4. **Gate 4 — Duplo Pipeline `.WebP` Sem Perda Visual:** `scripts/webp_studio_converter.py` (`quality=96, method=6`) + `src/media/webp-converter.ts` (`Ctrl+V` client-side + `SHA-256`) ativos.
5. **Gate 5 — Tipagem Estrita TypeScript:** `bun x tsc --noEmit` com `Exit Code 0` (`strict: true`, zero `@ts-ignore`).
6. **Gate 6 — Integração Real no `src/main.ts`:** `bun run build` gerando o bundle de produção completo em `dist/`.
7. **Gate 7 — Suíte Completa de Testes (`bun test`):** 100% de aprovação testando busca por número de caixa, busca por código `MU...`/`P-...`/`LF...`, higienização de códigos grudados, CRUD de caixas e galeria multi-ângulos.
8. **Gate 8 — Isolamento Inviolável dos Dados da Loja:** Teste provando que edições manuais de `boxNumber`, `internalCode`, descrições e fotos `Ctrl+V` no IndexedDB nunca são sobrescritas ao recarregar o seed.
9. **Gate 9 — Segurança Anti-XSS, Magic Bytes, Busca `< 50ms` & Backup `SHA-256`:** Testes de segurança, benchmark `< 50ms` e Disaster Recovery aprovados.
10. **Gate 10 — PWA Offline & Windows Nativo (Tauri v2):** `manifest.webmanifest`, `sw.js`, `src-tauri/icons/icon.ico` binário válido e `cargo check` aprovados.

Ao concluir, faça o commit no Git e apresente o Relatório Final com o total de peças e fotos extraídas de cada `.docx`, a contagem por seção e a tabela dos 10 Quality Gates.