from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import base64
import io
import os
import tempfile
from datetime import datetime

from PIL import Image
from PyPDF2 import PdfReader, PdfWriter
from pdf2docx import Converter

from database import engine, SessionLocal, Base
from models import ConversionHistory


# ================= APP INIT =================
app = FastAPI()

Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= CONSTANTS =================
A4_WIDTH = 2480
A4_HEIGHT = 3508


# ================= REQUEST MODELS =================
class ConvertRequest(BaseModel):
    images: List[str]
    enhance: bool = True


class CompressRequest(BaseModel):
    file: str
    filename: str


# ================= ROOT =================
@app.get("/")
def home():
    return {"message": "Backend connected successfully"}


# ================= IMAGE → PDF =================
@app.post("/convert-to-pdf")
def convert_to_pdf(data: ConvertRequest):
    try:
        pdf_images = []

        for img_base64 in data.images:
            header, encoded = img_base64.split(",", 1)
            img_bytes = base64.b64decode(encoded)

            original_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            a4_page = Image.new("RGB", (A4_WIDTH, A4_HEIGHT), "white")

            img_ratio = original_img.width / original_img.height
            a4_ratio = A4_WIDTH / A4_HEIGHT

            if img_ratio > a4_ratio:
                new_width = A4_WIDTH
                new_height = int(A4_WIDTH / img_ratio)
            else:
                new_height = A4_HEIGHT
                new_width = int(A4_HEIGHT * img_ratio)

            resized_img = original_img.resize(
                (new_width, new_height),
                Image.Resampling.LANCZOS
            )

            x_offset = (A4_WIDTH - new_width) // 2
            y_offset = (A4_HEIGHT - new_height) // 2
            a4_page.paste(resized_img, (x_offset, y_offset))

            pdf_images.append(a4_page)

        pdf_buffer = io.BytesIO()
        pdf_images[0].save(
            pdf_buffer,
            format="PDF",
            save_all=True,
            append_images=pdf_images[1:]
        )

        pdf_base64 = base64.b64encode(pdf_buffer.getvalue()).decode()

        # ===== SAVE HISTORY =====
        db = SessionLocal()
        history = ConversionHistory(
            original_filename="Multiple Images",
            original_type="image",
            action_type="convert",
            output_filename="converted.pdf",
            output_type="pdf",
            status="success",
            created_at=datetime.utcnow()
        )
        db.add(history)
        db.commit()
        db.close()

        return {"status": "success", "pdf": pdf_base64}

    except Exception as e:
        return {"status": "error", "message": str(e)}


# ================= UNIVERSAL COMPRESS =================
@app.post("/compress")
def compress_file(data: CompressRequest):
    try:
        header, encoded = data.file.split(",", 1)
        file_bytes = base64.b64decode(encoded)
        filename = data.filename.lower()

        # ---------- IMAGE ----------
        if filename.endswith((".jpg", ".jpeg", ".png")):
            img = Image.open(io.BytesIO(file_bytes)).convert("RGB")

            buffer = io.BytesIO()
            img.save(buffer, format="JPEG", quality=60, optimize=True)

            compressed_base64 = base64.b64encode(buffer.getvalue()).decode()
            mime = "image/jpeg"
            original_type = "image"
            output_type = "image"

        # ---------- PDF ----------
        elif filename.endswith(".pdf"):
            reader = PdfReader(io.BytesIO(file_bytes))
            writer = PdfWriter()

            for page in reader.pages:
                writer.add_page(page)

            buffer = io.BytesIO()
            writer.write(buffer)

            compressed_base64 = base64.b64encode(buffer.getvalue()).decode()
            mime = "application/pdf"
            original_type = "pdf"
            output_type = "pdf"

        else:
            return {"status": "error", "message": "Unsupported file type"}

        # ===== SAVE HISTORY =====
        db = SessionLocal()
        history = ConversionHistory(
            original_filename=data.filename,
            original_type=original_type,
            action_type="compress",
            output_filename="compressed_" + data.filename,
            output_type=output_type,
            status="success",
            created_at=datetime.utcnow()
        )
        db.add(history)
        db.commit()
        db.close()

        return {
            "status": "success",
            "file": compressed_base64,
            "mime": mime
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}


# ================= HISTORY =================
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
                "original_type": item.original_type,
                "action_type": item.action_type,
                "output_filename": item.output_filename,
                "output_type": item.output_type,
                "status": item.status,
                "created_at": item.created_at.strftime("%Y-%m-%d %H:%M:%S")
            }
            for item in history
        ]
    finally:
        db.close()


# ================= PDF → DOCX =================
@app.post("/convert-pdf-to-docx")
async def convert_pdf_to_docx(file: UploadFile = File(...)):
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as pdf_tmp:
            pdf_tmp.write(await file.read())
            pdf_path = pdf_tmp.name

        docx_path = pdf_path.replace(".pdf", ".docx")

        cv = Converter(pdf_path)
        cv.convert(docx_path)
        cv.close()

        with open(docx_path, "rb") as f:
            docx_bytes = f.read()

        os.remove(pdf_path)
        os.remove(docx_path)

        docx_base64 = base64.b64encode(docx_bytes).decode("utf-8")

        return {
            "status": "success",
            "docx": docx_base64,
            "filename": "converted.docx"
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}
