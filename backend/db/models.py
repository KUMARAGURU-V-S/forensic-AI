"""
SQLAlchemy ORM models for all forensic platform entities.
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, DateTime,
    JSON, Text, Boolean, ForeignKey,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

def _uuid():
    return str(uuid.uuid4())

def _now():
    return datetime.utcnow()


class Case(Base):
    __tablename__ = "cases"

    id               = Column(String, primary_key=True)
    title            = Column(String, nullable=False)
    status           = Column(String, default="active")
    priority         = Column(String, default="medium")
    classification   = Column(String, default="Under Investigation")
    lead_investigator= Column(String, default="")
    created_at       = Column(DateTime, default=_now)
    updated_at       = Column(DateTime, default=_now, onupdate=_now)
    case_data        = Column(JSON, default=dict)  # backward-compat full blob

    evidences    = relationship("Evidence",      back_populates="case", cascade="all, delete-orphan")
    events       = relationship("TimelineEvent", back_populates="case", cascade="all, delete-orphan")
    audit_logs   = relationship("AuditLog",      back_populates="case")
    reviews      = relationship("ReviewAction",  back_populates="case")
    risk         = relationship("RiskAssessment",back_populates="case", uselist=False,
                                cascade="all, delete-orphan")


class Evidence(Base):
    __tablename__ = "evidence"

    id            = Column(String, primary_key=True, default=_uuid)
    case_id       = Column(String, ForeignKey("cases.id"), nullable=False)
    evidence_type = Column(String, nullable=False)  # autopsy|cctv|mobile|calls|location|toxicology|iot|document
    filename      = Column(String, default="")
    file_path     = Column(String, default="")
    sha256        = Column(String, default="")
    size_bytes    = Column(Integer, default=0)
    status        = Column(String, default="processing")  # processing|ready|error
    uploaded_at   = Column(DateTime, default=_now)
    uploader      = Column(String, default="investigator")
    meta          = Column(JSON, default=dict)          # device, camera_id, etc.
    extracted_text= Column(Text, nullable=True)
    parsed_data   = Column(JSON, nullable=True)         # structured output after processing

    case    = relationship("Case",         back_populates="evidences")
    events  = relationship("TimelineEvent",back_populates="evidence")
    reviews = relationship("ReviewAction", back_populates="evidence")


class TimelineEvent(Base):
    __tablename__ = "timeline_events"

    id          = Column(String, primary_key=True, default=_uuid)
    case_id     = Column(String, ForeignKey("cases.id"), nullable=False)
    evidence_id = Column(String, ForeignKey("evidence.id"), nullable=True)
    event_type  = Column(String, nullable=False)   # cctv|phone|iot|biometric|location|autopsy
    category    = Column(String, default="")
    title       = Column(String, nullable=False)
    description = Column(Text, default="")
    event_ts    = Column(DateTime, nullable=False)  # the forensic timestamp
    source      = Column(String, default="")
    confidence  = Column(Float, default=0.9)
    severity    = Column(String, default="medium")  # critical|high|medium|low
    meta        = Column(JSON, default=dict)

    case     = relationship("Case",    back_populates="events")
    evidence = relationship("Evidence",back_populates="events")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id           = Column(String, primary_key=True, default=_uuid)
    case_id      = Column(String, ForeignKey("cases.id"), nullable=True)
    user_id      = Column(String, default="investigator")
    action       = Column(String, nullable=False)  # create|update|upload|export|login|review
    entity_type  = Column(String, default="")
    entity_id    = Column(String, nullable=True)
    before_state = Column(JSON, nullable=True)
    after_state  = Column(JSON, nullable=True)
    timestamp    = Column(DateTime, default=_now)
    ip_address   = Column(String, nullable=True)

    case = relationship("Case", back_populates="audit_logs")


class ReviewAction(Base):
    __tablename__ = "review_actions"

    id          = Column(String, primary_key=True, default=_uuid)
    case_id     = Column(String, ForeignKey("cases.id"), nullable=False)
    evidence_id = Column(String, ForeignKey("evidence.id"), nullable=True)
    reviewer    = Column(String, default="Det. Investigator")
    action      = Column(String, nullable=False)  # approve|reject|tag|annotate
    note        = Column(Text, nullable=True)
    tags        = Column(JSON, default=list)
    target_type = Column(String, default="finding")  # finding|suspect|evidence
    target_id   = Column(String, nullable=True)
    timestamp   = Column(DateTime, default=_now)

    case     = relationship("Case",    back_populates="reviews")
    evidence = relationship("Evidence",back_populates="reviews")


class User(Base):
    __tablename__ = "users"

    id              = Column(String, primary_key=True, default=_uuid)
    username        = Column(String, unique=True, nullable=False)
    email           = Column(String, unique=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    role            = Column(String, default="investigator")  # admin|investigator|viewer
    full_name       = Column(String, default="")
    created_at      = Column(DateTime, default=_now)
    is_active       = Column(Boolean, default=True)


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id           = Column(String, primary_key=True, default=_uuid)
    case_id      = Column(String, ForeignKey("cases.id"), unique=True, nullable=False)
    overall_score= Column(Float, default=0.0)
    severity     = Column(String, default="low")
    components   = Column(JSON, default=list)
    shap_values  = Column(JSON, default=list)
    ai_summary   = Column(Text, nullable=True)
    key_findings = Column(JSON, default=list)
    recommendation=Column(Text, nullable=True)
    computed_at  = Column(DateTime, default=_now)

    case = relationship("Case", back_populates="risk")


class AutopsyReport(Base):
    __tablename__ = "autopsy_reports"

    id              = Column(String, primary_key=True, default=_uuid)
    case_id         = Column(String, ForeignKey("cases.id"), nullable=False)
    filename        = Column(String, default="")
    file_path       = Column(String, default="")
    sha256          = Column(String, default="")
    size_bytes      = Column(Integer, default=0)
    page_count      = Column(Integer, default=0)
    language        = Column(String, default="English")
    status          = Column(String, default="processing")  # processing|ocr|chunking|embedding|analyzing|complete|error
    ocr_status      = Column(String, default="pending")     # pending|running|complete|error
    uploader        = Column(String, default="investigator")
    uploaded_at     = Column(DateTime, default=_now)
    ocr_text        = Column(Text, nullable=True)
    chunks_json     = Column(JSON, nullable=True)           # list of {chunk_id, text, page}
    structured_json = Column(JSON, nullable=True)           # full forensic extraction
    ai_summary      = Column(Text, nullable=True)
    confidence      = Column(Float, default=0.0)
    version         = Column(Integer, default=1)
    report_type     = Column(String, default="Autopsy Report")
    collected_by    = Column(String, default="Forensic Lab")
    source          = Column(String, default="")

    case = relationship("Case", foreign_keys=[case_id])
