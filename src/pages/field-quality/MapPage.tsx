import React, { useEffect, useState, useCallback } from "react";
import { GoogleMap, useJsApiLoader, OverlayView } from "@react-google-maps/api";
import { dashboardApi } from "../../services/api";
import { Submission } from "../../types";
import { useAdaGreeting } from "../../hooks/useAdaGreeting";
import { useAdaAttention } from "../../hooks/useAdaAttention";
import { MapPin, Clock, X, Layers, ZoomIn, ZoomOut } from "lucide-react";

const GOOGLE_MAPS_KEY = "AIzaSyCk1TrF9CuY1rOHruxsfRy1M9aZuKTTylo";

const GREEN  = "#059669";
const AMBER  = "#D97706";
const RED    = "#DC2626";
const BLUE   = "#2463EB";

const clr = (s: number) => s >= 70 ? GREEN : s >= 45 ? AMBER : RED;
const vbg = (v: string) => v === "PASS" ? "#ECFDF5" : v === "FLAG" ? "#FFFBEB" : "#FEF2F2";

// Ultra-dark premium map style
const DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry",           stylers: [{ color: "#080D1A" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#080D1A" }] },
  { elementType: "labels.text.fill",   stylers: [{ color: "#2A3560" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#1C2340" }] },
  { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#141929" }] },
  { featureType: "landscape",          elementType: "geometry", stylers: [{ color: "#0C1128" }] },
  { featureType: "landscape.man_made", elementType: "geometry.stroke", stylers: [{ color: "#141929" }] },
  { featureType: "poi",                elementType: "geometry", stylers: [{ color: "#0C1128" }] },
  { featureType: "poi.park",           elementType: "geometry", stylers: [{ color: "#0E1530" }] },
  { featureType: "road",               elementType: "geometry", stylers: [{ color: "#141929" }] },
  { featureType: "road",               elementType: "geometry.stroke", stylers: [{ color: "#0C1128" }] },
  { featureType: "road.highway",       elementType: "geometry", stylers: [{ color: "#1C2340" }] },
  { featureType: "road.highway",       elementType: "geometry.stroke", stylers: [{ color: "#141929" }] },
  { featureType: "transit",            elementType: "geometry", stylers: [{ color: "#0C1128" }] },
  { featureType: "water",              elementType: "geometry", stylers: [{ color: "#060B16" }] },
  { featureType: "water",              elementType: "labels.text.fill", stylers: [{ color: "#1C2340" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#3B4D80" }] },
  { featureType: "poi",                elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit",            elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road",               elementType: "labels", stylers: [{ visibility: "simplified" }] },
];

const MAP_OPTIONS: google.maps.MapOptions = {
  styles: DARK_STYLE,
  disableDefaultUI: true,
  clickableIcons: false,
  backgroundColor: "#080D1A",
  gestureHandling: "greedy",
  minZoom: 3,
  maxZoom: 18,
};

// Pulse ring drawn via canvas for flagged submissions
function PulseMarker({ sub, onClick, isSelected }: {
  sub: Submission; onClick: () => void; isSelected: boolean;
}) {
  const color = clr(sub.overall_score);
  const isFlag = sub.verdict === "FLAG";
  const size = isFlag ? 22 : 16;

  return (
    <div
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{ position: "relative", width: size, height: size, cursor: "pointer", transform: "translate(-50%, -50%)" }}
    >
      {/* Pulse ring for flagged */}
      {isFlag && (
        <div style={{
          position: "absolute", inset: -8, borderRadius: "50%",
          border: `1.5px solid ${RED}`,
          animation: "ada-pulse 2s ease-out infinite",
          opacity: 0.5,
        }} />
      )}
      {/* Selection ring */}
      {isSelected && (
        <div style={{
          position: "absolute", inset: -5, borderRadius: "50%",
          border: `2px solid white`,
          boxShadow: `0 0 12px ${color}`,
        }} />
      )}
      {/* Core dot */}
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: color,
        border: `1.5px solid rgba(255,255,255,${isFlag ? 0.7 : 0.4})`,
        boxShadow: `0 0 ${isFlag ? 10 : 6}px ${color}cc, 0 2px 6px rgba(0,0,0,0.5)`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {isSelected && (
          <div style={{ fontSize: 7, fontWeight: 900, color: "white", fontFamily: "monospace", lineHeight: 1 }}>
            {sub.overall_score}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MapPage() {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY,
    id: "researchos-map",
  });

  const [subs,     setSubs]     = useState<Submission[]>([]);
  const [filter,   setFilter]   = useState("ALL");
  const [selected, setSelected] = useState<Submission | null>(null);
  const [mapRef,   setMapRef]   = useState<google.maps.Map | null>(null);
  const [styleIdx, setStyleIdx] = useState(0); // 0=dark, 1=satellite, 2=terrain

  useAdaGreeting({ page: "map" });
  useAdaAttention({ x: 0.5, y: 0.5 }, { delay: 2500, returnAfterMs: 6000 });

  useEffect(() => {
    dashboardApi.getSubmissions({ limit: 200 }).then(r => setSubs(r.data.submissions || []));
  }, []);

  const allWithGps = subs.filter(s =>
    s.gps?.lat && s.gps?.lon &&
    Math.abs(Number(s.gps.lat)) > 0.001 && Math.abs(Number(s.gps.lon)) > 0.001
  );
  const filtered = allWithGps.filter(s => filter === "ALL" || s.verdict === filter);

  // Fit bounds when submissions load
  useEffect(() => {
    if (!mapRef || filtered.length === 0) return;
    if (filtered.length === 1) {
      mapRef.setCenter({ lat: Number(filtered[0].gps.lat), lng: Number(filtered[0].gps.lon) });
      mapRef.setZoom(12);
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    filtered.forEach(s => bounds.extend({ lat: Number(s.gps.lat), lng: Number(s.gps.lon) }));
    mapRef.fitBounds(bounds, { top: 80, right: 60, bottom: 80, left: 60 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef, filtered.length, filter]);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMapRef(map);
    map.setCenter({ lat: 9, lng: 8 });
    map.setZoom(6);
  }, []);

  const onUnmount = useCallback(() => setMapRef(null), []);

  const cycleStyle = () => {
    const next = (styleIdx + 1) % 3;
    setStyleIdx(next);
    if (!mapRef) return;
    if (next === 1) mapRef.setMapTypeId("satellite");
    else if (next === 2) mapRef.setMapTypeId("terrain");
    else { mapRef.setMapTypeId("roadmap"); mapRef.setOptions({ styles: DARK_STYLE }); }
  };

  const passCount   = allWithGps.filter(s => s.verdict === "PASS").length;
  const flagCount   = allWithGps.filter(s => s.verdict === "FLAG").length;
  const rejectCount = allWithGps.filter(s => s.verdict === "REJECT").length;

  const statChips = [
    { key: "ALL",    label: "All",     value: allWithGps.length, color: "rgba(255,255,255,.92)" },
    passCount   > 0 && { key: "PASS",   label: "Pass",    value: passCount,   color: GREEN },
    flagCount   > 0 && { key: "FLAG",   label: "Flagged", value: flagCount,   color: AMBER },
    rejectCount > 0 && { key: "REJECT", label: "Reject",  value: rejectCount, color: RED },
  ].filter(Boolean) as { key: string; label: string; value: number; color: string }[];

  if (loadError) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 108px)", flexDirection: "column", gap: 12, color: "#6B7280" }}>
        <MapPin size={28} color="#DC2626" />
        <div style={{ fontSize: 14 }}>Map failed to load. Please check your network.</div>
      </div>
    );
  }

  return (
    <>
      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes ada-pulse {
          0%   { transform: scale(1);   opacity: 0.6; }
          70%  { transform: scale(2.4); opacity: 0; }
          100% { transform: scale(2.4); opacity: 0; }
        }
      `}</style>

      <div
        data-ada-target="coverage-map"
        style={{ display: "flex", flexDirection: "column", gap: 12, height: "calc(100vh - 108px)" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#080D1A", letterSpacing: -.5, margin: 0 }}>Coverage Map</h1>
            <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2, margin: 0 }}>{allWithGps.length} submissions mapped</p>
          </div>
        </div>

        {/* Map container */}
        <div style={{
          position: "relative", borderRadius: 16, overflow: "hidden",
          border: "1px solid #1C2340",
          boxShadow: "0 8px 40px rgba(8,13,26,.4), 0 0 0 1px rgba(37,99,235,0.08)",
          flex: 1, minHeight: 0,
        }}>
          {!isLoaded ? (
            <div style={{ height: "100%", background: "#080D1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  border: `3px solid ${BLUE}`,
                  borderTopColor: "transparent",
                  animation: "spin 0.8s linear infinite",
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,.3)", fontFamily: "Inter, sans-serif" }}>Loading map...</span>
              </div>
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={{ height: "100%", width: "100%" }}
              options={MAP_OPTIONS}
              onLoad={onLoad}
              onUnmount={onUnmount}
              onClick={() => setSelected(null)}
            >
              {filtered.map(sub => (
                <OverlayView
                  key={sub.submission_id}
                  position={{ lat: Number(sub.gps.lat), lng: Number(sub.gps.lon) }}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                >
                  <PulseMarker
                    sub={sub}
                    isSelected={selected?.submission_id === sub.submission_id}
                    onClick={() => setSelected(prev => prev?.submission_id === sub.submission_id ? null : sub)}
                  />
                </OverlayView>
              ))}
            </GoogleMap>
          )}

          {/* Filter stat chips — top centre */}
          <div style={{
            position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
            zIndex: 10, display: "flex", gap: 0,
            background: "rgba(8,13,26,.85)", backdropFilter: "blur(16px)",
            borderRadius: 12, border: "1px solid rgba(255,255,255,.07)",
            boxShadow: "0 4px 28px rgba(0,0,0,.6)", overflow: "hidden",
          }}>
            {statChips.map((chip, i) => {
              const active = filter === chip.key;
              return (
                <button
                  key={chip.key}
                  onClick={() => setFilter(chip.key)}
                  style={{
                    padding: "10px 22px", textAlign: "center", cursor: "pointer", border: "none",
                    borderRight: i < statChips.length - 1 ? "1px solid rgba(255,255,255,.05)" : "none",
                    background: active ? "rgba(255,255,255,.1)" : "transparent",
                    transition: "background .15s", fontFamily: "Inter, sans-serif",
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,.05)"; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <div style={{ fontSize: 22, fontWeight: 900, color: chip.color, letterSpacing: -1, lineHeight: 1 }}>{chip.value}</div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: .8, marginTop: 4, color: active ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.28)" }}>
                    {chip.label}
                  </div>
                  {active && <div style={{ width: 20, height: 2, background: chip.color, borderRadius: 1, margin: "4px auto 0" }} />}
                </button>
              );
            })}
          </div>

          {/* Legend + controls — top right */}
          <div style={{
            position: "absolute", top: 16, right: 16, zIndex: 10,
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            {/* Legend */}
            <div style={{
              background: "rgba(8,13,26,.85)", backdropFilter: "blur(16px)",
              borderRadius: 10, border: "1px solid rgba(255,255,255,.07)",
              padding: "12px 16px", boxShadow: "0 4px 16px rgba(0,0,0,.5)",
              display: "flex", flexDirection: "column", gap: 7,
            }}>
              {[{ color: GREEN, label: "Pass ≥70" }, { color: AMBER, label: "Review 45–69" }, { color: RED, label: "Reject / Flag" }].map(l => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 9, height: 9, borderRadius: "50%", background: l.color, boxShadow: `0 0 6px ${l.color}88`, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,.5)", fontWeight: 500, fontFamily: "Inter, sans-serif" }}>{l.label}</span>
                </div>
              ))}
            </div>

            {/* Zoom controls */}
            <div style={{
              background: "rgba(8,13,26,.85)", backdropFilter: "blur(16px)",
              borderRadius: 10, border: "1px solid rgba(255,255,255,.07)",
              overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,.5)",
            }}>
              {[
                { icon: <ZoomIn size={13} />, action: () => mapRef?.setZoom((mapRef.getZoom() ?? 6) + 1) },
                { icon: <ZoomOut size={13} />, action: () => mapRef?.setZoom((mapRef.getZoom() ?? 6) - 1) },
              ].map((btn, i) => (
                <button
                  key={i}
                  onClick={btn.action}
                  style={{
                    display: "block", width: 36, padding: "9px 0",
                    background: "transparent", border: "none",
                    borderBottom: i === 0 ? "1px solid rgba(255,255,255,.05)" : "none",
                    cursor: "pointer", color: "rgba(255,255,255,.5)",
                    lineHeight: 0, textAlign: "center",
                    transition: "background .1s, color .1s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,.08)"; (e.currentTarget as HTMLButtonElement).style.color = "white"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,.5)"; }}
                >
                  {btn.icon}
                </button>
              ))}
            </div>

            {/* Layer toggle */}
            <button
              onClick={cycleStyle}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 36, height: 36, borderRadius: 10,
                background: "rgba(8,13,26,.85)", backdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,.07)",
                cursor: "pointer", color: "rgba(255,255,255,.5)",
                boxShadow: "0 4px 16px rgba(0,0,0,.5)", lineHeight: 0,
                transition: "background .1s, color .1s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,.1)"; (e.currentTarget as HTMLButtonElement).style.color = "white"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(8,13,26,.85)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,.5)"; }}
              title={["Dark", "Satellite", "Terrain"][styleIdx] + " — click to cycle"}
            >
              <Layers size={14} />
            </button>
          </div>

          {/* Selected submission card — bottom centre */}
          {selected && (
            <div style={{
              position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
              zIndex: 10, width: "min(520px, calc(100% - 32px))",
              background: "rgba(8,13,26,.92)", backdropFilter: "blur(20px)",
              borderRadius: 14, border: "1px solid rgba(255,255,255,.1)",
              padding: "14px 18px", boxShadow: "0 8px 40px rgba(0,0,0,.7)",
              display: "flex", gap: 16, alignItems: "center", fontFamily: "Inter, sans-serif",
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: clr(selected.overall_score) + "22",
                display: "grid", placeItems: "center",
                border: `2px solid ${clr(selected.overall_score)}55`, flexShrink: 0,
              }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: clr(selected.overall_score), fontFamily: "monospace" }}>{selected.overall_score}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.9)", marginBottom: 3 }}>{selected.enumerator_id}</div>
                <div style={{ display: "flex", gap: 12, fontSize: 11, color: "rgba(255,255,255,.4)" }}>
                  {selected.gps?.address && (
                    <span style={{ display: "flex", alignItems: "center", gap: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <MapPin size={10} />{selected.gps.address.split(",").slice(0, 2).join(",")}
                    </span>
                  )}
                  {selected.duration_mins && (
                    <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <Clock size={10} />{Math.round(Number(selected.duration_mins))}m
                    </span>
                  )}
                </div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 5, background: vbg(selected.verdict), color: clr(selected.overall_score), flexShrink: 0 }}>
                {selected.verdict}
              </span>
              <button
                onClick={() => setSelected(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,.35)", padding: 2, lineHeight: 0, flexShrink: 0 }}
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
