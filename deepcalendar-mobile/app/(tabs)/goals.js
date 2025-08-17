import { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, Alert } from "react-native";
import { api } from "../../lib/api";

function Btn({ title, onPress, kind="primary" }) {
  const bg = kind==="primary" ? "#111827" : "white";
  const color = kind==="primary" ? "white" : "#111827";
  const borderColor = kind==="primary" ? "transparent" : "#e5e7eb";
  return (
    <Pressable onPress={onPress} style={{backgroundColor:bg,borderWidth:1,borderColor,paddingVertical:12,paddingHorizontal:16,borderRadius:10}}>
      <Text style={{color,fontWeight:"700"}}>{title}</Text>
    </Pressable>
  );
}

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [label, setLabel] = useState(""); const [color, setColor] = useState("bg-blue-500"); const [deadline, setDeadline] = useState("");

  async function load() { try { const r = await api.get("/api/deepcal/goals"); setGoals(r?.goals || []); } catch(e){ Alert.alert("Error",e.message||""); } }
  useEffect(()=>{ load(); }, []);

  async function add() {
    if (!label.trim()) return;
    try { await api.post("/api/deepcal/goals",{ label:label.trim(), color, deadlineISO: deadline||null }); setLabel(""); setDeadline(""); await load(); }
    catch(e){ Alert.alert("Failed", e.message||""); }
  }
  async function archive(id) { try { await api.del(`/api/deepcal/goals?id=${id}`); await load(); } catch(e){ Alert.alert("Failed",e.message||""); } }

  return (
    <ScrollView contentContainerStyle={{padding:16,gap:12}}>
      <Text style={{fontSize:22,fontWeight:"800"}}>Goals</Text>

      <View style={{borderWidth:1,borderColor:"#e5e7eb",borderRadius:12,padding:12,gap:8}}>
        <Text style={{fontWeight:"700"}}>Add goal</Text>
        <TextInput placeholder="Label" value={label} onChangeText={setLabel} style={{borderWidth:1,borderColor:"#e5e7eb",borderRadius:10,padding:10}} />
        <TextInput placeholder="Tailwind color class" value={color} onChangeText={setColor} style={{borderWidth:1,borderColor:"#e5e7eb",borderRadius:10,padding:10}} />
        <TextInput placeholder="Deadline YYYY-MM-DD (optional)" value={deadline} onChangeText={setDeadline} style={{borderWidth:1,borderColor:"#e5e7eb",borderRadius:10,padding:10}} />
        <Btn title="Create" onPress={add} />
      </View>

      <View style={{gap:8}}>
        {!goals.length ? <Text style={{color:"#6b7280"}}>No active goals.</Text> :
          goals.map(g=>(
            <View key={g.id} style={{borderWidth:1,borderColor:"#e5e7eb",borderRadius:12,padding:12,gap:6}}>
              <Text style={{fontWeight:"700"}}>{g.label}</Text>
              <Text style={{color:"#6b7280"}}>Color: {g.color} {g.deadlineISO?`• Due ${g.deadlineISO}`:""}</Text>
              <Btn title="Archive" kind="plain" onPress={()=>archive(g.id)} />
            </View>
        ))}
      </View>

      <Text style={{textAlign:"center",color:"#9ca3af",fontSize:12}}>Powered by DeepCalendar</Text>
    </ScrollView>
  );
}
