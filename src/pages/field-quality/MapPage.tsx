import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { dashboardApi } from "../../services/api";
import { Submission } from "../../types";
import { useAdaGreeting } from "../../hooks/useAdaGreeting";
import { useAdaAttention } from "../../hooks/useAdaAttention";
import { MapPin, Clock } from "lucide-react";

const GREEN = "#059669", AMBER = "#D97706", RED = "#DC2626", BLUE = "#2463EB";
const clr = (s: number) => s >= 70 ? GREEN : s >= 45 ? AMBER : RED;
const vbg = (v: string) => v === "PASS" ? "#ECFDF5" : v === "FLAG" ? "#FFFBEB" : "#FEF2F2";

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) { map.setView(points[0], 11); return; }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 13 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length]);
  return null;
}

export default function MapPage() {
  const [subs, setSubs] = useState<Submission[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [selected, setSelected] = useState<Submission | null>(null);
  useAdaGreeting({ page: "map" });
  useAdaAttention({ x: 0.5, y: 0.5 }, { delay: 2500, returnAfterMs: 6000 });

  useEffect(() => {
    dashboardApi.getSubmissions({ limit: 100 }).then(r => setSubs(r.data.submissions || []));
  }, []);

  const filtered = subs.filter(s => filter === "ALL" || s.verdict === filter);
  const withGps = filtered.filter(s =>
    s.gps?.lat && s.gps?.lon &&
    Math.abs(Number(s.gps.lat)) > 0.001 && Math.abs(Number(s.gps.lon)) > 0.001
  );
  const points: [number, number][] = withGps.map(s => [Number(s.gps.lat), Number(s.gps.lon)]);

  const statCards = [
    { label: "Mapped",       value: withGps.length,                                                           color: "rgba(255,255,255,.92)" },
    { label: "High Quality", value: withGps.filter(s => s.overall_score >= 70).length,                        color: GREEN },
    { label: "Needs Review", value: withGps.filter(s => s.overall_score >= 45 && s.overall_score < 70).length, color: AMBER },
    { label: "Flagged",      value: withGps.filter(s => s.verdict === "FLAG").length,                          color: RED },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#080D1A", letterSpacing: -.6, margin: 0 }}>Coverage Map</h1>
          <p style={{ fontSize: 12.5, color: "#9CA3AF", marginTop: 4 }}>{withGps.length} submissions mapped</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["ALL", "PASS", "FLAG", "REJECT"].map(v => (
            <button key={v} onClick={() => setFilter(v)} style={{
              padding: "6px 14px", borderRadius: 7, border: "1px solid", fontSize: 11.5,
              fontWeight: 600, cursor: "pointer", transition: "all .15s",
              borderColor: filter === v ? BLUE : "#E2E8F0",
              background:  filter === v ? BLUE  : "white",
              color:       filter === v ? "white" : "#6B7280",
            }}>{v}</button>
          ))}
        </div>
      </div>

      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", border: "1px solid #1C2340", boxShadow: "0 8px 40px rgba(8,13,26,.3)", height: 520 }}>
        <MapContainer center={[9, 8]} zoom={6} style={{ height: "100%", width: "100%" }} scrollWheelZoom zoomControl={false}>
          <TileLayer attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <FitBounds points={points} />
          {withGps.filter(s => s.verdict === "FLAG").map(sub => (
            <CircleMarker key={`halo-${sub.submission_id}`} center={[Number(sub.gps.lat), Number(sub.gps.lon)]} radius={22} pathOptions={{ color: RED, weight: 0, fillColor: RED, fillOpacity: 0.12 }} />
          ))}
          {withGps.map(sub => {
            const color = clr(sub.overall_score);
            const isFlag = sub.verdict === "FLAG";
            return (
              <CircleMarker key={sub.submission_id} center={[Number(sub.gps.lat), Number(sub.gps.lon)]} radius={isFlag ? 9 : 6}
                pathOptions={{ color: "rgba(255,255,255,.55)", weight: 1.5, fillColor: color, fillOpacity: 0.95 }}
                eventHandlers={{ click: () => setSelected(selected?.submission_id === sub.submission_id ? null : sub) }}>
                <Popup>
                  <div style={{ fontFamily: "Inter,sans-serif", minWidth: 180 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111827", marginBottom: 2 }}>{sub.enumerator_id}</div>
                    <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 10, lineHeight: 1.5 }}>{sub.gps?.address?.split(",").slice(0, 2).join(",") || "Location unavailable"}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: vbg(sub.verdict), color }}>{sub.verdict}</span>
                      <span style={{ fontSize: 16, fontWeight: 900, color, fontFamily: "monospace", letterSpacing: -.5 }}>{sub.overall_score}</span>
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>/100</span>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
        <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 1000, display: "flex", background: "rgba(8,13,26,.82)", backdropFilter: "blur(14px)", borderRadius: 12, border: "1px solid rgba(255,255,255,.07)", boxShadow: "0 4px 28px rgba(0,0,0,.5)", overflow: "hidden" }}>
          {statCards.map((s, i) => (
            <div key={s.label} style={{ padding: "12px 22px", textAlign: "center", borderRight: i < statCards.length - 1 ? "1px solid rgba(255,255,255,.05)" : "none" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color, letterSpacing: -1, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,.28)", textTransform: "uppercase", letterSpacing: .8, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", top: 16, right: 16, zIndex: 1000, background: "rgba(8,13,26,.82)", backdropFilter: "blur(14px)", borderRadius: 10, border: "1px solid rgba(255,255,255,.07)", padding: "12px 16px", boxShadow: "0 4px 16px rgba(0,0,0,.4)", display: "flex", flexDirection: "column", gap: 7 }}>
          {[{ color: GREEN, label: "Pass ≥70" }, { color: AMBER, label: "Review 45–69" }, { color: RED, label: "Reject / Flag" }].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: l.color, boxShadow: `0 0 6px ${l.color}88`, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.55)", fontWeight: 500 }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div style={{ background: "white", borderRadius: 14, border: "1px solid #E8EDF5", padding: "18px 22px", display: "flex", gap: 20, alignItems: "center", boxShadow: "0 2px 12px rgba(10,15,28,.07)" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: clr(selected.overall_score) + "18", display: "grid", placeItems: "center", border: `2px solid ${clr(selected.overall_score)}44`, flexShrink: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: clr(selected.overall_score), fontFamily: "monospace" }}>{selected.overall_score}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#080D1A", marginBottom: 2 }}>{selected.enumerator_id}</div>
            <div style={{ display: "flex", gap: 12, fontSize: 11.5, color: "#6B7280" }}>
              {selected.gps?.address && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11} />{selected.gps.address.split(",").slice(0, 2).join(",")}</span>}
              {selected.duration_mins && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={11} />{Math.round(Number(selected.duration_mins))}m</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, padding: "4px 10px", borderRadius: 6, background: vbg(selected.verdict), color: clr(selected.overall_score) }}>{selected.verdict}</span>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: 4, lineHeight: 0 }}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
