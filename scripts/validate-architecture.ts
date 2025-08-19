#!/usr/bin/env node
/**
 * Graph-First Architecture Validation Script
 *
 * Fixes applied:
 * - Support both architecture-rules.json and .architecture-rules.json
 * - Correct glob usage (use globSync, dedupe results)
 * - Windows path handling for module names & relative import resolution
 * - Explicit mapping between human-readable rule names and config violation keys
 * - Added missing violation keys for additional rules
 * - More robust adapter/port/use-case heuristics
 * - Normalized path separators
 */

import { readFileSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { globSync } from 'glob';

interface ValidationRule {
  name: string;
  description: string;
  validate: (files: string[]) => Promise<ValidationReport>;
}

interface ValidationReport {
  passed: boolean;
  violations: string[];
  warnings?: string[];
}

interface ArchitectureConfig {
  rules: {
    layerSeparation: Record<string, string[]>;
    portNaming: string;
    adapterNaming: string;
    useCaseNaming: string;
    controllerNaming: string;
  };
  violations: Record<string, 'error' | 'warning'>;
}

const DEFAULT_CONFIG: ArchitectureConfig = {
  rules: {
    layerSeparation: {
      domain: [],
      application: ['domain'],
      infrastructure: ['domain'],
      interface: ['application', 'domain']
    },
    portNaming: '.*Port$',
    adapterNaming: '.*Adapter$',
    useCaseNaming: '.*UseCase$',
    controllerNaming: '.*Controller$'
  },
  violations: {
    'circular-dependency': 'error',
    'layer-violation': 'error',
    'naming-convention': 'warning',
    'port-implementation': 'error',
    'use-case-dependencies': 'error',
    'clean-architecture': 'warning'
  }
};

function findTypescriptFiles(directory: string): string[] {
  try {
    const patterns = [
      join(directory, '**/*.ts'),
      join(directory, '**/*.tsx')
    ];
    const ignore = [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.d.ts'
    ];
    const files = patterns.flatMap(p => globSync(p, { ignore }));
    return Array.from(new Set(files)).map(p => p.replace(/\\/g, '/'));
  } catch (error) {
    console.error('Error finding TypeScript files:', error);
    return [];
  }
}

function loadConfig(): ArchitectureConfig {
  const candidates = ['architecture-rules.json', '.architecture-rules.json'];
  for (const file of candidates) {
    if (existsSync(file)) {
      try {
        const cfg = JSON.parse(readFileSync(file, 'utf-8'));
        return { ...DEFAULT_CONFIG, ...cfg };
      } catch (err) {
        console.warn(`Failed to parse ${file}, using defaults:`, err);
        break;
      }
    }
  }
  return DEFAULT_CONFIG;
}

const RULE_KEY_MAP: Record<string, string> = {
  'Circular Dependencies': 'circular-dependency',
  'Layer Separation': 'layer-violation',
  'Port Naming Convention': 'naming-convention',
  'Adapter Implementation': 'port-implementation',
  'Use Case Dependencies': 'use-case-dependencies',
  'Clean Architecture Layers': 'clean-architecture'
};

function extractImports(content: string): string[] {
  const importRegex = /import\s+(?:{[^}]*}|\*\s+as\s+\w+|[^'";]+)\s+from\s+['"]([^'";]+)['"];?/g;
  const imports: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = importRegex.exec(content)) !== null) {
    if (m[1]) {
      imports.push(m[1]);
    }
  }
  return imports;
}

function getModuleName(filePath: string): string {
  return basename(filePath).replace(/\.[^.]+$/, '');
}

function resolveImport(importPath: string, currentFile: string): string | null {
  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    const normalized = currentFile.replace(/\\/g, '/');
    const dir = normalized.substring(0, normalized.lastIndexOf('/'));
    return join(dir, importPath).replace(/\\/g, '/');
  }
  if (importPath.startsWith('@/')) return importPath.substring(2);
  if (!importPath.startsWith('.')) return importPath; // package or absolute alias
  return null;
}

function detectLayer(content: string, filePath: string): string | null {
  if (/React\.FC|useState|useEffect|Controller/.test(content)) return 'interface';
  if (/UseCase/.test(content) && /execute\s*\(/.test(content)) return 'application';
  if (/Adapter/.test(content) && /implements/.test(content)) return 'infrastructure';
  if (/interface\s+\w+.*Port/.test(content)) return 'domain';
  if (/Entity|ValueObject/.test(content)) return 'domain';
  const pathLower = filePath.toLowerCase();
  if (/components|ui/.test(pathLower)) return 'interface';
  if (/usecase|application/.test(pathLower)) return 'application';
  if (/adapter|infrastructure/.test(pathLower)) return 'infrastructure';
  if (/domain|entity/.test(pathLower)) return 'domain';
  return null;
}

function isPrimitiveType(typeName: string): boolean {
  const primitives = ['string','number','boolean','Date','Array','Map','Set','Promise','void','any','unknown','never','object'];
  return primitives.includes(typeName) || /\[\]|</.test(typeName);
}

const VALIDATION_RULES: ValidationRule[] = [
  {
    name: 'Circular Dependencies',
    description: 'Detect circular dependencies in the codebase',
    validate: async (files) => {
      const violations: string[] = [];
      const dependencyMap = new Map<string, Set<string>>();

      for (const file of files) {
        try {
          const content = readFileSync(file, 'utf-8');
          const imports = extractImports(content);
          const moduleName = getModuleName(file);
          if (!dependencyMap.has(moduleName)) dependencyMap.set(moduleName, new Set());
          for (const importPath of imports) {
            const resolvedImport = resolveImport(importPath, file);
            if (!resolvedImport) continue;
            // Use basename comparison for simplicity
            const resolvedBasename = basename(resolvedImport);
            const basenameParts = resolvedBasename.split('.');
            const baseName = basenameParts[0];
            if (baseName) {
              const target = files.find(f => basename(f).startsWith(baseName));
              if (target) dependencyMap.get(moduleName)!.add(getModuleName(target));
            }
          }
        } catch { /* ignore */ }
      }

      const visited = new Set<string>();
      const stack = new Set<string>();

      const dfs = (node: string, path: string[]): void => {
        if (stack.has(node)) {
          const idx = path.indexOf(node);
          if (idx !== -1) violations.push(`Circular dependency: ${[...path.slice(idx), node].join(' → ')}`);
          return;
        }
        if (visited.has(node)) return;
        visited.add(node);
        stack.add(node);
        const deps = dependencyMap.get(node) ?? new Set<string>();
        for (const dep of Array.from(deps)) {
          dfs(dep, [...path, node]);
        }
        stack.delete(node);
      };

      for (const k of Array.from(dependencyMap.keys())) {
        if (!visited.has(k)) dfs(k, []);
      }
      return { passed: violations.length === 0, violations };
    }
  },
  {
    name: 'Layer Separation',
    description: 'Enforce architectural layer boundaries',
    validate: async (files) => {
      const violations: string[] = [];
      const config = loadConfig();
      for (const file of files) {
        try {
          const content = readFileSync(file, 'utf-8');
          const fileLayer = detectLayer(content, file);
          if (!fileLayer) continue;
          const allowed = config.rules.layerSeparation[fileLayer] || [];
          for (const importPath of extractImports(content)) {
            const resolved = resolveImport(importPath, file);
            if (!resolved) continue;
            const importedFile = files.find(f => f.endsWith(`${resolved}.ts`) || f.endsWith(`${resolved}.tsx`) || f.includes(resolved));
            if (!importedFile) continue;
            const importedLayer = detectLayer(readFileSync(importedFile, 'utf-8'), importedFile);
            if (importedLayer && importedLayer !== fileLayer && !allowed.includes(importedLayer)) {
              violations.push(`Layer violation in ${file}: ${fileLayer} importing from ${importedLayer}`);
            }
          }
        } catch { /* ignore */ }
      }
      return { passed: violations.length === 0, violations };
    }
  },
  {
    name: 'Port Naming Convention',
    description: 'All port interfaces should end with "Port"',
    validate: async (files) => {
      const violations: string[] = [];
      const { rules } = loadConfig();
      const portRegex = new RegExp(rules.portNaming);
      for (const file of files) {
        try {
          const content = readFileSync(file, 'utf-8');
          const matches = content.match(/(?:export\s+)?interface\s+(\w+)\s*(?:extends[^{]*)?{[\s\S]*?}/g);
          if (!matches) continue;
          for (const decl of matches) {
            const nameMatch = decl.match(/interface\s+(\w+)/);
            if (!nameMatch || !nameMatch[1]) continue;
            const name = nameMatch[1];
            // Heuristic: if interface has method returning Promise or contains async keyword
            if ((/Promise<|async\s+/.test(decl)) && !portRegex.test(name)) {
              violations.push(`${file}: Interface ${name} appears to be a port but doesn't follow naming convention`);
            }
          }
        } catch { /* ignore */ }
      }
      return { passed: violations.length === 0, violations };
    }
  },
  {
    name: 'Adapter Implementation',
    description: 'Adapters should implement port interfaces',
    validate: async (files) => {
      const violations: string[] = [];
      const { rules } = loadConfig();
      const adapterRegex = new RegExp(rules.adapterNaming);
      for (const file of files) {
        try {
          const content = readFileSync(file, 'utf-8');
          const adapters = content.match(/(?:export\s+)?class\s+(\w*Adapter\w*)[^{]*{[\s\S]*?}/g);
          if (!adapters) continue;
          for (const block of adapters) {
            const className = block.match(/class\s+(\w+)/)?.[1];
            if (!className || !adapterRegex.test(className)) continue;
            const impl = block.match(/implements\s+([^\n{]+)/);
            if (!impl || !impl[1]) {
              violations.push(`${file}: Adapter ${className} should implement a port interface`);
              continue;
            }
            const interfaces = impl[1].split(',').map(s => s.trim());
            if (!interfaces.some(i => {
              const interfaceParts = i.split('<');
              return interfaceParts[0] && /Port$/.test(interfaceParts[0]);
            })) {
              violations.push(`${file}: Adapter ${className} should implement a port interface (ending with 'Port')`);
            }
          }
        } catch { /* ignore */ }
      }
      return { passed: violations.length === 0, violations };
    }
  },
  {
    name: 'Use Case Dependencies',
    description: 'Use cases should only depend on port interfaces',
    validate: async (files) => {
      const violations: string[] = [];
      const warnings: string[] = [];
      for (const file of files) {
        try {
          const content = readFileSync(file, 'utf-8');
          const useCases = content.match(/(?:export\s+)?class\s+\w*UseCase\w*[^{]*{[\s\S]*?}/g);
          if (!useCases) continue;
          for (const block of useCases) {
            const className = block.match(/class\s+(\w+)/)?.[1];
            if (!className) continue;
            const ctor = block.match(/constructor\s*\(([^)]*)\)/);
            if (!ctor || !ctor[1]) continue;
            const params = ctor[1].split(',').map(p => p.trim()).filter(Boolean);
            for (const param of params) {
              const typeMatch = param.match(/:\s*([A-Za-z0-9_]+)/);
              if (!typeMatch || !typeMatch[1]) continue;
              const typeName = typeMatch[1];
              if (!typeName.endsWith('Port') && !isPrimitiveType(typeName)) {
                if (/Adapter$|Service$/.test(typeName)) {
                  violations.push(`${file}: Use case ${className} depends on concrete ${typeName} instead of a Port`);
                } else {
                  warnings.push(`${file}: Use case ${className} depends on ${typeName} – consider a Port abstraction`);
                }
              }
            }
          }
        } catch { /* ignore */ }
      }
      return { passed: violations.length === 0, violations, warnings };
    }
  },
  {
    name: 'Clean Architecture Layers',
    description: 'Code should be organized into clear architectural layers',
    validate: async (files) => {
      const violations: string[] = [];
      for (const file of files) {
        try {
          const content = readFileSync(file, 'utf-8');
          const hasReact = /React\.FC|useState|useEffect|from\s+'react'/.test(content);
          const hasDomain = /interface\s+\w+.*Port|Entity|ValueObject/.test(content);
          const hasInfra = /class\s+\w*Adapter\w*/.test(content);
          const hasUseCases = /class\s+\w*UseCase\w*/.test(content);
          const concerns: string[] = [];
          if (hasReact) concerns.push('UI');
          if (hasDomain) concerns.push('Domain');
          if (hasInfra) concerns.push('Infrastructure');
          if (hasUseCases) concerns.push('UseCases');
          if (hasReact && (hasDomain || hasInfra || hasUseCases) && !/index\.tsx$|App\.tsx$/.test(file)) {
            violations.push(`${file}: Mixing UI with core logic (${concerns.join(', ')}). Split into separate files.`);
          }
        } catch { /* ignore */ }
      }
      return { passed: violations.length === 0, violations };
    }
  }
];

async function validateArchitecture(): Promise<void> {
  console.log('🔍 Validating Graph-First Architecture...\n');
  
  // Debug: Check working directory
  console.log('Current working directory:', process.cwd());
  
  const files = findTypescriptFiles('.');
  console.log(`Debug: Found files:`, files);
  
  if (!files.length) {
    console.log('❌ No TypeScript files found to validate');
    process.exit(1);
  }
  console.log(`📁 Found ${files.length} TypeScript files to validate\n`);
  let totalViolations = 0;
  let totalWarnings = 0;
  const config = loadConfig();
  for (const rule of VALIDATION_RULES) {
    console.log(`🔎 Running: ${rule.name}`);
    console.log(`   ${rule.description}`);
    try {
      const result = await rule.validate(files);
      if (result.passed) {
        console.log('   ✅ Passed\n');
        continue;
      }
      const key = RULE_KEY_MAP[rule.name] || rule.name.toLowerCase().replace(/\s+/g, '-');
      const violationType = config.violations[key] || 'error';
      if (violationType === 'error') {
        console.log(`   ❌ Failed (${result.violations.length} violations)\n`);
        totalViolations += result.violations.length;
      } else {
        console.log(`   ⚠️  Warnings (${result.violations.length} issues)\n`);
        totalWarnings += result.violations.length;
      }
      for (const v of result.violations) {
        const prefix = violationType === 'error' ? '      ❌' : '      ⚠️ ';
        console.log(`${prefix} ${v}`);
      }
      if (result.warnings?.length) {
        console.log('   ⚠️  Additional warnings:');
        for (const w of result.warnings) {
          console.log(`      ⚠️  ${w}`);
        }
        totalWarnings += result.warnings.length;
      }
      console.log();
    } catch (err) {
      console.log(`   💥 Rule execution failed: ${(err as Error).message}\n`);
      totalViolations++;
    }
  }
  console.log('📊 Validation Summary');
  console.log('═'.repeat(50));
  console.log(`📁 Files validated: ${files.length}`);
  console.log(`❌ Total violations: ${totalViolations}`);
  console.log(`⚠️  Total warnings: ${totalWarnings}`);
  if (totalViolations === 0) {
    console.log('\n🎉 Architecture validation passed!');
    console.log('✨ Your codebase follows Graph-First Programming principles.');
    process.exit(0);
  } else {
    console.log('\n💥 Architecture validation failed!');
    console.log('🔧 Please fix the violations above before proceeding.');
    process.exit(1);
  }
}

// Run if this file is being executed directly
console.log('Module loaded, import.meta.url:', import.meta.url);
console.log('Process argv[1]:', process.argv[1]);

// Alternative approach - always run when directly executed
if (process.argv[1]?.includes('validate-architecture') || import.meta.url.includes('validate-architecture')) {
  console.log('Script starting...');
  validateArchitecture().catch(err => {
    console.error('Validation script failed:', err);
    process.exit(1);
  });
}

export { validateArchitecture, VALIDATION_RULES, loadConfig };