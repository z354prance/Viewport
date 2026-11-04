const DEFAULT_DEVICES = Object.freeze({
  mobile: "Galaxy S24",
  tablet: "iPad Pro 11"
});

const DEVICE_PROFILES = Object.freeze({
  mobile: Object.freeze([
    "Galaxy S24",
    "Galaxy A55",
    "Pixel 7",
    "iPhone 15",
    "iPhone 15 Pro",
    "iPhone 15 Pro Max",
    "iPhone SE (3rd gen)"
  ]),
  tablet: Object.freeze([
    "iPad Pro 11",
    "iPad (gen 11)",
    "iPad Mini",
    "Galaxy Tab S9",
    "Galaxy Tab S4",
    "Nexus 7",
    "Nexus 10",
    "Kindle Fire HDX"
  ])
});

function availableDeviceProfiles(playwrightDevices) {
  return Object.fromEntries(
    Object.entries(DEVICE_PROFILES).map(([mode, names]) => [
      mode,
      names.filter(name =>
        playwrightDevices[name] &&
        playwrightDevices[`${name} landscape`]
      )
    ])
  );
}

function resolveDeviceName(mode, requestedName, playwrightDevices) {
  const available = availableDeviceProfiles(playwrightDevices)[mode];

  if (!available) {
    throw new Error("Device profiles are only available for tablet and mobile modes");
  }

  const name = requestedName || DEFAULT_DEVICES[mode];

  if (!available.includes(name)) {
    throw new Error(`Invalid ${mode} device profile`);
  }

  return name;
}

function modeProfile(
  mode,
  orientation = "portrait",
  requestedDevice,
  playwrightDevices
) {
  if (mode === "mobile" || mode === "tablet") {
    const name = resolveDeviceName(
      mode,
      requestedDevice,
      playwrightDevices
    );
    const descriptorName =
      orientation === "landscape"
        ? `${name} landscape`
        : name;

    return {
      device: name,
      label:
        orientation === "landscape"
          ? `${name} Landscape`
          : name,
      options: playwrightDevices[descriptorName]
    };
  }

  return {
    device: null,
    label: "Desktop 1440 × 900",
    options: {
      viewport: {
        width: 1440,
        height: 900
      },
      screen: {
        width: 1440,
        height: 900
      },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false
    }
  };
}

module.exports = {
  DEFAULT_DEVICES,
  DEVICE_PROFILES,
  availableDeviceProfiles,
  modeProfile,
  resolveDeviceName
};
