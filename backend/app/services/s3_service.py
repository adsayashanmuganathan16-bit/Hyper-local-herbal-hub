import boto3
import uuid
from botocore.exceptions import ClientError
from app.config import settings


class S3Service:
    """AWS S3 service for image upload/download/delete."""

    def __init__(self):
        self.s3_client = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
        self.bucket_name = settings.S3_BUCKET_NAME

    async def upload_image(self, file_data: bytes, folder: str, content_type: str = "image/jpeg") -> str:
        """Upload an image to S3 and return the URL."""
        file_extension = content_type.split("/")[-1]
        if file_extension == "jpeg":
            file_extension = "jpg"
        file_name = f"{folder}/{uuid.uuid4().hex}.{file_extension}"

        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=file_name,
                Body=file_data,
                ContentType=content_type,
            )
            url = f"https://{self.bucket_name}.s3.{settings.AWS_REGION}.amazonaws.com/{file_name}"
            return url
        except ClientError as e:
            raise Exception(f"S3 upload failed: {e}")

    async def delete_image(self, image_url: str) -> bool:
        """Delete an image from S3."""
        try:
            key = image_url.split(f"{self.bucket_name}.s3.{settings.AWS_REGION}.amazonaws.com/")[-1]
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=key)
            return True
        except ClientError:
            return False

    def generate_presigned_url(self, image_url: str, expires_in: int = 3600) -> str:
        """Generate a presigned URL for private images."""
        try:
            key = image_url.split(f"{self.bucket_name}.s3.{settings.AWS_REGION}.amazonaws.com/")[-1]
            return self.s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": key},
                ExpiresIn=expires_in,
            )
        except ClientError:
            return image_url


s3_service = S3Service()