# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords, serial numbers and
  addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and the SENEC systems and services the integration talks to — report those to
SENEC.

## Good to know

- The integration talks only to the SENEC.Home addresses you configure, on
  your local network. It uses no cloud service and stores nothing secret.
- It **writes** to the system for two operations only, both triggered by you
  (a switch, a scene or a widget button): the safety charge, and the charging
  mode of a SENEC.Wallbox. It never changes any other setting.
- The local API of the SENEC.Home (`lala.cgi`) has no authentication, and the
  system serves a self-signed certificate, which the integration does not
  verify. Anyone on your local network can read and control the system the
  same way: keep it on your local network and never expose it to the
  Internet. This is a property of the SENEC system, not a vulnerability of the
  integration.
