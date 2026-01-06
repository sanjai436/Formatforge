from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import base64
import io

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ImageRequest(BaseModel):
    image: str

@app.get("/")
def home():
    return {"message": "Backend connected successfully"}

@app.post("/convert-to-pdf")
def convert_to_pdf(data: ImageRequest):
    # Extract base64 image
    image_base64 = data.image.split(",")[1]
    image_bytes = base64.b64decode(image_base64)

    # Convert to Image
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    # Create PDF in memory
    pdf_buffer = io.BytesIO()
    image.save(pdf_buffer, format="PDF")
    pdf_buffer.seek(0)

    # Convert PDF to base64
    pdf_base64 = base64.b64encode(pdf_buffer.read()).decode("utf-8")

    return {
        "status": "success",
        "pdf": pdf_base64
    }
