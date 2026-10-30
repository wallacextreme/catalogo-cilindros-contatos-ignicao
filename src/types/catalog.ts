export interface IgnitionSpecs {
  pieceType: string;
  transponder: string;
  keyProfile: string;
  connection: string;
  terminalCount: string;
  plugGender: string;
  features: string[];
}

export interface Product {
  id: string;
  commercialCode: string;
  commercialCodeRaw: string;
  brand: string;
  boxNumber: string;
  internalCode: string;
  category: string;
  subCategory: string;
  description: string;
  application: string;
  vehicleMakes: string[];
  vehicleModels: string[];
  crossReferenceCodes: string[];
  oemCodes: string[];
  ignitionSpecs: IgnitionSpecs;
  searchTokens: string[];
  images: string[];
  primaryImage: string;
  price: number | null;
  needsDescriptionReview: boolean;
  sourceDocument: string;
  tableIndex: number;
  rowIndex: number;
  slotSide: "LEFT" | "RIGHT";
  updatedAt: string;
  isCustom?: boolean;
}

export interface CatalogMetadata {
  name: string;
  version: string;
  generatedAt: string;
  totalItems: number;
  totalImages: number;
  categories: string[];
  stats: Record<string, number>;
}

export interface SourceDocument {
  filename: string;
  format: string;
  totalExtracted: number;
}

export interface CatalogData {
  catalogMetadata: CatalogMetadata;
  sourceDocuments: SourceDocument[];
  products: Product[];
}

export type ViewMode = "grid" | "mural" | "boxes";
export type AppTheme = "daylight" | "dark";

export interface FilterState {
  searchQuery: string;
  selectedCategory: string;
  selectedMake: string;
  selectedSpec: string;
  viewMode: ViewMode;
  hidePrices: boolean;
  theme: AppTheme;
}
