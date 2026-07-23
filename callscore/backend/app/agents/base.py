"""
Base agent contract. Every agent in the Tier 1-4 pipeline implements this
so orchestration (Part 4.3) can run them uniformly and Evidence Generation
(Tier 4) can trust the shape of every upstream finding.

Design Principle 1 (Part 3): no score without evidence. AgentFinding.evidence
must always be populated with something concrete, or confidence should be
low enough that Synthesis routes to human review instead of trusting it.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime


@dataclass
class AgentFinding:
    agent_name: str
    finding_type: str
    description: str
    confidence: int  # 0-100
    timestamp_range_start: Optional[int] = None  # seconds into interview
    timestamp_range_end: Optional[int] = None
    raw_output: dict = field(default_factory=dict)


class BaseAgent(ABC):
    name: str

    @abstractmethod
    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        """
        context contains whatever this agent's tier needs:
        Tier 1: raw audio path
        Tier 2: transcript + questionnaire_items
        Tier 3: transcript + prior interviews for same enumerator/project
        Never assume more context is available than your tier guarantees.
        """
        raise NotImplementedError
