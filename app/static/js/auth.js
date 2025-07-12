document.addEventListener('DOMContentLoaded', function () {
    const auth = firebase.auth();
    const db = firebase.firestore();

    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const resetForm = document.getElementById('reset-form');
    const signoutButton = document.getElementById('signout-button');
    const googleSignIn = document.getElementById('google-signin');
    const facebookSignIn = document.getElementById('facebook-signin');
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    const authNav = document.getElementById('auth-nav');

    const showError = (message) => {
        if (errorText && errorMessage) {
            errorText.textContent = message;
            errorMessage.classList.remove('hidden');
            setTimeout(() => errorMessage.classList.add('hidden'), 5000);
        }
    };

    const handleAuthError = (error) => {
        console.error('Auth Error:', error);
        const errorMap = {
            'auth/invalid-email': 'Please enter a valid email address',
            'auth/user-disabled': 'This account has been disabled',
            'auth/user-not-found': 'No account found with this email',
            'auth/wrong-password': 'Incorrect password. Please try again',
            'auth/email-already-in-use': 'This email is already in use',
            'auth/weak-password': 'Password should be at least 6 characters',
            'auth/operation-not-allowed': 'This operation is not allowed',
            'auth/popup-closed-by-user': 'Sign in cancelled'
        };
        showError(errorMap[error.code] || error.message || 'Authentication failed');
    };

    const setSessionCookie = async (user) => {
        const token = await user.getIdToken();
        const response = await fetch('/api/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });

        if (!response.ok) {
            throw new Error('Failed to create session');
        }
    };

    const createUserProfile = async (user, additionalData = {}) => {
        const userRef = db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            await userRef.set({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || additionalData.displayName || user.email.split('@')[0],
                photoURL: user.photoURL || '/static/images/default-avatar.png',
                skillsOffered: additionalData.skillsOffered || [],
                skillsWanted: additionalData.skillsWanted || [],
                availability: additionalData.availability || [],
                public: true,
                rating: 0,
                ratingCount: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await userRef.update({ lastLogin: firebase.firestore.FieldValue.serverTimestamp() });
        }
    };

    const updateUI = (user) => {
        const isLoggedIn = !!user;
        document.querySelectorAll('.auth-only').forEach(el => el.classList.toggle('hidden', !isLoggedIn));
        document.querySelectorAll('.guest-only').forEach(el => el.classList.toggle('hidden', isLoggedIn));

        if (authNav) {
            authNav.innerHTML = isLoggedIn
                ? `<li><a href="/profile" class="block py-2 px-4 hover:bg-gray-100">Profile</a></li>
                   <li><button id="signout-button" class="w-full text-left py-2 px-4 hover:bg-gray-100">Sign Out</button></li>`
                : `<li><a href="/login" class="block py-2 px-4 hover:bg-gray-100">Login</a></li>
                   <li><a href="/signup" class="block py-2 px-4 hover:bg-gray-100">Sign Up</a></li>`;

            const btn = document.getElementById('signout-button');
            if (btn) btn.addEventListener('click', () => auth.signOut());
        }
    };

    auth.onAuthStateChanged(async (user) => {
        updateUI(user);
        if (user) {
            await createUserProfile(user);
            if (['/login', '/signup'].includes(window.location.pathname)) {
                window.location.href = '/profile';
            }
        }
    });

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginForm.querySelector('input[name="email"]').value;
            const password = loginForm.querySelector('input[name="password"]').value;
            const rememberMe = loginForm.querySelector('input[name="remember"]').checked;

            try {
                await auth.setPersistence(
                    rememberMe
                        ? firebase.auth.Auth.Persistence.LOCAL
                        : firebase.auth.Auth.Persistence.SESSION
                );
                const userCred = await auth.signInWithEmailAndPassword(email, password);
                await setSessionCookie(userCred.user);
                window.location.href = '/profile';
            } catch (error) {
                handleAuthError(error);
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = signupForm.querySelector('input[name="email"]').value;
            const password = signupForm.querySelector('input[name="password"]').value;
            const displayName = signupForm.querySelector('input[name="displayName"]').value;

            try {
                const userCred = await auth.createUserWithEmailAndPassword(email, password);
                await userCred.user.updateProfile({ displayName });
                await setSessionCookie(userCred.user);
                await createUserProfile(userCred.user, { displayName });
                window.location.href = '/profile';
            } catch (error) {
                handleAuthError(error);
            }
        });
    }

    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = resetForm.querySelector('input[name="email"]').value;
            try {
                await auth.sendPasswordResetEmail(email);
                showError('Password reset email sent!');
            } catch (error) {
                handleAuthError(error);
            }
        });
    }

    const socialAuthHandler = async (provider) => {
        try {
            const result = await auth.signInWithPopup(provider);
            await setSessionCookie(result.user);
            await createUserProfile(result.user);
            window.location.href = '/profile';
        } catch (error) {
            handleAuthError(error);
        }
    };

    if (googleSignIn) googleSignIn.addEventListener('click', () => socialAuthHandler(new firebase.auth.GoogleAuthProvider()));
    if (facebookSignIn) facebookSignIn.addEventListener('click', () => socialAuthHandler(new firebase.auth.FacebookAuthProvider()));
});
const setFlaskSession = async (user) => {
    const idToken = await user.getIdToken();
    const response = await fetch("/api/session", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ token: idToken })
    });
    if (response.ok) {
        console.log("Session cookie set");
    } else {
        console.error("Failed to set session cookie");
    }
};
