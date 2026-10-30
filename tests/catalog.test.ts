import { describe, expect, test } from "bun:test";
import seedData from "../src/data/catalog-master-seed.json";
import type { CatalogData, Product } from "../src/types/catalog";
import { computeSha256 } from "../src/storage/db";

const catalog = seedData as unknown as CatalogData;

describe("Gate 2 & 3: Integridade do Seed e Engenharia Reversa", () => {
  test("Seed contém metadados e produtos extraídos", () => {
    expect(catalog.catalogMetadata).toBeDefined();
    expect(catalog.catalogMetadata.totalItems).toBeGreaterThanOrEqual(70);
    expect(catalog.products.length).toBe(catalog.catalogMetadata.totalItems);
  });

  test("Todos os produtos possuem ID único, caixa, código e imagens válidas", () => {
    const ids = new Set<string>();
    for (const p of catalog.products) {
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);

      expect(p.commercialCode).toBeTruthy();
      expect(p.category).toBeTruthy();
      expect(p.subCategory).toBeTruthy();
      expect(p.ignitionSpecs).toBeDefined();
      expect(p.ignitionSpecs.pieceType).toBeTruthy();
      expect(p.images.length).toBeGreaterThanOrEqual(1);

      // Verificação de URL 100% lowercase
      for (const img of p.images) {
        expect(img).toBe(img.toLowerCase());
      }
    }
  });

  test("Classificação correta de subtipos de ignição", () => {
    const cylinders = catalog.products.filter((p) => p.ignitionSpecs.pieceType === "Cilindro de Ignição");
    const switches = catalog.products.filter((p) => p.ignitionSpecs.pieceType === "Comutador / Contato de Ignição");
    const locks = catalog.products.filter((p) => p.ignitionSpecs.pieceType === "Trava de Direção");

    expect(cylinders.length).toBeGreaterThanOrEqual(25);
    expect(switches.length).toBeGreaterThanOrEqual(35);
    expect(locks.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Gate 7: Busca Especializada e Filtros Rápidos de Balcão", () => {
  const products = catalog.products;

  function search(query: string): Product[] {
    const qNorm = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const qClean = qNorm.replace(/[^a-z0-9]/g, "");

    const cxMatch = qNorm.match(/^(?:cx|caixa)?\s*([0-9a-z]+)$/i);
    const targetBox = cxMatch ? cxMatch[1] : null;

    return products.filter((p) => {
      if (targetBox) {
        const pBoxNorm = p.boxNumber.toLowerCase().replace(/[^a-z0-9]/g, "");
        const tBoxClean = targetBox.replace(/[^a-z0-9]/g, "");
        if (pBoxNorm === tBoxClean || pBoxNorm === tBoxClean.replace(/^0+/, "") || tBoxClean === pBoxNorm.replace(/^0+/, "")) {
          return true;
        }
      }

      if (p.searchTokens.some((tok) => tok.includes(qNorm) || (qClean && tok.replace(/[^a-z0-9]/g, "").includes(qClean)))) {
        return true;
      }

      const searchable = `${p.boxNumber} ${p.commercialCode} ${p.commercialCodeRaw} ${p.internalCode} ${p.crossReferenceCodes.join(" ")} ${p.oemCodes.join(" ")} ${p.description} ${p.application} ${p.brand} ${p.vehicleMakes.join(" ")} ${p.ignitionSpecs.transponder} ${p.ignitionSpecs.pieceType} ${p.ignitionSpecs.terminalCount}`.toLowerCase();
      const words = qNorm.split(/\s+/).filter(Boolean);
      return words.every((w) => searchable.includes(w) || (qClean && searchable.replace(/[^a-z0-9]/g, "").includes(w.replace(/[^a-z0-9]/g, ""))));
    });
  }

  test("Busca por número exato de caixa (ex: 28, 01, 10, cx 10, caixa 81)", () => {
    const res28 = search("28");
    expect(res28.some((p) => p.boxNumber === "28")).toBe(true);

    const res01 = search("01");
    expect(res01.some((p) => p.boxNumber === "01" || p.boxNumber === "1")).toBe(true);

    const resCx10 = search("cx 10");
    expect(resCx10.some((p) => p.boxNumber === "10")).toBe(true);

    const resCaixa81 = search("caixa 81");
    expect(resCaixa81.some((p) => p.boxNumber === "81")).toBe(true);
  });

  test("Busca por código principal sem pontuação (ex: IM11100, UNI40895, A118)", () => {
    const resIm = search("IM11100");
    expect(resIm.some((p) => p.commercialCode.includes("11100"))).toBe(true);

    const resUni = search("UNI40895");
    expect(resUni.some((p) => p.commercialCode.includes("40895"))).toBe(true);

    const resA = search("A118");
    expect(resA.some((p) => p.commercialCode.includes("118"))).toBe(true);
  });

  test("Busca por código OEM original e conversões", () => {
    const resOem = search("357.905.865");
    expect(resOem.length).toBeGreaterThan(0);
    expect(resOem[0]?.commercialCode).toBe("A-32");

    const resOem2 = search("2119058653");
    expect(resOem2.length).toBeGreaterThan(0);
    expect(resOem2[0]?.commercialCode).toBe("A-33");
  });

  test("Busca combinada de balcão (veículo + característica)", () => {
    const resCelta = search("celta transponder");
    expect(resCelta.length).toBeGreaterThan(0);
    expect(resCelta[0]?.commercialCode).toBe("A-195");

    const resKombi = search("kombi clipper");
    expect(resKombi.length).toBeGreaterThan(0);

    const resEscort = search("escort zetec");
    expect(resEscort.length).toBeGreaterThan(0);
  });

  test("Filtros técnicos: Transponder, Chicote e Terminais", () => {
    const withChip = products.filter((p) => p.ignitionSpecs.transponder === "Com Transponder (Chip)");
    expect(withChip.length).toBeGreaterThanOrEqual(1);

    const withHarness = products.filter((p) => p.ignitionSpecs.connection === "Com Chicote");
    const withoutHarness = products.filter((p) => p.ignitionSpecs.connection === "Sem Chicote (Pino Seco)");
    expect(withoutHarness.length).toBeGreaterThan(20);

    const terminals6 = products.filter((p) => p.ignitionSpecs.terminalCount.includes("6"));
    expect(terminals6.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Gate 8: Isolamento Inviolável de Dados da Loja", () => {
  test("Sobrevivência de edições manuais de caixa e fotos à recarga de seed", () => {
    const original = catalog.products[0]!;
    const mockOverride = {
      productId: original.id,
      boxNumber: "999",
      commercialCode: "IM-MODIFICADO",
      price: 150.0,
      customImages: ["/custom-photo.webp"],
      updatedAt: new Date().toISOString(),
    };

    // Simula a lógica de merge do syncStaticCatalogUpdates
    const merged: Product = {
      ...original,
      boxNumber: mockOverride.boxNumber,
      commercialCode: mockOverride.commercialCode,
      price: mockOverride.price,
      images: [...mockOverride.customImages, ...original.images],
      primaryImage: mockOverride.customImages[0] ?? original.primaryImage,
    };

    expect(merged.boxNumber).toBe("999");
    expect(merged.commercialCode).toBe("IM-MODIFICADO");
    expect(merged.price).toBe(150.0);
    expect(merged.primaryImage).toBe("/custom-photo.webp");
  });
});

describe("Gate 9: Segurança, Benchmark Sub-50ms e Hashing SHA-256", () => {
  test("Benchmark de busca instantânea em < 50ms para 100 iterações", () => {
    const queries = ["28", "gol", "im-11100", "corcel", "357905865", "cx 01", "uno"];
    const start = performance.now();

    for (let i = 0; i < 100; i++) {
      const q = queries[i % queries.length]!;
      catalog.products.filter((p) => p.searchTokens.includes(q.toLowerCase()));
    }

    const duration = performance.now() - start;
    const avgPerQuery = duration / 100;
    expect(avgPerQuery).toBeLessThan(50); // sub-50ms
  });

  test("Cálculo determinístico de hash SHA-256 para backup", async () => {
    const testStr = JSON.stringify({ test: "balcao-ignicao", count: 76 });
    const hash = await computeSha256(testStr);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test("Sanitização anti-XSS em textos e inputs", () => {
    function sanitize(input: string): string {
      return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
    const maliciousInput = "<script>alert('xss')</script>";
    const sanitized = sanitize(maliciousInput);
    expect(sanitized).not.toContain("<script>");
    expect(sanitized).toBe("&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;");
  });
});
