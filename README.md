# InstantAgent

A web application for creating AI agents using Together AI's API.

## Features

- Create agents with customizable goals, models, and tools
- Responsive Bootstrap UI
- Real-time API response display

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
