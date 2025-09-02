// This is necessary to inform TypeScript about the Cytoscape library loaded from the CDN
declare const cytoscape: any;

export type CyInstance = any;
export type CyNode = any;
export type CyEdge = any;

export interface EdgeEditorState {
  visible: boolean;
  edge: CyEdge | null;
  color: string;
  thickness: number;
}

export interface NodeEditorState {
  visible: boolean;
  node: CyNode | null;
  color: string;
  size: number;
}
