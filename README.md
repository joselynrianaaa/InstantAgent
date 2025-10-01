# InstantAgent

InstantAgent is a web application designed to facilitate the creation of AI agents using Together AI's API. This tool empowers users to build and deploy intelligent agents tailored to specific tasks, leveraging the capabilities of advanced language models.

## Features

- Customizable Agent Creation: Define agent goals, select appropriate models, and integrate necessary tools to suit specific tasks.
- Built with Bootstrap, ensuring a seamless experience across devices.
- View live responses from the Together AI API, enhancing the development and debugging process.

## Requirements

- Node.js and npm
- Python 3.7+ for the FastAPI backend
- Together AI API key

## Setup and Running

### Backend (FastAPI)

1. Make sure you have Python installed
2. Install the required packages:
   ```
   pip install fastapi uvicorn python-dotenv httpx pydantic
   ```
3. Create a `.env` file with your Together AI API key:
   ```
   TOGETHER_API_KEY=your_api_key_here
   ```
4. Run the FastAPI server:
   ```
   uvicorn main:app --reload
   ```
   The backend will be available at http://localhost:8000

### Frontend (React)

1. Make sure you have Node.js and npm installed
2. Install the dependencies:
   ```
   npm install
   ```
3. Run the development server:
   ```
   npm start
   ```
   The frontend will be available at http://localhost:3000

## Usage

1. Fill out the form with the agent's goal, select a model, and choose required tools
2. Click "Create Agent" to submit the request to the FastAPI backend
3. View the agent's response in the right panel
