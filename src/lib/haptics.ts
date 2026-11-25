import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

export async function hapticTap(light = true) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.impact({ style: light ? ImpactStyle.Light : ImpactStyle.Medium });
  } catch (_) {}
}
