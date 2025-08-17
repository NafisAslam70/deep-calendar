import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { api } from "../../lib/api";
import { WEEKDAYS, fromMinutes } from "../../lib/dc";

export default function Calendar() {
  const [wins, setWins] = useState({});
  const [items, setItems] = useState({});

  useEffect(() => {
    (async () => {
      const w = {}, r = {};
      await Promise.all([0,1,2,3,4,5,6].map(async d=>{
        try {
          const res = await api.get(`/api/deepcal/routine?weekday=${d}`);
          w[d] = res?.window || null;
          r[d] = (res?.items || []).sort((a,b)=>a.startMin-b.startMin);
        } catch { w[d]=null; r[d]=[]; }
      }));
      setWins(w); setItems(r);
    })();
  }, []);

  return (
    <ScrollView contentContainerStyle={{padding:16,gap:12}}>
      <Text style={{fontSize:22,fontWeight:"800"}}>Your Deep Calendar</Text>
      <Text style={{color:"#6b7280"}}>Weekly routine view (edit in Routine Builder).</Text>

      {WEEKDAYS.map((w,i)=>(
        <View key={w} style={{borderWidth:1,borderColor:"#e5e7eb",borderRadius:12,padding:12,gap:6}}>
          <Text style={{fontWeight:"700"}}>{w}</Text>
          <Text style={{color:"#6b7280"}}>Window: {wins[i]?`${fromMinutes(wins[i].openMin)} – ${fromMinutes(wins[i].closeMin)}`:"not set"}</Text>
          {!(items[i]||[]).length ? (
            <Text style={{color:"#6b7280"}}>No blocks.</Text>
          ) : (items[i]||[]).map((b,idx)=>(
            <View key={b.id ?? idx} style={{borderWidth:1,borderColor:"#e5e7eb",borderRadius:10,padding:8}}>
              <Text>{fromMinutes(b.startMin)} – {fromMinutes(b.endMin)} • L{b.depthLevel} {b.label?`• ${b.label}`:""}</Text>
            </View>
          ))}
        </View>
      ))}

      <Text style={{textAlign:"center",color:"#9ca3af",fontSize:12}}>Powered by DeepCalendar</Text>
    </ScrollView>
  );
}
