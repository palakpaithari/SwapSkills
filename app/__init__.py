from flask import Flask
from dotenv import load_dotenv
import os
from .routes import main

load_dotenv()  # Load environment variables from .env

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY')
    # Configure Flask
    app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'fallback-secret-key')
    app.config['DEBUG'] = os.getenv('FLASK_DEBUG', 'False') == 'True'
    
    # Register blueprints
    app.register_blueprint(main)
    
    return app