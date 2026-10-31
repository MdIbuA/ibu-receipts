/* Asks the Bedrock reader Lambda to read a job description. match.ts checks the answer before use. */

export async function requestReading(url: string, text: string, timeoutMs = 25_000): Promise<unknown> {
  const timer = new AbortController();
  const timeout = setTimeout(() => timer.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: timer.signal,
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}
