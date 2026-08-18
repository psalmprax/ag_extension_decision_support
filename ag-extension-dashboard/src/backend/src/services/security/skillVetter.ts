import { logger } from '@/utils/logger';
import * as crypto from 'crypto';

export interface SkillMetadata {
  name: string;
  source: string;
  version: string;
  author: string;
  description: string;
  permissions: string[];
  dependencies: string[];
  installDate: string;
  hash: string;
  trustScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  vetted: boolean;
  vettedAt?: string;
  flags: string[];
}

export interface VettingResult {
  passed: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  trustScore: number;
  flags: string[];
  recommendations: string[];
}

export class SkillVetter {
  private static instance: SkillVetter;
  private vettedSkills: Map<string, SkillMetadata> = new Map();
  private blockedHashes: Set<string> = new Set();
  private allowedOrigins: string[] = [
    'github.com/openclaw/skills',
    'github.com/bgtamang/AgriClaw',
    'github.com/Imbad0202/academic-research-skills',
    'clawhub.ai',
    'lobehub.com',
  ];

  private suspiciousPatterns = [
    /eval\s*\(/,
    /Function\s*\(/,
    /exec\s*\(/,
    /spawn\s*\(/,
    /child_process/,
    /require\s*\(\s*['"]child_process['"]\s*\)/,
    /process\.env\s*\[/,
    /fs\.writeFile/,
    /fs\.appendFile/,
    /net\.connect/,
    /http\.request/,
    /fetch\s*\(\s*['"]https?:\/\//,
    /__proto__/,
    /constructor\s*\[/,
    /prototype\s*\[/,
    /Buffer\s*\(/,
    /global\s*\[/,
    /process\.mainModule/,
    /require\.resolve/,
    /module\.exports\s*=\s*function/,
    /\bsetTimeout\s*\(\s*.*,\s*0\s*\)/,
    /setImmediate\s*\(/,
    /process\.exit/,
    /process\.kill/,
    /SIGKILL/,
    /SIGTERM/,
  ];

  private static readonly RISK_WEIGHTS = {
    evalUsage: 35,
    networkAccess: 20,
    fileWrite: 25,
    envAccess: 15,
    processControl: 30,
    protoManipulation: 30,
    obfuscation: 25,
    unknownOrigin: 20,
    noDescription: 10,
    excessivePerms: 40,
  };

  static getInstance(): SkillVetter {
    if (!SkillVetter.instance) {
      SkillVetter.instance = new SkillVetter();
    }
    return SkillVetter.instance;
  }

  async vetSkill(skill: {
    name: string;
    source: string;
    code?: string;
    description?: string;
    permissions?: string[];
    dependencies?: string[];
    version?: string;
    author?: string;
  }): Promise<VettingResult> {
    const flags: string[] = [];
    const recommendations: string[] = [];
    let riskScore = 0;

    const { code, source, description, permissions = [], dependencies = [] } = skill;

    // Step 1: Source authentication
    const sourceCheck = this.checkSource(source);
    if (!sourceCheck.trusted) {
      riskScore += SkillVetter.RISK_WEIGHTS.unknownOrigin;
      flags.push(`Unverified source: ${source}`);
      recommendations.push('Verify skill origin against known registries');
    }

    // Step 2: Code review (if code provided)
    if (code) {
      const codeCheck = this.reviewCode(code);
      riskScore += codeCheck.score;
      flags.push(...codeCheck.flags);
      recommendations.push(...codeCheck.recommendations);
    }

    // Step 3: Permission scope evaluation
    const permCheck = this.evaluatePermissions(permissions);
    riskScore += permCheck.score;
    flags.push(...permCheck.flags);
    recommendations.push(...permCheck.recommendations);

    // Step 4: Dependency check
    const depCheck = this.checkDependencies(dependencies);
    riskScore += depCheck.score;
    flags.push(...depCheck.flags);

    // Step 5: Description quality
    if (!description || description.length < 20) {
      riskScore += SkillVetter.RISK_WEIGHTS.noDescription;
      flags.push('Missing or insufficient description');
      recommendations.push('Add detailed skill description');
    }

    // Calculate trust score (0-100)
    const trustScore = Math.max(0, 100 - riskScore);

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'extreme';
    if (trustScore >= 80) riskLevel = 'low';
    else if (trustScore >= 60) riskLevel = 'medium';
    else if (trustScore >= 40) riskLevel = 'high';
    else riskLevel = 'extreme';

    const passed = riskLevel === 'low' || riskLevel === 'medium';

    const result: VettingResult = {
      passed,
      riskLevel,
      trustScore,
      flags,
      recommendations,
    };

    logger.info(`Skill vetting: ${skill.name} — ${riskLevel} risk (score: ${trustScore})`);

    return result;
  }

  private checkSource(source: string): { trusted: boolean } {
    const isTrusted = this.allowedOrigins.some((origin: string) =>
      source.includes(origin) || source.startsWith(origin)
    );
    return { trusted: isTrusted };
  }

  private reviewCode(code: string): { score: number; flags: string[]; recommendations: string[] } {
    let score = 0;
    const flags: string[] = [];
    const recommendations: string[] = [];

    for (const pattern of this.suspiciousPatterns) {
      const matches = code.match(pattern);
      if (matches) {
        const patternName = pattern.source.substring(0, 30);
        flags.push(`Suspicious pattern detected: ${patternName}`);

        if (pattern.source.includes('eval') || pattern.source.includes('Function')) {
          score += SkillVetter.RISK_WEIGHTS.evalUsage;
          recommendations.push('Remove eval/Function usage — use safe alternatives');
        } else if (pattern.source.includes('child_process') || pattern.source.includes('exec') || pattern.source.includes('spawn')) {
          score += SkillVetter.RISK_WEIGHTS.processControl;
          recommendations.push('Remove child process execution — execute within sandbox');
        } else if (pattern.source.includes('fetch') || pattern.source.includes('http') || pattern.source.includes('net')) {
          score += SkillVetter.RISK_WEIGHTS.networkAccess;
        } else if (pattern.source.includes('writeFile') || pattern.source.includes('appendFile')) {
          score += SkillVetter.RISK_WEIGHTS.fileWrite;
        } else if (pattern.source.includes('env')) {
          score += SkillVetter.RISK_WEIGHTS.envAccess;
        } else if (pattern.source.includes('exit') || pattern.source.includes('kill') || pattern.source.includes('SIG')) {
          score += SkillVetter.RISK_WEIGHTS.processControl;
        } else if (pattern.source.includes('__proto__') || pattern.source.includes('constructor') || pattern.source.includes('prototype')) {
          score += SkillVetter.RISK_WEIGHTS.protoManipulation;
        }
      }
    }

    // Check for obfuscation (high entropy strings, base64 encoded code)
    const base64Blocks = code.match(/(?:['"](?:data:[^;]+;base64,)?[A-Za-z0-9+/]{80,}={0,2}['"])/g);
    if (base64Blocks && base64Blocks.length >= 3) {
      score += SkillVetter.RISK_WEIGHTS.obfuscation;
      flags.push('Possible code obfuscation: multiple large base64 strings');
      recommendations.push('Review base64 encoded content for hidden payloads');
    }

    return { score, flags, recommendations };
  }

  private evaluatePermissions(permissions: string[]): { score: number; flags: string[]; recommendations: string[] } {
    let score = 0;
    const flags: string[] = [];
    const recommendations: string[] = [];

    const dangerousPerms = ['filesystem:write', 'network:outbound', 'process:spawn', 'env:read', 'shell:execute'];
    const criticalPerms = ['filesystem:write:all', 'network:unrestricted', 'process:full', 'shell:unrestricted'];

    const criticalCount = permissions.filter(p => criticalPerms.includes(p)).length;
    if (criticalCount > 0) {
      score += SkillVetter.RISK_WEIGHTS.excessivePerms + (criticalCount - 1) * 20;
      flags.push('Excessive permissions requested');
      recommendations.push('Request minimum required permissions only');
    }

    const dangerousCount = permissions.filter(p => dangerousPerms.includes(p)).length;
    if (dangerousCount > 2) {
      score += 20;
      flags.push(`Multiple dangerous permissions: ${dangerousCount}`);
    }

    return { score, flags, recommendations };
  }

  private checkDependencies(dependencies: string[]): { score: number; flags: string[] } {
    let score = 0;
    const flags: string[] = [];

    // Check for known vulnerable packages
    const vulnerablePackages = ['event-stream@3.3.6', 'flatmap-stream', 'ua-parser-js@0.7.29'];
    for (const dep of dependencies) {
      if (vulnerablePackages.some(v => dep.includes(v))) {
        score += 20;
        flags.push(`Known vulnerable dependency: ${dep}`);
      }
    }

    // Check for excessive dependencies
    if (dependencies.length > 20) {
      score += 5;
      flags.push(`Excessive dependencies: ${dependencies.length}`);
    }

    return { score, flags };
  }

  computeHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  registerVettedSkill(metadata: SkillMetadata): void {
    this.vettedSkills.set(metadata.name, metadata);
    this.blockedHashes.add(metadata.hash);
    logger.info(`Skill registered as vetted: ${metadata.name}`);
  }

  isSkillVetted(name: string): boolean {
    return this.vettedSkills.has(name);
  }

  getSkillMetadata(name: string): SkillMetadata | undefined {
    return this.vettedSkills.get(name);
  }

  getAllVettedSkills(): SkillMetadata[] {
    return Array.from(this.vettedSkills.values());
  }

  blockSkill(hash: string): void {
    this.blockedHashes.add(hash);
    logger.warn(`Skill blocked by hash: ${hash}`);
  }

  isHashBlocked(hash: string): boolean {
    return this.blockedHashes.has(hash);
  }

  getRiskLevelDescription(level: string): string {
    const descriptions: Record<string, string> = {
      low: 'Safe to install and use. No suspicious patterns detected.',
      medium: 'Use with caution. Review flagged patterns before installing.',
      high: 'Not recommended. Significant security concerns detected.',
      extreme: 'DO NOT INSTALL. Critical security risks detected.',
    };
    return descriptions[level] || 'Unknown risk level';
  }
}

export const skillVetter = SkillVetter.getInstance();
