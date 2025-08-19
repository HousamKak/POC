import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';
import './styles.css';

// =============================================================================
// DOMAIN LAYER - TYPES AND INTERFACES
// =============================================================================

type NodeType = 'port' | 'adapter' | 'usecase' | 'controller' | 'entity';
type LayerType = 'domain' | 'application' | 'infrastructure' | 'interface';
type EdgeType = 'dependency' | 'implements' | 'extends';

interface Position {
  x: number;
  y: number;
}

interface Method {
  name: string;
  parameters: Array<{ name: string; type: string }>;
  returnType: string;
}

interface GraphNode {
  id: string;
  name: string;
  type: NodeType;
  layer: LayerType;
  position: Position;
  properties: Record<string, any>;
  methods: Method[];
  dependencies: string[];
  description?: string;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
}

interface ArchitectureGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    name: string;
    version: string;
    language: string;
    createdAt: Date;
    updatedAt: Date;
  };
}

interface ValidationViolation {
  type: 'cycle' | 'layer' | 'naming' | 'complexity';
  message: string;
  nodeIds: string[];
  severity: 'error' | 'warning' | 'info';
}

interface ArchitectureMetrics {
  totalNodes: number;
  totalEdges: number;
  cycleCount: number;
  maxDepth: number;
  complexity: number;
  layerDistribution: Record<LayerType, number>;
}

// =============================================================================
// PORTS (DOMAIN INTERFACES)
// =============================================================================

interface GraphPort {
  addNode(node: GraphNode): Promise<void>;
  removeNode(nodeId: string): Promise<void>;
  addEdge(edge: GraphEdge): Promise<void>;
  removeEdge(edgeId: string): Promise<void>;
  updateNode(node: GraphNode): Promise<void>;
  getGraph(): Promise<ArchitectureGraph>;
}

interface ValidationPort {
  detectCycles(graph: ArchitectureGraph): Promise<string[]>;
  validateLayers(graph: ArchitectureGraph): Promise<ValidationViolation[]>;
  calculateMetrics(graph: ArchitectureGraph): Promise<ArchitectureMetrics>;
}

interface CodeGeneratorPort {
  generateTypeScript(graph: ArchitectureGraph): Promise<string>;
  generatePython(graph: ArchitectureGraph): Promise<string>;
  generateDependencyGraph(graph: ArchitectureGraph): Promise<string>;
}

// =============================================================================
// ADAPTERS (INFRASTRUCTURE IMPLEMENTATIONS)
// =============================================================================

class InMemoryGraphAdapter implements GraphPort {
  private graph: ArchitectureGraph;
  private listeners: Set<() => void> = new Set();

  constructor(initialGraph?: ArchitectureGraph) {
    this.graph = initialGraph || {
      nodes: [],
      edges: [],
      metadata: {
        name: 'New Project',
        version: '1.0.0',
        language: 'typescript',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };
  }

  addListener(listener: () => void): void {
    this.listeners.add(listener);
  }

  removeListener(listener: () => void): void {
    this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  async addNode(node: GraphNode): Promise<void> {
    if (this.graph.nodes.some(n => n.id === node.id)) {
      throw new Error(`Node with id ${node.id} already exists`);
    }
    this.graph.nodes.push(node);
    this.graph.metadata.updatedAt = new Date();
    this.notifyListeners();
  }

  async removeNode(nodeId: string): Promise<void> {
    this.graph.nodes = this.graph.nodes.filter(n => n.id !== nodeId);
    this.graph.edges = this.graph.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    this.graph.metadata.updatedAt = new Date();
    this.notifyListeners();
  }

  async addEdge(edge: GraphEdge): Promise<void> {
    if (this.graph.edges.some(e => e.id === edge.id)) {
      throw new Error(`Edge with id ${edge.id} already exists`);
    }
    this.graph.edges.push(edge);
    this.graph.metadata.updatedAt = new Date();
    this.notifyListeners();
  }

  async removeEdge(edgeId: string): Promise<void> {
    this.graph.edges = this.graph.edges.filter(e => e.id !== edgeId);
    this.graph.metadata.updatedAt = new Date();
    this.notifyListeners();
  }

  async updateNode(node: GraphNode): Promise<void> {
    const index = this.graph.nodes.findIndex(n => n.id === node.id);
    if (index === -1) {
      throw new Error(`Node with id ${node.id} not found`);
    }
    this.graph.nodes[index] = node;
    this.graph.metadata.updatedAt = new Date();
    this.notifyListeners();
  }

  async getGraph(): Promise<ArchitectureGraph> {
    return JSON.parse(JSON.stringify(this.graph));
  }
}

class ArchitectureValidationAdapter implements ValidationPort {
  async detectCycles(graph: ArchitectureGraph): Promise<string[]> {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cycles: string[] = [];

    const dfs = (nodeId: string, path: string[]): boolean => {
      if (recStack.has(nodeId)) {
        cycles.push(path.concat(nodeId).join(' → '));
        return true;
      }
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      recStack.add(nodeId);

      const neighbors = graph.edges
        .filter(e => e.source === nodeId && e.type === 'dependency')
        .map(e => e.target);

      for (const neighbor of neighbors) {
        if (dfs(neighbor, [...path, nodeId])) {
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }

    return cycles;
  }

  async validateLayers(graph: ArchitectureGraph): Promise<ValidationViolation[]> {
    const violations: ValidationViolation[] = [];
    
    const layerOrder: LayerType[] = ['domain', 'application', 'infrastructure', 'interface'];
    const layerIndex = (layer: LayerType) => layerOrder.indexOf(layer);

    for (const edge of graph.edges) {
      if (edge.type !== 'dependency') continue;

      const sourceNode = graph.nodes.find(n => n.id === edge.source);
      const targetNode = graph.nodes.find(n => n.id === edge.target);

      if (!sourceNode || !targetNode) continue;

      const sourceLayerIndex = layerIndex(sourceNode.layer);
      const targetLayerIndex = layerIndex(targetNode.layer);

      // Dependencies should flow inward (toward domain)
      if (sourceLayerIndex < targetLayerIndex) {
        violations.push({
          type: 'layer',
          message: `Invalid dependency: ${targetNode.layer} → ${sourceNode.layer}. Dependencies must flow inward.`,
          nodeIds: [edge.source, edge.target],
          severity: 'error'
        });
      }
    }

    return violations;
  }

  async calculateMetrics(graph: ArchitectureGraph): Promise<ArchitectureMetrics> {
    const cycles = await this.detectCycles(graph);
    const layerDistribution: Record<LayerType, number> = {
      domain: 0,
      application: 0,
      infrastructure: 0,
      interface: 0
    };

    graph.nodes.forEach(node => {
      layerDistribution[node.layer]++;
    });

    // Calculate dependency depth
    const depthMap = new Map<string, number>();
    const calculateDepth = (nodeId: string, visited = new Set<string>()): number => {
      if (visited.has(nodeId)) return 0;
      if (depthMap.has(nodeId)) return depthMap.get(nodeId)!;

      visited.add(nodeId);
      const dependencies = graph.edges
        .filter(e => e.target === nodeId && e.type === 'dependency')
        .map(e => e.source);

      const maxDepth = dependencies.length > 0 
        ? Math.max(...dependencies.map(dep => calculateDepth(dep, visited))) + 1
        : 0;

      depthMap.set(nodeId, maxDepth);
      return maxDepth;
    };

    graph.nodes.forEach(node => calculateDepth(node.id));
    const maxDepth = Math.max(0, ...Array.from(depthMap.values()));

    return {
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
      cycleCount: cycles.length,
      maxDepth,
      complexity: graph.nodes.length > 0 ? graph.edges.length / graph.nodes.length : 0,
      layerDistribution
    };
  }
}

class CodeGeneratorAdapter implements CodeGeneratorPort {
  async generateTypeScript(graph: ArchitectureGraph): Promise<string> {
    const ports = graph.nodes.filter(n => n.type === 'port');
    const adapters = graph.nodes.filter(n => n.type === 'adapter');
    const useCases = graph.nodes.filter(n => n.type === 'usecase');

    let code = `// Auto-generated TypeScript code\n// Generated at: ${new Date().toISOString()}\n\n`;

    // Generate ports
    code += '// =============================================================================\n';
    code += '// DOMAIN LAYER - PORTS\n';
    code += '// =============================================================================\n\n';

    for (const port of ports) {
      code += `export interface ${port.name} {\n`;
      for (const method of port.methods) {
        const params = method.parameters.map(p => `${p.name}: ${p.type}`).join(', ');
        code += `  ${method.name}(${params}): ${method.returnType};\n`;
      }
      code += '}\n\n';
    }

    // Generate adapters
    code += '// =============================================================================\n';
    code += '// INFRASTRUCTURE LAYER - ADAPTERS\n';
    code += '// =============================================================================\n\n';

    for (const adapter of adapters) {
      const implementedPorts = graph.edges
        .filter(e => e.target === adapter.id && e.type === 'implements')
        .map(e => graph.nodes.find(n => n.id === e.source)?.name)
        .filter(Boolean);

      const implementsClause = implementedPorts.length > 0 ? ` implements ${implementedPorts.join(', ')}` : '';
      
      code += `export class ${adapter.name}${implementsClause} {\n`;
      code += `  constructor() {\n`;
      code += `    // TODO: Initialize adapter\n`;
      code += `  }\n\n`;

      for (const method of adapter.methods) {
        const params = method.parameters.map(p => `${p.name}: ${p.type}`).join(', ');
        code += `  async ${method.name}(${params}): Promise<${method.returnType}> {\n`;
        code += `    // TODO: Implement method\n`;
        code += `    throw new Error('Not implemented');\n`;
        code += `  }\n\n`;
      }
      code += '}\n\n';
    }

    // Generate use cases
    code += '// =============================================================================\n';
    code += '// APPLICATION LAYER - USE CASES\n';
    code += '// =============================================================================\n\n';

    for (const useCase of useCases) {
      const dependencies = graph.edges
        .filter(e => e.target === useCase.id && e.type === 'dependency')
        .map(e => {
          const depNode = graph.nodes.find(n => n.id === e.source);
          return depNode ? { name: depNode.name, id: depNode.id } : null;
        })
        .filter(Boolean);

      code += `export class ${useCase.name} {\n`;
      code += `  constructor(\n`;
      dependencies.forEach((dep, index) => {
        const comma = index < dependencies.length - 1 ? ',' : '';
        code += `    private ${dep!.name.toLowerCase()}: ${dep!.name}${comma}\n`;
      });
      code += `  ) {}\n\n`;

      for (const method of useCase.methods) {
        const params = method.parameters.map(p => `${p.name}: ${p.type}`).join(', ');
        code += `  async ${method.name}(${params}): Promise<${method.returnType}> {\n`;
        code += `    // TODO: Implement use case logic\n`;
        code += `    throw new Error('Not implemented');\n`;
        code += `  }\n\n`;
      }
      code += '}\n\n';
    }

    return code;
  }

  async generatePython(graph: ArchitectureGraph): Promise<string> {
    // Python implementation similar to TypeScript
    let code = `# Auto-generated Python code\n# Generated at: ${new Date().toISOString()}\n\n`;
    code += 'from abc import ABC, abstractmethod\nfrom typing import Protocol, Optional, List, Dict, Any\n\n';

    const ports = graph.nodes.filter(n => n.type === 'port');
    
    for (const port of ports) {
      code += `class ${port.name}(Protocol):\n`;
      code += `    """${port.description || 'Generated port interface'}\"""\n`;
      for (const method of port.methods) {
        const params = method.parameters.map(p => `${p.name}: ${p.type}`).join(', ');
        code += `    def ${method.name}(self${params ? ', ' + params : ''}): ...\n`;
      }
      code += '\n';
    }

    return code;
  }

  async generateDependencyGraph(graph: ArchitectureGraph): Promise<string> {
    let code = `// Dependency Graph Configuration\n\n`;
    code += `export class DependencyGraph {\n`;
    code += `  constructor() {\n`;
    code += `    this.buildAdapters();\n`;
    code += `    this.buildUseCases();\n`;
    code += `    this.validateGraph();\n`;
    code += `  }\n\n`;

    code += `  private buildAdapters(): void {\n`;
    const adapters = graph.nodes.filter(n => n.type === 'adapter');
    for (const adapter of adapters) {
      code += `    this.${adapter.name.toLowerCase()} = new ${adapter.name}();\n`;
    }
    code += `  }\n\n`;

    code += `  private buildUseCases(): void {\n`;
    const useCases = graph.nodes.filter(n => n.type === 'usecase');
    for (const useCase of useCases) {
      const dependencies = graph.edges
        .filter(e => e.target === useCase.id && e.type === 'dependency')
        .map(e => graph.nodes.find(n => n.id === e.source)?.name.toLowerCase())
        .filter(Boolean);

      const depList = dependencies.length > 0 ? dependencies.map(d => `this.${d}`).join(', ') : '';
      code += `    this.${useCase.name.toLowerCase()} = new ${useCase.name}(${depList});\n`;
    }
    code += `  }\n\n`;

    code += `  private validateGraph(): void {\n`;
    code += `    // Add cycle detection and validation logic\n`;
    code += `  }\n`;
    code += `}\n`;

    return code;
  }
}

// =============================================================================
// USE CASES (APPLICATION LAYER)
// =============================================================================

class CreateNodeUseCase {
  constructor(
    private graphAdapter: InMemoryGraphAdapter,
    private validationAdapter: ArchitectureValidationAdapter
  ) {}

  async execute(request: {
    name: string;
    type: NodeType;
    layer: LayerType;
    position: Position;
    description?: string;
  }): Promise<GraphNode> {
    const node: GraphNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: request.name,
      type: request.type,
      layer: request.layer,
      position: request.position,
      properties: {},
      methods: [],
      dependencies: [],
      ...(request.description && { description: request.description })
    };

    await this.graphAdapter.addNode(node);

    // Validate architecture after addition
    const graph = await this.graphAdapter.getGraph();
    const violations = await this.validationAdapter.validateLayers(graph);
    const errorViolations = violations.filter(v => v.severity === 'error');

    if (errorViolations.length > 0) {
      await this.graphAdapter.removeNode(node.id);
      throw new Error(`Architecture violation: ${errorViolations[0]?.message || 'Unknown violation'}`);
    }

    return node;
  }
}

class ConnectNodesUseCase {
  constructor(
    private graphAdapter: InMemoryGraphAdapter,
    private validationAdapter: ArchitectureValidationAdapter
  ) {}

  async execute(sourceId: string, targetId: string, type: EdgeType): Promise<GraphEdge> {
    const edge: GraphEdge = {
      id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      source: sourceId,
      target: targetId,
      type
    };

    await this.graphAdapter.addEdge(edge);

    // Check for cycles
    const graph = await this.graphAdapter.getGraph();
    const cycles = await this.validationAdapter.detectCycles(graph);

    if (cycles.length > 0) {
      await this.graphAdapter.removeEdge(edge.id);
      throw new Error(`Circular dependency detected: ${cycles[0]}`);
    }

    return edge;
  }
}

// =============================================================================
// REACT COMPONENTS (INTERFACE LAYER)
// =============================================================================

const GraphFirstIDE: React.FC = () => {
  const [graphAdapter] = useState(() => new InMemoryGraphAdapter());
  const [validationAdapter] = useState(() => new ArchitectureValidationAdapter());
  const [codeGenerator] = useState(() => new CodeGeneratorAdapter());
  
  const [graph, setGraph] = useState<ArchitectureGraph | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [violations, setViolations] = useState<ValidationViolation[]>([]);
  const [metrics, setMetrics] = useState<ArchitectureMetrics | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [showCode, setShowCode] = useState(false);

  const createNodeUseCase = useMemo(() => 
    new CreateNodeUseCase(graphAdapter, validationAdapter), 
    [graphAdapter, validationAdapter]
  );
  
  const connectNodesUseCase = useMemo(() => 
    new ConnectNodesUseCase(graphAdapter, validationAdapter), 
    [graphAdapter, validationAdapter]
  );

  useEffect(() => {
    const updateGraph = async () => {
      const newGraph = await graphAdapter.getGraph();
      setGraph(newGraph);
      
      const newViolations = await validationAdapter.validateLayers(newGraph);
      setViolations(newViolations);
      
      const newMetrics = await validationAdapter.calculateMetrics(newGraph);
      setMetrics(newMetrics);
    };

    graphAdapter.addListener(updateGraph);
    updateGraph();

    return () => graphAdapter.removeListener(updateGraph);
  }, [graphAdapter, validationAdapter]);

  const handleCreateNode = useCallback(async (type: NodeType, position: Position) => {
    const defaultLayers: Record<NodeType, LayerType> = {
      port: 'domain',
      adapter: 'infrastructure',
      usecase: 'application',
      controller: 'interface',
      entity: 'domain'
    };

    try {
      const node = await createNodeUseCase.execute({
        name: `New${type.charAt(0).toUpperCase() + type.slice(1)}`,
        type,
        layer: defaultLayers[type],
        position,
        description: `A new ${type} component`
      });
      setSelectedNode(node);
    } catch (error) {
      console.error('Failed to create node:', error);
      alert(`Failed to create node: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [createNodeUseCase]);

  const handleConnectNodes = useCallback(async (sourceId: string, targetId: string) => {
    try {
      await connectNodesUseCase.execute(sourceId, targetId, 'dependency');
    } catch (error) {
      console.error('Failed to connect nodes:', error);
      alert(`Failed to connect nodes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [connectNodesUseCase]);

  const handleGenerateCode = useCallback(async () => {
    if (!graph) return;
    try {
      const code = await codeGenerator.generateTypeScript(graph);
      setGeneratedCode(code);
      setShowCode(true);
    } catch (error) {
      console.error('Failed to generate code:', error);
      alert(`Failed to generate code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [graph, codeGenerator]);

  if (!graph) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <Toolbar onCreateNode={handleCreateNode} onGenerateCode={handleGenerateCode} />
      
      <div className="flex-1 flex">
        <ToolboxPanel onCreateNode={handleCreateNode} />
        
        <div className="flex-1 flex flex-col">
          <VisualizationCanvas
            graph={graph}
            selectedNode={selectedNode}
            onNodeSelect={setSelectedNode}
            onNodeCreate={handleCreateNode}
            onNodeConnect={handleConnectNodes}
          />
          
          <StatusBar violations={violations} metrics={metrics} />
        </div>
        
        <PropertiesPanel
          selectedNode={selectedNode}
          onNodeUpdate={async (node) => {
            await graphAdapter.updateNode(node);
            setSelectedNode(node);
          }}
        />
      </div>

      {showCode && (
        <CodeModal
          code={generatedCode}
          onClose={() => setShowCode(false)}
        />
      )}
    </div>
  );
};

const Toolbar: React.FC<{
  onCreateNode: (type: NodeType, position: Position) => void;
  onGenerateCode: () => void;
}> = ({ onGenerateCode }) => {
  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center space-x-4">
      <div className="flex items-center space-x-2">
        <button className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">
          📁 New Project
        </button>
        <button className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600">
          📂 Open
        </button>
        <button className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600">
          💾 Save
        </button>
      </div>
      
      <div className="border-l border-gray-300 h-6"></div>
      
      <div className="flex items-center space-x-2">
        <button
          onClick={onGenerateCode}
          className="bg-purple-500 text-white px-3 py-1 rounded text-sm hover:bg-purple-600"
        >
          🔧 Generate Code
        </button>
        <button className="bg-orange-500 text-white px-3 py-1 rounded text-sm hover:bg-orange-600">
          ✅ Validate
        </button>
      </div>
      
      <div className="flex-1"></div>
      
      <div className="text-sm text-gray-600">
        Graph-First Programming IDE v1.0
      </div>
    </div>
  );
};

const ToolboxPanel: React.FC<{
  onCreateNode: (type: NodeType, position: Position) => void;
}> = () => {
  const nodeTypes: Array<{ type: NodeType; label: string; color: string; description: string }> = [
    { type: 'port', label: 'Port', color: 'bg-red-200', description: 'Interface/Contract' },
    { type: 'adapter', label: 'Adapter', color: 'bg-green-200', description: 'Implementation' },
    { type: 'usecase', label: 'Use Case', color: 'bg-blue-200', description: 'Business Logic' },
    { type: 'controller', label: 'Controller', color: 'bg-yellow-200', description: 'Interface Handler' },
    { type: 'entity', label: 'Entity', color: 'bg-purple-200', description: 'Domain Model' }
  ];

  const handleDragStart = (e: React.DragEvent, type: NodeType) => {
    e.dataTransfer.setData('nodeType', type);
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 p-4">
      <h3 className="font-semibold text-gray-800 mb-4">Components</h3>
      
      <div className="space-y-2">
        {nodeTypes.map(({ type, label, color, description }) => (
          <div
            key={type}
            draggable
            onDragStart={(e) => handleDragStart(e, type)}
            className={`${color} p-3 rounded cursor-move hover:shadow-md transition-shadow`}
          >
            <div className="font-medium text-gray-800">{label}</div>
            <div className="text-xs text-gray-600">{description}</div>
          </div>
        ))}
      </div>
      
      <div className="mt-6">
        <h4 className="font-medium text-gray-700 mb-2">Instructions</h4>
        <div className="text-xs text-gray-600 space-y-1">
          <div>• Drag components to canvas</div>
          <div>• Ctrl+Click to create nodes</div>
          <div>• Drag between nodes to connect</div>
          <div>• Click nodes to edit properties</div>
        </div>
      </div>
    </div>
  );
};

const VisualizationCanvas: React.FC<{
  graph: ArchitectureGraph;
  selectedNode: GraphNode | null;
  onNodeSelect: (node: GraphNode | null) => void;
  onNodeCreate: (type: NodeType, position: Position) => void;
  onNodeConnect: (sourceId: string, targetId: string) => void;
}> = ({ graph, selectedNode, onNodeSelect, onNodeCreate }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Create main group for zoom/pan
    const g = svg.append('g');

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Draw edges
    const edges = g.selectAll('.edge')
      .data(graph.edges)
      .enter()
      .append('line')
      .attr('class', 'edge')
      .attr('stroke', d => d.type === 'implements' ? '#666' : '#999')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', d => d.type === 'implements' ? '5,5' : 'none')
      .attr('marker-end', 'url(#arrowhead)');

    // Create arrowhead marker
    const defs = svg.append('defs');
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#999');

    // Draw nodes
    const nodes = g.selectAll('.node')
      .data(graph.nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.position.x}, ${d.position.y})`);

    const getNodeColor = (type: NodeType) => {
      const colors = {
        port: '#ff9999',
        adapter: '#99ff99',
        usecase: '#9999ff',
        controller: '#ffcc99',
        entity: '#ff99ff'
      };
      return colors[type];
    };

    const getNodeRadius = (type: NodeType) => {
      const radii = {
        port: 20,
        adapter: 25,
        usecase: 30,
        controller: 25,
        entity: 22
      };
      return radii[type];
    };

    // Add circles
    nodes.append('circle')
      .attr('r', d => getNodeRadius(d.type))
      .attr('fill', d => getNodeColor(d.type))
      .attr('stroke', d => selectedNode?.id === d.id ? '#333' : '#fff')
      .attr('stroke-width', d => selectedNode?.id === d.id ? 3 : 2)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        onNodeSelect(d);
      })
      .on('mousedown', (event) => {
        if (event.ctrlKey || event.metaKey) {
          // Could implement node connection drag here in the future
        }
      });

    // Add labels
    nodes.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('fill', 'white')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .style('pointer-events', 'none')
      .text(d => d.name);

    // Add type labels
    nodes.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', d => getNodeRadius(d.type) + 15)
      .attr('fill', '#666')
      .attr('font-size', '10px')
      .style('pointer-events', 'none')
      .text(d => d.type);

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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('nodeType') as NodeType;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    onNodeCreate(nodeType, { x, y });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="flex-1 relative">
      <svg
        ref={svgRef}
        className="w-full h-full bg-gray-50"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      />
      
      <div className="absolute top-4 left-4 bg-white p-2 rounded shadow-sm text-xs text-gray-600">
        <div>Ctrl+Click: Create Port</div>
        <div>Ctrl+Drag: Connect Nodes</div>
        <div>Drag from Toolbox: Create Component</div>
      </div>
    </div>
  );
};

const PropertiesPanel: React.FC<{
  selectedNode: GraphNode | null;
  onNodeUpdate: (node: GraphNode) => void;
}> = ({ selectedNode, onNodeUpdate }) => {
  const [editingNode, setEditingNode] = useState<GraphNode | null>(null);

  useEffect(() => {
    setEditingNode(selectedNode ? { ...selectedNode } : null);
  }, [selectedNode]);

  if (!selectedNode || !editingNode) {
    return (
      <div className="w-80 bg-white border-l border-gray-200 p-4">
        <h3 className="font-semibold text-gray-800 mb-4">Properties</h3>
        <div className="text-gray-500 text-sm">Select a node to edit its properties</div>
      </div>
    );
  }

  const handleSave = () => {
    if (editingNode) {
      onNodeUpdate(editingNode);
    }
  };

  const addMethod = () => {
    if (editingNode) {
      setEditingNode({
        ...editingNode,
        methods: [
          ...editingNode.methods,
          { name: 'newMethod', parameters: [], returnType: 'void' }
        ]
      });
    }
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 p-4">
      <h3 className="font-semibold text-gray-800 mb-4">Properties</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            value={editingNode.name}
            onChange={(e) => setEditingNode({ ...editingNode, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            aria-label="Node name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            value={editingNode.type}
            onChange={(e) => setEditingNode({ ...editingNode, type: e.target.value as NodeType })}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            aria-label="Node type"
          >
            <option value="port">Port</option>
            <option value="adapter">Adapter</option>
            <option value="usecase">Use Case</option>
            <option value="controller">Controller</option>
            <option value="entity">Entity</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Layer</label>
          <select
            value={editingNode.layer}
            onChange={(e) => setEditingNode({ ...editingNode, layer: e.target.value as LayerType })}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            aria-label="Node layer"
          >
            <option value="domain">Domain</option>
            <option value="application">Application</option>
            <option value="infrastructure">Infrastructure</option>
            <option value="interface">Interface</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={editingNode.description || ''}
            onChange={(e) => setEditingNode({ ...editingNode, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm h-20 resize-none"
            placeholder="Describe this component..."
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Methods</label>
            <button
              onClick={addMethod}
              className="text-blue-500 text-sm hover:text-blue-600"
            >
              + Add Method
            </button>
          </div>
          
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {editingNode.methods.map((method, index) => (
              <div key={index} className="border border-gray-200 p-2 rounded text-sm">
                <input
                  type="text"
                  value={method.name}
                  onChange={(e) => {
                    const newMethods = [...editingNode.methods];
                    newMethods[index] = { ...method, name: e.target.value };
                    setEditingNode({ ...editingNode, methods: newMethods });
                  }}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs mb-1"
                  placeholder="Method name"
                />
                <input
                  type="text"
                  value={method.returnType}
                  onChange={(e) => {
                    const newMethods = [...editingNode.methods];
                    newMethods[index] = { ...method, returnType: e.target.value };
                    setEditingNode({ ...editingNode, methods: newMethods });
                  }}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                  placeholder="Return type"
                />
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          className="w-full bg-blue-500 text-white py-2 rounded text-sm hover:bg-blue-600"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

const StatusBar: React.FC<{
  violations: ValidationViolation[];
  metrics: ArchitectureMetrics | null;
}> = ({ violations, metrics }) => {
  const errorCount = violations.filter(v => v.severity === 'error').length;
  const warningCount = violations.filter(v => v.severity === 'warning').length;

  return (
    <div className="bg-gray-800 text-white px-4 py-2 flex items-center justify-between text-sm">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          {errorCount > 0 && (
            <span className="bg-red-500 px-2 py-1 rounded text-xs">
              ❌ {errorCount} Error{errorCount !== 1 ? 's' : ''}
            </span>
          )}
          {warningCount > 0 && (
            <span className="bg-yellow-500 px-2 py-1 rounded text-xs">
              ⚠️ {warningCount} Warning{warningCount !== 1 ? 's' : ''}
            </span>
          )}
          {errorCount === 0 && warningCount === 0 && (
            <span className="bg-green-500 px-2 py-1 rounded text-xs">
              ✅ No Issues
            </span>
          )}
        </div>
      </div>

      {metrics && (
        <div className="flex items-center space-x-4 text-xs">
          <span>Nodes: {metrics.totalNodes}</span>
          <span>Edges: {metrics.totalEdges}</span>
          <span>Complexity: {metrics.complexity.toFixed(1)}</span>
          <span>Max Depth: {metrics.maxDepth}</span>
        </div>
      )}
    </div>
  );
};

const CodeModal: React.FC<{
  code: string;
  onClose: () => void;
}> = ({ code, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-3/4 h-3/4 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Generated TypeScript Code</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="flex-1 p-4 overflow-hidden">
          <pre className="h-full overflow-auto bg-gray-100 p-4 rounded text-sm font-mono">
            {code}
          </pre>
        </div>
        
        <div className="p-4 border-t flex justify-end space-x-2">
          <button
            onClick={() => navigator.clipboard.writeText(code)}
            className="bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-600"
          >
            📋 Copy to Clipboard
          </button>
          <button
            onClick={onClose}
            className="bg-gray-500 text-white px-4 py-2 rounded text-sm hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default GraphFirstIDE;

// =============================================================================
// APPLICATION ENTRY POINT
// =============================================================================

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<GraphFirstIDE />);
} else {
  console.error('Could not find root element');
}