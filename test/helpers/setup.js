// A configured installation, its systems simulated, its devices created.
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { normalizeConfig } from '../../src/config.js';
import { Installation } from '../../src/installation.js';
import { createFakeSenec, fakeNetwork, v21Recent } from './fakeSenec.js';

export async function setup({ hosts, create = true, config = {} } = {}) {
  const systems = {
    '192.168.1.40': createFakeSenec(),
    '192.168.1.41': createFakeSenec(v21Recent()),
  };
  const gladys = createFakeGladys();
  const installation = new Installation({ gladys, createClient: fakeNetwork(systems) });
  installation.configure(
    normalizeConfig({ hosts: (hosts ?? ['192.168.1.40']).join(','), ...config }),
  );
  await installation.discover();
  if (create) {
    gladys.fake.devices = installation.discoveredDevices();
  }
  await installation.refreshCreatedDevices();
  const ids = installation.discoveredDevices().map((device) => device.external_id);
  return { gladys, installation, systems, senec: systems['192.168.1.40'], ids };
}
