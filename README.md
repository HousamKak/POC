# Graph-First Programming IDE v1.0

A comprehensive development environment for **Graph-First Programming** that enables visual architecture design with automatic code generation and real-time validation.


## 🚀 Features

### ✨ Visual Architecture Design
- **Interactive Graph Editor**: Drag-and-drop interface for creating dependency graphs
- **Real-time Validation**: Instant feedback on architectural violations and circular dependencies
- **Layer Enforcement**: Automatic validation of Clean Architecture dependency direction rules
- **Component Library**: Pre-built architectural patterns and templates
- **Zoom & Pan**: Smooth canvas navigation with D3.js-powered visualization

### 🔧 Code Generation
- **Multi-language Support**: Generate TypeScript, Python, Java, and C# code
- **Dependency Injection**: Automatic wiring of ports, adapters, and use cases
- **Template System**: Customizable code generation templates
- **Clean Architecture**: Enforces proper layer separation and dependency inversion
- **Integration Ready**: Generate build files, tests, and documentation

### 📊 Architecture Analysis
- **Dependency Visualization**: Interactive exploration of component relationships
- **Cycle Detection**: Automatic detection and prevention of circular dependencies
- **Metrics Dashboard**: Track architectural complexity, depth, and quality scores
- **Violation Reporting**: Detailed reports on architecture rule violations
- **Export Options**: SVG, PNG, PDF export for documentation

### 🔍 Real-time Validation
- **Graph-First Rules**: Enforces ports-before-adapters, layer separation
- **Edge Semantics**: Proper consumer→provider dependency direction
- **Naming Conventions**: Validates Port, Adapter, UseCase naming patterns
- **Implementation Validation**: Ensures adapters implement ports correctly

## 🏗️ Architecture

This IDE follows **Graph-First Programming** principles with strict layer separation:

```
┌─────────────────┐    ┌─────────────────┐
│  Interface      │    │  Controllers    │
│  Layer          │◄───┤  React UI       │
└─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌─────────────────┐
│  Application    │    │  Use Cases      │
│  Layer          │◄───┤  Business Logic │
└─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌─────────────────┐
│  Infrastructure │    │  Adapters       │
│  Layer          │◄───┤  External APIs  │
└─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌─────────────────┐
│  Domain         │    │  Ports          │
│  Layer          │◄───┤  Entities       │
└─────────────────┘    └─────────────────┘
```

### Key Principles
- **Dependency Inversion**: Use cases depend on ports, not adapters
- **Single Responsibility**: Each component has one clear purpose
- **Open/Closed**: Extensible through new adapters without changing use cases
- **Interface Segregation**: Small, focused port interfaces
- **Dependency Direction**: Always consumer→provider, never upward dependencies

## 🛠️ Installation

### Prerequisites
- **Node.js** 18+ 
- **npm** 9+ or **pnpm** 8+
- **Modern browser** with ES2022 support

### Quick Start
```bash
# Clone the repository
git clone https://github.com/graph-first/ide.git
cd ide

# Install dependencies
npm install

# Start development server
npm run dev

# Open browser at http://localhost:5173
```

### Production Build
```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Validate architecture
npm run validate-architecture
```

### Desktop Applications
```bash
# Run as Electron app
npm run electron:dev

# Build desktop app
npm run electron:build

# Run as Tauri app (Rust-based, smaller footprint)
npm run tauri:dev
npm run tauri:build
```

## 📖 Usage Guide

### Creating Your First Architecture

1. **Start the IDE**: Run `npm run dev` and open `http://localhost:5173`
2. **Create New Project**: Click "📁 New Project" in the toolbar
3. **Add Components**: Drag components from the toolbox to the canvas:
   - 🔌 **Ports**: Interface definitions (red nodes)
   - 🔧 **Adapters**: Concrete implementations (green nodes)
   - ⚙️ **Use Cases**: Business logic (blue nodes)
   - 🎮 **Controllers**: Interface handlers (yellow nodes)
   - 📦 **Entities**: Domain models (purple nodes)

4. **Connect Dependencies**: **Shift+Click** twice to create relationships
5. **Validate Architecture**: Real-time feedback shows violations
6. **Generate Code**: Click "🔧 Generate Code" to create working code

### Component Types & Rules

| Component | Purpose | Dependencies | Layer |
|-----------|---------|--------------|-------|
| **Port** | Interface contract | None | Domain |
| **Entity** | Domain model | None | Domain |
| **Use Case** | Business logic | Ports only | Application |
| **Adapter** | Implementation | Ports + External | Infrastructure |
| **Controller** | Interface handler | Use Cases + Ports | Interface |

### Keyboard Shortcuts
- **Shift+Click twice**: Connect nodes with dependencies
- **Drag**: Reposition nodes and navigate canvas
- **Delete**: Remove selected nodes/edges
- **Ctrl+S**: Save project
- **Ctrl+Z/Y**: Undo/Redo (coming soon)
- **Space+Drag**: Pan canvas
- **Mouse Wheel**: Zoom in/out

### Edge Types
- **Dependency** (solid arrow): Consumer depends on provider
- **Implements** (dashed line): Adapter implements port interface

## 🧪 Testing & Validation

### Architecture Validation
```bash
# Run comprehensive architecture validation
npm run validate-architecture

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix
```

### Unit Tests
```bash
# Run tests
npm run test

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Validation Rules

The IDE enforces these architectural rules:

1. **No Circular Dependencies**: DAG structure required
2. **Layer Separation**: Strict dependency direction
3. **Port Naming**: Interfaces end with "Port"
4. **Adapter Implementation**: Adapters must implement ports
5. **Use Case Dependencies**: Use cases depend only on ports
6. **Clean Separation**: No mixing of UI and business logic

## 🔧 Configuration

### Architecture Rules (`.architecture-rules.json`)
```json
{
  "rules": {
    "layerSeparation": {
      "domain": [],
      "application": ["domain"],
      "infrastructure": ["domain"],
      "interface": ["application", "domain"]
    },
    "portNaming": ".*Port$",
    "adapterNaming": ".*Adapter$"
  },
  "violations": {
    "circular-dependency": "error",
    "layer-violation": "error",
    "naming-convention": "warning"
  }
}
```

### Code Generation Templates
Customize output in the configuration file:
- **TypeScript**: Clean Architecture with dependency injection
- **Python**: Dataclasses and protocols
- **Java**: Interfaces and Spring-ready classes
- **C#**: Interfaces and dependency injection

## 🏆 Best Practices

### Do's ✅
- Keep ports cohesive and focused
- Name adapters by technology (e.g., `StripePaymentAdapter`)
- Use dependency injection containers
- Write contract tests for adapters
- Document port interfaces thoroughly
- Target ≤7 direct dependencies per component

### Don'ts ❌
- Don't leak technology details into ports (no `executeSQL` in ports)
- Don't create circular dependencies
- Don't mix UI components with business logic
- Don't use service locators or global state
- Don't skip validation rules
- Don't over-engineer simple interactions

### Example: E-commerce Payment System
```typescript
// ✅ Good: Clean port interface
interface PaymentPort {
  processPayment(amount: Money, method: PaymentMethod): Promise<PaymentResult>;
}

// ✅ Good: Technology-specific adapter
class StripePaymentAdapter implements PaymentPort {
  async processPayment(amount: Money, method: PaymentMethod): Promise<PaymentResult> {
    // Stripe-specific implementation
  }
}

// ✅ Good: Use case depends on port
class ProcessOrderUseCase {
  constructor(private payment: PaymentPort) {}
  
  async execute(order: Order): Promise<void> {
    await this.payment.processPayment(order.total, order.paymentMethod);
  }
}
```

## 📊 Architecture Metrics

The IDE tracks these quality metrics:

- **Complexity Score**: Edges/Nodes ratio (target: <2.5)
- **Dependency Depth**: Maximum dependency chain length
- **Cycle Count**: Number of circular dependencies (target: 0)
- **Layer Violations**: Cross-layer dependency violations (target: 0)
- **Component Count**: Total nodes in architecture

## 🔄 Migration Playbook

### From Legacy to Graph-First

**Phase 1: Discovery (Week 1)**
- Scan existing codebase for dependencies
- Identify candidate ports from usage patterns
- Create baseline architecture diagram

**Phase 2: Extract Ports (Week 2-3)**
- Define port interfaces for external dependencies
- Wrap legacy classes with adapter pattern
- Introduce central dependency injection

**Phase 3: Validate & Visualize (Week 4)**
- Enable DAG + layer violation checks
- Generate living architecture documentation
- Set up CI validation gates

**Phase 4: Iterate & Replace (Ongoing)**
- Swap implementations piece-by-piece
- Maintain stable port contracts
- Add contract tests for reliability

## 🎯 Roadmap

### v1.1 (Q2 2024)
- [ ] Undo/Redo functionality
- [ ] Multi-project workspace
- [ ] Git integration
- [ ] Team collaboration features

### v1.2 (Q3 2024)
- [ ] Java and C# code generation
- [ ] Advanced metrics and reporting
- [ ] Plugin system for custom rules
- [ ] Integration with popular IDEs

### v2.0 (Q4 2024)
- [ ] AI-powered architecture suggestions
- [ ] Real-time collaboration
- [ ] Cloud deployment templates
- [ ] Advanced visualization modes

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
```bash
# Fork and clone the repo
git clone https://github.com/yourusername/ide.git

# Install dependencies  
npm install

# Start development
npm run dev

# Run tests
npm run test

# Validate your changes
npm run lint
npm run type-check
npm run validate-architecture
```

### Code Style
- Use TypeScript with strict mode
- Follow Clean Architecture principles
- Write tests for new features
- Document public APIs
- Follow conventional commits

## 🔧 Troubleshooting

### Common Issues

**Blank page at localhost:5173**
- Check that `index.html` exists in the root directory
- Verify all dependencies are installed: `npm install`

**Module not found errors**
- Clear node_modules: `rm -rf node_modules package-lock.json && npm install`
- Check TypeScript compilation: `npm run type-check`

**Validation failures**
- Review architecture rules in `.architecture-rules.json`
- Check for circular dependencies in your graph
- Verify layer separation rules

**D3 visualization issues**
- Ensure browser supports ES2022
- Check console for JavaScript errors
- Try refreshing the page

### Getting Help
- 📖 [Documentation](https://graphfirst.dev/docs)
- 💬 [Discord Community](https://discord.gg/graphfirst)
- 🐛 [Issue Tracker](https://github.com/graph-first/ide/issues)
- 📧 [Support Email](mailto:support@graphfirst.dev)

## 📚 Learn More

- [Graph-First Programming Guide](https://graphfirst.dev/guide)
- [Clean Architecture Patterns](https://graphfirst.dev/patterns)
- [API Reference](https://graphfirst.dev/api)
- [Video Tutorials](https://youtube.com/@graphfirst)

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🌟 Acknowledgments

- Inspired by Clean Architecture and Hexagonal Architecture patterns
- Built with React, TypeScript, D3.js, and Vite
- Special thanks to the Graph-First Programming community
- Icons from Lucide React

---

**Made with ❤️ by the Graph-First Programming community**

[Website](https://graphfirst.dev) • [Documentation](https://docs.graphfirst.dev) • [Community](https://discord.gg/graphfirst)