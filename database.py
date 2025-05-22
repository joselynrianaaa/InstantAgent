from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import json
import os

# Create the SQLAlchemy engine with proper connection settings
DATABASE_URL = "sqlite:///./chat_history.db"
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # Needed for SQLite
    pool_pre_ping=True,  # Enable connection health checks
    pool_recycle=3600,  # Recycle connections every hour
)

# Create declarative base
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    agents = relationship("Agent", back_populates="user")

class Agent(Base):
    __tablename__ = "agents"
    
    id = Column(String(36), primary_key=True)  # UUID
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String(100))
    model = Column(String(100))
    goal = Column(Text)
    tools = Column(Text)  # Stored as JSON string
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="agents")
    messages = relationship("Message", back_populates="agent")

    def set_tools(self, tools_list):
        self.tools = json.dumps(tools_list)

    def get_tools(self):
        return json.loads(self.tools) if self.tools else []

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(String(36), ForeignKey("agents.id"))
    role = Column(String(20))  # system, user, or assistant
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    agent = relationship("Agent", back_populates="messages")

# Create all tables
Base.metadata.create_all(bind=engine)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 