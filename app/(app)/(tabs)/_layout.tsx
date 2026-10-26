import { Tabs } from "expo-router/tabs";

export default function PrimaryTabsLayout() {
  return (
    <Tabs
      backBehavior="initialRoute"
      initialRouteName="index"
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