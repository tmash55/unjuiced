import { Stack } from "expo-router";
import { brandColors } from "@/src/theme/brand";

export default function PropsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: brandColors.appBackground }
      }}
    />
  );
}
