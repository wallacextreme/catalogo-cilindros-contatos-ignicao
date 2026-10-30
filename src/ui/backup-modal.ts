import { exportBackupJson, importBackupJson, getAllFromStore } from "../storage/db";
import type { Product } from "../types/catalog";
import { getIcon } from "./icons";

export interface BackupModalOptions {
  onDataRestored: () => void;
  onClose?: () => void;
}

export class BackupModal {
  private containerEl: HTMLElement | null = null;
  private onDataRestoredCallback: () => void;
  private onCloseCallback?: () => void;

  constructor(options: BackupModalOptions) {
    this.onDataRestoredCallback = options.onDataRestored;
    this.onCloseCallback = options.onClose;
  }

  public async open(): Promise<void> {
    const products = await getAllFromStore<Product>("products");
    const overrides = await getAllFromStore("customOverrides");
    const custom = await getAllFromStore("customProducts");

    const el = document.createElement("div");
    el.className = "fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto";

    el.innerHTML = `
      <div class="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-800/50">
          <div class="flex items-center gap-3">
            <span class="p-2 bg-emerald-600 text-white rounded-lg shadow-sm">
              ${getIcon("shield", "w-5 h-5")}
            </span>
            <div>
              <h2 class="text-lg font-bold text-neutral-900 dark:text-white leading-tight">Integridade & Backup de Dados</h2>
              <p class="text-xs text-neutral-500 dark:text-neutral-400">Proteção inviolável com validação criptográfica SHA-256</p>
            </div>
          </div>
          <button type="button" class="btn-close-backup p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-lg transition">
            ${getIcon("close", "w-5 h-5")}
          </button>
        </div>

        <!-- Content -->
        <div class="p-6 space-y-6 text-sm text-neutral-800 dark:text-neutral-200">
          <!-- Estatísticas Atuais -->
          <div class="grid grid-cols-3 gap-3 text-center">
            <div class="bg-neutral-50 dark:bg-neutral-800 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <span class="block text-2xl font-black font-mono text-blue-600 dark:text-blue-400">${products.length}</span>
              <span class="text-xs text-neutral-500">Total de Peças</span>
            </div>
            <div class="bg-neutral-50 dark:bg-neutral-800 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <span class="block text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">${overrides.length}</span>
              <span class="text-xs text-neutral-500">Edições no Balcão</span>
            </div>
            <div class="bg-neutral-50 dark:bg-neutral-800 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <span class="block text-2xl font-black font-mono text-amber-600 dark:text-amber-400">${custom.length}</span>
              <span class="text-xs text-neutral-500">Peças Novas</span>
            </div>
          </div>

          <!-- Ação 1: Exportar Backup -->
          <div class="bg-neutral-50 dark:bg-neutral-800/40 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
            <div>
              <h4 class="font-bold text-neutral-900 dark:text-white">Exportar Backup Completo</h4>
              <p class="text-xs text-neutral-500">Salva todas as caixas, códigos e fotos em arquivo JSON assinado</p>
            </div>
            <button type="button" class="btn-export-backup px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm">
              ${getIcon("download", "w-4 h-4")}
              Baixar .json
            </button>
          </div>

          <!-- Ação 2: Restaurar Backup -->
          <div class="bg-neutral-50 dark:bg-neutral-800/40 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
            <div>
              <h4 class="font-bold text-neutral-900 dark:text-white">Restaurar de Arquivo</h4>
              <p class="text-xs text-neutral-500">Importa backup anterior e valida integridade SHA-256</p>
            </div>
            <div>
              <input type="file" class="backup-file-input hidden" accept=".json" />
              <button type="button" class="btn-import-backup px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm">
                ${getIcon("upload", "w-4 h-4")}
                Importar .json
              </button>
            </div>
          </div>

          <!-- Ação 3: Mapa de Caixas -->
          <div class="bg-neutral-50 dark:bg-neutral-800/40 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
            <div>
              <h4 class="font-bold text-neutral-900 dark:text-white">Imprimir Mapa Físico de Caixas</h4>
              <p class="text-xs text-neutral-500">Gera relatório ordenado de todas as caixas para conferência de estoque</p>
            </div>
            <button type="button" class="btn-print-box-map px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm">
              ${getIcon("box", "w-4 h-4")}
              Imprimir Mapa
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end bg-neutral-50 dark:bg-neutral-800/50">
          <button type="button" class="btn-close-backup-footer px-4 py-1.5 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-200 rounded-lg text-xs font-semibold transition">
            Fechar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(el);
    this.containerEl = el;
    this.attachEventListeners(products);
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

  private attachEventListeners(products: Product[]): void {
    if (!this.containerEl) return;

    this.containerEl.querySelector(".btn-close-backup")?.addEventListener("click", () => this.close());
    this.containerEl.querySelector(".btn-close-backup-footer")?.addEventListener("click", () => this.close());

    // Exportar Backup
    this.containerEl.querySelector(".btn-export-backup")?.addEventListener("click", async () => {
      const jsonContent = await exportBackupJson();
      const blob = new Blob([jsonContent], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-balcao-ignicao-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Importar Backup
    const fileInput = this.containerEl.querySelector(".backup-file-input") as HTMLInputElement;
    const btnImport = this.containerEl.querySelector(".btn-import-backup");
    btnImport?.addEventListener("click", () => fileInput?.click());

    fileInput?.addEventListener("change", async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const text = await file.text();
      const res = await importBackupJson(text);
      if (res.success) {
        alert(`${res.message} (${res.count} peças sincronizadas)`);
        this.onDataRestoredCallback();
        this.close();
      } else {
        alert(res.message);
      }
    });

    // Imprimir Mapa de Caixas
    this.containerEl.querySelector(".btn-print-box-map")?.addEventListener("click", () => {
      this.printBoxMap(products);
    });
  }

  private printBoxMap(products: Product[]): void {
    // Agrupa por caixa
    const boxMap = new Map<string, Product[]>();
    for (const p of products) {
      const box = p.boxNumber || "SEM CAIXA";
      if (!boxMap.has(box)) {
        boxMap.set(box, []);
      }
      boxMap.get(box)?.push(p);
    }

    // Ordena chaves de caixa numericamente
    const sortedBoxes = Array.from(boxMap.keys()).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ""), 10);
      const numB = parseInt(b.replace(/\D/g, ""), 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });

    const printWin = window.open("", "_blank");
    if (!printWin) return;

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Mapa Físico de Caixas — Cilindros & Contatos de Ignição</title>
        <style>
          body { font-family: sans-serif; font-size: 12px; margin: 20px; color: #111; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          p.meta { font-size: 11px; color: #555; margin-top: 0; margin-bottom: 20px; }
          .box-block { margin-bottom: 16px; border: 1px solid #ccc; border-radius: 6px; padding: 10px; page-break-inside: avoid; }
          .box-title { font-size: 14px; font-weight: bold; background: #e2e8f0; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-bottom: 8px; font-family: monospace; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border-bottom: 1px solid #eee; text-align: left; padding: 4px 6px; }
          th { background: #f8fafc; font-weight: 600; }
          .code { font-weight: bold; font-family: monospace; }
        </style>
      </head>
      <body>
        <h1>Catálogo de Balcão — Mapa Físico de Caixas</h1>
        <p class="meta">Cilindros de Ignição, Comutadores de Partida e Travas de Direção • Gerado em: ${new Date().toLocaleString("pt-BR")}</p>
    `;

    for (const box of sortedBoxes) {
      const items = boxMap.get(box) || [];
      html += `
        <div class="box-block">
          <div class="box-title">CAIXA ${box} (${items.length} itens)</div>
          <table>
            <thead>
              <tr>
                <th style="width: 15%">Código</th>
                <th style="width: 15%">Subtipo</th>
                <th style="width: 15%">Códigos Cruzados</th>
                <th>Aplicação / Veículos</th>
              </tr>
            </thead>
            <tbody>
      `;
      for (const item of items) {
        html += `
          <tr>
            <td class="code">${item.commercialCode}</td>
            <td>${item.subCategory}</td>
            <td>${[...item.crossReferenceCodes, ...item.oemCodes].join(", ") || "-"}</td>
            <td>${item.application}</td>
          </tr>
        `;
      }
      html += `
            </tbody>
          </table>
        </div>
      `;
    }

    html += `
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    printWin.document.write(html);
    printWin.document.close();
  }
}
