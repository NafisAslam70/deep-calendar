// app/index.js
import { Redirect } from "expo-router";
import { useAuth } from "../lib/auth";

export default function Index() {
  const { loading, user } = useAuth();
  if (loading) return null;
  return <Redirect href={user ? "/(tabs)/dashboard" : "/landing"} />;
}
