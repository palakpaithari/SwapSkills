document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signup-form');
    if (!signupForm) return;

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;

        try {
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const token = await userCredential.user.getIdToken();

            // Create session cookie
            const response = await fetch('/api/session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token })
            });

            const result = await response.json();
            if (result.success) {
                window.location.href = "/profile";
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            const errorBox = document.getElementById('signup-error-message');
            const errorText = document.getElementById('signup-error-text');
            errorBox.classList.remove('hidden');
            errorText.textContent = err.message;
        }
    });
});
