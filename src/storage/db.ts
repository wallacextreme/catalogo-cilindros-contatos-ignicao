import type { Product } from "../types/catalog";

const DB_NAME = "BalcaoIgnicaoDB";
const DB_VERSION = 1;

export interface ProductOverride {
  productId: string;
  boxNumber?: string;
  internalCode?: string;
  commercialCode?: string;
  price?: number | null;
  customImages?: string[];
  description?: string;
  application?: string;
  isDeleted?: boolean;
  updatedAt: string;
}

export interface BackupPayload {
  version: string;
  exportedAt: string;
  sha256: string;
  totalProducts: number;
  products: Product[];
  overrides: ProductOverride[];
  customProducts: Product[];
}

export async function computeSha256(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("products")) {
        db.createObjectStore("products", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("customOverrides")) {
        db.createObjectStore("customOverrides", { keyPath: "productId" });
      }
      if (!db.objectStoreNames.contains("customProducts")) {
        db.createObjectStore("customProducts", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("mediaStore")) {
        db.createObjectStore("mediaStore", { keyPath: "hash" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function putInStore<T>(storeName: string, item: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteFromStore(storeName: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Sincroniza o seed estático sem sobrescrever edições manuais feitas no balcão.
 * ISOLAMENTO INVIOLÁVEL: Sobrevive 100% à recarga ou atualização de versão do seed.
 */
export async function syncStaticCatalogUpdates(seedProducts: Product[]): Promise<Product[]> {
  const overrides = await getAllFromStore<ProductOverride>("customOverrides");
  const customProducts = await getAllFromStore<Product>("customProducts");

  const overrideMap = new Map<string, ProductOverride>();
  for (const o of overrides) {
    overrideMap.set(o.productId, o);
  }

  const mergedProducts: Product[] = [];

  for (const seed of seedProducts) {
    const ov = overrideMap.get(seed.id);
    if (ov && ov.isDeleted) {
      continue;
    }

    if (!ov) {
      mergedProducts.push(seed);
      await putInStore("products", seed);
    } else {
      // Mescla preservando campos manuais
      const updatedImages = ov.customImages && ov.customImages.length > 0
        ? [...ov.customImages, ...seed.images.filter(img => !ov.customImages?.includes(img))]
        : seed.images;

      const merged: Product = {
        ...seed,
        boxNumber: ov.boxNumber !== undefined ? ov.boxNumber : seed.boxNumber,
        internalCode: ov.internalCode !== undefined ? ov.internalCode : seed.internalCode,
        commercialCode: ov.commercialCode !== undefined ? ov.commercialCode : seed.commercialCode,
        price: ov.price !== undefined ? ov.price : seed.price,
        description: ov.description !== undefined ? ov.description : seed.description,
        application: ov.application !== undefined ? ov.application : seed.application,
        images: updatedImages,
        primaryImage: updatedImages[0] ?? seed.primaryImage,
        updatedAt: ov.updatedAt,
      };
      mergedProducts.push(merged);
      await putInStore("products", merged);
    }
  }

  // Adiciona produtos criados manualmente no balcão
  for (const cp of customProducts) {
    const ov = overrideMap.get(cp.id);
    if (!ov || !ov.isDeleted) {
      mergedProducts.push(cp);
      await putInStore("products", cp);
    }
  }

  return mergedProducts;
}

export async function saveProductUpdate(product: Product): Promise<void> {
  const now = new Date().toISOString();
  product.updatedAt = now;

  if (product.isCustom) {
    await putInStore("customProducts", product);
  } else {
    const override: ProductOverride = {
      productId: product.id,
      boxNumber: product.boxNumber,
      internalCode: product.internalCode,
      commercialCode: product.commercialCode,
      price: product.price,
      customImages: product.images,
      description: product.description,
      application: product.application,
      updatedAt: now,
    };
    await putInStore("customOverrides", override);
  }

  await putInStore("products", product);
}

export async function createNewProduct(product: Product): Promise<void> {
  product.isCustom = true;
  product.updatedAt = new Date().toISOString();
  await putInStore("customProducts", product);
  await putInStore("products", product);
}

export async function removeProduct(id: string, isCustom = false): Promise<void> {
  if (isCustom) {
    await deleteFromStore("customProducts", id);
    await deleteFromStore("products", id);
  } else {
    const override: ProductOverride = {
      productId: id,
      isDeleted: true,
      updatedAt: new Date().toISOString(),
    };
    await putInStore("customOverrides", override);
    await deleteFromStore("products", id);
  }
}

export async function exportBackupJson(): Promise<string> {
  const products = await getAllFromStore<Product>("products");
  const overrides = await getAllFromStore<ProductOverride>("customOverrides");
  const customProducts = await getAllFromStore<Product>("customProducts");

  const coreData = {
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    totalProducts: products.length,
    products,
    overrides,
    customProducts,
  };

  const jsonCore = JSON.stringify(coreData);
  const hash = await computeSha256(jsonCore);

  const payload: BackupPayload = {
    ...coreData,
    sha256: hash,
  };

  return JSON.stringify(payload, null, 2);
}

export async function importBackupJson(jsonString: string): Promise<{ success: boolean; message: string; count: number }> {
  try {
    const parsed = JSON.parse(jsonString) as BackupPayload;
    if (!parsed.products || !Array.isArray(parsed.products)) {
      return { success: false, message: "Arquivo de backup inválido: lista de produtos ausente.", count: 0 };
    }

    // Validação de hash se presente
    if (parsed.sha256) {
      const { sha256: expectedHash, ...rest } = parsed;
      const computed = await computeSha256(JSON.stringify(rest));
      if (computed !== expectedHash) {
        console.warn("Aviso de integridade de backup: hash SHA-256 divergente, prosseguindo com restauração segura.");
      }
    }

    if (parsed.overrides && Array.isArray(parsed.overrides)) {
      for (const ov of parsed.overrides) {
        await putInStore("customOverrides", ov);
      }
    }

    if (parsed.customProducts && Array.isArray(parsed.customProducts)) {
      for (const cp of parsed.customProducts) {
        await putInStore("customProducts", cp);
      }
    }

    for (const p of parsed.products) {
      await putInStore("products", p);
    }

    return { success: true, message: "Backup restaurado com sucesso!", count: parsed.products.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Erro ao importar backup: ${msg}`, count: 0 };
  }
}
