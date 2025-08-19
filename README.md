# Graph-First Programming IDE

A comprehensive development environment for **Graph-First Programming** that enables visual architecture design with automatic code generation and real-time validation.

## 🚀 Features

### Visual Architecture Design
- **Interactive Graph Editor**: Drag-and-drop interface for creating dependency graphs
- **Real-time Validation**: Instant feedback on architectural violations
- **Layer Enforcement**: Automatic validation of dependency direction rules
- **Component Library**: Pre-built architectural patterns and templates

### Code Generation
- **Multi-language Support**: Generate TypeScript, Python, Java, and C# code
- **Template System**: Customizable code generation templates
- **Incremental Updates**: Only regenerate changed components
- **Integration Ready**: Generate build files, tests, and documentation

### Architecture Analysis
- **Dependency Visualization**: Interactive exploration of component relationships
- **Cycle Detection**: Automatic detection and prevention of circular dependencies
- **Metrics Dashboard**: Track architectural complexity and quality
- **Violation Reporting**: Detailed reports on architecture rule violations

## 🏗️ Architecture

This IDE follows Graph-First Programming principles:

```
Interface Layer    ← Controllers, UI Components
     ↓
Application Layer ← Use Cases, Business Logic  
     ↓
Infrastructure    ← Adapters, External Services
     ↓
Domain Layer      ← Ports, Entities, Value Objects
```

## 🛠️ Installation

### Prerequisites
- Node.js 18+ 
- npm 9+ or pnpm 8+

### Quick Start
```bash
# Clone the repository
git clone https://github.com/graph-first/ide.git
cd ide

# Install dependencies
npm install

# Start development server
npm run dev

# Open browser at http://localhost:3000
```

### Production Build
```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Desktop App
```bash
# Run as Electron app
npm run electron:dev

# Build desktop app
npm run electron:build

# Run as Tauri app (Rust-based)
npm run tauri:dev
npm run tauri:build
```

## 📖 Usage

### Creating Your First Project
1. **Start the IDE**: Run `npm run dev` and open `http://localhost:3000`
2. **Create New Project**: Click "📁 New Project" in the toolbar
3. **Add Components**: Drag components from the toolbox to the canvas
4. **Connect Dependencies**: Drag between nodes to create relationships
5. **Validate Architecture**: Real-time feedback shows any violations
6. **Generate Code**: Click "🔧 Generate Code" to create working code

### Component Types
- **Ports**: Interfaces defining behavior contracts (red nodes)
- **Adapters**: Concrete implementations of ports (green nodes) 
- **Use Cases**: Business logic components (blue nodes)
- **Controllers**: Interface layer handlers (yellow nodes)
- **Entities**: Domain model objects (purple nodes)

### Keyboard Shortcuts
- `Ctrl+Click`: Create new port on canvas
- `Ctrl+Drag`: Connect nodes with dependencies
- `Del`: Delete selected nodes/edges
- `Ctrl+S`: Save project
- `Ctrl+Z/Y`: Undo/Redo
- `Space`: Pan canvas
- `Ctrl+G`: Generate code

## 🧪 Testing

```bash
# Run unit tests
npm run test

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage

# Validate architecture rules
npm run validate-architecture
```

## 🔧 Troubleshooting

### Development Server Issues
- **Blank page at localhost:3000**: Make sure `index.html` exists in the root directory
- **Module not found errors**: Run `npm install` to ensure all dependencies are installed
- **TypeScript errors**: Run `npm run type-check` to see detailed type errors

### Common Solutions
```bash
# Clear build cache
npm run clean

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check for TypeScript errors
npm run type-check

# Validate architecture
npm run validate-architecture
```

## 🏗️ Project Structure

```
├── index.tsx         # Main application entry point
├── index.html        # HTML template
├── styles.css        # Global styles and Tailwind CSS
├── package.json      # Dependencies and scripts
├── vite.config.ts    # Vite configuration
├── tsconfig.json     # TypeScript configuration
├── tailwind.config.js # Tailwind CSS configuration
├── scripts/          # Build and validation scripts
│   └── validate-architecture.ts
└── node_modules/     # Dependencies
```

The application follows a single-file architecture pattern for the POC, with all layers defined in `index.tsx`:
- Domain Layer: Ports, Types, and Interfaces
- Infrastructure Layer: Adapters and Implementations  
- Application Layer: Use Cases and Business Logic
- Interface Layer: React Components and UI

## 📚 Documentation

- [Graph-First Programming Guide](docs/graph-first-programming.md)
- [Architecture Patterns](docs/architecture-patterns.md)
- [API Reference](docs/api-reference.md)
- [Code Generation](docs/code-generation.md)
- [Contributing Guide](CONTRIBUTING.md)

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

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🌟 Acknowledgments

- Inspired by Clean Architecture and Hexagonal Architecture patterns
- Built with React, TypeScript, D3.js, and Vite
- Special thanks to the Graph-First Programming community