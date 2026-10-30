import { computeSha256, putInStore } from "../storage/db";

export interface ConvertedClientWebp {
  hash: string;
  dataUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
}

/**
 * Converte qualquer imagem ou Blob (JPEG, PNG, clipboard) para WebP Studio (qualidade 0.96)
 * compondo sobre fundo branco puro (#FFFFFF).
 */
export async function convertBlobToWebpClient(
  blob: Blob,
  maxDimension = 1600,
  quality = 0.96
): Promise<ConvertedClientWebp> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        // Limita dimensão mantendo aspect ratio
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Não foi possível inicializar canvas 2D"));
          return;
        }

        // Fundo branco puro #FFFFFF
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Exporta como WebP
        const dataUrl = canvas.toDataURL("image/webp", quality);
        const hash = await computeSha256(dataUrl);

        // Estima tamanho em bytes
        const base64Content = dataUrl.split(",")[1] ?? "";
        const sizeBytes = Math.round((base64Content.length * 3) / 4);

        // Salva na IndexedDB
        await putInStore("mediaStore", {
          hash,
          dataUrl,
          width,
          height,
          sizeBytes,
          createdAt: new Date().toISOString(),
        });

        resolve({
          hash,
          dataUrl,
          width,
          height,
          sizeBytes,
        });
      };
      img.onerror = () => reject(new Error("Falha ao carregar imagem para conversão"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Falha ao ler arquivo de imagem"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Captura imagem da área de transferência (Ctrl+V)
 */
export function extractImageFromClipboard(event: ClipboardEvent): Blob | null {
  const items = event.clipboardData?.items;
  if (!items) return null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item && item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }
  return null;
}
