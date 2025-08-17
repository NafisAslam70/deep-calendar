import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { getToken } from "../lib/api";

export default function Index() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    (async () => {
      const t = await getToken();
      setAuthed(!!t);
      setReady(true);
    })();
  }, []);

  if (!ready) return null;
  return authed ? <Redirect href="/(tabs)/dashboard" /> : <Redirect href="/(auth)/signin" />;
}
