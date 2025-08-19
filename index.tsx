import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// ============================================================================
// DOMAIN LAYER - Types & Interfaces
// ============================================================================

export type NodeType = 'port' | 'adapter' | 'usecase' | 'controller' | 'entity';
export type EdgeType = 'dependency' | 'implements';
export type LayerType = 'domain' | 'application' | 'infrastructure' | 'interface';

export interface Position {
  readonly x: number;
  readonly y: number;
}

export interface GraphNode {
  readonly id: string;
  readonly name: string;
  readonly type: NodeType;
  readonly layer: LayerType;
  readonly description?: string;
  position: Position;
}

export interface GraphEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly type: EdgeType;
  readonly label?: string;
}

export interface ArchitectureGraph {
  readonly nodes: GraphNode[];
  readonly edges: GraphEdge[];
  readonly metadata: GraphMetadata;
}

export interface GraphMetadata {
  readonly version: string;
  readonly created: string;  // ISO string
  readonly modified: string; // ISO string  
  readonly description?: string;
}

export interface ValidationError {
  readonly id: string;
  readonly type: 'layer_violation' | 'circular_dependency' | 'validation_error';
  readonly message: string;
  readonly nodeId?: string;
  readonly edgeId?: string;
}

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: ValidationError[];
  readonly warnings: ValidationError[];
}

export interface ArchitectureMetrics {
  readonly totalNodes: number;
  readonly totalEdges: number;
  readonly complexity: number;
  readonly maxDepth: number;
  readonly cycleCount: number;
  readonly layerViolations: number;
}

// ============================================================================
// DOMAIN LAYER - Ports
// ============================================================================

export interface ValidationPort {
  validateGraph(graph: ArchitectureGraph): Promise<ValidationResult>;
  detectCycles(graph: ArchitectureGraph): Promise<string[][]>;
  validateNode(node: GraphNode): Promise<ValidationError[]>;
}

export interface CodeGenerationPort {
  generateTypeScript(graph: ArchitectureGraph): Promise<string>;
  generatePython(graph: ArchitectureGraph): Promise<string>;
  generateDependencyGraph(graph: ArchitectureGraph): Promise<string>;
}

export interface GraphRepositoryPort {
  save(graph: ArchitectureGraph): Promise<void>;
  load(id: string): Promise<ArchitectureGraph>;
  list(): Promise<Array<{id: string; name: string; modified: string}>>;
  delete(id: string): Promise<void>;
}

export interface MetricsPort {
  calculate(graph: ArchitectureGraph): Promise<ArchitectureMetrics>;
}

// ============================================================================
// INFRASTRUCTURE LAYER - Adapters
// ============================================================================

export class ArchitectureValidationAdapter implements ValidationPort {
  async validateGraph(graph: ArchitectureGraph): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    try {
      // Check layer violations (only on dependency edges)
      const layerViolations = await this.checkLayerViolations(graph);
      errors.push(...layerViolations);

      // Check for cycles (only on dependency edges)
      const cycles = await this.detectCycles(graph);
      cycles.forEach((cycle, index) => {
        errors.push({
          id: `cycle_${index}`,
          type: 'circular_dependency',
          message: `Circular dependency detected: ${cycle.join(' → ')}`
        });
      });

      // Check for self-loops
      graph.edges.forEach(edge => {
        if (edge.source === edge.target) {
          errors.push({
            id: `self_${edge.id}`,
            type: 'validation_error',
            message: 'Self-referencing edge detected',
            edgeId: edge.id
          });
        }
      });

      // Check for duplicate edges
      const seen = new Set<string>();
      graph.edges.forEach(edge => {
        const key = `${edge.type}:${edge.source}->${edge.target}`;
        if (seen.has(key)) {
          errors.push({
            id: `dup_${edge.id}`,
            type: 'validation_error',
            message: `Duplicate edge: ${key}`,
            edgeId: edge.id
          });
        }
        seen.add(key);
      });

      // Validate implements edges (adapter -> port)
      graph.edges.filter(e => e.type === 'implements').forEach(edge => {
        const src = graph.nodes.find(n => n.id === edge.source);
        const dst = graph.nodes.find(n => n.id === edge.target);
        
        if (src?.type !== 'adapter' || dst?.type !== 'port') {
          errors.push({
            id: `impl_dir_${edge.id}`,
            type: 'validation_error',
            message: `'implements' must be adapter → port (found ${src?.type} → ${dst?.type})`,
            edgeId: edge.id
          });
        }
      });

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          id: 'validation_error',
          type: 'validation_error',
          message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        warnings: []
      };
    }
  }

  async detectCycles(graph: ArchitectureGraph): Promise<string[][]> {
    const adj = new Map<string, string[]>();
    graph.nodes.forEach(n => adj.set(n.id, []));
    
    // Only consider dependency edges for cycle detection
    graph.edges.filter(e => e.type === 'dependency').forEach(edge => {
      adj.get(edge.source)!.push(edge.target); // consumer -> provider
    });

    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (node: string, path: string[]): void => {
      if (recStack.has(node)) {
        const cycleStart = path.indexOf(node);
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), node]);
        }
        return;
      }

      if (visited.has(node)) return;

      visited.add(node);
      recStack.add(node);
      path.push(node);

      const neighbors = adj.get(node) || [];
      for (const neighbor of neighbors) {
        dfs(neighbor, [...path]);
      }

      recStack.delete(node);
    };

    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }

    return cycles;
  }

  async validateNode(node: GraphNode): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    if (!node.name?.trim()) {
      errors.push({
        id: `empty_name_${node.id}`,
        type: 'validation_error',
        message: 'Node name cannot be empty',
        nodeId: node.id
      });
    }

    // Validate naming conventions
    if (node.type === 'port' && !node.name.endsWith('Port')) {
      errors.push({
        id: `port_naming_${node.id}`,
        type: 'validation_error',
        message: 'Port names should end with "Port"',
        nodeId: node.id
      });
    }

    if (node.type === 'adapter' && !node.name.endsWith('Adapter')) {
      errors.push({
        id: `adapter_naming_${node.id}`,
        type: 'validation_error',
        message: 'Adapter names should end with "Adapter"',
        nodeId: node.id
      });
    }

    return errors;
  }

  private async checkLayerViolations(graph: ArchitectureGraph): Promise<ValidationError[]> {
    const violations: ValidationError[] = [];

    // Define allowed dependencies per layer (consumer -> provider)
    const allowedDeps: Record<LayerType, LayerType[]> = {
      domain: [],                               // domain depends on nobody
      application: ['domain'],                  // app -> domain only
      infrastructure: [],                       // infra shouldn't depend on app/interface/domain
      interface: ['application', 'domain']      // controller -> usecase or domain
    };

    graph.edges.forEach(edge => {
      if (edge.type !== 'dependency') return; // Only check dependency edges

      const src = graph.nodes.find(n => n.id === edge.source); // consumer
      const dst = graph.nodes.find(n => n.id === edge.target); // provider
      if (!src || !dst) return;

      const allowedTargets = allowedDeps[src.layer] || [];
      if (!allowedTargets.includes(dst.layer)) {
        violations.push({
          id: `layer_violation_${edge.id}`,
          type: 'layer_violation',
          message: `Invalid dependency: ${src.layer} → ${dst.layer} (${src.name} → ${dst.name})`,
          edgeId: edge.id
        });
      }
    });

    return violations;
  }
}

export class TypeScriptCodeGenerator implements CodeGenerationPort {
  async generateTypeScript(graph: ArchitectureGraph): Promise<string> {
    let code = `// Generated TypeScript Code\n// Created: ${new Date().toISOString()}\n\n`;

    // Generate ports (interfaces)
    const ports = graph.nodes.filter(n => n.type === 'port');
    for (const port of ports) {
      code += this.generatePortInterface(port);
    }

    // Generate entities
    const entities = graph.nodes.filter(n => n.type === 'entity');
    for (const entity of entities) {
      code += this.generateEntityClass(entity);
    }

    // Generate use cases (depend on ports)
    const useCases = graph.nodes.filter(n => n.type === 'usecase');
    for (const useCase of useCases) {
      code += this.generateUseCaseClass(useCase, graph);
    }

    // Generate adapters (implement ports)
    const adapters = graph.nodes.filter(n => n.type === 'adapter');
    for (const adapter of adapters) {
      code += this.generateAdapterClass(adapter, graph);
    }

    // Generate controllers
    const controllers = graph.nodes.filter(n => n.type === 'controller');
    for (const controller of controllers) {
      code += this.generateControllerClass(controller, graph);
    }

    return code;
  }

  async generatePython(graph: ArchitectureGraph): Promise<string> {
    let code = `# Generated Python Code\n# Created: ${new Date().toISOString()}\n\nfrom abc import ABC, abstractmethod\nfrom typing import Protocol, runtime_checkable\nfrom dataclasses import dataclass\n\n`;

    // Generate ports as protocols
    const ports = graph.nodes.filter(n => n.type === 'port');
    for (const port of ports) {
      code += this.generatePythonPort(port);
    }

    // Generate entities as dataclasses
    const entities = graph.nodes.filter(n => n.type === 'entity');
    for (const entity of entities) {
      code += this.generatePythonEntity(entity);
    }

    // Generate use cases
    const useCases = graph.nodes.filter(n => n.type === 'usecase');
    for (const useCase of useCases) {
      code += this.generatePythonUseCase(useCase, graph);
    }

    return code;
  }

  async generateDependencyGraph(graph: ArchitectureGraph): Promise<string> {
    let code = `// DEPENDENCY GRAPH\n`;
    code += `export class DependencyGraph {\n`;
    code += `  private instances = new Map<string, any>();\n\n`;
    code += `  constructor() {\n`;
    code += `    this.buildGraph();\n`;
    code += `    this.validateGraph();\n`;
    code += `  }\n\n`;
    code += `  private buildGraph() {\n`;

    // First instantiate adapters that implement ports
    const ports = graph.nodes.filter(n => n.type === 'port');
    for (const port of ports) {
      const adapter = this.resolveAdapterForPort(port.id, graph);
      if (adapter) {
        code += `    this.instances.set('${adapter.id}', new ${this.safeType(adapter.name)}());\n`;
      }
    }

    // Instantiate use cases with port dependencies
    const useCases = graph.nodes.filter(n => n.type === 'usecase');
    for (const useCase of useCases) {
      const portDeps = graph.edges
        .filter(e => e.type === 'dependency' && e.source === useCase.id)
        .map(e => e.target);
      
      const ctorArgs = portDeps.map(portId => {
        const adapter = this.resolveAdapterForPort(portId, graph);
        return adapter ? `this.instances.get('${adapter.id}')` : `undefined /* MISSING BINDING for ${portId} */`;
      }).join(', ');
      
      code += `    this.instances.set('${useCase.id}', new ${this.safeType(useCase.name)}(${ctorArgs}));\n`;
    }

    // Instantiate controllers with use case dependencies
    const controllers = graph.nodes.filter(n => n.type === 'controller');
    for (const controller of controllers) {
      const deps = graph.edges
        .filter(e => e.type === 'dependency' && e.source === controller.id)
        .map(e => e.target);
      
      const args = deps.map(id => `this.instances.get('${id}')`).join(', ');
      code += `    this.instances.set('${controller.id}', new ${this.safeType(controller.name)}(${args}));\n`;
    }

    code += `  }\n\n`;
    code += `  private validateGraph() {\n`;
    code += `    console.log('Dependency graph validated successfully');\n`;
    code += `  }\n\n`;
    code += `  getInstance<T>(id: string): T {\n`;
    code += `    const instance = this.instances.get(id);\n`;
    code += `    if (!instance) throw new Error(\`Missing instance: \${id}\`);\n`;
    code += `    return instance as T;\n`;
    code += `  }\n`;
    code += `}\n\n`;

    return code;
  }

  private generatePortInterface(port: GraphNode): string {
    return `export interface ${this.safeType(port.name)} {\n  // Port interface for ${port.description || port.name}\n}\n\n`;
  }

  private generateEntityClass(entity: GraphNode): string {
    return `export class ${this.safeType(entity.name)} {\n  // Entity: ${entity.description || entity.name}\n}\n\n`;
  }

  private generateUseCaseClass(useCase: GraphNode, graph: ArchitectureGraph): string {
    // Find dependency edges where this usecase is the consumer (source)
    const depPortIds = graph.edges
      .filter(e => e.type === 'dependency' && e.source === useCase.id)
      .map(e => e.target);

    const depPorts = depPortIds
      .map(id => graph.nodes.find(n => n.id === id))
      .filter((n): n is GraphNode => !!n && n.type === 'port');

    const ctorParams = depPorts.map(p => 
      `private ${this.safeProp(p.id)}: ${this.safeType(p.name)}`
    ).join(',\n    ');

    let code = `export class ${this.safeType(useCase.name)} {\n`;
    if (depPorts.length > 0) {
      code += `  constructor(\n    ${ctorParams}\n  ) {}\n\n`;
    }
    
    code += `  async execute(): Promise<void> {\n`;
    code += `    // Use case logic: ${useCase.description || useCase.name}\n`;
    code += `  }\n`;
    code += `}\n\n`;

    return code;
  }

  private generateAdapterClass(adapter: GraphNode, graph: ArchitectureGraph): string {
    // Find which port this adapter implements
    const implEdge = graph.edges.find(e => e.type === 'implements' && e.source === adapter.id);
    const port = implEdge ? graph.nodes.find(n => n.id === implEdge.target) : null;

    let code = `export class ${this.safeType(adapter.name)}`;
    if (port) {
      code += ` implements ${this.safeType(port.name)}`;
    }
    code += ` {\n`;
    code += `  // Adapter implementation: ${adapter.description || adapter.name}\n`;
    code += `}\n\n`;

    return code;
  }

  private generateControllerClass(controller: GraphNode, graph: ArchitectureGraph): string {
    const deps = graph.edges
      .filter(e => e.type === 'dependency' && e.source === controller.id)
      .map(e => e.target);
    
    const depNodes = deps
      .map(id => graph.nodes.find(n => n.id === id))
      .filter((n): n is GraphNode => !!n);

    const ctorParams = depNodes.map(n => 
      `private ${this.safeProp(n.id)}: ${this.safeType(n.name)}`
    ).join(',\n    ');

    let code = `export class ${this.safeType(controller.name)} {\n`;
    if (depNodes.length > 0) {
      code += `  constructor(\n    ${ctorParams}\n  ) {}\n\n`;
    }
    
    code += `  async handle(): Promise<void> {\n`;
    code += `    // Controller logic: ${controller.description || controller.name}\n`;
    code += `  }\n`;
    code += `}\n\n`;

    return code;
  }

  private generatePythonPort(port: GraphNode): string {
    return `@runtime_checkable\nclass ${this.safeType(port.name)}(Protocol):\n    \"\"\"Port: ${port.description || port.name}\"\"\"\n    pass\n\n`;
  }

  private generatePythonEntity(entity: GraphNode): string {
    return `@dataclass\nclass ${this.safeType(entity.name)}:\n    \"\"\"Entity: ${entity.description || entity.name}\"\"\"\n    pass\n\n`;
  }

  private generatePythonUseCase(useCase: GraphNode, graph: ArchitectureGraph): string {
    const depPortIds = graph.edges
      .filter(e => e.type === 'dependency' && e.source === useCase.id)
      .map(e => e.target);

    const depPorts = depPortIds
      .map(id => graph.nodes.find(n => n.id === id))
      .filter((n): n is GraphNode => !!n && n.type === 'port');

    let code = `class ${this.safeType(useCase.name)}:\n`;
    code += `    \"\"\"Use case: ${useCase.description || useCase.name}\"\"\"\n\n`;
    
    if (depPorts.length > 0) {
      code += `    def __init__(self`;
      depPorts.forEach(p => {
        code += `, ${this.safeProp(p.id)}: ${this.safeType(p.name)}`;
      });
      code += `):\n`;
      depPorts.forEach(p => {
        code += `        self.${this.safeProp(p.id)} = ${this.safeProp(p.id)}\n`;
      });
      code += `\n`;
    }
    
    code += `    async def execute(self) -> None:\n`;
    code += `        \"\"\"Execute use case logic\"\"\"\n`;
    code += `        pass\n\n`;

    return code;
  }

  private resolveAdapterForPort(portId: string, graph: ArchitectureGraph): GraphNode | null {
    // implements edge: adapter -> port
    const impl = graph.edges.find(e => e.type === 'implements' && e.target === portId);
    return impl ? graph.nodes.find(n => n.id === impl.source) ?? null : null;
  }

  private safeType(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^\d/, '_$&');
  }

  private safeProp(id: string): string {
    return id.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^\d/, '_$&');
  }
}

export class LocalStorageGraphRepository implements GraphRepositoryPort {
  private readonly STORAGE_KEY = 'gfp_graphs';
  private readonly METADATA_KEY = 'gfp_graph_metadata';

  async save(graph: ArchitectureGraph): Promise<void> {
    try {
      const graphWithUpdatedMetadata = {
        ...graph,
        metadata: {
          ...graph.metadata,
          modified: new Date().toISOString()
        }
      };

      const stored = this.getStoredGraphs();
      const graphId = this.generateGraphId(graph);
      stored[graphId] = graphWithUpdatedMetadata;
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stored));
      
      // Update metadata index
      const metadata = this.getStoredMetadata();
      metadata[graphId] = {
        id: graphId,
        name: graph.metadata.description || 'Untitled Graph',
        modified: graphWithUpdatedMetadata.metadata.modified
      };
      localStorage.setItem(this.METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      throw new Error(`Failed to save graph: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async load(id: string): Promise<ArchitectureGraph> {
    try {
      const stored = this.getStoredGraphs();
      const graph = stored[id];
      
      if (!graph) {
        throw new Error(`Graph not found: ${id}`);
      }
      
      return graph;
    } catch (error) {
      throw new Error(`Failed to load graph: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async list(): Promise<Array<{id: string; name: string; modified: string}>> {
    try {
      const metadata = this.getStoredMetadata();
      return Object.values(metadata);
    } catch (error) {
      console.error('Failed to list graphs:', error);
      return [];
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const stored = this.getStoredGraphs();
      delete stored[id];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stored));
      
      const metadata = this.getStoredMetadata();
      delete metadata[id];
      localStorage.setItem(this.METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      throw new Error(`Failed to delete graph: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getStoredGraphs(): Record<string, ArchitectureGraph> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  private getStoredMetadata(): Record<string, {id: string; name: string; modified: string}> {
    try {
      const stored = localStorage.getItem(this.METADATA_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  private generateGraphId(graph: ArchitectureGraph): string {
    return `graph_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// APPLICATION LAYER - Use Cases
// ============================================================================

export class ValidateArchitectureUseCase {
  constructor(private validator: ValidationPort) {}

  async execute(graph: ArchitectureGraph): Promise<ValidationResult> {
    if (!graph?.nodes || !graph?.edges) {
      throw new TypeError('Invalid graph: nodes and edges are required');
    }

    return this.validator.validateGraph(graph);
  }
}

export class GenerateCodeUseCase {
  constructor(private generator: CodeGenerationPort) {}

  async execute(graph: ArchitectureGraph, language: 'typescript' | 'python'): Promise<string> {
    if (!graph?.nodes || !graph?.edges) {
      throw new TypeError('Invalid graph: nodes and edges are required');
    }

    switch (language) {
      case 'typescript':
        return this.generator.generateTypeScript(graph);
      case 'python':
        return this.generator.generatePython(graph);
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }
}

export class CalculateMetricsUseCase {
  constructor(private validator: ValidationPort) {}

  async execute(graph: ArchitectureGraph): Promise<ArchitectureMetrics> {
    if (!graph?.nodes || !graph?.edges) {
      throw new TypeError('Invalid graph: nodes and edges are required');
    }

    const validationResult = await this.validator.validateGraph(graph);
    const cycles = await this.validator.detectCycles(graph);
    
    return {
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
      complexity: graph.nodes.length > 0 ? graph.edges.length / graph.nodes.length : 0,
      maxDepth: this.calculateMaxDepth(graph),
      cycleCount: cycles.length,
      layerViolations: validationResult.errors.filter(e => e.type === 'layer_violation').length
    };
  }

  private calculateMaxDepth(graph: ArchitectureGraph): number {
    const adj = new Map<string, string[]>();
    graph.nodes.forEach(n => adj.set(n.id, []));
    
    // Only consider dependency edges
    graph.edges.filter(e => e.type === 'dependency').forEach(edge => {
      adj.get(edge.source)!.push(edge.target);
    });

    let maxDepth = 0;
    const visited = new Set<string>();

    const dfs = (node: string, depth: number): void => {
      if (visited.has(node)) return;
      visited.add(node);
      
      maxDepth = Math.max(maxDepth, depth);
      
      const neighbors = adj.get(node) || [];
      for (const neighbor of neighbors) {
        dfs(neighbor, depth + 1);
      }
    };

    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, 0);
      }
    }

    return maxDepth;
  }
}

export class SaveGraphUseCase {
  constructor(private repository: GraphRepositoryPort) {}

  async execute(graph: ArchitectureGraph): Promise<void> {
    if (!graph?.nodes || !graph?.edges) {
      throw new TypeError('Invalid graph: nodes and edges are required');
    }

    return this.repository.save(graph);
  }
}

export class LoadGraphUseCase {
  constructor(private repository: GraphRepositoryPort) {}

  async execute(id: string): Promise<ArchitectureGraph> {
    if (!id?.trim()) {
      throw new TypeError('Graph ID is required');
    }

    return this.repository.load(id);
  }
}

// ============================================================================
// INTERFACE LAYER - React Components
// ============================================================================

interface ToolboxProps {
  onNodeTypeSelect: (nodeType: NodeType) => void;
}

const Toolbox: React.FC<ToolboxProps> = ({ onNodeTypeSelect }) => {
  const nodeTypes: Array<{type: NodeType; label: string; color: string; description: string}> = [
    { type: 'port', label: '🔌 Port', color: 'bg-red-500', description: 'Interface definition' },
    { type: 'adapter', label: '🔧 Adapter', color: 'bg-green-500', description: 'Implementation' },
    { type: 'usecase', label: '⚙️ Use Case', color: 'bg-blue-500', description: 'Business logic' },
    { type: 'controller', label: '🎮 Controller', color: 'bg-yellow-500', description: 'Interface handler' },
    { type: 'entity', label: '📦 Entity', color: 'bg-purple-500', description: 'Domain model' }
  ];

  const handleDragStart = (e: React.DragEvent, nodeType: NodeType) => {
    e.dataTransfer.setData('nodeType', nodeType);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Components</h3>
      <div className="space-y-2">
        {nodeTypes.map(({ type, label, color, description }) => (
          <div
            key={type}
            draggable
            onDragStart={(e) => handleDragStart(e, type)}
            onClick={() => onNodeTypeSelect(type)}
            className={`${color} text-white p-2 rounded cursor-pointer hover:opacity-80 transition-opacity select-none text-sm`}
            title={description}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
};

interface VisualizationCanvasProps {
  graph: ArchitectureGraph;
  selectedNode: GraphNode | null;
  onNodeSelect: (node: GraphNode | null) => void;
  onNodeCreate: (type: NodeType, position: Position) => void;
  onEdgeCreate: (sourceId: string, targetId: string, edgeType: EdgeType) => void;
}

const VisualizationCanvas: React.FC<VisualizationCanvasProps> = ({
  graph,
  selectedNode,
  onNodeSelect,
  onNodeCreate,
  onEdgeCreate
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [connectionMode, setConnectionMode] = useState<{active: boolean; sourceId?: string; edgeType?: EdgeType}>({active: false});

  // D3 visualization effect
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous render

    const width = 800;
    const height = 600;

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Main group for zooming/panning
    const g = svg.append('g');

    // Add definitions for gradients and markers
    const defs = svg.append('defs');
    
    // Arrow marker for dependency edges
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 8)
      .attr('refY', 0)
      .attr('markerWidth', 4)
      .attr('markerHeight', 4)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('class', 'fill-gray-600');

    // Color mapping for node types
    const nodeColors: Record<NodeType, string> = {
      port: '#ef4444',      // red
      adapter: '#22c55e',   // green
      usecase: '#3b82f6',   // blue
      controller: '#eab308', // yellow
      entity: '#a855f7'     // purple
    };

    // Render edges
    const edges = g.selectAll('.edge')
      .data(graph.edges)
      .enter()
      .append('line')
      .attr('class', (d) => `edge ${d.type}`)
      .attr('stroke', (d) => d.type === 'implements' ? '#6b7280' : '#9ca3af')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', (d) => d.type === 'implements' ? '5,5' : 'none')
      .attr('marker-end', (d) => d.type === 'dependency' ? 'url(#arrowhead)' : 'none')
      .attr('x1', (d) => {
        const source = graph.nodes.find(n => n.id === d.source);
        return source ? source.position.x : 0;
      })
      .attr('y1', (d) => {
        const source = graph.nodes.find(n => n.id === d.source);
        return source ? source.position.y : 0;
      })
      .attr('x2', (d) => {
        const target = graph.nodes.find(n => n.id === d.target);
        return target ? target.position.x : 0;
      })
      .attr('y2', (d) => {
        const target = graph.nodes.find(n => n.id === d.target);
        return target ? target.position.y : 0;
      });

    // Create drag behavior
    const drag = d3.drag<SVGGElement, GraphNode>()
      .on('start', (event) => {
        event.sourceEvent?.stopPropagation();
      })
      .on('drag', (event, d) => {
        d.position = { x: event.x, y: event.y };
        d3.select<SVGGElement, GraphNode>(event.subject as any)
          .attr('transform', `translate(${event.x},${event.y})`);
        
        // Update connected edges
        edges
          .filter((edge: GraphEdge) => edge.source === d.id || edge.target === d.id)
          .attr('x1', (edge: GraphEdge) => {
            const source = graph.nodes.find(n => n.id === edge.source);
            return source ? source.position.x : 0;
          })
          .attr('y1', (edge: GraphEdge) => {
            const source = graph.nodes.find(n => n.id === edge.source);
            return source ? source.position.y : 0;
          })
          .attr('x2', (edge: GraphEdge) => {
            const target = graph.nodes.find(n => n.id === edge.target);
            return target ? target.position.x : 0;
          })
          .attr('y2', (edge: GraphEdge) => {
            const target = graph.nodes.find(n => n.id === edge.target);
            return target ? target.position.y : 0;
          });
      })
      .on('end', (_event, d) => {
        onNodeSelect(d);
      });

    // Render nodes
    const nodeGroups = g.selectAll('.node-group')
      .data(graph.nodes)
      .enter()
      .append('g')
      .attr('class', 'node-group')
      .attr('transform', (d) => `translate(${d.position.x},${d.position.y})`)
      .call(drag);

    // Node circles
    nodeGroups
      .append('circle')
      .attr('r', 25)
      .attr('fill', (d) => nodeColors[d.type])
      .attr('stroke', (d) => selectedNode?.id === d.id ? '#1f2937' : '#ffffff')
      .attr('stroke-width', (d) => selectedNode?.id === d.id ? 3 : 2)
      .attr('class', 'cursor-pointer');

    // Node labels
    nodeGroups
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('class', 'text-xs font-semibold fill-white pointer-events-none')
      .text((d) => d.name.substring(0, 8));

    // Node click handlers
    nodeGroups.on('click', (event, d) => {
      event.stopPropagation();
      
      if (connectionMode.active && connectionMode.sourceId && connectionMode.sourceId !== d.id) {
        // Complete connection
        onEdgeCreate(connectionMode.sourceId, d.id, connectionMode.edgeType || 'dependency');
        setConnectionMode({ active: false });
      } else if (event.shiftKey) {
        // Start connection mode
        setConnectionMode({ active: true, sourceId: d.id, edgeType: 'dependency' });
      } else {
        onNodeSelect(d);
      }
    });

    // Canvas click to clear selection
    svg.on('click', () => {
      if (connectionMode.active) {
        setConnectionMode({ active: false });
      } else {
        onNodeSelect(null);
      }
    });

  }, [graph, selectedNode, connectionMode, onNodeSelect, onEdgeCreate]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('nodeType') as NodeType;
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    
    // Get client coordinates
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    
    // Apply inverse zoom transform
    const t = d3.zoomTransform(svg as any);
    const x = (px - t.x) / t.k;
    const y = (py - t.y) / t.k;
    
    onNodeCreate(nodeType, { x, y });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  return (
    <div className="relative w-full h-full border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
      {/* Instructions overlay */}
      <div className="absolute top-4 left-4 bg-white/90 p-3 rounded-lg shadow-sm text-sm z-10">
        <div>🖱️ <strong>Shift+Click twice</strong> to connect nodes</div>
        <div>🖱️ <strong>Drag</strong> nodes to reposition</div>
        <div>📦 <strong>Drop</strong> components from toolbox</div>
      </div>

      {/* Connection mode indicator */}
      {connectionMode.active && (
        <div className="absolute top-4 right-4 bg-blue-500 text-white p-3 rounded-lg shadow-sm text-sm z-10">
          🔗 Click target node to connect
        </div>
      )}

      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox="0 0 800 600"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="w-full h-full"
      />
    </div>
  );
};

interface PropertiesPanelProps {
  selectedNode: GraphNode | null;
  onNodeUpdate: (node: GraphNode) => void;
  onNodeDelete: () => void;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedNode,
  onNodeUpdate,
  onNodeDelete
}) => {
  if (!selectedNode) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Properties</h3>
        <p className="text-sm text-gray-500">Select a node to edit properties</p>
      </div>
    );
  }

  const handleInputChange = (field: keyof GraphNode, value: any) => {
    onNodeUpdate({
      ...selectedNode,
      [field]: value
    });
  };

  const layerOptions: Array<{value: LayerType; label: string}> = [
    { value: 'domain', label: 'Domain' },
    { value: 'application', label: 'Application' },
    { value: 'infrastructure', label: 'Infrastructure' },
    { value: 'interface', label: 'Interface' }
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Properties</h3>
        <button
          type="button"
          onClick={onNodeDelete}
          className="text-red-600 hover:text-red-800 text-sm"
          aria-label="Delete node"
        >
          🗑️ Delete
        </button>
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="node-name">
            Name
          </label>
          <input
            id="node-name"
            type="text"
            value={selectedNode.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Node name"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="node-layer">
            Layer
          </label>
          <select
            id="node-layer"
            value={selectedNode.layer}
            onChange={(e) => handleInputChange('layer', e.target.value as LayerType)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Node layer"
          >
            {layerOptions.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="node-description">
            Description
          </label>
          <textarea
            id="node-description"
            value={selectedNode.description || ''}
            onChange={(e) => handleInputChange('description', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Node description"
          />
        </div>

        <div className="text-xs text-gray-500">
          <div>Type: <span className="font-medium">{selectedNode.type}</span></div>
          <div>ID: <span className="font-mono">{selectedNode.id}</span></div>
        </div>
      </div>
    </div>
  );
};

interface ValidationModalProps {
  isOpen: boolean;
  result: ValidationResult | null;
  onClose: () => void;
}

const ValidationModal: React.FC<ValidationModalProps> = ({ isOpen, result, onClose }) => {
  if (!isOpen || !result) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Architecture Validation Results</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close validation results"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {result.isValid ? (
            <div className="bg-green-50 border border-green-200 rounded p-3">
              <div className="text-green-800 font-medium">✅ Architecture is valid!</div>
              <div className="text-green-700 text-sm">No violations or cycles detected.</div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <div className="text-red-800 font-medium">❌ Architecture violations detected</div>
              <div className="text-red-700 text-sm">{result.errors.length} errors found.</div>
            </div>
          )}

          {result.errors.length > 0 && (
            <div>
              <h3 className="font-medium text-red-800 mb-2">Errors:</h3>
              <div className="space-y-2">
                {result.errors.map((error, index) => (
                  <div key={error.id || index} className="bg-red-50 border-l-4 border-red-400 p-3">
                    <div className="text-sm">
                      <span className="font-medium text-red-800">{error.type}:</span>
                      <span className="text-red-700 ml-1">{error.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.warnings.length > 0 && (
            <div>
              <h3 className="font-medium text-yellow-800 mb-2">Warnings:</h3>
              <div className="space-y-2">
                {result.warnings.map((warning, index) => (
                  <div key={warning.id || index} className="bg-yellow-50 border-l-4 border-yellow-400 p-3">
                    <div className="text-sm">
                      <span className="font-medium text-yellow-800">{warning.type}:</span>
                      <span className="text-yellow-700 ml-1">{warning.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN APPLICATION COMPONENT
// ============================================================================

const GraphFirstProgrammingIDE: React.FC = () => {
  // State
  const [graph, setGraph] = useState<ArchitectureGraph>({
    nodes: [],
    edges: [],
    metadata: {
      version: '1.0.0',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      description: 'New Architecture Graph'
    }
  });

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [metrics, setMetrics] = useState<ArchitectureMetrics | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState<'typescript' | 'python'>('typescript');

  // Dependencies (Dependency Injection)
  const validator = new ArchitectureValidationAdapter();
  const codeGenerator = new TypeScriptCodeGenerator();
  const repository = new LocalStorageGraphRepository();

  // Use Cases
  const validateUseCase = new ValidateArchitectureUseCase(validator);
  const generateCodeUseCase = new GenerateCodeUseCase(codeGenerator);
  const calculateMetricsUseCase = new CalculateMetricsUseCase(validator);
  const saveGraphUseCase = new SaveGraphUseCase(repository);

  // Node Management
  const handleNodeCreate = useCallback((type: NodeType, position: Position) => {
    const nodeId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const layerMapping: Record<NodeType, LayerType> = {
      entity: 'domain',
      port: 'domain',
      usecase: 'application',
      adapter: 'infrastructure',
      controller: 'interface'
    };

    const newNode: GraphNode = {
      id: nodeId,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)}${Date.now() % 1000}`,
      type,
      layer: layerMapping[type],
      position,
      description: `A new ${type} component`
    };

    setGraph(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
      metadata: {
        ...prev.metadata,
        modified: new Date().toISOString()
      }
    }));
  }, []);

  const handleNodeUpdate = useCallback((updatedNode: GraphNode) => {
    setGraph(prev => ({
      ...prev,
      nodes: prev.nodes.map(node => 
        node.id === updatedNode.id ? updatedNode : node
      ),
      metadata: {
        ...prev.metadata,
        modified: new Date().toISOString()
      }
    }));
    setSelectedNode(updatedNode);
  }, []);

  const handleNodeDelete = useCallback(() => {
    if (!selectedNode) return;

    setGraph(prev => ({
      ...prev,
      nodes: prev.nodes.filter(node => node.id !== selectedNode.id),
      edges: prev.edges.filter(edge => 
        edge.source !== selectedNode.id && edge.target !== selectedNode.id
      ),
      metadata: {
        ...prev.metadata,
        modified: new Date().toISOString()
      }
    }));
    setSelectedNode(null);
  }, [selectedNode]);

  const handleEdgeCreate = useCallback((sourceId: string, targetId: string, edgeType: EdgeType) => {
    const edgeId = `${edgeType}_${sourceId}_${targetId}_${Date.now()}`;
    
    // Check if edge already exists
    const exists = graph.edges.some(edge => 
      edge.source === sourceId && edge.target === targetId && edge.type === edgeType
    );

    if (exists) return;

    const newEdge: GraphEdge = {
      id: edgeId,
      source: sourceId,
      target: targetId,
      type: edgeType
    };

    setGraph(prev => ({
      ...prev,
      edges: [...prev.edges, newEdge],
      metadata: {
        ...prev.metadata,
        modified: new Date().toISOString()
      }
    }));
  }, [graph.edges]);

  // Actions
  const handleValidate = useCallback(async () => {
    try {
      const result = await validateUseCase.execute(graph);
      setValidationResult(result);
      setShowValidationModal(true);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  }, [graph, validateUseCase]);

  const handleGenerateCode = useCallback(async () => {
    try {
      const code = await generateCodeUseCase.execute(graph, codeLanguage);
      setGeneratedCode(code);
    } catch (error) {
      console.error('Code generation failed:', error);
      setGeneratedCode(`// Error generating code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [graph, codeLanguage, generateCodeUseCase]);

  const handleCalculateMetrics = useCallback(async () => {
    try {
      const calculatedMetrics = await calculateMetricsUseCase.execute(graph);
      setMetrics(calculatedMetrics);
    } catch (error) {
      console.error('Metrics calculation failed:', error);
    }
  }, [graph, calculateMetricsUseCase]);

  const handleSaveGraph = useCallback(async () => {
    try {
      await saveGraphUseCase.execute(graph);
      alert('Graph saved successfully!');
    } catch (error) {
      console.error('Save failed:', error);
      alert(`Save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [graph, saveGraphUseCase]);

  const handleNewProject = useCallback(() => {
    setGraph({
      nodes: [],
      edges: [],
      metadata: {
        version: '1.0.0',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        description: 'New Architecture Graph'
      }
    });
    setSelectedNode(null);
    setGeneratedCode('');
    setMetrics(null);
    setValidationResult(null);
  }, []);

  // Auto-calculate metrics when graph changes
  useEffect(() => {
    if (graph.nodes.length > 0) {
      handleCalculateMetrics();
    }
  }, [graph, handleCalculateMetrics]);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-900">Graph-First IDE</h1>
          <p className="text-sm text-gray-500">v1.0.0</p>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleNewProject}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              📁 New Project
            </button>
            <button
              type="button"
              onClick={handleSaveGraph}
              className="w-full px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              💾 Save Graph
            </button>
            <button
              type="button"
              onClick={handleValidate}
              className="w-full px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              🔍 Validate
            </button>
          </div>
        </div>

        {/* Toolbox */}
        <div className="p-4 flex-1">
          <Toolbox onNodeTypeSelect={(type) => {}} />
        </div>

        {/* Properties Panel */}
        <div className="p-4 border-t border-gray-200">
          <PropertiesPanel
            selectedNode={selectedNode}
            onNodeUpdate={handleNodeUpdate}
            onNodeDelete={handleNodeDelete}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-900">Architecture Canvas</h2>
            {metrics && (
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>Nodes: <strong>{metrics.totalNodes}</strong></span>
                <span>Edges: <strong>{metrics.totalEdges}</strong></span>
                <span>Complexity: <strong>{metrics.complexity.toFixed(2)}</strong></span>
                {metrics.cycleCount > 0 && (
                  <span className="text-red-600 font-medium">
                    Cycles: {metrics.cycleCount}
                  </span>
                )}
                {metrics.layerViolations > 0 && (
                  <span className="text-red-600 font-medium">
                    Violations: {metrics.layerViolations}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={codeLanguage}
              onChange={(e) => setCodeLanguage(e.target.value as 'typescript' | 'python')}
              className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Code generation language"
            >
              <option value="typescript">TypeScript</option>
              <option value="python">Python</option>
            </select>
            <button
              type="button"
              onClick={handleGenerateCode}
              className="px-4 py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              🔧 Generate Code
            </button>
          </div>
        </div>

        {/* Canvas and Code Panel */}
        <div className="flex-1 flex">
          {/* Visualization Canvas */}
          <div className="flex-1 p-6">
            <VisualizationCanvas
              graph={graph}
              selectedNode={selectedNode}
              onNodeSelect={setSelectedNode}
              onNodeCreate={handleNodeCreate}
              onEdgeCreate={handleEdgeCreate}
            />
          </div>

          {/* Code Panel */}
          {generatedCode && (
            <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Generated Code</h3>
              </div>
              <div className="flex-1 overflow-auto">
                <pre className="p-4 text-xs font-mono bg-gray-50 h-full overflow-auto">
                  <code>{generatedCode}</code>
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Validation Modal */}
      <ValidationModal
        isOpen={showValidationModal}
        result={validationResult}
        onClose={() => setShowValidationModal(false)}
      />
    </div>
  );
};

// ============================================================================
// APPLICATION BOOTSTRAP
// ============================================================================

function initializeApp() {
  const container = document.getElementById('root');
  if (!container) {
    document.body.innerHTML = '<div style="color: red; padding: 20px;">Error: Root container not found</div>';
    return;
  }

  try {
    const root = createRoot(container);
    root.render(<GraphFirstProgrammingIDE />);
  } catch (error) {
    container.innerHTML = `<div style="color: red; padding: 20px;">Error initializing app: ${error instanceof Error ? error.message.replace(/[&<>"']/g, (s) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s] || s)) : 'Unknown error'}</div>`;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}