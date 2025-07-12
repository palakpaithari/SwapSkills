import firebase_admin
from firebase_admin import credentials, firestore, storage
import os

# Path to your downloaded service account key
cred_path = os.path.join(os.path.dirname(__file__), '..', 'serviceAccountKey.json')

# Initialize Firebase
cred = credentials.Certificate(cred_path)  # Updated path
firebase_app = firebase_admin.initialize_app(cred, {
    'storageBucket': 'skillswap-21922.firebasestorage.app'  # Replace with your bucket
})

db = firestore.client()
bucket = storage.bucket()