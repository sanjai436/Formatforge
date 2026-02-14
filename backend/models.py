from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from database import Base


class ConversionHistory(Base):
    __tablename__ = "conversion_history"

    id = Column(Integer, primary_key=True, index=True)

    # Uploaded file
    original_filename = Column(String, nullable=False)
    original_type = Column(String, nullable=False)  
    # Example: "image", "pdf"

    # Action performed
    action_type = Column(String, nullable=False)  
    # Example: "convert", "compress"

    # Output file
    output_filename = Column(String, nullable=False)
    output_type = Column(String, nullable=False)  
    # Example: "pdf", "jpg"

    # Status
    status = Column(String, nullable=False)

    # Store UTC time (BEST PRACTICE)
    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )
