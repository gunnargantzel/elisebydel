const { withAndroidManifest } = require("expo/config-plugins");

const BLOCKED_PERMISSIONS = new Set([
  "android.permission.SYSTEM_ALERT_WINDOW",
]);

module.exports = function withAndroidSecurityHardening(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const app = manifest.application?.[0];

    if (app?.$) {
      app.$["android:allowBackup"] = "false";
      app.$["android:fullBackupContent"] = "false";
    }

    if (Array.isArray(manifest["uses-permission"])) {
      manifest["uses-permission"] = manifest["uses-permission"].filter((perm) => {
        const name = perm?.$?.["android:name"];
        return !BLOCKED_PERMISSIONS.has(name);
      });
    }

    return mod;
  });
};
