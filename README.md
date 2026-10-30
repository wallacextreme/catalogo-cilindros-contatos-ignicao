# 🔑 Catálogo de Balcão — Cilindros de Ignição, Comutadores de Partida & Travas de Direção

> **Padrão Ouro 10/10 • Offline-First PWA + Aplicativo Nativo Windows (Tauri v2)**  
> **Hospedagem em Produção:** [https://catalogo-ignicao-balcao.web.app](https://catalogo-ignicao-balcao.web.app)

Sistema industrial completo e ultra-rápido desenvolvido especificamente para o atendimento de balcão de autopeças e chaveiros automotivos no setor de **Cilindros de Ignição**, **Comutadores de Partida (Contatos Elétricos)**, **Travas de Direção** e **Excêntricos**.

---

## 🚀 Demonstração em Produção (PWA)

* **URL do Aplicativo:** [https://catalogo-ignicao-balcao.web.app](https://catalogo-ignicao-balcao.web.app)
* **Instalável:** Funciona offline como aplicativo nativo em Windows, Android, iOS e macOS.

---

## ✨ Funcionalidades Principais

1. **Localizador Visual de Caixas Físicas (< 1s):**
   * Badges gigantes de localização (`CAIXA 01`, `CAIXA 28`, `CX 81`) em tipografia industrial de alto contraste.
   * Edição do número da caixa em 1 clique direto no card.
   * Modo dedicado de Caixas com visualização compacta (3 a 4 colunas), atalhos de navegação rápida e exportação de mapa físico de estoque.

2. **Omnibox de Busca Instantânea Sub-50ms:**
   * Busca simultânea e tolerante a hífens/espaços por:
     * **Número da Caixa:** Digitar `28`, `01`, `cx 10` ou `caixa 81`.
     * **Códigos Fabricante:** `A-118`, `IM-11100`, `UNI-40895`, `40999`, `F-1164`.
     * **Códigos OEM Originais:** `357.905.865`, `211.905.865.3`, `ZBA-953.849.A`, `7.323.210`.
     * **Busca Combinada:** `celta transponder`, `corcel 6 terminais`, `kombi excêntrico`, `gol c/ chip`.

3. **Modo Mural Visual Comparador de Amostras:**
   * Alternador no cabeçalho entre **Grade de Balcão**, **Mural de Fotos Grandes** e **Mapa de Caixas**.
   * Ideal para comparar a ponta excêntrica do cilindro, perfil da lâmina da chave ou pinagem traseira do comutador que o cliente trouxe na mão.

4. **Lightbox com Zoom de 50% a 400%:**
   * Inspecione terminais elétricos (`15`, `30`, `50`, `X`) e detalhes mecânicos sem perda de nitidez.
   * Controle por mousewheel, botões de zoom e teclas de atalho.

5. **Modo de Privacidade de Balcão (Ocultar/Mostrar Preços):**
   * Botão de 1 clique no topo que mascara instantaneamente todos os valores como `R$ ••••••` quando o cliente estiver olhando a tela.
   * Edição de preço em 1 clique para o operador.

6. **Galeria Multi-Ângulos com `Ctrl+V` (Clipboard):**
   * Cole recortes de tela (`Win+Shift+S`) ou fotos do WhatsApp diretamente no produto.
   * Conversão automática em tempo real para `.webp` Studio sobre fundo `#FFFFFF` puro e persistência inviolável no IndexedDB.

7. **Engenharia Reversa de Arquivos Word (`.doc` OLE2 / `.docx`):**
   * Pipeline em Python capaz de ler tabelas duplas de 6 colunas, associar imagens por célula e higienizar códigos automaticamente.

---

## 🛠️ Stack Tecnológica

* **Frontend:** TypeScript (`strict: true`), Vite, Tailwind CSS (Daylight Counter Mode + Dark Mode).
* **Desktop Nativo:** Tauri v2 (Rust) gerando instaladores Windows `.exe` e `.msi`.
* **PWA & Offline:** Service Worker com cache-first para imagens WebP, IndexedDB para isolamento inviolável de dados e manifest standalone.
* **Engenharia Reversa & Imagens:** Python, `python-docx`, `Pillow`, `win32com`, Microsoft Playwright.
* **Hospedagem:** Google Firebase Hosting com CDN global e HTTP/2.

---

## 📦 Como Executar Localmente

### Pré-requisitos
* [Bun](https://bun.sh/) (v1.0+)
* [Rust & Cargo](https://rustup.rs/) (apenas para build desktop Tauri)

### Passos
```bash
# 1. Clonar o repositório
git clone https://github.com/wallacextreme/catalogo-cilindros-contatos-ignicao.git
cd catalogo-cilindros-contatos-ignicao

# 2. Instalar dependências
bun install

# 3. Iniciar servidor de desenvolvimento local
bun run dev

# 4. Rodar como aplicativo nativo Windows (Tauri)
bun run tauri dev

# 5. Executar os 10 Quality Gates automatizados
python scripts/verify_all_10_quality_gates.py
```

---

## 🛡️ Auditoria dos 10 Quality Gates

| Gate | Descrição | Status |
| :---: | :--- | :---: |
| **01** | Design System Daylight + Mural + 100% SVG | **PASS** |
| **02** | Extração Completa .DOC & Fundo #FFFFFF | **PASS** |
| **03** | Parsing Multi-Códigos, OEM e Lowercase | **PASS** |
| **04** | Duplo Pipeline WebP + Playwright | **PASS** |
| **05** | Tipagem Estrita TypeScript (Zero Any) | **PASS** |
| **06** | Build Real de Produção | **PASS** |
| **07** | Suíte de Testes Automatizados (bun test) | **PASS** |
| **08** | Isolamento Inviolável de Dados no IndexedDB | **PASS** |
| **09** | Segurança Anti-XSS, Sub-50ms & SHA-256 | **PASS** |
| **10** | PWA Offline & Tauri v2 Nativo Windows | **PASS** |

---

## 📄 Licença

Uso interno comercial licenciado para Auto Peças e Balcão de Vendas.
