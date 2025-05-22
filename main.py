from fastapi import FastAPI, HTTPException, Request, Depends
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
from database import SessionLocal, User, Agent, Message, get_db
from sqlalchemy.orm import Session

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = FastAPI()

# Configure CORS - this MUST be added before any routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","http://localhost:3001", "http://127.0.0.1:3000", "http://localhost:8000", "http://127.0.0.1:8000"],  # Allow frontend origins
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*", "Content-Type", "Authorization", "X-Requested-With"],
)

# Add a route to handle OPTIONS preflight requests
@app.options("/{path:path}")
async def options_handler(request: Request, path: str):
    logger.info(f"Handling OPTIONS request for path: /{path}")
    return JSONResponse(
        content={},
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
        }
    )

# Storage for agent conversations
# In a production app, this would be a database
conversations: Dict[str, Dict] = {}

class AgentRequest(BaseModel):
    goal: str
    model: str
    tools: Optional[List[str]] = []
    user_name: Optional[str] = None  # Add user_name field

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
async def create_agent(request: AgentRequest, db: Session = Depends(get_db)):
    try:
        logger.info(f"Received request to create agent with goal: {request.goal}")
        
        # Validate required fields
        if not request.goal:
            raise HTTPException(status_code=400, detail="Agent goal is required")
        if not request.model:
            raise HTTPException(status_code=400, detail="Model name is required")
            
        # Create or get user
        user = None
        if request.user_name:
            user = db.query(User).filter(User.name == request.user_name).first()
            if not user:
                user = User(name=request.user_name)
                db.add(user)
                db.commit()
                db.refresh(user)
        
        # Generate agent ID
        agent_id = str(uuid.uuid4())
        
        # Prepare API request
        system_prompt = f"You are an agent with the goal: {request.goal}"
        user_message = "Hello agent, tell me what you can do."
        
        # Determine API endpoint and key based on model
        if "openai" in request.model.lower():
            api_endpoint = "https://openrouter.ai/api/v1/chat/completions"
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise HTTPException(status_code=500, detail="OpenAI API key not found")
        else:
            api_endpoint = "https://api.together.xyz/v1/chat/completions"
            api_key = os.getenv("TOGETHER_API_KEY")
            if not api_key:
                raise HTTPException(status_code=500, detail="Together API key not found")

        # Prepare request body
        request_body = {
            "model": request.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ]
        }
        
        # Add model-specific parameters
        if "openai" in request.model.lower():
            request_body.update({
                "temperature": 0.7,
                "max_tokens": 500
            })
        elif "mixtral" in request.model.lower():
            request_body.update({
                "temperature": 0.75,
                "max_tokens": 600,
                "top_p": 0.9,
                "stop": ["USER:", "ASSISTANT:"],
                "frequency_penalty": 0.2,
                "presence_penalty": 0.4
            })

        logger.info(f"Using API endpoint: {api_endpoint}")
        
        # Make API call
        async with httpx.AsyncClient(timeout=120.0) as client:
            headers = {
                "Content-Type": "application/json"
            }
            
            if "openai" in request.model.lower():
                headers["Authorization"] = f"Bearer {api_key}"
                headers["HTTP-Referer"] = "https://instantagent.app"
                headers["X-Title"] = "InstantAgent"
            else:
                headers["Authorization"] = f"Bearer {api_key}"
            
            response = await client.post(
                api_endpoint,
                headers=headers,
                json=request_body
            )
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"API Error: {error_text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"API Error: {error_text}"
                )
            
            api_response = response.json()
            
            # Create the agent in database
            agent = Agent(
                id=agent_id,
                user_id=user.id if user else None,
                name=request.goal[:100],  # Use first 100 chars of goal as initial name
                model=request.model,
                goal=request.goal
            )
            if request.tools:
                agent.set_tools(request.tools)
            db.add(agent)
            
            # Store the conversation messages
            messages = [
                Message(
                    agent_id=agent_id,
                    role="system",
                    content=system_prompt
                ),
                Message(
                    agent_id=agent_id,
                    role="user",
                    content=user_message
                )
            ]
            
            if "choices" in api_response and len(api_response["choices"]) > 0:
                assistant_message = Message(
                    agent_id=agent_id,
                    role="assistant",
                    content=api_response["choices"][0]["message"]["content"]
                )
                messages.append(assistant_message)
            
            # Add all messages to database
            for message in messages:
                db.add(message)
            
            db.commit()
            
            # Return the response
            return {
                "agent_id": agent_id,
                "choices": api_response.get("choices", [])
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating agent: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error creating agent: {str(e)}")

async def handle_image_generation_model(request: AgentRequest, api_key: str):
    """Handle image generation models like Stable Diffusion"""
    logger.info(f"Handling image generation model: {request.model}")
    
    # Generate a unique ID for this agent
    agent_id = str(uuid.uuid4())
    
    # Create a basic response that explains this is an image generation model
    image_generation_response = {
        "agent_id": agent_id,
        "choices": [{
            "message": {
                "role": "assistant",
                "content": f"🎨 Hi there! I'm an image generation assistant using {request.model}. I can create images based on your text descriptions. Just describe what you'd like to see, and I'll make it for you!"
            },
            "index": 0,
            "finish_reason": "stop"
        }],
        "model": request.model,
        "is_image_model": True
    }
    
    # Store conversation history and agent metadata
    conversations[agent_id] = {
        "messages": [
            {"role": "system", "content": f"You are an image generation assistant using {request.model}."},
            {"role": "user", "content": "Hello, what can you do?"},
            {"role": "assistant", "content": f"🎨 Hi there! I'm an image generation assistant using {request.model}. I can create images based on your text descriptions. Just describe what you'd like to see, and I'll make it for you!"}
        ],
        "model": request.model,
        "goal": request.goal,
        "tools": request.tools,
        "is_image_model": True
    }
    
    return image_generation_response

@app.post("/chat-agent")
async def chat_with_agent(request: ChatRequest, db: Session = Depends(get_db)):
    try:
        logger.info(f"Received chat request for agent: {request.agent_id}")
        
        # Check if agent exists in database
        agent = db.query(Agent).filter(Agent.id == request.agent_id).first()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found. Create an agent first.")
        
        # Add user message to database
        user_message = Message(
            agent_id=request.agent_id,
            role="user",
            content=request.message
        )
        db.add(user_message)
        db.commit()
        
        # Get all messages for context
        messages = [
            {"role": msg.role, "content": msg.content}
            for msg in db.query(Message)
            .filter(Message.agent_id == request.agent_id)
            .order_by(Message.created_at)
            .all()
        ]
        
        # Prepare API request
        request_body = {
            "model": agent.model,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 500
        }
        
        # Determine API endpoint and key
        if "openai" in agent.model.lower():
            api_endpoint = "https://openrouter.ai/api/v1/chat/completions"
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise HTTPException(status_code=500, detail="OpenAI API key not found")
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "https://instantagent.app",
                "X-Title": "InstantAgent"
            }
        else:
            api_endpoint = "https://api.together.xyz/v1/chat/completions"
            api_key = os.getenv("TOGETHER_API_KEY")
            if not api_key:
                raise HTTPException(status_code=500, detail="Together API key not found")
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            }
        
        logger.info(f"Making API call to {api_endpoint}")
        
        # Make API call
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    api_endpoint,
                    headers=headers,
                    json=request_body
                )
                
                response.raise_for_status()  # Raise exception for non-200 status codes
                api_response = response.json()
                
                # Store assistant's response in database
                if "choices" in api_response and len(api_response["choices"]) > 0:
                    assistant_message = Message(
                        agent_id=request.agent_id,
                        role="assistant",
                        content=api_response["choices"][0]["message"]["content"]
                    )
                    db.add(assistant_message)
                    db.commit()
                
                return api_response
                
            except httpx.HTTPStatusError as e:
                error_message = "API request failed"
                try:
                    error_data = e.response.json()
                    if "error" in error_data:
                        error_message = error_data["error"].get("message", error_message)
                except:
                    error_message = str(e)
                
                logger.error(f"API Error: {error_message}")
                raise HTTPException(status_code=e.response.status_code, detail=error_message)
                
            except httpx.RequestError as e:
                error_message = f"Request failed: {str(e)}"
                logger.error(error_message)
                raise HTTPException(status_code=500, detail=error_message)
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred: {str(e)}"
        )
    
class AgentNameRequest(BaseModel):
    goal: str

@app.post("/agent-name")
async def generate_agent_name(request: AgentNameRequest):
    logger.info(f"Received request to generate agent name for goal: {request.goal}")
    
    together_api_key = os.getenv("TOGETHER_API_KEY")
    if not together_api_key:
        logger.error("Together API key not found in environment variables")
        raise HTTPException(status_code=500, detail="Together API key not found")
    
    prompt = f"""Create a short, catchy and HIGHLY RELEVANT name (2-3 words) for an AI assistant with this goal: '{request.goal}'
For example:
- If the goal is about math or algebra, name it something like 'Math Wizard' or 'Algebra Pro'
- If about budgeting or finance, name it something like 'Budget Buddy' or 'Finance Coach'
- If about travel, name it something like 'Travel Guide' or 'Journey Planner'

The name MUST directly relate to the primary purpose in the goal.
Return ONLY the name, no explanations or quotation marks."""
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.together.xyz/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {together_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "mistralai/Mistral-7B-Instruct-v0.2",
                    "messages": [
                        {"role": "system", "content": "You create short, catchy names for AI assistants."},
                        {"role": "user", "content": prompt}
                    ],
                    "max_tokens": 20,
                    "temperature": 0.7
                }
            )
            
            logger.info(f"Together API response status for name generation: {response.status_code}")
            
            if response.status_code != 200:
                error_detail = f"Error calling Together API: {response.text}"
                logger.error(error_detail)
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            api_response = response.json()
            
            if "choices" in api_response and len(api_response["choices"]) > 0:
                name = api_response["choices"][0]["message"]["content"].strip()
                # Clean up the name - remove quotes, periods, etc.
                name = name.replace('"', '').replace("'", "").replace(".", "").strip()
                
                # If name is too long, truncate it
                if len(name.split()) > 3:
                    name_parts = name.split()[:3]
                    name = " ".join(name_parts)
                
                return {"name": name}
            else:
                return {"name": "Custom Assistant"}
            
    except httpx.RequestError as exc:
        error_detail = f"HTTP Request error: {str(exc)}"
        logger.error(error_detail)
        raise HTTPException(status_code=500, detail=error_detail)
    except Exception as e:
        error_detail = f"Unexpected error: {str(e)}"
        logger.error(error_detail)
        raise HTTPException(status_code=500, detail=error_detail)
    
# Add a new endpoint for image generation
@app.post("/generate-image")
async def generate_image(request: ChatRequest):
    logger.info(f"Received image generation request for agent: {request.agent_id}")
    
    # Check if agent exists
    if request.agent_id not in conversations:
        raise HTTPException(status_code=404, detail="Agent not found. Create an agent first.")
    
    # Check if agent is an image model
    if not conversations[request.agent_id].get("is_image_model", False):
        raise HTTPException(status_code=400, detail="This agent is not an image generation model")
    
    together_api_key = os.getenv("TOGETHER_API_KEY")
    if not together_api_key:
        raise HTTPException(status_code=500, detail="Together API key not found")
    
    # Add user message to conversation history
    conversations[request.agent_id]["messages"].append({"role": "user", "content": request.message})
    
    # Get model information
    model_id = conversations[request.agent_id]["model"]
    logger.info(f"Using image model for generation: {model_id}")
    
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            # Call the Together API image generation endpoint
            response = await client.post(
                "https://api.together.xyz/v1/images/generations",
                headers={
                    "Authorization": f"Bearer {together_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model_id,
                    "prompt": request.message,
                    "n": 1,
                    "size": "1024x1024"
                }
            )
            
            logger.info(f"Together API response status for image generation: {response.status_code}")
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"Error with image model {model_id}: {error_text}")
                
                # Try to parse the error response
                try:
                    error_json = response.json()
                    if "error" in error_json:
                        error_detail = error_json["error"].get("message", "Unknown error")
                        detail = f"Error with image model {model_id}: {error_detail}"
                    else:
                        detail = f"Error calling Together API with image model {model_id}: {error_text}"
                except:
                    detail = f"Error calling Together API with image model {model_id}: {error_text}"
                
                raise HTTPException(status_code=response.status_code, detail=detail)
            
            # Get the response
            api_response = response.json()
            
            # Add a simulated assistant message to conversation history
            assistant_message = {
                "role": "assistant", 
                "content": f"🎨 Here's the image I created based on '{request.message}'! What do you think?",
                "image_url": api_response.get("data", [{}])[0].get("url", "")
            }
            
            conversations[request.agent_id]["messages"].append(assistant_message)
            
            # Create a response similar to chat completions for consistency
            result = {
                "choices": [{
                    "message": assistant_message,
                    "index": 0,
                    "finish_reason": "stop"
                }],
                "model": model_id,
                "data": api_response.get("data", [])
            }
            
            return result
            
    except httpx.RequestError as exc:
        error_detail = f"HTTP Request error: {str(exc)}"
        logger.error(error_detail)
        
        # Create a fallback response instead of failing completely
        fallback_message = {
            "role": "assistant",
            "content": "🖼️ I hit a small bump while creating your image. The server might be busy right now. Let's try again in a moment!"
        }
        
        # Add the fallback message to conversation history
        conversations[request.agent_id]["messages"].append(fallback_message)
        
        # Return a proper response structure with the fallback message
        fallback_response = {
            "choices": [{
                "message": fallback_message,
                "index": 0, 
                "finish_reason": "error"
            }],
            "model": model_id,
            "error": error_detail
        }
        
        return fallback_response
    except Exception as e:
        error_detail = f"Unexpected error: {str(e)}"
        logger.error(error_detail)
        
        # Create a fallback response for general errors
        fallback_message = {
            "role": "assistant", 
            "content": "🎨 I couldn't create that image. This might be due to content filters or a technical glitch. Try a different description?"
        }
        
        # Add the fallback message to conversation history
        conversations[request.agent_id]["messages"].append(fallback_message)
        
        # Return a proper response structure with the fallback message
        fallback_response = {
            "choices": [{
                "message": fallback_message,
                "index": 0, 
                "finish_reason": "error"
            }],
            "model": model_id,
            "error": error_detail
        }
        
        return fallback_response
    
# Add new endpoint to get chat history
@app.get("/chat-history/{agent_id}")
async def get_chat_history(agent_id: str, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    messages = db.query(Message)\
        .filter(Message.agent_id == agent_id)\
        .order_by(Message.created_at)\
        .all()
    
    return {
        "agent": {
            "id": agent.id,
            "name": agent.name,
            "model": agent.model,
            "goal": agent.goal,
            "tools": agent.get_tools(),
            "created_at": agent.created_at
        },
        "messages": [
            {
                "role": msg.role,
                "content": msg.content,
                "created_at": msg.created_at
            }
            for msg in messages
        ]
    }

# Add endpoint to get user's agents
@app.get("/user-agents/{user_name}")
async def get_user_agents(user_name: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.name == user_name).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    agents = db.query(Agent).filter(Agent.user_id == user.id).all()
    
    return [
        {
            "id": agent.id,
            "name": agent.name,
            "model": agent.model,
            "goal": agent.goal,
            "tools": agent.get_tools(),
            "created_at": agent.created_at
        }
        for agent in agents
    ]
    
 

