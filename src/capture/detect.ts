import fs from 'fs';
import path from 'path';
import { StackInfo } from '../types/index.js';

export function detectStack(projectPath: string): StackInfo {
  return {
    language: detectLanguage(projectPath),
    framework: detectFramework(projectPath),
    buildSystem: detectBuildSystem(projectPath),
    packageManager: detectPackageManager(projectPath),
    testFramework: detectTestFramework(projectPath),
  };
}

function detectLanguage(projectPath: string): string {
  try {
    const files = fs.readdirSync(projectPath);

    if (files.includes('package.json')) return 'TypeScript/JavaScript';
    if (files.includes('Cargo.toml')) return 'Rust';
    if (files.includes('go.mod')) return 'Go';
    if (files.includes('requirements.txt') || files.includes('pyproject.toml')) return 'Python';
    if (files.includes('Gemfile')) return 'Ruby';
    if (files.includes('pom.xml') || files.includes('build.gradle')) return 'Java';

    const hasTs = files.some(f => f.endsWith('.ts') || f.endsWith('.tsx'));
    const hasJs = files.some(f => f.endsWith('.js') || f.endsWith('.jsx'));
    const hasPy = files.some(f => f.endsWith('.py'));
    const hasRs = files.some(f => f.endsWith('.rs'));
    const hasGo = files.some(f => f.endsWith('.go'));

    if (hasTs) return 'TypeScript';
    if (hasJs) return 'JavaScript';
    if (hasPy) return 'Python';
    if (hasRs) return 'Rust';
    if (hasGo) return 'Go';
  } catch {
    return 'Unknown';
  }

  return 'Unknown';
}

function detectFramework(projectPath: string): string {
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      if (deps['next']) return 'Next.js';
      if (deps['nuxt']) return 'Nuxt';
      if (deps['@angular/core']) return 'Angular';
      if (deps['vue']) return 'Vue';
      if (deps['react']) return 'React';
      if (deps['svelte']) return 'Svelte';
      if (deps['express']) return 'Express';
      if (deps['fastify']) return 'Fastify';
      if (deps['hono']) return 'Hono';
    }

    const requirementsPath = path.join(projectPath, 'requirements.txt');
    if (fs.existsSync(requirementsPath)) {
      const requirements = fs.readFileSync(requirementsPath, 'utf-8');
      if (requirements.includes('django')) return 'Django';
      if (requirements.includes('flask')) return 'Flask';
      if (requirements.includes('fastapi')) return 'FastAPI';
    }

    const cargoPath = path.join(projectPath, 'Cargo.toml');
    if (fs.existsSync(cargoPath)) {
      const cargo = fs.readFileSync(cargoPath, 'utf-8');
      if (cargo.includes('actix-web')) return 'Actix';
      if (cargo.includes('axum')) return 'Axum';
      if (cargo.includes('rocket')) return 'Rocket';
    }
  } catch {
    return 'Unknown';
  }

  return 'Unknown';
}

function detectBuildSystem(projectPath: string): string {
  try {
    const files = fs.readdirSync(projectPath);

    if (files.includes('vite.config.ts') || files.includes('vite.config.js') || files.includes('vite.config.mjs')) return 'Vite';
    if (files.includes('webpack.config.js') || files.includes('webpack.config.ts')) return 'Webpack';
    if (files.includes('rollup.config.js') || files.includes('rollup.config.ts')) return 'Rollup';
    if (files.includes('esbuild.config.js')) return 'esbuild';
    if (files.includes('turbo.json')) return 'Turborepo';
    if (files.includes('nx.json')) return 'Nx';
    if (files.includes('lerna.json')) return 'Lerna';
    if (files.includes('Cargo.toml')) return 'Cargo';
    if (files.includes('go.mod')) return 'Go Build';
    if (files.includes('Makefile')) return 'Make';

    const packageJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      if (packageJson.scripts?.build?.includes('vite')) return 'Vite';
      if (packageJson.scripts?.build?.includes('webpack')) return 'Webpack';
      if (packageJson.scripts?.build?.includes('rollup')) return 'Rollup';
    }
  } catch {
    return 'Unknown';
  }

  return 'Unknown';
}

function detectPackageManager(projectPath: string): string {
  try {
    const files = fs.readdirSync(projectPath);

    if (files.includes('pnpm-lock.yaml')) return 'pnpm';
    if (files.includes('yarn.lock')) return 'yarn';
    if (files.includes('package-lock.json')) return 'npm';
    if (files.includes('bun.lockb')) return 'bun';
    if (files.includes('Cargo.lock')) return 'cargo';
    if (files.includes('go.sum')) return 'go mod';
    if (files.includes('Pipfile.lock')) return 'pipenv';
    if (files.includes('poetry.lock')) return 'poetry';
  } catch {
    return 'Unknown';
  }

  return 'Unknown';
}

function detectTestFramework(projectPath: string): string {
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      if (deps['vitest']) return 'Vitest';
      if (deps['jest']) return 'Jest';
      if (deps['mocha']) return 'Mocha';
      if (deps['jasmine']) return 'Jasmine';
      if (deps['playwright']) return 'Playwright';
      if (deps['cypress']) return 'Cypress';
    }

    const files = fs.readdirSync(projectPath);
    if (files.includes('pytest.ini') || files.includes('setup.cfg')) return 'pytest';
    if (files.includes('tox.ini')) return 'tox';
  } catch {
    return 'Unknown';
  }

  return 'Unknown';
}
