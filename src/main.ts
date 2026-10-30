import "./style.css";
import seedData from "./data/catalog-master-seed.json";
import type { CatalogData, FilterState, Product, ViewMode, AppTheme } from "./types/catalog";
import { syncStaticCatalogUpdates, saveProductUpdate } from "./storage/db";
import { getIcon } from "./ui/icons";
import { LightboxModal } from "./ui/lightbox";
import { ProductFormModal } from "./ui/product-form-modal";
import { BackupModal } from "./ui/backup-modal";

class App {
  private allProducts: Product[] = [];
  private filteredProducts: Product[] = [];
  private filters: FilterState = {
    searchQuery: "",
    selectedCategory: "Todas",
    selectedMake: "Todas as Montadoras",
    selectedSpec: "Todas as Especificações",
    viewMode: (localStorage.getItem("viewMode") as ViewMode) || "grid",
    hidePrices: localStorage.getItem("hidePrices") === "true",
    theme: (localStorage.getItem("appTheme") as AppTheme) || "daylight",
  };
  private appEl: HTMLElement;

  constructor() {
    this.appEl = document.getElementById("app") as HTMLElement;
    this.applyTheme(this.filters.theme);
  }

  public async init(): Promise<void> {
    this.renderSkeleton();

    // Sincroniza catálogo com IndexedDB (Isolamento Inviolável)
    const masterData = seedData as unknown as CatalogData;
    this.allProducts = await syncStaticCatalogUpdates(masterData.products);
    this.applyFilters();
    this.render();
  }

  private applyTheme(theme: AppTheme): void {
    this.filters.theme = theme;
    localStorage.setItem("appTheme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }

  private normalizeText(str: string): string {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  public applyFilters(): void {
    const qRaw = this.normalizeText(this.filters.searchQuery);
    const qClean = qRaw.replace(/[^a-z0-9]/g, "");

    // Identifica se a query é uma busca direta por caixa
    const cxMatch = qRaw.match(/^(?:cx|caixa)?\s*([0-9a-z]+)$/i);
    const targetBox = cxMatch ? cxMatch[1] : null;

    this.filteredProducts = this.allProducts.filter((p) => {
      // 1. Filtro de Categoria
      if (this.filters.selectedCategory !== "Todas") {
        const cat = this.filters.selectedCategory;
        const matchesCategory =
          p.category === cat ||
          p.subCategory === cat ||
          p.ignitionSpecs.pieceType === cat ||
          (cat === "Excêntricos / Chaves Gerais" && (p.ignitionSpecs.pieceType === "Excêntrico de Ignição" || p.ignitionSpecs.pieceType === "Chave Geral" || p.ignitionSpecs.pieceType === "Capa / Borboleta de Ignição"));
        if (!matchesCategory) return false;
      }

      // 2. Filtro de Montadora
      if (this.filters.selectedMake !== "Todas as Montadoras") {
        if (!p.vehicleMakes.includes(this.filters.selectedMake)) return false;
      }

      // 3. Filtro de Especificação Técnica
      if (this.filters.selectedSpec !== "Todas as Especificações") {
        const spec = this.filters.selectedSpec;
        const s = p.ignitionSpecs;
        if (spec === "Com Transponder" && s.transponder !== "Com Transponder (Chip)") return false;
        if (spec === "Sem Transponder" && s.transponder !== "Sem Transponder") return false;
        if (spec === "Com Chicote" && s.connection !== "Com Chicote") return false;
        if (spec === "Sem Chicote (Pino Seco)" && s.connection !== "Sem Chicote (Pino Seco)") return false;
        if (spec === "4/5 Pinos" && !s.terminalCount.includes("4") && !s.terminalCount.includes("5")) return false;
        if (spec === "6/7/8 Pinos" && !s.terminalCount.includes("6") && !s.terminalCount.includes("7") && !s.terminalCount.includes("8")) return false;
        if (spec === "Chave Borboleta" && s.keyProfile !== "Chave Borboleta" && !s.features.includes("Borboleta")) return false;
        if (spec === "Chave Pantográfica" && s.keyProfile !== "Chave Pantográfica") return false;
      }

      // 4. Busca por Texto / Código / Caixa (< 50ms)
      if (!qRaw) return true;

      // Correspondência direta por número de caixa
      if (targetBox) {
        const pBoxNorm = this.normalizeText(p.boxNumber);
        const pBoxClean = pBoxNorm.replace(/[^a-z0-9]/g, "");
        const targetBoxClean = targetBox.replace(/[^a-z0-9]/g, "");
        if (pBoxClean === targetBoxClean || pBoxClean === targetBoxClean.replace(/^0+/, "") || targetBoxClean === pBoxClean.replace(/^0+/, "")) {
          return true;
        }
      }

      // Busca por tokens pré-indexados
      if (p.searchTokens.some((tok) => tok.includes(qRaw) || (qClean && tok.replace(/[^a-z0-9]/g, "").includes(qClean)))) {
        return true;
      }

      // Busca nos campos textuais completos
      const searchable = this.normalizeText(
        `${p.boxNumber} ${p.commercialCode} ${p.commercialCodeRaw} ${p.internalCode} ${p.crossReferenceCodes.join(" ")} ${p.oemCodes.join(" ")} ${p.description} ${p.application} ${p.brand} ${p.vehicleMakes.join(" ")} ${p.ignitionSpecs.pieceType} ${p.ignitionSpecs.terminalCount}`
      );

      const words = qRaw.split(/\s+/).filter(Boolean);
      return words.every((word) => searchable.includes(word) || (qClean && searchable.replace(/[^a-z0-9]/g, "").includes(word.replace(/[^a-z0-9]/g, ""))));
    });
  }

  private renderSkeleton(): void {
    this.appEl.innerHTML = `
      <div class="p-8 text-center text-neutral-500 flex flex-col items-center justify-center min-h-[50vh]">
        <div class="animate-spin mb-4 text-blue-600">${getIcon("zap", "w-8 h-8")}</div>
        <p class="font-semibold text-sm">Carregando Catálogo de Balcão...</p>
      </div>
    `;
  }

  private render(): void {
    const totalCount = this.allProducts.length;
    const filteredCount = this.filteredProducts.length;

    this.appEl.innerHTML = `
      <!-- CABEÇALHO DO APLICATIVO -->
      <header class="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 sticky top-0 z-40 shadow-sm transition-colors duration-150">
        <!-- Linha 1: Marca, Subtítulo e Controles de Ação -->
        <div class="max-w-[1700px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <!-- Bloco do Logo e Título -->
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30">
              ${getIcon("zap", "w-6 h-6")}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-lg sm:text-xl font-black tracking-tight text-neutral-900 dark:text-white uppercase font-sans">
                  CATÁLOGO DE BALCÃO
                </h1>
                <span class="bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase border border-blue-200 dark:border-blue-800">
                  CILINDROS & CONTATOS
                </span>
              </div>
              <p class="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                Localizador Visual de Caixas Físicas • Busca Instantânea Sub-50ms • Multi-Ângulos WebP
              </p>
            </div>
          </div>

          <!-- Bloco de Ações e Alternadores -->
          <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
            <!-- Alternador de Modo de Visualização (Grade / Mural / Caixas) -->
            <div class="flex items-center bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <button
                type="button"
                data-mode="grid"
                class="btn-view-mode px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${this.filters.viewMode === "grid" ? "bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"}"
                title="Grade Detalhada de Balcão"
              >
                ${getIcon("grid", "w-4 h-4")}
                <span>Grade</span>
              </button>
              <button
                type="button"
                data-mode="mural"
                class="btn-view-mode px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${this.filters.viewMode === "mural" ? "bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"}"
                title="Mural Comparador de Amostra (Fotos Grandes)"
              >
                ${getIcon("mural", "w-4 h-4")}
                <span>Mural</span>
              </button>
              <button
                type="button"
                data-mode="boxes"
                class="btn-view-mode px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${this.filters.viewMode === "boxes" ? "bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"}"
                title="Visualizador por Caixas Físicas"
              >
                ${getIcon("box", "w-4 h-4")}
                <span>Caixas</span>
              </button>
            </div>

            <!-- Botão Ocultar / Mostrar Preços -->
            <button
              type="button"
              class="btn-toggle-prices p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition"
              title="${this.filters.hidePrices ? "Mostrar Preços" : "Ocultar Preços (Modo Balcão com Cliente)"}"
            >
              ${this.filters.hidePrices ? getIcon("eyeOff", "w-5 h-5") : getIcon("eye", "w-5 h-5")}
            </button>

            <!-- Alternador de Tema (Daylight / Dark) -->
            <button
              type="button"
              class="btn-toggle-theme p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition"
              title="${this.filters.theme === "dark" ? "Alternar para Daylight Counter Mode" : "Alternar para Dark Mode"}"
            >
              ${this.filters.theme === "dark" ? getIcon("sun", "w-5 h-5") : getIcon("moon", "w-5 h-5")}
            </button>

            <!-- Botão Backup / Integridade SHA-256 -->
            <button
              type="button"
              class="btn-open-backup p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition"
              title="Integridade e Backup de Dados (Disaster Recovery)"
            >
              ${getIcon("shield", "w-5 h-5")}
            </button>

            <!-- Botão Primário Cadastrar Peça -->
            <button
              type="button"
              class="btn-create-product px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-md hover:shadow-lg flex items-center gap-1.5"
            >
              ${getIcon("plus", "w-4 h-4")}
              <span>Cadastrar Peça</span>
            </button>
          </div>
        </div>

        <!-- Linha 2: Omnibox de Busca Instantânea -->
        <div class="max-w-[1700px] mx-auto px-4 sm:px-6 pb-2.5">
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
              ${getIcon("search", "w-5 h-5")}
            </div>
            <input
              type="text"
              id="omnibox-search"
              value="${this.filters.searchQuery}"
              placeholder="Digite o Nº da Caixa (ex: 28, 01, 10, 81), Código (IM-11100, UNI-40895, A-118, 40999, 357905865) ou Aplicação/Veículo (ex: gol c/ chip, monza, uno, fusca 2 pinos)..."
              class="w-full pl-11 pr-10 py-2.5 bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-neutral-900 transition"
              autocomplete="off"
              spellcheck="false"
            />
            ${this.filters.searchQuery ? `
              <button type="button" class="btn-clear-search absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-neutral-600 dark:hover:text-white">
                ${getIcon("close", "w-4 h-4")}
              </button>
            ` : ""}
          </div>
        </div>

        <!-- Linha 3: Exemplos Rápidos de Balcão -->
        <div class="max-w-[1700px] mx-auto px-4 sm:px-6 pb-2.5 flex items-center gap-2 overflow-x-auto text-[11px] no-scrollbar">
          <span class="text-neutral-400 font-bold uppercase tracking-wider shrink-0">EXEMPLOS RÁPIDOS:</span>
          ${[
            { label: "CX 28", query: "28" },
            { label: "CX 01", query: "01" },
            { label: "CX 10", query: "10" },
            { label: "CX 81", query: "81" },
            { label: "A-118", query: "A-118" },
            { label: "IM-11100", query: "IM-11100" },
            { label: "UNI-40895", query: "UNI-40895" },
            { label: "40999", query: "40999" },
            { label: "Gol c/ chip", query: "gol c/ chip" },
            { label: "Kombi Excêntrico", query: "kombi excêntrico" },
            { label: "Corcel 6 Terminais", query: "corcel 6 terminais" },
          ].map(ex => `
            <button
              type="button"
              data-query="${ex.query}"
              class="quick-pill shrink-0 px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-neutral-300/70 dark:border-neutral-700 rounded-md font-mono text-neutral-700 dark:text-neutral-300 font-semibold transition"
            >
              ${ex.label}
            </button>
          `).join("")}
        </div>

        <!-- Linha 4: Filtros de Categoria, Montadora e Especificação -->
        <div class="max-w-[1700px] mx-auto px-4 sm:px-6 pb-3 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-neutral-100 dark:border-neutral-800 pt-2.5">
          <!-- Chips de Categorias -->
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-neutral-400 font-bold uppercase tracking-wider text-[11px] mr-1">CATEGORIAS:</span>
            ${[
              { id: "Todas", label: `Todas (${totalCount})` },
              { id: "Cilindro de Ignição", label: "Cilindro de Ignição" },
              { id: "Contato / Comutador de Ignição", label: "Comutador / Contato" },
              { id: "Trava de Direção", label: "Trava de Direção" },
              { id: "Excêntricos / Chaves Gerais", label: "Excêntricos / Gerais" },
            ].map(cat => `
              <button
                type="button"
                data-category="${cat.id}"
                class="category-chip px-3 py-1 rounded-full font-semibold transition ${this.filters.selectedCategory === cat.id ? "bg-blue-600 text-white shadow-sm" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"}"
              >
                ${cat.label}
              </button>
            `).join("")}
          </div>

          <!-- Dropdowns: Montadora & Especificação -->
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-1.5">
              <span class="text-neutral-400 font-bold uppercase tracking-wider text-[10px]">MONTADORA:</span>
              <select id="select-make" class="px-2.5 py-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs font-medium text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="Todas as Montadoras" ${this.filters.selectedMake === "Todas as Montadoras" ? "selected" : ""}>Todas as Montadoras</option>
                <option value="VW" ${this.filters.selectedMake === "VW" ? "selected" : ""}>VW (Volkswagen)</option>
                <option value="GM / Chevrolet" ${this.filters.selectedMake === "GM / Chevrolet" ? "selected" : ""}>GM / Chevrolet</option>
                <option value="Fiat" ${this.filters.selectedMake === "Fiat" ? "selected" : ""}>Fiat</option>
                <option value="Ford" ${this.filters.selectedMake === "Ford" ? "selected" : ""}>Ford</option>
                <option value="Universal" ${this.filters.selectedMake === "Universal" ? "selected" : ""}>Universal / Outros</option>
              </select>
            </div>

            <div class="flex items-center gap-1.5">
              <span class="text-neutral-400 font-bold uppercase tracking-wider text-[10px]">ESPEC:</span>
              <select id="select-spec" class="px-2.5 py-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs font-medium text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="Todas as Especificações" ${this.filters.selectedSpec === "Todas as Especificações" ? "selected" : ""}>Todas as Especificações</option>
                <option value="Com Transponder" ${this.filters.selectedSpec === "Com Transponder" ? "selected" : ""}>C/ Transponder (Chip)</option>
                <option value="Sem Transponder" ${this.filters.selectedSpec === "Sem Transponder" ? "selected" : ""}>S/ Transponder</option>
                <option value="Com Chicote" ${this.filters.selectedSpec === "Com Chicote" ? "selected" : ""}>C/ Chicote</option>
                <option value="Sem Chicote (Pino Seco)" ${this.filters.selectedSpec === "Sem Chicote (Pino Seco)" ? "selected" : ""}>S/ Chicote (Pino Seco)</option>
                <option value="4/5 Pinos" ${this.filters.selectedSpec === "4/5 Pinos" ? "selected" : ""}>4/5 Pinos / Terminais</option>
                <option value="6/7/8 Pinos" ${this.filters.selectedSpec === "6/7/8 Pinos" ? "selected" : ""}>6/7/8 Pinos / Terminais</option>
                <option value="Chave Borboleta" ${this.filters.selectedSpec === "Chave Borboleta" ? "selected" : ""}>Chave Borboleta</option>
                <option value="Chave Pantográfica" ${this.filters.selectedSpec === "Chave Pantográfica" ? "selected" : ""}>Chave Pantográfica</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <!-- CORPO PRINCIPAL DE RESULTADOS -->
      <main class="flex-1 max-w-[1700px] w-full mx-auto px-4 sm:px-6 py-6">
        <!-- Indicador de Status dos Resultados -->
        <div class="flex items-center justify-between pb-4 text-xs text-neutral-500 dark:text-neutral-400">
          <span>Mostrando <strong>${filteredCount}</strong> de <strong>${totalCount}</strong> peças</span>
          ${this.filters.searchQuery ? `
            <span class="bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 px-2 py-0.5 rounded font-mono">
              Busca: "${this.filters.searchQuery}"
            </span>
          ` : ""}
        </div>

        ${filteredCount === 0 ? this.renderEmptyState() : this.renderProductsView()}
      </main>

      <!-- FOOTER -->
      <footer class="bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 py-3 text-center text-xs text-neutral-400">
        Catálogo Interno de Balcão • Cilindros & Contatos de Ignição • Padrão Ouro 10/10 • Offline-First PWA & Tauri Native
      </footer>
    `;

    this.attachHeaderEvents();
    this.attachProductEvents();
  }

  private renderEmptyState(): string {
    return `
      <div class="p-12 text-center bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col items-center justify-center my-8">
        <span class="p-4 bg-neutral-100 dark:bg-neutral-800 text-neutral-400 rounded-full mb-3">
          ${getIcon("search", "w-8 h-8")}
        </span>
        <h3 class="text-base font-bold text-neutral-800 dark:text-neutral-200">Nenhuma peça localizada</h3>
        <p class="text-xs text-neutral-500 max-w-md mt-1">
          Não encontramos resultados para a busca informada. Tente o número da caixa sem "CX", o código sem traço ou parte do nome do carro.
        </p>
        <button type="button" class="btn-clear-search-empty mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold transition">
          Limpar Filtros e Busca
        </button>
      </div>
    `;
  }

  private renderProductsView(): string {
    if (this.filters.viewMode === "mural") {
      return this.renderMuralView();
    }
    if (this.filters.viewMode === "boxes") {
      return this.renderBoxesView();
    }
    return this.renderGridView();
  }

  /**
   * MODO 1: GRADE DETALHADA DE BALCÃO
   */
  private renderGridView(): string {
    return `
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-5">
        ${this.filteredProducts.map((p) => this.renderProductCard(p)).join("")}
      </div>
    `;
  }

  /**
   * CARD DE PRODUTO PADRÃO OURO DE BALCÃO
   */
  private renderProductCard(p: Product): string {
    const specs = p.ignitionSpecs;
    const hasMultipleImages = p.images.length > 1;

    // Badges semânticos
    const isCylinder = specs.pieceType === "Cilindro de Ignição";
    const isSwitch = specs.pieceType === "Comutador / Contato de Ignição";
    const isLock = specs.pieceType === "Trava de Direção";

    return `
      <div
        data-id="${p.id}"
        class="product-card group bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-150 flex flex-col overflow-hidden"
      >
        <!-- Topo do Card: BADGE GIGANTE DA CAIXA + CÓDIGO PRINCIPAL -->
        <div class="p-3.5 bg-neutral-50/80 dark:bg-neutral-800/40 border-b border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between gap-2">
          <!-- BADGE GIGANTE DA CAIXA -->
          <div
            data-id="${p.id}"
            class="badge-box cursor-pointer px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-mono text-xl font-black tracking-wider flex items-center gap-1.5 shadow-sm transition"
            title="Clique para alterar a caixa desta peça"
          >
            ${getIcon("box", "w-4 h-4 text-blue-200")}
            <span>${p.boxNumber ? `CX ${p.boxNumber}` : "S/ CX"}</span>
          </div>

          <!-- Código Principal com Copiar em 1 Clique -->
          <div class="flex items-center gap-1">
            <button
              type="button"
              data-copy="${p.commercialCode}"
              class="btn-copy-code px-2 py-1 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded text-xs font-mono font-bold text-neutral-800 dark:text-neutral-200 transition flex items-center gap-1"
              title="Copiar Código"
            >
              <span>${p.commercialCode}</span>
              ${getIcon("copy", "w-3 h-3 text-neutral-400")}
            </button>
          </div>
        </div>

        <!-- Área da Foto WebP com Zoom Lightbox -->
        <div
          data-id="${p.id}"
          class="img-zoom-trigger relative aspect-[4/3] bg-white flex items-center justify-center p-3 cursor-pointer group-hover:scale-[1.01] transition-transform overflow-hidden"
          title="Clique para abrir Lightbox com Zoom de até 400%"
        >
          <img
            src="${p.primaryImage}"
            alt="${p.commercialCode}"
            class="max-w-full max-h-full object-contain drop-shadow transition duration-200"
            loading="lazy"
          />

          <!-- Hover Overlay Dica Zoom -->
          <div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1 backdrop-blur-[1px]">
            ${getIcon("zoomIn", "w-5 h-5")}
            <span>Zoom 400%</span>
          </div>

          <!-- Badge se tiver múltiplos ângulos -->
          ${hasMultipleImages ? `
            <span class="absolute bottom-2 right-2 px-1.5 py-0.5 bg-neutral-900/80 text-white rounded text-[10px] font-mono font-bold">
              ${p.images.length} fotos
            </span>
          ` : ""}

          <!-- Indicador de Marca -->
          <span class="absolute top-2 left-2 px-1.5 py-0.5 bg-neutral-100/90 dark:bg-neutral-800/90 text-neutral-600 dark:text-neutral-300 rounded text-[10px] font-semibold">
            ${p.brand}
          </span>
        </div>

        <!-- Conteúdo do Card -->
        <div class="p-4 flex-1 flex flex-col justify-between space-y-3">
          <!-- Badges de Subtipo e Especificações -->
          <div class="space-y-1.5">
            <div class="flex flex-wrap items-center gap-1.5">
              <!-- Subtipo Badge -->
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isCylinder ? "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300" : isSwitch ? "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300" : isLock ? "bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300" : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"}">
                ${specs.pieceType}
              </span>

              <!-- Transponder Badge -->
              ${isCylinder && specs.transponder !== "Não se Aplica" ? `
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${specs.transponder === "Com Transponder (Chip)" ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300" : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"}">
                  ${specs.transponder === "Com Transponder (Chip)" ? "C/ Chip" : "S/ Chip"}
                </span>
              ` : ""}

              <!-- Terminais / Chicote Badge -->
              ${isSwitch ? `
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${specs.connection === "Com Chicote" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300" : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"}">
                  ${specs.connection === "Com Chicote" ? "C/ Chicote" : "Pino Seco"}
                </span>
                ${specs.terminalCount !== "Não Informado" ? `
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200">
                    ${specs.terminalCount}
                  </span>
                ` : ""}
              ` : ""}

              <!-- Features Especiais -->
              ${specs.features.map(f => `
                <span class="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded text-[10px] font-medium">
                  ${f}
                </span>
              `).join("")}
            </div>

            <!-- Aplicação Veicular -->
            <p class="text-xs text-neutral-700 dark:text-neutral-300 font-medium line-clamp-2 leading-relaxed">
              ${p.application || p.description}
            </p>

            <!-- Códigos Cruzados e OEM -->
            ${p.crossReferenceCodes.length > 0 || p.oemCodes.length > 0 ? `
              <div class="pt-1 flex flex-wrap gap-1 text-[10px] font-mono">
                ${p.crossReferenceCodes.slice(0, 3).map(cc => `
                  <span class="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded" title="Código Cruzado">
                    ${cc}
                  </span>
                `).join("")}
                ${p.oemCodes.slice(0, 2).map(oc => `
                  <span class="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded font-semibold text-neutral-700 dark:text-neutral-300" title="Código OEM Original">
                    OEM: ${oc}
                  </span>
                `).join("")}
              </div>
            ` : ""}
          </div>

          <!-- Bottom Row: Preço (se visível) + Botão Editar -->
          <div class="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
            <div>
              ${!this.filters.hidePrices && p.price !== null ? `
                <span class="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                  R$ ${p.price.toFixed(2)}
                </span>
              ` : `
                <span class="text-[11px] text-neutral-400 font-medium">
                  ${p.vehicleMakes.join(", ")}
                </span>
              `}
            </div>

            <button
              type="button"
              data-id="${p.id}"
              class="btn-edit-product px-2.5 py-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg font-semibold transition flex items-center gap-1"
            >
              ${getIcon("edit", "w-3.5 h-3.5")}
              <span>Editar</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * MODO 2: MURAL VISUAL COMPARADOR (FOTOS GRANDES)
   */
  private renderMuralView(): string {
    return `
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        ${this.filteredProducts.map((p) => `
          <div
            data-id="${p.id}"
            class="mural-card group bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col"
          >
            <!-- Badge Caixa Flutuante -->
            <div class="relative aspect-square bg-white flex items-center justify-center p-2">
              <img
                src="${p.primaryImage}"
                alt="${p.commercialCode}"
                class="max-w-full max-h-full object-contain drop-shadow group-hover:scale-105 transition-transform duration-150"
                loading="lazy"
              />
              <span class="absolute top-2 left-2 px-2 py-0.5 bg-blue-600 text-white rounded font-mono font-black text-sm shadow">
                CX ${p.boxNumber || "S/CX"}
              </span>
            </div>
            <div class="p-2.5 border-t border-neutral-100 dark:border-neutral-800 text-center">
              <span class="block font-mono font-bold text-xs text-neutral-900 dark:text-white truncate">
                ${p.commercialCode}
              </span>
              <p class="text-[10px] text-neutral-500 truncate mt-0.5">
                ${p.application || p.description}
              </p>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  /**
   * MODO 3: MAPA DE CAIXAS FÍSICAS
   */
  private renderBoxesView(): string {
    // Agrupa itens por caixa
    const boxes = new Map<string, Product[]>();
    for (const p of this.filteredProducts) {
      const box = p.boxNumber || "SEM CAIXA";
      if (!boxes.has(box)) {
        boxes.set(box, []);
      }
      boxes.get(box)?.push(p);
    }

    // Ordena caixas numericamente
    const sortedBoxes = Array.from(boxes.keys()).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ""), 10);
      const numB = parseInt(b.replace(/\D/g, ""), 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });

    return `
      <div class="space-y-6">
        ${sortedBoxes.map((boxKey) => {
          const items = boxes.get(boxKey) || [];
          return `
            <div class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm">
              <div class="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
                <div class="flex items-center gap-3">
                  <span class="px-3 py-1 bg-blue-600 text-white rounded-lg font-mono font-black text-lg">
                    CAIXA ${boxKey}
                  </span>
                  <span class="text-xs text-neutral-500 font-semibold">
                    ${items.length} ${items.length === 1 ? "peça guardada" : "peças guardadas"} nesta caixa
                  </span>
                </div>
              </div>

              <!-- Lista de Peças da Caixa -->
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-4">
                ${items.map((item) => `
                  <div
                    data-id="${item.id}"
                    class="img-zoom-trigger p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-blue-500 bg-neutral-50 dark:bg-neutral-800/40 flex items-center gap-3 cursor-pointer transition"
                  >
                    <img src="${item.primaryImage}" alt="${item.commercialCode}" class="w-14 h-14 object-contain bg-white rounded-lg p-1 border" />
                    <div class="overflow-hidden flex-1">
                      <span class="block font-mono font-bold text-xs text-neutral-900 dark:text-white truncate">
                        ${item.commercialCode}
                      </span>
                      <span class="block text-[10px] text-blue-600 dark:text-blue-400 font-medium truncate">
                        ${item.subCategory}
                      </span>
                      <span class="block text-[10px] text-neutral-500 truncate">
                        ${item.application}
                      </span>
                    </div>
                  </div>
                `).join("")}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  private attachHeaderEvents(): void {
    // Omnibox Search com resposta instantânea
    const searchInput = document.getElementById("omnibox-search") as HTMLInputElement;
    searchInput?.addEventListener("input", (e) => {
      this.filters.searchQuery = (e.target as HTMLInputElement).value;
      this.applyFilters();
      this.render();
      // Restaura foco
      const input = document.getElementById("omnibox-search") as HTMLInputElement;
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    });

    // Limpar busca
    document.querySelector(".btn-clear-search")?.addEventListener("click", () => {
      this.filters.searchQuery = "";
      this.applyFilters();
      this.render();
    });
    document.querySelector(".btn-clear-search-empty")?.addEventListener("click", () => {
      this.filters.searchQuery = "";
      this.filters.selectedCategory = "Todas";
      this.filters.selectedMake = "Todas as Montadoras";
      this.filters.selectedSpec = "Todas as Especificações";
      this.applyFilters();
      this.render();
    });

    // Exemplos rápidos
    document.querySelectorAll(".quick-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        const query = (btn as HTMLElement).dataset.query || "";
        this.filters.searchQuery = query;
        this.applyFilters();
        this.render();
      });
    });

    // Chips de Categoria
    document.querySelectorAll(".category-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cat = (btn as HTMLElement).dataset.category || "Todas";
        this.filters.selectedCategory = cat;
        this.applyFilters();
        this.render();
      });
    });

    // Select Montadora
    document.getElementById("select-make")?.addEventListener("change", (e) => {
      this.filters.selectedMake = (e.target as HTMLSelectElement).value;
      this.applyFilters();
      this.render();
    });

    // Select Especificação
    document.getElementById("select-spec")?.addEventListener("change", (e) => {
      this.filters.selectedSpec = (e.target as HTMLSelectElement).value;
      this.applyFilters();
      this.render();
    });

    // Alternador de Visualização (Grade / Mural / Caixas)
    document.querySelectorAll(".btn-view-mode").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = (btn as HTMLElement).dataset.mode as ViewMode;
        this.filters.viewMode = mode;
        localStorage.setItem("viewMode", mode);
        this.render();
      });
    });

    // Botão Ocultar / Mostrar Preços
    document.querySelector(".btn-toggle-prices")?.addEventListener("click", () => {
      this.filters.hidePrices = !this.filters.hidePrices;
      localStorage.setItem("hidePrices", String(this.filters.hidePrices));
      this.render();
    });

    // Alternador de Tema (Daylight / Dark)
    document.querySelector(".btn-toggle-theme")?.addEventListener("click", () => {
      const nextTheme: AppTheme = this.filters.theme === "dark" ? "daylight" : "dark";
      this.applyTheme(nextTheme);
      this.render();
    });

    // Modal de Backup / Integridade
    document.querySelector(".btn-open-backup")?.addEventListener("click", () => {
      new BackupModal({
        onDataRestored: () => {
          this.init();
        },
      }).open();
    });

    // Modal Cadastrar Nova Peça
    document.querySelector(".btn-create-product")?.addEventListener("click", () => {
      new ProductFormModal({
        onSave: (newProd) => {
          this.allProducts.unshift(newProd);
          this.applyFilters();
          this.render();
        },
      }).open();
    });
  }

  private attachProductEvents(): void {
    // Abrir Lightbox ao clicar na imagem
    document.querySelectorAll(".img-zoom-trigger, .mural-card").forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const id = (trigger as HTMLElement).dataset.id;
        const prod = this.allProducts.find((p) => p.id === id);
        if (prod) {
          new LightboxModal({
            images: prod.images,
            title: `${prod.commercialCode} — ${prod.brand}`,
            subtitle: prod.application,
            boxNumber: prod.boxNumber,
          }).open();
        }
      });
    });

    // Editar Peça
    document.querySelectorAll(".btn-edit-product").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.id;
        const prod = this.allProducts.find((p) => p.id === id);
        if (prod) {
          new ProductFormModal({
            product: prod,
            onSave: (updated) => {
              const idx = this.allProducts.findIndex((p) => p.id === updated.id);
              if (idx !== -1) {
                this.allProducts[idx] = updated;
              }
              this.applyFilters();
              this.render();
            },
            onDelete: (deletedId) => {
              this.allProducts = this.allProducts.filter((p) => p.id !== deletedId);
              this.applyFilters();
              this.render();
            },
          }).open();
        }
      });
    });

    // Copiar Código em 1 Clique
    document.querySelectorAll(".btn-copy-code").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const code = (btn as HTMLElement).dataset.copy || "";
        navigator.clipboard.writeText(code).then(() => {
          const originalHTML = btn.innerHTML;
          btn.innerHTML = `<span>Copiado!</span> ${getIcon("check", "w-3 h-3 text-emerald-500")}`;
          setTimeout(() => {
            btn.innerHTML = originalHTML;
          }, 1200);
        });
      });
    });

    // Edição rápida de Caixa em 1 clique
    document.querySelectorAll(".badge-box").forEach((badge) => {
      badge.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = (badge as HTMLElement).dataset.id;
        const prod = this.allProducts.find((p) => p.id === id);
        if (!prod) return;

        const newBox = prompt(`Digite a nova caixa para a peça ${prod.commercialCode}:`, prod.boxNumber);
        if (newBox !== null && newBox.trim() !== prod.boxNumber) {
          prod.boxNumber = newBox.trim();
          prod.updatedAt = new Date().toISOString();
          await saveProductUpdate(prod);
          this.applyFilters();
          this.render();
        }
      });
    });
  }
}

// Inicializa a aplicação
window.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  app.init().catch((err) => console.error("Falha ao inicializar o app:", err));
});
