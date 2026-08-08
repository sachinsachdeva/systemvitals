'use strict';

export enum Units {
    None = 1,
    K = 1024,
    M = 1024 * 1024,
    G = 1024 * 1024 * 1024
}

export enum DiskSpaceFormat {
    PercentUsed,
    PercentRemaining,
    Remaining,
    UsedOutOfTotal
}

export interface DiskSpaceFormatLookup {
    [unit: string]: DiskSpaceFormat;
}

export interface UnitLookup {
    [unit: string]: number;
}

export var DiskSpaceFormatMappings: DiskSpaceFormatLookup = {
    "PercentUsed": DiskSpaceFormat.PercentUsed,
    "PercentRemaining": DiskSpaceFormat.PercentRemaining,
    "Remaining": DiskSpaceFormat.Remaining,
    "UsedOutOfTotal": DiskSpaceFormat.UsedOutOfTotal,
};

export var FreqMappings: UnitLookup = {
    "GHz": Units.G,
    "MHz": Units.M,
    "KHz": Units.K,
    "Hz": Units.None,
};

// Units[Units.G] yields "G", and Units[Units.None] yields "None", neither of
// which is a unit anyone wants to read in a status bar.
export var UnitLabels: { [unit: number]: string } = {
    [Units.None]: "B",
    [Units.K]: "KB",
    [Units.M]: "MB",
    [Units.G]: "GB",
};

export var MemMappings: UnitLookup = {
    "GB": Units.G,
    "MB": Units.M,
    "KB": Units.K,
    "B": Units.None,
};