# System Vitals

Display CPU frequency and usage, GPU utilization, memory consumption, disk space, and battery percentage in the VS Code status bar — including **native Apple Silicon GPU monitoring**, which needs no elevated privileges.

> **A fork.** System Vitals is a fork of [resmon](https://github.com/Njanderson/resmon) by Nicholas Anderson, adding macOS GPU support and a modernized build. It is not affiliated with or endorsed by the original author. See [LICENSE.md](LICENSE.md) for the licensing situation, which is unresolved because the upstream project declares no license.

## Features

- **CPU** — usage percentage and current frequency
- **GPU** — utilization and memory in use (macOS, including M-series Apple Silicon)
- **Memory** — consumed out of total
- **Disk** — space remaining or used, per drive
- **Battery** — percentage remaining, hidden automatically on devices without a battery

## Screenshots

![Disk space feature](images/disk_space_screenshot.png).

## Requirements

None beyond VS Code 1.53 or newer. The `systeminformation` module is bundled with the extension, and macOS GPU statistics are read from the IOKit registry with `ioreg`, which requires no additional software and no elevated privileges.

## Extension Settings

- `resmon.show.cpuusage`: Show CPU Usage. In Windows, this percentage is calculated with processor time, which doesn't quite match the task manager figure.
- `resmon.show.cpufreq`: Show CPU Frequency. This may just display a static frequency on Windows.
- `resmon.show.mem`: Show consumed and total memory as a fraction.
- `resmon.show.battery`: Show battery percentage remaining.
- `resmon.show.disk`: Show disk space information.
- `resmon.show.cputemp`: Show CPU temperature. May not work without the lm-sensors module on Linux. May require running VS Code as admin on Windows.
- `resmon.show.gpu`: Show GPU utilization. macOS only; see GPU Monitoring below.
- `resmon.show.gpumem`: Show GPU memory in use. macOS only; see GPU Monitoring below.
- `resmon.gpu.unit`: Unit used for GPU memory (GB-B).
- `resmon.disk.format`: Configures how the disk space is displayed (percentage remaining/used, absolute remaining, used out of totel).
- `resmon.disk.drives`: Drives to show. For example, 'C:' on Windows, and '/dev/sda1' on Linux.
- `resmon.updatefrequencyms`: How frequently to query systeminformation. The minimum is 200 ms as to prevent accidentally updating so fast as to freeze up your machine.
- `resmon.freq.unit`: Unit used for the CPU frequency (GHz-Hz).
- `resmon.mem.unit`: Unit used for the RAM consumption (GB-B).
- `resmon.alignLeft`: Toggles the alignment of the status bar.
- `resmon.color`: Color of the status bar text in hex code (for example, #FFFFFF is white). The color must be in the format #RRGGBB, using hex digits.

## GPU Monitoring

GPU statistics are **macOS only**, and work on Apple Silicon (M-series) as well as Intel Macs. They are read from the IOKit registry with `ioreg`, which requires no elevated privileges — unlike `powermetrics`, which needs `sudo`. On any machine that does not report GPU statistics, both GPU metrics hide themselves automatically rather than showing an error.

- `resmon.show.gpu` displays GPU utilization as a percentage. This is the driver's instantaneous `Device Utilization %`, sampled at each update rather than averaged over the interval, so expect it to fluctuate the same way CPU usage does.
- `resmon.show.gpumem` displays GPU memory as *in use / allocated*. Note that this is **not** used-out-of-VRAM: Apple Silicon uses unified memory with no fixed GPU partition, so the second figure is how much system memory the GPU driver has currently claimed, not a fixed capacity. It moves over time.

GPU frequency and GPU power are not available, as both require `sudo powermetrics` or private APIs.

Linux and Windows GPU monitoring is not implemented; each would need a separate backend (`nvidia-smi` / `/sys/class/drm`, and WMI / NVML respectively).

## Known Issues

Settings are read once when the extension activates. All of the `resmon.show.*` toggles and the unit settings (`resmon.freq.unit`, `resmon.mem.unit`, `resmon.gpu.unit`, `resmon.disk.*`) therefore require a window reload before a change takes effect. Only `resmon.alignLeft`, `resmon.color`, and `resmon.updatefrequencyms` apply immediately.

`resmon.mem.unit` is currently read under the wrong key internally and is ignored; memory is always reported in GB.

A better solution for Windows CPU Usage would be great. I investigated alternatives to counting Processor Time, but none of them seemed to match the Task Manager percentage.

---

## Change Log

See [CHANGELOG.md](CHANGELOG.md).
