import React from "react";
import { Tabs } from "expo-router";
import { Platform } from "react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: "center",
        headerShadowVisible: false,
        headerLargeTitle: Platform.OS === "ios",
        tabBarLabelStyle: { fontSize: 12 },
        tabBarStyle: { height: 56 },
        sceneStyle: { backgroundColor: "#fff" },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarLabel: "Dashboard",
        }}
      />
      <Tabs.Screen
        name="routine"
        options={{
          title: "Routine",
          tabBarLabel: "Routine",
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: "Goals",
          tabBarLabel: "Goals",
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarLabel: "Calendar",
        }}
      />
      {/* add/remove more tabs as you need */}
    </Tabs>
  );
}
