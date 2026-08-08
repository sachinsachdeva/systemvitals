import * as assert from 'assert';
import { test } from 'node:test';
import { parsePerformanceStatistics, AppleGpuSampler } from '../appleGpu';

// Trimmed from real `ioreg -r -d 1 -w 0 -c IOAccelerator` output on an Apple M4.
// The "In use system memory (driver)" sibling key is kept deliberately: it is
// the trap the parser has to avoid.
const M4_SAMPLE = `+-o AGXAcceleratorG16G  <class AGXAcceleratorG16G, id 0x10000039c, registered, matched, active, busy 0 (309 ms), retain 59>
    {
      "IOMatchedAtBoot" = Yes
      "PerformanceStatistics" = {"In use system memory (driver)"=0,"Alloc system memory"=2181693440,"Tiler Utilization %"=30,"recoveryCount"=0,"Renderer Utilization %"=29,"Device Utilization %"=30,"In use system memory"=356089856}
      "model" = "Apple M4"
      "gpu-core-count" = 10
    }
`;

test('parses utilization and memory from real ioreg output', () => {
    let stats = parsePerformanceStatistics(M4_SAMPLE);

    assert.ok(stats !== null);
    assert.strictEqual(stats!.utilization, 30);
    assert.strictEqual(stats!.inUseMemory, 356089856);
    assert.strictEqual(stats!.allocatedMemory, 2181693440);
});

test('does not mistake the "(driver)" sibling for in-use memory', () => {
    // "In use system memory (driver)" is 0 and appears first, so a pattern
    // without the closing quote would report 0 bytes in use.
    let stats = parsePerformanceStatistics(M4_SAMPLE);

    assert.notStrictEqual(stats!.inUseMemory, 0);
    assert.strictEqual(stats!.inUseMemory, 356089856);
});

test('returns null rather than throwing on unusable input', () => {
    assert.strictEqual(parsePerformanceStatistics(''), null);
    assert.strictEqual(parsePerformanceStatistics('not ioreg output at all'), null);
    // Truncated before the statistics block closes.
    assert.strictEqual(parsePerformanceStatistics('"PerformanceStatistics" = {"Alloc'), null);
});

test('returns null when utilization is absent, even if memory is present', () => {
    // Utilization is the one value the feature cannot do without, so a machine
    // reporting only memory counts as unsupported.
    let stats = parsePerformanceStatistics('"PerformanceStatistics" = {"Alloc system memory"=123}');

    assert.strictEqual(stats, null);
});

test('defaults missing memory values to zero', () => {
    let stats = parsePerformanceStatistics('"PerformanceStatistics" = {"Device Utilization %"=42}');

    assert.strictEqual(stats!.utilization, 42);
    assert.strictEqual(stats!.inUseMemory, 0);
    assert.strictEqual(stats!.allocatedMemory, 0);
});

test('reads the first accelerator when a machine reports several', () => {
    let dualGpu = '"PerformanceStatistics" = {"Device Utilization %"=7}\n'
        + '"PerformanceStatistics" = {"Device Utilization %"=88}';

    assert.strictEqual(parsePerformanceStatistics(dualGpu)!.utilization, 7);
});

test('sampler resolves instead of rejecting, on every platform', async () => {
    // ResMon.update() gathers resources with Promise.all and has no error
    // handling, so a rejection here would freeze the whole status bar.
    let stats = await new AppleGpuSampler().sample();

    if (process.platform !== 'darwin') {
        assert.strictEqual(stats, null, 'GPU statistics must be unavailable off macOS');
        return;
    }

    // On macOS the values are real, so assert their shape rather than exact numbers.
    if (stats !== null) {
        assert.ok(stats.utilization >= 0 && stats.utilization <= 100);
        assert.ok(stats.inUseMemory >= 0);
        assert.ok(stats.allocatedMemory >= 0);
    }
});

test('sampler serves concurrent callers from one sample', async () => {
    // Two resources each call isShown() and getDisplay() per tick. Without the
    // cache that is four ioreg invocations where one will do.
    let sampler = new AppleGpuSampler();
    let results = await Promise.all([sampler.sample(), sampler.sample(), sampler.sample(), sampler.sample()]);

    let distinct = new Set(results.map(r => JSON.stringify(r)));
    assert.strictEqual(distinct.size, 1, 'concurrent callers should observe one identical sample');
});
