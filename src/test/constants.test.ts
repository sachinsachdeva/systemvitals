import * as assert from 'assert';
import { test } from 'node:test';
import { Units, UnitLabels, MemMappings, FreqMappings, DiskSpaceFormat, DiskSpaceFormatMappings } from '../constants';

test('unit labels read as byte units, not enum member names', () => {
    // Units[Units.G] is "G" and Units[Units.None] is "None", which is what the
    // disk display used to render.
    assert.strictEqual(UnitLabels[Units.None], 'B');
    assert.strictEqual(UnitLabels[Units.K], 'KB');
    assert.strictEqual(UnitLabels[Units.M], 'MB');
    assert.strictEqual(UnitLabels[Units.G], 'GB');
});

test('every unit the settings offer has a divisor', () => {
    // These keys are the enums contributed in package.json; a missing entry
    // would make the divisor undefined and render NaN in the status bar.
    ['GB', 'MB', 'KB', 'B'].forEach(unit => {
        assert.strictEqual(typeof MemMappings[unit], 'number', `no divisor for mem unit ${unit}`);
    });
    ['GHz', 'MHz', 'KHz', 'Hz'].forEach(unit => {
        assert.strictEqual(typeof FreqMappings[unit], 'number', `no divisor for freq unit ${unit}`);
    });
});

test('unit divisors are binary multiples', () => {
    assert.strictEqual(MemMappings['B'], 1);
    assert.strictEqual(MemMappings['KB'], 1024);
    assert.strictEqual(MemMappings['MB'], 1024 * 1024);
    assert.strictEqual(MemMappings['GB'], 1024 * 1024 * 1024);
});

test('every disk format the settings offer maps to an enum member', () => {
    ['PercentRemaining', 'PercentUsed', 'Remaining', 'UsedOutOfTotal'].forEach(format => {
        assert.strictEqual(
            typeof DiskSpaceFormatMappings[format], 'number', `no mapping for disk format ${format}`);
    });
    assert.strictEqual(DiskSpaceFormatMappings['PercentUsed'], DiskSpaceFormat.PercentUsed);
});
