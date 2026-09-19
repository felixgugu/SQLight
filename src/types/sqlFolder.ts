export interface SqlFileNode {
  name: string;
  path: string;
  is_dir: boolean;
  size?: number;
  modified_time?: string;
  children?: SqlFileNode[];
}

export interface MonitoredFolder {
  id: string;
  name: string;
  path: string;
  addedAt: string;
}
