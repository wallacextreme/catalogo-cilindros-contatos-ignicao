import { getIcon } from "./icons";

export interface LightboxOptions {
  images: string[];
  initialIndex?: number;
  title: string;
  subtitle?: string;
  boxNumber?: string;
  onClose?: () => void;
}

export class LightboxModal {
  private images: string[];
  private currentIndex: number;
  private title: string;
  private subtitle: string;
  private boxNumber: string;
  private zoomLevel = 1.0;
  private minZoom = 0.5;
  private maxZoom = 4.0;
  private isDragging = false;
  private startX = 0;
  private startY = 0;
  private translateX = 0;
  private translateY = 0;
  private containerEl: HTMLElement | null = null;
  private imgEl: HTMLImageElement | null = null;
  private zoomLabelEl: HTMLElement | null = null;
  private onCloseCallback?: () => void;

  constructor(options: LightboxOptions) {
    this.images = options.images.length > 0 ? options.images : ["/placeholder-ignition.webp"];
    this.currentIndex = options.initialIndex ?? 0;
    this.title = options.title;
    this.subtitle = options.subtitle ?? "";
    this.boxNumber = options.boxNumber ?? "";
    this.onCloseCallback = options.onClose;
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

  private setZoom(newZoom: number): void {
    this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
    if (this.zoomLevel <= 1.0) {
      this.translateX = 0;
      this.translateY = 0;
    }
    this.updateTransform();
    if (this.zoomLabelEl) {
      this.zoomLabelEl.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    }
  }

  private updateTransform(): void {
    if (this.imgEl) {
      this.imgEl.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.zoomLevel})`;
    }
  }

  private prevImage(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.updateImage();
    }
  }

  private nextImage(): void {
    if (this.currentIndex < this.images.length - 1) {
      this.currentIndex++;
      this.updateImage();
    }
  }

  private updateImage(): void {
    if (this.imgEl) {
      this.imgEl.src = this.images[this.currentIndex] ?? "/placeholder-ignition.webp";
      this.setZoom(1.0);
    }
    const counterEl = this.containerEl?.querySelector(".lightbox-counter");
    if (counterEl) {
      counterEl.textContent = `${this.currentIndex + 1} / ${this.images.length}`;
    }
  }

  private render(): void {
    const el = document.createElement("div");
    el.className = "fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md select-none";
    el.innerHTML = `
      <!-- Header do Lightbox -->
      <div class="absolute top-0 left-0 right-0 h-16 bg-neutral-900/80 border-b border-neutral-700/50 flex items-center justify-between px-6 z-10">
        <div class="flex items-center gap-4">
          ${this.boxNumber ? `<span class="bg-blue-600 text-white font-mono font-black text-lg px-3 py-1 rounded shadow-md tracking-wider">CX ${this.boxNumber}</span>` : ""}
          <div>
            <h2 class="text-white font-bold text-lg leading-tight">${this.title}</h2>
            <p class="text-neutral-400 text-xs">${this.subtitle}</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- Controles de Zoom -->
          <div class="flex items-center bg-neutral-800 rounded-lg border border-neutral-700 p-1 text-white">
            <button type="button" class="btn-zoom-out p-1.5 hover:bg-neutral-700 rounded transition" title="Diminuir Zoom (-)">
              ${getIcon("zoomOut", "w-5 h-5")}
            </button>
            <span class="lightbox-zoom-label px-3 font-mono text-xs font-semibold text-neutral-300 min-w-[50px] text-center">100%</span>
            <button type="button" class="btn-zoom-in p-1.5 hover:bg-neutral-700 rounded transition" title="Aumentar Zoom (+)">
              ${getIcon("zoomIn", "w-5 h-5")}
            </button>
            <button type="button" class="btn-zoom-reset text-xs px-2 py-1 text-neutral-400 hover:text-white transition" title="Resetar Zoom (100%)">
              100%
            </button>
          </div>

          <!-- Contador se multi-fotos -->
          ${this.images.length > 1 ? `<span class="lightbox-counter text-neutral-300 font-mono text-sm px-2">${this.currentIndex + 1} / ${this.images.length}</span>` : ""}

          <!-- Fechar -->
          <button type="button" class="btn-close-lightbox p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition" title="Fechar (Esc)">
            ${getIcon("close", "w-6 h-6")}
          </button>
        </div>
      </div>

      <!-- Área de Visualização e Imagem -->
      <div class="lightbox-viewport relative w-full h-full flex items-center justify-center overflow-hidden pt-16 cursor-grab">
        <img
          src="${this.images[this.currentIndex]}"
          alt="${this.title}"
          class="lightbox-image max-w-[85vw] max-h-[80vh] object-contain transition-transform duration-75 origin-center pointer-events-none drop-shadow-2xl"
        />

        <!-- Navegação Anterior / Próxima -->
        ${this.images.length > 1 ? `
          <button type="button" class="btn-prev-img absolute left-6 top-1/2 -translate-y-1/2 p-3 bg-neutral-800/80 hover:bg-neutral-700 text-white rounded-full border border-neutral-600 transition shadow-xl" title="Foto Anterior">
            ${getIcon("chevronLeft", "w-6 h-6")}
          </button>
          <button type="button" class="btn-next-img absolute right-6 top-1/2 -translate-y-1/2 p-3 bg-neutral-800/80 hover:bg-neutral-700 text-white rounded-full border border-neutral-600 transition shadow-xl" title="Próxima Foto">
            ${getIcon("chevronRight", "w-6 h-6")}
          </button>
        ` : ""}
      </div>

      <!-- Barra de Dica Inferior -->
      <div class="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-neutral-900/80 border border-neutral-700/60 rounded-full text-neutral-400 text-xs flex items-center gap-3">
        <span>Arraste para mover quando com zoom</span>
        <span>•</span>
        <span>Scroll / +/- para dar zoom</span>
        <span>•</span>
        <span>Esc para fechar</span>
      </div>
    `;

    document.body.appendChild(el);
    this.containerEl = el;
    this.imgEl = el.querySelector(".lightbox-image");
    this.zoomLabelEl = el.querySelector(".lightbox-zoom-label");
  }

  private attachEventListeners(): void {
    if (!this.containerEl) return;

    // Fechar
    this.containerEl.querySelector(".btn-close-lightbox")?.addEventListener("click", () => this.close());

    // Zoom buttons
    this.containerEl.querySelector(".btn-zoom-in")?.addEventListener("click", () => this.setZoom(this.zoomLevel + 0.25));
    this.containerEl.querySelector(".btn-zoom-out")?.addEventListener("click", () => this.setZoom(this.zoomLevel - 0.25));
    this.containerEl.querySelector(".btn-zoom-reset")?.addEventListener("click", () => this.setZoom(1.0));

    // Nav buttons
    this.containerEl.querySelector(".btn-prev-img")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.prevImage();
    });
    this.containerEl.querySelector(".btn-next-img")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.nextImage();
    });

    // Viewport drag and mousewheel
    const viewport = this.containerEl.querySelector(".lightbox-viewport") as HTMLElement;
    if (viewport) {
      viewport.addEventListener("wheel", (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.25 : -0.25;
        this.setZoom(this.zoomLevel + delta);
      }, { passive: false });

      viewport.addEventListener("mousedown", (e) => {
        if (this.zoomLevel > 1.0) {
          this.isDragging = true;
          this.startX = e.clientX - this.translateX;
          this.startY = e.clientY - this.translateY;
          viewport.classList.replace("cursor-grab", "cursor-grabbing");
        }
      });

      window.addEventListener("mousemove", (e) => {
        if (this.isDragging && this.zoomLevel > 1.0) {
          this.translateX = e.clientX - this.startX;
          this.translateY = e.clientY - this.startY;
          this.updateTransform();
        }
      });

      window.addEventListener("mouseup", () => {
        if (this.isDragging) {
          this.isDragging = false;
          viewport.classList.replace("cursor-grabbing", "cursor-grab");
        }
      });
    }

    // Teclado
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        this.close();
        window.removeEventListener("keydown", onKeyDown);
      } else if (e.key === "+" || e.key === "=") {
        this.setZoom(this.zoomLevel + 0.25);
      } else if (e.key === "-") {
        this.setZoom(this.zoomLevel - 0.25);
      } else if (e.key === "0") {
        this.setZoom(1.0);
      } else if (e.key === "ArrowLeft") {
        this.prevImage();
      } else if (e.key === "ArrowRight") {
        this.nextImage();
      }
      // Never block ArrowUp / ArrowDown!
    };
    window.addEventListener("keydown", onKeyDown);
  }
}
