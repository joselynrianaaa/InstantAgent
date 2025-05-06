from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Optional
import httpx
import os
from dotenv import load_dotenv
import logging
from fastapi.middleware.cors import CORSMiddleware
import uuid
from datetime import datetime
from fastapi import Request

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = FastAPI()

# Configure CORS - this MUST be added before any routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Allow all origins for testing
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Add a route to handle OPTIONS preflight requests
@app.options("/{path:path}")
async def options_handler(request: Request, path: str):
    logger.info(f"Handling OPTIONS request for path: /{path}")
    return JSONResponse(content={}, status_code=200)

# Storage for agent conversations
# In a production app, this would be a database
conversations: Dict[str, List[Dict]] = {}

class AgentRequest(BaseModel):
    goal: str
    model: str
    tools: List[str]

class ChatRequest(BaseModel):
    agent_id: str
    message: str

class AgentResponse(BaseModel):
    agent_id: str
    response: Dict
    created_at: str

@app.get("/")
async def root():
    return {"message": "Welcome to the Agent Creation API. Use POST /create-agent to create a new agent."}

@app.post("/create-agent")
async def create_agent(request: AgentRequest):
    logger.info(f"Received request to create agent with goal: {request.goal}")
    together_api_key = os.getenv("TOGETHER_API_KEY")
    if not together_api_key:
        logger.error("Together API key not found in environment variables")
        raise HTTPException(status_code=500, detail="Together API key not found in environment variables")

    system_prompt = f"You are an agent with the goal: {request.goal}"
    user_message = "Hello agent, tell me what you can do."
    
    logger.info(f"Calling Together API with model: {request.model}")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.together.xyz/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {together_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": request.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message}
                    ]
                }
            )
            
            logger.info(f"Together API response status: {response.status_code}")
            
            if response.status_code != 200:
                error_detail = f"Error calling Together API: {response.text}"
                logger.error(error_detail)
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            # Generate a unique ID for this agent
            agent_id = str(uuid.uuid4())
            
            # Store conversation history
            conversations[agent_id] = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ]
            
            # Get the assistant's response
            api_response = response.json()
            if "choices" in api_response and len(api_response["choices"]) > 0:
                assistant_message = api_response["choices"][0]["message"]
                conversations[agent_id].append(assistant_message)
            
            # Include agent_id in response
            result = {
                "agent_id": agent_id,
                **api_response
            }
            
            return result
            
    except httpx.RequestError as exc:
        error_detail = f"HTTP Request error: {str(exc)}"
        logger.error(error_detail)
        raise HTTPException(status_code=500, detail=error_detail)
    except Exception as e:
        error_detail = f"Unexpected error: {str(e)}"
        logger.error(error_detail)
        raise HTTPException(status_code=500, detail=error_detail)

@app.post("/chat-agent")
async def chat_with_agent(request: ChatRequest):
    logger.info(f"Received chat request for agent: {request.agent_id}")
    
    # Check if agent exists
    if request.agent_id not in conversations:
        raise HTTPException(status_code=404, detail="Agent not found. Create an agent first.")
    
    together_api_key = os.getenv("TOGETHER_API_KEY")
    if not together_api_key:
        raise HTTPException(status_code=500, detail="Together API key not found")
    
    # Add user message to conversation history
    conversations[request.agent_id].append({"role": "user", "content": request.message})
    
    # Get conversation history for context
    messages = conversations[request.agent_id]
    
    try:
        # Call the API with the full conversation history
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.together.xyz/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {together_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    # Use the same model that was used to create the agent
                    "model": "mistralai/Mixtral-8x7B-Instruct-v0.1",  # Default model
                    "messages": messages
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, 
                                   detail=f"Error calling Together API: {response.text}")
            
            # Get the response
            api_response = response.json()
            
            # Extract assistant message and add to conversation history
            if "choices" in api_response and len(api_response["choices"]) > 0:
                assistant_message = api_response["choices"][0]["message"]
                conversations[request.agent_id].append(assistant_message)
            
            return api_response
            
    except httpx.RequestError as exc:
        raise HTTPException(status_code=500, detail=f"HTTP Request error: {str(exc)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
    
 

