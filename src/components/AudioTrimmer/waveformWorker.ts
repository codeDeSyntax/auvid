// ─── waveformWorker.ts ────────────────────────────────────────────────────────
// Runs entirely off the main UI thread.
// Responsibilities:
//   • Fetch audio bytes for a file path
//   • Decode them with AudioContext (available in workers in Electron/Chromium)
//   • Compute min/max waveform peaks (two passes: coarse then full)
//   • Maintain an LRU cache so repeated decodes are instant
//   • Transfer results back to the main thread via zero-copy Transferables
//
// Message protocol:
//   IN  → { type: 'decode', path, id, coarseRes, fullRes }
//   IN  → { type: 'prefetch', path, coarseRes, fullRes }
//   IN  → { type: 'abort', id }
//   OUT → { type: 'progress', id, stage: 'coarse'|'full', mins, maxs, length, duration, sampleRate, channels }
//   OUT → { type: 'error', id, message }
//   OUT → { type: 'cached', path }   (emitted when a prefetch populates the cache)

// ── LRU Cache ─────────────────────────────────────────────────────────────────

interface CacheEntry {
  mins: Float32Array;
  maxs: Float32Array;
  coarseMins: Float32Array;
  coarseMaxs: Float32Array;
  duration: number;
  sampleRate: number;
  channels: number;
}

const CACHE_CAPACITY = 12;

class LRUCache {
  private map = new Map<string, CacheEntry>();

  get(key: string): CacheEntry | undefined {
    const val = this.map.get(key);
    if (val !== undefined) {
      // Move to end (most recently used)
      this.map.delete(key);
      this.map.set(key, val);
    }
    return val;
  }

  set(key: string, val: CacheEntry): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, val);
    if (this.map.size > CACHE_CAPACITY) {
      // Evict LRU (first entry)
      this.map.delete(this.map.keys().next().value!);
    }
  }

  has(key: string): boolean {
    return this.map.has(key);
  }
}

const cache = new LRUCache();

// Track in-flight aborts
const activeAborts = new Map<string, AbortController>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function filePathToMediaUrl(filePath: string): string {
  const encoded = encodeURIComponent(filePath);
  return `media://local/?path=${encoded}`;
}

/**
 * Compute min/max peaks for each pixel column.
 * Uses stride sampling — O(resolution * probesPerCol), bounded and fast.
 */
function computePeaks(
  channelData: Float32Array[],
  numSamples: number,
  resolution: number,
  probesPerCol = 64,
): { mins: Float32Array; maxs: Float32Array } {
  const numChannels = channelData.length;
  const samplesPerPixel = Math.max(1, Math.floor(numSamples / resolution));
  const isMono = numChannels === 1;
  const ch0 = channelData[0];

  const mins = new Float32Array(resolution);
  const maxs = new Float32Array(resolution);

  for (let px = 0; px < resolution; px++) {
    const start = px * samplesPerPixel;
    const end = Math.min(start + samplesPerPixel, numSamples);
    const blockSize = end - start;
    const step = Math.max(1, Math.floor(blockSize / probesPerCol));

    let min = 1;
    let max = -1;

    if (isMono) {
      for (let i = start; i < end; i += step) {
        const s = ch0[i];
        if (s < min) min = s;
        if (s > max) max = s;
      }
    } else {
      for (let i = start; i < end; i += step) {
        let s = 0;
        for (let c = 0; c < numChannels; c++) s += channelData[c][i];
        s /= numChannels;
        if (s < min) min = s;
        if (s > max) max = s;
      }
    }

    mins[px] = min === 1 ? 0 : min;
    maxs[px] = max === -1 ? 0 : max;
  }

  return { mins, maxs };
}

// ── Core decode pipeline ──────────────────────────────────────────────────────

async function decodeFile(
  path: string,
  coarseRes: number,
  fullRes: number,
  signal: AbortSignal,
  onCoarse: (entry: { coarseMins: Float32Array; coarseMaxs: Float32Array; duration: number; sampleRate: number; channels: number }) => void,
): Promise<CacheEntry> {
  // 1. Fetch
  const url = filePathToMediaUrl(path);
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching audio`);
  const arrayBuffer = await response.arrayBuffer();
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

  // 2. Decode — AudioContext is available in Electron workers (Chromium)
  const audioCtx = new AudioContext();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0)); // slice to avoid detach
  await audioCtx.close();
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

  const numChannels = decoded.numberOfChannels;
  const numSamples = decoded.length;
  const channelData: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channelData.push(decoded.getChannelData(c));
  }

  // 3. Coarse pass — fast preview (16 probes/col)
  const { mins: coarseMins, maxs: coarseMaxs } = computePeaks(channelData, numSamples, coarseRes, 16);
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

  onCoarse({ coarseMins, coarseMaxs, duration: decoded.duration, sampleRate: decoded.sampleRate, channels: numChannels });

  // 4. Full resolution pass — high fidelity (64 probes/col)
  const { mins, maxs } = computePeaks(channelData, numSamples, fullRes, 64);
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

  const entry: CacheEntry = {
    mins, maxs, coarseMins, coarseMaxs,
    duration: decoded.duration,
    sampleRate: decoded.sampleRate,
    channels: numChannels,
  };
  cache.set(path, entry);
  return entry;
}

// ── Message handler ───────────────────────────────────────────────────────────

self.onmessage = async (ev: MessageEvent) => {
  const msg = ev.data as {
    type: 'decode' | 'prefetch' | 'abort';
    path: string;
    id: string;
    coarseRes?: number;
    fullRes?: number;
  };

  if (msg.type === 'abort') {
    const ctrl = activeAborts.get(msg.id);
    if (ctrl) { ctrl.abort(); activeAborts.delete(msg.id); }
    return;
  }

  const { path, coarseRes = 128, fullRes = 1400 } = msg;
  const isPrefetch = msg.type === 'prefetch';
  const id = isPrefetch ? `__prefetch__${path}` : msg.id;

  // Cancel any in-flight decode for this slot
  const prev = activeAborts.get(id);
  if (prev) prev.abort();

  const controller = new AbortController();
  activeAborts.set(id, controller);
  const { signal } = controller;

  try {
    // ── Cache hit ──
    const cached = cache.get(path);
    if (cached && cached.mins.length >= fullRes) {
      if (!isPrefetch) {
        // Send coarse immediately then full
        const cm = new Float32Array(cached.coarseMins);
        const cx = new Float32Array(cached.coarseMaxs);
        self.postMessage(
          { type: 'progress', id, stage: 'coarse', mins: cm, maxs: cx, length: coarseRes, duration: cached.duration, sampleRate: cached.sampleRate, channels: cached.channels },
          { transfer: [cm.buffer, cx.buffer] },
        );
        const fm = new Float32Array(cached.mins);
        const fx = new Float32Array(cached.maxs);
        self.postMessage(
          { type: 'progress', id, stage: 'full', mins: fm, maxs: fx, length: fullRes, duration: cached.duration, sampleRate: cached.sampleRate, channels: cached.channels },
          { transfer: [fm.buffer, fx.buffer] },
        );
      }
      activeAborts.delete(id);
      return;
    }

    // ── Cache miss: decode ──
    const entry = await decodeFile(path, coarseRes, fullRes, signal, (coarse) => {
      if (isPrefetch) return;
      const cm = new Float32Array(coarse.coarseMins);
      const cx = new Float32Array(coarse.coarseMaxs);
      self.postMessage(
        { type: 'progress', id, stage: 'coarse', mins: cm, maxs: cx, length: coarseRes, duration: coarse.duration, sampleRate: coarse.sampleRate, channels: coarse.channels },
        { transfer: [cm.buffer, cx.buffer] },
      );
    });

    if (signal.aborted) return;

    if (isPrefetch) {
      self.postMessage({ type: 'cached', path });
    } else {
      const fm = new Float32Array(entry.mins);
      const fx = new Float32Array(entry.maxs);
      self.postMessage(
        { type: 'progress', id, stage: 'full', mins: fm, maxs: fx, length: fullRes, duration: entry.duration, sampleRate: entry.sampleRate, channels: entry.channels },
        { transfer: [fm.buffer, fx.buffer] },
      );
    }
  } catch (err: unknown) {
    if ((err as DOMException)?.name === 'AbortError' || signal.aborted) return;
    const message = err instanceof Error ? err.message : String(err);
    if (!isPrefetch) self.postMessage({ type: 'error', id, message });
  } finally {
    activeAborts.delete(id);
  }
};
