import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/overview");
    } catch (err: any) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{minHeight:"100vh",background:"#F0F4FF",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter,sans-serif"}}>
      <div style={{background:"white",borderRadius:16,padding:40,width:"100%",maxWidth:400,boxShadow:"0 4px 24px rgba(8,13,26,.10)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:32,justifyContent:"center"}}>
          {/* LOGO_PLACEHOLDER — owner: drop /public/researchos-logo.png (square, ~36px). Falls back to a neutral tile until the file exists. */}
          <img
            src="/researchos-logo.png"
            alt="ResearchOS"
            onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.visibility="hidden"; }}
            style={{width:36,height:36,background:"#2463EB",borderRadius:9,objectFit:"contain"}}
          />
          <div>
            <div style={{fontSize:18,fontWeight:700,color:"#080D1A"}}>ResearchOS</div>
            <div style={{fontSize:10,color:"#9CA3AF",letterSpacing:1,textTransform:"uppercase"}}>by Intelligency AI</div>
          </div>
        </div>
        <h1 style={{fontSize:22,fontWeight:800,color:"#080D1A",marginBottom:6}}>Welcome back</h1>
        <p style={{fontSize:13.5,color:"#6B7280",marginBottom:28}}>Sign in to your workspace</p>
        {error && <div style={{background:"#FEF2F2",border:"1px solid #FECACA",color:"#DC2626",padding:"10px 13px",borderRadius:7,fontSize:12.5,marginBottom:16}}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Email address</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@organisation.com"
            style={{width:"100%",border:"1.5px solid #E2E8F0",borderRadius:8,padding:"10px 13px",fontSize:13.5,fontFamily:"Inter,sans-serif",color:"#080D1A",outline:"none",marginBottom:16,boxSizing:"border-box"}} />
          <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Password</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"
            style={{width:"100%",border:"1.5px solid #E2E8F0",borderRadius:8,padding:"10px 13px",fontSize:13.5,fontFamily:"Inter,sans-serif",color:"#080D1A",outline:"none",marginBottom:20,boxSizing:"border-box"}} />
          <button type="submit" disabled={loading}
            style={{width:"100%",padding:11,background:loading?"#93C5FD":"#2463EB",color:"white",border:"none",borderRadius:8,fontSize:14,fontWeight:600,cursor:loading?"not-allowed":"pointer",fontFamily:"Inter,sans-serif"}}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}