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
        <div style={{marginBottom:28,display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
          <div style={{background:"linear-gradient(135deg,#1A1F3E 0%,#0F172A 100%)",borderRadius:12,padding:"16px 22px",width:"100%",display:"flex",justifyContent:"center"}}>
            <img src="/researchos-logo.png" alt="ResearchOS" style={{width:210,maxWidth:"80%",height:"auto",objectFit:"contain"}} />
          </div>
          <div style={{fontSize:10,color:"#9CA3AF",letterSpacing:1,textTransform:"uppercase"}}>by Intelligency AI</div>
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