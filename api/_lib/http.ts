export const JSON_HEADERS = Object.freeze({
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
});

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function methodNotAllowed(allowed: readonly string[]): Response {
  return new Response(JSON.stringify({ kind: 'invalid', message: 'Method not allowed' }), {
    status: 405,
    headers: { ...JSON_HEADERS, Allow: allowed.join(', ') },
  });
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new TypeError('Request body must be valid JSON');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Request body must be a JSON object');
  }
  return value as Record<string, unknown>;
}

export function handleApiError(error: unknown): Response {
  if (error instanceof TypeError || error instanceof RangeError) {
    return jsonResponse({ kind: 'invalid', message: error.message }, 400);
  }
  console.error(error);
  return jsonResponse({ kind: 'unavailable', message: 'Service temporarily unavailable' }, 503);
}
