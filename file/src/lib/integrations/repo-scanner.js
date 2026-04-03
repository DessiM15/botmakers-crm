import { getRepoFileContent } from '@/lib/integrations/github';
import { SERVICE_DETECTION_RULES } from '@/lib/utils/constants';

/**
 * Scan a GitHub repo for 3rd-party services by checking package.json,
 * .env.example/.env.template, and config files.
 *
 * Returns { detectedServices: [...], scannedFiles: string[] }
 */
export async function scanRepoForServices(owner, repo, branch = 'main') {
  const scannedFiles = [];
  const serviceSignals = {}; // provider → { npmMatch: bool, envMatch: bool, configMatch: bool, signals: [] }

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

  // 1. Scan package.json
  const packageJson = await getRepoFileContent(owner, repo, 'package.json', branch);
  if (packageJson) {
    scannedFiles.push('package.json');
    try {
      const pkg = JSON.parse(packageJson);
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      for (const rule of SERVICE_DETECTION_RULES) {
        for (const npmPkg of rule.npmPackages) {
          if (allDeps[npmPkg]) {
            serviceSignals[rule.provider].npmMatch = true;
            serviceSignals[rule.provider].signals.push(`${npmPkg} in package.json`);
          }
        }
      }

      // Check if `next` is a dependency (for Vercel detection with vercel.json)
      if (allDeps['next']) {
        serviceSignals['Vercel'].signals.push('next in package.json');
      }
    } catch {
      // Invalid JSON — skip
    }
  }

  // 2. Scan env files (.env.example, .env.template, .env.sample)
  const envFiles = ['.env.example', '.env.template', '.env.sample', '.env.local.example'];
  for (const envFile of envFiles) {
    const content = await getRepoFileContent(owner, repo, envFile, branch);
    if (content) {
      scannedFiles.push(envFile);
      const lines = content.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
      const varNames = lines.map((l) => l.split('=')[0].trim());

      for (const rule of SERVICE_DETECTION_RULES) {
        for (const prefix of rule.envPrefixes) {
          const match = varNames.find((v) => v.startsWith(prefix));
          if (match) {
            serviceSignals[rule.provider].envMatch = true;
            serviceSignals[rule.provider].signals.push(`${match} in ${envFile}`);
          }
        }
      }
      break; // Only need one env file
    }
  }

  // 3. Scan config files (vercel.json, wrangler.toml, prisma/schema.prisma)
  const allConfigFiles = new Set();
  for (const rule of SERVICE_DETECTION_RULES) {
    for (const cf of rule.configFiles) {
      allConfigFiles.add(cf);
    }
  }

  for (const configFile of allConfigFiles) {
    const content = await getRepoFileContent(owner, repo, configFile, branch);
    if (content) {
      scannedFiles.push(configFile);
      for (const rule of SERVICE_DETECTION_RULES) {
        if (rule.configFiles.includes(configFile)) {
          serviceSignals[rule.provider].configMatch = true;
          serviceSignals[rule.provider].signals.push(`${configFile} found`);
        }
      }
    }
  }

  // 4. Also check for next.config.js/mjs (confirms Vercel/Next.js)
  for (const nextConfig of ['next.config.js', 'next.config.mjs', 'next.config.ts']) {
    const content = await getRepoFileContent(owner, repo, nextConfig, branch);
    if (content) {
      scannedFiles.push(nextConfig);
      serviceSignals['Vercel'].configMatch = true;
      serviceSignals['Vercel'].signals.push(`${nextConfig} found`);
      break;
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
