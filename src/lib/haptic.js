// Capacitor haptic helper. Silently no-ops in the browser (dev) and on
// any platform without haptic hardware. Style values match Capacitor's
// ImpactStyle enum ("Light" | "Medium" | "Heavy").

import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

export function haptic(style = "Light") {
  if (Capacitor.isNativePlatform()) {
    Haptics.impact({ style: ImpactStyle[style] }).catch(() => {});
  }
}
