// app/(tabs)/_layout.js
import React, { useEffect } from "react";
import { Tabs, useRouter, useSegments } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../lib/auth";

/** Protect all tabs: if no user, go to /(auth)/signin. */
function AuthGuard({ children }) {
  const { loading, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const inTabs = segments[0] === "(tabs)";
    if (!user && inTabs) router.replace("/(auth)/signin");
  }, [loading, user, segments, router]);

  return children;
}

export default function TabsLayout() {
  return (
    <AuthGuard>
      <Tabs
        screenOptions={{
          // Header
          headerShown: true,
          headerTitle: "DeepCalendar",
          headerTitleAlign: "center",
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "#ffffff" },
          headerTitleStyle: { fontWeight: "800", letterSpacing: 0.3 },

          // Tab colors
          tabBarActiveTintColor: "#111827",
          tabBarInactiveTintColor: "#64748b",

          // Tab label + sizing
          tabBarLabelStyle: { fontSize: 12, marginBottom: 4, fontWeight: "600" },
          tabBarIconStyle: { marginTop: 6 },
          tabBarItemStyle: { marginHorizontal: 6, borderRadius: 14 },

          // Transparent bar so the gradient shows through
          tabBarStyle: {
            height: 64,
            paddingTop: 6,
            paddingBottom: 10,
            backgroundColor: "transparent",
            borderTopWidth: 0,
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            elevation: 0,
          },

          // Pretty gradient background for the tab bar
          tabBarBackground: () => (
            <LinearGradient
              colors={["#f0f9ff", "#faf5ff"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1, borderTopWidth: 1, borderTopColor: "#e5e7eb" }}
            />
          ),
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "home" : "home-outline"} size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="calendar"
          options={{
            title: "Deep Calendar",
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "calendar" : "calendar-outline"} size={size} color={color} />
            ),
          }}
        />

        {/* Keep Routine Builder screen available, but hidden from the tab bar */}
        <Tabs.Screen
          name="routine"
          options={{
            title: "Routine Builder",
            tabBarButton: () => null,
          }}
        />

        <Tabs.Screen
          name="goals"
          options={{
            title: "Goals",
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "flag" : "flag-outline"} size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="account"
          options={{
            title: "Account",
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "person" : "person-outline"} size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </AuthGuard>
  );
}
