import { performance } from "node:perf_hooks";

const target = process.argv[2];
if (!target) {
  console.error("Uso: node scripts/load-test.mjs <url>");
  process.exit(1);
}

const stages = [1, 5, 10, 25];
const requestsPerStage = 100;
const timeoutMs = 10_000;

function percentile(values, ratio) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

async function requestOnce() {
  const startedAt = performance.now();
  try {
    const response = await fetch(target, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "encountry-controlled-load-test/1.0" },
    });
    await response.arrayBuffer();
    return {
      duration: performance.now() - startedAt,
      ok: response.ok,
      status: response.status,
      cache: response.headers.get("x-vercel-cache") ?? "-",
    };
  } catch (error) {
    return {
      duration: performance.now() - startedAt,
      ok: false,
      status: error.name,
      cache: "-",
    };
  }
}

for (const concurrency of stages) {
  const results = [];
  const startedAt = performance.now();
  let nextRequest = 0;

  async function worker() {
    while (nextRequest < requestsPerStage) {
      nextRequest += 1;
      results.push(await requestOnce());
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  const elapsedSeconds = (performance.now() - startedAt) / 1_000;
  const durations = results.map((result) => result.duration);
  const failures = results.filter((result) => !result.ok);
  const statuses = Object.groupBy(results, (result) => String(result.status));
  const caches = Object.groupBy(results, (result) => result.cache);

  console.log(JSON.stringify({
    concurrency,
    requests: results.length,
    requestsPerSecond: Number((results.length / elapsedSeconds).toFixed(2)),
    latencyMs: {
      min: Number(Math.min(...durations).toFixed(1)),
      p50: Number(percentile(durations, 0.50).toFixed(1)),
      p95: Number(percentile(durations, 0.95).toFixed(1)),
      p99: Number(percentile(durations, 0.99).toFixed(1)),
      max: Number(Math.max(...durations).toFixed(1)),
    },
    errors: failures.length,
    statuses: Object.fromEntries(Object.entries(statuses).map(([key, values]) => [key, values.length])),
    cache: Object.fromEntries(Object.entries(caches).map(([key, values]) => [key, values.length])),
  }));
}
