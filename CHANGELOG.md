# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Fixed

- Version 1.0.0 was published without its git tag nor its GitHub Release:
  this version ships the same integration, released in full.

## [1.0.0] - 2026-11-23

### Added

- First release of the SENEC.Home integration: SENEC.Home V2.1 and V3 hybrid
  battery storage systems read and controlled on the local network through
  `lala.cgi`, the local API of their web interface, without any cloud account.
- One Gladys device per SENEC.Home, keyed by its serial number: battery level,
  charge and discharge power, solar production, house consumption, grid import
  and export, energy indexes (firmware that still publish them), battery and
  case temperatures, system state.
- Safety charge switch: charge the battery from the grid up to 100 %.
- One Gladys device per SENEC.Wallbox: charging power, vehicle plugged, state,
  and charging mode select (fast, solar optimized, locked).
- Scene triggers: battery full, battery empty, operating mode changed, solar
  surplus started, solar surplus stopped, vehicle plugged into / unplugged
  from a SENEC.Wallbox.
- Scene actions: read a SENEC.Home, start / stop the safety charge, set the
  charging mode of a SENEC.Wallbox.
- Dashboard widgets: SENEC.Home overview (with the safety charge button) and
  SENEC.Wallbox (one button per charging mode).
- "Test the connection" button in the Configuration screen.
- Local / unreachable transport badge, and connection status in the
  Configuration screen.
- English, French, German and Spanish texts and user documentation.

[Unreleased]: https://github.com/gboulvin/gladys-SENEC/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/gboulvin/gladys-SENEC/releases/tag/v1.0.0
