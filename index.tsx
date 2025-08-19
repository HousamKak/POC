import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  readonly created: string;
  readonly modified: string;
  readonly description?: string;
}

export interface ValidationError {
  readonly id: string;
  readonly type: 'layer_violation' | 'circular_dependency' | 'validation_error' | 'naming_violation';
  readonly message: string;
  readonly nodeId?: string;
  readonly edgeId?: string;
  readonly severity: 'error' | 'warning';
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
  calculateMetrics(graph: ArchitectureGraph): Promise<ArchitectureMetrics>;
}

// ============================================================================
// APPLICATION LAYER - Use Cases
// ============================================================================

export class ArchitectureValidationUseCase {
  constructor(private validationAdapter: ValidationPort) {
    if (!validationAdapter) {
      throw new TypeError('ValidationPort is required');
    }
  }

  async execute(graph: ArchitectureGraph): Promise<ValidationResult> {
    if (!graph?.nodes || !graph?.edges) {
      throw new TypeError('Invalid graph: nodes and edges are required');
    }

    try {
      return await this.validationAdapter.validateGraph(graph);
    } catch (error) {
      throw new Error(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export class CodeGenerationUseCase {
  constructor(private codeGenAdapter: CodeGenerationPort) {
    if (!codeGenAdapter) {
      throw new TypeError('CodeGenerationPort is required');
    }
  }

  async generateCode(graph: ArchitectureGraph, language: 'typescript' | 'python'): Promise<string> {
    if (!graph?.nodes || !Array.isArray(graph.nodes)) {
      throw new TypeError('Invalid graph: nodes array is required');
    }

    try {
      switch (language) {
        case 'typescript':
          return await this.codeGenAdapter.generateTypeScript(graph);
        case 'python':
          return await this.codeGenAdapter.generatePython(graph);
        default:
          throw new Error(`Unsupported language: ${language as string}`);
      }
    } catch (error) {
      throw new Error(`Code generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export class MetricsCalculationUseCase {
  constructor(private metricsAdapter: MetricsPort) {
    if (!metricsAdapter) {
      throw new TypeError('MetricsPort is required');
    }
  }

  async execute(graph: ArchitectureGraph): Promise<ArchitectureMetrics> {
    if (!graph?.nodes || !graph?.edges) {
      throw new TypeError('Invalid graph: nodes and edges are required');
    }

    try {
      return await this.metricsAdapter.calculateMetrics(graph);
    } catch (error) {
      throw new Error(`Metrics calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// ============================================================================
// INFRASTRUCTURE LAYER - Adapters
// ============================================================================

export class ArchitectureValidationAdapter implements ValidationPort {
  async validateGraph(graph: ArchitectureGraph): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    try {
      // Check layer violations
      const layerViolations = await this.checkLayerViolations(graph);
      errors.push(...layerViolations.filter(v => v.severity === 'error'));
      warnings.push(...layerViolations.filter(v => v.severity === 'warning'));

      // Check for cycles
      const cycles = await this.detectCycles(graph);
      cycles.forEach((cycle, index) => {
        errors.push({
          id: `cycle_${index}`,
          type: 'circular_dependency',
          message: `Circular dependency detected: ${cycle.join(' → ')}`,
          severity: 'error'
        });
      });

      // Validate naming conventions
      for (const node of graph.nodes) {
        const namingErrors = await this.validateNode(node);
        errors.push(...namingErrors.filter(e => e.severity === 'error'));
        warnings.push(...namingErrors.filter(e => e.severity === 'warning'));
      }

      // Check for self-loops
      graph.edges.forEach(edge => {
        if (edge.source === edge.target) {
          errors.push({
            id: `self_${edge.id}`,
            type: 'validation_error',
            message: 'Self-referencing edge detected',
            edgeId: edge.id,
            severity: 'error'
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
          message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error'
        }],
        warnings: []
      };
    }
  }

  async detectCycles(graph: ArchitectureGraph): Promise<string[][]> {
    const adj = new Map<string, string[]>();
    graph.nodes.forEach(n => adj.set(n.id, []));
    
    // Only consider dependency edges for cycle detection
    graph.edges
      .filter(e => e.type === 'dependency')
      .forEach(edge => {
        const sources = adj.get(edge.source);
        if (sources) {
          sources.push(edge.target);
        }
      });

    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (node: string, path: string[]): void => {
      if (recursionStack.has(node)) {
        const cycleStart = path.indexOf(node);
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), node]);
        }
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = adj.get(node) ?? [];
      for (const neighbor of neighbors) {
        dfs(neighbor, [...path]);
      }

      recursionStack.delete(node);
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

    // Validate naming conventions
    if (node.type === 'port' && !node.name.endsWith('Port')) {
      errors.push({
        id: `port_naming_${node.id}`,
        type: 'naming_violation',
        message: 'Port names should end with "Port"',
        nodeId: node.id,
        severity: 'warning'
      });
    }

    if (node.type === 'adapter' && !node.name.endsWith('Adapter')) {
      errors.push({
        id: `adapter_naming_${node.id}`,
        type: 'naming_violation',
        message: 'Adapter names should end with "Adapter"',
        nodeId: node.id,
        severity: 'warning'
      });
    }

    if (node.type === 'usecase' && !node.name.endsWith('UseCase')) {
      errors.push({
        id: `usecase_naming_${node.id}`,
        type: 'naming_violation',
        message: 'Use case names should end with "UseCase"',
        nodeId: node.id,
        severity: 'warning'
      });
    }

    // Validate layer consistency
    const expectedLayer = this.getExpectedLayer(node.type);
    if (node.layer !== expectedLayer) {
      errors.push({
        id: `layer_consistency_${node.id}`,
        type: 'layer_violation',
        message: `${node.type} should be in ${expectedLayer} layer, not ${node.layer}`,
        nodeId: node.id,
        severity: 'error'
      });
    }

    return errors;
  }

  private async checkLayerViolations(graph: ArchitectureGraph): Promise<ValidationError[]> {
    const violations: ValidationError[] = [];

    // Define allowed dependencies per layer
    const allowedDeps: Record<LayerType, LayerType[]> = {
      domain: [],
      application: ['domain'],
      infrastructure: ['domain', 'application'],
      interface: ['application', 'domain']
    };

    graph.edges.forEach(edge => {
      if (edge.type !== 'dependency') return;

      const src = graph.nodes.find(n => n.id === edge.source);
      const dst = graph.nodes.find(n => n.id === edge.target);
      if (!src || !dst) return;

      const allowedTargets = allowedDeps[src.layer] ?? [];
      if (!allowedTargets.includes(dst.layer)) {
        violations.push({
          id: `layer_violation_${edge.id}`,
          type: 'layer_violation',
          message: `Invalid dependency: ${src.layer} → ${dst.layer} (${src.name} → ${dst.name})`,
          edgeId: edge.id,
          severity: 'error'
        });
      }
    });

    return violations;
  }

  private getExpectedLayer(nodeType: NodeType): LayerType {
    const typeToLayer: Record<NodeType, LayerType> = {
      entity: 'domain',
      port: 'domain',
      usecase: 'application',
      adapter: 'infrastructure',
      controller: 'interface'
    };
    return typeToLayer[nodeType];
  }
}

export class TypeScriptCodeGenerationAdapter implements CodeGenerationPort {
  async generateTypeScript(graph: ArchitectureGraph): Promise<string> {
    if (!graph?.nodes || !Array.isArray(graph.nodes)) {
      throw new TypeError('Invalid graph: nodes array is required');
    }

    const parts: string[] = [];
    
    // Header
    parts.push('// Generated by Graph-First Programming IDE');
    parts.push(`// Generated at: ${new Date().toISOString()}`);
    parts.push('');

    // Imports
    parts.push('// Domain imports');
    parts.push('');

    // Generate interfaces for ports
    const ports = graph.nodes.filter(n => n.type === 'port');
    if (ports.length > 0) {
      parts.push('// ============================================================================');
      parts.push('// PORTS (Domain Layer)');
      parts.push('// ============================================================================');
      parts.push('');

      for (const port of ports) {
        parts.push(`/**`);
        parts.push(` * ${port.description ?? `Port interface for ${port.name}`}`);
        parts.push(` */`);
        parts.push(`export interface ${port.name} {`);
        parts.push('  // TODO: Add method signatures');
        parts.push('}');
        parts.push('');
      }
    }

    // Generate classes for entities
    const entities = graph.nodes.filter(n => n.type === 'entity');
    if (entities.length > 0) {
      parts.push('// ============================================================================');
      parts.push('// ENTITIES (Domain Layer)');
      parts.push('// ============================================================================');
      parts.push('');

      for (const entity of entities) {
        parts.push(`/**`);
        parts.push(` * ${entity.description ?? `Domain entity: ${entity.name}`}`);
        parts.push(` */`);
        parts.push(`export class ${entity.name} {`);
        parts.push('  // TODO: Add properties and methods');
        parts.push('}');
        parts.push('');
      }
    }

    // Generate use cases
    const usecases = graph.nodes.filter(n => n.type === 'usecase');
    if (usecases.length > 0) {
      parts.push('// ============================================================================');
      parts.push('// USE CASES (Application Layer)');
      parts.push('// ============================================================================');
      parts.push('');

      for (const usecase of usecases) {
        const dependencies = this.getUseCaseDependencies(usecase, graph);
        const constructorParams = dependencies.map(dep => `private ${this.toCamelCase(dep.name)}: ${dep.name}`).join(', ');
        
        parts.push(`/**`);
        parts.push(` * ${usecase.description ?? `Use case: ${usecase.name}`}`);
        parts.push(` */`);
        parts.push(`export class ${usecase.name} {`);
        if (dependencies.length > 0) {
          parts.push(`  constructor(${constructorParams}) {}`);
          parts.push('');
        }
        parts.push('  async execute(): Promise<void> {');
        parts.push('    // TODO: Implement use case logic');
        parts.push('  }');
        parts.push('}');
        parts.push('');
      }
    }

    // Generate adapters
    const adapters = graph.nodes.filter(n => n.type === 'adapter');
    if (adapters.length > 0) {
      parts.push('// ============================================================================');
      parts.push('// ADAPTERS (Infrastructure Layer)');
      parts.push('// ============================================================================');
      parts.push('');

      for (const adapter of adapters) {
        const implementedPorts = this.getImplementedPorts(adapter, graph);
        const implementsClause = implementedPorts.length > 0 
          ? ` implements ${implementedPorts.map(p => p.name).join(', ')}`
          : '';

        parts.push(`/**`);
        parts.push(` * ${adapter.description ?? `Adapter implementation: ${adapter.name}`}`);
        parts.push(` */`);
        parts.push(`export class ${adapter.name}${implementsClause} {`);
        parts.push('  // TODO: Implement adapter methods');
        parts.push('}');
        parts.push('');
      }
    }

    // Generate controllers
    const controllers = graph.nodes.filter(n => n.type === 'controller');
    if (controllers.length > 0) {
      parts.push('// ============================================================================');
      parts.push('// CONTROLLERS (Interface Layer)');
      parts.push('// ============================================================================');
      parts.push('');

      for (const controller of controllers) {
        const dependencies = this.getControllerDependencies(controller, graph);
        const constructorParams = dependencies.map(dep => `private ${this.toCamelCase(dep.name)}: ${dep.name}`).join(', ');

        parts.push(`/**`);
        parts.push(` * ${controller.description ?? `Controller: ${controller.name}`}`);
        parts.push(` */`);
        parts.push(`export class ${controller.name} {`);
        if (dependencies.length > 0) {
          parts.push(`  constructor(${constructorParams}) {}`);
          parts.push('');
        }
        parts.push('  // TODO: Add controller methods');
        parts.push('}');
        parts.push('');
      }
    }

    return parts.join('\n');
  }

  async generatePython(graph: ArchitectureGraph): Promise<string> {
    if (!graph?.nodes || !Array.isArray(graph.nodes)) {
      throw new TypeError('Invalid graph: nodes array is required');
    }

    const parts: string[] = [];
    
    // Header
    parts.push('# Generated by Graph-First Programming IDE');
    parts.push(`# Generated at: ${new Date().toISOString()}`);
    parts.push('');
    parts.push('from abc import ABC, abstractmethod');
    parts.push('from typing import Protocol, runtime_checkable');
    parts.push('');

    // Generate protocols for ports
    const ports = graph.nodes.filter(n => n.type === 'port');
    if (ports.length > 0) {
      parts.push('# ============================================================================');
      parts.push('# PORTS (Domain Layer)');
      parts.push('# ============================================================================');
      parts.push('');

      for (const port of ports) {
        parts.push(`@runtime_checkable`);
        parts.push(`class ${port.name}(Protocol):`);
        parts.push(`    """${port.description ?? `Port interface for ${port.name}`}"""`);
        parts.push('    # TODO: Add method signatures');
        parts.push('    pass');
        parts.push('');
      }
    }

    return parts.join('\n');
  }

  async generateDependencyGraph(graph: ArchitectureGraph): Promise<string> {
    // Generate DOT format for Graphviz
    const parts: string[] = [];
    parts.push('digraph ArchitectureGraph {');
    parts.push('  rankdir=TB;');
    parts.push('  node [shape=box, style=filled];');
    parts.push('');

    // Add nodes
    graph.nodes.forEach(node => {
      const color = this.getNodeColor(node.type);
      parts.push(`  "${node.name}" [fillcolor="${color}", label="${node.name}\\n(${node.type})"];`);
    });

    parts.push('');

    // Add edges
    graph.edges.forEach(edge => {
      const src = graph.nodes.find(n => n.id === edge.source);
      const dst = graph.nodes.find(n => n.id === edge.target);
      if (src && dst) {
        const style = edge.type === 'implements' ? 'dashed' : 'solid';
        parts.push(`  "${src.name}" -> "${dst.name}" [style=${style}];`);
      }
    });

    parts.push('}');
    return parts.join('\n');
  }

  private getUseCaseDependencies(usecase: GraphNode, graph: ArchitectureGraph): GraphNode[] {
    return graph.edges
      .filter(e => e.source === usecase.id && e.type === 'dependency')
      .map(e => graph.nodes.find(n => n.id === e.target))
      .filter((n): n is GraphNode => n !== undefined);
  }

  private getImplementedPorts(adapter: GraphNode, graph: ArchitectureGraph): GraphNode[] {
    return graph.edges
      .filter(e => e.source === adapter.id && e.type === 'implements')
      .map(e => graph.nodes.find(n => n.id === e.target))
      .filter((n): n is GraphNode => n !== undefined);
  }

  private getControllerDependencies(controller: GraphNode, graph: ArchitectureGraph): GraphNode[] {
    return graph.edges
      .filter(e => e.source === controller.id && e.type === 'dependency')
      .map(e => graph.nodes.find(n => n.id === e.target))
      .filter((n): n is GraphNode => n !== undefined);
  }

  private toCamelCase(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  private getNodeColor(type: NodeType): string {
    const colors: Record<NodeType, string> = {
      port: 'lightcoral',
      adapter: 'lightgreen',
      usecase: 'lightblue',
      controller: 'lightyellow',
      entity: 'plum'
    };
    return colors[type];
  }
}

export class MetricsAdapter implements MetricsPort {
  async calculateMetrics(graph: ArchitectureGraph): Promise<ArchitectureMetrics> {
    if (!graph?.nodes || !graph?.edges) {
      throw new TypeError('Invalid graph: nodes and edges are required');
    }

    const validationAdapter = new ArchitectureValidationAdapter();
    const cycles = await validationAdapter.detectCycles(graph);
    const validationResult = await validationAdapter.validateGraph(graph);

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
    
    graph.edges
      .filter(e => e.type === 'dependency')
      .forEach(edge => {
        const sources = adj.get(edge.source);
        if (sources) {
          sources.push(edge.target);
        }
      });

    let maxDepth = 0;
    const visited = new Set<string>();

    const dfs = (node: string, depth: number): void => {
      if (visited.has(node)) return;
      visited.add(node);
      
      maxDepth = Math.max(maxDepth, depth);
      
      const neighbors = adj.get(node) ?? [];
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

export class LocalStorageGraphRepository implements GraphRepositoryPort {
  private readonly storageKey = 'graph-first-ide-graphs';

  async save(graph: ArchitectureGraph): Promise<void> {
    if (!graph?.nodes || !graph?.edges) {
      throw new TypeError('Invalid graph: nodes and edges are required');
    }

    try {
      const updatedGraph: ArchitectureGraph = {
        ...graph,
        metadata: {
          ...graph.metadata,
          modified: new Date().toISOString()
        }
      };

      const existingGraphs = await this.getAllGraphs();
      const graphId = graph.metadata.description ?? 'default';
      existingGraphs[graphId] = updatedGraph;
      
      localStorage.setItem(this.storageKey, JSON.stringify(existingGraphs));
    } catch (error) {
      throw new Error(`Failed to save graph: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async load(id: string): Promise<ArchitectureGraph> {
    if (!id?.trim()) {
      throw new TypeError('Graph ID is required');
    }

    try {
      const graphs = await this.getAllGraphs();
      const graph = graphs[id];
      
      if (!graph) {
        throw new Error(`Graph with ID '${id}' not found`);
      }

      return graph;
    } catch (error) {
      throw new Error(`Failed to load graph: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async list(): Promise<Array<{id: string; name: string; modified: string}>> {
    try {
      const graphs = await this.getAllGraphs();
      return Object.entries(graphs).map(([id, graph]) => ({
        id,
        name: graph.metadata.description ?? id,
        modified: graph.metadata.modified
      }));
    } catch (error) {
      throw new Error(`Failed to list graphs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async delete(id: string): Promise<void> {
    if (!id?.trim()) {
      throw new TypeError('Graph ID is required');
    }

    try {
      const graphs = await this.getAllGraphs();
      if (!(id in graphs)) {
        throw new Error(`Graph with ID '${id}' not found`);
      }

      delete graphs[id];
      localStorage.setItem(this.storageKey, JSON.stringify(graphs));
    } catch (error) {
      throw new Error(`Failed to delete graph: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getAllGraphs(): Promise<Record<string, ArchitectureGraph>> {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) as Record<string, ArchitectureGraph> : {};
    } catch (error) {
      console.warn('Failed to parse stored graphs, returning empty object:', error);
      return {};
    }
  }
}

// ============================================================================
// INTERFACE LAYER - React Components
// ============================================================================

interface ToolboxProps {
  readonly onNodeTypeSelect: (nodeType: NodeType) => void;
}

const Toolbox: React.FC<ToolboxProps> = ({ onNodeTypeSelect }) => {
  const nodeTypes: ReadonlyArray<{
    readonly type: NodeType;
    readonly label: string;
    readonly color: string;
    readonly description: string;
  }> = [
    { type: 'port', label: '🔌 Port', color: 'bg-red-500', description: 'Interface definition' },
    { type: 'adapter', label: '🔧 Adapter', color: 'bg-green-500', description: 'Implementation' },
    { type: 'usecase', label: '⚙️ Use Case', color: 'bg-blue-500', description: 'Business logic' },
    { type: 'controller', label: '🎮 Controller', color: 'bg-yellow-500', description: 'Interface handler' },
    { type: 'entity', label: '📦 Entity', color: 'bg-purple-500', description: 'Domain model' }
  ];

  const handleDragStart = useCallback((e: React.DragEvent, nodeType: NodeType) => {
    if (!nodeType) {
      console.warn('Invalid node type for drag operation');
      return;
    }
    e.dataTransfer.setData('text/plain', nodeType);
  }, []);

  return (
    <div className="w-64 bg-white border-r border-gray-200 p-4">
      <h3 className="font-semibold text-gray-900 mb-4">Components</h3>
      <div className="space-y-2">
        {nodeTypes.map(({ type, label, color, description }) => (
          <div
            key={type}
            draggable
            onDragStart={(e) => handleDragStart(e, type)}
            onClick={() => onNodeTypeSelect(type)}
            className={`${color} text-white p-3 rounded cursor-pointer hover:opacity-80 transition-opacity`}
            title={description}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onNodeTypeSelect(type);
              }
            }}
          >
            <div className="font-medium">{label}</div>
            <div className="text-xs opacity-90">{description}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface GraphVisualizationProps {
  readonly graph: ArchitectureGraph;
  readonly selectedNode: GraphNode | null;
  readonly onNodeSelect: (node: GraphNode | null) => void;
  readonly onNodeCreate: (type: NodeType, position: Position) => void;
  readonly onEdgeCreate: (sourceId: string, targetId: string, type: EdgeType) => void;
}

const GraphVisualization: React.FC<GraphVisualizationProps> = ({
  graph,
  selectedNode,
  onNodeSelect,
  onNodeCreate,
  onEdgeCreate
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggedNodeType, setDraggedNodeType] = useState<NodeType | null>(null);
  const [connectionMode, setConnectionMode] = useState<{
    sourceId: string;
    sourceType: NodeType;
  } | null>(null);

  // Memoize node and edge data for D3
  const nodeData = useMemo(() => graph.nodes.map(node => ({
    ...node,
    x: node.position.x,
    y: node.position.y
  })), [graph.nodes]);

  const edgeData = useMemo(() => graph.edges.map(edge => {
    const source = graph.nodes.find(n => n.id === edge.source);
    const target = graph.nodes.find(n => n.id === edge.target);
    return {
      ...edge,
      source: source ? { ...source, x: source.position.x, y: source.position.y } : null,
      target: target ? { ...target, x: target.position.x, y: target.position.y } : null
    };
  }).filter(edge => edge.source && edge.target), [graph.nodes, graph.edges]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 800;
    const height = 600;

    // Set SVG dimensions
    svg.attr('width', width).attr('height', height);

    // Create main group for zoom/pan
    const g = svg.append('g');

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });

    svg.call(zoom);

    // Draw edges
    g.selectAll('.edge')
      .data(edgeData)
      .enter()
      .append('line')
      .attr('class', 'edge')
      .attr('x1', d => d.source?.x ?? 0)
      .attr('y1', d => d.source?.y ?? 0)
      .attr('x2', d => d.target?.x ?? 0)
      .attr('y2', d => d.target?.y ?? 0)
      .attr('stroke', '#666')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', d => d.type === 'implements' ? '5,5' : '0')
      .attr('marker-end', 'url(#arrowhead)');

    // Add arrow marker
    svg.append('defs')
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 13)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 13)
      .attr('markerHeight', 13)
      .attr('xoverflow', 'visible')
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#666')
      .style('stroke', 'none');

    // Draw nodes
    const nodes = g.selectAll('.node')
      .data(nodeData)
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .style('cursor', 'pointer');

    // Node circles
    nodes.append('circle')
      .attr('r', 30)
      .attr('fill', d => getNodeColor(d.type))
      .attr('stroke', d => selectedNode?.id === d.id ? '#000' : '#666')
      .attr('stroke-width', d => selectedNode?.id === d.id ? 3 : 1);

    // Node labels
    nodes.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .style('font-size', '12px')
      .style('fill', 'white')
      .style('font-weight', 'bold')
      .text(d => d.name.length > 8 ? `${d.name.slice(0, 8)}...` : d.name);

    // Node click handlers
    nodes.on('click', (event, d) => {
      event.stopPropagation();
      
      if (connectionMode) {
        // Create edge
        if (connectionMode.sourceId !== d.id) {
          const edgeType: EdgeType = connectionMode.sourceType === 'adapter' && d.type === 'port' 
            ? 'implements' 
            : 'dependency';
          onEdgeCreate(connectionMode.sourceId, d.id, edgeType);
        }
        setConnectionMode(null);
      } else if (event.shiftKey) {
        // Start connection mode
        setConnectionMode({ sourceId: d.id, sourceType: d.type });
      } else {
        // Select node
        onNodeSelect(d);
      }
    });

    // Canvas click handler
    svg.on('click', () => {
      onNodeSelect(null);
      setConnectionMode(null);
    });

  }, [graph, selectedNode, connectionMode, onNodeSelect, onEdgeCreate, nodeData, edgeData]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!svgRef.current || !draggedNodeType) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    onNodeCreate(draggedNodeType, { x, y });
    setDraggedNodeType(null);
  }, [draggedNodeType, onNodeCreate]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('text/plain') as NodeType;
    setDraggedNodeType(nodeType);
  }, []);

  return (
    <div className="flex-1 relative">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        className="border border-gray-300"
      />
      {connectionMode && (
        <div className="absolute top-4 left-4 bg-blue-100 border border-blue-300 rounded p-2">
          <p className="text-sm text-blue-800">
            Connection mode: Click target node to create edge
          </p>
          <button
            onClick={() => setConnectionMode(null)}
            className="text-xs text-blue-600 underline"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

const getNodeColor = (type: NodeType): string => {
  const colors: Record<NodeType, string> = {
    port: '#ef4444',      // red
    adapter: '#22c55e',   // green
    usecase: '#3b82f6',   // blue
    controller: '#eab308', // yellow
    entity: '#a855f7'     // purple
  };
  return colors[type];
};

interface ValidationModalProps {
  readonly isOpen: boolean;
  readonly result: ValidationResult | null;
  readonly onClose: () => void;
}

const ValidationModal: React.FC<ValidationModalProps> = ({ isOpen, result, onClose }) => {
  if (!isOpen || !result) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Architecture Validation Results
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>

          <div className="mb-4">
            <div className={`p-3 rounded ${result.isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              <span className="font-medium">
                {result.isValid ? '✓ Valid Architecture' : '✗ Validation Failed'}
              </span>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="mb-4">
              <h3 className="font-medium text-red-800 mb-2">Errors ({result.errors.length})</h3>
              <div className="space-y-2">
                {result.errors.map((error, index) => (
                  <div key={`error-${index}`} className="flex items-start space-x-2 p-2 bg-red-50 rounded">
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
            <div className="mb-4">
              <h3 className="font-medium text-yellow-800 mb-2">Warnings ({result.warnings.length})</h3>
              <div className="space-y-2">
                {result.warnings.map((warning, index) => (
                  <div key={`warning-${index}`} className="flex items-start space-x-2 p-2 bg-yellow-50 rounded">
                    <div className="text-sm">
                      <span className="font-medium text-yellow-800">{warning.type}:</span>
                      <span className="text-yellow-700 ml-1">{warning.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
    </div>
  );
};

// ============================================================================
// MAIN APPLICATION COMPONENT
// ============================================================================

const GraphFirstProgrammingIDE: React.FC = () => {
  // Initialize adapters
  const validationAdapter = useMemo(() => new ArchitectureValidationAdapter(), []);
  const codeGenAdapter = useMemo(() => new TypeScriptCodeGenerationAdapter(), []);
  const metricsAdapter = useMemo(() => new MetricsAdapter(), []);
  const repositoryAdapter = useMemo(() => new LocalStorageGraphRepository(), []);

  // Initialize use cases
  const validationUseCase = useMemo(() => new ArchitectureValidationUseCase(validationAdapter), [validationAdapter]);
  const codeGenUseCase = useMemo(() => new CodeGenerationUseCase(codeGenAdapter), [codeGenAdapter]);
  const metricsUseCase = useMemo(() => new MetricsCalculationUseCase(metricsAdapter), [metricsAdapter]);

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handlers
  const handleNodeCreate = useCallback((type: NodeType, position: Position) => {
    try {
      const nodeId = `${type}_${Date.now()}`;
      const nodeName = `${type.charAt(0).toUpperCase()}${type.slice(1)}${graph.nodes.filter(n => n.type === type).length + 1}`;
      
      // Determine layer based on node type
      const getLayer = (nodeType: NodeType): LayerType => {
        const typeToLayer: Record<NodeType, LayerType> = {
          entity: 'domain',
          port: 'domain',
          usecase: 'application',
          adapter: 'infrastructure',
          controller: 'interface'
        };
        return typeToLayer[nodeType];
      };

      const newNode: GraphNode = {
        id: nodeId,
        name: nodeName,
        type,
        layer: getLayer(type),
        position,
        description: `Generated ${type} component`
      };

      setGraph(prev => ({
        ...prev,
        nodes: [...prev.nodes, newNode],
        metadata: {
          ...prev.metadata,
          modified: new Date().toISOString()
        }
      }));

      setError(null);
    } catch (err) {
      setError(`Failed to create node: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [graph.nodes]);

  const handleEdgeCreate = useCallback((sourceId: string, targetId: string, type: EdgeType) => {
    try {
      // Validate edge doesn't already exist
      const existingEdge = graph.edges.find(e => 
        e.source === sourceId && e.target === targetId && e.type === type
      );
      
      if (existingEdge) {
        setError('Edge already exists between these nodes');
        return;
      }

      const edgeId = `${sourceId}_${targetId}_${type}_${Date.now()}`;
      const newEdge: GraphEdge = {
        id: edgeId,
        source: sourceId,
        target: targetId,
        type
      };

      setGraph(prev => ({
        ...prev,
        edges: [...prev.edges, newEdge],
        metadata: {
          ...prev.metadata,
          modified: new Date().toISOString()
        }
      }));

      setError(null);
    } catch (err) {
      setError(`Failed to create edge: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [graph.edges]);

  const handleValidate = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await validationUseCase.execute(graph);
      setValidationResult(result);
      setShowValidationModal(true);
    } catch (err) {
      setError(`Validation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [graph, validationUseCase]);

  const handleGenerateCode = useCallback(async (language: 'typescript' | 'python' = 'typescript') => {
    try {
      setIsLoading(true);
      setError(null);
      
      const code = await codeGenUseCase.generateCode(graph, language);
      setGeneratedCode(code);
    } catch (err) {
      setError(`Code generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [graph, codeGenUseCase]);

  const handleCalculateMetrics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const calculatedMetrics = await metricsUseCase.execute(graph);
      setMetrics(calculatedMetrics);
    } catch (err) {
      setError(`Metrics calculation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [graph, metricsUseCase]);

  const handleSaveGraph = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await repositoryAdapter.save(graph);
      setError(null);
    } catch (err) {
      setError(`Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [graph, repositoryAdapter]);

  const handleClearGraph = useCallback(() => {
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
    setError(null);
  }, []);

  // Auto-calculate metrics when graph changes
  useEffect(() => {
    if (graph.nodes.length > 0) {
      handleCalculateMetrics();
    }
  }, [graph, handleCalculateMetrics]);

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Graph-First Programming IDE</h1>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleValidate}
              disabled={isLoading}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Validating...' : '🔍 Validate'}
            </button>
            
            <button
              onClick={() => handleGenerateCode('typescript')}
              disabled={isLoading || graph.nodes.length === 0}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? 'Generating...' : '🔧 Generate Code'}
            </button>
            
            <button
              onClick={handleSaveGraph}
              disabled={isLoading}
              className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : '💾 Save'}
            </button>
            
            <button
              onClick={handleClearGraph}
              disabled={isLoading}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
            >
              🗑️ Clear
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Metrics Display */}
        {metrics && (
          <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
            <span>Nodes: {metrics.totalNodes}</span>
            <span>Edges: {metrics.totalEdges}</span>
            <span>Complexity: {metrics.complexity.toFixed(2)}</span>
            <span>Max Depth: {metrics.maxDepth}</span>
            <span>Cycles: {metrics.cycleCount}</span>
            <span>Layer Violations: {metrics.layerViolations}</span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Toolbox */}
        <Toolbox onNodeTypeSelect={() => {}} />

        <div className="flex-1 flex">
          {/* Canvas */}
          <div className="flex-1">
            <GraphVisualization
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

function initializeApp(): void {
  const container = document.getElementById('root');
  if (!container) {
    document.body.innerHTML = '<div style="color: red; padding: 20px;">Error: Root container not found</div>';
    return;
  }

  try {
    const root = createRoot(container);
    root.render(<GraphFirstProgrammingIDE />);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const sanitizedMessage = errorMessage.replace(/[&<>"']/g, (s) => 
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s] ?? s)
    );
    container.innerHTML = `<div style="color: red; padding: 20px;">Error initializing app: ${sanitizedMessage}</div>`;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}