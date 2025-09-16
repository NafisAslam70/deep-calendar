import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, Alert, Modal } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";

/* --- tiny UI helpers --- */
function Button({ title, onPress, kind="primary", busy=false }) {
  const bg = kind==="primary" ? "#111827" : "white";
  const color = kind==="primary" ? "white" : "#111827";
  const borderColor = kind==="primary" ? "transparent" : "#e5e7eb";
  return (
    <Pressable onPress={onPress} disabled={busy}
      style={{ backgroundColor:bg,borderWidth:1,borderColor,paddingVertical:12,paddingHorizontal:16,borderRadius:12, opacity: busy?0.7:1 }}>
      <Text style={{ color, fontWeight:"700" }}>{busy ? (typeof busy==="string"?busy:"Please wait…") : title}</Text>
    </Pressable>
  );
}
function Chip({ color, selected, onPress }) {
  return (
    <Pressable onPress={onPress}
      style={{
        width: 28, height: 28, borderRadius: 999, backgroundColor: color,
        borderWidth: selected ? 3 : 1, borderColor: selected ? "#111827" : "#e5e7eb"
      }}
    />
  );
}
function Card({ children }) {
  return <View style={{ borderWidth:1, borderColor:"#e5e7eb", borderRadius:16, padding:12, gap:8, backgroundColor:"#fff" }}>{children}</View>;
}
function ConfirmModal({ open, title, body, confirmText="Confirm", destructive=false, busy=false, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex:1, backgroundColor:"rgba(0,0,0,0.4)", justifyContent:"center", padding:16 }}>
        <View style={{ backgroundColor:"#fff", borderRadius:16, padding:16 }}>
          <Text style={{ fontSize:16, fontWeight:"800" }}>{title}</Text>
          {!!body && <Text style={{ marginTop:8, color:"#374151" }}>{body}</Text>}
          <View style={{ marginTop:12, flexDirection:"row", justifyContent:"flex-end", gap:8 }}>
            <Button title="Cancel" kind="plain" onPress={onCancel} busy={busy} />
            <Button title={confirmText} onPress={onConfirm} busy={busy}
              kind={destructive ? "primary" : "primary"} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* --- palette (hex strings, stored to backend) --- */
const PALETTE = [
  "#ef4444","#f59e0b","#10b981","#3b82f6","#6366f1","#a855f7","#ec4899","#14b8a6","#84cc16",
];

export default function Goals() {
  const { user, loading: authLoading } = useAuth();
  const [goals, setGoals] = useState([]);

  const [label, setLabel] = useState("");
  const [color, setColor] = useState(PALETTE[3]); // blue
  const [deadline, setDeadline] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdOpen, setCreatedOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null); // goal obj
  const [savingEdit, setSavingEdit] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    try {
      const r = await api.get("/api/deepcal/goals");
      setGoals(r?.goals || []);
    } catch(e){
      Alert.alert("Error", e.message || "");
    }
  }
  useEffect(() => { if (!authLoading && user) load(); }, [authLoading, user]);

  async function add() {
    if (!label.trim()) return;
    setCreating(true);
    try {
      await api.post("/api/deepcal/goals",{ label:label.trim(), color, deadlineISO: deadline || null });
      setLabel(""); setDeadline("");
      await load();
      setCreatedOpen(true); // ✅ confirmation
    } catch(e){ Alert.alert("Failed", e.message||""); }
    finally { setCreating(false); }
  }

  async function remove(id) {
    setDeleting(true);
    try { await api.del(`/api/deepcal/goals?id=${id}`); await load(); }
    catch(e){ Alert.alert("Failed", e.message||""); }
    finally { setDeleting(false); setConfirmOpen(false); }
  }

  async function saveEdit() {
    if (!editing) return;
    setSavingEdit(true);
    try {
      await api.post("/api/deepcal/goals", { // backend often accepts POST upsert; if not, switch to PATCH ?id=
        id: editing.id,
        label: editing.label,
        color: editing.color,
        deadlineISO: editing.deadlineISO || null,
      });
      await load();
      setEditOpen(false);
    } catch (e) {
      try {
        await api.patch(`/api/deepcal/goals?id=${editing.id}`, {
          label: editing.label, color: editing.color, deadlineISO: editing.deadlineISO || null,
        });
        await load();
        setEditOpen(false);
      } catch(err){ Alert.alert("Failed", err?.message || ""); }
    } finally { setSavingEdit(false); }
  }

  const goalMap = useMemo(()=>Object.fromEntries(goals.map(g=>[g.id,g])),[goals]);

  return (
    <ScrollView contentContainerStyle={{ padding:16, gap:12 }}>
      <Text style={{ fontSize:22, fontWeight:"800" }}>Goals</Text>

      {/* Create */}
      <Card>
        <Text style={{ fontWeight:"700" }}>Add goal</Text>

        <TextInput placeholder="Label" value={label} onChangeText={setLabel}
          style={{ borderWidth:1, borderColor:"#e5e7eb", borderRadius:12, padding:12 }} />

        <View>
          <Text style={{ color:"#6b7280", marginBottom:6 }}>Color</Text>
          <View style={{ flexDirection:"row", gap:10, flexWrap:"wrap" }}>
            {PALETTE.map((hex)=>(
              <Chip key={hex} color={hex} selected={color===hex} onPress={()=>setColor(hex)} />
            ))}
          </View>
        </View>

        <TextInput placeholder="Deadline YYYY-MM-DD (optional)" value={deadline} onChangeText={setDeadline}
          style={{ borderWidth:1, borderColor:"#e5e7eb", borderRadius:12, padding:12 }} />

        <Button title="Create" onPress={add} busy={creating && "Creating…"} />
      </Card>

      {/* List */}
      <View style={{ gap:8 }}>
        {!goals.length ? (
          <Text style={{ color:"#6b7280" }}>No active goals.</Text>
        ) : goals.map(g=>(
          <Card key={g.id}>
            <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between" }}>
              <View style={{ flexDirection:"row", alignItems:"center", gap:10 }}>
                <View style={{ width:14, height:14, borderRadius:999, backgroundColor: g.color || "#e5e7eb", borderWidth:1, borderColor:"#e5e7eb" }} />
                <Text style={{ fontWeight:"700" }}>{g.label}</Text>
              </View>
              <View style={{ flexDirection:"row", gap:8 }}>
                <Pressable onPress={()=>{ setEditing({...g}); setEditOpen(true); }}
                  style={{ paddingHorizontal:10, paddingVertical:8, borderRadius:10, borderWidth:1, borderColor:"#e5e7eb" }}>
                  <Text style={{ fontWeight:"700" }}>Edit</Text>
                </Pressable>
                <Pressable onPress={()=>{ setDeleting(false); setConfirmOpen(true); setEditing(g); }}
                  style={{ paddingHorizontal:10, paddingVertical:8, borderRadius:10, borderWidth:1, borderColor:"#fee2e2", backgroundColor:"#fef2f2" }}>
                  <Text style={{ fontWeight:"700", color:"#b91c1c" }}>Delete</Text>
                </Pressable>
              </View>
            </View>
            <Text style={{ color:"#6b7280" }}>
              {g.deadlineISO ? `Due ${g.deadlineISO}` : "No deadline"}
            </Text>
          </Card>
        ))}
      </View>

      <Text style={{ textAlign:"center", color:"#9ca3af", fontSize:12 }}>Powered by DeepCalendar</Text>

      {/* Created confirmation */}
      <ConfirmModal
        open={createdOpen}
        title="Goal created"
        body="Your new goal is ready."
        confirmText="Done"
        onCancel={()=>setCreatedOpen(false)}
        onConfirm={()=>setCreatedOpen(false)}
      />

      {/* Edit modal */}
      <Modal transparent visible={editOpen} animationType="slide" onRequestClose={()=>setEditOpen(false)}>
        <View style={{ flex:1, backgroundColor:"rgba(0,0,0,0.4)", justifyContent:"center", padding:16 }}>
          <View style={{ backgroundColor:"#fff", borderRadius:16, padding:16, gap:10 }}>
            <Text style={{ fontSize:16, fontWeight:"800" }}>Edit goal</Text>
            <TextInput
              placeholder="Label" value={editing?.label || ""}
              onChangeText={(v)=>setEditing(s=>({...s, label:v}))}
              style={{ borderWidth:1, borderColor:"#e5e7eb", borderRadius:12, padding:12 }}
            />
            <Text style={{ color:"#6b7280" }}>Color</Text>
            <View style={{ flexDirection:"row", gap:10, flexWrap:"wrap" }}>
              {PALETTE.map((hex)=>(
                <Chip key={hex} color={hex}
                  selected={(editing?.color || "")===hex}
                  onPress={()=>setEditing(s=>({...s, color:hex}))}
                />
              ))}
            </View>
            <TextInput
              placeholder="Deadline YYYY-MM-DD (optional)"
              value={editing?.deadlineISO || ""}
              onChangeText={(v)=>setEditing(s=>({...s, deadlineISO:v}))}
              style={{ borderWidth:1, borderColor:"#e5e7eb", borderRadius:12, padding:12 }}
            />
            <View style={{ flexDirection:"row", justifyContent:"flex-end", gap:8, marginTop:4 }}>
              <Button title="Cancel" kind="plain" onPress={()=>setEditOpen(false)} busy={savingEdit && "Saving…"} />
              <Button title="Save changes" onPress={saveEdit} busy={savingEdit && "Saving…"} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete confirm */}
      <ConfirmModal
        open={confirmOpen}
        title="Delete goal?"
        body={`This cannot be undone.\n\nGoal: ${editing?.label || ""}`}
        confirmText="Delete"
        destructive
        busy={deleting && "Deleting…"}
        onCancel={()=>setConfirmOpen(false)}
        onConfirm={()=>remove(editing.id)}
      />
    </ScrollView>
  );
}
