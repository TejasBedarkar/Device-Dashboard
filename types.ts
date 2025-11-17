
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

export interface AudioStreamConfig {
  sampleRate: number;
}