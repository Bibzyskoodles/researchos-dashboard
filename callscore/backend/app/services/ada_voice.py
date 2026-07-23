"""
Ada Voice Layer — Bible Part 4A.3.

HARD RULE: the confidence register ("I know" / "I suspect" / "I recommend
checking") is mechanically derived from the scorecard's confidence_level,
never freely written by a language model. Any LLM-generated prose must be
wrapped through render_finding()/render_scorecard_summary() so a
confident-sounding sentence can never be produced from weak evidence.
"""
from dataclasses import dataclass
from enum import Enum


class Register(str, Enum):
    KNOW = "know"                      # direct, declarative
    SUSPECT = "suspect"                # hedged, names the evidence
    RECOMMEND_CHECKING = "recommend_checking"  # never asserts, only flags


def register_for(confidence_level: int) -> Register:
    """Deterministic mapping from Bible 4A.3. Do not soften or bypass."""
    if not 0 <= confidence_level <= 100:
        raise ValueError(f"confidence_level out of range: {confidence_level}")
    if confidence_level >= 90:
        return Register.KNOW
    if confidence_level >= 60:
        return Register.SUSPECT
    return Register.RECOMMEND_CHECKING


_OPENERS = {
    Register.KNOW: "I know",
    Register.SUSPECT: "I suspect",
    Register.RECOMMEND_CHECKING: "I recommend checking whether",
}


@dataclass
class VoicedStatement:
    register: Register
    text: str
    confidence_level: int


def render_finding(description: str, confidence_level: int, evidence_ref: str | None = None) -> VoicedStatement:
    """
    Wrap a single finding description in the register its confidence
    earns. description should be a plain clause, e.g.
    "question 7 was not asked" — the opener is prepended here.
    """
    register = register_for(confidence_level)
    clause = description.strip().rstrip(".")
    # Lowercase the leading character so the clause reads naturally after
    # the opener, unless it starts with a proper noun the caller controls.
    clause = clause[0].lower() + clause[1:] if clause else clause
    text = f"{_OPENERS[register]} {clause}"
    if register is Register.SUSPECT and evidence_ref:
        text += f" — see {evidence_ref}"
    return VoicedStatement(register=register, text=text + ".", confidence_level=confidence_level)


def render_scorecard_summary(
    fraud_risk: str,
    confidence_level: int,
    recommended_action: str,
    top_finding_description: str | None,
) -> VoicedStatement:
    """
    One-line scorecard summary in the correct register. Length follows
    the finding, not a template (Bible 4A.7): a clean interview gets one
    short sentence; a risky one names its strongest evidence.
    """
    register = register_for(confidence_level)
    if fraud_risk == "low" and recommended_action == "none":
        base = {
            Register.KNOW: "I know this interview is clean — no action needed",
            Register.SUSPECT: "I suspect this interview is fine, though the evidence is thinner than usual",
            Register.RECOMMEND_CHECKING: "I recommend checking whether this interview is fine — I don't have strong evidence either way",
        }[register]
        return VoicedStatement(register=register, text=base + ".", confidence_level=confidence_level)

    action_phrase = {
        "none": "no action is needed",
        "review_recording": "the recording should be reviewed",
        "conduct_backcheck": "a back-check should be conducted",
        "escalate": "this should be escalated",
    }.get(recommended_action, f"the recommended action is {recommended_action}")

    if top_finding_description:
        finding = render_finding(top_finding_description, confidence_level)
        text = f"{finding.text.rstrip('.')}; {action_phrase}."
    else:
        # No citable finding: Design Principle 1 forbids asserting anyway.
        register = Register.RECOMMEND_CHECKING
        text = f"I recommend checking this interview manually — {action_phrase}, but no single finding stands out."
    return VoicedStatement(register=register, text=text, confidence_level=confidence_level)
