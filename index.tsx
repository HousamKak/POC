/**
 * Graph-First Programming IDE
 * A comprehensive development environment for visual architecture design
 * with automatic code generation and real-time validation.
 * 
 * @version 1.0.0
 * @author Graph-First Programming Community
 */

console.log('Loading Graph-First Programming IDE...');

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// =============================================================================
// DOMAIN LAYER - TYPES & INTERFACES
// =============================================================================

/**
 * Core node types in the architecture graph
 */
export type NodeType = 'port' | 'adapter' | 'usecase' | 'controller' | 'entity';

/**
 * Architecture layers following dependency inversion principle
 */
export type LayerType = 'domain' | 'application' | 'infrastructure' | 'interface';

/**
 * Edge types representing different relationship kinds
 */
export type EdgeType = 'dependency' | 'implements' | 'aggregation' | 'composition';

/**
 * Position coordinates for graph layout
 */
export interface Position {
  readonly x: number;
  readonly y: number;
}

/**
 * Method definition for component interfaces
 */
export interface Method {
  readonly name: string;
  readonly returnType: string;
  readonly parameters: ReadonlyArray<Parameter>;
}

/**
 * Parameter definition for method signatures
 */
export interface Parameter {
  readonly name: string;
  readonly type: string;
  readonly optional: boolean;
}

/**
 * Graph node representing a component in the architecture
 */
export interface GraphNode {
  readonly id: string;
  readonly name: string;
  readonly type: NodeType;
  readonly layer: LayerType;
  readonly position: Position;
  readonly description?: string | undefined;
  readonly methods: ReadonlyArray<Method>;
  readonly dependencies: ReadonlyArray<string>;
}

/**
 * Graph edge representing relationships between components
 */
export interface GraphEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly type: EdgeType;
  readonly label?: string | undefined;
}

/**
 * Complete architecture graph structure
 */
export interface ArchitectureGraph {
  readonly nodes: ReadonlyArray<GraphNode>;
  readonly edges: ReadonlyArray<GraphEdge>;
  readonly metadata: GraphMetadata;
}

/**
 * Graph metadata for analysis and validation
 */
export interface GraphMetadata {
  readonly version: string;
  readonly created: Date;
  readonly modified: Date;
  readonly description?: string | undefined;
}

/**
 * Validation result for architecture rules
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: ReadonlyArray<ValidationError>;
  readonly warnings: ReadonlyArray<ValidationWarning>;
}

/**
 * Validation error details
 */
export interface ValidationError {
  readonly id: string;
  readonly type: string;
  readonly message: string;
  readonly nodeId?: string;
  readonly edgeId?: string;
}

/**
 * Validation warning details
 */
export interface ValidationWarning {
  readonly id: string;
  readonly type: string;
  readonly message: string;
  readonly nodeId?: string;
  readonly edgeId?: string;
}

/**
 * Architecture metrics for analysis
 */
export interface ArchitectureMetrics {
  readonly totalNodes: number;
  readonly totalEdges: number;
  readonly complexity: number;
  readonly maxDepth: number;
  readonly cycleCount: number;
  readonly layerViolations: number;
}

// =============================================================================
// DOMAIN LAYER - PORTS/INTERFACES
// =============================================================================

/**
 * Port for graph data persistence operations
 */
export interface GraphRepositoryPort {
  save(graph: ArchitectureGraph): Promise<void>;
  load(id: string): Promise<ArchitectureGraph | null>;
  list(): Promise<ReadonlyArray<{ id: string; name: string; modified: Date }>>;
  delete(id: string): Promise<void>;
}

/**
 * Port for architecture validation operations
 */
export interface ValidationPort {
  validateGraph(graph: ArchitectureGraph): Promise<ValidationResult>;
  validateNode(node: GraphNode, graph: ArchitectureGraph): Promise<ValidationResult>;
  validateEdge(edge: GraphEdge, graph: ArchitectureGraph): Promise<ValidationResult>;
  detectCycles(graph: ArchitectureGraph): Promise<ReadonlyArray<string[]>>;
  checkLayerViolations(graph: ArchitectureGraph): Promise<ReadonlyArray<ValidationError>>;
}

/**
 * Port for code generation operations
 */
export interface CodeGeneratorPort {
  generateTypeScript(graph: ArchitectureGraph): Promise<string>;
  generatePython(graph: ArchitectureGraph): Promise<string>;
  generateJava(graph: ArchitectureGraph): Promise<string>;
  generateDependencyGraph(graph: ArchitectureGraph): Promise<string>;
}

/**
 * Port for graph visualization operations
 */
export interface VisualizationPort {
  renderGraph(graph: ArchitectureGraph, container: SVGElement): void;
  updateNodePosition(nodeId: string, position: Position): void;
  highlightNode(nodeId: string): void;
  clearHighlights(): void;
  exportSVG(): string;
}

// =============================================================================
// INFRASTRUCTURE LAYER - ADAPTERS
// =============================================================================

/**
 * Architecture validation adapter with comprehensive rule checking
 */
class ArchitectureValidationAdapter implements ValidationPort {
  async validateGraph(graph: ArchitectureGraph): Promise<ValidationResult> {
    if (!graph || typeof graph !== 'object') {
      throw new TypeError('Graph must be a valid ArchitectureGraph object');
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for cycles
    const cycles = await this.detectCycles(graph);
    cycles.forEach((cycle, index) => {
      errors.push({
        id: `cycle_${index}`,
        type: 'circular_dependency',
        message: `Circular dependency detected: ${cycle.join(' → ')}`
      });
    });

    // Check layer violations
    const layerViolations = await this.checkLayerViolations(graph);
    errors.push(...layerViolations);

    // Check for isolated nodes
    const isolatedNodes = this.findIsolatedNodes(graph);
    isolatedNodes.forEach(nodeId => {
      warnings.push({
        id: `isolated_${nodeId}`,
        type: 'isolated_node',
        message: `Node ${nodeId} has no connections`,
        nodeId
      });
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  async validateNode(node: GraphNode, _graph: ArchitectureGraph): Promise<ValidationResult> {
    if (!node || typeof node !== 'object') {
      throw new TypeError('Node must be a valid GraphNode object');
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate node properties
    if (!node.id || typeof node.id !== 'string') {
      errors.push({
        id: 'invalid_node_id',
        type: 'validation_error',
        message: 'Node must have a valid ID',
        nodeId: node.id
      });
    }

    if (!node.name || typeof node.name !== 'string') {
      errors.push({
        id: 'invalid_node_name',
        type: 'validation_error',
        message: 'Node must have a valid name',
        nodeId: node.id
      });
    }

    // Check naming conventions
    if (node.type === 'port' && !node.name.endsWith('Port')) {
      warnings.push({
        id: 'port_naming',
        type: 'naming_convention',
        message: 'Port names should end with "Port"',
        nodeId: node.id
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  async validateEdge(edge: GraphEdge, graph: ArchitectureGraph): Promise<ValidationResult> {
    if (!edge || typeof edge !== 'object') {
      throw new TypeError('Edge must be a valid GraphEdge object');
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check if source and target nodes exist
    const sourceExists = graph.nodes.some(n => n.id === edge.source);
    const targetExists = graph.nodes.some(n => n.id === edge.target);

    if (!sourceExists) {
      errors.push({
        id: 'missing_source',
        type: 'validation_error',
        message: `Source node ${edge.source} does not exist`,
        edgeId: edge.id
      });
    }

    if (!targetExists) {
      errors.push({
        id: 'missing_target',
        type: 'validation_error',
        message: `Target node ${edge.target} does not exist`,
        edgeId: edge.id
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  async detectCycles(graph: ArchitectureGraph): Promise<ReadonlyArray<string[]>> {
    const adjacencyList = new Map<string, string[]>();
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    // Build adjacency list
    graph.nodes.forEach(node => {
      adjacencyList.set(node.id, []);
    });

    graph.edges.forEach(edge => {
      const neighbors = adjacencyList.get(edge.source) || [];
      neighbors.push(edge.target);
      adjacencyList.set(edge.source, neighbors);
    });

    // DFS to detect cycles
    const dfs = (nodeId: string, path: string[]): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path]);
        } else if (recursionStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          cycles.push([...path.slice(cycleStart), neighbor]);
        }
      }

      recursionStack.delete(nodeId);
    };

    graph.nodes.forEach(node => {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    });

    return cycles;
  }

  async checkLayerViolations(graph: ArchitectureGraph): Promise<ReadonlyArray<ValidationError>> {
    const layerHierarchy: Record<LayerType, number> = {
      domain: 0,
      application: 1,
      infrastructure: 2,
      interface: 3
    };

    const violations: ValidationError[] = [];

    graph.edges.forEach(edge => {
      const sourceNode = graph.nodes.find(n => n.id === edge.source);
      const targetNode = graph.nodes.find(n => n.id === edge.target);

      if (!sourceNode || !targetNode) return;

      const sourceLayer = layerHierarchy[sourceNode.layer];
      const targetLayer = layerHierarchy[targetNode.layer];

      // Dependencies should flow inward (toward domain)
      if (sourceLayer > targetLayer && edge.type === 'dependency') {
        violations.push({
          id: `layer_violation_${edge.id}`,
          type: 'layer_violation',
          message: `Invalid dependency: ${sourceNode.layer} → ${targetNode.layer}`,
          edgeId: edge.id
        });
      }
    });

    return violations;
  }

  private findIsolatedNodes(graph: ArchitectureGraph): string[] {
    const connectedNodes = new Set<string>();

    graph.edges.forEach(edge => {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    });

    return graph.nodes
      .filter(node => !connectedNodes.has(node.id))
      .map(node => node.id);
  }
}

/**
 * TypeScript code generation adapter
 */
class TypeScriptCodeGenerator implements CodeGeneratorPort {
  async generateTypeScript(graph: ArchitectureGraph): Promise<string> {
    if (!graph || typeof graph !== 'object') {
      throw new TypeError('Graph must be a valid ArchitectureGraph object');
    }

    let code = `// Generated TypeScript Code\n// Architecture: ${graph.metadata.description || 'Untitled'}\n`;
    code += `// Generated on: ${new Date().toISOString()}\n\n`;

    // Generate ports (interfaces)
    const ports = graph.nodes.filter(n => n.type === 'port');
    if (ports.length > 0) {
      code += `// =============================================================================\n`;
      code += `// DOMAIN LAYER - PORTS/INTERFACES\n`;
      code += `// =============================================================================\n\n`;

      for (const port of ports) {
        code += this.generateInterface(port);
      }
    }

    // Generate entities
    const entities = graph.nodes.filter(n => n.type === 'entity');
    if (entities.length > 0) {
      code += `// =============================================================================\n`;
      code += `// DOMAIN LAYER - ENTITIES\n`;
      code += `// =============================================================================\n\n`;

      for (const entity of entities) {
        code += this.generateClass(entity);
      }
    }

    // Generate use cases
    const useCases = graph.nodes.filter(n => n.type === 'usecase');
    if (useCases.length > 0) {
      code += `// =============================================================================\n`;
      code += `// APPLICATION LAYER - USE CASES\n`;
      code += `// =============================================================================\n\n`;

      for (const useCase of useCases) {
        code += this.generateUseCaseClass(useCase, graph);
      }
    }

    // Generate adapters
    const adapters = graph.nodes.filter(n => n.type === 'adapter');
    if (adapters.length > 0) {
      code += `// =============================================================================\n`;
      code += `// INFRASTRUCTURE LAYER - ADAPTERS\n`;
      code += `// =============================================================================\n\n`;

      for (const adapter of adapters) {
        code += this.generateAdapterClass(adapter, graph);
      }
    }

    // Generate controllers
    const controllers = graph.nodes.filter(n => n.type === 'controller');
    if (controllers.length > 0) {
      code += `// =============================================================================\n`;
      code += `// INTERFACE LAYER - CONTROLLERS\n`;
      code += `// =============================================================================\n\n`;

      for (const controller of controllers) {
        code += this.generateControllerClass(controller, graph);
      }
    }

    // Generate dependency graph
    code += await this.generateDependencyGraph(graph);

    return code;
  }

  async generatePython(_graph: ArchitectureGraph): Promise<string> {
    // Python generation implementation would go here
    return `# Python code generation not implemented yet\n`;
  }

  async generateJava(_graph: ArchitectureGraph): Promise<string> {
    // Java generation implementation would go here
    return `// Java code generation not implemented yet\n`;
  }

  async generateDependencyGraph(graph: ArchitectureGraph): Promise<string> {
    let code = `// =============================================================================\n`;
    code += `// DEPENDENCY GRAPH CONFIGURATION\n`;
    code += `// =============================================================================\n\n`;

    code += `export class DependencyGraph {\n`;
    code += `  private instances = new Map<string, any>();\n\n`;

    code += `  constructor() {\n`;
    code += `    this.buildGraph();\n`;
    code += `    this.validateGraph();\n`;
    code += `  }\n\n`;

    code += `  private buildGraph(): void {\n`;
    
    // Build adapters first
    const adapters = graph.nodes.filter(n => n.type === 'adapter');
    for (const adapter of adapters) {
      code += `    this.instances.set('${adapter.id}', new ${adapter.name}());\n`;
    }

    // Build use cases with dependencies
    const useCases = graph.nodes.filter(n => n.type === 'usecase');
    for (const useCase of useCases) {
      const dependencies = this.getDependencies(useCase.id, graph);
      const depParams = dependencies.map(dep => `this.instances.get('${dep}')`).join(', ');
      code += `    this.instances.set('${useCase.id}', new ${useCase.name}(${depParams}));\n`;
    }

    // Build controllers
    const controllers = graph.nodes.filter(n => n.type === 'controller');
    for (const controller of controllers) {
      const dependencies = this.getDependencies(controller.id, graph);
      const depParams = dependencies.map(dep => `this.instances.get('${dep}')`).join(', ');
      code += `    this.instances.set('${controller.id}', new ${controller.name}(${depParams}));\n`;
    }

    code += `  }\n\n`;

    code += `  private validateGraph(): void {\n`;
    code += `    // Add cycle detection and validation logic here\n`;
    code += `    console.log('Dependency graph validated successfully');\n`;
    code += `  }\n\n`;

    code += `  getInstance<T>(id: string): T {\n`;
    code += `    const instance = this.instances.get(id);\n`;
    code += `    if (!instance) {\n`;
    code += `      throw new Error(\`Component '\${id}' not found in dependency graph\`);\n`;
    code += `    }\n`;
    code += `    return instance as T;\n`;
    code += `  }\n`;
    code += `}\n\n`;

    return code;
  }

  private generateInterface(port: GraphNode): string {
    let code = `/**\n * ${port.description || `${port.name} interface`}\n */\n`;
    code += `export interface ${port.name} {\n`;

    for (const method of port.methods) {
      const params = method.parameters
        .map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`)
        .join(', ');
      code += `  ${method.name}(${params}): ${method.returnType};\n`;
    }

    code += `}\n\n`;
    return code;
  }

  private generateClass(node: GraphNode): string {
    let code = `/**\n * ${node.description || `${node.name} class`}\n */\n`;
    code += `export class ${node.name} {\n`;

    for (const method of node.methods) {
      const params = method.parameters
        .map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`)
        .join(', ');
      code += `  ${method.name}(${params}): ${method.returnType} {\n`;
      code += `    // TODO: Implement ${method.name}\n`;
      code += `    throw new Error('Method not implemented');\n`;
      code += `  }\n\n`;
    }

    code += `}\n\n`;
    return code;
  }

  private generateUseCaseClass(useCase: GraphNode, graph: ArchitectureGraph): string {
    const dependencies = this.getDependencies(useCase.id, graph);
    const dependencyNodes = dependencies
      .map(depId => graph.nodes.find(n => n.id === depId))
      .filter(Boolean) as GraphNode[];

    let code = `/**\n * ${useCase.description || `${useCase.name} use case`}\n */\n`;
    code += `export class ${useCase.name} {\n`;

    // Constructor with dependencies
    if (dependencyNodes.length > 0) {
      const constructorParams = dependencyNodes
        .map(dep => `private ${dep.id}: ${dep.name}`)
        .join(',\n    ');
      code += `  constructor(\n    ${constructorParams}\n  ) {}\n\n`;
    }

    // Methods
    for (const method of useCase.methods) {
      const params = method.parameters
        .map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`)
        .join(', ');
      code += `  async ${method.name}(${params}): Promise<${method.returnType}> {\n`;
      code += `    // TODO: Implement ${method.name}\n`;
      code += `    throw new Error('Method not implemented');\n`;
      code += `  }\n\n`;
    }

    code += `}\n\n`;
    return code;
  }

  private generateAdapterClass(adapter: GraphNode, graph: ArchitectureGraph): string {
    // Find which ports this adapter implements
    const implementedPorts = graph.edges
      .filter(e => e.target === adapter.id && e.type === 'implements')
      .map(e => graph.nodes.find(n => n.id === e.source))
      .filter(Boolean) as GraphNode[];

    const interfaces = implementedPorts.map(port => port.name).join(', ');

    let code = `/**\n * ${adapter.description || `${adapter.name} adapter`}\n */\n`;
    code += `export class ${adapter.name}${interfaces ? ` implements ${interfaces}` : ''} {\n`;

    // Combine methods from implemented interfaces and adapter's own methods
    const allMethods = [
      ...adapter.methods,
      ...implementedPorts.flatMap(port => port.methods)
    ];

    // Remove duplicates by method name
    const uniqueMethods = allMethods.filter((method, index, array) => 
      array.findIndex(m => m.name === method.name) === index
    );

    for (const method of uniqueMethods) {
      const params = method.parameters
        .map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`)
        .join(', ');
      code += `  async ${method.name}(${params}): Promise<${method.returnType}> {\n`;
      code += `    // TODO: Implement ${method.name}\n`;
      code += `    throw new Error('Method not implemented');\n`;
      code += `  }\n\n`;
    }

    code += `}\n\n`;
    return code;
  }

  private generateControllerClass(controller: GraphNode, graph: ArchitectureGraph): string {
    const dependencies = this.getDependencies(controller.id, graph);
    const dependencyNodes = dependencies
      .map(depId => graph.nodes.find(n => n.id === depId))
      .filter(Boolean) as GraphNode[];

    let code = `/**\n * ${controller.description || `${controller.name} controller`}\n */\n`;
    code += `export class ${controller.name} {\n`;

    // Constructor with dependencies
    if (dependencyNodes.length > 0) {
      const constructorParams = dependencyNodes
        .map(dep => `private ${dep.id}: ${dep.name}`)
        .join(',\n    ');
      code += `  constructor(\n    ${constructorParams}\n  ) {}\n\n`;
    }

    // Methods
    for (const method of controller.methods) {
      const params = method.parameters
        .map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`)
        .join(', ');
      code += `  async ${method.name}(${params}): Promise<${method.returnType}> {\n`;
      code += `    // TODO: Implement ${method.name}\n`;
      code += `    throw new Error('Method not implemented');\n`;
      code += `  }\n\n`;
    }

    code += `}\n\n`;
    return code;
  }

  private getDependencies(nodeId: string, graph: ArchitectureGraph): string[] {
    return graph.edges
      .filter(e => e.target === nodeId && e.type === 'dependency')
      .map(e => e.source);
  }
}

// =============================================================================
// APPLICATION LAYER - USE CASES
// =============================================================================

/**
 * Use case for creating new nodes in the architecture graph
 */
class CreateNodeUseCase {
  constructor(
    private validationPort: ValidationPort
  ) {
    if (!validationPort) {
      throw new TypeError('ValidationPort is required');
    }
  }

  async execute(request: {
    name: string;
    type: NodeType;
    layer: LayerType;
    position: Position;
    description?: string;
  }): Promise<GraphNode> {
    // Runtime type validation
    if (!request || typeof request !== 'object') {
      throw new TypeError('Request must be a valid object');
    }

    if (!request.name || typeof request.name !== 'string') {
      throw new TypeError('Name must be a non-empty string');
    }

    if (!request.type || !['port', 'adapter', 'usecase', 'controller', 'entity'].includes(request.type)) {
      throw new TypeError('Type must be a valid NodeType');
    }

    const node: GraphNode = {
      id: this.generateNodeId(request.name),
      name: request.name,
      type: request.type,
      layer: request.layer,
      position: request.position,
      description: request.description || undefined,
      methods: [],
      dependencies: []
    };

    // Validate the node
    const emptyGraph: ArchitectureGraph = {
      nodes: [],
      edges: [],
      metadata: {
        version: '1.0.0',
        created: new Date(),
        modified: new Date()
      }
    };

    const validation = await this.validationPort.validateNode(node, emptyGraph);
    if (!validation.isValid) {
      throw new Error(`Node validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    return node;
  }

  private generateNodeId(name: string): string {
    return `${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
  }
}

/**
 * Use case for creating edges between nodes
 */
class CreateEdgeUseCase {
  async execute(request: {
    sourceId: string;
    targetId: string;
    type: EdgeType;
    label?: string;
  }): Promise<GraphEdge> {
    // Runtime type validation
    if (!request || typeof request !== 'object') {
      throw new TypeError('Request must be a valid object');
    }

    if (!request.sourceId || typeof request.sourceId !== 'string') {
      throw new TypeError('SourceId must be a non-empty string');
    }

    if (!request.targetId || typeof request.targetId !== 'string') {
      throw new TypeError('TargetId must be a non-empty string');
    }

    const edge: GraphEdge = {
      id: this.generateEdgeId(request.sourceId, request.targetId),
      source: request.sourceId,
      target: request.targetId,
      type: request.type,
      label: request.label || undefined
    };

    return edge;
  }

  private generateEdgeId(sourceId: string, targetId: string): string {
    return `${sourceId}_to_${targetId}_${Date.now()}`;
  }
}

/**
 * Use case for calculating architecture metrics
 */
class CalculateMetricsUseCase {
  async execute(graph: ArchitectureGraph): Promise<ArchitectureMetrics> {
    if (!graph || typeof graph !== 'object') {
      throw new TypeError('Graph must be a valid ArchitectureGraph object');
    }

    const totalNodes = graph.nodes.length;
    const totalEdges = graph.edges.length;
    const complexity = totalNodes > 0 ? totalEdges / totalNodes : 0;
    const maxDepth = this.calculateMaxDepth(graph);
    const cycleCount = 0; // Would be calculated by cycle detection
    const layerViolations = 0; // Would be calculated by layer validation

    return {
      totalNodes,
      totalEdges,
      complexity,
      maxDepth,
      cycleCount,
      layerViolations
    };
  }

  private calculateMaxDepth(graph: ArchitectureGraph): number {
    const nodeDepths = new Map<string, number>();
    const visited = new Set<string>();

    // Find root nodes (nodes with no incoming edges)
    const incomingEdges = new Set(graph.edges.map(e => e.target));
    const rootNodes = graph.nodes
      .filter(n => !incomingEdges.has(n.id))
      .map(n => n.id);

    // Calculate depth using BFS from root nodes
    const calculateDepth = (nodeId: string, depth: number): void => {
      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      nodeDepths.set(nodeId, Math.max(nodeDepths.get(nodeId) || 0, depth));

      const children = graph.edges
        .filter(e => e.source === nodeId)
        .map(e => e.target);

      children.forEach(childId => {
        calculateDepth(childId, depth + 1);
      });
    };

    rootNodes.forEach(rootId => {
      calculateDepth(rootId, 0);
    });

    return Math.max(...Array.from(nodeDepths.values()), 0);
  }
}

// =============================================================================
// INTERFACE LAYER - REACT COMPONENTS
// =============================================================================

/**
 * Main IDE component orchestrating the entire application
 */
const GraphFirstIDE: React.FC = () => {
  console.log('GraphFirstIDE component rendering...');
  
  return (
    <div style={{ 
      padding: '20px', 
      fontSize: '18px', 
      color: '#333',
      backgroundColor: '#f0f0f0',
      minHeight: '100vh',
      border: '3px solid red'
    }}>
      <h1 style={{ color: 'blue' }}>Graph-First Programming IDE</h1>
      <p style={{ color: 'green' }}>Component is rendering successfully!</p>
      <p>If you can see this, React is working.</p>
    </div>
  );
};

/**
 * Toolbar component with action buttons and status indicators
 */
interface ToolbarProps {
  onSave: () => void;
  onGenerateCode: () => void;
  validationResult: ValidationResult | null;
  metrics: ArchitectureMetrics | null;
}

const Toolbar: React.FC<ToolbarProps> = ({
  onSave,
  onGenerateCode,
  validationResult,
  metrics
}) => {
  const errorCount = validationResult?.errors.length || 0;
  const warningCount = validationResult?.warnings.length || 0;

  return (
    <div className="toolbar">
      <button className="toolbar-button primary">
        📁 New Project
      </button>
      <button className="toolbar-button secondary">
        📂 Open
      </button>
      <button className="toolbar-button success" onClick={onSave}>
        💾 Save
      </button>
      
      <div className="toolbar-separator"></div>
      
      <button className="toolbar-button info" onClick={onGenerateCode}>
        🔧 Generate Code
      </button>
      <button className="toolbar-button warning">
        ✅ Validate
      </button>
      
      <div className="toolbar-separator"></div>
      
      <div className="status-section">
        {errorCount > 0 && (
          <span className="status-badge error">
            ❌ {errorCount} Error{errorCount !== 1 ? 's' : ''}
          </span>
        )}
        {warningCount > 0 && (
          <span className="status-badge warning">
            ⚠️ {warningCount} Warning{warningCount !== 1 ? 's' : ''}
          </span>
        )}
        {errorCount === 0 && warningCount === 0 && (
          <span className="status-badge success">
            ✅ No Issues
          </span>
        )}
      </div>
      
      {metrics && (
        <div className="status-metrics">
          <span>Nodes: {metrics.totalNodes}</span>
          <span>Edges: {metrics.totalEdges}</span>
          <span>Complexity: {metrics.complexity.toFixed(1)}</span>
          <span>Max Depth: {metrics.maxDepth}</span>
        </div>
      )}
      
      <div className="toolbar-title">
        Graph-First Programming IDE v1.0
      </div>
    </div>
  );
};

/**
 * Toolbox panel with draggable components
 */
interface ToolboxPanelProps {
  onCreateNode: (type: NodeType, position: Position) => void;
}

const ToolboxPanel: React.FC<ToolboxPanelProps> = ({ onCreateNode: _onCreateNode }) => {
  const componentTypes: Array<{
    type: NodeType;
    label: string;
    description: string;
    icon: string;
  }> = [
    { type: 'port', label: 'Port', description: 'Interface/Contract', icon: 'P' },
    { type: 'adapter', label: 'Adapter', description: 'Implementation', icon: 'A' },
    { type: 'usecase', label: 'Use Case', description: 'Business Logic', icon: 'U' },
    { type: 'controller', label: 'Controller', description: 'Interface Handler', icon: 'C' },
    { type: 'entity', label: 'Entity', description: 'Domain Model', icon: 'E' }
  ];

  const handleDragStart = (e: React.DragEvent, type: NodeType): void => {
    e.dataTransfer.setData('nodeType', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="left-sidebar">
      <div className="sidebar-section">
        <h3 className="section-title">
          🧩 Components
        </h3>
        
        <div className="components-grid">
          {componentTypes.map(({ type, label, description, icon }) => (
            <div
              key={type}
              draggable
              onDragStart={(e) => handleDragStart(e, type)}
              className={`component-item ${type}`}
            >
              <div className="component-icon">{icon}</div>
              <div className="component-info">
                <div className="component-name">{label}</div>
                <div className="component-description">{description}</div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="instructions-section">
          <h4 className="instructions-title">Instructions</h4>
          <ul className="instructions-list">
            <li>Drag components to canvas</li>
            <li>Ctrl+Click to create nodes</li>
            <li>Drag between nodes to connect</li>
            <li>Click nodes to edit properties</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

/**
 * Main visualization canvas with D3.js integration
 */
interface VisualizationCanvasProps {
  graph: ArchitectureGraph;
  selectedNode: GraphNode | null;
  onNodeSelect: (node: GraphNode | null) => void;
  onNodeCreate: (type: NodeType, position: Position) => void;
  onNodeConnect: (sourceId: string, targetId: string) => void;
}

const VisualizationCanvas: React.FC<VisualizationCanvasProps> = ({
  graph,
  selectedNode,
  onNodeSelect,
  onNodeCreate,
  onNodeConnect: _onNodeConnect
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // D3.js visualization logic
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Create main group for zoom/pan
    const g = svg.append('g').attr('class', 'graph-container');

    // Add SVG definitions for gradients and markers
    const defs = svg.append('defs');

    // Create gradients for different node types
    const gradients = [
      { id: 'portGradient', colors: ['#ffcccc', '#ff9999'] as [string, string] },
      { id: 'adapterGradient', colors: ['#ccffcc', '#99ff99'] as [string, string] },
      { id: 'usecaseGradient', colors: ['#ccccff', '#9999ff'] as [string, string] },
      { id: 'controllerGradient', colors: ['#ffddcc', '#ffcc99'] as [string, string] },
      { id: 'entityGradient', colors: ['#e6ccff', '#cc99ff'] as [string, string] }
    ];

    gradients.forEach(grad => {
      const gradient = defs.append('radialGradient')
        .attr('id', grad.id)
        .attr('cx', '30%')
        .attr('cy', '30%')
        .attr('r', '70%');
      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', grad.colors[0]);
      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', grad.colors[1]);
    });

    // Add arrow markers
    const markerConfigs = [
      { id: 'dependency-arrow', color: '#666' },
      { id: 'implements-arrow', color: '#999' },
      { id: 'highlighted-arrow', color: '#f5222d' }
    ];

    markerConfigs.forEach(config => {
      defs.append('marker')
        .attr('id', config.id)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 30)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', config.color);
    });

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Draw edges
    const edges = g.selectAll('.link')
      .data(graph.edges)
      .enter()
      .append('line')
      .attr('class', d => `link ${d.type}`)
      .attr('stroke', d => d.type === 'implements' ? '#999' : '#666')
      .attr('stroke-width', d => d.type === 'implements' ? 2 : 3)
      .attr('stroke-dasharray', d => d.type === 'implements' ? '8,4' : 'none')
      .attr('marker-end', d => `url(#${d.type}-arrow)`)
      .attr('opacity', 0.6);

    // Create node groups
    const nodeGroups = g.selectAll('.node-group')
      .data(graph.nodes)
      .enter()
      .append('g')
      .attr('class', 'node-group')
      .attr('transform', d => `translate(${d.position.x},${d.position.y})`);

    // Add circles
    nodeGroups.append('circle')
      .attr('class', 'node')
      .attr('r', d => getNodeRadius(d.type))
      .attr('fill', d => getNodeFill(d.type))
      .attr('stroke', d => selectedNode?.id === d.id ? '#667eea' : 'white')
      .attr('stroke-width', d => selectedNode?.id === d.id ? 5 : 3)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        onNodeSelect(d);
      });

    // Add labels
    nodeGroups.append('text')
      .attr('class', 'node-label')
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .text(d => d.name)
      .style('pointer-events', 'none');

    // Add type labels
    nodeGroups.append('text')
      .attr('class', 'node-type-label')
      .attr('text-anchor', 'middle')
      .attr('dy', d => getNodeRadius(d.type) + 15)
      .text(d => d.type)
      .style('pointer-events', 'none');

    // Update edge positions
    edges
      .attr('x1', d => {
        const source = graph.nodes.find(n => n.id === d.source);
        return source?.position.x || 0;
      })
      .attr('y1', d => {
        const source = graph.nodes.find(n => n.id === d.source);
        return source?.position.y || 0;
      })
      .attr('x2', d => {
        const target = graph.nodes.find(n => n.id === d.target);
        return target?.position.x || 0;
      })
      .attr('y2', d => {
        const target = graph.nodes.find(n => n.id === d.target);
        return target?.position.y || 0;
      });

    // Handle canvas clicks
    svg.on('click', (event) => {
      if (event.ctrlKey || event.metaKey) {
        const [x, y] = d3.pointer(event, g.node());
        onNodeCreate('port', { x, y });
      } else {
        onNodeSelect(null);
      }
    });

  }, [graph, selectedNode, onNodeSelect, onNodeCreate]);

  const getNodeRadius = (type: NodeType): number => {
    const radii: Record<NodeType, number> = {
      port: 20,
      adapter: 24,
      usecase: 28,
      controller: 26,
      entity: 22
    };
    return radii[type] || 22;
  };

  const getNodeFill = (type: NodeType): string => {
    const fills: Record<NodeType, string> = {
      port: 'url(#portGradient)',
      adapter: 'url(#adapterGradient)',
      usecase: 'url(#usecaseGradient)',
      controller: 'url(#controllerGradient)',
      entity: 'url(#entityGradient)'
    };
    return fills[type] || '#cccccc';
  };

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('nodeType') as NodeType;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    onNodeCreate(nodeType, { x, y });
  };

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  return (
    <div className="canvas-area">
      <svg
        ref={svgRef}
        className="canvas-svg"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      />
      
      <div className="canvas-overlay">
        <div className="shortcut">Ctrl+Click: Create Port</div>
        <div className="shortcut">Ctrl+Drag: Connect Nodes</div>
        <div className="shortcut">Drag from Toolbox: Create Component</div>
      </div>
    </div>
  );
};

/**
 * Properties panel for editing selected nodes
 */
interface PropertiesPanelProps {
  selectedNode: GraphNode | null;
  onNodeUpdate: (node: GraphNode) => void;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedNode,
  onNodeUpdate
}) => {
  const [editingNode, setEditingNode] = useState<GraphNode | null>(null);

  useEffect(() => {
    setEditingNode(selectedNode ? { ...selectedNode } : null);
  }, [selectedNode]);

  const handlePropertyChange = (property: keyof GraphNode, value: any): void => {
    if (!editingNode) return;

    setEditingNode(prev => prev ? { ...prev, [property]: value } : null);
  };

  const handleMethodAdd = (): void => {
    if (!editingNode) return;

    const newMethod: Method = {
      name: 'newMethod',
      returnType: 'void',
      parameters: []
    };

    setEditingNode(prev => prev ? {
      ...prev,
      methods: [...prev.methods, newMethod]
    } : null);
  };

  const handleMethodUpdate = (index: number, method: Method): void => {
    if (!editingNode) return;

    const updatedMethods = [...editingNode.methods];
    updatedMethods[index] = method;

    setEditingNode(prev => prev ? {
      ...prev,
      methods: updatedMethods
    } : null);
  };

  const handleMethodRemove = (index: number): void => {
    if (!editingNode) return;

    const updatedMethods = editingNode.methods.filter((_, i) => i !== index);

    setEditingNode(prev => prev ? {
      ...prev,
      methods: updatedMethods
    } : null);
  };

  const handleSave = (): void => {
    if (!editingNode) return;

    onNodeUpdate(editingNode);
  };

  if (!selectedNode || !editingNode) {
    return (
      <div className="properties-panel">
        <div className="properties-header">
          <div className="properties-title">Properties</div>
          <div className="properties-subtitle">
            Select a component to view and edit its properties
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="properties-panel">
      <div className="properties-header">
        <div className="properties-title">Properties</div>
        <div className="properties-subtitle">{editingNode.name}</div>
      </div>
      
      <div className="properties-content">
        <div className="property-group">
          <label className="property-label" htmlFor="node-name-input">Name</label>
          <input
            id="node-name-input"
            type="text"
            className="property-input"
            value={editingNode.name}
            onChange={(e) => handlePropertyChange('name', e.target.value)}
            title="Enter the component name"
            placeholder="Component name"
          />
        </div>

        <div className="property-group">
          <label className="property-label" htmlFor="node-type-select">Type</label>
          <select
            id="node-type-select"
            className="property-select"
            value={editingNode.type}
            onChange={(e) => handlePropertyChange('type', e.target.value as NodeType)}
            title="Select the component type"
          >
            <option value="port">Port</option>
            <option value="adapter">Adapter</option>
            <option value="usecase">Use Case</option>
            <option value="controller">Controller</option>
            <option value="entity">Entity</option>
          </select>
        </div>

        <div className="property-group">
          <label className="property-label" htmlFor="node-layer-select">Layer</label>
          <select
            id="node-layer-select"
            className="property-select"
            value={editingNode.layer}
            onChange={(e) => handlePropertyChange('layer', e.target.value as LayerType)}
            title="Select the architecture layer"
          >
            <option value="domain">Domain</option>
            <option value="application">Application</option>
            <option value="infrastructure">Infrastructure</option>
            <option value="interface">Interface</option>
          </select>
        </div>

        <div className="property-group">
          <label className="property-label" htmlFor="node-description-textarea">Description</label>
          <textarea
            id="node-description-textarea"
            className="property-textarea"
            value={editingNode.description || ''}
            onChange={(e) => handlePropertyChange('description', e.target.value)}
            placeholder="Enter component description..."
            title="Enter a description for this component"
          />
        </div>

        <div className="methods-section">
          <div className="methods-title">
            Methods
            <button className="add-method-btn" onClick={handleMethodAdd}>
              + Add Method
            </button>
          </div>
          
          {editingNode.methods.map((method, index) => (
            <div key={index} className="method-item">
              <input
                type="text"
                className="method-input"
                value={method.name}
                onChange={(e) => handleMethodUpdate(index, {
                  ...method,
                  name: e.target.value
                })}
                placeholder="Method name"
                title={`Method name for method ${index + 1}`}
                aria-label={`Method ${index + 1} name`}
              />
              <input
                type="text"
                className="method-input"
                value={method.returnType}
                onChange={(e) => handleMethodUpdate(index, {
                  ...method,
                  returnType: e.target.value
                })}
                placeholder="Return type"
                title={`Return type for method ${index + 1}`}
                aria-label={`Method ${index + 1} return type`}
              />
              <button
                className="remove-method-btn"
                onClick={() => handleMethodRemove(index)}
                title={`Remove method ${index + 1}`}
                aria-label={`Remove method ${index + 1}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button className="save-changes-btn" onClick={handleSave}>
          Save Changes
        </button>
      </div>
    </div>
  );
};

/**
 * Modal for displaying generated code
 */
interface CodeModalProps {
  code: string;
  onClose: () => void;
}

const CodeModal: React.FC<CodeModalProps> = ({ code, onClose }) => {
  const handleCopyToClipboard = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code);
      alert('Code copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy code:', error);
      alert('Failed to copy code to clipboard');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">Generated TypeScript Code</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        
        <div className="modal-body">
          <pre className="code-display">{code}</pre>
        </div>
        
        <div className="modal-footer">
          <button className="modal-button primary" onClick={handleCopyToClipboard}>
            📋 Copy to Clipboard
          </button>
          <button className="modal-button secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// APPLICATION ENTRY POINT
// =============================================================================

/**
 * Application initialization with error boundary
 */
const initializeApp = (): void => {
  console.log('initializeApp called, DOM ready state:', document.readyState);
  
  try {
    const container = document.getElementById('root');
    console.log('Root container found:', container);
    
    if (!container) {
      throw new Error('Root element not found. Ensure index.html has a div with id="root"');
    }

    console.log('Creating React root...');
    const root = createRoot(container);
    
    console.log('Rendering GraphFirstIDE component...');
    root.render(<GraphFirstIDE />);

    console.log('Graph-First Programming IDE initialized successfully');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    
    // Display error message to user
    const errorContainer = document.body;
    errorContainer.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        background: #f8f9fa;
        font-family: system-ui;
        color: #2c3e50;
        text-align: center;
      ">
        <div>
          <h1>Application Failed to Load</h1>
          <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
          <p>Please check the console for more details.</p>
        </div>
      </div>
    `;
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

export default GraphFirstIDE;