import { Tabs } from "expo-router/tabs";

export const unstable_settings = { anchor: "index" };

export default function PrimaryTabsLayout() {
  return (
    <Tabs
      backBehavior="initialRoute"
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="tracks" />
      <Tabs.Screen name="clips" />
      <Tabs.Screen name="flicks" />
      <Tabs.Screen name="messages" />
    </Tabs>
  );
}