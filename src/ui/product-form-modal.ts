import type { Product } from "../types/catalog";
import { getIcon } from "./icons";
import { convertBlobToWebpClient, extractImageFromClipboard } from "../media/webp-converter";
import { createNewProduct, saveProductUpdate, removeProduct } from "../storage/db";

export interface ProductFormOptions {
  product?: Product;
  onSave: (product: Product) => void;
  onDelete?: (id: string) => void;
  onClose?: () => void;
}

export class ProductFormModal {
  private product: Product;
  private isEditing: boolean;
  private onSaveCallback: (product: Product) => void;
  private onDeleteCallback?: (id: string) => void;
  private onCloseCallback?: () => void;
  private containerEl: HTMLElement | null = null;
  private galleryImages: string[] = [];

  constructor(options: ProductFormOptions) {
    this.isEditing = !!options.product;
    this.onSaveCallback = options.onSave;
    this.onDeleteCallback = options.onDelete;
    this.onCloseCallback = options.onClose;

    if (options.product) {
      this.product = JSON.parse(JSON.stringify(options.product)) as Product;
      this.galleryImages = [...this.product.images];
    } else {
      this.product = {
        id: `custom-${Date.now()}`,
        commercialCode: "",
        commercialCodeRaw: "",
        brand: "Universal",
        boxNumber: "",
        internalCode: "",
        category: "Cilindro de Ignição",
        subCategory: "Cilindro de Ignição",
        description: "",
        application: "",
        vehicleMakes: ["Universal"],
        vehicleModels: [],
        crossReferenceCodes: [],
        oemCodes: [],
        ignitionSpecs: {
          pieceType: "Cilindro de Ignição",
          transponder: "Sem Transponder",
          keyProfile: "Chave Comum (Yale / Dente)",
          connection: "Não se Aplica",
          terminalCount: "Não Informado",
          plugGender: "Não se Aplica",
          features: [],
        },
        searchTokens: [],
        images: ["/placeholder-ignition.webp"],
        primaryImage: "/placeholder-ignition.webp",
        price: null,
        needsDescriptionReview: false,
        sourceDocument: "Cadastro Manual no Balcão",
        tableIndex: -1,
        rowIndex: -1,
        slotSide: "LEFT",
        updatedAt: new Date().toISOString(),
        isCustom: true,
      };
      this.galleryImages = [];
    }
  }

  public open(): void {
    this.render();
    this.attachEventListeners();
  }

  public close(): void {
    if (this.containerEl) {
      this.containerEl.remove();
      this.containerEl = null;
    }
    if (this.onCloseCallback) {
      this.onCloseCallback();
    }
  }

  private render(): void {
    const el = document.createElement("div");
    el.className = "fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto";

    const titleText = this.isEditing ? "Editar Peça de Ignição" : "Nova Peça de Balcão";
    const specs = this.product.ignitionSpecs;

    el.innerHTML = `
      <div class="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-800/50">
          <div class="flex items-center gap-3">
            <span class="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
              ${getIcon("key", "w-5 h-5")}
            </span>
            <div>
              <h2 class="text-lg font-bold text-neutral-900 dark:text-white leading-tight">${titleText}</h2>
              <p class="text-xs text-neutral-500 dark:text-neutral-400">Edição instantânea com persistência blindada no IndexedDB</p>
            </div>
          </div>
          <button type="button" class="btn-close-modal p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-lg transition">
            ${getIcon("close", "w-5 h-5")}
          </button>
        </div>

        <!-- Body Form -->
        <form class="product-form p-6 overflow-y-auto space-y-6 flex-1 text-sm text-neutral-800 dark:text-neutral-200">
          <!-- Linha 1: Localização Física e Códigos -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-blue-50 dark:bg-blue-950/30 p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60">
              <label class="block text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                ${getIcon("box", "w-4 h-4 text-blue-600")}
                Nº DA CAIXA FÍSICA *
              </label>
              <input
                type="text"
                name="boxNumber"
                value="${this.product.boxNumber}"
                placeholder="Ex: 28, 01, 10, 81"
                class="w-full px-3 py-2 bg-white dark:bg-neutral-800 border-2 border-blue-500 rounded-lg font-mono text-xl font-black text-blue-700 dark:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>

            <div class="bg-neutral-50 dark:bg-neutral-800/40 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <label class="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1">
                CÓDIGO PRINCIPAL *
              </label>
              <input
                type="text"
                name="commercialCode"
                value="${this.product.commercialCode}"
                placeholder="Ex: IM-11100, UNI-40895, A-118, 40999"
                class="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg font-mono font-bold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div class="bg-neutral-50 dark:bg-neutral-800/40 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <label class="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1">
                CÓDIGO INTERNO (LOJA)
              </label>
              <input
                type="text"
                name="internalCode"
                value="${this.product.internalCode}"
                placeholder="Ex: 2430, MU102"
                class="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg font-mono text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <!-- Linha 2: Marca, Macro-Categoria e Preço -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">Marca / Fabricante</label>
              <input
                type="text"
                name="brand"
                value="${this.product.brand}"
                placeholder="Ex: Almap / Amparo, Marília, Universal, Facobrás"
                class="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">Subtipo de Peça</label>
              <select name="pieceType" class="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg font-medium">
                <option value="Cilindro de Ignição" ${specs.pieceType === "Cilindro de Ignição" ? "selected" : ""}>Cilindro de Ignição</option>
                <option value="Comutador / Contato de Ignição" ${specs.pieceType === "Comutador / Contato de Ignição" ? "selected" : ""}>Comutador / Contato de Ignição</option>
                <option value="Trava de Direção" ${specs.pieceType === "Trava de Direção" ? "selected" : ""}>Trava de Direção</option>
                <option value="Excêntrico de Ignição" ${specs.pieceType === "Excêntrico de Ignição" ? "selected" : ""}>Excêntrico de Ignição</option>
                <option value="Chave Geral" ${specs.pieceType === "Chave Geral" ? "selected" : ""}>Chave Geral</option>
                <option value="Capa / Borboleta de Ignição" ${specs.pieceType === "Capa / Borboleta de Ignição" ? "selected" : ""}>Capa / Borboleta de Ignição</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">Preço no Balcão (R$)</label>
              <input
                type="number"
                step="0.01"
                name="price"
                value="${this.product.price !== null ? this.product.price : ""}"
                placeholder="Ex: 85.00 (Opcional)"
                class="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg font-mono"
              />
            </div>
          </div>

          <!-- Linha 3: Especificações Técnicas de Ignição -->
          <div class="bg-neutral-50 dark:bg-neutral-800/30 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700/80 space-y-3">
            <h3 class="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider flex items-center gap-2">
              ${getIcon("zap", "w-4 h-4 text-amber-500")}
              ESPECIFICAÇÕES TÉCNICAS DE IGNIÇÃO
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label class="block text-xs text-neutral-500 mb-1">Transponder (Chip)</label>
                <select name="transponder" class="w-full px-2.5 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md text-xs">
                  <option value="Sem Transponder" ${specs.transponder === "Sem Transponder" ? "selected" : ""}>Sem Transponder</option>
                  <option value="Com Transponder (Chip)" ${specs.transponder === "Com Transponder (Chip)" ? "selected" : ""}>Com Transponder (Chip)</option>
                  <option value="Não se Aplica" ${specs.transponder === "Não se Aplica" ? "selected" : ""}>Não se Aplica</option>
                </select>
              </div>

              <div>
                <label class="block text-xs text-neutral-500 mb-1">Perfil da Chave</label>
                <select name="keyProfile" class="w-full px-2.5 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md text-xs">
                  <option value="Chave Comum (Yale / Dente)" ${specs.keyProfile === "Chave Comum (Yale / Dente)" ? "selected" : ""}>Chave Comum (Yale)</option>
                  <option value="Chave Pantográfica" ${specs.keyProfile === "Chave Pantográfica" ? "selected" : ""}>Chave Pantográfica (Laser)</option>
                  <option value="Chave Borboleta" ${specs.keyProfile === "Chave Borboleta" ? "selected" : ""}>Chave Borboleta</option>
                  <option value="Chave Prego (Ford Tibbe)" ${specs.keyProfile === "Chave Prego (Ford Tibbe)" ? "selected" : ""}>Chave Prego (Ford Tibbe)</option>
                  <option value="Não se Aplica" ${specs.keyProfile === "Não se Aplica" ? "selected" : ""}>Não se Aplica</option>
                </select>
              </div>

              <div>
                <label class="block text-xs text-neutral-500 mb-1">Conexão / Chicote</label>
                <select name="connection" class="w-full px-2.5 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md text-xs">
                  <option value="Sem Chicote (Pino Seco)" ${specs.connection === "Sem Chicote (Pino Seco)" ? "selected" : ""}>Sem Chicote (Pino Seco)</option>
                  <option value="Com Chicote" ${specs.connection === "Com Chicote" ? "selected" : ""}>Com Chicote</option>
                  <option value="Não se Aplica" ${specs.connection === "Não se Aplica" ? "selected" : ""}>Não se Aplica</option>
                </select>
              </div>

              <div>
                <label class="block text-xs text-neutral-500 mb-1">Terminais / Pinos</label>
                <input
                  type="text"
                  name="terminalCount"
                  value="${specs.terminalCount}"
                  placeholder="Ex: 6 Terminais, 4 Pinos"
                  class="w-full px-2.5 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md text-xs"
                />
              </div>
            </div>
          </div>

          <!-- Linha 4: Códigos Cruzados e OEM -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">Códigos Cruzados / Equivalentes (Separados por vírgula)</label>
              <input
                type="text"
                name="crossReferenceCodes"
                value="${this.product.crossReferenceCodes.join(", ")}"
                placeholder="Ex: F-1072, UNI-30211, 30314, FA1018"
                class="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg font-mono text-xs"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">Códigos Originais OEM (Separados por vírgula)</label>
              <input
                type="text"
                name="oemCodes"
                value="${this.product.oemCodes.join(", ")}"
                placeholder="Ex: 211.905.865.3, 357.905.865, 7.323.210"
                class="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg font-mono text-xs"
              />
            </div>
          </div>

          <!-- Linha 5: Aplicação e Descrição -->
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">Aplicação Veicular (Modelos, Anos e Detalhes)</label>
              <textarea
                name="application"
                rows="2"
                placeholder="Ex: Gol, Saveiro, Parati 95... Santana 88... Caminhão VW"
                class="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg"
              >${this.product.application}</textarea>
            </div>
          </div>

          <!-- Linha 6: Galeria de Fotos Multi-Ângulos (Ctrl+V Instantâneo) -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                ${getIcon("camera", "w-4 h-4 text-blue-600")}
                GALERIA MULTI-ÂNGULOS (COLE COM CTRL+V OU ARRASTE)
              </label>
              <span class="text-xs text-neutral-500">Auto-conversão WebP Studio com fundo #FFFFFF</span>
            </div>

            <div class="drop-zone border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl p-4 text-center hover:border-blue-500 transition cursor-pointer bg-neutral-50/50 dark:bg-neutral-800/20">
              <input type="file" class="file-input hidden" accept="image/*" multiple />
              <div class="flex flex-col items-center justify-center gap-2">
                <span class="p-2.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full">
                  ${getIcon("upload", "w-6 h-6")}
                </span>
                <p class="text-xs text-neutral-600 dark:text-neutral-300">
                  <strong class="text-blue-600 dark:text-blue-400">Clique para selecionar fotos</strong> ou simplesmente pressione <kbd class="px-2 py-0.5 bg-neutral-200 dark:bg-neutral-700 rounded text-xs font-mono">Ctrl+V</kbd> com o print da tela!
                </p>
              </div>
            </div>

            <!-- Miniaturas da Galeria -->
            <div class="gallery-preview flex flex-wrap gap-3 pt-2">
              ${this.renderGalleryThumbnails()}
            </div>
          </div>
        </form>

        <!-- Footer com Ações -->
        <div class="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-800/50">
          <div>
            ${this.isEditing ? `
              <button type="button" class="btn-delete-product px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg text-xs font-bold transition flex items-center gap-1.5">
                ${getIcon("trash", "w-4 h-4")}
                Excluir Peça
              </button>
            ` : ""}
          </div>
          <div class="flex items-center gap-3">
            <button type="button" class="btn-cancel px-4 py-2 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-xs font-semibold transition">
              Cancelar
            </button>
            <button type="button" class="btn-save px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md hover:shadow-lg transition flex items-center gap-2">
              ${getIcon("check", "w-4 h-4")}
              Salvar Peça no Balcão
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(el);
    this.containerEl = el;
  }

  private renderGalleryThumbnails(): string {
    if (this.galleryImages.length === 0) {
      return `<p class="text-xs text-neutral-400 italic">Nenhuma foto adicionada ainda.</p>`;
    }

    return this.galleryImages.map((img, idx) => `
      <div class="relative group w-20 h-20 rounded-lg border border-neutral-300 dark:border-neutral-700 overflow-hidden bg-white shadow-sm flex items-center justify-center">
        <img src="${img}" alt="Foto ${idx + 1}" class="max-w-full max-h-full object-contain p-1" />
        ${idx === 0 ? `<span class="absolute bottom-0 left-0 right-0 bg-blue-600 text-[10px] text-white text-center font-bold">Principal</span>` : ""}
        <button type="button" data-index="${idx}" class="btn-remove-thumb absolute top-1 right-1 p-1 bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition shadow" title="Remover Foto">
          ${getIcon("close", "w-3 h-3")}
        </button>
      </div>
    `).join("");
  }

  private attachEventListeners(): void {
    if (!this.containerEl) return;

    // Fechar
    this.containerEl.querySelector(".btn-close-modal")?.addEventListener("click", () => this.close());
    this.containerEl.querySelector(".btn-cancel")?.addEventListener("click", () => this.close());

    // Salvar
    this.containerEl.querySelector(".btn-save")?.addEventListener("click", () => this.handleSave());

    // Excluir
    this.containerEl.querySelector(".btn-delete-product")?.addEventListener("click", () => {
      if (confirm(`Deseja realmente remover a peça ${this.product.commercialCode} (Caixa ${this.product.boxNumber})?`)) {
        if (this.onDeleteCallback) {
          this.onDeleteCallback(this.product.id);
        }
        removeProduct(this.product.id, this.product.isCustom);
        this.close();
      }
    });

    // Upload de Arquivos
    const dropZone = this.containerEl.querySelector(".drop-zone");
    const fileInput = this.containerEl.querySelector(".file-input") as HTMLInputElement;

    dropZone?.addEventListener("click", () => fileInput?.click());
    fileInput?.addEventListener("change", async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file) {
            await this.processImageBlob(file);
          }
        }
      }
    });

    // Ctrl+V Paste
    window.addEventListener("paste", this.handlePaste);

    // Remover fotos da galeria
    this.bindGalleryEvents();
  }

  private handlePaste = async (e: ClipboardEvent): Promise<void> => {
    const blob = extractImageFromClipboard(e);
    if (blob) {
      e.preventDefault();
      await this.processImageBlob(blob);
    }
  };

  private async processImageBlob(blob: Blob): Promise<void> {
    try {
      const converted = await convertBlobToWebpClient(blob);
      this.galleryImages.push(converted.dataUrl);
      this.updateGalleryUI();
    } catch (err) {
      alert(`Erro ao processar imagem: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private updateGalleryUI(): void {
    const previewEl = this.containerEl?.querySelector(".gallery-preview");
    if (previewEl) {
      previewEl.innerHTML = this.renderGalleryThumbnails();
      this.bindGalleryEvents();
    }
  }

  private bindGalleryEvents(): void {
    const buttons = this.containerEl?.querySelectorAll(".btn-remove-thumb");
    buttons?.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = Number((btn as HTMLElement).dataset.index);
        this.galleryImages.splice(idx, 1);
        this.updateGalleryUI();
      });
    });
  }

  private async handleSave(): Promise<void> {
    if (!this.containerEl) return;
    const form = this.containerEl.querySelector(".product-form") as HTMLFormElement;
    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    const boxNumber = String(formData.get("boxNumber") || "").trim();
    const commercialCode = String(formData.get("commercialCode") || "").trim().toUpperCase();
    const internalCode = String(formData.get("internalCode") || "").trim();
    const brand = String(formData.get("brand") || "Universal").trim();
    const pieceType = String(formData.get("pieceType") || "Cilindro de Ignição").trim();
    const transponder = String(formData.get("transponder") || "Sem Transponder").trim();
    const keyProfile = String(formData.get("keyProfile") || "Chave Comum (Yale / Dente)").trim();
    const connection = String(formData.get("connection") || "Sem Chicote (Pino Seco)").trim();
    const terminalCount = String(formData.get("terminalCount") || "Não Informado").trim();
    const application = String(formData.get("application") || "").trim();
    const priceRaw = String(formData.get("price") || "").trim();
    const price = priceRaw ? parseFloat(priceRaw) : null;

    const crossRaw = String(formData.get("crossReferenceCodes") || "");
    const crossCodes = crossRaw.split(",").map(c => c.trim().toUpperCase()).filter(Boolean);

    const oemRaw = String(formData.get("oemCodes") || "");
    const oemCodes = oemRaw.split(",").map(c => c.trim().toUpperCase()).filter(Boolean);

    const updatedImages = this.galleryImages.length > 0 ? this.galleryImages : ["/placeholder-ignition.webp"];

    this.product.boxNumber = boxNumber;
    this.product.commercialCode = commercialCode;
    this.product.commercialCodeRaw = commercialCode;
    this.product.internalCode = internalCode;
    this.product.brand = brand;
    this.product.category = pieceType.includes("Cilindro") ? "Cilindro de Ignição" : pieceType.includes("Comutador") || pieceType.includes("Contato") ? "Contato / Comutador de Ignição" : pieceType.includes("Trava") ? "Trava de Direção" : "Outros";
    this.product.subCategory = pieceType;
    this.product.ignitionSpecs = {
      ...this.product.ignitionSpecs,
      pieceType,
      transponder,
      keyProfile,
      connection,
      terminalCount,
    };
    this.product.crossReferenceCodes = crossCodes;
    this.product.oemCodes = oemCodes;
    this.product.application = application;
    this.product.description = `${pieceType} ${commercialCode} (${brand}) — ${application.slice(0, 50)}`;
    this.product.price = price;
    this.product.images = updatedImages;
    this.product.primaryImage = updatedImages[0] ?? "/placeholder-ignition.webp";
    this.product.updatedAt = new Date().toISOString();

    if (this.isEditing) {
      await saveProductUpdate(this.product);
    } else {
      await createNewProduct(this.product);
    }

    window.removeEventListener("paste", this.handlePaste);
    this.onSaveCallback(this.product);
    this.close();
  }
}
