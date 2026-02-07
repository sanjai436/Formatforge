from fastapi import FastAPI
from database import engine
from models import ConversionHistory
from database import Base
from sqlalchemy.orm import Session
from database import SessionLocal

from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import base64
import io
from PIL import Image

from fastapi import UploadFile, File
from pdf2docx import Converter
import tempfile
import os





app = FastAPI()

# Create database tables
Base.metadata.create_all(bind=engine)
# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()



app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- PDF PAGE SIZE (A4) ----------
# A4 size in pixels at 300 DPI
A4_WIDTH = 2480
A4_HEIGHT = 3508

class ConvertRequest(BaseModel):
    images: List[str]   # base64 images
    enhance: bool = True


class ImageRequest(BaseModel):
    image: str

@app.get("/")
def home():
    return {"message": "Backend connected successfully"}

@app.post("/convert-to-pdf")
def convert_to_pdf(data: ConvertRequest):
    try:
        pdf_images = []

        for img_base64 in data.images:
            # Split base64 header and data
            header, encoded = img_base64.split(",", 1)
            img_bytes = base64.b64decode(encoded)

            # Open image
            original_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")

            # Create blank A4 white page
            a4_page = Image.new("RGB", (A4_WIDTH, A4_HEIGHT), "white")

            # Maintain aspect ratio
            img_ratio = original_img.width / original_img.height
            a4_ratio = A4_WIDTH / A4_HEIGHT

            if img_ratio > a4_ratio:
                # Image is wider
                new_width = A4_WIDTH
                new_height = int(A4_WIDTH / img_ratio)
            else:
                # Image is taller
                new_height = A4_HEIGHT
                new_width = int(A4_HEIGHT * img_ratio)

            # Resize smoothly
            resized_img = original_img.resize(
                (new_width, new_height),
                Image.Resampling.LANCZOS
            )

            # Center image on A4 page
            x_offset = (A4_WIDTH - new_width) // 2
            y_offset = (A4_HEIGHT - new_height) // 2

            a4_page.paste(resized_img, (x_offset, y_offset))

            pdf_images.append(a4_page)

        # Create PDF
        pdf_buffer = io.BytesIO()
        pdf_images[0].save(
            pdf_buffer,
            format="PDF",
            save_all=True,
            append_images=pdf_images[1:]
        )

        pdf_base64 = base64.b64encode(pdf_buffer.getvalue()).decode()

        # Save history to database
        db = SessionLocal()

        history = ConversionHistory(
            original_filename="Multiple Images",
            pdf_filename="formatforge.pdf",
            status="success"
        )

        db.add(history)
        db.commit()
        db.close()

        return {
            "status": "success",
            "pdf": pdf_base64
        }


    except Exception as e:
        print("PDF Conversion Error:", e)
        return {
            "status": "error",
            "message": str(e)
        }


@app.get("/history")
def get_history():
    db = SessionLocal()
    try:
        history = (
            db.query(ConversionHistory)
            .order_by(ConversionHistory.created_at.desc())
            .all()
        )

        return [
            {
                "id": item.id,
                "original_filename": item.original_filename,
                "pdf_filename": item.pdf_filename,
                "status": item.status,
                "created_at": item.created_at.strftime("%Y-%m-%d %H:%M:%S")
            }
            for item in history
        ]

    finally:
        db.close()

@app.post("/convert-pdf-to-docx")
async def convert_pdf_to_docx(file: UploadFile = File(...)):
    try:
        # Create temp files
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as pdf_tmp:
            pdf_tmp.write(await file.read())
            pdf_path = pdf_tmp.name

        docx_path = pdf_path.replace(".pdf", ".docx")

        # Convert PDF → DOCX
        cv = Converter(pdf_path)
        cv.convert(docx_path)
        cv.close()

        # Read DOCX and encode
        with open(docx_path, "rb") as f:
            docx_bytes = f.read()

        docx_base64 = base64.b64encode(docx_bytes).decode("utf-8")

        # Cleanup temp files
        os.remove(pdf_path)
        os.remove(docx_path)

        return {
            "status": "success",
            "docx": docx_base64,
            "filename": "converted.docx"
        }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }
