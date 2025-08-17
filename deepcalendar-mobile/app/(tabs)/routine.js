import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable, Alert } from "react-native";
import { api } from "../../lib/api";
import { WEEKDAYS, toMinutes, fromMinutes, overlaps } from "../../lib/dc";

function Chip({ on, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={{paddingVertical:8,paddingHorizontal:12,borderRadius:999,borderWidth:1,borderColor:"#e5e7eb",backgroundColor:on?"#111827":"white"}}>
      <Text style={{color:on?"white":"#111827",fontWeight:"600"}}>{label}</Text>
    </Pressable>
  );
}
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

export default function RoutineBuilder() {
  const [goals, setGoals] = useState([]);
  const [wins, setWins] = useState({});
  const [existing, setExisting] = useState({});

  async function loadBase() {
    const gs = await api.get("/api/deepcal/goals"); setGoals(gs?.goals || []);
    const res = await Promise.all([0,1,2,3,4,5,6].map(d=>api.get(`/api/deepcal/routine?weekday=${d}`)));
    const w={}, e={}; res.forEach((r,idx)=>{ w[idx]=r.window||null; e[idx]=(r.items||[]).sort((a,b)=>a.startMin-b.startMin); });
    setWins(w); setExisting(e);
  }
  useEffect(()=>{ loadBase().catch(()=>{}); }, []);

  // Finalize flag (local)
  const [finalized, setFinalized] = useState(false);

  // Window editor
  const [wOpen, setWOpen] = useState("09:00");
  const [wClose, setWClose] = useState("18:00");
  const [wDays, setWDays] = useState({0:false,1:true,2:true,3:true,4:true,5:true,6:false});
  async function applyWindow() {
    const days = Object.entries(wDays).filter(([,on])=>on).map(([d])=>Number(d));
    const openMin = toMinutes(wOpen), closeMin = toMinutes(wClose);
    if (!(days.length && openMin < closeMin)) return Alert.alert("Invalid","Pick days and valid times");
    await api.post("/api/deepcal/routine",{ applyTo: days, items: [], window: { openMin, closeMin } });
    await loadBase();
  }

  // Compose block + breaks → sprints
  const [bLabel, setBLabel] = useState("");
  const [bStart, setBStart] = useState("09:00");
  const [bEnd, setBEnd] = useState("13:00");
  const [bDepth, setBDepth] = useState(3);
  const [bGoalId, setBGoalId] = useState("");
  const [daySel, setDaySel] = useState({0:false,1:true,2:true,3:true,4:true,5:true,6:false});
  const [brStart, setBrStart] = useState("");
  const [brEnd, setBrEnd] = useState("");
  const [breaks, setBreaks] = useState([]);

  function addBreak() {
    if (!brStart || !brEnd) return;
    const s = toMinutes(brStart), e = toMinutes(brEnd), bs = toMinutes(bStart), be = toMinutes(bEnd);
    if (!(s<e) || s<bs || e>be) return Alert.alert("Invalid break","Must be inside the block.");
    if (breaks.some(x=>overlaps(s,e,x.s,x.e))) return Alert.alert("Overlap","Break overlaps another.");
    setBreaks([...breaks, {s,e}].sort((a,b)=>a.s-b.s)); setBrStart(""); setBrEnd("");
  }
  function composeSprints(blockS, blockE, inBreaks) {
    const merged=[];
    for (const br of [...inBreaks].sort((a,b)=>a.s-b.s)) {
      if (!merged.length || br.s > merged[merged.length-1].e) merged.push({...br});
      else merged[merged.length-1].e = Math.max(merged[merged.length-1].e, br.e);
    }
    const sprints=[]; let cur=blockS;
    for (const br of merged) { if (br.s>cur) sprints.push({s:cur,e:br.s}); cur=Math.max(cur,br.e); }
    if (cur<blockE) sprints.push({s:cur,e:blockE});
    return { sprints, merged };
  }

  const [draft, setDraft] = useState([]); // groups
  function draftedOverlap(sprints) {
    for (const g of draft) for (const s1 of g.sprints) for (const s2 of sprints)
      if (overlaps(s1.s,s1.e,s2.s,s2.e)) return true;
    return false;
  }
  async function addBlock() {
    if (!bGoalId) return Alert.alert("Pick a goal");
    const bs = toMinutes(bStart), be = toMinutes(bEnd);
    if (!(bs<be)) return Alert.alert("Invalid block","Start < End");
    const { sprints, merged } = composeSprints(bs, be, breaks);
    if (!sprints.length) return Alert.alert("Fully broken","Breaks cover the whole block.");
    if (draftedOverlap(sprints)) return Alert.alert("Overlap","Conflicts with drafted blocks.");

    const days = Object.entries(daySel).filter(([,on])=>on).map(([d])=>Number(d));
    if (!days.length) return Alert.alert("No days","Choose at least one day");

    // Warnings vs existing + window
    const warns=[];
    for (const d of days) {
      const win = wins[d]; const items = existing[d] || [];
      const outside = win ? sprints.filter(sp => sp.s<win.openMin || sp.e>win.closeMin) : [];
      const ov=[];
      for (const sp of sprints) for (const it of items) if (overlaps(sp.s,sp.e,it.startMin,it.endMin))
        ov.push({s:Math.max(sp.s,it.startMin),e:Math.min(sp.e,it.endMin),label:it.label||null});
      if (outside.length || ov.length) warns.push({ d, outside, ov });
    }

    const write = () => {
      setDraft([...draft, { id: draft.length+1, label: bLabel.trim()||undefined, startMin:bs, endMin:be, depth:bDepth, goalId:Number(bGoalId), sprints, breaks:merged, days }].sort((a,b)=>a.startMin-b.startMin));
      setBLabel(""); setBreaks([]);
    };

    if (warns.length) {
      Alert.alert("Conflicts found", "Add to draft anyway?", [
        {text:"Cancel"},
        {text:"Add", onPress:write}
      ]);
    } else write();
  }

  // push drafted
  function itemsByDay() {
    const map = new Map();
    for (const g of draft) {
      const items = g.sprints.map((sp,i)=>({ startMin:sp.s, endMin:sp.e, depthLevel:g.depth, goalId:g.goalId, label: g.label ? `${g.label} — Sprint ${i+1}` : undefined }));
      for (const d of g.days) map.set(d, [ ...(map.get(d)||[]), ...items ]);
    }
    for (const [d, arr] of map.entries()) arr.sort((a,b)=>a.startMin-b.startMin);
    return map;
  }

  async function pushDraft() {
    if (!draft.length) return Alert.alert("Nothing to push");
    const byDay = itemsByDay();

    // pre-overwrite confirm
    const conflicts=[];
    for (const [d, items] of byDay.entries()) {
      const ex = existing[d] || []; const list=[];
      for (const ni of items) for (const ei of ex) if (overlaps(ni.startMin,ni.endMin,ei.startMin,ei.endMin))
        list.push({ d, s:Math.max(ni.startMin,ei.startMin), e:Math.min(ni.endMin,ei.endMin), label:ni.label, exist:ei.label });
      if (list.length) conflicts.push(...list);
    }

    const doWrite = async () => {
      for (const [weekday, items] of byDay.entries()) {
        await api.post("/api/deepcal/routine", { applyTo:[weekday], items: items.map((x,i)=>({ ...x, orderIndex:i })) });
      }
      setDraft([]);
      await loadBase();
      Alert.alert("Pushed", "Drafted blocks were applied.");
    };

    if (conflicts.length) {
      Alert.alert("Overwrite existing?", "Some blocks overlap existing. Proceed?", [
        {text:"Cancel"},
        {text:"Proceed", onPress:doWrite}
      ]);
    } else {
      doWrite();
    }
  }

  return (
    <ScrollView contentContainerStyle={{padding:16,gap:12}}>
      {/* Finalize toggle */}
      <View style={{flexDirection:"row",alignItems:"center",gap:8}}>
        <Text style={{paddingHorizontal:8,paddingVertical:4,borderRadius:8,backgroundColor: finalized ? "#ecfdf5":"#fffbeb",color: finalized? "#065f46":"#92400e" }}>
          {finalized ? "Routine is set" : "Routine not finalized"}
        </Text>
        {finalized
          ? <Btn title="Modify" kind="plain" onPress={()=>setFinalized(false)} />
          : <Btn title="Finalize" onPress={()=>setFinalized(true)} />
        }
      </View>

      {/* 1) Day Window */}
      <View style={{borderWidth:1,borderColor:"#e5e7eb",borderRadius:12,padding:12,gap:8}}>
        <Text style={{fontWeight:"800"}}>1) Day Window</Text>
        <View style={{flexDirection:"row",gap:8,flexWrap:"wrap"}}>
          <TextInput placeholder="Open (HH:MM)" value={wOpen} onChangeText={setWOpen}
            style={{borderWidth:1,borderColor:"#e5e7eb",borderRadius:10,padding:10,minWidth:120}} />
          <TextInput placeholder="Close (HH:MM)" value={wClose} onChangeText={setWClose}
            style={{borderWidth:1,borderColor:"#e5e7eb",borderRadius:10,padding:10,minWidth:120}} />
        </View>
        <View style={{flexDirection:"row",gap:8,flexWrap:"wrap"}}>
          {WEEKDAYS.map((w,i)=><Chip key={w} on={!!wDays[i]} label={w} onPress={()=>setWDays(s=>({...s,[i]:!s[i]}))} />)}
        </View>
        <Btn title="Save window to selected days" onPress={applyWindow} />
      </View>

      {/* 2) Compose block with breaks → sprints */}
      <View style={{borderWidth:1,borderColor:"#e5e7eb",borderRadius:12,padding:12,gap:8}}>
        <Text style={{fontWeight:"800"}}>2) Compose Block</Text>
        <TextInput placeholder="Block name (optional)" value={bLabel} onChangeText={setBLabel}
          style={{borderWidth:1,borderColor:"#e5e7eb",borderRadius:10,padding:10}} />
        <View style={{flexDirection:"row",gap:8,flexWrap:"wrap"}}>
          <TextInput placeholder="Start (HH:MM)" value={bStart} onChangeText={setBStart}
            style={{borderWidth:1,borderColor:"#e5e7eb",borderRadius:10,padding:10,minWidth:120}} />
          <TextInput placeholder="End (HH:MM)" value={bEnd} onChangeText={setBEnd}
            style={{borderWidth:1,borderColor:"#e5e7eb",borderRadius:10,padding:10,minWidth:120}} />
          <TextInput placeholder="Depth 1|2|3" value={String(bDepth)} onChangeText={(v)=>setBDepth(Number(v)||1)}
            style={{borderWidth:1,borderColor:"#e5e7eb",borderRadius:10,padding:10,minWidth:110}} />
          <TextInput placeholder="Goal ID" value={String(bGoalId)} onChangeText={setBGoalId}
            style={{borderWidth:1,borderColor:"#e5e7eb",borderRadius:10,padding:10,minWidth:110}} />
        </View>

        <Text style={{fontWeight:"700",marginTop:6}}>Days</Text>
        <View style={{flexDirection:"row",gap:8,flexWrap:"wrap"}}>
          {WEEKDAYS.map((w,i)=><Chip key={w} on={!!daySel[i]} label={w} onPress={()=>setDaySel(s=>({...s,[i]:!s[i]}))} />)}
        </View>

        <Text style={{fontWeight:"700",marginTop:10}}>Breaks inside the block</Text>
        <View style={{flexDirection:"row",gap:8,flexWrap:"wrap"}}>
          <TextInput placeholder="Break start" value={brStart} onChangeText={setBrStart}
            style={{borderWidth:1,borderColor:"#e5e7eb",borderRadius:10,padding:10,minWidth:120}} />
          <TextInput placeholder="Break end" value={brEnd} onChangeText={setBrEnd}
            style={{borderWidth:1,borderColor:"#e5e7eb",borderRadius:10,padding:10,minWidth:120}} />
          <Btn title="Add break" kind="plain" onPress={addBreak} />
        </View>
        {breaks.map((br,i)=>(
          <View key={i} style={{borderWidth:1,borderColor:"#e5e7eb",borderRadius:10,padding:8}}>
            <Text>{fromMinutes(br.s)} – {fromMinutes(br.e)}</Text>
          </View>
        ))}

        <Btn title="Generate sprints for this block" onPress={addBlock} />
      </View>

      {/* Drafted blocks */}
      <View style={{borderWidth:1,borderColor:"#e5e7eb",borderRadius:12,padding:12,gap:8}}>
        <Text style={{fontWeight:"800"}}>Drafted Blocks</Text>
        {!draft.length ? <Text style={{color:"#6b7280"}}>No blocks yet.</Text> : draft.map((g,idx)=>(
          <View key={g.id} style={{borderWidth:1,borderColor:"#e5e7eb",borderRadius:10,padding:10,gap:6}}>
            <Text style={{fontWeight:"700"}}>Block {idx+1}: {fromMinutes(g.startMin)} – {fromMinutes(g.endMin)} {g.label?`• ${g.label}`:""}</Text>
            <Text style={{color:"#6b7280"}}>L{g.depth} • Goal #{g.goalId}</Text>
            <Text style={{fontWeight:"600"}}>Days: {g.days.map(d=>WEEKDAYS[d]).join(", ")}</Text>
            <Text style={{fontWeight:"600"}}>Sprints</Text>
            {(g.sprints||[]).map((sp,i)=><Text key={i}>• {fromMinutes(sp.s)} – {fromMinutes(sp.e)}</Text>)}
            <Text style={{fontWeight:"600",marginTop:4}}>Breaks</Text>
            {!g.breaks.length ? <Text style={{color:"#6b7280"}}>No breaks</Text> : g.breaks.map((br,i)=><Text key={i}>• {fromMinutes(br.s)} – {fromMinutes(br.e)}</Text>)}
          </View>
        ))}
        <View style={{flexDirection:"row",gap:8,flexWrap:"wrap"}}>
          <Btn title="Push drafted to selected days" onPress={pushDraft} />
          <Btn title="Clear draft" kind="plain" onPress={()=>setDraft([])} />
        </View>
      </View>

      <Text style={{textAlign:"center",color:"#9ca3af",fontSize:12}}>Powered by DeepCalendar</Text>
    </ScrollView>
  );
}
