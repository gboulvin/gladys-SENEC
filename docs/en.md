# SENEC.Home

Monitor and control your **SENEC.Home** battery and your **SENEC.Wallbox** in
Gladys: battery level, solar production, house consumption, grid exchange,
system state, safety charge and wallbox charging mode. Everything goes
**directly through your local network**, through the same API as the web
interface of the system (`lala.cgi`): no mein-senec.de account, no cloud, and
the values keep coming when the Internet is down.

## Compatible systems

- **SENEC.Home V3 hybrid / hybrid duo** (including the LFP versions);
- **SENEC.Home V2.1** and the recent SENEC.Home V2;
- the **SENEC.Wallbox** configured on these systems (up to 4).

**SENEC.Home 4 / P4** systems have no local API: this integration does not
support them.

## Prerequisites

1. Gladys must reach the system on the local network: open
   `https://<senec-address>/` in a browser, the SENEC web page must show (the
   browser warns about a self-signed certificate: that is expected).
2. Give the system a **fixed IP address** (a DHCP reservation in your router
   is enough).

## Configuration

1. Open the **Configuration** tab of the integration.
2. In **SENEC.Home address**, enter its IP address, e.g. `192.168.1.40`.
   Several systems: separate them with commas.
3. **Protocol**: keep **HTTPS** (current firmware). Pick HTTP only for an old
   firmware that does not answer in HTTPS.
4. **Refresh interval**: how often the system is read, 30 seconds by default
   (10 seconds minimum).
5. **Solar surplus threshold**: the power fed into the grid (W, 500 by
   default) from which the "Solar surplus started" trigger fires.
6. Save, then click **Test the connection**: the systems that answered are
   listed with their model and wallboxes, or with the reason of the failure.
7. Open the **Discovery** tab and add the SENEC.Home and its wallboxes.

## What you get

**One SENEC.Home device**, named after its model and serial number:

| Feature                                           | Type                   |
| ------------------------------------------------- | ---------------------- |
| Battery level (%)                                 | battery storage        |
| Battery charge / discharge power (W)              | battery storage        |
| Solar production (W)                              | energy production      |
| House consumption (W)                             | home consumption       |
| Power drawn from / fed into the grid (W)          | grid                   |
| Energy indexes (kWh): solar, house, grid, battery | depends on firmware \* |
| Battery and case temperature (°C)                 | probe                  |
| System state (SENEC text, e.g. `CHARGE`)          | text                   |
| **Safety charge** (switch)                        | controllable           |

\* Recent firmware (NPU image 2408 and later) no longer publish the energy
counters: these features do not show then.

**One device per SENEC.Wallbox**: charging power (W), vehicle plugged,
wallbox state, and the controllable **charging mode** (Fast, Solar optimized,
Locked).

The **safety charge** charges the battery from the grid up to 100 %, then
holds it: useful before an announced power cut or during off-peak hours. Stop
it to go back to the normal operation.

Every device shows a **local / unreachable** badge.

## Scenes

Triggers:

- **SENEC battery full** / **SENEC battery empty**;
- **SENEC operating mode changed**: charging, discharging, battery full,
  battery empty, standby, safety charge, maintenance, error, unreachable…
  filterable by new mode; the variables `mode`, `previous_mode` and
  `state_name` (raw SENEC state) are available;
- **Solar surplus started** / **Solar surplus stopped**, with the power fed
  into the grid (`export_power`);
- **Vehicle plugged into / unplugged from a SENEC.Wallbox**.

Actions:

- **Read a SENEC.Home**: reads the values now and hands them to the following
  actions (battery level, production, consumption, grid, mode…);
- **SENEC safety charge**: start or stop;
- **SENEC.Wallbox charging mode**: Fast, Solar optimized or Locked.

For a threshold on a value (battery above 80 %…), use the standard **Device
state changed** trigger of Gladys.

## Dashboard widgets

- **SENEC.Home**: production, house, grid, battery, level gauge, chart of the
  day, operating mode and safety charge button;
- **SENEC.Wallbox**: charging power, vehicle, mode, and one button per
  charging mode.

## Troubleshooting

- **"… does not answer"**: check the IP address and that the SENEC web page
  opens from the network of Gladys; try the other protocol.
- **"… without a SENEC serial number"**: the address answers, but it is not a
  compatible SENEC.Home (or it is a SENEC.Home 4).
- **Frozen values**: the system accepts a limited number of requests; do not
  use a very short refresh interval if other tools read it too.
- The integration logs (Supervision page of Gladys) detail every error.

## Privacy and security

The integration only talks to your SENEC.Home, on your local network. It
stores nothing secret. The self-signed certificate of the system is not
verified: never expose the system on the Internet.
