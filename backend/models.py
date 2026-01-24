from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from zoneinfo import ZoneInfo
from database import Base

IST = ZoneInfo("Asia/Kolkata")

def get_ist_time():
    return datetime.now(IST)

class ConversionHistory(Base):
    __tablename__ = "conversion_history"

    id = Column(Integer, primary_key=True, index=True)
    original_filename = Column(String, nullable=False)
    pdf_filename = Column(String, nullable=False)
    status = Column(String, nullable=False)

    created_at = Column(
        DateTime,
        default=get_ist_time
    )
