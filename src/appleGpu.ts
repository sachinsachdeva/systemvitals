'use strict';

import { execFile } from 'child_process';

/**
 * GPU statistics scraped from the IOKit registry on macOS.
 *
 * On Apple Silicon there is no fixed VRAM partition: the GPU shares system
 * memory, so the two memory figures are "currently mapped" and "claimed from
 * the system by the driver" rather than used/total of a dedicated pool.
 */
export interface GpuStats {
    /** "Device Utilization %", 0-100. An instantaneous snapshot, not an interval average. */
    utilization: number;
    /** "In use system memory", in bytes. */
    inUseMemory: number;
    /** "Alloc system memory", in bytes. */
    allocatedMemory: number;
}

// Recurse one level from each IOAccelerator node so we pick up its properties,
// with unlimited line width so the PerformanceStatistics dict isn't wrapped.
const IOREG_ARGS: string[] = ['-r', '-d', '1', '-w', '0', '-c', 'IOAccelerator'];

// The whole registry dump for one node is ~46 KB on an M4; allow generous room
// for machines that expose several accelerators.
const IOREG_MAX_BUFFER: number = 4 * 1024 * 1024;

// Two resources each ask whether they are shown and then what to display, so a
// single tick reads the sampler four times. Collapsing those into one ioreg
// invocation keeps the cost at ~20ms per tick. The 200ms floor on
// systemvitals.updatefrequencyms guarantees this window never spans two ticks.
const CACHE_WINDOW_MS: number = 100;

const PERFORMANCE_STATISTICS_PATTERN = /"PerformanceStatistics" = \{([^}]*)\}/;

/**
 * Extracts GPU statistics from the output of
 * `ioreg -r -d 1 -w 0 -c IOAccelerator`.
 *
 * Pure: takes text, returns data, never touches the system. Returns null if
 * the output holds no readable statistics, which is how this feature detects
 * that a machine cannot report GPU utilization.
 */
export function parsePerformanceStatistics(ioregOutput: string): GpuStats | null {
    // On a multi-GPU Mac ioreg emits several nodes; read the first one that
    // carries statistics.
    let statisticsBlock = PERFORMANCE_STATISTICS_PATTERN.exec(ioregOutput);
    if (statisticsBlock === null) {
        return null;
    }
    let statistics: string = statisticsBlock[1];

    // Utilization is the one value the feature cannot do without.
    let utilization: number | null = readStatistic(statistics, "Device Utilization %");
    if (utilization === null) {
        return null;
    }

    return {
        utilization: utilization,
        inUseMemory: readStatistic(statistics, "In use system memory") || 0,
        allocatedMemory: readStatistic(statistics, "Alloc system memory") || 0,
    };
}

/**
 * Reads a single `"key"=<integer>` entry out of a PerformanceStatistics dict.
 *
 * The closing quote in the pattern is load-bearing: without it "In use system
 * memory" would also match its sibling "In use system memory (driver)", which
 * is a different (and usually zero) value.
 */
function readStatistic(statistics: string, key: string): number | null {
    let escapedKey: string = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let match = new RegExp(`"${escapedKey}"=(\\d+)`).exec(statistics);
    if (match === null) {
        return null;
    }
    return parseInt(match[1], 10);
}

/**
 * Samples GPU statistics from the IOKit registry, caching briefly so that
 * several resources can share one `ioreg` invocation per update tick.
 *
 * Reading IOAccelerator requires no elevated privileges, unlike powermetrics.
 */
export class AppleGpuSampler {
    private _cachedStats: GpuStats | null;
    private _cachedAt: number;
    private _pending: Promise<GpuStats | null> | null;

    constructor() {
        this._cachedStats = null;
        this._cachedAt = Number.NEGATIVE_INFINITY;
        this._pending = null;
    }

    /**
     * Returns the current GPU statistics, or null when they are unavailable:
     * off macOS, on a Mac whose driver exposes no statistics, or when ioreg
     * fails.
     *
     * Never rejects. ResMon.update() gathers every resource with Promise.all
     * and has no error handling, so a single rejection would break the update
     * loop and freeze the whole status bar.
     */
    public sample(): Promise<GpuStats | null> {
        if (process.platform !== 'darwin') {
            return Promise.resolve(null);
        }

        if (Date.now() - this._cachedAt < CACHE_WINDOW_MS) {
            return Promise.resolve(this._cachedStats);
        }

        // Fold callers that arrive mid-flight into the running invocation.
        if (this._pending !== null) {
            return this._pending;
        }

        this._pending = this.readRegistry().then(stats => {
            this._cachedStats = stats;
            this._cachedAt = Date.now();
            this._pending = null;
            return stats;
        });

        return this._pending;
    }

    /**
     * Runs ioreg and parses its output, resolving to null on any failure.
     *
     * execFile is wrapped by hand rather than with util.promisify because the
     * pinned @types/node predates promisify's typings.
     */
    private readRegistry(): Promise<GpuStats | null> {
        return new Promise<GpuStats | null>(resolve => {
            execFile('ioreg', IOREG_ARGS, { maxBuffer: IOREG_MAX_BUFFER }, (error, stdout) => {
                if (error) {
                    resolve(null);
                    return;
                }

                try {
                    resolve(parsePerformanceStatistics(stdout.toString()));
                } catch (parseError) {
                    resolve(null);
                }
            });
        });
    }
}
