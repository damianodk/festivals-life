import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "io.festlife.app",
  appName: "FEST LIFE",
  webDir: "dist",
  bundledWebRuntime: false,
  ios: {
    contentInset: "automatic",
    backgroundColor: "#09090B"
  },
  android: {
    backgroundColor: "#09090B",
    allowMixedContent: true
  },
  plugins: {
    StatusBar: {
      style: "DARK",
      backgroundColor: "#09090B"
    }
  }
};

export default config;
