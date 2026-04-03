import { getRepoFileContent, listRepoRoot } from '@/lib/integrations/github';
import { SERVICE_DETECTION_RULES } from '@/lib/utils/constants';

/**
 * Discover directories that might contain app code by listing the repo root.
 * Returns an array of path prefixes to scan (always includes '' for root).
 */
async function discoverAppDirs(owner, repo, branch) {
  const prefixes = [''];
  try {
    const entries = await listRepoRoot(owner, repo, branch);
    for (const entry of entries) {
      if (entry.type !== 'dir') continue;
      // Check if this directory has a package.json
      const pkg = await getRepoFileContent(owner, repo, `${entry.name}/package.json`, branch);
      if (pkg) {
        prefixes.push(entry.name);
      }
    }
  } catch {
    // Fall back to root-only scanning
  }
  return prefixes;
}

/**
 * Build a prefixed path, handling root vs subdirectory.
 */
function prefixPath(prefix, file) {
  return prefix ? `${prefix}/${file}` : file;
}

/**
 * Scan a GitHub repo for 3rd-party services by checking package.json,
 * .env.example/.env.template, and config files.
 * Automatically discovers subdirectories that contain package.json.
 *
 * Returns { detectedServices: [...], scannedFiles: string[] }
 */
export async function scanRepoForServices(owner, repo, branch = 'main') {
  const scannedFiles = [];
  const serviceSignals = {};

  // Initialize tracking for all known providers
  for (const rule of SERVICE_DETECTION_RULES) {
    serviceSignals[rule.provider] = {
      category: rule.category,
      npmMatch: false,
      envMatch: false,
      configMatch: false,
      signals: [],
    };
  }

  // Discover all directories with package.json (root + subdirs)
  const appDirs = await discoverAppDirs(owner, repo, branch);

  // 1. Scan package.json in each discovered directory
  for (const dir of appDirs) {
    const pkgPath = prefixPath(dir, 'package.json');
    const packageJson = await getRepoFileContent(owner, repo, pkgPath, branch);
    if (!packageJson) continue;

    scannedFiles.push(pkgPath);
    try {
      const pkg = JSON.parse(packageJson);
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      const label = dir ? `${dir}/package.json` : 'package.json';

      for (const rule of SERVICE_DETECTION_RULES) {
        for (const npmPkg of rule.npmPackages) {
          if (allDeps[npmPkg]) {
            serviceSignals[rule.provider].npmMatch = true;
            serviceSignals[rule.provider].signals.push(`${npmPkg} in ${label}`);
          }
        }
      }

      // Check if `next` is a dependency (for Vercel detection)
      if (allDeps['next']) {
        serviceSignals['Vercel'].signals.push(`next in ${label}`);
      }
    } catch {
      // Invalid JSON — skip
    }
  }

  // 2. Scan env files in each discovered directory
  const envFileNames = ['.env.example', '.env.template', '.env.sample', '.env.local.example'];
  let envFound = false;
  for (const dir of appDirs) {
    if (envFound) break;
    for (const envFile of envFileNames) {
      const envPath = prefixPath(dir, envFile);
      const content = await getRepoFileContent(owner, repo, envPath, branch);
      if (!content) continue;

      scannedFiles.push(envPath);
      const lines = content.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
      const varNames = lines.map((l) => l.split('=')[0].trim());

      for (const rule of SERVICE_DETECTION_RULES) {
        for (const prefix of rule.envPrefixes) {
          const match = varNames.find((v) => v.startsWith(prefix));
          if (match) {
            serviceSignals[rule.provider].envMatch = true;
            serviceSignals[rule.provider].signals.push(`${match} in ${envPath}`);
          }
        }
      }
      envFound = true;
      break;
    }
  }

  // 3. Scan config files in each discovered directory
  const allConfigFiles = new Set();
  for (const rule of SERVICE_DETECTION_RULES) {
    for (const cf of rule.configFiles) {
      allConfigFiles.add(cf);
    }
  }

  for (const dir of appDirs) {
    for (const configFile of allConfigFiles) {
      const cfPath = prefixPath(dir, configFile);
      const content = await getRepoFileContent(owner, repo, cfPath, branch);
      if (!content) continue;

      scannedFiles.push(cfPath);
      for (const rule of SERVICE_DETECTION_RULES) {
        if (rule.configFiles.includes(configFile)) {
          serviceSignals[rule.provider].configMatch = true;
          serviceSignals[rule.provider].signals.push(`${cfPath} found`);
        }
      }
    }
  }

  // 4. Check for next.config.js/mjs/ts in each directory
  for (const dir of appDirs) {
    for (const nextConfig of ['next.config.js', 'next.config.mjs', 'next.config.ts']) {
      const ncPath = prefixPath(dir, nextConfig);
      const content = await getRepoFileContent(owner, repo, ncPath, branch);
      if (content) {
        scannedFiles.push(ncPath);
        serviceSignals['Vercel'].configMatch = true;
        serviceSignals['Vercel'].signals.push(`${ncPath} found`);
        break;
      }
    }
  }

  // Build results — only include providers with at least one signal
  const detectedServices = [];
  for (const [provider, data] of Object.entries(serviceSignals)) {
    if (data.signals.length === 0) continue;

    let confidence = 'low';
    if (data.npmMatch && data.envMatch) {
      confidence = 'high';
    } else if (data.npmMatch || (data.envMatch && data.configMatch)) {
      confidence = 'medium';
    }

    detectedServices.push({
      provider,
      category: data.category,
      confidence,
      signals: data.signals,
    });
  }

  // Sort by confidence (high first)
  const order = { high: 0, medium: 1, low: 2 };
  detectedServices.sort((a, b) => order[a.confidence] - order[b.confidence]);

  return { detectedServices, scannedFiles };
}
