import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import TemplateLibrary from "../../components/TemplateLibrary";

const BLUE = "#2463EB";

export default function TemplateLibraryPage() {
  const navigate = useNavigate();
  const [clonedQuestionnaire, setClonedQuestionnaire] = useState<any>(null);

  const handleTemplateClone = (questionnaire: any) => {
    // Store the cloned questionnaire and redirect to editor
    setClonedQuestionnaire(questionnaire);
    // Pass the cloned questionnaire to the questionnaire editor
    navigate("/questionnaire", { state: { cloned: questionnaire } });
  };

  return (
    <div>
      {/* Header Navigation */}
      <div style={{
        padding: "16px 24px",
        borderBottom: "1px solid #E8EDF5",
        background: "white",
        display: "flex",
        alignItems: "center",
        gap: 12
      }}>
        <button
          onClick={() => navigate("/questionnaire")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: BLUE,
            padding: 4,
            display: "flex",
            alignItems: "center"
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>
          Back to Editor
        </h1>
      </div>

      {/* Template Library */}
      <TemplateLibrary onTemplateClone={handleTemplateClone} />
    </div>
  );
}
