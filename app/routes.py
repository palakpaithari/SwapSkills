from flask import Blueprint, render_template, request, jsonify, redirect, url_for, make_response
from firebase_admin import auth, firestore, exceptions
from .firebase_config import db, bucket
import uuid
from datetime import datetime
import os
from functools import wraps

main = Blueprint('main', __name__)

# ======================
# Helper Functions
# ======================

def get_user_data(user_id):
    user_ref = db.collection('users').document(user_id)
    user = user_ref.get()
    return user.to_dict() if user.exists else None

def validate_swap_request(data):
    required_fields = ['offered_skill', 'requested_skill', 'to_user_id']
    return all(field in data for field in required_fields)

def firebase_token_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'success': False, 'error': 'Authorization token required'}), 401
        try:
            decoded_token = auth.verify_id_token(token)
            request.user = decoded_token
            return f(*args, **kwargs)
        except exceptions.FirebaseError as e:
            return jsonify({'success': False, 'error': str(e)}), 401
    return wrapper

# ======================
# Frontend Routes
# ======================

@main.route('/')
def index():
    firebase_config = get_firebase_config()
    firebase_token = request.cookies.get('firebase_token')
    current_user = None
    users = []
    if firebase_token:
        try:
            decoded_token = auth.verify_id_token(firebase_token)
            current_user = get_user_data(decoded_token['uid'])
        except exceptions.FirebaseError:
            pass
    try:
        users_query = db.collection('users').where('public', '==', True).order_by('createdAt', direction=firestore.Query.DESCENDING).limit(20)
        users = [dict(doc.to_dict(), id=doc.id) for doc in users_query.stream()]
    except Exception as e:
        print("Error fetching users:", str(e))
    return render_template('index.html', firebase_config=firebase_config, current_user=current_user, users=users)

@main.route('/login')
def login():
    return render_template('login.html', firebase_config=get_firebase_config())

@main.route('/signup')
def signup():
    firebase_token = request.cookies.get('firebase_token')
    if firebase_token:
        try:
            decoded_token = auth.verify_id_token(firebase_token)
            return redirect(url_for('main.index'))  # Already logged in, redirect to homepage
        except:
            pass  # Token is invalid or expired, continue to signup
    return render_template('signup.html', firebase_config=get_firebase_config())

@main.route('/admin/add-user', methods=['POST'])
def add_user_manually():
    if not request.json:
        return jsonify({'success': False, 'error': 'JSON data required'}), 400

    try:
        user_data = {
            'displayName': request.json.get('displayName'),
            'email': request.json.get('email'),
            'photoURL': request.json.get('photoURL', ''),
            'skillsOffered': request.json.get('skillsOffered', []),
            'skillsWanted': request.json.get('skillsWanted', []),
            'availability': request.json.get('availability', []),
            'rating': request.json.get('rating', 0),
            'ratingCount': request.json.get('ratingCount', 0),
            'public': request.json.get('public', True),
            'createdAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP
        }

        # Add to Firestore
        doc_ref = db.collection('swaps').document()
        doc_ref.set(user_data)

        return jsonify({
            'success': True,
            'userId': doc_ref.id,
            'message': 'User added successfully'
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@main.route('/profile')
def profile():
    firebase_config = get_firebase_config()
    firebase_token = request.cookies.get('firebase_token')
    current_user = None
    if firebase_token:
        try:
            decoded_token = auth.verify_id_token(firebase_token)
            current_user = get_user_data(decoded_token['uid'])
        except exceptions.FirebaseError:
            pass
    return render_template('profile.html', firebase_config=firebase_config, current_user=current_user)

@main.route('/user/<user_id>')
def view_user(user_id):
    user_data = get_user_data(user_id)
    if not user_data or not user_data.get('public', True):
        return redirect(url_for('main.index'))
    return render_template('user.html', user_data=user_data, firebase_config=get_firebase_config())

@main.route('/request-swap/<user_id>')
def request_swap(user_id):
    recipient = get_user_data(user_id)
    if not recipient:
        return redirect(url_for('main.index'))
    firebase_token = request.cookies.get('firebase_token')
    if not firebase_token:
        return redirect(url_for('main.login'))
    try:
        decoded_token = auth.verify_id_token(firebase_token)
        current_user = get_user_data(decoded_token['uid'])
        return render_template('request_form.html', recipient=recipient, current_user=current_user)
    except exceptions.FirebaseError:
        return redirect(url_for('main.login'))

@main.route('/swap-requests')
def swap_requests():
    firebase_token = request.cookies.get('firebase_token')
    if not firebase_token:
        return redirect(url_for('main.login'))
    try:
        decoded_token = auth.verify_id_token(firebase_token)
        return render_template('swap_requests.html')
    except exceptions.FirebaseError:
        return redirect(url_for('main.login'))

# ======================
# API Routes
# ======================

@main.route('/api/session', methods=['POST'])

def create_session():
    id_token = request.json.get('token')
    if not id_token:
        return jsonify({'success': False, 'error': 'Token required'}), 400
    try:
        expires_in = 60 * 60 * 24 * 5
        session_cookie = auth.create_session_cookie(id_token, expires_in=expires_in)
        response = make_response(jsonify({'success': True}))
        response.set_cookie('firebase_token', value=session_cookie,
                            httponly=True, secure=True, samesite='Lax', max_age=expires_in)
        return response
    except exceptions.FirebaseError as e:
        return jsonify({'success': False, 'error': str(e)}), 401

@main.route('/api/profile', methods=['GET', 'POST', 'PUT'])
@firebase_token_required
def handle_profile():
    try:
        user_id = request.user['uid']
        user_ref = db.collection('users').document(user_id)
        
        if request.method == 'GET':
            user_doc = user_ref.get()
            if not user_doc.exists:
                return jsonify({'success': False, 'error': 'Profile not found'}), 404
            return jsonify({'success': True, 'profile': user_doc.to_dict()})

        data = request.json
        if not data.get('displayName'):
            return jsonify({'success': False, 'error': 'Display name is required'}), 400

        update_data = {
            'displayName': data['displayName'],
            'email': data.get('email', ''),
            'photoURL': data.get('photoURL', ''),
            'location': data.get('location', ''),
            'skillsOffered': data.get('skillsOffered', []),
            'skillsWanted': data.get('skillsWanted', []),
            'availability': data.get('availability', []),
            'public': data.get('public', True),
            'updatedAt': firestore.SERVER_TIMESTAMP
        }

        # Set the document with merge=True to update existing fields
        user_ref.set(update_data, merge=True)
        return jsonify({'success': True, 'message': 'Profile updated successfully'})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@main.route('/swap-profile/<swap_id>')
def swap_profile(swap_id):
    return render_template('swap_profile.html', swap_id=swap_id)

@main.route('/api/swap-requests', methods=['POST'])
@firebase_token_required
def create_swap_request():
    try:
        data = request.json
        user_id = request.user['uid']
        
        if not validate_swap_request(data):
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400

        swap_data = {
            'fromUserId': user_id,
            'toUserId': data['to_user_id'],
            'offeredSkill': data['offered_skill'],
            'requestedSkill': data['requested_skill'],
            'status': 'pending',
            'createdAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP
        }

        # Add to Firestore
        doc_ref = db.collection('swaps').document()
        doc_ref.set(swap_data)

        return jsonify({
            'success': True,
            'swapId': doc_ref.id,
            'message': 'Swap request created successfully'
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

def get_firebase_config():
    return {
        "apiKey": os.getenv('FIREBASE_API_KEY'),
        "authDomain": os.getenv('FIREBASE_AUTH_DOMAIN'),
        "projectId": os.getenv('FIREBASE_PROJECT_ID'),
        "storageBucket": os.getenv('FIREBASE_STORAGE_BUCKET'),
        "messagingSenderId": os.getenv('FIREBASE_MESSAGING_SENDER_ID'),
        "appId": os.getenv('FIREBASE_APP_ID'),
        "measurementId": os.getenv('FIREBASE_MEASUREMENT_ID', '')
    }
