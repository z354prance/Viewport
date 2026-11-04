const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DEFAULT_DEVICES,
  DEVICE_PROFILES,
  availableDeviceProfiles,
  modeProfile,
  resolveDeviceName
} = require("../src/deviceProfiles");

function fakePlaywrightDevices() {
  const descriptors = {};

  for (const names of Object.values(DEVICE_PROFILES)) {
    for (const name of names) {
      descriptors[name] = {
        viewport: { width: 400, height: 800 }
      };
      descriptors[`${name} landscape`] = {
        viewport: { width: 800, height: 400 }
      };
    }
  }

  return descriptors;
}

test("retains the existing mobile and tablet defaults", () => {
  assert.deepEqual(DEFAULT_DEVICES, {
    mobile: "Galaxy S24",
    tablet: "iPad Pro 11"
  });
});

test("resolves portrait and landscape variants for a selected device", () => {
  const devices = fakePlaywrightDevices();
  const portrait = modeProfile(
    "mobile",
    "portrait",
    "Pixel 7",
    devices
  );
  const landscape = modeProfile(
    "mobile",
    "landscape",
    "Pixel 7",
    devices
  );

  assert.equal(portrait.device, "Pixel 7");
  assert.equal(portrait.label, "Pixel 7");
  assert.deepEqual(portrait.options.viewport, {
    width: 400,
    height: 800
  });
  assert.equal(landscape.label, "Pixel 7 Landscape");
  assert.deepEqual(landscape.options.viewport, {
    width: 800,
    height: 400
  });
});

test("rejects profiles outside the curated mode list", () => {
  assert.throws(
    () => resolveDeviceName(
      "tablet",
      "Galaxy S24",
      fakePlaywrightDevices()
    ),
    /Invalid tablet device profile/
  );
});

test("only advertises profiles with both orientations installed", () => {
  const devices = fakePlaywrightDevices();
  delete devices["Galaxy A55 landscape"];

  const profiles = availableDeviceProfiles(devices);

  assert.equal(profiles.mobile.includes("Galaxy A55"), false);
  assert.equal(profiles.mobile.includes("Galaxy S24"), true);
  assert.equal(profiles.tablet.includes("iPad Pro 11"), true);
});

test("keeps the desktop profile unchanged", () => {
  const profile = modeProfile(
    "desktop",
    "landscape",
    undefined,
    fakePlaywrightDevices()
  );

  assert.equal(profile.device, null);
  assert.equal(profile.label, "Desktop 1440 × 900");
  assert.deepEqual(profile.options.viewport, {
    width: 1440,
    height: 900
  });
});
