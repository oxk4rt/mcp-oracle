/**
 * @project    MCP_Oracle
 * @author     oxk4rt <oxkarteg@gmail.com>
 * @assistant  Claude (Anthropic) — arquitectura y desarrollo conjunto
 * @license    MIT (ver LICENSE)
 */
import { readFileSync } from "fs";

interface ProjectsConfig {
  env_aliases: Record<string, string[]>;
  projects: Project[];
}

interface Project {
  code: string;
  aliases: string[];
  default_env: string;
  default_schema?: string;
  environments: Record<string, EnvConfig>;
}

interface EnvConfig {
  host: string;
  port: number;
  service: string;
}

export interface ResolvedConnection {
  poolKey: string;
  user: string;
  password: string;
  connectString: string;
  defaultSchema: string;
}

let config: ProjectsConfig | null = null;

function loadConfig(): ProjectsConfig {
  if (config) return config;
  const path = process.env.MCP_ORACLE_PROJECTS_PATH;
  if (!path) throw new Error("MCP_ORACLE_PROJECTS_PATH env var not set");
  config = JSON.parse(readFileSync(path, "utf-8")) as ProjectsConfig;
  return config;
}

function resolveEnv(cfg: ProjectsConfig, envAlias: string): string {
  const lower = envAlias.toLowerCase();
  for (const [canonical, aliases] of Object.entries(cfg.env_aliases)) {
    if (canonical === lower || aliases.includes(lower)) return canonical;
  }
  throw new Error(`Unknown environment alias: "${envAlias}"`);
}

function resolveProject(cfg: ProjectsConfig, projectAlias: string): Project {
  const lower = projectAlias.toLowerCase();
  for (const project of cfg.projects) {
    if (
      project.code.toLowerCase() === lower ||
      project.aliases.some((a) => a.toLowerCase() === lower)
    ) {
      return project;
    }
  }
  throw new Error(`Unknown project alias: "${projectAlias}"`);
}

function readCredentials(code: string, env: string): { user: string; password: string } {
  const prefix = `${code.toUpperCase()}__${env.toUpperCase()}__`;
  const userKey = `${prefix}USER`;
  const passKey = `${prefix}PASS`;
  const user = process.env[userKey];
  const password = process.env[passKey];
  if (!user) throw new Error(`Missing env var: ${userKey}`);
  if (!password) throw new Error(`Missing env var: ${passKey}`);
  return { user, password };
}

export function resolveConnection(projectAlias: string, envAlias?: string): ResolvedConnection {
  const cfg = loadConfig();
  const project = resolveProject(cfg, projectAlias);
  const env = envAlias ? resolveEnv(cfg, envAlias) : project.default_env;

  const envConfig = project.environments[env];
  if (!envConfig) {
    throw new Error(`Project "${project.code}" has no environment "${env}"`);
  }

  const { user, password } = readCredentials(project.code, env);
  const connectString = `${envConfig.host}:${envConfig.port}/${envConfig.service}`;

  return {
    poolKey: `${project.code}__${env}`,
    user,
    password,
    connectString,
    defaultSchema: (project.default_schema ?? user).toUpperCase(),
  };
}

export function listProjects(): Array<{ code: string; aliases: string[]; environments: string[]; default_env: string }> {
  const cfg = loadConfig();
  return cfg.projects.map((p) => ({
    code: p.code,
    aliases: p.aliases,
    environments: Object.keys(p.environments),
    default_env: p.default_env,
  }));
}
