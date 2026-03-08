import * as Haptics from "expo-haptics";

function ignoreHapticsError() {
  // Haptics may be unavailable on some simulators/devices; keep taps non-blocking.
}

export function triggerSelectionHaptic() {
  void Haptics.selectionAsync().catch(ignoreHapticsError);
}

export function triggerLightImpactHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignoreHapticsError);
}

export function triggerMediumImpactHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(ignoreHapticsError);
}

export function triggerSuccessHaptic() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignoreHapticsError);
}

export function triggerWarningHaptic() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(ignoreHapticsError);
}
