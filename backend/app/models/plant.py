from pydantic import BaseModel


class PlantIdentificationResponse(BaseModel):
    """Stable response contract exposed to the React application."""

    common_name: str
    common_name_tamil: str
    scientific_name: str
    scientific_name_tamil: str
    family: str
    family_tamil: str
    confidence: str
    confidence_tamil: str
    description: str
    description_tamil: str
    medicinal_uses: str
    medicinal_uses_tamil: str
    precautions: str
    precautions_tamil: str
