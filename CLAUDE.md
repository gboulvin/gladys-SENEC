# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

**SENEC.Home**, a Gladys Assistant **external integration**: a Node.js service
(Node 22+, ESM, no build step) that runs in its own sandboxed Docker container
and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. It started from the official JavaScript template
([integration-template-js](https://github.com/GladysAssistant/integration-template-js)).

It reads and controls SENEC.Home V2.1 / V3 battery storage systems and their
SENEC.Wallbox **locally**, through `lala.cgi` (the local API of the SENEC web
interface: JSON over HTTPS with a self-signed certificate, hex-encoded
values). Local only: the manifest declares `"transports": ["local"]`.
SENEC.Home 4 / P4 have no local API and are out of scope.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/senec.test.js            # one file
node --test --test-name-pattern "widget"  # tests whose name matches
LOG_LEVEL=debug npm test                  # with the integration logs
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store .   # store admission checks
```

The CI (`.github/workflows/ci.yml`) runs `format:check`, `lint` and `test` on
Node 22 and 24, and builds the Docker image: run the three commands before
pushing.

## Architecture

```
index.js                SDK wiring only: handlers registered before connect()
src/config.js           DEFAULT_CONFIG (mirrors the manifest defaults), normalization, parseHosts
src/lala.js             lala.cgi client: value codec (fl_/u8_/i3_/st_), chunked requests, cookie, injectable transport
src/senec.js            identifySystem, readSnapshot, setSafeCharge, setWallboxMode, state tables and modes
src/devices.js          Gladys devices + features (system, wallboxes), states of a reading
src/installation.js     configured systems, reading loop, publications, commands (onSetValue)
src/triggers.js         scene trigger detection (pure function of previous/current state)
src/scenes.js           scene action handlers (manifest `scene_actions`)
src/widgets.js          dashboard widget handlers (manifest `widgets`)
src/actions.js          Configuration screen buttons (manifest `actions`)
src/i18n.js             multi-language helpers, mode labels
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md   user documentation, re-hosted by Gladys (en + fr mandatory)
test/                   node --test, fake Gladys of the SDK + simulated SENEC (test/helpers/fakeSenec.js)
.github/scripts/release.mjs   release helpers (manifest bump, changelog), tested in test/
```

## Rules

- **External ids are forever.** A system is
  `gladys.externalIds('senec', serial)` — `FACTORY.DEVICE_ID`, never the IP
  address; a wallbox is `gladys.externalIds('senec-wallbox', '<serial>-<n>')`.
  Feature keys (`SYSTEM_FEATURES` / `WALLBOX_FEATURES` in `src/devices.js`),
  manifest `config_schema`, `actions`, scene trigger, scene action, output,
  variable, widget and widget action keys are stored by Gladys and by users'
  scenes and dashboards: add new ones, never rename or remove one.
- **Every feature carries `name`, `min`, `max`, `read_only` and
  `has_feedback`** (`test/installation.test.js` checks them).
- **Writes are limited** to the safety charge (`ENERGY.SAFE_CHARGE_FORCE` /
  `SAFE_CHARGE_PROHIBIT`) and the wallbox mode (`WALLBOX.PROHIBIT_USAGE` /
  `SMART_CHARGE_ACTIVE`, arrays of 4 where only the target slot is filled).
  Never write any other lala.cgi value: a wrong one can stop the battery.
  Every command is followed by a fresh reading, so the device shows what the
  system confirms.
- **lala.cgi rejects long requests**: reads go through `client.read`, which
  splits them under `MAX_REQUEST_LENGTH`.
- **Tests never touch the network.** Use `createFakeSenec` / `fakeNetwork`
  (test/helpers/fakeSenec.js), which answers real lala.cgi payloads.
- **The container rootfs is read-only.** Write only under `/data` (nothing is
  stored today). Never log tokens, passwords or full request payloads.
- **Versions belong to the Release workflow** (Actions → Release). Never edit
  `version` in `package.json` or in the manifest, nor the `docker_image` tag,
  by hand. `test/manifest.test.js` checks they agree.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]`
  in `CHANGELOG.md` (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`).
  Never write a version heading: the Release workflow moves the section.
- **Four languages.** Every user-facing text — manifest `label` /
  `description` / `placeholder`, action messages, connection status, widget
  contents, toasts — is a multi-language object `{ en, fr, de, es }` (use
  `text()` from `src/i18n.js`), and `docs/en.md`, `fr.md`, `de.md`, `es.md`
  are kept in sync. `test/manifest.test.js` fails on a missing language.
- **Manifest.** The catalog `description` holds 10 to 100 characters per
  language. `widgets`, `scene_triggers` and `scene_actions` require
  `gladys_version` >= 5.1.0, `keywords` >= 5.3.0. The tests tie the manifest
  to the code (defaults, actions, scene actions and outputs, triggers and
  their data, widgets): change both sides together.
- **Widgets.** `validateWidgetContent(content)` must return `[]`
  (test/widgets.test.js): 8 components at most, button labels of 24
  characters at most, one action key per button.
- **Scene events.** One event per transition, never per reading (300
  events/minute), and only the keys declared in the trigger `fields` /
  `variables`.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English.
