# Change Log

## [1.0.1]

- Disk space is now usable on macOS without configuration. It previously listed all eight APFS volumes that macOS reports for a single physical disk, and the most obvious of them was misleading: `/` is the sealed read-only system snapshot, which reports roughly 95% free however full the machine is. The data volume is now shown in its place, labelled `/`.
- Volumes are identified by mount point rather than device node, so entries read `/` or `/home` instead of `/dev/disk3s5`.
- `systemvitals.disk.drives` now accepts mount points as well as device names, and still overrides the filtering entirely when set.

## [1.0.0]

First release of System Vitals, forked from [resmon](https://github.com/Njanderson/resmon) 1.0.7.

- Settings moved from the `resmon.*` namespace to `systemvitals.*`. If you are coming from resmon, your existing settings will not carry over and need to be set again. This keeps the two extensions independent when both are installed, rather than sharing one set of keys.
- Added GPU utilization and GPU memory monitoring on macOS, including Apple Silicon (M-series). Statistics are read from the IOKit registry via `ioreg`, which needs no elevated privileges. Both metrics hide themselves automatically on machines that do not report GPU statistics.
- Fixed `systeminformation` being pruned from the packaged extension, which produced a build that failed at activation once installed.
- Changed activation from `*` to `onStartupFinished`, so the extension no longer delays editor startup. This raises the minimum VS Code version to 1.53.
- Modernized the build: TypeScript 5, `@types/vscode` in place of the deprecated `vscode` module, and no `postinstall` hook.

## Inherited history

Releases below are from the upstream resmon project, retained for context.

### [1.0.7]
- Changed underlying CPU frequency API, added hiding battery/CPU temp information if the device lacks a battery/doesn't support CPU temp sensing, added some clarifications about CPU frequency behavior on Windows.

### [1.0.6]
- Added DiskSpace, CPU Temperature. Adjusted battery icon.

### [1.0.5]
- Refactored code heavily, addressed Github issue with memory.used versus memory.active.

### [1.0.4]
- Added icon for store.

### [1.0.3]
- Changed icons. Added choosable units.

### [1.0.2]
- Actually properly added systeminformation as a real dependency.

### [1.0.1]
- Properly added systeminformation as a real dependency

### [1.0.0]
- Initial release
