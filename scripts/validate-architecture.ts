
// ========================================
// Architecture Validation Script
// ========================================
// scripts/validate-architecture.ts
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

// Helper function to find TypeScript files recursively
function findTypescriptFiles(dir: string): string[] {
  const files: string[] = [];
  
  try {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip node_modules and other unwanted directories
        if (!['node_modules', 'dist', 'build', '.git'].includes(entry)) {
          files.push(...findTypescriptFiles(fullPath));
        }
      } else if (stat.isFile()) {
        const ext = extname(entry);
        // Include .ts and .tsx files, but exclude test files
        if ((ext === '.ts' || ext === '.tsx') && 
            !entry.includes('.test.') && 
            !entry.includes('.spec.')) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    // Directory might not exist or be accessible
    console.warn(`Warning: Could not read directory ${dir}`);
  }
  
  return files;
}

interface ArchitectureRule {
  name: string;
  description: string;
  validate: (files: string[]) => Promise<ValidationResult>;
}

interface ValidationResult {
  passed: boolean;
  violations: string[];
}

const rules: ArchitectureRule[] = [
  {
    name: 'Domain Layer Independence',
    description: 'Domain layer should not depend on other layers',
    validate: async (files) => {
      // Look for domain-related code in the main file
      const violations: string[] = [];
      
      for (const file of files) {
        const content = readFileSync(file, 'utf-8');
        
        // Check if this file contains domain interfaces (ports)
        if (content.includes('interface ') && content.includes('Port')) {
          // Check for imports from other layers
          if (content.includes('import ') && 
              (content.includes('react') || content.includes('d3'))) {
            violations.push(`${file}: Domain interfaces should not import UI libraries`);
          }
        }
      }
      
      return {
        passed: violations.length === 0,
        violations
      };
    }
  },
  {
    name: 'Port Naming Convention',
    description: 'All port interfaces should end with "Port"',
    validate: async (files) => {
      const violations: string[] = [];
      
      for (const file of files) {
        const content = readFileSync(file, 'utf-8');
        
        // Look for interface definitions that might be ports
        const interfaceMatches = content.match(/interface\s+(\w+)\s*{/g);
        
        if (interfaceMatches) {
          for (const match of interfaceMatches) {
            const interfaceName = match.replace(/interface\s+(\w+)\s*{/, '$1');
            
            // Check if this looks like a port interface (has methods returning promises)
            const interfaceStart = content.indexOf(match);
            const interfaceEnd = content.indexOf('}', interfaceStart);
            const interfaceBody = content.substring(interfaceStart, interfaceEnd);
            
            if (interfaceBody.includes('Promise<') && !interfaceName.endsWith('Port')) {
              violations.push(`${file}: Interface ${interfaceName} appears to be a port but doesn't end with "Port"`);
            }
          }
        }
      }
      
      return {
        passed: violations.length === 0,
        violations
      };
    }
  },
  {
    name: 'Clean Architecture Layers',
    description: 'Code should be organized into clear architectural layers',
    validate: async (files) => {
      const violations: string[] = [];
      
      for (const file of files) {
        const content = readFileSync(file, 'utf-8');
        
        // Check for mixed concerns in single file
        const hasReactComponents = content.includes('React.FC') || content.includes('useState');
        const hasDomainLogic = content.includes('interface ') && content.includes('Port');
        const hasInfrastructure = content.includes('class ') && content.includes('Adapter');
        
        if (hasReactComponents && (hasDomainLogic || hasInfrastructure)) {
          violations.push(`${file}: Mixing UI components with domain/infrastructure concerns`);
        }
      }
      
      return {
        passed: violations.length === 0,
        violations
      };
    }
  }
];

async function validateArchitecture(): Promise<void> {
  console.log('🔍 Validating Graph-First Architecture...\n');
  
  // Look for TypeScript files in current directory and subdirectories
  const files = findTypescriptFiles('.');
  let totalViolations = 0;
  
  for (const rule of rules) {
    console.log(`📋 ${rule.name}`);
    console.log(`   ${rule.description}`);
    
    const result = await rule.validate(files);
    
    if (result.passed) {
      console.log('   ✅ Passed\n');
    } else {
      console.log('   ❌ Failed');
      result.violations.forEach(violation => {
        console.log(`      ${violation}`);
      });
      console.log();
      totalViolations += result.violations.length;
    }
  }
  
  if (totalViolations === 0) {
    console.log('🎉 All architecture rules passed!');
    process.exit(0);
  } else {
    console.log(`💥 ${totalViolations} architecture violations found!`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  validateArchitecture().catch(console.error);
}
