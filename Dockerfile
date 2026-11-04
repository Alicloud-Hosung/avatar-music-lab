# Optional packaging for a CPU extraction job. This image has not been built
# or executed on PAI for this public project.
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY extract_pose.py ./
ENTRYPOINT ["python", "extract_pose.py"]
