import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAda } from "../../ada/AdaContext";
import { useAuth } from "../../store/AuthContext";
import { dashboardApi, adaApi } from "../../services/api";
import { Send, Sparkles, TrendingUp, Users } from "lucide-react";

const BLUE="#2463EB",GREEN="#059669",AMBER="#D97706",PURPLE="#7C3AED";

const SUGGESTIONS=[
  {icon:"📊",text:"Summarise all verified submissions"},
  {icon:"🚩",text:"Why were submissions flagged?"},
  {icon:"👤",text:"How is ENID0010 performing?"},
  {icon:"📍",text:"Any GPS patterns or anomalies?"},
  {icon:"📄",text:"Prepare an interim report"},
  {icon:"🔍",text:"What are the key findings?"},
];

interface Message { id:string; role:"user"|"assistant"; content:string; timestamp:string; }

export default function InsightsPage(){
  const [messages,setMessages]=useState<Message[]>([]);
  const [input,setInput]=useState("");
  const [sending,setSending]=useState(false);
  const [stats,setStats]=useState<any>(null);
  const endRef=useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { setState } = useAda();

  useEffect(()=>{
    dashboardApi.getStats().then(r=>setStats(r.data));
    // Load previous conversation
    adaApi.getMemory().then(r=>{
      // Memory loaded — future: restore conversation
    }).catch(()=>{});
  },[]);

  useEffect(()=>{
    endRef.current?.scrollIntoView({behavior:"smooth"});
  },[messages]);

  const send=async(msg?:string)=>{
    const text=(msg||input).trim();
    if(!text||sending)return;
    setInput("");
    setSending(true);
    setState("thinking");
    const userMsg:Message={id:Date.now().toString(),role:"user",content:text,timestamp:new Date().toISOString()};
    setMessages(prev=>[...prev,userMsg]);
    try{
      const res=await adaApi.chat(text,"insights",{stats,recent_submissions:[],alerts:[]});
      const reply=res.data.reply||"I encountered an error. Please try again.";
      setMessages(prev=>[...prev,{id:(Date.now()+1).toString(),role:"assistant",content:reply,timestamp:new Date().toISOString()}]);
      setState("speaking");
      setTimeout(()=>setState("idle"),3000);
    }catch{
      setMessages(prev=>[...prev,{id:(Date.now()+1).toString(),role:"assistant",content:"Connection error. Please try again.",timestamp:new Date().toISOString()}]);
      setState("idle");
    }finally{
      setSending(false);
    }
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16,height:"calc(100vh - 120px)"}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexShrink:0}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:"#080D1A",letterSpacing:-.6,margin:0}}>AI Analysis</h1>
          <p style={{fontSize:12.5,color:"#9CA3AF",marginTop:4}}>Ada · Intelligent research analyst · {stats?.pass_count||0} verified submissions</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",border:"1px solid #E2E8F0",borderRadius:8,background:"white",fontSize:12.5,fontWeight:600,color:"#374151",cursor:"pointer"}}>
            <FileText size={13}/> Generate Report
          </button>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:16,flex:1,minHeight:0}}>

        {/* Chat */}
        <div style={{background:"white",borderRadius:16,border:"1px solid #E8EDF5",boxShadow:"0 2px 12px rgba(10,15,28,.06)",display:"flex",flexDirection:"column",overflow:"hidden"}}>

          {/* Chat header */}
          <div style={{padding:"16px 20px",borderBottom:"1px solid #F1F5F9",display:"flex",alignItems:"center",gap:12,background:"linear-gradient(135deg,#F8FAFF,white)",flexShrink:0}}>
            <div style={{width:40,height:40,borderRadius:"50%",overflow:"hidden",border:"2px solid #2463EB",flexShrink:0}}>
              <img src="/ada-avatar.jpg" alt="Ada" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"50% 15%"}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13.5,fontWeight:700,color:"#080D1A"}}>Ada</div>
              <div style={{fontSize:11,color:GREEN,display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:GREEN}}/>
                AI Research Analyst · Active
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,background:"#EFF6FF",border:"1px solid #DBEAFE",borderRadius:8,padding:"4px 10px"}}>
              <Sparkles size={11} color={BLUE}/>
              <span style={{fontSize:11,fontWeight:600,color:BLUE}}>GPT-4o</span>
            </div>
          </div>

          {/* Messages */}
          <div style={{flex:1,overflowY:"auto",padding:20,display:"flex",flexDirection:"column",gap:14}}>
            {messages.length===0&&(
              <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                <div style={{width:32,height:32,borderRadius:"50%",overflow:"hidden",flexShrink:0}}>
                  <img src="/ada-avatar.jpg" alt="Ada" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"50% 15%"}}/>
                </div>
                <div style={{background:"#F8FAFF",border:"1px solid #E8EDF5",borderRadius:"4px 14px 14px 14px",padding:"12px 16px",maxWidth:420}}>
                  <div style={{fontSize:13,color:"#374151",lineHeight:1.65}}>
                    {user?.name?.split(" ")[0]?"Hello "+user.name.split(" ")[0]+"! ":"Hello! "}I have already reviewed your current project data.
                    {stats&&<><br/><br/>You have <strong>{stats.total_submissions} submissions</strong> with an average trust score of <strong>{stats.avg_score}/100</strong>. Pass rate is <strong>{stats.pass_rate}%</strong>.<br/><br/></>}
                    What would you like to explore?
                  </div>
                </div>
              </div>
            )}
            <AnimatePresence>
              {messages.map(msg=>(
                <motion.div key={msg.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
                  style={{display:"flex",gap:10,alignItems:"flex-start",flexDirection:msg.role==="user"?"row-reverse":"row"}}>
                  {msg.role==="assistant"&&(
                    <div style={{width:32,height:32,borderRadius:"50%",overflow:"hidden",flexShrink:0}}>
                      <img src="/ada-avatar.jpg" alt="Ada" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"50% 15%"}}/>
                    </div>
                  )}
                  <div style={{
                    background:msg.role==="user"?BLUE:"#F8FAFF",
                    border:msg.role==="user"?"none":"1px solid #E8EDF5",
                    borderRadius:msg.role==="user"?"14px 4px 14px 14px":"4px 14px 14px 14px",
                    padding:"12px 16px",maxWidth:420,
                    fontSize:13,lineHeight:1.65,
                    color:msg.role==="user"?"white":"#374151",
                  }}
                    dangerouslySetInnerHTML={{__html:msg.content.replace(/[*][*](.*?)[*][*]/g,"<strong>$1</strong>").replace(/\n/g,"<br>")}}/>
                </motion.div>
              ))}
            </AnimatePresence>
            {sending&&(
              <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                <div style={{width:32,height:32,borderRadius:"50%",overflow:"hidden",flexShrink:0}}>
                  <img src="/ada-avatar.jpg" alt="Ada" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"50% 15%"}}/>
                </div>
                <div style={{background:"#F8FAFF",border:"1px solid #E8EDF5",borderRadius:"4px 14px 14px 14px",padding:"14px 18px",display:"flex",gap:5}}>
                  {[0,1,2].map(i=>(
                    <motion.div key={i} style={{width:7,height:7,borderRadius:"50%",background:BLUE}}
                      animate={{y:[0,-7,0]}} transition={{duration:0.6,repeat:Infinity,delay:i*0.15}}/>
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef}/>
          </div>

          {/* Suggestions */}
          {messages.length===0&&(
            <div style={{padding:"0 20px 12px",flexShrink:0,display:"flex",gap:6,flexWrap:"wrap"}}>
              {SUGGESTIONS.map(s=>(
                <button key={s.text} onClick={()=>send(s.text)}
                  style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",border:"1px solid #E2E8F0",borderRadius:20,background:"#FAFBFF",fontSize:11.5,fontWeight:500,color:"#374151",cursor:"pointer",transition:"all .15s"}}
                  onMouseEnter={e=>{(e.target as HTMLElement).style.borderColor=BLUE;(e.target as HTMLElement).style.color=BLUE;}}
                  onMouseLeave={e=>{(e.target as HTMLElement).style.borderColor="#E2E8F0";(e.target as HTMLElement).style.color="#374151";}}>
                  <span>{s.icon}</span>{s.text}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{padding:"12px 16px",borderTop:"1px solid #F1F5F9",display:"flex",gap:8,flexShrink:0}}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}
              placeholder="Ask Ada anything about your data..."
              style={{flex:1,border:"1.5px solid #E2E8F0",borderRadius:10,padding:"10px 14px",fontSize:13,fontFamily:"Inter,sans-serif",outline:"none",color:"#080D1A",transition:"border-color .15s"}}
              onFocus={e=>(e.target.style.borderColor=BLUE)} onBlur={e=>(e.target.style.borderColor="#E2E8F0")}/>
            <button onClick={()=>send()} disabled={sending||!input.trim()}
              style={{width:42,height:42,borderRadius:10,background:sending||!input.trim()?"#93C5FD":BLUE,border:"none",cursor:sending||!input.trim()?"not-allowed":"pointer",display:"grid",placeItems:"center",transition:"all .15s"}}>
              <Send size={15} color="white"/>
            </button>
          </div>
        </div>

        {/* Context panel */}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{background:"white",borderRadius:16,padding:16,border:"1px solid #E8EDF5",boxShadow:"0 2px 12px rgba(10,15,28,.06)"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:.7,marginBottom:12}}>Live Context</div>
            {stats&&[
              {label:"Verified",value:stats.pass_count||0,icon:<TrendingUp size={12} color={GREEN}/>,color:GREEN},
              {label:"Avg Score",value:(stats.avg_score||0)+"/100",icon:<Sparkles size={12} color={BLUE}/>,color:BLUE},
              {label:"Pass Rate",value:(stats.pass_rate||0)+"%",icon:<TrendingUp size={12} color={GREEN}/>,color:GREEN},
              {label:"Flagged",value:stats.flag_count||0,icon:<Users size={12} color={AMBER}/>,color:AMBER},
            ].map(item=>(
              <div key={item.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid #F8FAFF"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#6B7280"}}>{item.icon}{item.label}</div>
                <div style={{fontSize:13,fontWeight:700,color:item.color,fontFamily:"monospace"}}>{item.value}</div>
              </div>
            ))}
          </div>

          <div style={{background:"linear-gradient(135deg,#1A1F3E,#0F172A)",borderRadius:16,padding:16,border:"1px solid rgba(255,255,255,.06)"}}>
            <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:.7,marginBottom:10}}>Ada can help with</div>
            {["Fraud pattern analysis","Enumerator performance","GPS verification results","Theme extraction","Executive summaries","Client-ready reports"].map(item=>(
              <div key={item} onClick={()=>send(item)} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,.04)",cursor:"pointer",fontSize:12,color:"rgba(255,255,255,.6)",transition:"color .15s"}}
                onMouseEnter={e=>(e.currentTarget.style.color="white")} onMouseLeave={e=>(e.currentTarget.style.color="rgba(255,255,255,.6)")}>
                <div style={{width:4,height:4,borderRadius:"50%",background:"rgba(96,165,250,.6)",flexShrink:0}}/>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}