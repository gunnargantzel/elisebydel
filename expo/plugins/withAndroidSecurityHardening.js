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

    if (Array.isArray(app?.activity)) {
      app.activity.forEach((activity) => {
        const intentFilters = activity?.["intent-filter"];
        if (!Array.isArray(intentFilters)) return;

        const isLauncherActivity = intentFilters.some((intentFilter) => {
          const hasMainAction = Array.isArray(intentFilter?.action)
            && intentFilter.action.some(
              (action) => action?.$?.["android:name"] === "android.intent.action.MAIN",
            );
          const hasLauncherCategory = Array.isArray(intentFilter?.category)
            && intentFilter.category.some(
              (category) => category?.$?.["android:name"] === "android.intent.category.LAUNCHER",
            );

          return hasMainAction && hasLauncherCategory;
        });

        if (isLauncherActivity) {
          activity.$ = activity.$ || {};
          activity.$["android:windowSoftInputMode"] = "adjustResize";
        }
      });
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
