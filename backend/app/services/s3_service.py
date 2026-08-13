import boto3
import uuid
from urllib.parse import urlsplit
from botocore.exceptions import ClientError
from app.config import settings


class S3Service:
    """AWS S3 service for image upload/download/delete."""

    def __init__(self):
        client_options = {"region_name": settings.AWS_REGION}
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            client_options.update(
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            )
        self.s3_client = boto3.client("s3", **client_options)
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
            # Do not persist a database URL until S3 confirms the object exists.
            self.s3_client.head_object(Bucket=self.bucket_name, Key=file_name)
            url = f"https://{self.bucket_name}.s3.{settings.AWS_REGION}.amazonaws.com/{file_name}"
            return url
        except ClientError as e:
            raise Exception(f"S3 upload failed: {e}")

    async def delete_image(self, image_url: str) -> bool:
        """Delete an image from S3."""
        try:
            key = self.object_key(image_url)
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=key)
            return True
        except ClientError:
            return False

    def is_bucket_object_url(self, image_url: str) -> bool:
        """Return whether a URL points to an object in the configured bucket."""
        if not image_url:
            return False
        object_base_url = (
            f"https://{self.bucket_name}.s3.{settings.AWS_REGION}.amazonaws.com/"
        )
        return image_url.startswith(object_base_url)

    def object_key(self, image_url: str) -> str:
        """Extract the S3 object key from a stored or presigned bucket URL."""
        return urlsplit(image_url).path.lstrip("/")

    def generate_presigned_url(self, image_url: str, expires_in: int = 3600) -> str:
        """Generate a presigned URL for private images."""
        if not self.is_bucket_object_url(image_url):
            return image_url
        if any(marker in image_url for marker in (
            "X-Amz-Signature=",
            "X-Amz-Credential=",
            "AWSAccessKeyId=",
            "Signature=",
        )):
            return image_url
        try:
            key = self.object_key(image_url)
            return self.s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": key},
                ExpiresIn=expires_in,
            )
        except ClientError:
            return image_url

    def display_url(self, image_url: str | None) -> str | None:
        """Return a browser-accessible URL without making S3 objects public."""
        if not image_url:
            return image_url
        return self.generate_presigned_url(image_url)


s3_service = S3Service()
