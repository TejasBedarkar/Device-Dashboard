export enum AppState {
  IDLE = 'IDLE',
  INITIALIZING = 'INITIALIZING',
  SCANNING = 'SCANNING',
  DASHBOARD = 'DASHBOARD',
  ACTIVE = 'ACTIVE',
  ERROR = 'ERROR',
}

export interface LaptopSpecs {
  modelName: string;
  os: string;
  processor: string;
  ram: string;
  gpu: string;
  resolution: string;
  browser: string;
  battery?: string;
  weight?: string;
  price?: string;
  timestamp?: string;
}

export interface SystemScan {
  cpu: string;
  ram: string;
  gpu?: string;
  model: string;
  manufacturer?: string;
  os?: string;
}

export interface DetailedSpecs {
  laptop_model: string;
  brand: string;
  series: string;
  release_year: string;
  cpu: string;
  gpu: string;
  ram_options: string;
  max_ram_supported: string;
  storage_options: string;
  display: string;
  battery: string;
  weight: string;
  dimensions: string;
  ports: string;
  os: string;
  connectivity: string;
  webcam: string;
  keyboard: string;
  build_quality: string;
  typical_price_range: string;
}

export interface FullLaptopSpecs {
  from_scan: SystemScan;
  specifications: DetailedSpecs | null;
  error: string | null;
  timestamp: string;
}

export interface AudioStreamConfig {
  sampleRate: number;
}