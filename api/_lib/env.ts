export interface ServerEnv {
  readonly supabaseUrl: string;
  readonly supabasePublishableKey: string;
  readonly supabaseServiceRoleKey: string;
  readonly appOrigin: string;
}

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

const REQUIRED_VARIABLES = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'APP_ORIGIN',
] as const;

const requireValue = (source: EnvironmentSource, name: typeof REQUIRED_VARIABLES[number]): string => {
  const value = source[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const parseHttpsOrigin = (value: string, variableName: 'SUPABASE_URL' | 'APP_ORIGIN'): string => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${variableName} must be an absolute HTTPS URL`);
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error(`${variableName} must be an absolute HTTPS URL`);
  }
  return variableName === 'APP_ORIGIN' ? parsed.origin : parsed.toString().replace(/\/$/, '');
};

export function getServerEnv(source: EnvironmentSource = process.env): ServerEnv {
  const values = Object.fromEntries(
    REQUIRED_VARIABLES.map((name) => [name, requireValue(source, name)]),
  ) as Record<typeof REQUIRED_VARIABLES[number], string>;

  return Object.freeze({
    supabaseUrl: parseHttpsOrigin(values.SUPABASE_URL, 'SUPABASE_URL'),
    supabasePublishableKey: values.SUPABASE_PUBLISHABLE_KEY,
    supabaseServiceRoleKey: values.SUPABASE_SERVICE_ROLE_KEY,
    appOrigin: parseHttpsOrigin(values.APP_ORIGIN, 'APP_ORIGIN'),
  });
}
